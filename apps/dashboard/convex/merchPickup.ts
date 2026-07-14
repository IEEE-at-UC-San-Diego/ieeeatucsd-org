import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireMerchManager, requireMerchShopper } from "./lib/merchAuth";
import {
  assertSafeInteger,
  generatePickupSlots,
  isAtCapacity,
  merchFeatureMode,
  requireTrimmed,
} from "./lib/merchValidation";

const authArgs = { logtoId: v.string(), authToken: v.string() };

export const getSettings = query({
  args: authArgs,
  handler: async (ctx, args) => {
    await requireMerchShopper(ctx, args.logtoId, args.authToken);
    const settings = await ctx.db.query("organizationSettings").first();
    return {
      storeEnabled: settings?.merchStoreEnabled ?? false,
      checkoutEnabled: settings?.merchCheckoutEnabled ?? false,
      projectSpaceName: settings?.merchProjectSpaceName ?? "IEEE Project Space",
      projectSpaceAddress: settings?.merchProjectSpaceAddress ?? "EBU1-4710",
      timezone: settings?.merchDefaultTimezone ?? "America/Los_Angeles",
      memberCancellationCutoffMinutes:
        settings?.merchMemberCancellationCutoffMinutes ?? 0,
    };
  },
});

export const updateSettings = mutation({
  args: {
    ...authArgs,
    storeEnabled: v.boolean(),
    checkoutEnabled: v.boolean(),
    projectSpaceName: v.string(),
    projectSpaceAddress: v.string(),
    timezone: v.string(),
    memberCancellationCutoffMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    if (args.checkoutEnabled && !args.storeEnabled) {
      throw new Error("Checkout cannot be enabled while the merch store is disabled");
    }
    assertSafeInteger(
      args.memberCancellationCutoffMinutes,
      "Cancellation cutoff minutes",
      0,
    );
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: args.timezone }).format();
    } catch {
      throw new Error("Timezone is invalid");
    }
    const existing = await ctx.db.query("organizationSettings").first();
    const data = {
      merchStoreEnabled: args.storeEnabled,
      merchCheckoutEnabled: args.checkoutEnabled,
      merchProjectSpaceName: requireTrimmed(args.projectSpaceName, "Project-space name", 160),
      merchProjectSpaceAddress: requireTrimmed(args.projectSpaceAddress, "Project-space address", 300),
      merchDefaultTimezone: args.timezone,
      merchMemberCancellationCutoffMinutes: args.memberCancellationCutoffMinutes,
      updatedBy: manager.logtoId ?? manager.authUserId ?? manager._id,
    };
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return await ctx.db.insert("organizationSettings", data);
  },
});

export const listAvailable = query({
  args: authArgs,
  handler: async (ctx, args) => {
    await requireMerchShopper(ctx, args.logtoId, args.authToken);
    const settings = await ctx.db.query("organizationSettings").first();
    if (merchFeatureMode(settings) === "hidden") return { events: [], slots: [] };
    const now = Date.now();
    const pickupEvents = await ctx.db
      .query("merchPickupEvents")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
    const events = (
      await Promise.all(
        pickupEvents.map(async (pickup) => {
          const event = await ctx.db.get(pickup.eventId);
          const cutoffAt = pickup.bookingCutoffAt ?? event?.startDate ?? 0;
          if (
            !event?.published ||
            event.endDate <= now ||
            cutoffAt <= now ||
            isAtCapacity(pickup.bookedCount, pickup.capacity)
          ) {
            return null;
          }
          return {
            type: "event" as const,
            _id: pickup._id,
            id: pickup._id,
            label: event.eventName,
            name: event.eventName,
            address: event.location,
            location: event.location,
            startAt: event.startDate,
            endAt: event.endDate,
            cutoffAt,
            capacity: pickup.capacity,
            remainingCapacity:
              pickup.capacity === undefined
                ? undefined
                : pickup.capacity - pickup.bookedCount,
          };
        }),
      )
    ).filter((item) => item !== null);

    const slots = await ctx.db
      .query("merchPickupSlots")
      .withIndex("by_enabled_startAt", (q) => q.eq("enabled", true).gt("startAt", now))
      .collect();
    const availableSlots = (
      await Promise.all(
        slots.map(async (slot) => {
          const window = await ctx.db.get(slot.windowId);
          if (!window?.enabled || isAtCapacity(slot.bookedCount, slot.capacity)) return null;
          return {
            type: "slot" as const,
            _id: slot._id,
            id: slot._id,
            windowId: window._id,
            label: window.displayName,
            name: window.displayName,
            address: window.address,
            location: window.address,
            timezone: window.timezone,
            startAt: slot.startAt,
            endAt: slot.endAt,
            capacity: slot.capacity,
            remainingCapacity:
              slot.capacity === undefined ? undefined : slot.capacity - slot.bookedCount,
          };
        }),
      )
    ).filter((item) => item !== null);
    return {
      events: events.sort((a, b) => a.startAt - b.startAt),
      slots: availableSlots.sort((a, b) => a.startAt - b.startAt),
    };
  },
});

export const listForManager = query({
  args: authArgs,
  handler: async (ctx, args) => {
    await requireMerchManager(ctx, args.logtoId, args.authToken);
    const eventMappings = await ctx.db.query("merchPickupEvents").collect();
    const events = await Promise.all(
      eventMappings.map(async (pickup) => ({ ...pickup, event: await ctx.db.get(pickup.eventId) })),
    );
    const windows = await ctx.db.query("merchPickupWindows").collect();
    return {
      events,
      windows: await Promise.all(
        windows.map(async (window) => ({
          ...window,
          slots: await ctx.db
            .query("merchPickupSlots")
            .withIndex("by_window_startAt", (q) => q.eq("windowId", window._id))
            .collect(),
        })),
      ),
    };
  },
});

export const configureEvent = mutation({
  args: {
    ...authArgs,
    eventId: v.id("events"),
    enabled: v.boolean(),
    capacity: v.optional(v.number()),
    bookingCutoffAt: v.optional(v.number()),
    managerNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");
    if (args.capacity !== undefined) assertSafeInteger(args.capacity, "Capacity", 1);
    if (args.bookingCutoffAt !== undefined && args.bookingCutoffAt > event.startDate) {
      throw new Error("Booking cutoff cannot be after the event starts");
    }
    const existing = await ctx.db
      .query("merchPickupEvents")
      .withIndex("by_event", (q) => q.eq("eventId", event._id))
      .unique();
    if (args.enabled && (!event.published || event.endDate <= Date.now())) {
      throw new Error("Only published upcoming events can be enabled for pickup");
    }
    const mappedOrders = existing
      ? (
          await ctx.db
            .query("merchOrders")
            .withIndex("by_pickupEvent", (q) => q.eq("pickupEventId", existing._id))
            .collect()
        )
      : [];
    const pendingOrders = mappedOrders.filter((order) => order.status === "pending");
    const capacityBookings = mappedOrders.filter((order) => order.status !== "canceled");
    if (existing && !args.enabled && pendingOrders.length > 0) {
      throw new Error("Resolve impacted pending orders before disabling this pickup event");
    }
    if (existing && args.capacity !== undefined && args.capacity < capacityBookings.length) {
      throw new Error("Capacity cannot be less than existing bookings");
    }
    const now = Date.now();
    const data = {
      enabled: args.enabled,
      bookedCount: capacityBookings.length,
      capacity: args.capacity,
      bookingCutoffAt: args.bookingCutoffAt,
      managerNotes: args.managerNotes?.trim() || undefined,
      updatedAt: now,
      updatedBy: manager._id,
    };
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return await ctx.db.insert("merchPickupEvents", {
      eventId: event._id,
      createdAt: now,
      createdBy: manager._id,
      ...data,
    });
  },
});

export const createWindow = mutation({
  args: {
    ...authArgs,
    requestId: v.string(),
    displayName: v.string(),
    address: v.string(),
    timezone: v.string(),
    startAt: v.number(),
    endAt: v.number(),
    slotDurationMinutes: v.number(),
    defaultCapacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const requestId = requireTrimmed(args.requestId, "Request ID", 200);
    const existingRequest = await ctx.db
      .query("merchPickupWindows")
      .withIndex("by_requestId", (q) => q.eq("requestId", requestId))
      .unique();
    if (existingRequest) {
      const matches =
        existingRequest.displayName === args.displayName.trim() &&
        existingRequest.address === args.address.trim() &&
        existingRequest.timezone === args.timezone &&
        existingRequest.startAt === args.startAt &&
        existingRequest.endAt === args.endAt &&
        existingRequest.slotDurationMinutes === args.slotDurationMinutes &&
        existingRequest.defaultCapacity === args.defaultCapacity;
      if (!matches) {
        throw new Error("Pickup-window request ID was reused with different details");
      }
      return existingRequest._id;
    }
    if (args.startAt <= Date.now()) throw new Error("Pickup window must start in the future");
    if (args.defaultCapacity !== undefined) {
      assertSafeInteger(args.defaultCapacity, "Default capacity", 1);
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: args.timezone }).format();
    } catch {
      throw new Error("Timezone is invalid");
    }
    const generated = generatePickupSlots(args.startAt, args.endAt, args.slotDurationMinutes);
    const overlaps = await ctx.db
      .query("merchPickupWindows")
      .withIndex("by_startAt", (q) => q.lt("startAt", args.endAt))
      .collect();
    if (overlaps.some((window) => window.enabled && window.endAt > args.startAt)) {
      throw new Error("Pickup window overlaps an existing enabled window");
    }
    const now = Date.now();
    const windowId = await ctx.db.insert("merchPickupWindows", {
      requestId,
      displayName: requireTrimmed(args.displayName, "Window name", 160),
      address: requireTrimmed(args.address, "Window address", 300),
      timezone: args.timezone,
      startAt: args.startAt,
      endAt: args.endAt,
      slotDurationMinutes: args.slotDurationMinutes,
      defaultCapacity: args.defaultCapacity,
      enabled: true,
      createdAt: now,
      createdBy: manager._id,
      updatedAt: now,
      updatedBy: manager._id,
    });
    for (const slot of generated) {
      await ctx.db.insert("merchPickupSlots", {
        windowId,
        ...slot,
        capacity: args.defaultCapacity,
        bookedCount: 0,
        enabled: true,
        createdAt: now,
        updatedAt: now,
        updatedBy: manager._id,
      });
    }
    return windowId;
  },
});

export const updateSlot = mutation({
  args: {
    ...authArgs,
    slotId: v.id("merchPickupSlots"),
    enabled: v.optional(v.boolean()),
    capacity: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const slot = await ctx.db.get(args.slotId);
    if (!slot) throw new Error("Pickup slot not found");
    const capacity = args.capacity === null ? undefined : (args.capacity ?? slot.capacity);
    if (capacity !== undefined) assertSafeInteger(capacity, "Capacity", 1);
    const mappedOrders = (
      await ctx.db
        .query("merchOrders")
        .withIndex("by_pickupSlot", (q) => q.eq("pickupSlotId", slot._id))
        .collect()
    );
    const pendingOrders = mappedOrders.filter((order) => order.status === "pending");
    const capacityBookings = mappedOrders.filter((order) => order.status !== "canceled");
    if (capacity !== undefined && capacity < capacityBookings.length) {
      throw new Error("Capacity cannot be less than existing bookings");
    }
    if (args.enabled === false && pendingOrders.length > 0) {
      throw new Error("Resolve impacted pending orders before disabling this pickup slot");
    }
    await ctx.db.patch(slot._id, {
      capacity,
      bookedCount: capacityBookings.length,
      enabled: args.enabled ?? slot.enabled,
      updatedAt: Date.now(),
      updatedBy: manager._id,
    });
    return slot._id;
  },
});

export const updateWindow = mutation({
  args: {
    ...authArgs,
    windowId: v.id("merchPickupWindows"),
    displayName: v.string(),
    address: v.string(),
    timezone: v.string(),
    startAt: v.number(),
    endAt: v.number(),
    slotDurationMinutes: v.number(),
    defaultCapacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const window = await ctx.db.get(args.windowId);
    if (!window) throw new Error("Pickup window not found");
    const oldSlots = await ctx.db
      .query("merchPickupSlots")
      .withIndex("by_window_startAt", (q) => q.eq("windowId", window._id))
      .collect();
    const impactedGroups = await Promise.all(
      oldSlots.map((slot) =>
        ctx.db
          .query("merchOrders")
          .withIndex("by_pickupSlot", (q) => q.eq("pickupSlotId", slot._id))
          .collect(),
      ),
    );
    if (impactedGroups.flat().length > 0) {
      throw new Error("A window's schedule cannot be regenerated after it has bookings");
    }
    if (args.startAt <= Date.now()) throw new Error("Pickup window must start in the future");
    if (args.defaultCapacity !== undefined) {
      assertSafeInteger(args.defaultCapacity, "Default capacity", 1);
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: args.timezone }).format();
    } catch {
      throw new Error("Timezone is invalid");
    }
    const generated = generatePickupSlots(args.startAt, args.endAt, args.slotDurationMinutes);
    const overlaps = await ctx.db
      .query("merchPickupWindows")
      .withIndex("by_startAt", (q) => q.lt("startAt", args.endAt))
      .collect();
    if (
      overlaps.some(
        (other) =>
          other._id !== window._id && other.enabled && other.endAt > args.startAt,
      )
    ) {
      throw new Error("Pickup window overlaps an existing enabled window");
    }
    const now = Date.now();
    await Promise.all(oldSlots.map((slot) => ctx.db.delete(slot._id)));
    await ctx.db.patch(window._id, {
      displayName: requireTrimmed(args.displayName, "Window name", 160),
      address: requireTrimmed(args.address, "Window address", 300),
      timezone: args.timezone,
      startAt: args.startAt,
      endAt: args.endAt,
      slotDurationMinutes: args.slotDurationMinutes,
      defaultCapacity: args.defaultCapacity,
      updatedAt: now,
      updatedBy: manager._id,
    });
    for (const slot of generated) {
      await ctx.db.insert("merchPickupSlots", {
        windowId: window._id,
        ...slot,
        capacity: args.defaultCapacity,
        bookedCount: 0,
        enabled: window.enabled,
        createdAt: now,
        updatedAt: now,
        updatedBy: manager._id,
      });
    }
    return window._id;
  },
});

export const disableWindow = mutation({
  args: { ...authArgs, windowId: v.id("merchPickupWindows") },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const window = await ctx.db.get(args.windowId);
    if (!window) throw new Error("Pickup window not found");
    const slots = await ctx.db
      .query("merchPickupSlots")
      .withIndex("by_window_startAt", (q) => q.eq("windowId", window._id))
      .collect();
    const impactedGroups = await Promise.all(
      slots.map((slot) =>
        ctx.db
          .query("merchOrders")
          .withIndex("by_pickupSlot", (q) => q.eq("pickupSlotId", slot._id))
          .collect(),
      ),
    );
    if (impactedGroups.flat().some((order) => order.status === "pending")) {
      throw new Error("Resolve impacted pending orders before disabling this pickup window");
    }
    const now = Date.now();
    await ctx.db.patch(window._id, { enabled: false, updatedAt: now, updatedBy: manager._id });
    await Promise.all(
      slots.map((slot) =>
        ctx.db.patch(slot._id, { enabled: false, updatedAt: now, updatedBy: manager._id }),
      ),
    );
  },
});

export const listImpact = query({
  args: {
    ...authArgs,
    pickupEventId: v.optional(v.id("merchPickupEvents")),
    pickupSlotId: v.optional(v.id("merchPickupSlots")),
    windowId: v.optional(v.id("merchPickupWindows")),
  },
  handler: async (ctx, args) => {
    await requireMerchManager(ctx, args.logtoId, args.authToken);
    const selected = [args.pickupEventId, args.pickupSlotId, args.windowId].filter(Boolean);
    if (selected.length !== 1) throw new Error("Select exactly one pickup source");
    let orders;
    if (args.pickupEventId) {
      orders = await ctx.db
        .query("merchOrders")
        .withIndex("by_pickupEvent", (q) => q.eq("pickupEventId", args.pickupEventId))
        .collect();
    } else if (args.pickupSlotId) {
      orders = await ctx.db
        .query("merchOrders")
        .withIndex("by_pickupSlot", (q) => q.eq("pickupSlotId", args.pickupSlotId))
        .collect();
    } else {
      const slots = await ctx.db
        .query("merchPickupSlots")
        .withIndex("by_window_startAt", (q) => q.eq("windowId", args.windowId!))
        .collect();
      const groups = await Promise.all(
        slots.map((slot) =>
          ctx.db
            .query("merchOrders")
            .withIndex("by_pickupSlot", (q) => q.eq("pickupSlotId", slot._id))
            .collect(),
        ),
      );
      orders = groups.flat();
    }
    return orders
      .filter((order) => order.status === "pending")
      .map((order) => ({
        orderId: order._id,
        orderNumber: order.orderNumber,
        memberName: order.ownerName,
        memberEmail: order.ownerEmail,
        pickupSnapshot: order.pickupSnapshot,
      }));
  },
});
