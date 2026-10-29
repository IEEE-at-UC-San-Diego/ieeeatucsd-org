import { describe, expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import {
  ReimbursementStorageAccess,
  type ReimbursementStorageRecord,
  type ReimbursementStorageUser,
} from "./reimbursementStorageAccess";

const STORAGE_A = "kg2receiptA" as Id<"_storage">;
const STORAGE_B = "kg2receiptB" as Id<"_storage">;
const STORAGE_NEW = "kg2justUploaded" as Id<"_storage">;

function member(overrides: Partial<ReimbursementStorageUser> = {}) {
  return {
    role: "Member" as const,
    logtoId: "logto|alice",
    ...overrides,
  };
}

function reimbursement(
  overrides: Partial<ReimbursementStorageRecord> & { submittedBy: string },
): ReimbursementStorageRecord {
  return {
    receipts: [],
    ...overrides,
  };
}

function ctxWith(
  reimbursements: ReimbursementStorageRecord[],
  metadata: Record<string, { _creationTime?: number } | null> = {},
) {
  return {
    db: {
      query: (table: "reimbursements") => {
        if (table !== "reimbursements") {
          throw new Error(`unexpected table ${table}`);
        }
        return {
          collect: async () => reimbursements,
        };
      },
      system: {
        get: async (id: Id<"_storage">) => metadata[id] ?? null,
      },
    },
  };
}

describe("ReimbursementStorageAccess.includesStorageId", () => {
  it("matches a raw id, URL path, or query parameter", () => {
    expect(
      ReimbursementStorageAccess.includesStorageId(STORAGE_A, STORAGE_A),
    ).toBe(true);
    expect(
      ReimbursementStorageAccess.includesStorageId(
        `https://convex.example/api/storage/${STORAGE_A}`,
        STORAGE_A,
      ),
    ).toBe(true);
    expect(
      ReimbursementStorageAccess.includesStorageId(
        `https://convex.example/api/storage?storageId=${STORAGE_A}`,
        STORAGE_A,
      ),
    ).toBe(true);
    expect(
      ReimbursementStorageAccess.includesStorageId(
        `https://convex.example/api/storage/${STORAGE_B}`,
        STORAGE_A,
      ),
    ).toBe(false);
  });
});

describe("ReimbursementStorageAccess.assertCanResolve", () => {
  it("denies a member who does not own the referencing reimbursement", async () => {
    const ctx = ctxWith([
      reimbursement({
        submittedBy: "logto|bob",
        receipts: [
          { receiptFile: `https://convex.example/api/storage/${STORAGE_A}` },
        ],
      }),
    ]);

    await expect(
      ReimbursementStorageAccess.assertCanResolve(ctx, member(), STORAGE_A),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
  });

  it("denies a General Officer who is not the owner", async () => {
    const ctx = ctxWith([
      reimbursement({
        submittedBy: "logto|alice",
        receipts: [
          { receiptFile: `https://convex.example/api/storage/${STORAGE_A}` },
        ],
      }),
    ]);

    await expect(
      ReimbursementStorageAccess.assertCanResolve(
        ctx,
        member({ role: "General Officer", logtoId: "logto|officer" }),
        STORAGE_A,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
  });

  it("allows the reimbursement owner to resolve their receipt", async () => {
    const ctx = ctxWith([
      reimbursement({
        submittedBy: "logto|alice",
        receipts: [
          { receiptFile: `https://convex.example/api/storage/${STORAGE_A}` },
        ],
      }),
    ]);

    await expect(
      ReimbursementStorageAccess.assertCanResolve(ctx, member(), STORAGE_A),
    ).resolves.toBeUndefined();
  });

  it("allows an Executive Officer to resolve any referenced receipt", async () => {
    const ctx = ctxWith([
      reimbursement({
        submittedBy: "logto|alice",
        paymentDetails: {
          proofFileUrl: `https://convex.example/api/storage/${STORAGE_B}`,
        },
      }),
    ]);

    await expect(
      ReimbursementStorageAccess.assertCanResolve(
        ctx,
        member({ role: "Executive Officer", logtoId: "logto|finance" }),
        STORAGE_B,
      ),
    ).resolves.toBeUndefined();
  });

  it("allows an Administrator to resolve any referenced receipt", async () => {
    const ctx = ctxWith([
      reimbursement({
        submittedBy: "logto|alice",
        receipts: [{ receiptFile: STORAGE_A }],
      }),
    ]);

    await expect(
      ReimbursementStorageAccess.assertCanResolve(
        ctx,
        member({ role: "Administrator", logtoId: "logto|admin" }),
        STORAGE_A,
      ),
    ).resolves.toBeUndefined();
  });

  it("allows a recent unreferenced upload so the existing preview handshake still works", async () => {
    const now = Date.now();
    const ctx = ctxWith([], {
      [STORAGE_NEW]: { _creationTime: now - 30_000 },
    });

    await expect(
      ReimbursementStorageAccess.assertCanResolve(
        ctx,
        member(),
        STORAGE_NEW,
        now,
      ),
    ).resolves.toBeUndefined();
  });

  it("denies an old unreferenced storage id so resumes and event files stay private", async () => {
    const now = Date.now();
    const ctx = ctxWith([], {
      [STORAGE_NEW]: {
        _creationTime:
          now - ReimbursementStorageAccess.RECENT_UNREFERENCED_UPLOAD_MS - 1,
      },
    });

    await expect(
      ReimbursementStorageAccess.assertCanResolve(
        ctx,
        member(),
        STORAGE_NEW,
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
  });

  it("denies an unreferenced storage id with no metadata", async () => {
    const ctx = ctxWith([]);

    await expect(
      ReimbursementStorageAccess.assertCanResolve(ctx, member(), STORAGE_NEW),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
  });
});
