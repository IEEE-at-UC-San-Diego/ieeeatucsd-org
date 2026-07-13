import { describe, expect, it } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import {
  memberMatchesSearch,
  toManagerMemberSearchResult,
  toMemberLedgerEntry,
} from "./points";

function ledgerEntry(
  overrides: Partial<Doc<"pointLedgerEntries">> = {},
): Doc<"pointLedgerEntries"> {
  return {
    _id: "ledger_1" as Id<"pointLedgerEntries">,
    _creationTime: 100,
    userId: "user_1" as Id<"users">,
    balanceDelta: 10,
    lifetimeDelta: 10,
    balanceAfter: 25,
    lifetimeEarnedAfter: 25,
    kind: "event_reward",
    sourceType: "event",
    sourceId: "private_event_id",
    idempotencyKey: "private-idempotency-key",
    actorId: "actor_1" as Id<"users">,
    reversalOf: "ledger_0" as Id<"pointLedgerEntries">,
    reason: "Attended a workshop",
    createdAt: 200,
    ...overrides,
  };
}

describe("member-safe point projections", () => {
  it("returns only display-safe ledger fields", () => {
    const projection = toMemberLedgerEntry(ledgerEntry());

    expect(projection).toEqual({
      kind: "event_reward",
      balanceDelta: 10,
      lifetimeDelta: 10,
      balanceAfter: 25,
      lifetimeEarnedAfter: 25,
      reason: "Attended a workshop",
      createdAt: 200,
      source: "Event reward",
    });
    expect(projection).not.toHaveProperty("_id");
    expect(projection).not.toHaveProperty("userId");
    expect(projection).not.toHaveProperty("actorId");
    expect(projection).not.toHaveProperty("reversalOf");
    expect(projection).not.toHaveProperty("sourceId");
    expect(projection).not.toHaveProperty("idempotencyKey");
  });

  it("does not expose an unknown internal source type", () => {
    const projection = toMemberLedgerEntry(
      ledgerEntry({ sourceType: "future_internal_worker" }),
    );
    expect(projection.source).toBe("Account activity");
    expect(JSON.stringify(projection)).not.toContain("future_internal_worker");
  });
});

describe("manager member search matching", () => {
  const member = {
    name: "Ada Lovelace",
    email: "ada@ucsd.edu",
    role: "Member" as const,
  };

  it("matches names and email addresses case-insensitively", () => {
    expect(memberMatchesSearch(member, "  LOVELACE ")).toBe(true);
    expect(memberMatchesSearch(member, "ADA@UCSD")).toBe(true);
    expect(memberMatchesSearch(member, "grace")).toBe(false);
  });

  it("allows an empty manager query but excludes sponsors", () => {
    expect(memberMatchesSearch(member, "   ")).toBe(true);
    expect(
      memberMatchesSearch(
        { name: "Sponsor", email: "contact@company.com", role: "Sponsor" },
        "sponsor",
      ),
    ).toBe(false);
  });

  it("projects only identity and current point totals", () => {
    const result = toManagerMemberSearchResult(
      {
        _id: "user_1" as Id<"users">,
        name: member.name,
        email: member.email,
      },
      { balance: 12, lifetimeEarned: 30 },
    );

    expect(result).toEqual({
      _id: "user_1",
      name: "Ada Lovelace",
      email: "ada@ucsd.edu",
      balance: 12,
      lifetimeEarned: 30,
    });
    expect(result).not.toHaveProperty("role");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("pid");
    expect(result).not.toHaveProperty("points");
  });
});
