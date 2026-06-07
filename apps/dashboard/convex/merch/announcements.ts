import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireMerchOfficer } from "./helpers";

export const list = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    return ctx.db.query("merchAnnouncements").order("desc").collect();
  },
});

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const announcements = await ctx.db
      .query("merchAnnouncements")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    return (
      announcements.find(
        (item) =>
          (item.activeFrom === undefined || item.activeFrom <= now) &&
          (item.activeUntil === undefined || item.activeUntil >= now),
      ) ?? null
    );
  },
});

export const upsert = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    announcementId: v.optional(v.id("merchAnnouncements")),
    message: v.string(),
    linkUrl: v.optional(v.string()),
    linkLabel: v.optional(v.string()),
    activeFrom: v.optional(v.number()),
    activeUntil: v.optional(v.number()),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    if (!args.message.trim()) throw new Error("Message is required");

    const now = Date.now();
    const payload = {
      message: args.message.trim(),
      linkUrl: args.linkUrl?.trim() || undefined,
      linkLabel: args.linkLabel?.trim() || undefined,
      activeFrom: args.activeFrom,
      activeUntil: args.activeUntil,
      active: args.active,
      updatedAt: now,
    };

    if (args.announcementId) {
      const existing = await ctx.db.get(args.announcementId);
      if (!existing) throw new Error("Announcement not found");
      await ctx.db.patch(args.announcementId, payload);
      return { announcementId: args.announcementId };
    }

    const announcementId = await ctx.db.insert("merchAnnouncements", {
      ...payload,
      createdBy: officer._id,
    });

    return { announcementId };
  },
});

export const deactivate = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    announcementId: v.id("merchAnnouncements"),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const announcement = await ctx.db.get(args.announcementId);
    if (!announcement) throw new Error("Announcement not found");

    await ctx.db.patch(args.announcementId, {
      active: false,
      updatedAt: Date.now(),
    });

    return { announcementId: args.announcementId };
  },
});
