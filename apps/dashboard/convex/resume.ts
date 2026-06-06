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

export async function validateAndBuildResume(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  fileName: string,
) {
  const metadata = await ctx.db.system.get(storageId);
  if (!metadata) {
    throw new Error("Uploaded file not found");
  }

  const contentType = metadata.contentType ?? "";
  if (contentType !== ALLOWED_CONTENT_TYPE) {
    await ctx.storage.delete(storageId);
    throw new Error("Resume must be a PDF file");
  }

  if (metadata.size > MAX_RESUME_BYTES) {
    await ctx.storage.delete(storageId);
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
