import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  appendPointLedgerEntry,
  computeNextPointBalances,
  ensurePointAccount,
  normalizeLegacyPointValue,
  openingBalanceIdempotencyKey,
} from "./pointsLedger";

type Stored = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
};

function testContext(legacyPoints?: number) {
  let sequence = 0;
  const tables = new Map<string, Stored[]>();
  const userId = "user_1" as Id<"users">;
  tables.set("users", [
    {
      _id: userId,
      _creationTime: 1,
      email: "member@example.com",
      emailVisibility: true,
      verified: true,
      name: "Member",
      signedUp: true,
      requestedEmail: false,
      role: "Member",
      status: "active",
      joinDate: 1,
      points: legacyPoints,
    },
  ]);

  const db = {
    get: async (id: string) => {
      for (const rows of tables.values()) {
        const found = rows.find((row) => row._id === id);
        if (found) return found;
      }
      return null;
    },
    insert: async (table: string, value: Record<string, unknown>) => {
      const id = `${table}_${++sequence}`;
      const row = { ...value, _id: id, _creationTime: Date.now() };
      tables.set(table, [...(tables.get(table) ?? []), row]);
      return id;
    },
    patch: async (id: string, value: Record<string, unknown>) => {
      for (const rows of tables.values()) {
        const row = rows.find((candidate) => candidate._id === id);
        if (row) {
          Object.assign(row, value);
          return;
        }
      }
      throw new Error(`Missing row ${id}`);
    },
    query: (table: string) => {
      let conditions: Array<[string, unknown]> = [];
      const rows = () =>
        (tables.get(table) ?? []).filter((row) =>
          conditions.every(([field, value]) => row[field] === value),
        );
      const builder = {
        withIndex: (
          _index: string,
          apply: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
        ) => {
          apply({
            eq: (field, value) => {
              conditions = [...conditions, [field, value]];
              return builder;
            },
          });
          return builder;
        },
        unique: async () => {
          const found = rows();
          if (found.length > 1) throw new Error("not unique");
          return found[0] ?? null;
        },
        first: async () => rows()[0] ?? null,
        collect: async () => rows(),
      };
      return builder;
    },
  };

  return {
    ctx: { db } as unknown as MutationCtx,
    userId,
    rows: (table: string) => tables.get(table) ?? [],
  };
}

describe("points ledger invariants", () => {
  it("normalizes missing, negative, fractional, and unsafe legacy values", () => {
    expect(normalizeLegacyPointValue(undefined)).toBe(0);
    expect(normalizeLegacyPointValue(-10)).toBe(0);
    expect(normalizeLegacyPointValue(4.9)).toBe(4);
    expect(normalizeLegacyPointValue(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeLegacyPointValue(Number.MAX_VALUE)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it("initializes an opening balance once and safely repairs negative legacy points", async () => {
    const fixture = testContext(-20);
    const first = await ensurePointAccount(fixture.ctx, fixture.userId);
    const second = await ensurePointAccount(fixture.ctx, fixture.userId);

    expect(second._id).toBe(first._id);
    expect(first.balance).toBe(0);
    expect(first.lifetimeEarned).toBe(0);
    expect(fixture.rows("pointAccounts")).toHaveLength(1);
    expect(fixture.rows("pointLedgerEntries")).toMatchObject([
      {
        balanceDelta: 0,
        lifetimeDelta: 0,
        kind: "opening_balance",
        idempotencyKey: openingBalanceIdempotencyKey(fixture.userId),
      },
    ]);
    expect(fixture.rows("users")[0]).toMatchObject({
      points: 0,
      lifetimePointsEarned: 0,
    });
  });

  it("returns the same event reward entry on an identical retry", async () => {
    const fixture = testContext(10);
    const reward = {
      userId: fixture.userId,
      balanceDelta: 5,
      lifetimeDelta: 5,
      kind: "event_reward" as const,
      sourceType: "event",
      sourceId: "event_1",
      idempotencyKey: `event:event_1:user:${fixture.userId}`,
    };
    const first = await appendPointLedgerEntry(fixture.ctx, reward);
    const retry = await appendPointLedgerEntry(fixture.ctx, reward);

    expect(retry._id).toBe(first._id);
    expect(fixture.rows("pointLedgerEntries")).toHaveLength(2);
    expect(fixture.rows("pointAccounts")[0]).toMatchObject({
      balance: 15,
      lifetimeEarned: 15,
    });
  });

  it("rejects idempotency-key reuse with a different financial payload", async () => {
    const fixture = testContext(10);
    const reward = {
      userId: fixture.userId,
      balanceDelta: 5,
      lifetimeDelta: 5,
      kind: "event_reward" as const,
      sourceType: "event",
      sourceId: "event_1",
      idempotencyKey: "same-request",
    };
    await appendPointLedgerEntry(fixture.ctx, reward);

    await expect(
      appendPointLedgerEntry(fixture.ctx, { ...reward, balanceDelta: 6 }),
    ).rejects.toThrow("different point entry");
    expect(fixture.rows("pointLedgerEntries")).toHaveLength(2);
  });

  it("rejects a debit that would make the spendable balance negative", async () => {
    const fixture = testContext(3);
    await expect(
      appendPointLedgerEntry(fixture.ctx, {
        userId: fixture.userId,
        balanceDelta: -4,
        lifetimeDelta: 0,
        kind: "purchase",
        sourceType: "merch_order",
        sourceId: "order_1",
        idempotencyKey: "order:order_1:purchase",
      }),
    ).rejects.toThrow("cannot be negative");
    expect(fixture.rows("pointLedgerEntries")).toHaveLength(1);
    expect(fixture.rows("pointAccounts")[0]).toMatchObject({ balance: 3 });
  });

  it("requires safe-integer deltas and totals", () => {
    expect(() => computeNextPointBalances({ balance: 1, lifetimeEarned: 1 }, 0.5, 0)).toThrow(
      "safe integers",
    );
    expect(() =>
      computeNextPointBalances(
        { balance: Number.MAX_SAFE_INTEGER, lifetimeEarned: 1 },
        1,
        0,
      ),
    ).toThrow("totals must be safe integers");
  });
});
