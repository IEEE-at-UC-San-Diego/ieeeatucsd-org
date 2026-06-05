import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCurrentUser, requireOfficerAccess } from "./permissions";

export const list = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx, args.logtoId, args.authToken);
    return await ctx.db.query("links").collect();
  },
});

export const getByCategory = query({
  args: { logtoId: v.string(), authToken: v.string(), category: v.string() },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx, args.logtoId, args.authToken);
    return await ctx.db
      .query("links")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
  },
});

export const create = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    url: v.string(),
    title: v.string(),
    category: v.string(),
    description: v.optional(v.string()),
    iconUrl: v.optional(v.string()),
    shortUrl: v.optional(v.string()),
    publishDate: v.optional(v.number()),
    expireDate: v.optional(v.number()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    const { logtoId, authToken, ...data } = args;
    return await ctx.db.insert("links", {
      ...data,
      createdBy: userId,
    });
  },
});

export const update = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("links"),
    url: v.optional(v.string()),
    title: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    iconUrl: v.optional(v.string()),
    shortUrl: v.optional(v.string()),
    publishDate: v.optional(v.number()),
    expireDate: v.optional(v.number()),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    const { id, logtoId, authToken, ...updates } = args;
    const cleanUpdates: Record<string, unknown> = {
      lastModified: Date.now(),
      lastModifiedBy: userId,
    };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        cleanUpdates[key] = value;
      }
    }
    await ctx.db.patch(id, cleanUpdates);
    return id;
  },
});

export const remove = mutation({
  args: { logtoId: v.string(), authToken: v.string(), id: v.id("links") },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    await ctx.db.delete(args.id);
  },
});
