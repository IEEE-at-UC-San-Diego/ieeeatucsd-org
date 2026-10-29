import { describe, expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import {
  ReimbursementStorageAccess,
  type PendingReimbursementUpload,
  type ReimbursementStorageRecord,
  type ReimbursementStorageUser,
  type ReimbursementUploadTicket,
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
  tickets: ReimbursementUploadTicket[] = [],
  publicUrls: Record<string, string> = {},
) {
  const pendingRows = pending.map((row, index) => ({
    _id:
      row._id ??
      (`pending_${row.storageId}_${index}` as Id<"pendingReimbursementUploads">),
    ...row,
  }));
  const ticketRows = tickets.map((row, index) => ({
    _id:
      row._id ??
      (`ticket_${row.tokenHash}_${index}` as Id<"reimbursementUploadTickets">),
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
              name: string,
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
              const matched = pendingRows.filter((row) =>
                name === "by_uploadedBy"
                  ? row.uploadedBy === value
                  : row.storageId === value,
              );
              return {
                first: async () => matched[0] ?? null,
                collect: async () => matched,
              };
            },
          };
        }
        if (table === "reimbursementUploadTickets") {
          return {
            collect: async () => ticketRows,
            withIndex(
              name: string,
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
              const matched = ticketRows.filter((row) =>
                name === "by_uploadedBy"
                  ? row.uploadedBy === value
                  : row.tokenHash === value,
              );
              return {
                first: async () => matched[0] ?? null,
              };
            },
          };
        }
        throw new Error(`unexpected table ${table}`);
      },
      insert: async (
        table: string,
        doc: PendingReimbursementUpload | ReimbursementUploadTicket,
      ) => {
        if (table === "pendingReimbursementUploads") {
          const id =
            `pending_${pendingRows.length + 1}` as Id<"pendingReimbursementUploads">;
          pendingRows.push({
            _id: id,
            ...(doc as PendingReimbursementUpload),
          });
          return id;
        }
        if (table === "reimbursementUploadTickets") {
          const id =
            `ticket_${ticketRows.length + 1}` as Id<"reimbursementUploadTickets">;
          ticketRows.push({
            _id: id,
            ...(doc as ReimbursementUploadTicket),
          });
          return id;
        }
        throw new Error(`unexpected insert ${table}`);
      },
      patch: async (
        id: Id<"reimbursementUploadTickets">,
        fields: Partial<ReimbursementUploadTicket>,
      ) => {
        const row = ticketRows.find((ticket) => ticket._id === id);
        if (row) Object.assign(row, fields);
      },
      delete: async (id: Id<"pendingReimbursementUploads">) => {
        const index = pendingRows.findIndex((row) => row._id === id);
        if (index >= 0) pendingRows.splice(index, 1);
      },
      system: {
        get: async (id: Id<"_storage">) => metadata[id] ?? null,
      },
    },
    storage: {
      getUrl: async (id: Id<"_storage">) => publicUrls[id] ?? null,
    },
    _pending: pendingRows,
    _tickets: ticketRows,
  };
}

describe("ReimbursementStorageAccess.includesStorageId", () => {
  it("matches only the exact stored id or the exact public URL", () => {
    const publicUrl = `https://convex.example/api/storage/${STORAGE_A}`;
    expect(
      ReimbursementStorageAccess.includesStorageId(STORAGE_A, STORAGE_A),
    ).toBe(true);
    expect(
      ReimbursementStorageAccess.includesStorageId(
        publicUrl,
        STORAGE_A,
        publicUrl,
      ),
    ).toBe(true);
    expect(
      ReimbursementStorageAccess.includesStorageId(
        `https://convex.example/api/storage/${STORAGE_A}`,
        STORAGE_A,
      ),
    ).toBe(false);
    expect(
      ReimbursementStorageAccess.includesStorageId(
        `${STORAGE_A}?storageId=${STORAGE_B}`,
        STORAGE_B,
      ),
    ).toBe(false);
    expect(
      ReimbursementStorageAccess.includesStorageId(
        `https://convex.example/api/storage?storageId=${STORAGE_A}`,
        STORAGE_A,
        publicUrl,
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
    const publicUrl = `https://convex.example/api/storage/${STORAGE_A}`;
    const ctx = ctxWith(
      [
        reimbursement({
          submittedBy: "logto|alice",
          receipts: [{ receiptFile: publicUrl }],
        }),
      ],
      {},
      [],
      [],
      { [STORAGE_A]: publicUrl },
    );

    await expect(
      ReimbursementStorageAccess.assertCanResolve(
        ctx as never,
        member(),
        STORAGE_A,
      ),
    ).resolves.toBeUndefined();
  });

  it("does not treat a crafted receiptFile as a reference to an embedded foreign id", async () => {
    const ctx = ctxWith([
      reimbursement({
        submittedBy: "logto|alice",
        receipts: [{ receiptFile: `${STORAGE_A}?storageId=${STORAGE_B}` }],
      }),
    ]);

    await expect(
      ReimbursementStorageAccess.assertCanResolve(
        ctx as never,
        member(),
        STORAGE_B,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
  });

  it("allows an Executive Officer to resolve any referenced receipt", async () => {
    const publicUrl = `https://convex.example/api/storage/${STORAGE_B}`;
    const ctx = ctxWith(
      [
        reimbursement({
          submittedBy: "logto|alice",
          paymentDetails: {
            proofFileUrl: publicUrl,
          },
        }),
      ],
      {},
      [],
      [],
      { [STORAGE_B]: publicUrl },
    );

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

describe("ReimbursementStorageAccess.uploadUrlForToken", () => {
  it("builds a site URL that carries the caller-issued token", () => {
    const previous = process.env.CONVEX_SITE_URL;
    process.env.CONVEX_SITE_URL = "https://example.convex.site";
    expect(ReimbursementStorageAccess.uploadUrlForToken("alice-token")).toBe(
      "https://example.convex.site/reimbursement-upload?token=alice-token",
    );
    if (previous === undefined) {
      delete process.env.CONVEX_SITE_URL;
    } else {
      process.env.CONVEX_SITE_URL = previous;
    }
  });
});

describe("ReimbursementStorageAccess.registerPendingUpload", () => {
  it("rejects another user who tries to claim a fresh upload", async () => {
    const now = Date.now();
    const ctx = ctxWith([], {
      [STORAGE_NEW]: { _creationTime: now - 1_000 },
    });

    await expect(
      ReimbursementStorageAccess.registerPendingUpload(
        ctx as never,
        member({ logtoId: "logto|bob" }),
        STORAGE_NEW,
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
    expect(ctx._pending).toEqual([]);
  });

  it("does not let the caller first-claim a storage id they did not upload", async () => {
    const now = Date.now();
    const ctx = ctxWith([], {
      [STORAGE_NEW]: { _creationTime: now - 1_000 },
    });

    await expect(
      ReimbursementStorageAccess.registerPendingUpload(
        ctx as never,
        member(),
        STORAGE_NEW,
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
    expect(ctx._pending).toEqual([]);
  });

  it("confirms the ticketed uploader and rejects a second signed-in user", async () => {
    const now = Date.now();
    const ctx = ctxWith([], {
      [STORAGE_NEW]: { _creationTime: now - 500 },
    });
    const token = await ReimbursementStorageAccess.issueUploadTicket(
      ctx as never,
      member(),
      now - 1_000,
      "alice-upload-token",
    );

    await ReimbursementStorageAccess.completeTicketedUpload(
      ctx as never,
      token,
      STORAGE_NEW,
      now,
    );

    await expect(
      ReimbursementStorageAccess.registerPendingUpload(
        ctx as never,
        member(),
        STORAGE_NEW,
        now,
      ),
    ).resolves.toMatchObject({
      storageId: STORAGE_NEW,
      uploadedBy: "logto|alice",
    });
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

  it("rejects completing a ticketed upload with another user's token", async () => {
    const now = Date.now();
    const ctx = ctxWith([], {
      [STORAGE_NEW]: { _creationTime: now - 500 },
    });
    await ReimbursementStorageAccess.issueUploadTicket(
      ctx as never,
      member(),
      now - 1_000,
      "alice-upload-token",
    );

    await expect(
      ReimbursementStorageAccess.completeTicketedUpload(
        ctx as never,
        "bob-forged-token",
        STORAGE_NEW,
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
    expect(ctx._pending).toEqual([]);
  });

  it("rejects claiming a storage id that is already referenced", async () => {
    const now = Date.now();
    const ctx = ctxWith(
      [
        reimbursement({
          submittedBy: "logto|alice",
          receipts: [{ receiptFile: STORAGE_NEW }],
        }),
      ],
      { [STORAGE_NEW]: { _creationTime: now - 500 } },
    );
    const token = await ReimbursementStorageAccess.issueUploadTicket(
      ctx as never,
      member({ logtoId: "logto|bob" }),
      now - 1_000,
      "bob-upload-token",
    );

    await expect(
      ReimbursementStorageAccess.completeTicketedUpload(
        ctx as never,
        token,
        STORAGE_NEW,
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
    expect(ctx._pending).toEqual([]);
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
    ).resolves.toEqual([STORAGE_NEW]);
    expect(ctx._pending).toEqual([]);
  });

  it("rejects a crafted receiptFile that embeds a second storage id", async () => {
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
      ],
    );

    await expect(
      ReimbursementStorageAccess.assertCanAttachAndConsume(
        ctx as never,
        member(),
        [`${STORAGE_A}?storageId=${STORAGE_B}`],
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
    expect(ctx._pending.map((row) => row.storageId)).toEqual([STORAGE_A]);
  });

  it("still attaches an owned pending claim after the 15-minute preview window", async () => {
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
      ReimbursementStorageAccess.assertCanAttachAndConsume(
        ctx as never,
        member(),
        [STORAGE_NEW],
        now,
      ),
    ).resolves.toEqual([STORAGE_NEW]);
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
    ).resolves.toEqual([]);
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

  it("maps a self-hosted getUrl file UUID back to the uploader's pending storage id", async () => {
    const now = Date.now();
    const publicUrl =
      "http://127.0.0.1:3210/api/storage/7e3fd37d-0057-4e22-ba19-88f0dda5b736";
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
      [],
      { [STORAGE_NEW]: publicUrl },
    );

    await expect(
      ReimbursementStorageAccess.assertCanAttachAndConsume(
        ctx as never,
        member(),
        [publicUrl],
        now,
      ),
    ).resolves.toEqual([STORAGE_NEW]);
    expect(ctx._pending).toEqual([]);
  });

  it("rejects a self-hosted getUrl UUID that belongs to another user's pending upload", async () => {
    const now = Date.now();
    const publicUrl =
      "http://127.0.0.1:3210/api/storage/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
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
      [],
      { [STORAGE_A]: publicUrl },
    );

    await expect(
      ReimbursementStorageAccess.assertCanAttachAndConsume(
        ctx as never,
        member(),
        [publicUrl],
        now,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
    expect(ctx._pending).toHaveLength(1);
  });
});

describe("ReimbursementStorageAccess.canonicalizeStorageValue", () => {
  it("rewrites a crafted receiptFile to the resolved owned id URL", async () => {
    const now = Date.now();
    const publicUrl = `https://convex.example/api/storage/${STORAGE_A}`;
    const ctx = ctxWith(
      [],
      { [STORAGE_A]: { _creationTime: now - 1_000 } },
      [
        {
          storageId: STORAGE_A,
          uploadedBy: "logto|alice",
          createdAt: now - 1_000,
        },
      ],
      [],
      { [STORAGE_A]: publicUrl },
    );

    const attachedIds =
      await ReimbursementStorageAccess.assertCanAttachAndConsume(
        ctx as never,
        member(),
        [STORAGE_A],
        now,
      );
    const rewritten = await ReimbursementStorageAccess.rewriteReceiptFiles(
      ctx as never,
      [{ receiptFile: `${STORAGE_A}?storageId=${STORAGE_B}` }],
      attachedIds,
    );

    expect(rewritten).toEqual([{ receiptFile: publicUrl }]);
  });
});

describe("ReimbursementStorageAccess.resolveOwnedPendingStorageId", () => {
  it("rejects ownId?storageId=foreignId even when the caller owns the first id", async () => {
    const now = Date.now();
    const ctx = ctxWith(
      [],
      { [STORAGE_A]: { _creationTime: now - 1_000 } },
      [
        {
          storageId: STORAGE_A,
          uploadedBy: "logto|alice",
          createdAt: now - 1_000,
        },
      ],
    );

    await expect(
      ReimbursementStorageAccess.resolveOwnedPendingStorageId(
        ctx as never,
        member(),
        `${STORAGE_A}?storageId=${STORAGE_B}`,
      ),
    ).rejects.toThrow(ReimbursementStorageAccess.UNAUTHORIZED);
  });
});
