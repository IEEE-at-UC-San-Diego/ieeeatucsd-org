import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export const resumeObject = v.object({
  storageId: v.id("_storage"),
  fileName: v.string(),
  contentType: v.string(),
  uploadedAt: v.number(),
});

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ALLOWED_CONTENT_TYPE = "application/pdf";

const STORAGE_TABLES = [
  "users",
  "events",
  "reimbursements",
  "fundDeposits",
  "fundRequests",
] as const;

export type StorageRecord = {
  recordId: string;
  body: unknown;
};

function stringHoldsStorageId(value: string, storageId: string): boolean {
  if (value === storageId) return true;
  const path = value.split(/[?#]/, 1)[0] ?? value;
  return path.split("/").some((segment) => segment === storageId);
}

function recordHoldsStorageId(value: unknown, storageId: string): boolean {
  if (typeof value === "string") return stringHoldsStorageId(value, storageId);
  if (Array.isArray(value)) {
    return value.some((item) => recordHoldsStorageId(item, storageId));
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).some((item) =>
      recordHoldsStorageId(item, storageId),
    );
  }
  return false;
}

export function storageIdTakenBySomeoneElse(
  storageId: string,
  callerUserId: string,
  records: readonly StorageRecord[],
): boolean {
  return records.some(
    (record) =>
      record.recordId !== callerUserId &&
      recordHoldsStorageId(record.body, storageId),
  );
}

async function loadStorageRecords(ctx: MutationCtx): Promise<StorageRecord[]> {
  const groups = await Promise.all(
    STORAGE_TABLES.map(async (table) => {
      const docs = await ctx.db.query(table).collect();
      return docs.map((doc) => ({
        recordId: String(doc._id),
        body: doc,
      }));
    }),
  );
  return groups.flat();
}

export async function validateAndBuildResume(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  fileName: string,
  callerUserId: Id<"users">,
) {
  const records = await loadStorageRecords(ctx);
  if (storageIdTakenBySomeoneElse(storageId, callerUserId, records)) {
    throw new Error("Unauthorized");
  }

  const metadata = await ctx.db.system.get(storageId);
  if (!metadata) {
    throw new Error("Uploaded file not found");
  }

  const contentType = metadata.contentType ?? "";
  if (contentType !== ALLOWED_CONTENT_TYPE) {
    throw new Error("Resume must be a PDF file");
  }

  if (metadata.size > MAX_RESUME_BYTES) {
    throw new Error("Resume must be 5MB or smaller");
  }

  return {
    storageId,
    fileName: fileName.trim() || "resume.pdf",
    contentType,
    uploadedAt: Date.now(),
  };
}

export async function deleteResumeStorage(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
) {
  try {
    await ctx.storage.delete(storageId);
  } catch {
    // File may already be deleted.
  }
}
