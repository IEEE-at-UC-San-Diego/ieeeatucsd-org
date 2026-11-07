import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminAccess } from "./permissions";

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

type LogAuthor = {
  logtoId?: string | null;
  authUserId?: string | null;
};

/**
 * Audit rows are attributed to the authenticated admin record.
 * Callers cannot choose the stored user id, and anonymous writes
 * cannot fall back to a "system" actor.
 */
export function logAuthorId(user: LogAuthor): string {
  const userId =
    (user.logtoId ?? "").trim() || (user.authUserId ?? "").trim();
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

export const create = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    type: logType,
    part: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    return await ctx.db.insert("logs", {
      userId: logAuthorId(admin),
      type: args.type,
      part: args.part,
      message: args.message,
    });
  },
});
