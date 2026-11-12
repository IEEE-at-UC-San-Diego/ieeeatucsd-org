import { describe, expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import { validateAndBuildResume } from "./resume";
import type { MutationCtx } from "./_generated/server";
import {
  runStorageReferenceBackfill,
  STORAGE_REFERENCE_PAGE_SIZE,
  STORAGE_TABLES,
  syncRecordStorage,
} from "./storageReferences";

const SOURCE_TABLES = new Set<string>(STORAGE_TABLES);

type ReferenceRow = { _id: string; storageId: string; recordId: string };
type BackfillState = {
  _id: string;
  key: "state";
  tableIndex: number;
  cursor: string | null;
  done: boolean;
};

function indexQuery(
  rows: ReferenceRow[],
  state: BackfillState | null,
  indexes: string[],
) {
  return (table: string) => {
    if (SOURCE_TABLES.has(table)) {
      return {
        collect: async () => {
          throw new Error(`scanned ${table}`);
        },
      };
    }
    return {
      collect: async () => {
        throw new Error(`unindexed collect ${table}`);
      },
      withIndex: (
        indexName: string,
        build: (q: { eq: (field: string, value: string) => unknown }) => unknown,
      ) => {
        const eq = { field: "", value: "" };
        const q = {
          eq(field: string, value: string) {
            eq.field = field;
            eq.value = value;
            return q;
          },
        };
        build(q);
        indexes.push(`${table}.${indexName}.${eq.field}`);
        const matched =
          table === "storageReferences"
            ? rows.filter((row) => row[eq.field as "storageId" | "recordId"] === eq.value)
            : [];
        return {
          collect: async () => matched,
          unique: async () => (table === "storageReferenceBackfill" ? state : null),
        };
      },
    };
  };
}

function resumeCtx(options: {
  contentType: string;
  size: number;
  ready: boolean;
  references?: ReferenceRow[];
  deleted?: string[];
  metadataRead?: { count: number };
  indexes?: string[];
}): MutationCtx {
  return {
    db: {
      system: {
        get: async () => {
          if (options.metadataRead) options.metadataRead.count += 1;
          return {
            contentType: options.contentType,
            size: options.size,
            sha256: "abc",
          };
        },
      },
      query: indexQuery(
        options.references ?? [],
        options.ready
          ? {
              _id: "state",
              key: "state",
              tableIndex: STORAGE_TABLES.length,
              cursor: null,
              done: true,
            }
          : null,
        options.indexes ?? [],
      ),
    },
    storage: {
      delete: async (id: string) => {
        options.deleted?.push(String(id));
      },
    },
  } as unknown as MutationCtx;
}

describe("validateAndBuildResume", () => {
  it("rejects another record's storage id and does not delete the file", async () => {
    const deleted: string[] = [];
    const ctx = resumeCtx({
      contentType: "text/plain",
      size: 12,
      ready: true,
      references: [
        { _id: "ref_bob", storageId: "storage_bob", recordId: "user_bob" },
      ],
      deleted,
    });

    await expect(
      validateAndBuildResume(
        ctx,
        "storage_bob" as Id<"_storage">,
        "bob.pdf",
        "user_ada" as Id<"users">,
      ),
    ).rejects.toThrow("Unauthorized");
    expect(deleted).toEqual([]);
  });

  it("allows the caller's own storage id", async () => {
    const ctx = resumeCtx({
      contentType: "application/pdf",
      size: 100,
      ready: true,
      references: [
        { _id: "ref_ada", storageId: "storage_ada", recordId: "user_ada" },
      ],
    });

    await expect(
      validateAndBuildResume(
        ctx,
        "storage_ada" as Id<"_storage">,
        "ada.pdf",
        "user_ada" as Id<"users">,
      ),
    ).resolves.toMatchObject({ storageId: "storage_ada" });
  });

  it("does not delete a fresh file that fails the pdf check", async () => {
    const deleted: string[] = [];
    const ctx = resumeCtx({
      contentType: "text/plain",
      size: 12,
      ready: true,
      deleted,
    });

    await expect(
      validateAndBuildResume(
        ctx,
        "storage_new" as Id<"_storage">,
        "notes.txt",
        "user_ada" as Id<"users">,
      ),
    ).rejects.toThrow("Resume must be a PDF file");
    expect(deleted).toEqual([]);
  });

  it("accepts a pdf without scanning the five source tables", async () => {
    const metadataRead = { count: 0 };
    const indexes: string[] = [];
    const ctx = resumeCtx({
      contentType: "application/pdf",
      size: 100,
      ready: true,
      metadataRead,
      indexes,
    });

    await expect(
      validateAndBuildResume(
        ctx,
        "storage_new" as Id<"_storage">,
        " ada.pdf ",
        "user_ada" as Id<"users">,
      ),
    ).resolves.toMatchObject({
      storageId: "storage_new",
      fileName: "ada.pdf",
      contentType: "application/pdf",
    });
    expect(metadataRead.count).toBe(1);
    expect(indexes).toEqual([
      "storageReferenceBackfill.by_key.key",
      "storageReferences.by_storageId.storageId",
    ]);
  });

  it("rejects a valid pdf while the storage index is still building", async () => {
    const metadataRead = { count: 0 };
    const ctx = resumeCtx({
      contentType: "application/pdf",
      size: 100,
      ready: false,
      metadataRead,
    });

    await expect(
      validateAndBuildResume(
        ctx,
        "storage_new" as Id<"_storage">,
        "ada.pdf",
        "user_ada" as Id<"users">,
      ),
    ).rejects.toThrow("File ownership index is not ready");
    expect(metadataRead.count).toBe(0);
  });
});

describe("syncRecordStorage", () => {
  it("indexes a file-field url and drops a stale row", async () => {
    const rows: ReferenceRow[] = [
      { _id: "ref_old", storageId: "kg2old", recordId: "event_1" },
    ];
    let nextId = 0;
    const db = {
      system: {
        normalizeId: (_table: string, id: string) =>
          id === "kg2kept" || id === "kg2old" || id === "kg2other" ? id : null,
      },
      query: () => ({
        withIndex: (
          _indexName: string,
          build: (q: { eq: (field: string, value: string) => unknown }) => unknown,
        ) => {
          const eq = { field: "", value: "" };
          const q = {
            eq(field: string, value: string) {
              eq.field = field;
              eq.value = value;
              return q;
            },
          };
          build(q);
          return {
            collect: async () =>
              rows.filter((row) => row.recordId === eq.value),
          };
        },
        collect: async () => {
          throw new Error("full scan");
        },
      }),
      insert: async (_table: string, value: { storageId: string; recordId: string }) => {
        nextId += 1;
        const row = { _id: `ref_${nextId}`, ...value };
        rows.push(row);
        return row._id;
      },
      delete: async (id: string) => {
        const index = rows.findIndex((row) => row._id === id);
        if (index >= 0) rows.splice(index, 1);
      },
    };

    const doc = {
      graphicsFiles: ["https://files.example/api/storage/kg2kept"],
      eventDescription: "kg2other",
    };
    await syncRecordStorage(
      {
        db: { ...db, get: async () => doc },
      } as unknown as MutationCtx,
      "events",
      "event_1" as Id<"events">,
    );

    expect(rows.map((row) => row.storageId)).toEqual(["kg2kept"]);
  });
});

describe("runStorageReferenceBackfill", () => {
  it("pages each source table instead of collecting it", async () => {
    const paginated: Array<{ table: string; numItems: number }> = [];
    let state: BackfillState | null = null;
    const ctx = {
      db: {
        system: { normalizeId: () => null },
        insert: async (
          table: string,
          value: Omit<BackfillState, "_id">,
        ) => {
          if (table !== "storageReferenceBackfill") {
            throw new Error(`unexpected insert ${table}`);
          }
          state = { _id: "state", ...value };
          return state._id;
        },
        patch: async (_id: string, value: Partial<BackfillState>) => {
          if (!state) throw new Error("missing state");
          state = { ...state, ...value };
        },
        query: (table: string) => ({
          withIndex: () => ({
            unique: async () => state,
            collect: async () => [],
          }),
          paginate: async (opts: { numItems: number; cursor: string | null }) => {
            paginated.push({ table, numItems: opts.numItems });
            return { page: [], isDone: true, continueCursor: "next" };
          },
          collect: async () => {
            throw new Error(`scanned ${table}`);
          },
        }),
      },
    } as unknown as MutationCtx;

    const tables: string[] = [];
    for (let step = 0; step < STORAGE_TABLES.length; step += 1) {
      const result = await runStorageReferenceBackfill(ctx);
      tables.push(paginated[step]?.table ?? "");
      expect(result.done).toBe(step === STORAGE_TABLES.length - 1);
    }

    expect(tables).toEqual([...STORAGE_TABLES]);
    expect(paginated.every((page) => page.numItems === STORAGE_REFERENCE_PAGE_SIZE)).toBe(
      true,
    );
    expect(paginated.every((page) => page.numItems <= 8)).toBe(true);
    await expect(runStorageReferenceBackfill(ctx)).resolves.toEqual({ done: true });
    expect(paginated).toHaveLength(STORAGE_TABLES.length);
  });
});
