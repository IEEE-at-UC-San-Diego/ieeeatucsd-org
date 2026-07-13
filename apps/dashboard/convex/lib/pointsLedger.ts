import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type PointLedgerKind = Doc<"pointLedgerEntries">["kind"];

export type PointAccountSnapshot = {
  balance: number;
  lifetimeEarned: number;
};

type AppendPointEntryArgs = {
  userId: Id<"users">;
  balanceDelta: number;
  lifetimeDelta: number;
  kind: PointLedgerKind;
  sourceType: string;
  sourceId?: string;
  idempotencyKey: string;
  actorId?: Id<"users">;
  reason?: string;
  reversalOf?: Id<"pointLedgerEntries">;
  createdAt?: number;
};

export function assertValidPointReversal(
  original: {
    balanceDelta: number;
    lifetimeDelta: number;
    kind: PointLedgerKind;
    sourceType: string;
    sourceId?: string;
  },
  reversal: Pick<
    AppendPointEntryArgs,
    "balanceDelta" | "lifetimeDelta" | "kind" | "sourceType" | "sourceId"
  >,
) {
  if (
    reversal.balanceDelta !== -original.balanceDelta ||
    reversal.lifetimeDelta !== -original.lifetimeDelta
  ) {
    throw new Error("Point reversal must exactly negate the original entry");
  }
  if (
    reversal.kind === "refund" &&
    (original.kind !== "purchase" ||
      original.sourceType !== "merch_order" ||
      reversal.sourceType !== "merch_order" ||
      reversal.sourceId !== original.sourceId)
  ) {
    throw new Error("A merch refund must reverse the purchase for the same order");
  }
}

const OPENING_BALANCE_VERSION = 1;

export function normalizeLegacyPointValue(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(Math.trunc(value), Number.MAX_SAFE_INTEGER);
}

export function computeNextPointBalances(
  current: PointAccountSnapshot,
  balanceDelta: number,
  lifetimeDelta: number,
): PointAccountSnapshot {
  if (!Number.isSafeInteger(balanceDelta) || !Number.isSafeInteger(lifetimeDelta)) {
    throw new Error("Point deltas must be safe integers");
  }

  const balance = current.balance + balanceDelta;
  const lifetimeEarned = current.lifetimeEarned + lifetimeDelta;
  if (!Number.isSafeInteger(balance) || !Number.isSafeInteger(lifetimeEarned)) {
    throw new Error("Resulting point totals must be safe integers");
  }
  if (balance < 0) {
    throw new Error("Point balance cannot be negative");
  }
  if (lifetimeEarned < 0) {
    throw new Error("Lifetime-earned points cannot be negative");
  }

  return { balance, lifetimeEarned };
}

export function openingBalanceIdempotencyKey(userId: Id<"users">): string {
  return `opening:${userId}:v${OPENING_BALANCE_VERSION}`;
}

export async function getPointAccount(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("pointAccounts")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function getPointAccountSnapshot(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<PointAccountSnapshot> {
  const account = await getPointAccount(ctx, userId);
  if (account) {
    return {
      balance: account.balance,
      lifetimeEarned: account.lifetimeEarned,
    };
  }

  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  const balance = normalizeLegacyPointValue(user.points);
  return {
    balance,
    lifetimeEarned: Math.max(
      balance,
      normalizeLegacyPointValue(user.lifetimePointsEarned),
    ),
  };
}

async function syncLifetimePublicProfile(
  ctx: MutationCtx,
  userId: Id<"users">,
  lifetimeEarned: number,
) {
  const profile = await ctx.db
    .query("publicProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  if (profile) {
    await ctx.db.patch(profile._id, { points: lifetimeEarned });
  }
}

/**
 * Lazily creates the account and its single opening entry from legacy totals.
 * Calling this from every point mutation closes the migration/check-in race.
 */
export async function ensurePointAccount(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const existingAccount = await getPointAccount(ctx, userId);
  if (existingAccount) return existingAccount;

  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");

  const idempotencyKey = openingBalanceIdempotencyKey(userId);
  const existingOpening = await ctx.db
    .query("pointLedgerEntries")
    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
    .unique();

  const now = Date.now();
  const legacyBalance = normalizeLegacyPointValue(user.points);
  const legacyLifetime = Math.max(
    legacyBalance,
    normalizeLegacyPointValue(user.lifetimePointsEarned),
  );
  const balance = existingOpening?.balanceAfter ?? legacyBalance;
  const lifetimeEarned = existingOpening?.lifetimeEarnedAfter ?? legacyLifetime;

  const accountId = await ctx.db.insert("pointAccounts", {
    userId,
    balance,
    lifetimeEarned,
    initializedAt: existingOpening?.createdAt ?? now,
    updatedAt: now,
  });

  if (!existingOpening) {
    await ctx.db.insert("pointLedgerEntries", {
      userId,
      balanceDelta: balance,
      lifetimeDelta: lifetimeEarned,
      balanceAfter: balance,
      lifetimeEarnedAfter: lifetimeEarned,
      kind: "opening_balance",
      sourceType: "legacy_user_balance",
      sourceId: userId,
      idempotencyKey,
      reason: "Opening balance migrated from users.points",
      createdAt: now,
    });
  } else if (existingOpening.userId !== userId) {
    throw new Error("Opening-balance idempotency key belongs to another user");
  }

  await ctx.db.patch(userId, {
    points: balance,
    lifetimePointsEarned: lifetimeEarned,
  });
  await syncLifetimePublicProfile(ctx, userId, lifetimeEarned);

  const account = await ctx.db.get(accountId);
  if (!account) throw new Error("Failed to initialize point account");
  return account;
}

function assertMatchingRetry(
  existing: Doc<"pointLedgerEntries">,
  args: AppendPointEntryArgs,
) {
  if (
    existing.userId !== args.userId ||
    existing.balanceDelta !== args.balanceDelta ||
    existing.lifetimeDelta !== args.lifetimeDelta ||
    existing.kind !== args.kind ||
    existing.sourceType !== args.sourceType ||
    existing.sourceId !== args.sourceId ||
    existing.reversalOf !== args.reversalOf ||
    existing.actorId !== args.actorId ||
    existing.reason !== (args.reason?.trim() || undefined)
  ) {
    throw new Error("Idempotency key was already used for a different point entry");
  }
}

/** Append one immutable entry and update every compatibility/read model atomically. */
export async function appendPointLedgerEntry(
  ctx: MutationCtx,
  args: AppendPointEntryArgs,
) {
  if (!args.idempotencyKey.trim()) {
    throw new Error("A point entry idempotency key is required");
  }
  if (!args.sourceType.trim()) {
    throw new Error("A point entry source type is required");
  }

  const existing = await ctx.db
    .query("pointLedgerEntries")
    .withIndex("by_idempotencyKey", (q) =>
      q.eq("idempotencyKey", args.idempotencyKey),
    )
    .unique();
  if (existing) {
    assertMatchingRetry(existing, args);
    return existing;
  }

  const account = await ensurePointAccount(ctx, args.userId);
  const next = computeNextPointBalances(
    account,
    args.balanceDelta,
    args.lifetimeDelta,
  );

  if (args.reversalOf) {
    const original = await ctx.db.get(args.reversalOf);
    if (!original || original.userId !== args.userId) {
      throw new Error("Point entry to reverse was not found for this user");
    }
    assertValidPointReversal(original, args);
    const priorReversal = await ctx.db
      .query("pointLedgerEntries")
      .withIndex("by_reversalOf", (q) => q.eq("reversalOf", args.reversalOf))
      .first();
    if (priorReversal) {
      throw new Error("Point entry has already been reversed");
    }
  }

  const createdAt = args.createdAt ?? Date.now();
  const entryId = await ctx.db.insert("pointLedgerEntries", {
    userId: args.userId,
    balanceDelta: args.balanceDelta,
    lifetimeDelta: args.lifetimeDelta,
    balanceAfter: next.balance,
    lifetimeEarnedAfter: next.lifetimeEarned,
    kind: args.kind,
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    idempotencyKey: args.idempotencyKey,
    actorId: args.actorId,
    reason: args.reason?.trim() || undefined,
    reversalOf: args.reversalOf,
    createdAt,
  });

  await ctx.db.patch(account._id, {
    balance: next.balance,
    lifetimeEarned: next.lifetimeEarned,
    updatedAt: createdAt,
  });
  await ctx.db.patch(args.userId, {
    points: next.balance,
    lifetimePointsEarned: next.lifetimeEarned,
  });
  await syncLifetimePublicProfile(ctx, args.userId, next.lifetimeEarned);

  const entry = await ctx.db.get(entryId);
  if (!entry) throw new Error("Failed to append point ledger entry");
  return entry;
}
