import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, query } from "../_generated/server";
import {
  DEFAULT_MAILBOX_MIGRATION_PAGE_SIZE,
  canonicalMailbox,
  nextMailboxMigrationPhase,
  patchMailboxPage,
  scanMailboxPage,
} from "../mailboxClaim";
import { requireCurrentUser } from "../permissions";

const MIGRATION_NAME = "lowercaseIeeeEmails";

type MigrationCtx = QueryCtx | MutationCtx;

async function stateRow(ctx: MigrationCtx) {
  return await ctx.db
    .query("mailboxMigrationState")
    .withIndex("by_name", (q) => q.eq("name", MIGRATION_NAME))
    .unique();
}

export async function readMailboxGate(ctx: MigrationCtx, ieeeEmail: string) {
  const state = await stateRow(ctx);
  const done = state?.phase === "done";
  const canon = canonicalMailbox(ieeeEmail);
  if (!canon) return { done, collision: false };
  const collision = await ctx.db
    .query("mailboxCollisions")
    .withIndex("by_canon", (q) => q.eq("canon", canon))
    .unique();
  return { done, collision: collision !== null };
}

export const getMailboxMigrationGate = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    ieeeEmail: v.string(),
  },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx, args.logtoId, args.authToken);
    return await readMailboxGate(ctx, args.ieeeEmail);
  },
});

async function noteHolder(ctx: MutationCtx, userId: string, canon: string) {
  const existing = await ctx.db
    .query("mailboxCanonHolders")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (existing) {
    if (existing.canon !== canon) await ctx.db.patch(existing._id, { canon });
    return;
  }
  await ctx.db.insert("mailboxCanonHolders", { userId, canon });
}

async function countCanon(ctx: MutationCtx, canon: string) {
  const holders = await ctx.db
    .query("mailboxCanonHolders")
    .withIndex("by_canon", (q) => q.eq("canon", canon))
    .collect();
  return holders.length;
}

async function recordCollision(ctx: MutationCtx, canon: string) {
  const existing = await ctx.db
    .query("mailboxCollisions")
    .withIndex("by_canon", (q) => q.eq("canon", canon))
    .unique();
  if (!existing) await ctx.db.insert("mailboxCollisions", { canon });
}

/**
 * Lowercase legacy ieeeEmail values so by_ieeeEmail matches the canonical mailbox.
 * Pages through users, then patches, and records done only after the last page.
 * Addresses shared by two or more rows are left unchanged and recorded as collisions.
 *
 *   pnpm exec convex run migrations/lowercaseIeeeEmails:lowercaseIeeeEmails '{}'
 */
export const lowercaseIeeeEmails = internalMutation({
  args: {
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let state = await stateRow(ctx);
    if (state?.phase === "done") return { done: true, phase: "done" as const };
    if (!state) {
      const id = await ctx.db.insert("mailboxMigrationState", {
        name: MIGRATION_NAME,
        phase: "scan",
        pageSize: args.pageSize ?? DEFAULT_MAILBOX_MIGRATION_PAGE_SIZE,
      });
      state = await ctx.db.get(id);
    }
    if (!state || state.phase === "done") {
      return { done: true, phase: "done" as const };
    }

    const pageSize =
      state.pageSize ?? args.pageSize ?? DEFAULT_MAILBOX_MIGRATION_PAGE_SIZE;
    const phase = state.phase;
    const page = await ctx.db.query("users").paginate({
      numItems: pageSize,
      cursor: state.cursor ?? null,
    });
    const rows = page.page.map((user) => ({
      id: user._id,
      ieeeEmail: user.ieeeEmail,
    }));

    if (phase === "scan") {
      for (const note of scanMailboxPage(rows)) {
        await noteHolder(ctx, note.userId, note.canon);
      }
    } else {
      const canons = new Set<string>();
      for (const row of rows) {
        if (!row.ieeeEmail) continue;
        const canon = canonicalMailbox(row.ieeeEmail);
        if (canon) canons.add(canon);
      }
      const counts = new Map<string, number>();
      for (const canon of canons) {
        counts.set(canon, await countCanon(ctx, canon));
      }
      const planned = patchMailboxPage(
        rows,
        (canon) => counts.get(canon) ?? 0,
      );
      for (const canon of planned.collisions) {
        await recordCollision(ctx, canon);
      }
      for (const change of planned.patches) {
        const match = page.page.find((user) => user._id === change.id);
        if (!match) continue;
        await ctx.db.patch(match._id, { ieeeEmail: change.ieeeEmail });
      }
    }

    const step = nextMailboxMigrationPhase(phase, page.isDone);
    await ctx.db.patch(state._id, {
      phase: step.phase,
      cursor: page.isDone ? undefined : page.continueCursor,
      pageSize,
    });
    if (!step.recordDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.lowercaseIeeeEmails.lowercaseIeeeEmails,
        {},
      );
    }
    return { done: step.recordDone, phase: step.phase };
  },
});
