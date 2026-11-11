import { mutation, query } from "./_generated/server";
import { syncRecordStorage } from "./storageReferences";
import { v } from "convex/values";
import {
  requireCurrentUser,
  requireAdminAccess,
} from "./permissions";
import {
  assertReimbursementDeletable,
  transitionReimbursementPayment,
  transitionReimbursementStatus,
} from "./reimbursementTransition";

export const listMine = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    return await ctx.db
      .query("reimbursements")
      .withIndex("by_submittedBy", (q) => q.eq("submittedBy", userId))
      .collect();
  },
});

export const listAll = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const reimbursements = await ctx.db.query("reimbursements").collect();
    
    // Fetch user information for each reimbursement
    const reimbursementsWithUserInfo = await Promise.all(
      reimbursements.map(async (reimbursement) => {
        const userInfo = await ctx.db
          .query("users")
          .withIndex("by_logtoId", (q) => q.eq("logtoId", reimbursement.submittedBy))
          .first();
        
        return {
          ...reimbursement,
          submittedByName: userInfo?.name || reimbursement.submittedBy,
          submittedByZelle: userInfo?.zelleInformation,
          submittedByEmail: userInfo?.email,
        };
      })
    );
    
    return reimbursementsWithUserInfo;
  },
});

export const get = query({
  args: { logtoId: v.string(), authToken: v.string(), id: v.id("reimbursements") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const reimbursement = await ctx.db.get(args.id);
    if (!reimbursement) return null;

    const userId = user.logtoId ?? user.authUserId ?? "";
    const canManage = user.role === "Administrator" || user.role === "Executive Officer";
    if (!canManage && reimbursement.submittedBy !== userId) {
      throw new Error("Unauthorized");
    }

    return reimbursement;
  },
});

export const create = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    title: v.string(),
    totalAmount: v.number(),
    paymentMethod: v.string(),
    additionalInfo: v.string(),
    department: v.union(
      v.literal("internal"),
      v.literal("external"),
      v.literal("projects"),
      v.literal("events"),
      v.literal("other"),
    ),
    receipts: v.optional(v.any()),
    dateOfPurchase: v.optional(v.number()),
    businessPurpose: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    const { logtoId, authToken, ...data } = args;
    const reimbursementId = await ctx.db.insert("reimbursements", {
      ...data,
      status: "submitted",
      submittedBy: userId,
      auditLogs: [
        {
          action: "submitted",
          createdBy: userId,
          timestamp: Date.now(),
        },
      ],
    });
    await syncRecordStorage(ctx, "reimbursements", reimbursementId);
    return reimbursementId;
  },
});

export const updateStatus = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("reimbursements"),
    status: v.union(
      v.literal("submitted"),
      v.literal("declined"),
      v.literal("approved"),
      v.literal("paid"),
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const adminId = admin.logtoId ?? admin.authUserId ?? "";
    const reimbursement = await ctx.db.get(args.id);
    if (!reimbursement) throw new Error("Reimbursement not found");

    const reason = args.reason?.trim();
    if (args.status === "paid") {
      throw new Error("Mark a reimbursement paid by recording payment details");
    }
    const nextStatus = transitionReimbursementStatus(
      reimbursement.status,
      args.status,
      reason,
    );

    const now = Date.now();
    const auditLogs = [...(reimbursement.auditLogs || [])];
    auditLogs.push({
      action: `status_changed_to_${args.status}`,
      createdBy: adminId,
      timestamp: now,
    });

    const auditNotes = [...(reimbursement.auditNotes || [])];
    if (args.status === "declined" && reason) {
      auditNotes.push({
        note: reason,
        createdBy: adminId,
        timestamp: now,
      });
    }

    await ctx.db.patch(args.id, {
      status: nextStatus,
      auditLogs,
      ...(args.status === "declined" && reason ? { auditNotes } : {}),
    });
    await syncRecordStorage(ctx, "reimbursements", args.id);
    return args.id;
  },
});

export const updatePaymentDetails = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("reimbursements"),
    paymentDetails: v.object({
      confirmationNumber: v.string(),
      paymentDate: v.number(),
      amountPaid: v.number(),
      proofFileUrl: v.optional(v.string()),
      memo: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const adminId = admin.logtoId ?? admin.authUserId ?? "";
    const reimbursement = await ctx.db.get(args.id);
    if (!reimbursement) throw new Error("Reimbursement not found");
    transitionReimbursementPayment(reimbursement.status);

    const auditLogs = reimbursement.auditLogs || [];
    auditLogs.push({
      action: "payment_details_added",
      createdBy: adminId,
      timestamp: Date.now(),
    });

    await ctx.db.patch(args.id, {
      status: "paid",
      paymentDetails: args.paymentDetails,
      auditLogs,
    });
    await syncRecordStorage(ctx, "reimbursements", args.id);
    return args.id;
  },
});

export const remove = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("reimbursements"),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const reimbursement = await ctx.db.get(args.id);
    if (!reimbursement) throw new Error("Reimbursement not found");
    assertReimbursementDeletable(reimbursement.status);
    await ctx.db.delete(args.id);
    await syncRecordStorage(ctx, "reimbursements", args.id);
    return args.id;
  },
});

export const generateUploadUrl = mutation({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx, args.logtoId, args.authToken);
    return await ctx.storage.generateUploadUrl();
  },
});

export const getStorageUrl = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    await requireCurrentUser(ctx, args.logtoId, args.authToken);
    return await ctx.storage.getUrl(args.storageId);
  },
});
