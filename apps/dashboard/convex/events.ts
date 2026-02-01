import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: {
    onlyPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { onlyPublished = true } = args;

    let eventsQuery = ctx.db.query("events");

    if (onlyPublished) {
      eventsQuery = eventsQuery.filter((q) => q.eq(q.field("published"), true));
    }

    const events = await eventsQuery
      .order("asc")
      .collect();

    return events.map((event) => ({
      ...event,
      _id: event._id,
    }));
  },
});

export const getById = query({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.id);
    if (!event) return null;
    return { ...event, _id: event._id };
  },
});

export const getStats = query({
  handler: async (ctx) => {
    const publishedEvents = await ctx.db
      .query("events")
      .filter((q) => q.eq(q.field("published"), true))
      .collect();

    const now = Date.now();
    const upcomingEvents = publishedEvents.filter(
      (e) => e.startDate > now
    );

    return {
      totalPublished: publishedEvents.length,
      totalUpcoming: upcomingEvents.length,
    };
  },
});

export const getUserAttendedEvents = query({
  args: {
    userId: v.id("users"),
    onlyPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId, onlyPublished = true } = args;

    const attendees = await ctx.db
      .query("event_attendees")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();

    if (attendees.length === 0) return [];

    const eventIds = [...new Set(attendees.map((a) => a.eventId))];

    const events = await Promise.all(
      eventIds.map((eventId) => ctx.db.get(eventId))
    );

    const filteredEvents = events
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .filter((e) => !onlyPublished || e.published);

    return filteredEvents.map((event) => ({
      ...event,
      _id: event._id,
      checkedInAt: attendees.find((a) => a.eventId === event._id)?.checkedInAt,
      pointsEarned: attendees.find((a) => a.eventId === event._id)?.pointsEarned,
    }));
  },
});
