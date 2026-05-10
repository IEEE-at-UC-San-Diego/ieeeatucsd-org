import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Internal queries for Google Calendar sync actions
export const getPublishedEventsForSync = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("events")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();
  },
});

export const getInternalEventsForSync = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("internalEvents")
      .withIndex("by_startDate")
      .collect();
  },
});

export const getSyncState = internalQuery({
  args: {
    calendarId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("googleCalendarSyncState")
      .withIndex("by_calendarId", (q) => q.eq("calendarId", args.calendarId))
      .first();
  },
});

export const saveSyncState = internalMutation({
  args: {
    calendarId: v.string(),
    lastSuccessfulSourceCount: v.optional(v.number()),
    staleCandidates: v.array(
      v.object({
        eventId: v.string(),
        firstSeenMissingAt: v.number(),
        lastSeenMissingAt: v.number(),
        missingSyncCount: v.number(),
        startMs: v.optional(v.number()),
      }),
    ),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleCalendarSyncState")
      .withIndex("by_calendarId", (q) => q.eq("calendarId", args.calendarId))
      .first();

    const syncState = {
      calendarId: args.calendarId,
      staleCandidates: args.staleCandidates,
      updatedAt: args.updatedAt,
      ...(args.lastSuccessfulSourceCount !== undefined
        ? { lastSuccessfulSourceCount: args.lastSuccessfulSourceCount }
        : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, syncState);
      return existing._id;
    }

    return await ctx.db.insert("googleCalendarSyncState", syncState);
  },
});
