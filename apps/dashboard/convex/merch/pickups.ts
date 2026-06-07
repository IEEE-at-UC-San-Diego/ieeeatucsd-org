import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireMerchOfficer, requireStoreAccess } from "./helpers";
import {
  computeEventPickupCutoff,
  DEFAULT_PROJECT_SPACE_CUTOFF_HOURS,
  DEFAULT_VISIBILITY_WEEKS,
  isPickupOptionSelectable,
} from "./pickupHelpers";

const cutoffTypeValidator = v.union(v.literal("relative"), v.literal("absolute"));

async function enrichPickupOption(
  ctx: QueryCtx | MutationCtx,
  option: Doc<"merchPickupOptions">,
) {
  let label = "Project Space";
  let eventName: string | undefined;
  let location: string | undefined;

  if (option.type === "event" && option.eventId) {
    const event = await ctx.db.get(option.eventId);
    eventName = event?.eventName;
    location = event?.location;
    label = event?.eventName ?? "Event pickup";
  }

  const remainingCapacity =
    option.capacity === undefined
      ? null
      : Math.max(0, option.capacity - option.orderCount);

  return {
    ...option,
    label,
    eventName,
    location,
    remainingCapacity,
    selectable: isPickupOptionSelectable(option),
  };
}

async function findActiveEventPickupOption(
  ctx: MutationCtx,
  eventId: Id<"events">,
) {
  const options = await ctx.db
    .query("merchPickupOptions")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .collect();
  return options.find((option) => option.status === "active") ?? null;
}

export const listPickupOptions = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const options = await ctx.db.query("merchPickupOptions").collect();
    const schedules = await ctx.db.query("merchPickupSchedules").collect();

    const enriched = await Promise.all(
      options
        .sort((a, b) => a.windowStart - b.windowStart)
        .map((option) => enrichPickupOption(ctx, option)),
    );

    return {
      options: enriched,
      schedules: schedules.sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    };
  },
});

export const listUpcomingEventsForPickup = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const now = Date.now();
    const events = await ctx.db
      .query("events")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    return events
      .filter((event) => event.startDate > now)
      .sort((a, b) => a.startDate - b.startDate)
      .map((event) => ({
        _id: event._id,
        eventName: event.eventName,
        location: event.location,
        startDate: event.startDate,
        endDate: event.endDate,
        merchPickupEnabled: event.merchPickupEnabled ?? false,
        merchPickupCutoffType: event.merchPickupCutoffType ?? "relative",
        merchPickupCutoffAt: event.merchPickupCutoffAt,
        merchPickupCapacity: event.merchPickupCapacity,
      }));
  },
});

export const listEligibleForMember = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    releaseId: v.optional(v.id("merchReleases")),
  },
  handler: async (ctx, args) => {
    await requireStoreAccess(ctx, args.logtoId, args.authToken);

    let excludedIds: string[] = [];
    if (args.releaseId) {
      const release = await ctx.db.get(args.releaseId);
      excludedIds = release?.excludedPickupOptionIds ?? [];
    }

    const now = Date.now();
    const activeOptions = await ctx.db
      .query("merchPickupOptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const eligible = [];
    for (const option of activeOptions) {
      if (excludedIds.includes(option._id)) continue;
      if (!isPickupOptionSelectable(option, now)) continue;

      if (option.type === "event") {
        if (!option.eventId) continue;
        const event = await ctx.db.get(option.eventId);
        if (!event?.published || !event.merchPickupEnabled) continue;
        if (event.startDate <= now) continue;
      }

      eligible.push(await enrichPickupOption(ctx, option));
    }

    return eligible.sort((a, b) => a.windowStart - b.windowStart);
  },
});

export const enableEventPickup = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    eventId: v.id("events"),
    enabled: v.boolean(),
    cutoffType: v.optional(cutoffTypeValidator),
    cutoffValue: v.optional(v.number()),
    capacity: v.optional(v.number()),
    instructions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");
    if (!event.published) throw new Error("Only published events can enable merch pickup");
    if (event.startDate <= Date.now()) {
      throw new Error("Only upcoming events can enable merch pickup");
    }

    const now = Date.now();
    const existingOption = await findActiveEventPickupOption(ctx, args.eventId);

    if (!args.enabled) {
      await ctx.db.patch(args.eventId, {
        merchPickupEnabled: false,
      });
      if (existingOption) {
        await ctx.db.patch(existingOption._id, {
          status: "closed",
          updatedAt: now,
        });
      }
      return { eventId: args.eventId, enabled: false };
    }

    const cutoffType = args.cutoffType ?? event.merchPickupCutoffType ?? "relative";
    const cutoffAtValue = args.cutoffValue ?? event.merchPickupCutoffAt;
    const capacity = args.capacity ?? event.merchPickupCapacity;

    await ctx.db.patch(args.eventId, {
      merchPickupEnabled: true,
      merchPickupCutoffType: cutoffType,
      merchPickupCutoffAt: cutoffAtValue,
      merchPickupCapacity: capacity,
    });

    const updatedEvent = {
      ...event,
      merchPickupEnabled: true,
      merchPickupCutoffType: cutoffType,
      merchPickupCutoffAt: cutoffAtValue,
      merchPickupCapacity: capacity,
    };
    const cutoffAt = computeEventPickupCutoff(updatedEvent);
    const instructions =
      args.instructions?.trim() ||
      `Pick up at ${event.location} during the event.`;

    if (existingOption) {
      await ctx.db.patch(existingOption._id, {
        windowStart: event.startDate,
        windowEnd: event.endDate,
        instructions,
        capacity,
        cutoffAt,
        updatedAt: now,
      });
      return { eventId: args.eventId, pickupOptionId: existingOption._id, enabled: true };
    }

    const pickupOptionId = await ctx.db.insert("merchPickupOptions", {
      type: "event",
      eventId: args.eventId,
      windowStart: event.startDate,
      windowEnd: event.endDate,
      instructions,
      capacity,
      cutoffAt,
      status: "active",
      orderCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return { eventId: args.eventId, pickupOptionId, enabled: true };
  },
});

export const createProjectSpaceWindow = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    windowStart: v.number(),
    windowEnd: v.number(),
    instructions: v.string(),
    capacity: v.optional(v.number()),
    cutoffAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    if (!args.instructions.trim()) {
      throw new Error("Pickup instructions are required");
    }
    if (args.windowEnd <= args.windowStart) {
      throw new Error("Pickup window end must be after start");
    }
    if (args.windowStart <= Date.now()) {
      throw new Error("Pickup window must start in the future");
    }

    const cutoffAt =
      args.cutoffAt ??
      args.windowStart - DEFAULT_PROJECT_SPACE_CUTOFF_HOURS * 60 * 60 * 1000;
    if (cutoffAt >= args.windowStart) {
      throw new Error("Cutoff must be before the pickup window starts");
    }

    const now = Date.now();
    const pickupOptionId = await ctx.db.insert("merchPickupOptions", {
      type: "project_space",
      windowStart: args.windowStart,
      windowEnd: args.windowEnd,
      instructions: args.instructions.trim(),
      capacity: args.capacity,
      cutoffAt,
      status: "active",
      orderCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return { pickupOptionId };
  },
});

export const createRecurringSchedule = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    dayOfWeek: v.number(),
    startTimeMinutes: v.number(),
    endTimeMinutes: v.number(),
    instructions: v.string(),
    capacity: v.optional(v.number()),
    cutoffHoursBefore: v.optional(v.number()),
    visibilityWeeks: v.optional(v.number()),
    exceptions: v.optional(
      v.array(
        v.object({
          date: v.string(),
          type: v.union(v.literal("skip"), v.literal("override")),
          startTimeMinutes: v.optional(v.number()),
          endTimeMinutes: v.optional(v.number()),
          instructions: v.optional(v.string()),
          capacity: v.optional(v.number()),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    if (args.dayOfWeek < 0 || args.dayOfWeek > 6) {
      throw new Error("dayOfWeek must be between 0 (Sunday) and 6 (Saturday)");
    }
    if (args.endTimeMinutes <= args.startTimeMinutes) {
      throw new Error("End time must be after start time");
    }
    if (!args.instructions.trim()) {
      throw new Error("Pickup instructions are required");
    }

    const scheduleId = await ctx.db.insert("merchPickupSchedules", {
      dayOfWeek: args.dayOfWeek,
      startTimeMinutes: args.startTimeMinutes,
      endTimeMinutes: args.endTimeMinutes,
      instructions: args.instructions.trim(),
      capacity: args.capacity,
      cutoffHoursBefore: args.cutoffHoursBefore ?? DEFAULT_PROJECT_SPACE_CUTOFF_HOURS,
      visibilityWeeks: args.visibilityWeeks ?? DEFAULT_VISIBILITY_WEEKS,
      active: true,
      exceptions: args.exceptions ?? [],
    });

    await ctx.scheduler.runAfter(0, internal.merch.pickupJobs.generateRollingWindows, {});

    return { scheduleId };
  },
});

export const closePickupOption = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    pickupOptionId: v.id("merchPickupOptions"),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const option = await ctx.db.get(args.pickupOptionId);
    if (!option) throw new Error("Pickup option not found");
    if (option.status !== "active") {
      throw new Error("Pickup option is not active");
    }

    const now = Date.now();
    await ctx.db.patch(args.pickupOptionId, {
      status: "closed",
      updatedAt: now,
    });

    if (option.type === "event" && option.eventId) {
      await ctx.db.patch(option.eventId, {
        merchPickupEnabled: false,
      });
    }

    return { pickupOptionId: args.pickupOptionId, status: "closed" as const };
  },
});

export { computeEventPickupCutoff } from "./pickupHelpers";
