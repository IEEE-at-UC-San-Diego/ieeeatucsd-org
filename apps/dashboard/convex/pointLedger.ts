import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  adjustPointsByOfficer,
  reverseAttendanceAward,
} from "./points/service";
import { getUserPointTotals as readTotals } from "./points/helpers";
import {
  requireAdminAccess,
  requireCurrentUser,
  requireOfficerAccess,
} from "./permissions";

export const getMyLedger = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const entries = await ctx.db
      .query("pointLedger")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return {
      totals: readTotals(user),
      entries: entries.map((entry) => ({
        _id: entry._id,
        spendableAmount: entry.spendableAmount,
        lifetimeAmount: entry.lifetimeAmount,
        category: entry.category,
        publicDescription: entry.publicDescription,
        timestamp: entry.timestamp,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
      })),
    };
  },
});

export const getUserLedgerForOfficer = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");

    const entries = await ctx.db
      .query("pointLedger")
      .withIndex("by_userId_timestamp", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return {
      user: {
        _id: target._id,
        name: target.name,
        email: target.email,
      },
      totals: readTotals(target),
      entries,
    };
  },
});

export const adjustUserPoints = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    userId: v.id("users"),
    amount: v.number(),
    affectsLifetime: v.boolean(),
    reason: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    if (!args.reason.trim()) {
      throw new Error("A reason is required for point adjustments");
    }
    if (args.amount === 0) {
      throw new Error("Adjustment amount cannot be zero");
    }

    return adjustPointsByOfficer(ctx, {
      userId: args.userId,
      amount: args.amount,
      affectsLifetime: args.affectsLifetime,
      reason: args.reason.trim(),
      idempotencyKey: args.idempotencyKey,
      actorUserId: actor._id,
    });
  },
});

export const reverseEventAttendance = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    userId: v.id("users"),
    eventId: v.id("events"),
    amount: v.number(),
    reason: v.string(),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");
    if (!args.reason.trim()) {
      throw new Error("A reason is required for attendance reversals");
    }

    return reverseAttendanceAward(ctx, {
      userId: args.userId,
      amount: args.amount,
      eventId: args.eventId,
      eventName: event.eventName,
      reason: args.reason.trim(),
      idempotencyKey: args.idempotencyKey,
      actorUserId: actor._id,
    });
  },
});

export const migrateAllUsers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let migrated = 0;

    for (const user of users) {
      if (user.lifetimePointsEarned !== undefined) continue;
      const { migrateUserOpeningBalance } = await import("./points/service");
      await migrateUserOpeningBalance(ctx, {
        userId: user._id,
        idempotencyKey: `migration:opening-balance:${user._id}`,
      });
      migrated += 1;
    }

    return { migrated };
  },
});

export const runMigration = mutation({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const users = await ctx.db.query("users").collect();
    let migrated = 0;

    const { migrateUserOpeningBalance } = await import("./points/service");
    for (const user of users) {
      if (user.lifetimePointsEarned !== undefined) continue;
      await migrateUserOpeningBalance(ctx, {
        userId: user._id,
        idempotencyKey: `migration:opening-balance:${user._id}`,
      });
      migrated += 1;
    }

    return { migrated };
  },
});

export { getUserPointTotals } from "./points/helpers";
