import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  applyEarnedPoints,
  applyOfficerAward,
  applySpendableDeduction,
  applySpendableRefund,
  getUserPointTotals,
} from "./helpers";
import type { PointLedgerCategory } from "./types";

type LedgerInsertArgs = {
  userId: Id<"users">;
  spendableAmount: number;
  lifetimeAmount?: number;
  category: PointLedgerCategory;
  sourceType: string;
  sourceId: string;
  publicDescription: string;
  privateNote?: string;
  actorUserId?: Id<"users">;
  actorLabel?: string;
  idempotencyKey: string;
  reversesLedgerEntryId?: Id<"pointLedger">;
};

async function findExistingLedgerEntry(
  ctx: MutationCtx,
  idempotencyKey: string,
) {
  return ctx.db
    .query("pointLedger")
    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
    .first();
}

async function insertLedgerEntry(ctx: MutationCtx, args: LedgerInsertArgs) {
  const existing = await findExistingLedgerEntry(ctx, args.idempotencyKey);
  if (existing) {
    return existing._id;
  }

  return ctx.db.insert("pointLedger", {
    userId: args.userId,
    spendableAmount: args.spendableAmount,
    lifetimeAmount: args.lifetimeAmount,
    category: args.category,
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    publicDescription: args.publicDescription,
    privateNote: args.privateNote,
    actorUserId: args.actorUserId,
    actorLabel: args.actorLabel ?? "system",
    timestamp: Date.now(),
    reversesLedgerEntryId: args.reversesLedgerEntryId,
    idempotencyKey: args.idempotencyKey,
  });
}

async function patchUserTotals(
  ctx: MutationCtx,
  userId: Id<"users">,
  totals: ReturnType<typeof getUserPointTotals>,
) {
  await ctx.db.patch(userId, {
    lifetimePointsEarned: totals.lifetimePointsEarned,
    spendablePoints: totals.spendablePoints,
    pendingPointCorrection: totals.pendingPointCorrection,
    points: totals.lifetimePointsEarned,
  });

  const publicProfile = await ctx.db
    .query("publicProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();

  if (publicProfile) {
    await ctx.db.patch(publicProfile._id, {
      points: totals.lifetimePointsEarned,
    });
  }
}

export async function awardEventAttendancePoints(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    amount: number;
    eventId: Id<"events">;
    eventName: string;
    idempotencyKey: string;
    actorUserId?: Id<"users">;
  },
) {
  const user = await ctx.db.get(args.userId);
  if (!user) throw new Error("User not found");

  const existing = await findExistingLedgerEntry(ctx, args.idempotencyKey);
  if (existing) {
    return getUserPointTotals(user);
  }

  const current = getUserPointTotals(user);
  const next = applyEarnedPoints(current, args.amount);

  await patchUserTotals(ctx, args.userId, next);
  await insertLedgerEntry(ctx, {
    userId: args.userId,
    spendableAmount: next.spendableDelta,
    lifetimeAmount: next.lifetimeDelta,
    category: "event_attendance_award",
    sourceType: "event",
    sourceId: args.eventId,
    publicDescription: `Attended ${args.eventName}`,
    actorUserId: args.actorUserId,
    idempotencyKey: args.idempotencyKey,
  });

  if (next.pendingRepaid > 0) {
    await insertLedgerEntry(ctx, {
      userId: args.userId,
      spendableAmount: next.pendingRepaid,
      category: "pending_correction_repayment",
      sourceType: "event",
      sourceId: args.eventId,
      publicDescription: "Pending point correction repaid from event earnings",
      actorUserId: args.actorUserId,
      idempotencyKey: `${args.idempotencyKey}:repayment`,
    });
  }

  return next;
}

export async function reverseAttendanceAward(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    amount: number;
    eventId: Id<"events">;
    eventName: string;
    reason: string;
    idempotencyKey: string;
    actorUserId: Id<"users">;
    originalLedgerEntryId?: Id<"pointLedger">;
  },
) {
  const user = await ctx.db.get(args.userId);
  if (!user) throw new Error("User not found");

  const existing = await findExistingLedgerEntry(ctx, args.idempotencyKey);
  if (existing) {
    return getUserPointTotals(user);
  }

  const current = getUserPointTotals(user);
  const lifetimePointsEarned = Math.max(0, current.lifetimePointsEarned - args.amount);
  const spendableDeduction = Math.min(current.spendablePoints, args.amount);
  const spendablePoints = current.spendablePoints - spendableDeduction;
  const remainder = args.amount - spendableDeduction;
  const pendingPointCorrection = current.pendingPointCorrection + remainder;

  const next = {
    lifetimePointsEarned,
    spendablePoints,
    pendingPointCorrection,
  };

  await patchUserTotals(ctx, args.userId, next);
  await insertLedgerEntry(ctx, {
    userId: args.userId,
    spendableAmount: -spendableDeduction,
    lifetimeAmount: -args.amount,
    category: "attendance_reversal",
    sourceType: "event",
    sourceId: args.eventId,
    publicDescription: `Attendance reversal for ${args.eventName}`,
    privateNote: args.reason,
    actorUserId: args.actorUserId,
    idempotencyKey: args.idempotencyKey,
    reversesLedgerEntryId: args.originalLedgerEntryId,
  });

  return next;
}

export async function adjustPointsByOfficer(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    amount: number;
    affectsLifetime: boolean;
    reason: string;
    idempotencyKey: string;
    actorUserId: Id<"users">;
  },
) {
  const user = await ctx.db.get(args.userId);
  if (!user) throw new Error("User not found");

  const existing = await findExistingLedgerEntry(ctx, args.idempotencyKey);
  if (existing) {
    return getUserPointTotals(user);
  }

  const current = getUserPointTotals(user);
  const isAward = args.amount > 0;
  const absAmount = Math.abs(args.amount);

  let next: ReturnType<typeof getUserPointTotals>;
  let category: PointLedgerCategory;
  let spendableAmount: number;
  let lifetimeAmount: number | undefined;

  if (isAward) {
    const awarded = applyOfficerAward(current, absAmount, args.affectsLifetime);
    next = awarded;
    category = "officer_award";
    spendableAmount = awarded.spendableDelta;
    lifetimeAmount = awarded.lifetimeDelta || undefined;
  } else {
    const deducted = applySpendableDeduction(current, absAmount);
    next = deducted;
    category = "officer_correction";
    spendableAmount = deducted.spendableDelta;
    lifetimeAmount = args.affectsLifetime ? -absAmount : undefined;
    if (args.affectsLifetime) {
      next = {
        ...next,
        lifetimePointsEarned: Math.max(0, current.lifetimePointsEarned - absAmount),
      };
    }
  }

  await patchUserTotals(ctx, args.userId, next);
  await insertLedgerEntry(ctx, {
    userId: args.userId,
    spendableAmount,
    lifetimeAmount,
    category,
    sourceType: "officer_adjustment",
    sourceId: args.actorUserId,
    publicDescription: isAward
      ? `Officer award: ${args.reason}`
      : `Officer correction: ${args.reason}`,
    privateNote: args.reason,
    actorUserId: args.actorUserId,
    idempotencyKey: args.idempotencyKey,
  });

  return next;
}

export async function deductMerchandisePoints(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    amount: number;
    orderId: string;
    description: string;
    idempotencyKey: string;
  },
) {
  const user = await ctx.db.get(args.userId);
  if (!user) throw new Error("User not found");

  const existing = await findExistingLedgerEntry(ctx, args.idempotencyKey);
  if (existing) {
    return getUserPointTotals(user);
  }

  const current = getUserPointTotals(user);
  if (current.spendablePoints < args.amount) {
    throw new Error("Insufficient spendable points");
  }

  const next = {
    lifetimePointsEarned: current.lifetimePointsEarned,
    spendablePoints: current.spendablePoints - args.amount,
    pendingPointCorrection: current.pendingPointCorrection,
  };

  await patchUserTotals(ctx, args.userId, next);
  await insertLedgerEntry(ctx, {
    userId: args.userId,
    spendableAmount: -args.amount,
    category: "merchandise_purchase",
    sourceType: "merch_order",
    sourceId: args.orderId,
    publicDescription: args.description,
    idempotencyKey: args.idempotencyKey,
  });

  return next;
}

export async function refundMerchandisePoints(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    amount: number;
    orderId: string;
    description: string;
    idempotencyKey: string;
    actorUserId?: Id<"users">;
  },
) {
  const user = await ctx.db.get(args.userId);
  if (!user) throw new Error("User not found");

  const existing = await findExistingLedgerEntry(ctx, args.idempotencyKey);
  if (existing) {
    return getUserPointTotals(user);
  }

  const current = getUserPointTotals(user);
  const next = applySpendableRefund(current, args.amount);

  await patchUserTotals(ctx, args.userId, next);
  await insertLedgerEntry(ctx, {
    userId: args.userId,
    spendableAmount: args.amount,
    category: "merchandise_refund",
    sourceType: "merch_order",
    sourceId: args.orderId,
    publicDescription: args.description,
    actorUserId: args.actorUserId,
    idempotencyKey: args.idempotencyKey,
  });

  return next;
}

export async function migrateUserOpeningBalance(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    idempotencyKey: string;
  },
) {
  const user = await ctx.db.get(args.userId);
  if (!user) throw new Error("User not found");

  if (user.lifetimePointsEarned !== undefined) {
    return getUserPointTotals(user);
  }

  const existing = await findExistingLedgerEntry(ctx, args.idempotencyKey);
  if (existing) {
    return getUserPointTotals(user);
  }

  const legacyPoints = user.points ?? 0;
  const totals = {
    lifetimePointsEarned: legacyPoints,
    spendablePoints: legacyPoints,
    pendingPointCorrection: 0,
  };

  await patchUserTotals(ctx, args.userId, totals);
  if (legacyPoints > 0) {
    await insertLedgerEntry(ctx, {
      userId: args.userId,
      spendableAmount: legacyPoints,
      lifetimeAmount: legacyPoints,
      category: "opening_balance_migration",
      sourceType: "migration",
      sourceId: args.userId,
      publicDescription: "Opening balance from legacy points total",
      actorLabel: "system",
      idempotencyKey: args.idempotencyKey,
    });
  } else {
    await ctx.db.patch(args.userId, {
      lifetimePointsEarned: 0,
      spendablePoints: 0,
      pendingPointCorrection: 0,
    });
  }

  return totals;
}
