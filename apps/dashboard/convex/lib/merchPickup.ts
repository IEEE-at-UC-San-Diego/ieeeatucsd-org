import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { isAtCapacity } from "./merchValidation";

export type PickupChoice =
  | { type: "event"; pickupEventId: Id<"merchPickupEvents"> }
  | { type: "slot"; pickupSlotId: Id<"merchPickupSlots"> };

export async function resolvePickup(
  ctx: QueryCtx | MutationCtx,
  choice: PickupChoice,
  options: { requireAvailable: boolean; now?: number },
) {
  const now = options.now ?? Date.now();
  if (choice.type === "event") {
    const pickup = await ctx.db.get(choice.pickupEventId);
    if (!pickup) throw new Error("Pickup event not found");
    const event = await ctx.db.get(pickup.eventId);
    if (!event) throw new Error("Pickup event source no longer exists");
    const cutoffAt = pickup.bookingCutoffAt ?? event.startDate;
    if (
      options.requireAvailable &&
      (!pickup.enabled || !event.published || event.endDate <= now || cutoffAt <= now)
    ) {
      throw new Error("Pickup event is no longer available");
    }
    if (options.requireAvailable && isAtCapacity(pickup.bookedCount, pickup.capacity)) {
      throw new ConvexError({
        code: "PICKUP_FULL",
        pickupType: "event",
        pickupId: pickup._id,
        capacity: pickup.capacity,
        bookedCount: pickup.bookedCount,
      });
    }
    return {
      type: "event" as const,
      pickupEventId: pickup._id,
      snapshot: {
        label: event.eventName,
        address: event.location,
        startAt: event.startDate,
        endAt: event.endDate,
        timezone: "America/Los_Angeles",
        cutoffAt,
      },
      source: pickup,
    };
  }

  const slot = await ctx.db.get(choice.pickupSlotId);
  if (!slot) throw new Error("Pickup slot not found");
  const window = await ctx.db.get(slot.windowId);
  if (!window) throw new Error("Pickup window no longer exists");
  if (options.requireAvailable && (!window.enabled || !slot.enabled || slot.startAt <= now)) {
    throw new Error("Pickup slot is no longer available");
  }
  if (options.requireAvailable && isAtCapacity(slot.bookedCount, slot.capacity)) {
    throw new ConvexError({
      code: "PICKUP_FULL",
      pickupType: "slot",
      pickupId: slot._id,
      capacity: slot.capacity,
      bookedCount: slot.bookedCount,
    });
  }
  return {
    type: "slot" as const,
    pickupSlotId: slot._id,
    snapshot: {
      label: window.displayName,
      address: window.address,
      startAt: slot.startAt,
      endAt: slot.endAt,
      timezone: window.timezone,
      cutoffAt: slot.startAt,
    },
    source: slot,
  };
}

export async function bookPickup(
  ctx: MutationCtx,
  choice: PickupChoice,
  now = Date.now(),
) {
  const resolved = await resolvePickup(ctx, choice, { requireAvailable: true, now });
  await ctx.db.patch(resolved.source._id, {
    bookedCount: resolved.source.bookedCount + 1,
    updatedAt: now,
  });
  return resolved;
}

export async function releasePickup(ctx: MutationCtx, choice: PickupChoice) {
  const source =
    choice.type === "event"
      ? await ctx.db.get(choice.pickupEventId)
      : await ctx.db.get(choice.pickupSlotId);
  if (!source) throw new Error("Pickup capacity record no longer exists");
  if (source.bookedCount <= 0) {
    throw new Error("Pickup capacity accounting is already zero");
  }
  await ctx.db.patch(source._id, {
    bookedCount: source.bookedCount - 1,
    updatedAt: Date.now(),
  });
}
