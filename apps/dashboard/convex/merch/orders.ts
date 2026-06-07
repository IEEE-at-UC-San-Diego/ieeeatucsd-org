import { mutation, query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { refundMerchandisePoints } from "../points/service";
import { requireStoreAccess } from "./helpers";
import {
  appendOrderAuditLog,
  assertPickupOptionSelectable,
  consumePickupCapacity,
  deriveStatusCounts,
  generatePickupCode,
  generateQrToken,
  isPickupCompatibleWithRelease,
  releasePickupCapacity,
  releaseVariantInventory,
} from "./orderHelpers";

async function enrichOrderItems(ctx: QueryCtx, orderId: Id<"merchOrders">) {
  const items = await ctx.db
    .query("merchOrderItems")
    .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
    .collect();

  return Promise.all(
    items.map(async (item) => ({
      ...item,
      imageUrl: item.imageStorageId
        ? await ctx.storage.getUrl(item.imageStorageId)
        : null,
    })),
  );
}

export const listMyOrders = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireStoreAccess(ctx, args.logtoId, args.authToken);
    const limit = args.limit ?? 50;

    const orders = await ctx.db
      .query("merchOrders")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    return orders.map((order) => ({
      _id: order._id,
      displayNumber: order.displayNumber,
      status: order.status,
      pointTotal: order.pointTotal,
      itemQuantityTotal: order.itemQuantityTotal,
      pickupLabel: order.pickupLabel,
      pickupCutoffAt: order.pickupCutoffAt,
      createdAt: order.createdAt,
      checkoutGroupId: order.checkoutGroupId,
    }));
  },
});

export const getOrder = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    orderId: v.id("merchOrders"),
  },
  handler: async (ctx, args) => {
    const user = await requireStoreAccess(ctx, args.logtoId, args.authToken);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.userId !== user._id) {
      throw new Error("Not authorized to view this order");
    }

    const items = await enrichOrderItems(ctx, order._id);
    const auditLog = await ctx.db
      .query("merchOrderAuditLog")
      .withIndex("by_orderId_timestamp", (q) => q.eq("orderId", order._id))
      .order("desc")
      .take(20);

    return {
      order: {
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
        canCancel: Date.now() < order.pickupCutoffAt && order.status !== "canceled",
        canChangePickup:
          Date.now() < order.pickupCutoffAt &&
          order.status !== "canceled" &&
          order.status !== "fulfilled",
      },
      items,
      auditLog,
    };
  },
});

export const cancelOrder = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    orderId: v.id("merchOrders"),
    idempotencyKey: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireStoreAccess(ctx, args.logtoId, args.authToken);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.userId !== user._id) {
      throw new Error("Not authorized to cancel this order");
    }
    if (Date.now() >= order.pickupCutoffAt) {
      throw new Error("Pickup cutoff has passed; contact an officer to cancel");
    }
    if (order.status === "canceled" || order.status === "fulfilled") {
      return { orderId: order._id, refundTotal: 0 };
    }

    const existing = await ctx.db
      .query("merchOrderAuditLog")
      .withIndex("by_orderId_timestamp", (q) => q.eq("orderId", order._id))
      .collect();
    const duplicate = existing.find(
      (entry) =>
        entry.action === "member_cancel_order" &&
        entry.metadata &&
        typeof entry.metadata === "object" &&
        "idempotencyKey" in entry.metadata &&
        entry.metadata.idempotencyKey === args.idempotencyKey,
    );
    if (duplicate) {
      return { orderId: order._id, refundTotal: 0 };
    }

    const items = await ctx.db
      .query("merchOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .collect();

    let refundTotal = 0;
    const now = Date.now();

    for (const item of items) {
      if (item.status === "canceled" || item.status === "refunded") continue;
      refundTotal += item.pointPrice * item.quantity;
      await ctx.db.patch(item._id, { status: "canceled", updatedAt: now });
      await releaseVariantInventory(ctx, {
        variantId: item.variantId,
        quantity: item.quantity,
      });
    }

    const statusCounts = deriveStatusCounts(
      items.map((item) => ({ status: "canceled" as const, quantity: item.quantity })),
    );

    await ctx.db.patch(order._id, {
      status: "canceled",
      statusCounts,
      pointTotal: 0,
      updatedAt: now,
    });

    if (refundTotal > 0) {
      await refundMerchandisePoints(ctx, {
        userId: user._id,
        amount: refundTotal,
        orderId: order._id,
        description: `Cancellation refund for order ${order.displayNumber}`,
        idempotencyKey: args.idempotencyKey,
        actorUserId: user._id,
      });
    }

    await releasePickupCapacity(ctx, order.pickupOptionId);

    await appendOrderAuditLog(ctx, {
      orderId: order._id,
      action: "member_cancel_order",
      actorUserId: user._id,
      actorLabel: user.name,
      note: args.reason,
      metadata: { refundTotal, idempotencyKey: args.idempotencyKey },
    });

    return { orderId: order._id, refundTotal };
  },
});

export const changePickup = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    orderId: v.id("merchOrders"),
    pickupOptionId: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireStoreAccess(ctx, args.logtoId, args.authToken);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.userId !== user._id) {
      throw new Error("Not authorized to modify this order");
    }
    if (Date.now() >= order.pickupCutoffAt) {
      throw new Error("Pickup cutoff has passed");
    }
    if (order.status === "canceled" || order.status === "fulfilled") {
      throw new Error("Order cannot be reassigned");
    }
    if (args.pickupOptionId === order.pickupOptionId) {
      return { orderId: order._id };
    }

    const pickup = await assertPickupOptionSelectable(ctx, args.pickupOptionId);
    const items = await ctx.db
      .query("merchOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .collect();

    for (const item of items) {
      if (item.status === "canceled" || item.status === "refunded") continue;
      const release = await ctx.db.get(item.releaseId);
      if (!release) continue;
      if (!isPickupCompatibleWithRelease(release, args.pickupOptionId)) {
        throw new Error("Selected pickup is not compatible with all order items");
      }
    }

    await releasePickupCapacity(ctx, order.pickupOptionId);
    await consumePickupCapacity(ctx, args.pickupOptionId);

    const now = Date.now();
    await ctx.db.patch(order._id, {
      pickupOptionId: args.pickupOptionId,
      pickupLabel: pickup.label,
      pickupType: pickup.type,
      pickupCutoffAt: pickup.cutoffAt,
      pickupCode: generatePickupCode(),
      qrToken: generateQrToken(),
      updatedAt: now,
    });

    await appendOrderAuditLog(ctx, {
      orderId: order._id,
      action: "pickup_changed",
      actorUserId: user._id,
      actorLabel: user.name,
      metadata: {
        previousPickupOptionId: order.pickupOptionId,
        pickupOptionId: args.pickupOptionId,
        idempotencyKey: args.idempotencyKey,
      },
    });

    return { orderId: order._id };
  },
});
