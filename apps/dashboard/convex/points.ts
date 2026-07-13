import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  appendPointLedgerEntry,
  getPointAccount,
  getPointAccountSnapshot,
  type PointAccountSnapshot,
} from "./lib/pointsLedger";
import { requireAdminAccess, requireCurrentUser } from "./permissions";

const MEMBER_SEARCH_LIMIT = 20;
const MAX_MEMBER_SEARCH_LIMIT = 50;

async function requireActivePointsManager(
  ctx: Parameters<typeof requireAdminAccess>[0],
  logtoId: string,
  authToken: string,
) {
  const actor = await requireAdminAccess(ctx, logtoId, authToken);
  if (!actor.signedUp || actor.status !== "active") {
    throw new Error("An active, fully onboarded account is required");
  }
  return actor;
}

const SAFE_SOURCE_LABELS: Record<string, string> = {
  event: "Event reward",
  legacy_user_balance: "Opening balance",
  manager_adjustment: "Account adjustment",
  merch_order: "Merch order",
  order: "Merch order",
};

export function toMemberLedgerEntry(entry: Doc<"pointLedgerEntries">) {
  return {
    kind: entry.kind,
    balanceDelta: entry.balanceDelta,
    lifetimeDelta: entry.lifetimeDelta,
    balanceAfter: entry.balanceAfter,
    lifetimeEarnedAfter: entry.lifetimeEarnedAfter,
    reason: entry.reason,
    createdAt: entry.createdAt,
    source: SAFE_SOURCE_LABELS[entry.sourceType] ?? "Account activity",
  };
}

export function memberMatchesSearch(
  user: Pick<Doc<"users">, "name" | "email" | "role">,
  queryText: string,
) {
  if (user.role === "Sponsor") return false;
  const normalizedQuery = queryText.trim().toLocaleLowerCase();
  if (!normalizedQuery) return true;
  return `${user.name}\n${user.email}`
    .toLocaleLowerCase()
    .includes(normalizedQuery);
}

export function toManagerMemberSearchResult(
  user: Pick<Doc<"users">, "_id" | "name" | "email">,
  totals: PointAccountSnapshot,
) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    balance: totals.balance,
    lifetimeEarned: totals.lifetimeEarned,
  };
}

export const getMyAccount = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const account = await getPointAccount(ctx, user._id);
    const totals = account ?? (await getPointAccountSnapshot(ctx, user._id));
    return {
      balance: totals.balance,
      lifetimeEarned: totals.lifetimeEarned,
      initialized: Boolean(account),
      updatedAt: account?.updatedAt,
    };
  },
});

export const listMyLedger = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const result = await ctx.db
      .query("pointLedgerEntries")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map(toMemberLedgerEntry),
    };
  },
});

export const searchMembersForManager = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireActivePointsManager(ctx, args.logtoId, args.authToken);
    const limit = args.limit ?? MEMBER_SEARCH_LIMIT;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_MEMBER_SEARCH_LIMIT) {
      throw new Error(`Search limit must be an integer from 1 to ${MAX_MEMBER_SEARCH_LIMIT}`);
    }
    if (args.query.length > 200) {
      throw new Error("Member search query cannot exceed 200 characters");
    }

    const users = (await ctx.db.query("users").collect())
      .filter((user) => memberMatchesSearch(user, args.query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);

    return await Promise.all(
      users.map(async (user) => {
        const totals = await getPointAccountSnapshot(ctx, user._id);
        return toManagerMemberSearchResult(user, totals);
      }),
    );
  },
});

export const getAccountForManager = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireActivePointsManager(ctx, args.logtoId, args.authToken);
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    const account = await getPointAccount(ctx, args.userId);
    const totals = account ?? (await getPointAccountSnapshot(ctx, args.userId));
    return {
      user: { _id: user._id, name: user.name, email: user.email },
      balance: totals.balance,
      lifetimeEarned: totals.lifetimeEarned,
      initialized: Boolean(account),
      updatedAt: account?.updatedAt,
    };
  },
});

export const adjust = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    userId: v.id("users"),
    amount: v.number(),
    mode: v.union(v.literal("correction"), v.literal("spendable_only")),
    reason: v.string(),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireActivePointsManager(ctx, args.logtoId, args.authToken);
    if (!Number.isSafeInteger(args.amount) || args.amount === 0) {
      throw new Error("Adjustment amount must be a non-zero safe integer");
    }
    const reason = args.reason.trim();
    if (reason.length < 3 || reason.length > 500) {
      throw new Error("Adjustment reason must be between 3 and 500 characters");
    }
    const requestId = args.requestId.trim();
    if (requestId.length < 8 || requestId.length > 200) {
      throw new Error("Adjustment request ID must be between 8 and 200 characters");
    }
    if (!(await ctx.db.get(args.userId))) {
      throw new Error("User not found");
    }

    const entry = await appendPointLedgerEntry(ctx, {
      userId: args.userId,
      balanceDelta: args.amount,
      lifetimeDelta: args.mode === "correction" ? args.amount : 0,
      kind:
        args.mode === "correction" ? "correction" : "spendable_adjustment",
      sourceType: "manager_adjustment",
      sourceId: requestId,
      idempotencyKey: `adjustment:${requestId}`,
      actorId: actor._id,
      reason,
    });

    return {
      entryId: entry._id,
      balance: entry.balanceAfter,
      lifetimeEarned: entry.lifetimeEarnedAfter,
    };
  },
});

/** Read-only, page-by-page account/ledger reconciliation for operations. */
export const reconcile = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireActivePointsManager(ctx, args.logtoId, args.authToken);
    const usersPage = await ctx.db.query("users").paginate(args.paginationOpts);
    const results = await Promise.all(
      usersPage.page.map(async (user) => {
        const [account, entries] = await Promise.all([
          getPointAccount(ctx, user._id),
          ctx.db
            .query("pointLedgerEntries")
            .withIndex("by_user_createdAt", (q) => q.eq("userId", user._id))
            .collect(),
        ]);
        const ledgerBalance = entries.reduce(
          (total, entry) => total + entry.balanceDelta,
          0,
        );
        const ledgerLifetime = entries.reduce(
          (total, entry) => total + entry.lifetimeDelta,
          0,
        );
        const legacyBalance = user.points ?? 0;
        const legacyLifetime = user.lifetimePointsEarned ?? legacyBalance;
        const matches = Boolean(
          account &&
            account.balance === ledgerBalance &&
            account.lifetimeEarned === ledgerLifetime &&
            legacyBalance === account.balance &&
            legacyLifetime === account.lifetimeEarned,
        );
        return {
          userId: user._id,
          name: user.name,
          initialized: Boolean(account),
          entryCount: entries.length,
          accountBalance: account?.balance,
          accountLifetimeEarned: account?.lifetimeEarned,
          ledgerBalance,
          ledgerLifetimeEarned: ledgerLifetime,
          legacyBalance,
          legacyLifetimeEarned: legacyLifetime,
          matches,
        };
      }),
    );

    return {
      ...usersPage,
      page: results,
      mismatchCount: results.filter((result) => !result.matches).length,
    };
  },
});
