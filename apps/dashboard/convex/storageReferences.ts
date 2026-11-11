import type { Doc, Id } from "./_generated/dataModel";
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

const STORAGE_ID_PATTERN = /^[0-9a-z]+$/;

type StorageTable = (typeof STORAGE_TABLES)[number];
type DatabaseWriter = MutationCtx["db"];

function storageToken(value: string): string | undefined {
  const path = value.split(/[?#]/, 1)[0] ?? value;
  const parts = path.split("/").filter((part) => part.length > 0);
  const token = parts[parts.length - 1];
  if (!token || !STORAGE_ID_PATTERN.test(token)) return undefined;
  return token;
}

function confirmedStorageIds(
  db: DatabaseWriter,
  values: ReadonlyArray<string | undefined>,
): string[] {
  const ids: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const token = storageToken(value);
    if (!token) continue;
    if (db.system.normalizeId("_storage", token) === null) continue;
    ids.push(token);
  }
  return ids;
}

function storageIdsFrom(
  db: DatabaseWriter,
  table: StorageTable,
  doc: unknown,
): string[] {
  switch (table) {
    case "users": {
      const user = doc as Doc<"users">;
      return confirmedStorageIds(db, [user.resume?.storageId]);
    }
    case "events": {
      const event = doc as Doc<"events">;
      return confirmedStorageIds(db, [
        ...(event.files ?? []),
        ...(event.roomBookingFiles ?? []),
        ...(event.graphicsFiles ?? []),
        ...(event.invoices ?? []).flatMap((invoice) => [
          invoice.invoiceFile,
          ...invoice.additionalFiles,
        ]),
      ]);
    }
    case "reimbursements": {
      const reimbursement = doc as Doc<"reimbursements">;
      return confirmedStorageIds(db, [
        ...(reimbursement.receipts ?? []).map((receipt) => receipt.receiptFile),
        reimbursement.paymentDetails?.proofFileUrl,
      ]);
    }
    case "fundDeposits": {
      const deposit = doc as Doc<"fundDeposits">;
      return confirmedStorageIds(db, [
        ...(deposit.receiptFiles ?? []),
        ...(deposit.bankTransferFiles ?? []),
      ]);
    }
    case "fundRequests": {
      const request = doc as Doc<"fundRequests">;
      return confirmedStorageIds(db, [
        ...(request.attachments ?? []).map((attachment) => attachment.url),
      ]);
    }
    default: {
      const unreachable: never = table;
      return unreachable;
    }
  }
}

export async function syncRecordStorage<T extends StorageTable>(
  ctx: MutationCtx,
  table: T,
  id: Id<T>,
): Promise<void> {
  const doc = await ctx.db.get(id);
  const next = new Set(doc ? storageIdsFrom(ctx.db, table, doc) : []);
  const recordId = String(id);
  const existing = await ctx.db
    .query("storageReferences")
    .withIndex("by_recordId", (q) => q.eq("recordId", recordId))
    .collect();
  for (const row of existing) {
    if (next.has(row.storageId)) next.delete(row.storageId);
    else await ctx.db.delete(row._id);
  }
  for (const storageId of next) {
    await ctx.db.insert("storageReferences", { storageId, recordId });
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
    await syncRecordStorage(ctx, table, doc._id);
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
