import { mutation as rawMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

export const STORAGE_TABLES = [
  "users",
  "events",
  "reimbursements",
  "fundDeposits",
  "fundRequests",
] as const;

// A document is at most 1 MiB, and a mutation can read 16 MiB.
export const STORAGE_REFERENCE_PAGE_SIZE = 8;

const STORAGE_ID_CANDIDATE = /^[0-9a-z]+$/;

type StorageTable = (typeof STORAGE_TABLES)[number];
type DatabaseWriter = MutationCtx["db"];

function isStorageTable(table: string): table is StorageTable {
  return (STORAGE_TABLES as readonly string[]).includes(table);
}

export function collectStorageIdCandidates(
  value: unknown,
  out: Set<string>,
): void {
  if (typeof value === "string") {
    if (value.length > 0) out.add(value);
    const path = value.split(/[?#]/, 1)[0] ?? value;
    for (const segment of path.split("/")) {
      if (segment.length > 0) out.add(segment);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStorageIdCandidates(item, out);
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectStorageIdCandidates(item, out);
    }
  }
}

export function storageIdsInValue(
  value: unknown,
  isStorageId: (candidate: string) => boolean,
): string[] {
  const candidates = new Set<string>();
  collectStorageIdCandidates(value, candidates);
  return [...candidates].filter(isStorageId);
}

function isStorageDocumentId(db: DatabaseWriter, candidate: string): boolean {
  if (!STORAGE_ID_CANDIDATE.test(candidate)) return false;
  return db.system.normalizeId("_storage", candidate) !== null;
}

export async function syncStorageReferences(
  db: DatabaseWriter,
  recordId: string,
  doc: unknown | null,
): Promise<void> {
  const next = new Set(
    doc === null
      ? []
      : storageIdsInValue(doc, (candidate) => isStorageDocumentId(db, candidate)),
  );
  const existing = await db
    .query("storageReferences")
    .withIndex("by_recordId", (q) => q.eq("recordId", recordId))
    .collect();
  for (const row of existing) {
    if (next.has(row.storageId)) next.delete(row.storageId);
    else await db.delete(row._id);
  }
  for (const storageId of next) {
    await db.insert("storageReferences", { storageId, recordId });
  }
}

export async function storageReferenceIndexReady(
  ctx: MutationCtx,
): Promise<boolean> {
  const state = await ctx.db
    .query("storageReferenceBackfill")
    .withIndex("by_key", (q) => q.eq("key", "state"))
    .unique();
  return state?.done === true;
}

export async function otherRecordHoldsStorageId(
  ctx: MutationCtx,
  storageId: string,
  callerUserId: string,
): Promise<boolean> {
  const matches = await ctx.db
    .query("storageReferences")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .collect();
  return matches.some((row) => row.recordId !== callerUserId);
}

function trackedTable(db: DatabaseWriter, id: string): StorageTable | null {
  if (typeof db.normalizeId !== "function") return null;
  for (const table of STORAGE_TABLES) {
    if (db.normalizeId(table, id)) return table;
  }
  return null;
}

export function wrapMutationCtx(ctx: MutationCtx): MutationCtx {
  const db = ctx.db;
  const wrappedDb = Object.create(db) as DatabaseWriter;

  const insert = async (table: string, value: object) => {
    const id = await db.insert(table as never, value as never);
    if (isStorageTable(table)) {
      await syncStorageReferences(db, String(id), value);
    }
    return id;
  };
  wrappedDb.insert = insert as DatabaseWriter["insert"];

  const patch = async (id: string, value: object) => {
    await db.patch(id as never, value as never);
    if (trackedTable(db, id)) {
      const updated = await db.get(id as never);
      await syncStorageReferences(db, String(id), updated);
    }
  };
  wrappedDb.patch = patch as DatabaseWriter["patch"];

  const replace = async (id: string, value: object) => {
    await db.replace(id as never, value as never);
    if (trackedTable(db, id)) {
      await syncStorageReferences(db, String(id), value);
    }
  };
  wrappedDb.replace = replace as DatabaseWriter["replace"];

  const remove = async (id: string) => {
    const tracked = trackedTable(db, id);
    await db.delete(id as never);
    if (tracked) await syncStorageReferences(db, String(id), null);
  };
  wrappedDb.delete = remove as DatabaseWriter["delete"];

  return new Proxy(ctx, {
    get(target, prop, receiver) {
      if (prop === "db") return wrappedDb;
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") return value.bind(target);
      return value;
    },
  });
}

type MutationDefinition = {
  handler: (ctx: MutationCtx, ...args: never[]) => unknown;
};

export const mutation = ((definition: MutationDefinition) =>
  rawMutation({
    ...definition,
    handler: (ctx: MutationCtx, ...args: never[]) =>
      definition.handler(wrapMutationCtx(ctx), ...args),
  } as never)) as typeof rawMutation;

export async function runStorageReferenceBackfill(
  ctx: MutationCtx,
): Promise<{ done: boolean }> {
  const existing = await ctx.db
    .query("storageReferenceBackfill")
    .withIndex("by_key", (q) => q.eq("key", "state"))
    .unique();
  if (existing?.done) return { done: true };

  const stateId =
    existing?._id ??
    (await ctx.db.insert("storageReferenceBackfill", {
      key: "state",
      tableIndex: 0,
      cursor: null,
      done: false,
    }));
  const tableIndex = existing?.tableIndex ?? 0;
  const table = STORAGE_TABLES[tableIndex];
  if (!table) {
    await ctx.db.patch(stateId, { done: true, cursor: null });
    return { done: true };
  }

  const page = await ctx.db.query(table).paginate({
    numItems: STORAGE_REFERENCE_PAGE_SIZE,
    cursor: existing?.cursor ?? null,
  });
  for (const doc of page.page) {
    await syncStorageReferences(ctx.db, String(doc._id), doc);
  }

  const nextTableIndex = page.isDone ? tableIndex + 1 : tableIndex;
  const done = page.isDone && nextTableIndex >= STORAGE_TABLES.length;
  await ctx.db.patch(stateId, {
    tableIndex: nextTableIndex,
    cursor: page.isDone ? null : page.continueCursor,
    done,
  });
  return { done };
}
