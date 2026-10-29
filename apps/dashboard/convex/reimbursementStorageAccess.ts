import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { hasAdminAccess, type UserRole } from "./permissions";

export type ReimbursementStorageUser = {
  role: UserRole;
  logtoId?: string | null;
  authUserId?: string | null;
};

export type ReimbursementStorageRecord = {
  submittedBy: string;
  receipts?: Array<{ receiptFile?: string | null }> | null;
  paymentDetails?: { proofFileUrl?: string | null } | null;
};

export type PendingReimbursementUpload = {
  storageId: Id<"_storage">;
  uploadedBy: string;
  createdAt: number;
};

type StorageLookupCtx = Pick<MutationCtx, "db">;

/**
 * Authorization for `reimbursements.getStorageUrl`.
 *
 * Referenced files require the reimbursement owner or the admin/exec
 * finance review role. Unreferenced files are only the just-uploaded
 * preview handshake: a pending row must already record this caller as
 * the uploader, and that claim must still be unexpired.
 */
export class ReimbursementStorageAccess {
  static readonly UNAUTHORIZED = "Unauthorized";
  static readonly RECENT_UNREFERENCED_UPLOAD_MS = 15 * 60 * 1000;

  static callerId(user: ReimbursementStorageUser) {
    return user.logtoId ?? user.authUserId ?? "";
  }

  static canViewAllReimbursementFiles(role: UserRole) {
    return hasAdminAccess(role);
  }

  static includesStorageId(value: unknown, storageId: string) {
    if (typeof value !== "string" || !storageId) return false;
    if (value === storageId) return true;
    return (
      value.includes(`/${storageId}`) ||
      value.includes(`storageId=${storageId}`) ||
      value.endsWith(storageId)
    );
  }

  static reimbursementReferencesStorageId(
    reimbursement: ReimbursementStorageRecord,
    storageId: string,
  ) {
    const receipts = reimbursement.receipts ?? [];
    if (
      receipts.some((receipt) =>
        ReimbursementStorageAccess.includesStorageId(
          receipt.receiptFile,
          storageId,
        ),
      )
    ) {
      return true;
    }
    return ReimbursementStorageAccess.includesStorageId(
      reimbursement.paymentDetails?.proofFileUrl,
      storageId,
    );
  }

  static ownsReferencingReimbursement(
    user: ReimbursementStorageUser,
    reimbursements: ReimbursementStorageRecord[],
  ) {
    const userId = ReimbursementStorageAccess.callerId(user);
    if (!userId) return false;
    return reimbursements.some(
      (reimbursement) => reimbursement.submittedBy === userId,
    );
  }

  static assertCanViewReferenced(
    user: ReimbursementStorageUser,
    referenced: ReimbursementStorageRecord[],
  ) {
    if (ReimbursementStorageAccess.canViewAllReimbursementFiles(user.role)) {
      return;
    }
    if (
      ReimbursementStorageAccess.ownsReferencingReimbursement(user, referenced)
    ) {
      return;
    }
    throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
  }

  static async findPendingUpload(
    ctx: StorageLookupCtx,
    storageId: Id<"_storage">,
  ) {
    return await ctx.db
      .query("pendingReimbursementUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first();
  }

  static async assertRecentOwnedUpload(
    ctx: StorageLookupCtx,
    user: ReimbursementStorageUser,
    storageId: Id<"_storage">,
    nowMs = Date.now(),
  ) {
    const userId = ReimbursementStorageAccess.callerId(user);
    const pending = await ReimbursementStorageAccess.findPendingUpload(
      ctx,
      storageId,
    );
    if (!pending || !userId || pending.uploadedBy !== userId) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }
    if (
      nowMs - pending.createdAt >
      ReimbursementStorageAccess.RECENT_UNREFERENCED_UPLOAD_MS
    ) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }

    const metadata = await ctx.db.system.get(storageId);
    if (!metadata || typeof metadata._creationTime !== "number") {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }
    if (
      nowMs - metadata._creationTime >
      ReimbursementStorageAccess.RECENT_UNREFERENCED_UPLOAD_MS
    ) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }
  }

  static async registerPendingUpload(
    ctx: StorageLookupCtx,
    user: ReimbursementStorageUser,
    storageId: Id<"_storage">,
    nowMs = Date.now(),
  ) {
    const userId = ReimbursementStorageAccess.callerId(user);
    if (!userId) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }

    const metadata = await ctx.db.system.get(storageId);
    if (!metadata || typeof metadata._creationTime !== "number") {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }
    if (
      nowMs - metadata._creationTime >
      ReimbursementStorageAccess.RECENT_UNREFERENCED_UPLOAD_MS
    ) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }

    const existing = await ReimbursementStorageAccess.findPendingUpload(
      ctx,
      storageId,
    );
    if (existing) {
      if (existing.uploadedBy !== userId) {
        throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
      }
      return existing;
    }

    await ctx.db.insert("pendingReimbursementUploads", {
      storageId,
      uploadedBy: userId,
      createdAt: nowMs,
    });
    return {
      storageId,
      uploadedBy: userId,
      createdAt: nowMs,
    };
  }

  static async assertCanResolve(
    ctx: StorageLookupCtx,
    user: ReimbursementStorageUser,
    storageId: Id<"_storage">,
    nowMs = Date.now(),
  ) {
    const reimbursements = await ctx.db.query("reimbursements").collect();
    const referenced = reimbursements.filter((reimbursement) =>
      ReimbursementStorageAccess.reimbursementReferencesStorageId(
        reimbursement,
        storageId,
      ),
    );

    if (referenced.length > 0) {
      ReimbursementStorageAccess.assertCanViewReferenced(user, referenced);
      return;
    }

    await ReimbursementStorageAccess.assertRecentOwnedUpload(
      ctx,
      user,
      storageId,
      nowMs,
    );
  }
}
