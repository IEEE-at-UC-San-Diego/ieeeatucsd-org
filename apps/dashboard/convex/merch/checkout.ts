import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { getUserPointTotals } from "../points/helpers";
import { deductMerchandisePoints } from "../points/service";
import { requireStorePurchaseAccess } from "./helpers";
import {
  allocateDisplayNumber,
  appendOrderAuditLog,
  assertPickupOptionSelectable,
  consumePickupCapacity,
  deriveOrderStatus,
  deriveStatusCounts,
  generatePickupCode,
  generateQrToken,
  getUserPurchasedQuantityForRelease,
  getUserPurchasedQuantityForVariant,
  getVariantPointPrice,
  isPickupCompatibleWithRelease,
  isReleaseOnSale,
  loadEnrichedPickupOption,
  reserveVariantInventory,
} from "./orderHelpers";
import { isPickupOptionSelectable } from "./pickupHelpers";

const checkoutItemValidator = v.object({
  variantId: v.id("merchVariants"),
  releaseId: v.id("merchReleases"),
  productId: v.id("merchProducts"),
  quantity: v.number(),
});

type ValidatedLine = {
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
};

type ValidationIssue = {
  variantId: Id<"merchVariants">;
  code: string;
  message: string;
  requestedQuantity: number;
  allowedQuantity: number;
};

async function getCheckoutGuards(ctx: QueryCtx, user: Doc<"users">) {
  const settings = await ctx.db.query("merchSettings").first();
  const storeEnabled = settings?.storeEnabled ?? false;

  const now = Date.now();
  const published = (
    await ctx.db
      .query("merchPolicies")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect()
  )
    .filter((policy) => (policy.effectiveAt ?? 0) <= now)
    .sort((a, b) => (b.effectiveAt ?? 0) - (a.effectiveAt ?? 0))[0];

  const publishedPolicyVersion = published?.version ?? null;
  const policyAccepted =
    publishedPolicyVersion === null ||
    user.merchPolicyVersion === publishedPolicyVersion;

  return { storeEnabled, publishedPolicyVersion, policyAccepted };
}

async function validateCheckoutLines(
  ctx: QueryCtx,
  userId: Id<"users">,
  items: Array<Doc<"merchCarts">["items"][number]>,
  pickupOptionId: string,
) {
  const pickup = await assertPickupOptionSelectable(ctx, pickupOptionId);
  const validLines: ValidatedLine[] = [];
  const issues: ValidationIssue[] = [];
  let pointTotal = 0;

  for (const item of items) {
    const variant = await ctx.db.get(item.variantId);
    const release = await ctx.db.get(item.releaseId);
    const product = await ctx.db.get(item.productId);

    if (!variant || !release || !product) {
      issues.push({
        variantId: item.variantId,
        code: "not_found",
        message: "Item is no longer available",
        requestedQuantity: item.quantity,
        allowedQuantity: 0,
      });
      continue;
    }

    if (!isReleaseOnSale(release) || product.status !== "active" || !variant.enabled) {
      issues.push({
        variantId: item.variantId,
        code: "unavailable",
        message: "Item is no longer available for purchase",
        requestedQuantity: item.quantity,
        allowedQuantity: 0,
      });
      continue;
    }

    if (!isPickupCompatibleWithRelease(release, pickupOptionId)) {
      issues.push({
        variantId: item.variantId,
        code: "pickup_incompatible",
        message: "Item is not eligible for the selected pickup",
        requestedQuantity: item.quantity,
        allowedQuantity: 0,
      });
      continue;
    }

    const available = Math.max(0, variant.onHand - variant.reserved);
    let allowedQuantity = Math.min(item.quantity, available);

    const releasePurchased = await getUserPurchasedQuantityForRelease(
      ctx,
      userId,
      release._id,
    );
    if (release.releasePurchaseLimit !== undefined) {
      const remaining = release.releasePurchaseLimit - releasePurchased;
      allowedQuantity = Math.min(allowedQuantity, Math.max(0, remaining));
    }

    const variantPurchased = await getUserPurchasedQuantityForVariant(
      ctx,
      userId,
      variant._id,
    );
    if (variant.variantPurchaseLimit !== undefined) {
      const remaining = variant.variantPurchaseLimit - variantPurchased;
      allowedQuantity = Math.min(allowedQuantity, Math.max(0, remaining));
    }

    if (allowedQuantity <= 0) {
      issues.push({
        variantId: item.variantId,
        code: "unavailable",
        message: "Item cannot be purchased with current limits or inventory",
        requestedQuantity: item.quantity,
        allowedQuantity: 0,
      });
      continue;
    }

    if (allowedQuantity < item.quantity) {
      issues.push({
        variantId: item.variantId,
        code: "quantity_reduced",
        message: `Quantity reduced from ${item.quantity} to ${allowedQuantity}`,
        requestedQuantity: item.quantity,
        allowedQuantity,
      });
    }

    const pointPrice = getVariantPointPrice(release, variant);
    const lineTotal = pointPrice * allowedQuantity;
    pointTotal += lineTotal;

    validLines.push({
      variantId: variant._id,
      releaseId: release._id,
      productId: product._id,
      quantity: allowedQuantity,
      productName: product.name,
      variantLabel: variant.label,
      sku: variant.sku,
      pointPrice,
      lineTotal,
      imageStorageId: variant.imageStorageId ?? product.primaryImageStorageId,
    });
  }

  return { pickup, validLines, issues, pointTotal };
}

export const validateCheckout = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    pickupOptionId: v.string(),
    items: v.optional(v.array(checkoutItemValidator)),
  },
  handler: async (ctx, args) => {
    const user = await requireStorePurchaseAccess(ctx, args.logtoId, args.authToken);
    const cart = await ctx.db
      .query("merchCarts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    const cartItems = args.items ?? cart?.items ?? [];
    if (cartItems.length === 0) {
      const guards = await getCheckoutGuards(ctx, user);
      return {
        ready: false,
        requiresConfirmation: false,
        storeEnabled: guards.storeEnabled,
        policyAccepted: guards.policyAccepted,
        publishedPolicyVersion: guards.publishedPolicyVersion,
        pointTotal: 0,
        spendablePoints: getUserPointTotals(user).spendablePoints,
        insufficientPoints: false,
        issues: [{ code: "empty_cart", message: "Cart is empty" }],
        validLines: [],
        pickup: null,
      };
    }

    const result = await validateCheckoutLines(
      ctx,
      user._id,
      cartItems,
      args.pickupOptionId,
    );
    const totals = getUserPointTotals(user);
    const guards = await getCheckoutGuards(ctx, user);
    const requiresConfirmation = result.issues.length > 0;
    const ready =
      result.validLines.length > 0 &&
      !requiresConfirmation &&
      totals.spendablePoints >= result.pointTotal &&
      guards.storeEnabled &&
      guards.policyAccepted;

    return {
      ready,
      requiresConfirmation,
      storeEnabled: guards.storeEnabled,
      policyAccepted: guards.policyAccepted,
      publishedPolicyVersion: guards.publishedPolicyVersion,
      pointTotal: result.pointTotal,
      spendablePoints: totals.spendablePoints,
      insufficientPoints: totals.spendablePoints < result.pointTotal,
      issues: result.issues,
      validLines: result.validLines,
      pickup: {
        pickupOptionId: args.pickupOptionId,
        label: result.pickup.label,
        type: result.pickup.type,
        cutoffAt: result.pickup.cutoffAt,
      },
    };
  },
});

export const listCompatiblePickupOptions = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireStorePurchaseAccess(ctx, args.logtoId, args.authToken);

    const cart = await ctx.db
      .query("merchCarts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!cart || cart.items.length === 0) return [];

    const releaseIds = [...new Set(cart.items.map((item) => item.releaseId))];
    const releases = await Promise.all(releaseIds.map((id) => ctx.db.get(id)));

    const now = Date.now();
    const activeOptions = await ctx.db
      .query("merchPickupOptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const compatible = [];
    for (const option of activeOptions) {
      if (!isPickupOptionSelectable(option, now)) continue;

      const allCompatible = releases.every((release) => {
        if (!release) return false;
        return isPickupCompatibleWithRelease(release, option._id);
      });
      if (!allCompatible) continue;

      if (option.type === "event") {
        if (!option.eventId) continue;
        const event = await ctx.db.get(option.eventId);
        if (!event?.published || !event.merchPickupEnabled) continue;
        if (event.startDate <= now) continue;
      }

      const enriched = await loadEnrichedPickupOption(ctx, option._id);
      if (!enriched) continue;

      compatible.push({
        pickupOptionId: option._id,
        label: enriched.label,
        type: option.type,
        cutoffAt: option.cutoffAt,
        capacity: option.capacity,
        orderCount: option.orderCount,
      });
    }

    return compatible.sort((a, b) => a.cutoffAt - b.cutoffAt);
  },
});

export const confirmCheckout = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    pickupOptionId: v.string(),
    idempotencyKey: v.string(),
    checkoutGroupId: v.optional(v.string()),
    acceptRevisedOrder: v.optional(v.boolean()),
    items: v.optional(v.array(checkoutItemValidator)),
  },
  handler: async (ctx, args) => {
    const user = await requireStorePurchaseAccess(ctx, args.logtoId, args.authToken);

    const existingOrder = await ctx.db
      .query("merchOrders")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
    if (existingOrder) {
      return { orderId: existingOrder._id, displayNumber: existingOrder.displayNumber };
    }

    const guards = await getCheckoutGuards(ctx, user);
    if (!guards.storeEnabled) {
      throw new Error("The merch store is not currently open for checkout");
    }
    if (!guards.policyAccepted) {
      throw new Error("You must accept the current merch policy before checking out");
    }

    const cart = await ctx.db
      .query("merchCarts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    const cartItems = args.items ?? cart?.items ?? [];
    if (cartItems.length === 0) {
      throw new Error("Cart is empty");
    }

    const validation = await validateCheckoutLines(
      ctx,
      user._id,
      cartItems,
      args.pickupOptionId,
    );

    if (validation.validLines.length === 0) {
      throw new Error("No valid items to checkout");
    }

    if (validation.issues.length > 0 && !args.acceptRevisedOrder) {
      throw new Error("Checkout requires confirmation of revised order");
    }

    const totals = getUserPointTotals(user);
    if (totals.spendablePoints < validation.pointTotal) {
      throw new Error("Insufficient spendable points");
    }

    const now = Date.now();
    const displayNumber = await allocateDisplayNumber(ctx, now);
    const pickupCode = generatePickupCode();
    const qrToken = generateQrToken();
    const itemQuantityTotal = validation.validLines.reduce(
      (sum, line) => sum + line.quantity,
      0,
    );
    const itemStatuses = validation.validLines.map((line) => ({
      status: "confirmed" as const,
      quantity: line.quantity,
    }));
    const statusCounts = deriveStatusCounts(itemStatuses);
    const status = deriveOrderStatus(itemStatuses);

    const orderId = await ctx.db.insert("merchOrders", {
      userId: user._id,
      displayNumber,
      pickupCode,
      qrToken,
      checkoutGroupId: args.checkoutGroupId,
      pickupOptionId: args.pickupOptionId,
      pickupLabel: validation.pickup.label,
      pickupType: validation.pickup.type,
      status,
      statusCounts,
      pointTotal: validation.pointTotal,
      itemQuantityTotal,
      pickupCutoffAt: validation.pickup.cutoffAt,
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });

    for (const line of validation.validLines) {
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

    await deductMerchandisePoints(ctx, {
      userId: user._id,
      amount: validation.pointTotal,
      orderId,
      description: `Merchandise order ${displayNumber}`,
      idempotencyKey: `${args.idempotencyKey}:points`,
    });

    await consumePickupCapacity(ctx, args.pickupOptionId);

    await appendOrderAuditLog(ctx, {
      orderId,
      action: "checkout_confirmed",
      actorUserId: user._id,
      actorLabel: user.name,
      metadata: {
        pointTotal: validation.pointTotal,
        itemQuantityTotal,
        pickupOptionId: args.pickupOptionId,
      },
    });

    if (cart) {
      const purchasedVariantIds = new Set(
        validation.validLines.map((line) => line.variantId),
      );
      const remainingItems = cart.items.filter(
        (item) => !purchasedVariantIds.has(item.variantId),
      );
      await ctx.db.patch(cart._id, {
        items: remainingItems,
        updatedAt: now,
      });
    }

    return {
      orderId,
      displayNumber,
      pickupCode,
      qrToken,
      pointTotal: validation.pointTotal,
    };
  },
});
