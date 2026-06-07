import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireMerchAdmin, requireMerchOfficer, requireStoreAccess } from "./helpers";
import { appendOrderAuditLog } from "./orderHelpers";

const issueTypeValidator = v.union(
  v.literal("missing_item"),
  v.literal("wrong_variant"),
  v.literal("damaged_item"),
  v.literal("pickup_marked_incorrectly"),
  v.literal("other"),
);

const resolutionValidator = v.union(
  v.literal("no_action"),
  v.literal("replacement"),
  v.literal("partial_refund"),
  v.literal("full_item_refund"),
  v.literal("correct_fulfillment_record"),
);

export const listForOrder = query({
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
      await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    }

    return ctx.db
      .query("merchPickupIssues")
      .withIndex("by_orderId", (q) => q.eq("orderId", args.orderId))
      .collect();
  },
});

export const listOpen = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const limit = args.limit ?? 50;

    const issues = await ctx.db
      .query("merchPickupIssues")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .take(limit);

    return Promise.all(
      issues.map(async (issue) => {
        const order = await ctx.db.get(issue.orderId);
        const member = order ? await ctx.db.get(order.userId) : null;
        return {
          ...issue,
          displayNumber: order?.displayNumber,
          memberName: member?.name,
        };
      }),
    );
  },
});

export const memberReport = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    orderId: v.id("merchOrders"),
    orderItemIds: v.array(v.id("merchOrderItems")),
    issueType: issueTypeValidator,
    description: v.string(),
    photoStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const user = await requireStoreAccess(ctx, args.logtoId, args.authToken);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.userId !== user._id) {
      throw new Error("Not authorized to report on this order");
    }
    if (!args.description.trim()) {
      throw new Error("Description is required");
    }

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - order.updatedAt > sevenDaysMs) {
      throw new Error("Pickup issue reporting window has closed");
    }

    for (const itemId of args.orderItemIds) {
      const item = await ctx.db.get(itemId);
      if (!item || item.orderId !== order._id) {
        throw new Error("Invalid order item selection");
      }
    }

    const issueId = await ctx.db.insert("merchPickupIssues", {
      orderId: args.orderId,
      orderItemIds: args.orderItemIds,
      userId: user._id,
      issueType: args.issueType,
      description: args.description.trim(),
      photoStorageId: args.photoStorageId,
      status: "open",
      reportedAt: Date.now(),
    });

    await appendOrderAuditLog(ctx, {
      orderId: args.orderId,
      action: "pickup_issue_reported",
      actorUserId: user._id,
      actorLabel: user.name,
      metadata: { issueId, issueType: args.issueType },
    });

    return { issueId };
  },
});

export const officerResolve = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    issueId: v.id("merchPickupIssues"),
    status: v.union(
      v.literal("investigating"),
      v.literal("resolved"),
      v.literal("no_action"),
    ),
    resolution: v.optional(resolutionValidator),
    resolutionNote: v.optional(v.string()),
    lateCaseReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const issue = await ctx.db.get(args.issueId);
    if (!issue) throw new Error("Issue not found");

    const order = await ctx.db.get(issue.orderId);
    if (!order) throw new Error("Order not found");

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const isLate = Date.now() - order.updatedAt > sevenDaysMs;
    if (isLate && !args.lateCaseReason?.trim()) {
      await requireMerchAdmin(ctx, args.logtoId, args.authToken);
      throw new Error("Late case requires executive approval with a reason");
    }
    if (isLate && args.lateCaseReason?.trim()) {
      await requireMerchAdmin(ctx, args.logtoId, args.authToken);
    }

    const needsAdminApproval =
      args.resolution === "partial_refund" ||
      args.resolution === "full_item_refund" ||
      args.resolution === "replacement";
    if (needsAdminApproval) {
      await requireMerchAdmin(ctx, args.logtoId, args.authToken);
    }

    const now = Date.now();
    await ctx.db.patch(issue._id, {
      status: args.status,
      resolution: args.resolution,
      resolutionNote: args.resolutionNote?.trim(),
      resolvedBy: officer._id,
      resolvedAt: now,
    });

    await appendOrderAuditLog(ctx, {
      orderId: issue.orderId,
      action: "pickup_issue_resolved",
      actorUserId: officer._id,
      actorLabel: officer.name,
      note: args.resolutionNote ?? args.lateCaseReason,
      metadata: {
        issueId: issue._id,
        status: args.status,
        resolution: args.resolution,
      },
    });

    return { issueId: issue._id };
  },
});
