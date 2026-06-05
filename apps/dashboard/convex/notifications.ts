import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCurrentUser, requireAdminAccess } from "./permissions";

export const listMine = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    const now = Date.now();

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return notifications
      .filter((n) => !n.expiresAt || n.expiresAt > now)
      .sort((a, b) => (b.createdAt ?? b._creationTime) - (a.createdAt ?? a._creationTime));
  },
});

export const unreadCount = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    const now = Date.now();

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return notifications.filter((n) => !n.read && (!n.expiresAt || n.expiresAt > now)).length;
  },
});

export const markAsRead = mutation({
  args: { logtoId: v.string(), authToken: v.string(), id: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    const notification = await ctx.db.get(args.id);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== userId) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(args.id, { read: true });
  },
});

export const markAllAsRead = mutation({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    await Promise.all(
      unread.filter((n) => !n.read).map((n) => ctx.db.patch(n._id, { read: true })),
    );
  },
});

export const create = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    userId: v.string(),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    data: v.optional(v.any()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const { logtoId, authToken, ...notificationData } = args;
    return await ctx.db.insert("notifications", {
      ...notificationData,
      read: false,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { logtoId: v.string(), authToken: v.string(), id: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    const notification = await ctx.db.get(args.id);
    if (!notification) throw new Error("Notification not found");
    if (notification.userId !== userId) {
      throw new Error("Unauthorized");
    }
    await ctx.db.delete(args.id);
  },
});
