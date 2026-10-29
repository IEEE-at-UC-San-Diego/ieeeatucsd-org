import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
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

export type ReimbursementUploadTicket = {
  _id?: Id<"reimbursementUploadTickets">;
  tokenHash: string;
  uploadedBy: string;
  createdAt: number;
  storageId?: Id<"_storage">;
};

type StorageReadCtx = Pick<QueryCtx, "db">;
type StorageUrlCtx = {
  storage?: Pick<MutationCtx["storage"], "getUrl">;
};
type StorageLookupCtx = Pick<MutationCtx, "db"> & StorageUrlCtx;

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
 *
 * Upload ownership is established when the caller-specific ticket from
 * `generateUploadUrl` is consumed by the HTTP upload action after
 * `ctx.storage.store`. `registerPendingUpload` only confirms that claim;
 * it cannot first-claim an arbitrary storage ID.
 */
export class ReimbursementStorageAccess {
  static readonly UNAUTHORIZED = "Unauthorized";
  static readonly RECENT_UNREFERENCED_UPLOAD_MS = 15 * 60 * 1000;

  static callerId(user: ReimbursementStorageUser) {
    return user.logtoId ?? user.authUserId ?? "";
  }

  static createToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  }

  static async hashToken(token: string) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token),
    );
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }

  static siteUrl() {
    const explicit =
      process.env.CONVEX_SITE_URL ||
      process.env.CONVEX_SITE_ORIGIN ||
      process.env.VITE_CONVEX_SITE_URL;
    if (explicit) return explicit.replace(/\/$/, "");

    const backend =
      process.env.CONVEX_URL ||
      process.env.CONVEX_SELF_HOSTED_URL ||
      process.env.VITE_CONVEX_URL;
    if (backend) {
      try {
        const url = new URL(backend);
        if (url.hostname.endsWith(".convex.cloud")) {
          url.hostname = url.hostname.replace(/\.convex\.cloud$/, ".convex.site");
          url.port = "";
          return url.origin;
        }
        if (url.port === "3210") {
          url.port = "3211";
          return url.origin;
        }
      } catch {
        // Fall through to the explicit error below.
      }
    }
    throw new Error("CONVEX_SITE_URL is not configured");
  }

  static uploadUrlForToken(token: string) {
    return `${ReimbursementStorageAccess.siteUrl()}/reimbursement-upload?token=${encodeURIComponent(token)}`;
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
    ctx: StorageReadCtx,
    storageId: Id<"_storage">,
  ) {
    return await ctx.db
      .query("pendingReimbursementUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first();
  }

  static async findPendingUploadsByUploader(
    ctx: StorageReadCtx,
    uploadedBy: string,
  ) {
    return await ctx.db
      .query("pendingReimbursementUploads")
      .withIndex("by_uploadedBy", (q) => q.eq("uploadedBy", uploadedBy))
      .collect();
  }

  /**
   * Self-hosted Convex `getUrl` returns `/api/storage/{file-uuid}`, not the
   * `_storage` document id. Cloud URLs still embed the document id. Attach
   * accepts either form only when it maps to this caller's pending claim.
   */
  static async resolveOwnedPendingStorageId(
    ctx: StorageLookupCtx,
    user: ReimbursementStorageUser,
    value: string,
  ) {
    const extracted = ReimbursementStorageAccess.extractStorageIds(value);
    if (extracted.length === 0) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }

    for (const id of extracted) {
      const pending = await ReimbursementStorageAccess.findPendingUpload(
        ctx,
        id as Id<"_storage">,
      );
      if (pending) return id as Id<"_storage">;
    }

    const userId = ReimbursementStorageAccess.callerId(user);
    if (!userId || !ctx.storage?.getUrl) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }

    const extractedKeys = new Set(extracted);
    const pendings = await ReimbursementStorageAccess.findPendingUploadsByUploader(
      ctx,
      userId,
    );
    for (const pending of pendings) {
      const url = await ctx.storage.getUrl(pending.storageId);
      if (!url) continue;
      if (value === url) return pending.storageId;
      const urlKeys = ReimbursementStorageAccess.extractStorageIds(url);
      if (urlKeys.some((key) => extractedKeys.has(key))) {
        return pending.storageId;
      }
    }

    throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
  }

  static async assertRecentOwnedUpload(
    ctx: StorageReadCtx,
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

  static async findUploadTicket(
    ctx: StorageReadCtx,
    tokenHash: string,
  ) {
    return await ctx.db
      .query("reimbursementUploadTickets")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();
  }

  static async issueUploadTicket(
    ctx: StorageLookupCtx,
    user: ReimbursementStorageUser,
    nowMs = Date.now(),
    token = ReimbursementStorageAccess.createToken(),
  ) {
    const userId = ReimbursementStorageAccess.callerId(user);
    if (!userId) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }

    const tokenHash = await ReimbursementStorageAccess.hashToken(token);
    await ctx.db.insert("reimbursementUploadTickets", {
      tokenHash,
      uploadedBy: userId,
      createdAt: nowMs,
    });
    return token;
  }

  static async assertUploadTicket(
    ctx: StorageReadCtx,
    token: string,
    nowMs = Date.now(),
  ) {
    if (!token) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }
    const tokenHash = await ReimbursementStorageAccess.hashToken(token);
    const ticket = await ReimbursementStorageAccess.findUploadTicket(
      ctx,
      tokenHash,
    );
    if (!ticket) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }
    if (
      nowMs - ticket.createdAt >
      ReimbursementStorageAccess.RECENT_UNREFERENCED_UPLOAD_MS
    ) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }
    return ticket;
  }

  static async referencedReimbursements(
    ctx: StorageReadCtx,
    storageId: Id<"_storage">,
  ) {
    const reimbursements = await ctx.db.query("reimbursements").collect();
    return reimbursements.filter((reimbursement) =>
      ReimbursementStorageAccess.reimbursementReferencesStorageId(
        reimbursement,
        storageId,
      ),
    );
  }

  static async completeTicketedUpload(
    ctx: StorageLookupCtx,
    token: string,
    storageId: Id<"_storage">,
    nowMs = Date.now(),
  ) {
    const ticket = await ReimbursementStorageAccess.assertUploadTicket(
      ctx,
      token,
      nowMs,
    );
    if (ticket.storageId && ticket.storageId !== storageId) {
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
    if (metadata._creationTime + 1000 < ticket.createdAt) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }

    const referenced = await ReimbursementStorageAccess.referencedReimbursements(
      ctx,
      storageId,
    );
    if (referenced.length > 0) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }

    const existing = await ReimbursementStorageAccess.findPendingUpload(
      ctx,
      storageId,
    );
    if (existing) {
      if (existing.uploadedBy !== ticket.uploadedBy) {
        throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
      }
    } else {
      await ctx.db.insert("pendingReimbursementUploads", {
        storageId,
        uploadedBy: ticket.uploadedBy,
        createdAt: nowMs,
      });
    }

    if (ticket._id && ticket.storageId !== storageId) {
      await ctx.db.patch(ticket._id, { storageId });
    }

    return {
      storageId,
      uploadedBy: ticket.uploadedBy,
      createdAt: nowMs,
    };
  }

  static async registerPendingUpload(
    ctx: StorageReadCtx,
    user: ReimbursementStorageUser,
    storageId: Id<"_storage">,
    nowMs = Date.now(),
  ) {
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
    if (!pending) {
      throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
    }
    return pending;
  }

  static async assertCanResolve(
    ctx: StorageReadCtx,
    user: ReimbursementStorageUser,
    storageId: Id<"_storage">,
    nowMs = Date.now(),
  ) {
    const referenced = await ReimbursementStorageAccess.referencedReimbursements(
      ctx,
      storageId,
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

  static async storageIdsFromValues(
    ctx: StorageLookupCtx,
    user: ReimbursementStorageUser,
    values: unknown[],
  ) {
    const ids = new Set<string>();
    for (const value of values) {
      if (value == null) continue;
      if (typeof value !== "string") {
        throw new Error(ReimbursementStorageAccess.UNAUTHORIZED);
      }
      if (!value.trim()) continue;
      const resolved = await ReimbursementStorageAccess.resolveOwnedPendingStorageId(
        ctx,
        user,
        value,
      );
      ids.add(resolved);
    }
    return [...ids] as Id<"_storage">[];
  }

  static async assertCanAttachAndConsume(
    ctx: StorageLookupCtx,
    user: ReimbursementStorageUser,
    values: unknown[],
    nowMs = Date.now(),
  ) {
    const storageIds = await ReimbursementStorageAccess.storageIdsFromValues(
      ctx,
      user,
      values,
    );
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
