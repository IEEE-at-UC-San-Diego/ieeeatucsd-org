import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdminAccess } from "./permissions";

export const list = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const domains = await ctx.db.query("sponsorDomains").collect();
    return domains;
  },
});

export const getStats = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const domains = await ctx.db.query("sponsorDomains").collect();

    const goldSponsors = domains.filter((d) => d.sponsorTier === "Gold").length;
    const silverSponsors = domains.filter((d) => d.sponsorTier === "Silver").length;
    const bronzeSponsors = domains.filter((d) => d.sponsorTier === "Bronze").length;

    return {
      totalSponsors: domains.length,
      goldSponsors,
      silverSponsors,
      bronzeSponsors,
    };
  },
});

export const create = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    domain: v.string(),
    organizationName: v.string(),
    sponsorTier: v.union(
      v.literal("Bronze"),
      v.literal("Silver"),
      v.literal("Gold"),
      v.literal("Platinum"),
      v.literal("Diamond"),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const userId = admin.logtoId ?? admin._id;

    // Validate domain starts with @
    if (!args.domain.startsWith("@")) {
      throw new Error("Domain must start with @");
    }

    // Check for duplicate domain
    const existingDomain = await ctx.db
      .query("sponsorDomains")
      .filter((q) => q.eq(q.field("domain"), args.domain.toLowerCase()))
      .first();

    if (existingDomain) {
      throw new Error("This domain already exists");
    }

    const domainId = await ctx.db.insert("sponsorDomains", {
      domain: args.domain.toLowerCase(),
      organizationName: args.organizationName,
      sponsorTier: args.sponsorTier,
      createdBy: userId,
      _updatedAt: Date.now(),
    });

    return domainId;
  },
});

export const update = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("sponsorDomains"),
    domain: v.string(),
    organizationName: v.string(),
    sponsorTier: v.union(
      v.literal("Bronze"),
      v.literal("Silver"),
      v.literal("Gold"),
      v.literal("Platinum"),
      v.literal("Diamond"),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const userId = admin.logtoId ?? admin._id;

    // Validate domain starts with @
    if (!args.domain.startsWith("@")) {
      throw new Error("Domain must start with @");
    }

    // Check for duplicate domain (excluding current domain)
    const existingDomain = await ctx.db
      .query("sponsorDomains")
      .filter((q) => q.eq(q.field("domain"), args.domain.toLowerCase()))
      .first();

    if (existingDomain && existingDomain._id !== args.id) {
      throw new Error("This domain already exists");
    }

    await ctx.db.patch(args.id, {
      domain: args.domain.toLowerCase(),
      organizationName: args.organizationName,
      sponsorTier: args.sponsorTier,
      lastModifiedBy: userId,
      _updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("sponsorDomains"),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    await ctx.db.delete(args.id);
  },
});
