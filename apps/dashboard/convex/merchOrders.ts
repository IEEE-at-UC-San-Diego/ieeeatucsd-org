import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { assertMerchShopper, requireMerchManager } from "./lib/merchAuth";
import { applyInventoryChange } from "./lib/merchInventory";
import { bookPickup, releasePickup } from "./lib/merchPickup";
import {
  cancelPendingOrder,
  derivePickupHealth,
  orderPickupChoice,
  projectMemberOrder,
  safeManagerOrderResult,
} from "./lib/merchOrders";
import { enqueueMerchNotification } from "./lib/merchOutbox";
import {
  aggregateRequestedQuantities,
  assertSafeInteger,
  checkoutRequestFingerprint,
  requireTrimmed,
  staleCartConflict,
} from "./lib/merchValidation";
import { appendPointLedgerEntry, ensurePointAccount } from "./lib/pointsLedger";
import { requireCurrentUser } from "./permissions";

const authArgs = { logtoId: v.string(), authToken: v.string() };
const pickupChoice = v.union(
  v.object({ type: v.literal("event"), pickupEventId: v.id("merchPickupEvents") }),
  v.object({ type: v.literal("slot"), pickupSlotId: v.id("merchPickupSlots") }),
);
const cartLine = v.object({
  productId: v.id("merchProducts"),
  variantId: v.id("merchVariants"),
  quantity: v.number(),
  expectedProductRevision: v.number(),
  expectedVariantRevision: v.number(),
  expectedUnitPrice: v.number(),
});

function randomHex(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function generateOrderIdentity(ctx: any) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderNumber = `M-${randomHex(6).toUpperCase()}`;
    const qrToken = randomHex(24); // 192 bits of CSPRNG entropy.
    const [numberConflict, tokenConflict] = await Promise.all([
      ctx.db
        .query("merchOrders")
        .withIndex("by_orderNumber", (q: any) => q.eq("orderNumber", orderNumber))
        .first(),
      ctx.db
        .query("merchOrders")
        .withIndex("by_qrToken", (q: any) => q.eq("qrToken", qrToken))
        .first(),
    ]);
    if (!numberConflict && !tokenConflict) return { orderNumber, qrToken };
  }
  throw new Error("Unable to allocate a secure order identity");
}

export const checkout = mutation({
  args: {
    ...authArgs,
    lines: v.array(cartLine),
    pickup: pickupChoice,
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const idempotencyKey = requireTrimmed(args.idempotencyKey, "Checkout idempotency key", 200);
    const requestFingerprint = checkoutRequestFingerprint(args);
    const existing = await ctx.db
      .query("merchOrders")
      .withIndex("by_owner_checkoutKey", (q) =>
        q.eq("ownerId", user._id).eq("checkoutIdempotencyKey", idempotencyKey),
      )
      .unique();
    if (existing) {
      if (existing.checkoutRequestFingerprint !== requestFingerprint) {
        throw new ConvexError({
          code: "IDEMPOTENCY_KEY_REUSED",
          message: "Checkout idempotency key was reused with a different cart or pickup",
          orderId: existing._id,
        });
      }
      return await projectMemberOrder(ctx, existing, true);
    }
    assertMerchShopper(user);
    const settings = await ctx.db.query("organizationSettings").first();
    if (!settings?.merchStoreEnabled || !settings.merchCheckoutEnabled) {
      throw new Error("Merch checkout is not enabled");
    }
    if (args.lines.length < 1 || args.lines.length > 50) {
      throw new Error("Cart must contain between 1 and 50 distinct variants");
    }
    const seenVariants = new Set<string>();
    const requestedByProduct = aggregateRequestedQuantities(args.lines);
    const checkedLimits = new Set<string>();
    const now = Date.now();
    const prepared = [];
    let totalPoints = 0;
    for (const line of args.lines) {
      assertSafeInteger(line.quantity, "Quantity", 1);
      if (seenVariants.has(line.variantId)) throw new Error("Cart contains a duplicate variant");
      seenVariants.add(line.variantId);
      const [product, variant] = await Promise.all([
        ctx.db.get(line.productId),
        ctx.db.get(line.variantId),
      ]);
      if (!product || !variant || variant.productId !== product._id) {
        throw new Error("Cart item no longer exists");
      }
      if (
        product.status !== "active" ||
        !variant.active ||
        (product.availableFrom !== undefined && product.availableFrom > now) ||
        (product.availableUntil !== undefined && product.availableUntil <= now)
      ) {
        throw new Error(`${product.name} is no longer available`);
      }
      if (
        product.revision !== line.expectedProductRevision ||
        variant.revision !== line.expectedVariantRevision ||
        variant.pointPrice !== line.expectedUnitPrice
      ) {
        throw new ConvexError(
          staleCartConflict({
          productId: product._id,
          variantId: variant._id,
          sku: variant.sku,
          expectedProductRevision: line.expectedProductRevision,
          expectedVariantRevision: line.expectedVariantRevision,
          expectedUnitPrice: line.expectedUnitPrice,
          currentProductRevision: product.revision,
          currentVariantRevision: variant.revision,
          currentUnitPrice: variant.pointPrice,
          stockOnHand: variant.stockOnHand,
        }));
      }
      if (variant.stockOnHand < line.quantity) {
        throw new ConvexError({
          code: "OUT_OF_STOCK",
          variantId: variant._id,
          sku: variant.sku,
          requestedQuantity: line.quantity,
          stockOnHand: variant.stockOnHand,
        });
      }
      const lineTotal = variant.pointPrice * line.quantity;
      assertSafeInteger(lineTotal, "Line total", 1);
      totalPoints += lineTotal;
      assertSafeInteger(totalPoints, "Order total", 1);

      if (product.purchaseLimit !== undefined && !checkedLimits.has(product._id)) {
        checkedLimits.add(product._id);
        const priorOrders = await ctx.db
          .query("merchOrders")
          .withIndex("by_owner_createdAt", (q) => q.eq("ownerId", user._id))
          .collect();
        const purchased = priorOrders
          .filter((order) => order.status !== "canceled")
          .flatMap((order) => order.lines)
          .filter((priorLine) => priorLine.productId === product._id)
          .reduce((sum, priorLine) => sum + priorLine.quantity, 0);
        const requestedQuantity = requestedByProduct.get(product._id) ?? 0;
        if (purchased + requestedQuantity > product.purchaseLimit) {
          throw new ConvexError({
            code: "PURCHASE_LIMIT",
            productId: product._id,
            productName: product.name,
            purchaseLimit: product.purchaseLimit,
            previouslyPurchased: purchased,
            requestedQuantity,
            remainingQuantity: Math.max(0, product.purchaseLimit - purchased),
          });
        }
      }
      prepared.push({
        productId: product._id,
        variantId: variant._id,
        productName: product.name,
        variantName:
          variant.optionValues.map((option) => option.value).join(" / ") || variant.sku,
        sku: variant.sku,
        imageStorageId: product.imageStorageId,
        unitPrice: variant.pointPrice,
        quantity: line.quantity,
        lineTotal,
        productRevision: product.revision,
        variantRevision: variant.revision,
      });
    }
    const account = await ensurePointAccount(ctx, user._id);
    if (account.balance < totalPoints) {
      throw new ConvexError({
        code: "INSUFFICIENT_POINTS",
        balance: account.balance,
        required: totalPoints,
        shortfall: totalPoints - account.balance,
      });
    }
    const pickup = await bookPickup(ctx, args.pickup, now);
    const { orderNumber, qrToken } = await generateOrderIdentity(ctx);
    const orderId = await ctx.db.insert("merchOrders", {
      orderNumber,
      ownerId: user._id,
      ownerName: user.name,
      ownerEmail: user.email,
      status: "pending",
      pickupHealth: "scheduled",
      lines: prepared,
      totalPoints,
      pickupType: pickup.type,
      pickupEventId: pickup.type === "event" ? pickup.pickupEventId : undefined,
      pickupSlotId: pickup.type === "slot" ? pickup.pickupSlotId : undefined,
      pickupSnapshot: pickup.snapshot,
      checkoutIdempotencyKey: idempotencyKey,
      checkoutRequestFingerprint: requestFingerprint,
      qrToken,
      createdAt: now,
      updatedAt: now,
    });
    const purchase = await appendPointLedgerEntry(ctx, {
      userId: user._id,
      balanceDelta: -totalPoints,
      lifetimeDelta: 0,
      kind: "purchase",
      sourceType: "merch_order",
      sourceId: orderId,
      idempotencyKey: `order:${orderId}:purchase`,
      actorId: user._id,
      reason: `Merch order ${orderNumber}`,
    });
    const linesWithMovements = [];
    for (const line of prepared) {
      const movement = await applyInventoryChange(ctx, {
        variantId: line.variantId,
        quantityDelta: -line.quantity,
        kind: "purchase",
        orderId,
        sourceId: orderId,
        idempotencyKey: `order:${orderId}:stock:${line.variantId}`,
        actorId: user._id,
        reason: `Merch order ${orderNumber}`,
      });
      linesWithMovements.push({ ...line, purchaseInventoryEntryId: movement._id });
    }
    await ctx.db.patch(orderId, {
      lines: linesWithMovements,
      purchaseLedgerEntryId: purchase._id,
    });
    await ctx.db.insert("merchOrderEvents", {
      orderId,
      action: "checkout",
      actorId: user._id,
      afterStatus: "pending",
      afterPickup: pickup.snapshot,
      requestId: `checkout:${idempotencyKey}`,
      pointLedgerEntryId: purchase._id,
      createdAt: now,
    });
    await enqueueMerchNotification(ctx, {
      orderId,
      recipientUserId: user._id,
      recipientEmail: user.email,
      kind: "order_confirmation",
      payload: { orderNumber, totalPoints, pickup: pickup.snapshot },
      idempotencyKey: `order:${orderId}:notice:confirmation`,
    });
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Order creation failed");
    return await projectMemberOrder(ctx, order, true);
  },
});

export const listMine = query({
  args: { ...authArgs, paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const result = await ctx.db
      .query("merchOrders")
      .withIndex("by_owner_createdAt", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map((order) => projectMemberOrder(ctx, order, false)),
      ),
    };
  },
});

export const getMine = query({
  args: { ...authArgs, orderId: v.id("merchOrders") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.ownerId !== user._id) throw new Error("Order not found");
    return await projectMemberOrder(ctx, order, true);
  },
});

export const cancelMine = mutation({
  args: { ...authArgs, orderId: v.id("merchOrders"), requestId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.ownerId !== user._id) throw new Error("Order not found");
    if (order.status === "canceled") return await projectMemberOrder(ctx, order, true);
    if (order.status !== "pending") throw new Error("Only pending orders can be canceled");
    const settings = await ctx.db.query("organizationSettings").first();
    const advanceMs = (settings?.merchMemberCancellationCutoffMinutes ?? 0) * 60_000;
    const policyCutoff = order.pickupSnapshot.startAt - advanceMs;
    const cutoff = Math.min(order.pickupSnapshot.cutoffAt ?? policyCutoff, policyCutoff);
    if (Date.now() >= cutoff) throw new Error("The member cancellation cutoff has passed");
    const canceled = await cancelPendingOrder(ctx, {
      order,
      actorId: user._id,
      reason: "Canceled by member",
      requestId: `member-cancel:${requireTrimmed(args.requestId, "Request ID", 200)}`,
    });
    return await projectMemberOrder(ctx, canceled, true);
  },
});

export const searchForManager = query({
  args: {
    ...authArgs,
    status: v.optional(v.union(v.literal("pending"), v.literal("fulfilled"), v.literal("canceled"))),
    search: v.optional(v.string()),
    pickupEventId: v.optional(v.id("merchPickupEvents")),
    pickupSlotId: v.optional(v.id("merchPickupSlots")),
    actionRequiredOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMerchManager(ctx, args.logtoId, args.authToken);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 250);
    let orders = args.status
      ? await ctx.db
          .query("merchOrders")
          .withIndex("by_status_createdAt", (q) => q.eq("status", args.status!))
          .order("desc")
          .take(500)
      : await ctx.db.query("merchOrders").order("desc").take(500);
    const needle = args.search?.trim().toLowerCase();
    const ordersWithHealth = await Promise.all(
      orders.map(async (order) => ({ order, health: await derivePickupHealth(ctx, order) })),
    );
    const filtered = ordersWithHealth.filter(({ order, health }) => {
      return (
        (!needle ||
          order.orderNumber.toLowerCase().includes(needle) ||
          order.ownerName.toLowerCase().includes(needle) ||
          order.ownerEmail.toLowerCase().includes(needle) ||
          order.lines.some((line) =>
            `${line.productName} ${line.sku}`.toLowerCase().includes(needle),
          )) &&
        (!args.pickupEventId || order.pickupEventId === args.pickupEventId) &&
        (!args.pickupSlotId || order.pickupSlotId === args.pickupSlotId) &&
        (!args.actionRequiredOnly || health === "overdue" || health === "action_required")
      );
    });
    return filtered.slice(0, limit).map(({ order, health }) => ({
      ...order,
      qrToken: undefined,
      pickupHealth: health,
    }));
  },
});

export const searchPageForManager = query({
  args: {
    ...authArgs,
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(v.literal("pending"), v.literal("fulfilled"), v.literal("canceled")),
    ),
    search: v.optional(v.string()),
    productId: v.optional(v.id("merchProducts")),
    sku: v.optional(v.string()),
    pickupEventId: v.optional(v.id("merchPickupEvents")),
    pickupSlotId: v.optional(v.id("merchPickupSlots")),
    pickupHealth: v.optional(
      v.union(
        v.literal("scheduled"),
        v.literal("overdue"),
        v.literal("action_required"),
      ),
    ),
    createdFrom: v.optional(v.number()),
    createdUntil: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMerchManager(ctx, args.logtoId, args.authToken);
    const candidateOrders = args.status
      ? await ctx.db
          .query("merchOrders")
          .withIndex("by_status_createdAt", (q) => q.eq("status", args.status!))
          .order("desc")
          .take(2001)
      : await ctx.db.query("merchOrders").order("desc").take(2001);
    const needle = args.search?.trim().toLowerCase();
    const normalizedSku = args.sku?.trim().toLowerCase();
    const projected = await Promise.all(
      candidateOrders.slice(0, 2000).map(async (order) => ({
        order,
        health: await derivePickupHealth(ctx, order),
      })),
    );
    const filtered = projected
      .filter(({ order, health }) => {
        return (
          (!needle ||
            order.orderNumber.toLowerCase().includes(needle) ||
            order.ownerName.toLowerCase().includes(needle) ||
            order.ownerEmail.toLowerCase().includes(needle) ||
            order.lines.some((line) =>
              `${line.productName} ${line.sku}`.toLowerCase().includes(needle),
            )) &&
          (!args.productId ||
            order.lines.some((line) => line.productId === args.productId)) &&
          (!normalizedSku ||
            order.lines.some((line) => line.sku.toLowerCase().includes(normalizedSku))) &&
          (!args.pickupEventId || order.pickupEventId === args.pickupEventId) &&
          (!args.pickupSlotId || order.pickupSlotId === args.pickupSlotId) &&
          (!args.pickupHealth || health === args.pickupHealth) &&
          (args.createdFrom === undefined || order.createdAt >= args.createdFrom) &&
          (args.createdUntil === undefined || order.createdAt < args.createdUntil)
        );
      })
      .map(({ order, health }) => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        ownerName: order.ownerName,
        ownerEmail: order.ownerEmail,
        status: order.status,
        pickupHealth: health,
        pickupSnapshot: order.pickupSnapshot,
        totalPoints: order.totalPoints,
        lines: order.lines.map((line) => ({
          productId: line.productId,
          productName: line.productName,
          variantName: line.variantName,
          sku: line.sku,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
        })),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }));
    const offset = Number.parseInt(args.paginationOpts.cursor ?? "0", 10);
    const safeOffset = Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
    const end = Math.min(safeOffset + args.paginationOpts.numItems, filtered.length);
    return {
      page: filtered.slice(safeOffset, end),
      isDone: end >= filtered.length,
      continueCursor: String(end),
      limitReached: candidateOrders.length > 2000,
    };
  },
});

export const getForManager = query({
  args: { ...authArgs, orderId: v.id("merchOrders") },
  handler: async (ctx, args) => {
    await requireMerchManager(ctx, args.logtoId, args.authToken);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    const [timeline, inventoryEntries, pointEntries] = await Promise.all([
      ctx.db
        .query("merchOrderEvents")
        .withIndex("by_order_createdAt", (q) => q.eq("orderId", order._id))
        .collect(),
      ctx.db
        .query("merchInventoryEntries")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect(),
      ctx.db
        .query("pointLedgerEntries")
        .withIndex("by_source", (q) => q.eq("sourceType", "merch_order").eq("sourceId", order._id))
        .collect(),
    ]);
    return {
      ...order,
      qrToken: undefined,
      pickupHealth: await derivePickupHealth(ctx, order),
      timeline,
      inventoryEntries,
      pointEntries,
    };
  },
});

export const cancelForManager = mutation({
  args: {
    ...authArgs,
    orderId: v.id("merchOrders"),
    reason: v.string(),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    const canceled = await cancelPendingOrder(ctx, {
      order,
      actorId: manager._id,
      reason: requireTrimmed(args.reason, "Cancellation reason", 500),
      requestId: `manager-cancel:${requireTrimmed(args.requestId, "Request ID", 200)}`,
    });
    return safeManagerOrderResult(canceled);
  },
});

export const rescheduleForManager = mutation({
  args: {
    ...authArgs,
    orderId: v.id("merchOrders"),
    pickup: pickupChoice,
    reason: v.string(),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    const requestId = requireTrimmed(args.requestId, "Request ID", 200);
    const reason = requireTrimmed(args.reason, "Reschedule reason", 500);
    const priorRequest = await ctx.db
      .query("merchOrderEvents")
      .withIndex("by_requestId", (q) => q.eq("requestId", `reschedule:${requestId}`))
      .unique();
    if (priorRequest) {
      const sameTarget =
        priorRequest.orderId === order._id &&
        priorRequest.reason === reason &&
        ((args.pickup.type === "event" &&
          priorRequest.pickupEventId === args.pickup.pickupEventId) ||
          (args.pickup.type === "slot" &&
            priorRequest.pickupSlotId === args.pickup.pickupSlotId));
      if (!sameTarget) {
        throw new ConvexError({
          code: "IDEMPOTENCY_KEY_REUSED",
          message: "Reschedule request ID was reused with different details",
        });
      }
      return safeManagerOrderResult(order);
    }
    if (order.status !== "pending") throw new Error("Only pending orders can be rescheduled");
    const currentChoice = orderPickupChoice(order);
    if (
      (currentChoice.type === "event" &&
        args.pickup.type === "event" &&
        currentChoice.pickupEventId === args.pickup.pickupEventId) ||
      (currentChoice.type === "slot" &&
        args.pickup.type === "slot" &&
        currentChoice.pickupSlotId === args.pickup.pickupSlotId)
    ) {
      throw new Error("Select a different pickup option");
    }
    const nextPickup = await bookPickup(ctx, args.pickup);
    await releasePickup(ctx, currentChoice);
    const now = Date.now();
    await ctx.db.patch(order._id, {
      pickupType: nextPickup.type,
      pickupEventId: nextPickup.type === "event" ? nextPickup.pickupEventId : undefined,
      pickupSlotId: nextPickup.type === "slot" ? nextPickup.pickupSlotId : undefined,
      pickupSnapshot: nextPickup.snapshot,
      pickupHealth: "scheduled",
      lastRescheduleRequestId: requestId,
      updatedAt: now,
    });
    await ctx.db.insert("merchOrderEvents", {
      orderId: order._id,
      action: "rescheduled",
      actorId: manager._id,
      beforeStatus: "pending",
      afterStatus: "pending",
      beforePickup: order.pickupSnapshot,
      afterPickup: nextPickup.snapshot,
      pickupEventId: nextPickup.type === "event" ? nextPickup.pickupEventId : undefined,
      pickupSlotId: nextPickup.type === "slot" ? nextPickup.pickupSlotId : undefined,
      reason,
      requestId: `reschedule:${requestId}`,
      createdAt: now,
    });
    await enqueueMerchNotification(ctx, {
      orderId: order._id,
      recipientUserId: order.ownerId,
      recipientEmail: order.ownerEmail,
      kind: "rescheduled",
      payload: { orderNumber: order.orderNumber, pickup: nextPickup.snapshot, reason },
      idempotencyKey: `order:${order._id}:notice:reschedule:${requestId}`,
    });
    const updated = await ctx.db.get(order._id);
    if (!updated) throw new Error("Rescheduled order not found");
    return safeManagerOrderResult(updated);
  },
});

export const exportForManager = query({
  args: authArgs,
  handler: async (ctx, args) => {
    await requireMerchManager(ctx, args.logtoId, args.authToken);
    const orders = await ctx.db.query("merchOrders").collect();
    return orders.map((order) => ({
      orderNumber: order.orderNumber,
      memberName: order.ownerName,
      memberEmail: order.ownerEmail,
      status: order.status,
      totalPoints: order.totalPoints,
      items: order.lines.map((line) => `${line.quantity}x ${line.productName} (${line.sku})`).join("; "),
      pickup: order.pickupSnapshot.label,
      pickupStartAt: order.pickupSnapshot.startAt,
      createdAt: order.createdAt,
      fulfilledAt: order.fulfilledAt,
      canceledAt: order.canceledAt,
    }));
  },
});

export const reconcileForManager = query({
  args: authArgs,
  handler: async (ctx, args) => {
    await requireMerchManager(ctx, args.logtoId, args.authToken);
    const orders = await ctx.db.query("merchOrders").collect();
    const orderResults = await Promise.all(
      orders.map(async (order) => {
        const issues: string[] = [];
        const computedTotal = order.lines.reduce(
          (sum, line) => sum + line.unitPrice * line.quantity,
          0,
        );
        if (computedTotal !== order.totalPoints) issues.push("Order total does not match lines");
        const purchase = order.purchaseLedgerEntryId
          ? await ctx.db.get(order.purchaseLedgerEntryId)
          : null;
        if (
          !purchase ||
          purchase.kind !== "purchase" ||
          purchase.balanceDelta !== -order.totalPoints ||
          purchase.sourceType !== "merch_order" ||
          purchase.sourceId !== order._id
        ) {
          issues.push("Purchase point ledger entry is missing or inconsistent");
        }
        for (const line of order.lines) {
          const movement = line.purchaseInventoryEntryId
            ? await ctx.db.get(line.purchaseInventoryEntryId)
            : null;
          if (
            !movement ||
            movement.orderId !== order._id ||
            movement.variantId !== line.variantId ||
            movement.kind !== "purchase" ||
            movement.quantityDelta !== -line.quantity
          ) {
            issues.push(`Purchase inventory movement is inconsistent for ${line.sku}`);
          }
        }
        if (order.status === "canceled") {
          const refund = order.refundLedgerEntryId
            ? await ctx.db.get(order.refundLedgerEntryId)
            : null;
          if (
            !refund ||
            refund.kind !== "refund" ||
            refund.balanceDelta !== order.totalPoints ||
            refund.reversalOf !== order.purchaseLedgerEntryId
          ) {
            issues.push("Cancellation refund is missing or inconsistent");
          }
          const cancellationMovements = await ctx.db
            .query("merchInventoryEntries")
            .withIndex("by_order", (q) => q.eq("orderId", order._id))
            .collect();
          for (const line of order.lines) {
            if (
              !cancellationMovements.some(
                (movement) =>
                  movement.kind === "cancellation" &&
                  movement.variantId === line.variantId &&
                  movement.quantityDelta === line.quantity &&
                  movement.reversalOf === line.purchaseInventoryEntryId,
              )
            ) {
              issues.push(`Cancellation inventory reversal is inconsistent for ${line.sku}`);
            }
          }
        }
        return {
          orderId: order._id,
          orderNumber: order.orderNumber,
          reconciles: issues.length === 0,
          issues,
        };
      }),
    );

    const pickupEvents = await ctx.db.query("merchPickupEvents").collect();
    const pickupSlots = await ctx.db.query("merchPickupSlots").collect();
    const pickupResults = [
      ...pickupEvents.map((pickup) => {
        const expected = orders.filter(
          (order) => order.pickupEventId === pickup._id && order.status !== "canceled",
        ).length;
        return {
          type: "event" as const,
          pickupId: pickup._id,
          bookedCount: pickup.bookedCount,
          expectedBookedCount: expected,
          reconciles: pickup.bookedCount === expected,
        };
      }),
      ...pickupSlots.map((pickup) => {
        const expected = orders.filter(
          (order) => order.pickupSlotId === pickup._id && order.status !== "canceled",
        ).length;
        return {
          type: "slot" as const,
          pickupId: pickup._id,
          bookedCount: pickup.bookedCount,
          expectedBookedCount: expected,
          reconciles: pickup.bookedCount === expected,
        };
      }),
    ];
    return {
      reconciles:
        orderResults.every((result) => result.reconciles) &&
        pickupResults.every((result) => result.reconciles),
      orders: orderResults,
      pickups: pickupResults,
    };
  },
});
