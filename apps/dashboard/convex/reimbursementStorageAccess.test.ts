import { describe, expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import {
  ReimbursementStorageAccess,
  type PendingReimbursementUpload,
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
  pending: PendingReimbursementUpload[] = [],
) {
  const pendingRows = pending.map((row, index) => ({
    _id:
      row._id ??
      (`pending_${row.storageId}_${index}` as Id<"pendingReimbursementUploads">),
    ...row,
  }));
  return {
    db: {
      query: (table: string) => {
        if (table === "reimbursements") {
          return {
            collect: async () => reimbursements,
            withIndex: () => ({
              first: async () => null,
            }),
          };
        }
        if (table === "pendingReimbursementUploads") {
          return {
            collect: async () => pendingRows,
            withIndex(
              _name: string,
              builder: (q: {
                eq: (field: string, value: unknown) => unknown;
              }) => unknown,
            ) {
              let value: unknown;
              builder({
                eq: (_field, nextValue) => {
                  value = nextValue;
                  return { value };
                },
              });
              const matched = pendingRows.filter(
                (row) => row.storageId === value,
              );
              return {
                first: async () => matched[0] ?? null,
              };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      insert: async (table: string, doc: PendingReimbursementUpload) => {
        if (table !== "pendingReimbursementUploads") {
          throw new Error(`unexpected insert ${table}`);
        }
        const id =
          `pending_${pendingRows.length + 1}` as Id<"pendingReimbursementUploads">;
        pendingRows.push({ _id: id, ...doc });
        return id;
      },
      delete: async (id: Id<"pendingReimbursementUploads">) => {
        const index = pendingRows.findIndex((row) => row._id === id);
        if (index >= 0) pendingRows.splice(index, 1);
      },
      system: {
        get: async (id: Id<"_storage">) => metadata[id] ?? null,
      },
    },
    _pending: pendingRows,
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
      ReimbursementStorageAccess.assertCanResolve(
        ctx as never,
        member(),
        STORAGE_A,
      ),
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
        ctx as never,
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
      ReimbursementStorageAccess.assertCanResolve(
        ctx as never,
        member(),
        STORAGE_A,
      ),
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
        ctx as never,
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
        ctx as never,
        member({ role: "Administrator", logtoId: "logto|admin" }),
        STORAGE_A,
      ),
    ).resolves.toBeUndefined();
  });

  it("allows the uploader to resolve a fresh unreferenced upload", async () => {
    const now = Date.now();
    const ctx = ctxWith(
      [],
      { [STORAGE_NEW]: { _creationTime: now - 30_000 } },
      [
        {
          storageId: STORAGE_NEW,
          uploadedBy: "logto|alice",
          createdAt: now - 30_000,
        },
      ],
    );

    await expect(
      ReimbursementStorageAccess.assertCanResolve(
        ctx as never,
        member(),
        STORAGE_NEW,
        now,
      ),
    ).resolves.toBeUndefined();
  });

  it("denies another signed-in user a fresh unreferenced upload", async () => {
    const now = Date.now();
    const ctx = ctxWith(
      [],
      { [STORAGE_NEW]: { _creationTime: now - 30_000 } },
      [
        {
          storageId: STORAGE_NEW,
          uploadedBy: "logto|alice",
          createdAt: now - 30_000,
        },
      ],
    );

    await expect(
      ReimbursementStorageAccess.assertCanResolve(
        ctx as never,
        member({ logtoId: "logto|bob" }),
        STORAGE_NEW,
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
  });

  it("denies an expired pending upload even for the uploader", async () => {
    const now = Date.now();
    const createdAt =
      now - ReimbursementStorageAccess.RECENT_UNREFERENCED_UPLOAD_MS - 1;
    const ctx = ctxWith(
      [],
      { [STORAGE_NEW]: { _creationTime: createdAt } },
      [
        {
          storageId: STORAGE_NEW,
          uploadedBy: "logto|alice",
          createdAt,
        },
      ],
    );

    await expect(
      ReimbursementStorageAccess.assertCanResolve(
        ctx as never,
        member(),
        STORAGE_NEW,
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
  });

  it("denies an unreferenced storage id with no pending uploader", async () => {
    const now = Date.now();
    const ctx = ctxWith([], {
      [STORAGE_NEW]: { _creationTime: now - 30_000 },
    });

    await expect(
      ReimbursementStorageAccess.assertCanResolve(
        ctx as never,
        member(),
        STORAGE_NEW,
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
  });
});

describe("ReimbursementStorageAccess.registerPendingUpload", () => {
  it("records the caller as the uploader of a fresh storage id", async () => {
    const now = Date.now();
    const ctx = ctxWith([], {
      [STORAGE_NEW]: { _creationTime: now - 1_000 },
    });

    await ReimbursementStorageAccess.registerPendingUpload(
      ctx as never,
      member(),
      STORAGE_NEW,
      now,
    );

    expect(ctx._pending).toEqual([
      {
        _id: "pending_1",
        storageId: STORAGE_NEW,
        uploadedBy: "logto|alice",
        createdAt: now,
      },
    ]);
    await expect(
      ReimbursementStorageAccess.assertCanResolve(
        ctx as never,
        member(),
        STORAGE_NEW,
        now,
      ),
    ).resolves.toBeUndefined();
  });

  it("does not let a second signed-in user claim the same fresh upload", async () => {
    const now = Date.now();
    const ctx = ctxWith([], {
      [STORAGE_NEW]: { _creationTime: now - 1_000 },
    });

    await ReimbursementStorageAccess.registerPendingUpload(
      ctx as never,
      member(),
      STORAGE_NEW,
      now,
    );

    await expect(
      ReimbursementStorageAccess.registerPendingUpload(
        ctx as never,
        member({ logtoId: "logto|bob" }),
        STORAGE_NEW,
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
    await expect(
      ReimbursementStorageAccess.assertCanResolve(
        ctx as never,
        member({ logtoId: "logto|bob" }),
        STORAGE_NEW,
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
  });
});

describe("ReimbursementStorageAccess.assertCanAttachAndConsume", () => {
  it("rejects a member who attaches another user's storage id", async () => {
    const now = Date.now();
    const ctx = ctxWith(
      [],
      { [STORAGE_A]: { _creationTime: now - 1_000 } },
      [
        {
          storageId: STORAGE_A,
          uploadedBy: "logto|bob",
          createdAt: now - 1_000,
        },
      ],
    );

    await expect(
      ReimbursementStorageAccess.assertCanAttachAndConsume(
        ctx as never,
        member(),
        [`https://convex.example/api/storage/${STORAGE_A}`],
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
    expect(ctx._pending).toHaveLength(1);
  });

  it("rejects attaching a storage id with no pending uploader", async () => {
    const now = Date.now();
    const ctx = ctxWith([], {
      [STORAGE_A]: { _creationTime: now - 1_000 },
    });

    await expect(
      ReimbursementStorageAccess.assertCanAttachAndConsume(
        ctx as never,
        member(),
        [STORAGE_A],
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
  });

  it("allows the uploader to attach their own receipt and consumes the claim", async () => {
    const now = Date.now();
    const ctx = ctxWith(
      [],
      { [STORAGE_NEW]: { _creationTime: now - 1_000 } },
      [
        {
          storageId: STORAGE_NEW,
          uploadedBy: "logto|alice",
          createdAt: now - 1_000,
        },
      ],
    );

    await expect(
      ReimbursementStorageAccess.assertCanAttachAndConsume(
        ctx as never,
        member(),
        ReimbursementStorageAccess.receiptFileValues([
          {
            receiptFile: `https://convex.example/api/storage/${STORAGE_NEW}`,
          },
        ]),
        now,
      ),
    ).resolves.toBeUndefined();
    expect(ctx._pending).toEqual([]);
  });

  it("does not consume a valid claim when another receipt is foreign", async () => {
    const now = Date.now();
    const ctx = ctxWith(
      [],
      {
        [STORAGE_A]: { _creationTime: now - 1_000 },
        [STORAGE_B]: { _creationTime: now - 1_000 },
      },
      [
        {
          storageId: STORAGE_A,
          uploadedBy: "logto|alice",
          createdAt: now - 1_000,
        },
        {
          storageId: STORAGE_B,
          uploadedBy: "logto|bob",
          createdAt: now - 1_000,
        },
      ],
    );

    await expect(
      ReimbursementStorageAccess.assertCanAttachAndConsume(
        ctx as never,
        member(),
        [
          `https://convex.example/api/storage/${STORAGE_A}`,
          `https://convex.example/api/storage?storageId=${STORAGE_B}`,
        ],
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
    expect(ctx._pending.map((row) => row.storageId)).toEqual([
      STORAGE_A,
      STORAGE_B,
    ]);
  });

  it("allows attaching no file (mileage receipts) without a claim", async () => {
    const ctx = ctxWith([]);

    await expect(
      ReimbursementStorageAccess.assertCanAttachAndConsume(
        ctx as never,
        member(),
        ReimbursementStorageAccess.receiptFileValues([
          { receiptFile: undefined },
        ]),
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects a non-empty receiptFile that is not a storage id", async () => {
    await expect(
      ReimbursementStorageAccess.assertCanAttachAndConsume(
        ctxWith([]) as never,
        member(),
        ["https://convex.example/api/storage"],
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
  });
});
