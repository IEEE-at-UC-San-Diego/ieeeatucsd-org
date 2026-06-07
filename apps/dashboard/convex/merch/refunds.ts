import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { refundMerchandisePoints } from "../points/service";
import { requireMerchAdmin, requireMerchOfficer } from "./helpers";
import {
  appendOrderAuditLog,
  releasePickupCapacity,
  releaseVariantInventory,
  syncOrderStatusFromItems,
} from "./orderHelpers";

const REFUNDABLE_STATUSES = new Set([
  "confirmed",
  "action_required",
  "pickup_missed",
  "partially_fulfilled",
  "fulfilled",
  "replacement_pending",
]);

async function refundItemQuantity(
  ctx: MutationCtx,
  args: {
    orderId: Id<"merchOrders">;
    orderItemId: Id<"merchOrderItems">;
    quantity: number;
    officer: { _id: Id<"users">; name: string };
    idempotencyKey: string;
    reason?: string;
    requireReturn?: boolean;
    postFulfillment?: boolean;
  },
) {
  const order = await ctx.db.get(args.orderId);
  if (!order) throw new Error("Order not found");

  const item = await ctx.db.get(args.orderItemId);
  if (!item || item.orderId !== order._id) {
    throw new Error("Invalid order item");
  }

  if (!REFUNDABLE_STATUSES.has(item.status)) {
    throw new Error(`Item ${item.productName} cannot be refunded`);
  }

  const fulfilled = item.fulfilledQuantity ?? 0;
  const unfulfilled = item.quantity - fulfilled;
  if (args.quantity > unfulfilled && !args.postFulfillment) {
    throw new Error("Cannot refund fulfilled quantity without post-fulfillment approval");
  }
  if (args.quantity > item.quantity) {
    throw new Error("Refund quantity exceeds item quantity");
  }

  const refundAmount = item.pointPrice * args.quantity;
  const now = Date.now();
  const nextStatus = args.requireReturn
    ? ("refund_pending_return" as const)
    : ("refunded" as const);

  if (args.quantity >= item.quantity) {
    await ctx.db.patch(item._id, {
      status: nextStatus,
      updatedAt: now,
    });
  } else {
    await ctx.db.patch(item._id, {
      quantity: item.quantity - args.quantity,
      updatedAt: now,
    });
    await ctx.db.insert("merchOrderItems", {
      orderId: order._id,
      productId: item.productId,
      releaseId: item.releaseId,
      variantId: item.variantId,
      productName: item.productName,
      variantLabel: item.variantLabel,
      sku: item.sku,
      pointPrice: item.pointPrice,
      quantity: args.quantity,
      imageStorageId: item.imageStorageId,
      status: nextStatus,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!args.requireReturn) {
    await releaseVariantInventory(ctx, {
      variantId: item.variantId,
      quantity: args.quantity,
    });

    await refundMerchandisePoints(ctx, {
      userId: order.userId,
      amount: refundAmount,
      orderId: order._id,
      description: `Refund for ${item.productName} on order ${order.displayNumber}`,
      idempotencyKey: args.idempotencyKey,
      actorUserId: args.officer._id,
    });

    await ctx.db.patch(order._id, {
      pointTotal: Math.max(0, order.pointTotal - refundAmount),
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("merchReturns", {
      orderId: order._id,
      orderItemId: item._id,
      quantity: args.quantity,
      status: "pending_return",
      returnRequired: true,
      refundAmount,
      createdBy: args.officer._id,
      createdAt: now,
      idempotencyKey: `${args.idempotencyKey}:return`,
    });
  }

  await syncOrderStatusFromItems(ctx, order._id);

  await appendOrderAuditLog(ctx, {
    orderId: order._id,
    action: "item_refund",
    actorUserId: args.officer._id,
    actorLabel: args.officer.name,
    note: args.reason,
    metadata: {
      orderItemId: args.orderItemId,
      quantity: args.quantity,
      refundAmount,
      requireReturn: args.requireReturn ?? false,
    },
  });

  return refundAmount;
}

export const listForOrder = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    orderId: v.id("merchOrders"),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    return ctx.db
      .query("merchReturns")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .collect();
  },
});

export const refundOrderItems = mutation({
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
    reason: v.string(),
    requireReturn: v.optional(v.boolean()),
    postFulfillment: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    if (!args.reason.trim()) throw new Error("Refund reason is required");

    if (args.postFulfillment || args.requireReturn) {
      await requireMerchAdmin(ctx, args.logtoId, args.authToken);
    }

    let totalRefund = 0;
    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i];
      totalRefund += await refundItemQuantity(ctx, {
        orderId: args.orderId,
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        officer,
        idempotencyKey: `${args.idempotencyKey}:${i}`,
        reason: args.reason.trim(),
        requireReturn: args.requireReturn,
        postFulfillment: args.postFulfillment,
      });
    }

    return { orderId: args.orderId, totalRefund };
  },
});

export const refundFullOrder = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    orderId: v.id("merchOrders"),
    idempotencyKey: v.string(),
    reason: v.string(),
    requireReturn: v.optional(v.boolean()),
    postFulfillment: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    const items = await ctx.db
      .query("merchOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .collect();

    const refundableItems = items
      .filter((item) => REFUNDABLE_STATUSES.has(item.status))
      .map((item) => ({
        orderItemId: item._id,
        quantity: item.quantity - (item.fulfilledQuantity ?? 0) || item.quantity,
      }))
      .filter((item) => item.quantity > 0);

    if (refundableItems.length === 0) {
      throw new Error("No refundable items on this order");
    }

    let totalRefund = 0;
    for (let i = 0; i < refundableItems.length; i++) {
      const item = refundableItems[i];
      totalRefund += await refundItemQuantity(ctx, {
        orderId: args.orderId,
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        officer,
        idempotencyKey: `${args.idempotencyKey}:${i}`,
        reason: args.reason.trim(),
        requireReturn: args.requireReturn,
        postFulfillment: args.postFulfillment,
      });
    }

    const remainingItems = await ctx.db
      .query("merchOrderItems")
      .withIndex("by_orderId", (q) => q.eq("orderId", order._id))
      .collect();
    const allTerminal = remainingItems.every(
      (item) =>
        item.status === "canceled" ||
        item.status === "refunded" ||
        item.status === "refund_pending_return",
    );

    if (allTerminal) {
      await releasePickupCapacity(ctx, order.pickupOptionId);
      await ctx.db.patch(order._id, {
        pointTotal: 0,
        status: "canceled",
        updatedAt: Date.now(),
      });
    }

    await appendOrderAuditLog(ctx, {
      orderId: order._id,
      action: "full_order_refund",
      actorUserId: officer._id,
      actorLabel: officer.name,
      note: args.reason.trim(),
      metadata: { totalRefund, idempotencyKey: args.idempotencyKey },
    });

    return { orderId: order._id, totalRefund };
  },
});
