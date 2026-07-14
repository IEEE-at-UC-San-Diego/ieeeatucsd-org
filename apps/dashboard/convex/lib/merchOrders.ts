import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { applyInventoryChange } from "./merchInventory";
import { releasePickup, type PickupChoice } from "./merchPickup";
import { enqueueMerchNotification } from "./merchOutbox";
import { appendPointLedgerEntry } from "./pointsLedger";

export function orderPickupChoice(order: Doc<"merchOrders">): PickupChoice {
  if (order.pickupType === "event" && order.pickupEventId) {
    return { type: "event", pickupEventId: order.pickupEventId };
  }
  if (order.pickupType === "slot" && order.pickupSlotId) {
    return { type: "slot", pickupSlotId: order.pickupSlotId };
  }
  throw new Error("Order pickup reference is invalid");
}

export function safeMemberTimelineEvent(event: {
  action: string;
  beforeStatus?: string;
  afterStatus?: string;
  reason?: string;
  createdAt: number;
}) {
  return {
    action: event.action,
    beforeStatus: event.beforeStatus,
    afterStatus: event.afterStatus,
    reason: event.reason,
    createdAt: event.createdAt,
  };
}

export function safeManagerOrderResult(order: Doc<"merchOrders">) {
  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    ownerName: order.ownerName,
    ownerEmail: order.ownerEmail,
    status: order.status,
    pickupHealth: order.pickupHealth,
    pickupSnapshot: order.pickupSnapshot,
    totalPoints: order.totalPoints,
    lines: order.lines.map((line) => ({
      productName: line.productName,
      variantName: line.variantName,
      sku: line.sku,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
    })),
    fulfilledAt: order.fulfilledAt,
    canceledAt: order.canceledAt,
    cancellationReason: order.cancellationReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export async function cancelPendingOrder(
  ctx: MutationCtx,
  args: {
    order: Doc<"merchOrders">;
    actorId: Id<"users">;
    reason: string;
    requestId: string;
  },
) {
  if (args.order.status === "canceled") return args.order;
  if (args.order.status !== "pending") throw new Error("Only pending orders can be canceled");
  if (!args.order.purchaseLedgerEntryId) throw new Error("Order purchase ledger link is missing");

  const refund = await appendPointLedgerEntry(ctx, {
    userId: args.order.ownerId,
    balanceDelta: args.order.totalPoints,
    lifetimeDelta: 0,
    kind: "refund",
    sourceType: "merch_order",
    sourceId: args.order._id,
    idempotencyKey: `order:${args.order._id}:cancel-refund`,
    actorId: args.actorId,
    reason: args.reason,
    reversalOf: args.order.purchaseLedgerEntryId,
  });

  for (const line of args.order.lines) {
    if (!line.purchaseInventoryEntryId) {
      throw new Error(`Order inventory link is missing for SKU ${line.sku}`);
    }
    await applyInventoryChange(ctx, {
      variantId: line.variantId,
      quantityDelta: line.quantity,
      kind: "cancellation",
      orderId: args.order._id,
      sourceId: args.order._id,
      idempotencyKey: `order:${args.order._id}:cancel-stock:${line.variantId}`,
      actorId: args.actorId,
      reason: args.reason,
      reversalOf: line.purchaseInventoryEntryId,
    });
  }
  await releasePickup(ctx, orderPickupChoice(args.order));
  const now = Date.now();
  await ctx.db.patch(args.order._id, {
    status: "canceled",
    refundLedgerEntryId: refund._id,
    canceledAt: now,
    canceledBy: args.actorId,
    cancellationReason: args.reason,
    updatedAt: now,
  });
  await ctx.db.insert("merchOrderEvents", {
    orderId: args.order._id,
    action: "canceled",
    actorId: args.actorId,
    beforeStatus: "pending",
    afterStatus: "canceled",
    reason: args.reason,
    requestId: args.requestId,
    pointLedgerEntryId: refund._id,
    createdAt: now,
  });
  await enqueueMerchNotification(ctx, {
    orderId: args.order._id,
    recipientUserId: args.order.ownerId,
    recipientEmail: args.order.ownerEmail,
    kind: "canceled_refunded",
    payload: {
      orderNumber: args.order.orderNumber,
      totalPoints: args.order.totalPoints,
      reason: args.reason,
    },
    idempotencyKey: `order:${args.order._id}:notice:canceled`,
  });
  const canceled = await ctx.db.get(args.order._id);
  if (!canceled) throw new Error("Canceled order not found");
  return canceled;
}

export async function projectMemberOrder(
  ctx: QueryCtx | MutationCtx,
  order: Doc<"merchOrders">,
  includeTimeline: boolean,
) {
  const lines = await Promise.all(
    order.lines.map(async (line) => ({
      productName: line.productName,
      variantName: line.variantName,
      sku: line.sku,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineTotal: line.lineTotal,
      imageUrl: line.imageStorageId
        ? (await ctx.storage.getUrl(line.imageStorageId)) ?? undefined
        : undefined,
    })),
  );
  const timeline = includeTimeline
    ? await ctx.db
        .query("merchOrderEvents")
        .withIndex("by_order_createdAt", (q) => q.eq("orderId", order._id))
        .collect()
    : undefined;
  const health = await derivePickupHealth(ctx, order);
  const settings = await ctx.db.query("organizationSettings").first();
  const policyCutoff =
    order.pickupSnapshot.startAt -
    (settings?.merchMemberCancellationCutoffMinutes ?? 0) * 60_000;
  const cancellationCutoff = Math.min(
    order.pickupSnapshot.cutoffAt ?? policyCutoff,
    policyCutoff,
  );
  const safeTimeline = timeline?.map(safeMemberTimelineEvent);
  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    pickupHealth: health,
    lines,
    totalPoints: order.totalPoints,
    pickupType: order.pickupType,
    pickupSnapshot: order.pickupSnapshot,
    qrToken: order.status === "canceled" ? undefined : order.qrToken,
    fulfilledAt: order.fulfilledAt,
    canceledAt: order.canceledAt,
    cancellationReason: order.cancellationReason,
    cancelReason: order.cancellationReason,
    canCancel: order.status === "pending" && Date.now() < cancellationCutoff,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    timeline: safeTimeline,
    events: safeTimeline,
  };
}

export async function derivePickupHealth(
  ctx: QueryCtx | MutationCtx,
  order: Doc<"merchOrders">,
) {
  if (order.status !== "pending" || order.pickupHealth === "action_required") {
    return order.pickupHealth;
  }
  if (order.pickupType === "event") {
    const mapping = order.pickupEventId ? await ctx.db.get(order.pickupEventId) : null;
    const event = mapping ? await ctx.db.get(mapping.eventId) : null;
    if (
      !mapping ||
      !event ||
      !mapping.enabled ||
      !event.published ||
      event.eventName !== order.pickupSnapshot.label ||
      event.location !== order.pickupSnapshot.address ||
      event.startDate !== order.pickupSnapshot.startAt ||
      event.endDate !== order.pickupSnapshot.endAt
    ) {
      return "action_required" as const;
    }
  } else {
    const slot = order.pickupSlotId ? await ctx.db.get(order.pickupSlotId) : null;
    const window = slot ? await ctx.db.get(slot.windowId) : null;
    if (!slot || !window || !slot.enabled || !window.enabled) {
      return "action_required" as const;
    }
  }
  return Date.now() > order.pickupSnapshot.endAt
    ? ("overdue" as const)
    : ("scheduled" as const);
}
