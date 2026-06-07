import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { internalMutation } from "../_generated/server";
import { generateScheduleWindows } from "./pickupHelpers";

async function upsertScheduleWindow(
  ctx: MutationCtx,
  schedule: Doc<"merchPickupSchedules">,
  window: {
    windowStart: number;
    windowEnd: number;
    instructions: string;
    capacity?: number;
    cutoffAt: number;
  },
) {
  const existing = await ctx.db
    .query("merchPickupOptions")
    .withIndex("by_scheduleId", (q) => q.eq("scheduleId", schedule._id))
    .collect();

  const duplicate = existing.find((option) => option.windowStart === window.windowStart);
  if (duplicate) return duplicate._id;

  const now = Date.now();
  return ctx.db.insert("merchPickupOptions", {
    type: "project_space",
    scheduleId: schedule._id,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    instructions: window.instructions,
    capacity: window.capacity,
    cutoffAt: window.cutoffAt,
    status: "active",
    orderCount: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export const generateRollingWindows = internalMutation({
  args: {},
  handler: async (ctx) => {
    const schedules = await ctx.db
      .query("merchPickupSchedules")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    let created = 0;
    for (const schedule of schedules) {
      const windows = generateScheduleWindows(
        schedule,
        schedule.visibilityWeeks,
        Date.now(),
      );
      for (const window of windows) {
        const before = await ctx.db
          .query("merchPickupOptions")
          .withIndex("by_scheduleId", (q) => q.eq("scheduleId", schedule._id))
          .collect();
        const exists = before.some((option) => option.windowStart === window.windowStart);
        if (exists) continue;

        await upsertScheduleWindow(ctx, schedule, window);
        created += 1;
      }
    }

    return { created };
  },
});

export const processClosedPickups = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const activeOptions = await ctx.db
      .query("merchPickupOptions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    let closed = 0;
    for (const option of activeOptions) {
      const pastCutoff = now >= option.cutoffAt;
      const pastWindow = now >= option.windowEnd;
      if (!pastCutoff && !pastWindow) continue;

      await ctx.db.patch(option._id, {
        status: "closed",
        updatedAt: now,
      });
      closed += 1;

      if (option.type === "event" && option.eventId) {
        const event = await ctx.db.get(option.eventId);
        if (event?.merchPickupEnabled) {
          await ctx.db.patch(option.eventId, {
            merchPickupEnabled: false,
          });
        }
      }
    }

    return { closed };
  },
});
