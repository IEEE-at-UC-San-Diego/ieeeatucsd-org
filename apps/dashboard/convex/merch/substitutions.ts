import { internalMutation, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { deductMerchandisePoints, refundMerchandisePoints } from "../points/service";
import { requireMerchOfficer, requireStoreAccess } from "./helpers";
import {
  appendOrderAuditLog,
  getVariantPointPrice,
  releaseVariantInventory,
  reserveVariantInventory,
  syncOrderStatusFromItems,
} from "./orderHelpers";

const DEFAULT_EXPIRY_MS = 48 * 60 * 60 * 1000;

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
      .query("merchSubstitutionProposals")
      .filter((q) => q.eq(q.field("orderId"), args.orderId))
      .collect();
  },
});

export const propose = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    orderItemId: v.id("merchOrderItems"),
    replacementVariantId: v.id("merchVariants"),
    idempotencyKey: v.string(),
    expiresInMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);

    const existing = await ctx.db
      .query("merchSubstitutionProposals")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
    if (existing) return { proposalId: existing._id };

    const item = await ctx.db.get(args.orderItemId);
    if (!item) throw new Error("Order item not found");
    if (item.status !== "confirmed" && item.status !== "action_required") {
      throw new Error("Item is not eligible for substitution");
    }

    const replacement = await ctx.db.get(args.replacementVariantId);
    if (!replacement?.enabled) throw new Error("Replacement variant unavailable");

    const available = replacement.onHand - replacement.reserved;
    if (available < item.quantity) {
      throw new Error("Insufficient replacement inventory");
    }

    const originalRelease = await ctx.db.get(item.releaseId);
    const replacementRelease = await ctx.db.get(replacement.releaseId);
    if (!originalRelease || !replacementRelease) {
      throw new Error("Release not found");
    }

    const originalPrice = item.pointPrice;
    const replacementPrice = getVariantPointPrice(replacementRelease, replacement);
    const priceDifference = (replacementPrice - originalPrice) * item.quantity;

    const now = Date.now();
    const proposalId = await ctx.db.insert("merchSubstitutionProposals", {
      orderId: item.orderId,
      orderItemId: item._id,
      originalVariantId: item.variantId,
      replacementVariantId: replacement._id,
      quantity: item.quantity,
      priceDifference,
      status: "pending",
      proposedBy: officer._id,
      proposedAt: now,
      expiresAt: now + (args.expiresInMs ?? DEFAULT_EXPIRY_MS),
      idempotencyKey: args.idempotencyKey,
    });

    await reserveVariantInventory(ctx, {
      variantId: replacement._id,
      quantity: item.quantity,
    });

    await ctx.db.patch(item._id, {
      status: "action_required",
      updatedAt: now,
    });
    await syncOrderStatusFromItems(ctx, item.orderId);

    await appendOrderAuditLog(ctx, {
      orderId: item.orderId,
      action: "substitution_proposed",
      actorUserId: officer._id,
      actorLabel: officer.name,
      metadata: { proposalId, replacementVariantId: replacement._id },
    });

    return { proposalId };
  },
});

export const accept = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    proposalId: v.id("merchSubstitutionProposals"),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireStoreAccess(ctx, args.logtoId, args.authToken);
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.status !== "pending") {
      throw new Error("Proposal is no longer pending");
    }
    if (Date.now() > proposal.expiresAt) {
      throw new Error("Proposal has expired");
    }

    const order = await ctx.db.get(proposal.orderId);
    if (!order || order.userId !== user._id) {
      throw new Error("Not authorized to accept this proposal");
    }

    const item = await ctx.db.get(proposal.orderItemId);
    if (!item) throw new Error("Order item not found");

    const replacement = await ctx.db.get(proposal.replacementVariantId);
    const replacementRelease = replacement
      ? await ctx.db.get(replacement.releaseId)
      : null;
    const product = replacement ? await ctx.db.get(replacement.productId) : null;
    if (!replacement || !replacementRelease || !product) {
      throw new Error("Replacement variant unavailable");
    }

    const now = Date.now();
    await releaseVariantInventory(ctx, {
      variantId: proposal.originalVariantId,
      quantity: proposal.quantity,
    });

    const replacementPrice = getVariantPointPrice(replacementRelease, replacement);
    await ctx.db.patch(item._id, {
      variantId: replacement._id,
      releaseId: replacement.releaseId,
      productId: replacement.productId,
      productName: product.name,
      variantLabel: replacement.label,
      sku: replacement.sku,
      pointPrice: replacementPrice,
      imageStorageId: replacement.imageStorageId ?? product.primaryImageStorageId,
      status: "confirmed",
      updatedAt: now,
    });

    if (proposal.priceDifference > 0) {
      await deductMerchandisePoints(ctx, {
        userId: user._id,
        amount: proposal.priceDifference,
        orderId: order._id,
        description: `Substitution price difference for order ${order.displayNumber}`,
        idempotencyKey: `${args.idempotencyKey}:deduct`,
      });
      await ctx.db.patch(order._id, {
        pointTotal: order.pointTotal + proposal.priceDifference,
        updatedAt: now,
      });
    } else if (proposal.priceDifference < 0) {
      const refundAmount = Math.abs(proposal.priceDifference);
      await refundMerchandisePoints(ctx, {
        userId: user._id,
        amount: refundAmount,
        orderId: order._id,
        description: `Substitution refund for order ${order.displayNumber}`,
        idempotencyKey: `${args.idempotencyKey}:refund`,
        actorUserId: user._id,
      });
      await ctx.db.patch(order._id, {
        pointTotal: order.pointTotal - refundAmount,
        updatedAt: now,
      });
    }

    await ctx.db.patch(proposal._id, {
      status: "accepted",
      respondedAt: now,
    });

    await syncOrderStatusFromItems(ctx, order._id);

    await appendOrderAuditLog(ctx, {
      orderId: order._id,
      action: "substitution_accepted",
      actorUserId: user._id,
      actorLabel: user.name,
      metadata: { proposalId: proposal._id },
    });

    return { proposalId: proposal._id };
  },
});

export const decline = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    proposalId: v.id("merchSubstitutionProposals"),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireStoreAccess(ctx, args.logtoId, args.authToken);
    const proposal = await ctx.db.get(args.proposalId);
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.status !== "pending") return { proposalId: proposal._id };

    const order = await ctx.db.get(proposal.orderId);
    if (!order || order.userId !== user._id) {
      throw new Error("Not authorized to decline this proposal");
    }

    await releaseVariantInventory(ctx, {
      variantId: proposal.replacementVariantId,
      quantity: proposal.quantity,
    });

    const now = Date.now();
    await ctx.db.patch(proposal._id, {
      status: "declined",
      respondedAt: now,
    });

    const item = await ctx.db.get(proposal.orderItemId);
    if (item) {
      await ctx.db.patch(item._id, { status: "action_required", updatedAt: now });
      await syncOrderStatusFromItems(ctx, proposal.orderId);
    }

    await appendOrderAuditLog(ctx, {
      orderId: proposal.orderId,
      action: "substitution_declined",
      actorUserId: user._id,
      actorLabel: user.name,
      metadata: { proposalId: proposal._id, idempotencyKey: args.idempotencyKey },
    });

    return { proposalId: proposal._id };
  },
});

export const expire = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.db
      .query("merchSubstitutionProposals")
      .withIndex("by_status_expiresAt", (q) => q.eq("status", "pending"))
      .collect();

    let expiredCount = 0;
    for (const proposal of pending) {
      if (proposal.expiresAt > now) continue;

      await releaseVariantInventory(ctx, {
        variantId: proposal.replacementVariantId,
        quantity: proposal.quantity,
      });

      await ctx.db.patch(proposal._id, {
        status: "expired",
        respondedAt: now,
      });

      const item = await ctx.db.get(proposal.orderItemId);
      if (item && item.status === "action_required") {
        await ctx.db.patch(item._id, { status: "action_required", updatedAt: now });
        await syncOrderStatusFromItems(ctx, proposal.orderId);
      }

      await appendOrderAuditLog(ctx, {
        orderId: proposal.orderId,
        action: "substitution_expired",
        actorLabel: "system",
        metadata: { proposalId: proposal._id },
      });

      expiredCount++;
    }

    return { expiredCount };
  },
});
