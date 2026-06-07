import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireMerchOfficer } from "./helpers";

export const list = query({
  args: { logtoId: v.string(), authToken: v.string(), includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const categories = await ctx.db.query("merchCategories").collect();
    return categories
      .filter((c) => args.includeArchived || c.status === "active")
      .sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const create = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const existing = await ctx.db
      .query("merchCategories")
      .withIndex("by_name", (q) => q.eq("name", args.name.trim()))
      .first();
    if (existing && existing.status === "active") {
      throw new Error("Category name already exists");
    }

    const all = await ctx.db.query("merchCategories").collect();
    const maxOrder = all.reduce((max, c) => Math.max(max, c.sortOrder), 0);
    const now = Date.now();

    return ctx.db.insert("merchCategories", {
      name: args.name.trim(),
      sortOrder: maxOrder + 1,
      status: "active",
      createdAt: now,
      createdBy: officer._id,
      updatedAt: now,
    });
  },
});

export const rename = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    categoryId: v.id("merchCategories"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    await ctx.db.patch(args.categoryId, {
      name: args.name.trim(),
      updatedAt: Date.now(),
    });
  },
});

export const archive = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    categoryId: v.id("merchCategories"),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    await ctx.db.patch(args.categoryId, {
      status: "archived",
      updatedAt: Date.now(),
    });
  },
});

export const reorder = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    orderedIds: v.array(v.id("merchCategories")),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    await Promise.all(
      args.orderedIds.map((id, index) =>
        ctx.db.patch(id, { sortOrder: index + 1, updatedAt: Date.now() }),
      ),
    );
  },
});
