import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { refundMerchandisePoints } from "../points/service";
import { requireMerchOfficer } from "./helpers";
import { appendOrderAuditLog, syncOrderStatusFromItems } from "./orderHelpers";

export const listPending = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const limit = args.limit ?? 50;

    const pending = await ctx.db
      .query("merchReturns")
      .withIndex("by_status", (q) => q.eq("status", "pending_return"))
      .take(limit);

    return Promise.all(
      pending.map(async (ret) => {
        const order = await ctx.db.get(ret.orderId);
        const item = await ctx.db.get(ret.orderItemId);
        return {
          ...ret,
          displayNumber: order?.displayNumber,
          productName: item?.productName,
          variantLabel: item?.variantLabel,
        };
      }),
    );
  },
});

export const receiveReturn = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    returnId: v.id("merchReturns"),
    idempotencyKey: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const ret = await ctx.db.get(args.returnId);
    if (!ret) throw new Error("Return not found");
    if (ret.status !== "pending_return") {
      throw new Error("Return is not pending receipt");
    }

    const now = Date.now();
    await ctx.db.patch(ret._id, {
      status: "received",
      receivedBy: officer._id,
      receivedAt: now,
    });

    const item = await ctx.db.get(ret.orderItemId);
    if (!item) throw new Error("Order item not found");

    const variant = await ctx.db.get(item.variantId);
    if (variant) {
      await ctx.db.patch(variant._id, {
        returnedPendingInspection:
          variant.returnedPendingInspection + ret.quantity,
        updatedAt: now,
      });
    }

    await appendOrderAuditLog(ctx, {
      orderId: ret.orderId,
      action: "return_received",
      actorUserId: officer._id,
      actorLabel: officer.name,
      note: args.note,
      metadata: { returnId: ret._id, idempotencyKey: args.idempotencyKey },
    });

    return { returnId: ret._id };
  },
});

export const inspectReturn = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    returnId: v.id("merchReturns"),
    disposition: v.union(v.literal("restocked"), v.literal("written_off")),
    conditionNote: v.string(),
    idempotencyKey: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    if (!args.conditionNote.trim()) {
      throw new Error("Condition note is required");
    }

    const ret = await ctx.db.get(args.returnId);
    if (!ret) throw new Error("Return not found");
    if (ret.status !== "received") {
      throw new Error("Return must be received before inspection");
    }

    const item = await ctx.db.get(ret.orderItemId);
    if (!item) throw new Error("Order item not found");

    const order = await ctx.db.get(ret.orderId);
    if (!order) throw new Error("Order not found");

    const variant = await ctx.db.get(item.variantId);
    if (!variant) throw new Error("Variant not found");

    const now = Date.now();
    await ctx.db.patch(variant._id, {
      returnedPendingInspection: Math.max(
        0,
        variant.returnedPendingInspection - ret.quantity,
      ),
      onHand:
        args.disposition === "restocked"
          ? variant.onHand + ret.quantity
          : variant.onHand,
      updatedAt: now,
    });

    await ctx.db.patch(ret._id, {
      status: args.disposition,
      conditionNote: args.conditionNote.trim(),
      photoStorageId: args.photoStorageId,
      inspectedBy: officer._id,
      inspectedAt: now,
    });

    await ctx.db.patch(item._id, {
      status: "refunded",
      updatedAt: now,
    });

    await refundMerchandisePoints(ctx, {
      userId: order.userId,
      amount: ret.refundAmount,
      orderId: order._id,
      description: `Return refund for ${item.productName} on order ${order.displayNumber}`,
      idempotencyKey: args.idempotencyKey,
      actorUserId: officer._id,
    });

    await ctx.db.patch(order._id, {
      pointTotal: Math.max(0, order.pointTotal - ret.refundAmount),
      updatedAt: now,
    });

    await syncOrderStatusFromItems(ctx, order._id);

    await appendOrderAuditLog(ctx, {
      orderId: ret.orderId,
      action: "return_inspected",
      actorUserId: officer._id,
      actorLabel: officer.name,
      note: args.conditionNote.trim(),
      metadata: {
        returnId: ret._id,
        disposition: args.disposition,
      },
    });

    return { returnId: ret._id };
  },
});
