import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireMerchFulfiller } from "./lib/merchAuth";
import { enqueueMerchNotification } from "./lib/merchOutbox";
import {
  fulfillmentDisposition,
  normalizeOrderCode,
  requireTrimmed,
  scannerPreviewDisposition,
} from "./lib/merchValidation";

const authArgs = { logtoId: v.string(), authToken: v.string() };

export const previewByToken = query({
  args: { ...authArgs, token: v.string() },
  handler: async (ctx, args) => {
    await requireMerchFulfiller(ctx, args.logtoId, args.authToken);
    const token = normalizeOrderCode(args.token);
    if (!token) return { result: scannerPreviewDisposition(false) };
    const order = await ctx.db
      .query("merchOrders")
      .withIndex("by_qrToken", (q) => q.eq("qrToken", token))
      .unique();
    if (!order) return { result: scannerPreviewDisposition(false) };
    const fulfiller = order.fulfilledBy ? await ctx.db.get(order.fulfilledBy) : null;
    const pickupMismatch =
      Date.now() < order.pickupSnapshot.startAt || Date.now() > order.pickupSnapshot.endAt;
    return {
      result: scannerPreviewDisposition(true),
      _id: order._id,
      orderId: order._id,
      orderNumber: order.orderNumber,
      memberName: order.ownerName,
      items: order.lines.map((line) => ({
        productName: line.productName,
        variantName: line.variantName,
        sku: line.sku,
        quantity: line.quantity,
      })),
      lines: order.lines.map((line) => ({
        productName: line.productName,
        variantName: line.variantName,
        sku: line.sku,
        quantity: line.quantity,
      })),
      status: order.status,
      pickup: order.pickupSnapshot,
      pickupSnapshot: order.pickupSnapshot,
      pickupMismatch,
      fulfilledAt: order.fulfilledAt,
      fulfilledByName: fulfiller?.name,
      canceledAt: order.canceledAt,
      cancellationReason: order.cancellationReason,
    };
  },
});

export const confirm = mutation({
  args: {
    ...authArgs,
    orderId: v.id("merchOrders"),
    token: v.string(),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const fulfiller = await requireMerchFulfiller(ctx, args.logtoId, args.authToken);
    const token = normalizeOrderCode(args.token);
    if (!token) throw new Error("INVALID_ORDER_CODE");
    const requestId = requireTrimmed(args.requestId, "Confirmation request ID", 200);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.qrToken !== token) throw new Error("INVALID_ORDER_CODE");
    const disposition = fulfillmentDisposition(order.status);
    if (disposition === "already_fulfilled") {
      const originalFulfiller = order.fulfilledBy ? await ctx.db.get(order.fulfilledBy) : null;
      return {
        result: "already_fulfilled" as const,
        orderId: order._id,
        orderNumber: order.orderNumber,
        fulfilledAt: order.fulfilledAt,
        fulfilledByName: originalFulfiller?.name,
      };
    }
    if (disposition === "canceled") {
      return {
        result: "canceled" as const,
        orderId: order._id,
        orderNumber: order.orderNumber,
        canceledAt: order.canceledAt,
        cancellationReason: order.cancellationReason,
      };
    }
    const priorRequest = await ctx.db
      .query("merchOrderEvents")
      .withIndex("by_requestId", (q) => q.eq("requestId", `fulfill:${requestId}`))
      .unique();
    if (priorRequest && priorRequest.orderId !== order._id) {
      throw new Error("Confirmation request ID was already used for another order");
    }
    const now = Date.now();
    await ctx.db.patch(order._id, {
      status: "fulfilled",
      fulfilledAt: now,
      fulfilledBy: fulfiller._id,
      fulfillmentRequestId: requestId,
      updatedAt: now,
    });
    await ctx.db.insert("merchOrderEvents", {
      orderId: order._id,
      action: "fulfilled",
      actorId: fulfiller._id,
      beforeStatus: "pending",
      afterStatus: "fulfilled",
      requestId: `fulfill:${requestId}`,
      createdAt: now,
    });
    await enqueueMerchNotification(ctx, {
      orderId: order._id,
      recipientUserId: order.ownerId,
      recipientEmail: order.ownerEmail,
      kind: "fulfilled",
      payload: { orderNumber: order.orderNumber, fulfilledAt: now },
      idempotencyKey: `order:${order._id}:notice:fulfilled`,
    });
    return {
      result: "fulfilled" as const,
      orderId: order._id,
      orderNumber: order.orderNumber,
      fulfilledAt: now,
      fulfilledByName: fulfiller.name,
    };
  },
});
