import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireMerchAdmin, requireMerchOfficer, requireStoreAccess } from "./helpers";

export const list = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    return ctx.db.query("merchPolicies").order("desc").collect();
  },
});

export const getPublished = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const policies = await ctx.db
      .query("merchPolicies")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();

    return (
      policies
        .filter((policy) => (policy.effectiveAt ?? 0) <= now)
        .sort((a, b) => (b.effectiveAt ?? 0) - (a.effectiveAt ?? 0))[0] ?? null
    );
  },
});

export const draft = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    version: v.string(),
    content: v.string(),
    changeSummary: v.optional(v.string()),
    requiresReacceptance: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    if (!args.version.trim() || !args.content.trim()) {
      throw new Error("Version and content are required");
    }

    const existing = await ctx.db
      .query("merchPolicies")
      .withIndex("by_version", (q) => q.eq("version", args.version.trim()))
      .first();
    if (existing) throw new Error("Policy version already exists");

    const policyId = await ctx.db.insert("merchPolicies", {
      version: args.version.trim(),
      content: args.content.trim(),
      status: "draft",
      changeSummary: args.changeSummary?.trim(),
      requiresReacceptance: args.requiresReacceptance ?? false,
      createdBy: officer._id,
      createdAt: Date.now(),
    });

    return { policyId };
  },
});

export const publish = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    policyId: v.id("merchPolicies"),
    effectiveAt: v.number(),
    changeSummary: v.optional(v.string()),
    requiresReacceptance: v.boolean(),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchAdmin(ctx, args.logtoId, args.authToken);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) throw new Error("Policy not found");
    if (policy.status !== "draft") {
      throw new Error("Only draft policies can be published");
    }

    const published = await ctx.db
      .query("merchPolicies")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .collect();
    for (const existing of published) {
      await ctx.db.patch(existing._id, { status: "archived" });
    }

    const now = Date.now();
    await ctx.db.patch(policy._id, {
      status: "published",
      effectiveAt: args.effectiveAt,
      changeSummary: args.changeSummary?.trim() ?? policy.changeSummary,
      requiresReacceptance: args.requiresReacceptance,
      publishedBy: officer._id,
      publishedAt: now,
    });

    return { policyId: policy._id };
  },
});

export const accept = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    policyVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireStoreAccess(ctx, args.logtoId, args.authToken);
    const policy = await ctx.db
      .query("merchPolicies")
      .withIndex("by_version", (q) => q.eq("version", args.policyVersion))
      .first();
    if (!policy || policy.status !== "published") {
      throw new Error("Published policy version not found");
    }

    const now = Date.now();
    await ctx.db.patch(user._id, {
      merchPolicyAcceptedAt: now,
      merchPolicyVersion: policy.version,
    });

    return {
      acceptedAt: now,
      version: policy.version,
    };
  },
});
