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
  _id?: Id<"pendingReimbursementUploads">;
  storageId: Id<"_storage">;
  uploadedBy: string;
  createdAt: number;
};

type StorageLookupCtx = Pick<MutationCtx, "db">;

/**
 * Authorization for reimbursement storage IDs.
 *
 * `getStorageUrl`: referenced files require the reimbursement owner or
 * the admin/exec finance review role. Unreferenced files are only the
 * just-uploaded preview handshake: a pending row must already record
 * this caller as the uploader, and that claim must still be unexpired.
 *
 * `create` / `updatePaymentDetails`: every caller-supplied storage ID
 * must have an unexpired pending claim by the same uploader. The claim
 * is consumed on attach so it cannot be reused.
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

  static extractStorageIds(value: unknown) {
    if (typeof value !== "string") return [];
    const trimmed = value.trim();
    if (!trimmed) return [];

    const ids: string[] = [];
    const add = (raw: string | null | undefined) => {
      if (!raw) return;
      let decoded = raw;
      try {
        decoded = decodeURIComponent(raw);
      } catch {
        decoded = raw;
      }
      const id = decoded.trim();
      if (
        id &&
        id !== "api" &&
        id !== "storage" &&
        id !== "file" &&
        id !== "files"
      ) {
        ids.push(id);
      }
    };

    for (const match of trimmed.matchAll(/[?&]storageId=([^&#]*)/g)) {
      add(match[1]);
    }

    const path = trimmed.split("#")[0]?.split("?")[0] ?? trimmed;
    if (!path.includes("/")) {
      add(path);
      return [...new Set(ids)];
    }

    add(path.split("/").filter(Boolean).pop());
    return [...new Set(ids)];
  }

  static receiptFileValues(receipts: unknown) {
    if (receipts == null) return [];
    if (!Array.isArray(receipts)) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }
    return receipts.map((receipt) => {
      if (!receipt || typeof receipt !== "object") return undefined;
      return "receiptFile" in receipt
        ? (receipt as { receiptFile?: unknown }).receiptFile
        : undefined;
    });
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

  static storageIdsFromValues(values: unknown[]) {
    const ids = new Set<string>();
    for (const value of values) {
      if (value == null) continue;
      if (typeof value !== "string") {
        throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
      }
      if (!value.trim()) continue;
      const extracted = ReimbursementStorageAccess.extractStorageIds(value);
      if (extracted.length === 0) {
        throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
      }
      for (const id of extracted) ids.add(id);
    }
    return [...ids] as Id<"_storage">[];
  }

  static async assertCanAttachAndConsume(
    ctx: StorageLookupCtx,
    user: ReimbursementStorageUser,
    values: unknown[],
    nowMs = Date.now(),
  ) {
    const storageIds = ReimbursementStorageAccess.storageIdsFromValues(values);
    const pendingIds: Id<"pendingReimbursementUploads">[] = [];

    for (const storageId of storageIds) {
      await ReimbursementStorageAccess.assertRecentOwnedUpload(
        ctx,
        user,
        storageId,
        nowMs,
      );
      const pending = await ReimbursementStorageAccess.findPendingUpload(
        ctx,
        storageId,
      );
      if (!pending?._id) {
        throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
      }
      pendingIds.push(pending._id);
    }

    for (const pendingId of pendingIds) {
      await ctx.db.delete(pendingId);
    }
  }
}
