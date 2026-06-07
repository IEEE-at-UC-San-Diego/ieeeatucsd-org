import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isPickupOptionSelectable } from "./pickupHelpers";

export type MerchOrderItemStatus = Doc<"merchOrderItems">["status"];
export type MerchOrderStatus = Doc<"merchOrders">["status"];

export type OrderStatusCounts = Doc<"merchOrders">["statusCounts"];

const PACIFIC_TIME_ZONE = "America/Los_Angeles";

const PICKUP_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function getPacificYear(now = Date.now()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
  });
  return Number(formatter.format(new Date(now)));
}

export async function allocateDisplayNumber(ctx: MutationCtx, now = Date.now()) {
  const year = getPacificYear(now);
  const existing = await ctx.db
    .query("merchOrderSequences")
    .withIndex("by_year", (q) => q.eq("year", year))
    .first();

  const nextSequence = (existing?.lastSequence ?? 0) + 1;

  if (existing) {
    await ctx.db.patch(existing._id, { lastSequence: nextSequence });
  } else {
    await ctx.db.insert("merchOrderSequences", {
      year,
      lastSequence: nextSequence,
    });
  }

  return `MERCH-${year}-${String(nextSequence).padStart(4, "0")}`;
}

export function generatePickupCode(length = 8) {
  let code = "";
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * PICKUP_CODE_CHARS.length);
    code += PICKUP_CODE_CHARS[index];
  }
  return code;
}

export function generateQrToken() {
  return crypto.randomUUID();
}

export function emptyStatusCounts(): OrderStatusCounts {
  return {
    confirmed: 0,
    actionRequired: 0,
    pickupMissed: 0,
    partiallyFulfilled: 0,
    fulfilled: 0,
    canceled: 0,
    refundPendingReturn: 0,
    refunded: 0,
    replacementPending: 0,
  };
}

function incrementStatusCount(
  counts: OrderStatusCounts,
  status: MerchOrderItemStatus,
  quantity: number,
) {
  switch (status) {
    case "confirmed":
      counts.confirmed += quantity;
      break;
    case "action_required":
      counts.actionRequired += quantity;
      break;
    case "pickup_missed":
      counts.pickupMissed += quantity;
      break;
    case "partially_fulfilled":
      counts.partiallyFulfilled += quantity;
      break;
    case "fulfilled":
      counts.fulfilled += quantity;
      break;
    case "canceled":
      counts.canceled += quantity;
      break;
    case "refund_pending_return":
      counts.refundPendingReturn += quantity;
      break;
    case "refunded":
      counts.refunded += quantity;
      break;
    case "replacement_pending":
      counts.replacementPending += quantity;
      break;
  }
}

export function deriveStatusCounts(
  items: Array<{ status: MerchOrderItemStatus; quantity: number }>,
): OrderStatusCounts {
  const counts = emptyStatusCounts();
  for (const item of items) {
    incrementStatusCount(counts, item.status, item.quantity);
  }
  return counts;
}

export function deriveOrderStatus(
  items: Array<{ status: MerchOrderItemStatus; quantity: number }>,
): MerchOrderStatus {
  if (items.length === 0) return "canceled";

  const counts = deriveStatusCounts(items);
  const active =
    counts.confirmed +
    counts.actionRequired +
    counts.pickupMissed +
    counts.partiallyFulfilled +
    counts.replacementPending +
    counts.refundPendingReturn;
  const terminal = counts.fulfilled + counts.canceled + counts.refunded;

  if (terminal === 0 && active > 0) {
    if (counts.actionRequired > 0 || counts.replacementPending > 0) {
      return "action_required";
    }
    if (counts.pickupMissed > 0) return "pickup_missed";
    return "confirmed";
  }

  if (counts.fulfilled > 0 && active > 0) return "partially_fulfilled";
  if (counts.fulfilled > 0 && active === 0 && counts.canceled + counts.refunded === 0) {
    return "fulfilled";
  }
  if (counts.canceled + counts.refunded > 0 && active === 0 && counts.fulfilled === 0) {
    return "canceled";
  }

  return "mixed";
}

export async function appendOrderAuditLog(
  ctx: MutationCtx,
  args: {
    orderId: Id<"merchOrders">;
    action: string;
    actorUserId?: Id<"users">;
    actorLabel: string;
    note?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await ctx.db.insert("merchOrderAuditLog", {
    orderId: args.orderId,
    action: args.action,
    actorUserId: args.actorUserId,
    actorLabel: args.actorLabel,
    timestamp: Date.now(),
    note: args.note,
    metadata: args.metadata,
  });
}

export function getVariantPointPrice(
  release: Doc<"merchReleases">,
  variant: Doc<"merchVariants">,
) {
  return variant.pointPriceOverride ?? release.defaultPointPrice;
}

export function isReleaseOnSale(release: Doc<"merchReleases">, now = Date.now()) {
  if (release.status !== "active") return false;
  if (release.salesOpenAt !== undefined && now < release.salesOpenAt) return false;
  if (release.salesCloseAt !== undefined && now > release.salesCloseAt) return false;
  return true;
}

const LIMIT_COUNTING_STATUSES = new Set<MerchOrderItemStatus>([
  "confirmed",
  "action_required",
  "pickup_missed",
  "partially_fulfilled",
  "fulfilled",
  "refund_pending_return",
  "replacement_pending",
]);

export async function getUserPurchasedQuantityForRelease(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  releaseId: Id<"merchReleases">,
) {
  const orders = await ctx.db
    .query("merchOrders")
    .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
    .collect();

  let total = 0;
  for (const order of orders) {
    const items = await ctx.db
      .query("merchOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .collect();
    for (const item of items) {
      if (item.releaseId !== releaseId) continue;
      if (!LIMIT_COUNTING_STATUSES.has(item.status)) continue;
      total += item.quantity;
    }
  }
  return total;
}

export async function getUserPurchasedQuantityForVariant(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  variantId: Id<"merchVariants">,
) {
  const orders = await ctx.db
    .query("merchOrders")
    .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
    .collect();

  let total = 0;
  for (const order of orders) {
    const items = await ctx.db
      .query("merchOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .collect();
    for (const item of items) {
      if (item.variantId !== variantId) continue;
      if (!LIMIT_COUNTING_STATUSES.has(item.status)) continue;
      total += item.quantity;
    }
  }
  return total;
}

export async function reserveVariantInventory(
  ctx: MutationCtx,
  args: {
    variantId: Id<"merchVariants">;
    quantity: number;
  },
) {
  const variant = await ctx.db.get(args.variantId);
  if (!variant) throw new Error("Variant not found");

  const available = variant.onHand - variant.reserved;
  if (available < args.quantity) {
    throw new Error(`Insufficient inventory for ${variant.label}`);
  }

  await ctx.db.patch(args.variantId, {
    reserved: variant.reserved + args.quantity,
    updatedAt: Date.now(),
  });
}

export async function releaseVariantInventory(
  ctx: MutationCtx,
  args: {
    variantId: Id<"merchVariants">;
    quantity: number;
  },
) {
  const variant = await ctx.db.get(args.variantId);
  if (!variant) throw new Error("Variant not found");

  const nextReserved = Math.max(0, variant.reserved - args.quantity);
  await ctx.db.patch(args.variantId, {
    reserved: nextReserved,
    updatedAt: Date.now(),
  });
}

export async function fulfillVariantInventory(
  ctx: MutationCtx,
  args: {
    variantId: Id<"merchVariants">;
    quantity: number;
  },
) {
  const variant = await ctx.db.get(args.variantId);
  if (!variant) throw new Error("Variant not found");
  if (variant.reserved < args.quantity) {
    throw new Error("Insufficient reserved inventory to fulfill");
  }
  if (variant.onHand < args.quantity) {
    throw new Error("Insufficient on-hand inventory to fulfill");
  }

  await ctx.db.patch(args.variantId, {
    onHand: variant.onHand - args.quantity,
    reserved: variant.reserved - args.quantity,
    updatedAt: Date.now(),
  });
}

const FULFILLABLE_STATUSES = new Set<MerchOrderItemStatus>([
  "confirmed",
  "action_required",
  "pickup_missed",
  "partially_fulfilled",
  "replacement_pending",
]);

export function isItemFulfillable(status: MerchOrderItemStatus) {
  return FULFILLABLE_STATUSES.has(status);
}

export async function syncOrderStatusFromItems(
  ctx: MutationCtx,
  orderId: Id<"merchOrders">,
) {
  const order = await ctx.db.get(orderId);
  if (!order) throw new Error("Order not found");

  const items = await ctx.db
    .query("merchOrderItems")
    .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
    .collect();

  const statusCounts = deriveStatusCounts(
    items.map((item) => ({ status: item.status, quantity: item.quantity })),
  );
  const status = deriveOrderStatus(
    items.map((item) => ({ status: item.status, quantity: item.quantity })),
  );

  await ctx.db.patch(orderId, {
    status,
    statusCounts,
    updatedAt: Date.now(),
  });

  return { status, statusCounts };
}

export type EnrichedPickupOption = Doc<"merchPickupOptions"> & { label: string };

async function enrichPickupOptionLabel(
  ctx: QueryCtx | MutationCtx,
  option: Doc<"merchPickupOptions">,
) {
  if (option.type === "event" && option.eventId) {
    const event = await ctx.db.get(option.eventId);
    return event?.eventName ?? "Event pickup";
  }
  return "Project Space";
}

export async function loadPickupOption(
  ctx: QueryCtx | MutationCtx,
  pickupOptionId: string,
) {
  return ctx.db.get(pickupOptionId as Id<"merchPickupOptions">);
}

export async function loadEnrichedPickupOption(
  ctx: QueryCtx | MutationCtx,
  pickupOptionId: string,
): Promise<EnrichedPickupOption | null> {
  const pickup = await loadPickupOption(ctx, pickupOptionId);
  if (!pickup) return null;
  const label = await enrichPickupOptionLabel(ctx, pickup);
  return { ...pickup, label };
}

export async function consumePickupCapacity(
  ctx: MutationCtx,
  pickupOptionId: string,
) {
  const pickup = await loadPickupOption(ctx, pickupOptionId);
  if (!pickup) throw new Error("Pickup option not found");
  if (!isPickupOptionSelectable(pickup)) {
    throw new Error("Pickup option is at capacity or unavailable");
  }
  await ctx.db.patch(pickup._id, {
    orderCount: pickup.orderCount + 1,
    updatedAt: Date.now(),
  });
}

export async function releasePickupCapacity(
  ctx: MutationCtx,
  pickupOptionId: string,
) {
  const pickup = await loadPickupOption(ctx, pickupOptionId);
  if (!pickup) return;
  await ctx.db.patch(pickup._id, {
    orderCount: Math.max(0, pickup.orderCount - 1),
    updatedAt: Date.now(),
  });
}

export function isPickupCompatibleWithRelease(
  release: Doc<"merchReleases">,
  pickupOptionId: string,
) {
  const excluded = release.excludedPickupOptionIds ?? [];
  return !excluded.includes(pickupOptionId);
}

export async function assertPickupOptionSelectable(
  ctx: QueryCtx | MutationCtx,
  pickupOptionId: string,
) {
  const pickup = await loadEnrichedPickupOption(ctx, pickupOptionId);
  if (!pickup) throw new Error("Pickup option not found");
  if (!isPickupOptionSelectable(pickup)) {
    throw new Error("Pickup option is not available");
  }
  return pickup;
}
