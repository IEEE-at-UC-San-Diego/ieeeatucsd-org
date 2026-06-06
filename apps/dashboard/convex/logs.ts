import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminAccess, getCurrentUser } from "./permissions";

const logType = v.union(
  v.literal("info"),
  v.literal("warning"),
  v.literal("error"),
  v.literal("update"),
  v.literal("delete"),
  v.literal("create"),
  v.literal("login"),
  v.literal("logout"),
);

export const list = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    limit: v.optional(v.number()),
    type: v.optional(logType),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const limit = Math.max(1, Math.min(args.limit ?? 100, 500));
    if (!args.type) {
      return await ctx.db.query("logs").order("desc").take(limit);
    }

    return await ctx.db
      .query("logs")
      .filter((q) => q.eq(q.field("type"), args.type))
      .order("desc")
      .take(limit);
  },
});

export const create = mutation({
  args: {
    logtoId: v.optional(v.string()),
    authToken: v.string(),
    userId: v.optional(v.string()),
    type: logType,
    part: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    let userId = args.userId;

    if (!userId && args.logtoId && args.authToken) {
      const user = await getCurrentUser(ctx, args.logtoId, args.authToken);
      userId = user?.logtoId ?? user?.authUserId ?? args.logtoId;
    }

    return await ctx.db.insert("logs", {
      userId: userId ?? "system",
      type: args.type,
      part: args.part,
      message: args.message,
    });
  },
});
