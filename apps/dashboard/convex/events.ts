import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import {
  requireCurrentUser,
  requireOfficerAccess,
  hasAdminAccess,
  hasOfficerAccess,
  isGeneralOfficer,
} from "./permissions";
import {
  buildGoogleCalendarEventUrl,
  buildGoogleCalendarIcsUrl,
  buildGoogleCalendarSubscribeUrl,
  generateGoogleCalendarEventId,
} from "./googleCalendarIds";
import { assertValidEventTimeRange } from "./eventTimeRange";

function getLegacyAttendeeIds(event: Record<string, unknown>): string[] {
  const legacy = (event as { attendees?: unknown }).attendees;
  if (!Array.isArray(legacy)) return [];
  return legacy.filter((id): id is string => typeof id === "string");
}

function normalizeEventCode(eventCode?: string): string | undefined {
  if (typeof eventCode !== "string") return undefined;
  const normalized = eventCode.trim().toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
}

function canonicalizeEventCode(eventCode?: string): string | undefined {
  const normalized = normalizeEventCode(eventCode);
  if (!normalized) return undefined;
  const canonical = normalized.replace(/[^A-Z0-9]/g, "");
  return canonical.length > 0 ? canonical : undefined;
}

function stripAuthFields<T extends { logtoId?: unknown; authToken?: unknown }>(
  data: T,
): Omit<T, "logtoId" | "authToken"> {
  const { logtoId, authToken, ...rest } = data;
  void logtoId;
  void authToken;
  return rest;
}

function removeUndefinedFields<T extends Record<string, unknown>>(data: T): Partial<T> {
  const cleanedData: Partial<T> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleanedData[key as keyof T] = value as T[keyof T];
    }
  }
  return cleanedData;
}

function eventMatchesCode(
  event: { _id: string; eventCode?: string },
  normalizedInputCode: string,
  canonicalInputCode?: string,
): boolean {
  const candidateCode = normalizeEventCode(event.eventCode);
  if (candidateCode && candidateCode === normalizedInputCode) {
    return true;
  }

  if (canonicalInputCode) {
    const candidateCanonicalCode = canonicalizeEventCode(event.eventCode);
    if (candidateCanonicalCode && candidateCanonicalCode === canonicalInputCode) {
      return true;
    }
  }

  // Some legacy rows displayed this fallback code without persisting eventCode.
  if (!candidateCode) {
    const generatedCode = normalizeEventCode(`EVENT-${event._id.slice(-6)}`);
    if (generatedCode && generatedCode === normalizedInputCode) {
      return true;
    }
  }

  return false;
}

function isEventCurrentlyActive(event: {
  published?: boolean;
  startDate: number;
  endDate: number;
}) {
  const now = Date.now();
  return Boolean(event.published) && event.startDate <= now && event.endDate >= now;
}

function getPublicCalendarMeta(eventId: string) {
  const publicCalendarId = process.env.PUBLIC_GOOGLE_CALENDAR_ID;
  if (!publicCalendarId) {
    return {
      publicGoogleEventId: null,
      publicGoogleEventUrl: null,
      publicGoogleCalendarId: null,
      publicGoogleCalendarSubscribeUrl: null,
      publicGoogleCalendarIcsUrl: null,
    };
  }

  const publicGoogleEventId = generateGoogleCalendarEventId("published", eventId);
  return {
    publicGoogleEventId,
    publicGoogleEventUrl: buildGoogleCalendarEventUrl(publicGoogleEventId, publicCalendarId),
    publicGoogleCalendarId: publicCalendarId,
    publicGoogleCalendarSubscribeUrl: buildGoogleCalendarSubscribeUrl(publicCalendarId),
    publicGoogleCalendarIcsUrl: buildGoogleCalendarIcsUrl(publicCalendarId),
  };
}

function getPrivateCalendarMeta(eventType: "published" | "internal", eventId: string) {
  const privateCalendarId = process.env.PRIVATE_GOOGLE_CALENDAR_ID;
  if (!privateCalendarId) {
    return {
      privateGoogleEventId: null,
      privateGoogleEventUrl: null,
      privateGoogleCalendarId: null,
      privateGoogleCalendarSubscribeUrl: null,
      privateGoogleCalendarIcsUrl: null,
    };
  }

  const privateGoogleEventId = generateGoogleCalendarEventId(eventType, eventId);
  return {
    privateGoogleEventId,
    privateGoogleEventUrl: buildGoogleCalendarEventUrl(privateGoogleEventId, privateCalendarId),
    privateGoogleCalendarId: privateCalendarId,
    privateGoogleCalendarSubscribeUrl: buildGoogleCalendarSubscribeUrl(privateCalendarId),
    privateGoogleCalendarIcsUrl: buildGoogleCalendarIcsUrl(privateCalendarId),
  };
}

async function enqueuePublishedEventGoogleCalendarDeletion(
  ctx: MutationCtx,
  eventId: string,
  reason: "event_unpublished" | "event_deleted",
) {
  const googleEventId = generateGoogleCalendarEventId("published", eventId);
  const createdAt = Date.now();

  await Promise.all([
    ctx.db.insert("googleCalendarDeletionQueue", {
      calendar: "private",
      googleEventId,
      reason,
      sourceTable: "events",
      sourceId: eventId,
      createdAt,
    }),
    ctx.db.insert("googleCalendarDeletionQueue", {
      calendar: "public",
      googleEventId,
      reason,
      sourceTable: "events",
      sourceId: eventId,
      createdAt,
    }),
  ]);
}

// ── Queries ──────────────────────────────────────────────────────────────────

export const listPublished = query({
  args: {},
  handler: async (ctx) => {
    // Public read path: no authentication required for published event listings.
    const events = await ctx.db
      .query("events")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();

    return await Promise.all(
      events.map(async (event) => {
        const attendees = await ctx.db
          .query("attendees")
          .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
          .collect();
        const legacyAttendeeIds = getLegacyAttendeeIds(event as Record<string, unknown>);
        const attendeeCount = new Set([
          ...attendees.map((attendee) => attendee.userId),
          ...legacyAttendeeIds,
        ]).size;

        return {
          ...event,
          attendeeCount,
          ...getPublicCalendarMeta(event._id),
        };
      }),
    );
  },
});

export const listMine = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    return await ctx.db
      .query("events")
      .withIndex("by_requestedUser", (q) => q.eq("requestedUser", userId))
      .collect();
  },
});

export const listAll = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const events = await ctx.db.query("events").collect();

    const attendeesByEvent = new Map<
      string,
      Array<{
        userId: string;
        timeCheckedIn: number;
        food: string;
        pointsEarned: number;
      }>
    >();
    const allAttendeeUserIds = new Set<string>();

    await Promise.all(
      events.map(async (event) => {
        const attendeeDocs = await ctx.db
          .query("attendees")
          .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
          .collect();

        attendeesByEvent.set(
          event._id,
          attendeeDocs.map((attendee) => {
            allAttendeeUserIds.add(attendee.userId);
            return attendee;
          }),
        );
      }),
    );

    // Collect unique requestedUser IDs for submitter lookup
    const uniqueUserIds = [
      ...new Set(
        events
          .map((e) => e.requestedUser)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    for (const userId of allAttendeeUserIds) {
      uniqueUserIds.push(userId);
    }
    const userNameMap = new Map<string, string>();
    const userEmailMap = new Map<string, string>();

    await Promise.all(
      [...new Set(uniqueUserIds)].map(async (userId) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_logtoId", (q) => q.eq("logtoId", userId))
          .first();
        if (user) {
          userNameMap.set(userId, user.name || user.email || userId);
          userEmailMap.set(userId, user.email || "");
        }
      }),
    );

    return await Promise.all(
      events.map(async (event) => {
        const attendeeDocs = attendeesByEvent.get(event._id) ?? [];
        const legacyAttendeeIds = getLegacyAttendeeIds(event as Record<string, unknown>);

        const attendeeByUserId = new Map<
          string,
          {
            userId: string;
            name: string;
            email: string;
            timeCheckedIn: number;
            food: string;
            pointsEarned: number;
          }
        >();

        for (const attendee of attendeeDocs) {
          attendeeByUserId.set(attendee.userId, {
            userId: attendee.userId,
            name: userNameMap.get(attendee.userId) || attendee.userId,
            email: userEmailMap.get(attendee.userId) || "",
            timeCheckedIn: attendee.timeCheckedIn,
            food: attendee.food,
            pointsEarned: attendee.pointsEarned,
          });
        }

        if (attendeeByUserId.size === 0 && legacyAttendeeIds.length > 0) {
          await Promise.all(
            [...new Set(legacyAttendeeIds)].map(async (userId) => {
              attendeeByUserId.set(userId, {
                userId,
                name: userNameMap.get(userId) || userId,
                email: userEmailMap.get(userId) || "",
                timeCheckedIn: 0,
                food: "unknown",
                pointsEarned: 0,
              });
            }),
          );
        }

        const enrichedAttendees = [...attendeeByUserId.values()];

        return {
          ...event,
          submitterName: event.requestedUser
            ? userNameMap.get(event.requestedUser) || event.requestedUser
            : undefined,
          attendeeCount: enrichedAttendees.length,
          attendees: enrichedAttendees.sort(
            (a, b) => b.timeCheckedIn - a.timeCheckedIn
          ),
          ...(event.published ? getPublicCalendarMeta(event._id) : {}),
          ...getPrivateCalendarMeta("published", event._id),
        };
      })
    );
  },
});

export const getByCode = query({
  args: { logtoId: v.string(), authToken: v.string(), eventCode: v.string() },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const normalizedCode = normalizeEventCode(args.eventCode);
    if (!normalizedCode) return null;
    const canonicalCode = canonicalizeEventCode(normalizedCode);

    let event = await ctx.db
      .query("events")
      .withIndex("by_eventCode", (q) => q.eq("eventCode", normalizedCode))
      .first();

    if (!event) {
      const allEvents = await ctx.db.query("events").collect();
      event =
        allEvents.find((candidate) =>
          eventMatchesCode(
            { _id: candidate._id as string, eventCode: candidate.eventCode },
            normalizedCode,
            canonicalCode,
          ),
        ) ?? null;
    }

    return event;
  },
});

export const get = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("events"),
  },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx, args.logtoId, args.authToken);
    return await ctx.db.get(args.id);
  },
});

export const getAttendedEventIds = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";

    const attendees = await ctx.db
      .query("attendees")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const legacyEvents = await ctx.db.query("events").collect();

    return [
      ...new Set([
        ...attendees.map((attendee) => attendee.eventId),
        ...legacyEvents
          .filter((event) =>
            getLegacyAttendeeIds(event as Record<string, unknown>).includes(userId),
          )
          .map((event) => event._id),
      ]),
    ];
  },
});

// ── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    eventName: v.string(),
    eventDescription: v.string(),
    eventCode: v.optional(v.string()),
    location: v.string(),
    pointsToReward: v.optional(v.number()),
    startDate: v.number(),
    endDate: v.number(),
    eventType: v.optional(
      v.union(
        v.literal("social"),
        v.literal("technical"),
        v.literal("outreach"),
        v.literal("professional"),
        v.literal("projects"),
        v.literal("other"),
      ),
    ),
    hasFood: v.optional(v.boolean()),
    published: v.optional(v.boolean()),
    // Request workflow fields
    department: v.optional(
      v.union(
        v.literal("events"),
        v.literal("projects"),
        v.literal("internal"),
        v.literal("other"),
      ),
    ),
    flyersNeeded: v.optional(v.boolean()),
    flyerType: v.optional(v.array(v.string())),
    otherFlyerType: v.optional(v.string()),
    flyerAdvertisingStartDate: v.optional(v.number()),
    flyerAdditionalRequests: v.optional(v.string()),
    flyersCompleted: v.optional(v.boolean()),
    photographyNeeded: v.optional(v.boolean()),
    requiredLogos: v.optional(v.array(v.string())),
    otherLogos: v.optional(v.array(v.string())),
    advertisingFormat: v.optional(v.string()),
    additionalSpecifications: v.optional(v.string()),
    graphicsUploadNote: v.optional(v.string()),
    willOrHaveRoomBooking: v.optional(v.boolean()),
    expectedAttendance: v.optional(v.number()),
    roomBookingFiles: v.optional(v.array(v.string())),
    asFundingRequired: v.optional(v.boolean()),
    foodDrinksBeingServed: v.optional(v.boolean()),
    invoices: v.optional(
      v.array(
        v.object({
          id: v.string(),
          vendor: v.string(),
          items: v.array(
            v.object({
              description: v.string(),
              quantity: v.number(),
              unitPrice: v.number(),
              total: v.number(),
            }),
          ),
          tax: v.number(),
          tip: v.number(),
          invoiceFile: v.optional(v.string()),
          additionalFiles: v.array(v.string()),
          subtotal: v.number(),
          total: v.number(),
        }),
      ),
    ),
    needsGraphics: v.optional(v.boolean()),
    needsAsFunding: v.optional(v.boolean()),
    isDraft: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    const { isDraft, eventCode, ...data } = stripAuthFields(args);
    const normalizedEventCode = normalizeEventCode(eventCode);

    assertValidEventTimeRange(data.startDate, data.endDate);

    return await ctx.db.insert("events", {
      ...data,
      ...(normalizedEventCode ? { eventCode: normalizedEventCode } : {}),
      status: isDraft ? "draft" : (data.published ? "approved" : "submitted"),
      requestedUser: userId,
      flyersCompleted: data.flyersCompleted ?? false,
      isDraft: isDraft ?? false,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("events"),
    eventName: v.optional(v.string()),
    eventDescription: v.optional(v.string()),
    eventCode: v.optional(v.string()),
    location: v.optional(v.string()),
    pointsToReward: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    eventType: v.optional(
      v.union(
        v.literal("social"),
        v.literal("technical"),
        v.literal("outreach"),
        v.literal("professional"),
        v.literal("projects"),
        v.literal("other"),
      ),
    ),
    hasFood: v.optional(v.boolean()),
    published: v.optional(v.boolean()),
    // Request workflow fields
    department: v.optional(
      v.union(
        v.literal("events"),
        v.literal("projects"),
        v.literal("internal"),
        v.literal("other"),
      ),
    ),
    flyersNeeded: v.optional(v.boolean()),
    flyerType: v.optional(v.array(v.string())),
    otherFlyerType: v.optional(v.string()),
    flyerAdvertisingStartDate: v.optional(v.number()),
    flyerAdditionalRequests: v.optional(v.string()),
    flyersCompleted: v.optional(v.boolean()),
    photographyNeeded: v.optional(v.boolean()),
    requiredLogos: v.optional(v.array(v.string())),
    otherLogos: v.optional(v.array(v.string())),
    advertisingFormat: v.optional(v.string()),
    additionalSpecifications: v.optional(v.string()),
    graphicsUploadNote: v.optional(v.string()),
    willOrHaveRoomBooking: v.optional(v.boolean()),
    expectedAttendance: v.optional(v.number()),
    roomBookingFiles: v.optional(v.array(v.string())),
    asFundingRequired: v.optional(v.boolean()),
    foodDrinksBeingServed: v.optional(v.boolean()),
    invoices: v.optional(
      v.array(
        v.object({
          id: v.string(),
          vendor: v.string(),
          items: v.array(
            v.object({
              description: v.string(),
              quantity: v.number(),
              unitPrice: v.number(),
              total: v.number(),
            }),
          ),
          tax: v.number(),
          tip: v.number(),
          invoiceFile: v.optional(v.string()),
          additionalFiles: v.array(v.string()),
          subtotal: v.number(),
          total: v.number(),
        }),
      ),
    ),
    needsGraphics: v.optional(v.boolean()),
    needsAsFunding: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";

    const event = await ctx.db.get(args.id);
    if (!event) throw new Error("Event not found");

    // Admins, Executive Officers, and General Officers can edit any event
    const canEditAnyEvent = hasOfficerAccess(user.role);
    if (!canEditAnyEvent) {
      // Non-admin users can only edit their own events
      if (event.requestedUser && event.requestedUser !== userId) {
        throw new Error("You can only edit your own events");
      }
      // Non-admin users can only edit events in editable statuses
      const editableStatuses = ["draft", "submitted", "pending", "needs_review"];
      if (event.status && !editableStatuses.includes(event.status)) {
        throw new Error("Cannot edit an event that has already been approved or declined");
      }
    }

    const { id, ...updates } = args;
    const cleanUpdates = removeUndefinedFields(stripAuthFields(updates));

    const nextStartDate = cleanUpdates.startDate ?? event.startDate;
    const nextEndDate = cleanUpdates.endDate ?? event.endDate;
    if (
      cleanUpdates.startDate !== undefined ||
      cleanUpdates.endDate !== undefined ||
      cleanUpdates.published === true
    ) {
      assertValidEventTimeRange(nextStartDate, nextEndDate);
    }

    if (typeof cleanUpdates.eventCode === "string") {
      const normalized = normalizeEventCode(cleanUpdates.eventCode);
      if (normalized) {
        cleanUpdates.eventCode = normalized;
      } else {
        delete cleanUpdates.eventCode;
      }
    }

    const shouldQueueCalendarDeletion =
      Boolean(event.published) && cleanUpdates.published === false;

    await ctx.db.patch(id, cleanUpdates);

    if (shouldQueueCalendarDeletion) {
      await enqueuePublishedEventGoogleCalendarDeletion(ctx, id, "event_unpublished");
    }

    return id;
  },
});

export const remove = mutation({
  args: { logtoId: v.string(), authToken: v.string(), id: v.id("events") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";

    const event = await ctx.db.get(args.id);
    if (!event) throw new Error("Event not found");

    // Admins and Executive Officers can delete any event
    if (hasAdminAccess(user.role)) {
      await ctx.db.delete(args.id);
      if (event.published) {
        await enqueuePublishedEventGoogleCalendarDeletion(ctx, args.id, "event_deleted");
      }
      return args.id;
    }

    // Non-admin users can only delete their own events if not approved
    if (event.requestedUser && event.requestedUser !== userId) {
      throw new Error("You can only delete your own events");
    }
    const deletableStatuses = ["draft", "submitted", "pending", "needs_review"];
    if (event.status && !deletableStatuses.includes(event.status)) {
      throw new Error("Cannot delete an event that has already been approved or declined");
    }

    await ctx.db.delete(args.id);
    if (event.published) {
      await enqueuePublishedEventGoogleCalendarDeletion(ctx, args.id, "event_deleted");
    }
    return args.id;
  },
});

export const updateStatus = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("events"),
    status: v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("pending"),
      v.literal("completed"),
      v.literal("approved"),
      v.literal("declined"),
      v.literal("needs_review"),
    ),
    declinedReason: v.optional(v.string()),
    reviewFeedback: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const event = await ctx.db.get(args.id);
    if (!event) throw new Error("Event not found");

    const userId = user.logtoId ?? user.authUserId ?? "";
    const canSubmitOwnDraft =
      args.status === "submitted" &&
      event.status === "draft" &&
      (event.requestedUser === userId || isGeneralOfficer(user.role));

    if (!hasAdminAccess(user.role) && !canSubmitOwnDraft) {
      throw new Error("Only admins can change this status");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      isDraft: args.status === "submitted" ? false : event.isDraft,
      ...(args.declinedReason && { declinedReason: args.declinedReason }),
      ...(args.reviewFeedback && { reviewFeedback: args.reviewFeedback }),
    });
    return args.id;
  },
});

export const generateUploadUrl = mutation({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx, args.logtoId, args.authToken);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getStorageUrl = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx, args.logtoId, args.authToken);
    return await ctx.storage.getUrl(args.storageId as any);
  },
});

export const checkIn = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    eventId: v.optional(v.id("events")),
    eventCode: v.string(),
    food: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const normalizedInputCode = normalizeEventCode(args.eventCode);
    const canonicalInputCode = canonicalizeEventCode(args.eventCode);

    if (!normalizedInputCode) {
      throw new ConvexError("Invalid event code. Please check the code and try again.");
    }

    let event = null;

    if (args.eventId) {
      const selectedEvent = await ctx.db.get(args.eventId);
      if (!selectedEvent) {
        throw new ConvexError("Event not found.");
      }

      const matchesSelectedEvent = eventMatchesCode(
        { _id: selectedEvent._id as string, eventCode: selectedEvent.eventCode },
        normalizedInputCode,
        canonicalInputCode,
      );

      if (!matchesSelectedEvent) {
        throw new ConvexError("Incorrect event code for this event.");
      }

      event = selectedEvent;
    } else {
      // Look up event by normalized code via index first.
      event = await ctx.db
        .query("events")
        .withIndex("by_eventCode", (q) => q.eq("eventCode", normalizedInputCode))
        .first();

      if (!event) {
        // Backward-compat fallback for legacy events with mixed formatting.
        const allEvents = await ctx.db.query("events").collect();
        event =
          allEvents.find((candidate) =>
            eventMatchesCode(
              { _id: candidate._id as string, eventCode: candidate.eventCode },
              normalizedInputCode,
              canonicalInputCode,
            ),
          ) ?? null;
      }
    }

    if (!event) {
      throw new ConvexError("Invalid event code. Please check the code and try again.");
    }

    if (!event.published) {
      throw new ConvexError("This event is not currently published for check-in.");
    }

    if (!isEventCurrentlyActive(event)) {
      if (Date.now() < event.startDate) {
        throw new ConvexError("This event has not started yet.");
      }
      throw new ConvexError("This event has already ended.");
    }

    // Check if already checked in
    const userId = user.logtoId ?? user.authUserId ?? "";
    const existing = await ctx.db
      .query("attendees")
      .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (existing) {
      throw new ConvexError("You have already checked in to this event.");
    }

    const legacyAttendeeIds = getLegacyAttendeeIds(event as Record<string, unknown>);
    if (legacyAttendeeIds.includes(userId)) {
      throw new ConvexError("You have already checked in to this event.");
    }

    await ctx.db.insert("attendees", {
      eventId: event._id,
      userId,
      timeCheckedIn: Date.now(),
      food: args.food || "none",
      pointsEarned: event.pointsToReward ?? 0,
    });

    // Update user points and events attended
    const pts = event.pointsToReward ?? 0;
    await ctx.db.patch(user._id, {
      points: (user.points || 0) + pts,
      eventsAttended: (user.eventsAttended || 0) + 1,
    });

    return { points: pts };
  },
});
