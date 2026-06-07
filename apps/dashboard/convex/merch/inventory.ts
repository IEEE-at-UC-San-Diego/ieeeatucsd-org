import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { getStockDisplay, requireMerchOfficer } from "./helpers";

export const listByRelease = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    releaseId: v.id("merchReleases"),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const variants = await ctx.db
      .query("merchVariants")
      .withIndex("by_releaseId", (q) => q.eq("releaseId", args.releaseId))
      .collect();

    return variants.map((variant) => {
      const available = Math.max(0, variant.onHand - variant.reserved);
      return {
        ...variant,
        available,
        stockDisplay: getStockDisplay(available, variant.lowStockThreshold),
      };
    });
  },
});

export const adjustStock = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    variantId: v.id("merchVariants"),
    delta: v.number(),
    reason: v.string(),
    note: v.optional(v.string()),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    if (!args.reason.trim()) throw new Error("Inventory adjustment reason is required");

    const existing = await ctx.db
      .query("merchInventoryLedger")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
      .first();
    if (existing) return existing._id;

    const variant = await ctx.db.get(args.variantId);
    if (!variant) throw new Error("Variant not found");

    const nextOnHand = variant.onHand + args.delta;
    if (nextOnHand < variant.reserved) {
      throw new Error("Cannot reduce on-hand below reserved quantity");
    }
    if (nextOnHand < 0) {
      throw new Error("On-hand quantity cannot be negative");
    }

    await ctx.db.patch(args.variantId, {
      onHand: nextOnHand,
      updatedAt: Date.now(),
    });

    return ctx.db.insert("merchInventoryLedger", {
      variantId: args.variantId,
      releaseId: variant.releaseId,
      productId: variant.productId,
      deltaOnHand: args.delta,
      reason: args.reason.trim(),
      note: args.note,
      actorUserId: officer._id,
      timestamp: Date.now(),
      idempotencyKey: args.idempotencyKey,
    });
  },
});

export const getLedger = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    variantId: v.optional(v.id("merchVariants")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const limit = args.limit ?? 50;

    if (args.variantId) {
      return ctx.db
        .query("merchInventoryLedger")
        .withIndex("by_variantId_timestamp", (q) => q.eq("variantId", args.variantId!))
        .order("desc")
        .take(limit);
    }

    const entries = await ctx.db.query("merchInventoryLedger").order("desc").take(limit);
    return entries;
  },
});

export const createReconciliation = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    releaseId: v.id("merchReleases"),
    counts: v.array(
      v.object({
        variantId: v.id("merchVariants"),
        countedQuantity: v.number(),
      }),
    ),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    if (!args.reason.trim()) throw new Error("Reconciliation reason is required");

    const entries = [];
    let blocked = false;

    for (const count of args.counts) {
      const variant = await ctx.db.get(count.variantId);
      if (!variant) continue;
      const delta = count.countedQuantity - variant.onHand;
      if (count.countedQuantity < variant.reserved) {
        blocked = true;
      }
      entries.push({
        variantId: count.variantId,
        countedQuantity: count.countedQuantity,
        previousOnHand: variant.onHand,
        delta,
      });
    }

    const reconciliationId = await ctx.db.insert("merchInventoryReconciliations", {
      releaseId: args.releaseId,
      status: blocked ? "blocked" : "draft",
      entries,
      reason: args.reason.trim(),
      actorUserId: officer._id,
      createdAt: Date.now(),
    });

    return { reconciliationId, blocked };
  },
});

export const postReconciliation = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    reconciliationId: v.id("merchInventoryReconciliations"),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const reconciliation = await ctx.db.get(args.reconciliationId);
    if (!reconciliation) throw new Error("Reconciliation not found");
    if (reconciliation.status === "blocked") {
      throw new Error("Blocked reconciliation requires executive resolution");
    }
    if (reconciliation.status === "posted") {
      return;
    }

    for (const entry of reconciliation.entries) {
      const variant = await ctx.db.get(entry.variantId);
      if (!variant) continue;
      if (entry.countedQuantity < variant.reserved) {
        throw new Error("Cannot post reconciliation below reserved stock");
      }
      await ctx.db.patch(entry.variantId, {
        onHand: entry.countedQuantity,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("merchInventoryLedger", {
        variantId: entry.variantId,
        releaseId: variant.releaseId,
        productId: variant.productId,
        deltaOnHand: entry.delta,
        reason: `Reconciliation: ${reconciliation.reason}`,
        actorUserId: officer._id,
        timestamp: Date.now(),
        idempotencyKey: `recon:${args.reconciliationId}:${entry.variantId}`,
      });
    }

    await ctx.db.patch(args.reconciliationId, {
      status: "posted",
      postedAt: Date.now(),
    });
  },
});
