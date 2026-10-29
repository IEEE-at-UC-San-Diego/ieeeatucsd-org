import type { Id } from "./_generated/dataModel";
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

type StorageLookupCtx = {
  db: {
    query: (table: "reimbursements") => {
      collect: () => Promise<ReimbursementStorageRecord[]>;
    };
    system: {
      get: (id: Id<"_storage">) => Promise<{ _creationTime?: number } | null>;
    };
  };
};

/**
 * Authorization for `reimbursements.getStorageUrl`.
 *
 * A signed-in caller is not enough: the storage id must belong to a
 * reimbursement they can already view (owner, or admin/exec finance review).
 *
 * The existing upload UI resolves a storage id immediately after
 * `generateUploadUrl` and before the file is attached. Unreferenced files are
 * therefore allowed only during a short post-upload window so old resume/event
 * objects cannot be fetched by id.
 */
export class ReimbursementStorageAccess {
  static readonly UNAUTHORIZED = "Unauthorized";
  static readonly RECENT_UNREFERENCED_UPLOAD_MS = 15 * 60 * 1000;

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
    const userId = user.logtoId ?? user.authUserId ?? "";
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

  static async assertRecentUnreferencedUpload(
    ctx: StorageLookupCtx,
    storageId: Id<"_storage">,
    nowMs = Date.now(),
  ) {
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

    await ReimbursementStorageAccess.assertRecentUnreferencedUpload(
      ctx,
      storageId,
      nowMs,
    );
  }
}
