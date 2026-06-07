import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getUserPointTotals } from "../points/helpers";
import { deductMerchandisePoints } from "../points/service";
import { requireMerchAdmin, requireMerchOfficer } from "./helpers";
import {
  allocateDisplayNumber,
  appendOrderAuditLog,
  assertPickupOptionSelectable,
  consumePickupCapacity,
  deriveOrderStatus,
  deriveStatusCounts,
  fulfillVariantInventory,
  generatePickupCode,
  generateQrToken,
  getUserPurchasedQuantityForRelease,
  getUserPurchasedQuantityForVariant,
  getVariantPointPrice,
  isItemFulfillable,
  isPickupCompatibleWithRelease,
  isReleaseOnSale,
  reserveVariantInventory,
  syncOrderStatusFromItems,
} from "./orderHelpers";

const checkoutItemValidator = v.object({
  variantId: v.id("merchVariants"),
  releaseId: v.id("merchReleases"),
  productId: v.id("merchProducts"),
  quantity: v.number(),
});

const FULFILLABLE_ORDER_STATUSES = new Set([
  "confirmed",
  "action_required",
  "pickup_missed",
  "partially_fulfilled",
  "mixed",
]);

async function enrichOrderForOfficer(ctx: QueryCtx, order: Doc<"merchOrders">) {
  const member = await ctx.db.get(order.userId);
  const items = await ctx.db
    .query("merchOrderItems")
    .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
    .collect();

  return {
    _id: order._id,
    displayNumber: order.displayNumber,
    pickupCode: order.pickupCode,
    status: order.status,
    statusCounts: order.statusCounts,
    pointTotal: order.pointTotal,
    itemQuantityTotal: order.itemQuantityTotal,
    pickupOptionId: order.pickupOptionId,
    pickupLabel: order.pickupLabel,
    pickupType: order.pickupType,
    pickupCutoffAt: order.pickupCutoffAt,
    checkoutGroupId: order.checkoutGroupId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    member: member
      ? { _id: member._id, name: member.name, email: member.email }
      : null,
    items: items.map((item) => ({
      _id: item._id,
      productName: item.productName,
      variantLabel: item.variantLabel,
      sku: item.sku,
      pointPrice: item.pointPrice,
      quantity: item.quantity,
      fulfilledQuantity: item.fulfilledQuantity ?? 0,
      status: item.status,
      remainingQuantity: item.quantity - (item.fulfilledQuantity ?? 0),
    })),
  };
}

export const listOrdersForOfficer = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    pickupOptionId: v.optional(v.string()),
    status: v.optional(v.string()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const limit = args.limit ?? 100;

    let orders: Doc<"merchOrders">[];
    if (args.pickupOptionId) {
      orders = await ctx.db
        .query("merchOrders")
        .withIndex("by_pickupOptionId", (q) =>
          q.eq("pickupOptionId", args.pickupOptionId!),
        )
        .order("desc")
        .take(limit * 2);
    } else {
      orders = await ctx.db.query("merchOrders").order("desc").take(limit * 2);
    }

    const search = args.search?.trim().toLowerCase();
    const filtered = [];
    for (const order of orders) {
      if (args.status && order.status !== args.status) continue;
      if (!FULFILLABLE_ORDER_STATUSES.has(order.status) && args.status === undefined) {
        if (order.status === "canceled" || order.status === "fulfilled") continue;
      }

      if (search) {
        const member = await ctx.db.get(order.userId);
        const matchesSearch =
          order.displayNumber.toLowerCase().includes(search) ||
          order.pickupCode.toLowerCase().includes(search) ||
          member?.name.toLowerCase().includes(search) ||
          member?.email.toLowerCase().includes(search);
        if (!matchesSearch) continue;
      }

      filtered.push(await enrichOrderForOfficer(ctx, order));
      if (filtered.length >= limit) break;
    }

    return filtered;
  },
});

export const lookupOrderForPickup = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    pickupOptionId: v.string(),
    lookup: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const lookup = args.lookup.trim();
    if (!lookup) return null;

    let order =
      (await ctx.db
        .query("merchOrders")
        .withIndex("by_pickupCode", (q) => q.eq("pickupCode", lookup.toUpperCase()))
        .first()) ??
      (await ctx.db
        .query("merchOrders")
        .withIndex("by_qrToken", (q) => q.eq("qrToken", lookup))
        .first()) ??
      (await ctx.db
        .query("merchOrders")
        .withIndex("by_displayNumber", (q) => q.eq("displayNumber", lookup.toUpperCase()))
        .first());

    if (!order) {
      const orders = await ctx.db.query("merchOrders").order("desc").take(500);
      for (const candidate of orders) {
        const member = await ctx.db.get(candidate.userId);
        if (
          member &&
          (member.name.toLowerCase().includes(lookup.toLowerCase()) ||
            member.email.toLowerCase().includes(lookup.toLowerCase()))
        ) {
          order = candidate;
          break;
        }
      }
    }

    if (!order || order.pickupOptionId !== args.pickupOptionId) return null;
    return enrichOrderForOfficer(ctx, order);
  },
});

async function performFulfillmentItems(
  ctx: MutationCtx,
  args: {
    officer: Doc<"users">;
    order: Doc<"merchOrders">;
    items: Array<{ orderItemId: Id<"merchOrderItems">; quantity: number }>;
    idempotencyKey: string;
    lateRecordingNote?: string;
    codeUnavailableReason?: string;
  },
) {
  const existing = await ctx.db
    .query("merchOrderAuditLog")
    .withIndex("by_orderId_timestamp", (q) => q.eq("orderId", args.order._id))
    .collect();
  const duplicate = existing.find(
    (entry) =>
      entry.action === "fulfill_items" &&
      entry.metadata &&
      typeof entry.metadata === "object" &&
      "idempotencyKey" in entry.metadata &&
      entry.metadata.idempotencyKey === args.idempotencyKey,
  );
  if (duplicate) {
    return { orderId: args.order._id };
  }

  const now = Date.now();
  for (const fulfillment of args.items) {
    const item = await ctx.db.get(fulfillment.orderItemId);
    if (!item || item.orderId !== args.order._id) {
      throw new Error("Invalid order item");
    }
    if (!isItemFulfillable(item.status)) {
      throw new Error(`Item ${item.productName} cannot be fulfilled`);
    }
    if (fulfillment.quantity <= 0) continue;

    const alreadyFulfilled = item.fulfilledQuantity ?? 0;
    const remaining = item.quantity - alreadyFulfilled;
    if (fulfillment.quantity > remaining) {
      throw new Error(`Cannot fulfill more than remaining quantity for ${item.productName}`);
    }

    await fulfillVariantInventory(ctx, {
      variantId: item.variantId,
      quantity: fulfillment.quantity,
    });

    const newFulfilled = alreadyFulfilled + fulfillment.quantity;
    const nextStatus =
      newFulfilled >= item.quantity ? ("fulfilled" as const) : ("partially_fulfilled" as const);

    await ctx.db.patch(item._id, {
      fulfilledQuantity: newFulfilled,
      status: nextStatus,
      updatedAt: now,
    });
  }

  await syncOrderStatusFromItems(ctx, args.order._id);

  await appendOrderAuditLog(ctx, {
    orderId: args.order._id,
    action: "fulfill_items",
    actorUserId: args.officer._id,
    actorLabel: args.officer.name,
    note: args.lateRecordingNote ?? args.codeUnavailableReason,
    metadata: {
      idempotencyKey: args.idempotencyKey,
      items: args.items,
      fulfilledAt: now,
    },
  });

  return { orderId: args.order._id };
}

export const fulfillItems = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    orderId: v.id("merchOrders"),
    items: v.array(
      v.object({
        orderItemId: v.id("merchOrderItems"),
        quantity: v.number(),
      }),
    ),
    idempotencyKey: v.string(),
    lateRecordingNote: v.optional(v.string()),
    codeUnavailableReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    return performFulfillmentItems(ctx, {
      officer,
      order,
      items: args.items,
      idempotencyKey: args.idempotencyKey,
      lateRecordingNote: args.lateRecordingNote,
      codeUnavailableReason: args.codeUnavailableReason,
    });
  },
});

export const recordPickup = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    orderId: v.id("merchOrders"),
    idempotencyKey: v.string(),
    lateRecordingNote: v.optional(v.string()),
    codeUnavailableReason: v.optional(v.string()),
    partialItems: v.optional(
      v.array(
        v.object({
          orderItemId: v.id("merchOrderItems"),
          quantity: v.number(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    const orderItems = await ctx.db
      .query("merchOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .collect();

    const itemsToFulfill =
      args.partialItems ??
      orderItems
        .filter((item) => isItemFulfillable(item.status))
        .map((item) => ({
          orderItemId: item._id,
          quantity: item.quantity - (item.fulfilledQuantity ?? 0),
        }))
        .filter((item) => item.quantity > 0);

    if (itemsToFulfill.length === 0) {
      throw new Error("No items available to fulfill");
    }

    return performFulfillmentItems(ctx, {
      officer,
      order,
      items: itemsToFulfill,
      idempotencyKey: args.idempotencyKey,
      lateRecordingNote: args.lateRecordingNote,
      codeUnavailableReason: args.codeUnavailableReason,
    });
  },
});

async function createOfficerOrder(
  ctx: MutationCtx,
  args: {
    officer: Doc<"users">;
    member: Doc<"users">;
    pickupOptionId: string;
    items: Array<{
      variantId: Id<"merchVariants">;
      releaseId: Id<"merchReleases">;
      productId: Id<"merchProducts">;
      quantity: number;
    }>;
    idempotencyKey: string;
    complimentary: boolean;
    reason: string;
    consumeAllowance?: boolean;
    overrideRestrictions?: boolean;
  },
) {
  const existingOrder = await ctx.db
    .query("merchOrders")
    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
    .first();
  if (existingOrder) {
    return { orderId: existingOrder._id, displayNumber: existingOrder.displayNumber };
  }

  const pickup = await assertPickupOptionSelectable(ctx, args.pickupOptionId);
  const now = Date.now();
  const validLines: Array<{
    variantId: Id<"merchVariants">;
    releaseId: Id<"merchReleases">;
    productId: Id<"merchProducts">;
    quantity: number;
    productName: string;
    variantLabel: string;
    sku: string;
    pointPrice: number;
    lineTotal: number;
    imageStorageId?: Id<"_storage">;
  }> = [];
  let pointTotal = 0;

  for (const item of args.items) {
    const variant = await ctx.db.get(item.variantId);
    const release = await ctx.db.get(item.releaseId);
    const product = await ctx.db.get(item.productId);
    if (!variant || !release || !product) {
      throw new Error("Invalid catalog item");
    }

    if (!args.overrideRestrictions && !args.complimentary) {
      if (!isReleaseOnSale(release) || product.status !== "active" || !variant.enabled) {
        throw new Error(`${product.name} is not available for purchase`);
      }
    }

    if (!isPickupCompatibleWithRelease(release, args.pickupOptionId)) {
      throw new Error(`${product.name} is not eligible for the selected pickup`);
    }

    const available = Math.max(0, variant.onHand - variant.reserved);
    if (available < item.quantity) {
      throw new Error(`Insufficient inventory for ${variant.label}`);
    }

    if (!args.complimentary && !args.overrideRestrictions) {
      const releasePurchased = await getUserPurchasedQuantityForRelease(
        ctx,
        args.member._id,
        release._id,
      );
      if (
        release.releasePurchaseLimit !== undefined &&
        releasePurchased + item.quantity > release.releasePurchaseLimit
      ) {
        throw new Error(`Purchase limit exceeded for ${product.name}`);
      }

      const variantPurchased = await getUserPurchasedQuantityForVariant(
        ctx,
        args.member._id,
        variant._id,
      );
      if (
        variant.variantPurchaseLimit !== undefined &&
        variantPurchased + item.quantity > variant.variantPurchaseLimit
      ) {
        throw new Error(`Variant limit exceeded for ${variant.label}`);
      }
    }

    const pointPrice = args.complimentary ? 0 : getVariantPointPrice(release, variant);
    const lineTotal = pointPrice * item.quantity;
    pointTotal += lineTotal;

    validLines.push({
      variantId: variant._id,
      releaseId: release._id,
      productId: product._id,
      quantity: item.quantity,
      productName: product.name,
      variantLabel: variant.label,
      sku: variant.sku,
      pointPrice,
      lineTotal,
      imageStorageId: variant.imageStorageId ?? product.primaryImageStorageId,
    });
  }

  if (!args.complimentary) {
    const totals = getUserPointTotals(args.member);
    if (totals.spendablePoints < pointTotal) {
      throw new Error("Member has insufficient spendable points");
    }
  }

  const displayNumber = await allocateDisplayNumber(ctx, now);
  const pickupCode = generatePickupCode();
  const qrToken = generateQrToken();
  const itemQuantityTotal = validLines.reduce((sum, line) => sum + line.quantity, 0);
  const itemStatuses = validLines.map((line) => ({
    status: "confirmed" as const,
    quantity: line.quantity,
  }));

  const orderId = await ctx.db.insert("merchOrders", {
    userId: args.member._id,
    displayNumber,
    pickupCode,
    qrToken,
    pickupOptionId: args.pickupOptionId,
    pickupLabel: pickup.label,
    pickupType: pickup.type,
    status: deriveOrderStatus(itemStatuses),
    statusCounts: deriveStatusCounts(itemStatuses),
    pointTotal,
    itemQuantityTotal,
    pickupCutoffAt: pickup.cutoffAt,
    idempotencyKey: args.idempotencyKey,
    createdAt: now,
    updatedAt: now,
  });

  for (const line of validLines) {
    await ctx.db.insert("merchOrderItems", {
      orderId,
      productId: line.productId,
      releaseId: line.releaseId,
      variantId: line.variantId,
      productName: line.productName,
      variantLabel: line.variantLabel,
      sku: line.sku,
      pointPrice: line.pointPrice,
      quantity: line.quantity,
      imageStorageId: line.imageStorageId,
      status: "confirmed",
      createdAt: now,
      updatedAt: now,
    });

    await reserveVariantInventory(ctx, {
      variantId: line.variantId,
      quantity: line.quantity,
    });
  }

  if (pointTotal > 0) {
    await deductMerchandisePoints(ctx, {
      userId: args.member._id,
      amount: pointTotal,
      orderId,
      description: `Officer-assisted order ${displayNumber}`,
      idempotencyKey: `${args.idempotencyKey}:points`,
    });
  }

  await consumePickupCapacity(ctx, args.pickupOptionId);

  await appendOrderAuditLog(ctx, {
    orderId,
    action: args.complimentary ? "complimentary_order" : "officer_assisted_order",
    actorUserId: args.officer._id,
    actorLabel: args.officer.name,
    note: args.reason,
    metadata: {
      memberId: args.member._id,
      pointTotal,
      consumeAllowance: args.consumeAllowance ?? false,
      overrideRestrictions: args.overrideRestrictions ?? false,
    },
  });

  return { orderId, displayNumber, pickupCode, pointTotal };
}

export const officerAssistedOrder = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    memberUserId: v.id("users"),
    pickupOptionId: v.string(),
    items: v.array(checkoutItemValidator),
    idempotencyKey: v.string(),
    reason: v.string(),
    overrideRestrictions: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    if (!args.reason.trim()) throw new Error("Reason is required");

    const member = await ctx.db.get(args.memberUserId);
    if (!member) throw new Error("Member not found");

    if (args.overrideRestrictions) {
      await requireMerchAdmin(ctx, args.logtoId, args.authToken);
    }

    return createOfficerOrder(ctx, {
      officer,
      member,
      pickupOptionId: args.pickupOptionId,
      items: args.items,
      idempotencyKey: args.idempotencyKey,
      complimentary: false,
      reason: args.reason.trim(),
      overrideRestrictions: args.overrideRestrictions,
    });
  },
});

export const complimentaryOrder = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    memberUserId: v.id("users"),
    pickupOptionId: v.string(),
    items: v.array(checkoutItemValidator),
    idempotencyKey: v.string(),
    reason: v.string(),
    consumeAllowance: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchAdmin(ctx, args.logtoId, args.authToken);
    if (!args.reason.trim()) throw new Error("Reason is required");

    const member = await ctx.db.get(args.memberUserId);
    if (!member) throw new Error("Member not found");

    return createOfficerOrder(ctx, {
      officer,
      member,
      pickupOptionId: args.pickupOptionId,
      items: args.items,
      idempotencyKey: args.idempotencyKey,
      complimentary: true,
      reason: args.reason.trim(),
      consumeAllowance: args.consumeAllowance,
      overrideRestrictions: true,
    });
  },
});
