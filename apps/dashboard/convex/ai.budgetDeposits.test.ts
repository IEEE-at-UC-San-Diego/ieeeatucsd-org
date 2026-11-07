import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOfficerAccess = vi.hoisted(() => vi.fn());

vi.mock("./_generated/server", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./_generated/server")>();
  return {
    ...actual,
    query: (definition: unknown) => definition,
  };
});

vi.mock("./permissions", async () => {
  const actual =
    await vi.importActual<typeof import("./permissions")>("./permissions");
  return {
    ...actual,
    requireOfficerAccess,
  };
});

import { getBudgetOverview } from "./ai";

type QueryHandler = {
  handler: (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
};

type DepositRow = {
  depositedBy: string;
  status: "pending" | "rejected" | "verified";
  amount: number;
  source: string;
};

type FieldRef = { kind: "field"; name: string };
type FilterExpr = { kind: "eq"; left: unknown; right: unknown };
type IndexEq = { field: string; value: unknown };

function asQuery(value: unknown): QueryHandler {
  return value as QueryHandler;
}

function isFieldRef(value: unknown): value is FieldRef {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === "field"
  );
}

function readOperand(operand: unknown, row: DepositRow): unknown {
  if (isFieldRef(operand)) {
    return row[operand.name as keyof DepositRow];
  }
  return operand;
}

/**
 * Convex applies `.filter()` before `.take(n)`, so non-matching rows do not
 * consume the cap. This fake does the same: index range, then filter, then
 * the first n of what remains.
 */
function queryRows(rows: DepositRow[]) {
  let matched = rows.slice();

  const chain = {
    withIndex(
      _indexName: string,
      range: (q: { eq: (field: string, value: unknown) => IndexEq }) => IndexEq,
    ) {
      const eq = range({
        eq(field: string, value: unknown) {
          return { field, value };
        },
      });
      matched = matched.filter(
        (row) => row[eq.field as keyof DepositRow] === eq.value,
      );
      return chain;
    },
    filter(predicate: (q: {
      field: (name: string) => FieldRef;
      eq: (left: unknown, right: unknown) => FilterExpr;
    }) => FilterExpr) {
      const expr = predicate({
        field(name: string) {
          return { kind: "field", name };
        },
        eq(left: unknown, right: unknown) {
          return { kind: "eq", left, right };
        },
      });
      matched = matched.filter(
        (row) => readOperand(expr.left, row) === readOperand(expr.right, row),
      );
      return chain;
    },
    take(n: number) {
      return Promise.resolve(matched.slice(0, n));
    },
  };

  return chain;
}

function overviewDb(deposits: DepositRow[]) {
  return {
    query(table: string) {
      if (table === "fundDeposits") return queryRows(deposits);
      const empty = {
        withIndex() {
          return empty;
        },
        filter() {
          return empty;
        },
        take: async () => [],
      };
      return empty;
    },
  };
}

function depositsWithVerifiedAfterCap(): DepositRow[] {
  const unverified = Array.from({ length: 500 }, (_, index) => ({
    depositedBy: "officer-me",
    status: index % 2 === 0 ? ("pending" as const) : ("rejected" as const),
    amount: 9,
    source: "events",
  }));
  return [
    ...unverified,
    {
      depositedBy: "officer-me",
      status: "verified",
      amount: 42,
      source: "events",
    },
    {
      depositedBy: "officer-other",
      status: "verified",
      amount: 400,
      source: "events",
    },
  ];
}

describe("getBudgetOverview deposit cap", () => {
  beforeEach(() => {
    requireOfficerAccess.mockReset();
  });

  it.each(["General Officer", "Executive Officer"] as const)(
    "keeps a verified deposit that sits after 500 non-verified rows for %s",
    async (role) => {
      requireOfficerAccess.mockResolvedValue({
        role,
        logtoId: "officer-me",
      });
      const ctx = { db: overviewDb(depositsWithVerifiedAfterCap()) };

      const result = (await asQuery(getBudgetOverview).handler(ctx, {
        logtoId: "officer-me",
        authToken: "token",
      })) as {
        departments: Array<{
          department: string;
          verifiedDeposits: number;
          remaining: number;
        }>;
      };

      const events = result.departments.find(
        (department) => department.department === "events",
      );
      expect(events?.verifiedDeposits).toBe(42);
      expect(events?.remaining).toBe(42);
      expect(JSON.stringify(result)).not.toContain("400");
      expect(JSON.stringify(result)).not.toContain("4500");
    },
  );
});
