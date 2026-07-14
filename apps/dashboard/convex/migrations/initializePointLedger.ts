import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import {
  ensurePointAccount,
  getPointAccount,
  normalizeLegacyPointValue,
} from "../lib/pointsLedger";

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;

function batchSize(requested?: number) {
  if (requested === undefined) return DEFAULT_BATCH_SIZE;
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > MAX_BATCH_SIZE) {
    throw new Error(`numItems must be an integer from 1 to ${MAX_BATCH_SIZE}`);
  }
  return requested;
}

/**
 * Resumable, idempotent migration.
 *
 * bunx convex run migrations/initializePointLedger:initializeBatch
 *   '{"cursor":null,"numItems":100}'
 */
export const initializeBatch = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("users").paginate({
      cursor: args.cursor ?? null,
      numItems: batchSize(args.numItems),
    });

    let initialized = 0;
    let alreadyInitialized = 0;
    let balanceTotal = 0;
    let lifetimeEarnedTotal = 0;

    for (const user of page.page) {
      const existing = await getPointAccount(ctx, user._id);
      const account = existing ?? (await ensurePointAccount(ctx, user._id));
      if (existing) alreadyInitialized += 1;
      else initialized += 1;
      balanceTotal += account.balance;
      lifetimeEarnedTotal += account.lifetimeEarned;
    }

    return {
      processed: page.page.length,
      initialized,
      alreadyInitialized,
      balanceTotal,
      lifetimeEarnedTotal,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/** Read-only resumable audit suitable for pre/post-migration rollout checks. */
export const reconcileBatch = internalQuery({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("users").paginate({
      cursor: args.cursor ?? null,
      numItems: batchSize(args.numItems),
    });
    const rows = await Promise.all(
      page.page.map(async (user) => {
        const [account, entries] = await Promise.all([
          getPointAccount(ctx, user._id),
          ctx.db
            .query("pointLedgerEntries")
            .withIndex("by_user_createdAt", (q) => q.eq("userId", user._id))
            .collect(),
        ]);
        const ledgerBalance = entries.reduce(
          (sum, entry) => sum + entry.balanceDelta,
          0,
        );
        const ledgerLifetime = entries.reduce(
          (sum, entry) => sum + entry.lifetimeDelta,
          0,
        );
        const safeLegacyBalance = normalizeLegacyPointValue(user.points);
        const safeLegacyLifetime = Math.max(
          safeLegacyBalance,
          normalizeLegacyPointValue(user.lifetimePointsEarned),
        );
        const matches = Boolean(
          account &&
            entries.length > 0 &&
            account.balance === ledgerBalance &&
            account.lifetimeEarned === ledgerLifetime &&
            user.points === account.balance &&
            user.lifetimePointsEarned === account.lifetimeEarned,
        );
        return {
          userId: user._id,
          initialized: Boolean(account),
          entryCount: entries.length,
          legacyBalance: safeLegacyBalance,
          legacyLifetimeEarned: safeLegacyLifetime,
          accountBalance: account?.balance,
          accountLifetimeEarned: account?.lifetimeEarned,
          ledgerBalance,
          ledgerLifetimeEarned: ledgerLifetime,
          matches,
        };
      }),
    );

    return {
      processed: rows.length,
      initialized: rows.filter((row) => row.initialized).length,
      mismatchCount: rows.filter((row) => !row.matches).length,
      balanceTotal: rows.reduce((sum, row) => sum + row.ledgerBalance, 0),
      lifetimeEarnedTotal: rows.reduce(
        (sum, row) => sum + row.ledgerLifetimeEarned,
        0,
      ),
      rows: rows.filter((row) => !row.matches),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});
