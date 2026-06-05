import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  requireOfficerAccess,
  requireAdminAccess,
} from "./permissions";

// Queries
export const listAll = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";

    // Administrators can see all deposits
    if (user.role === "Administrator") {
      return await ctx.db
        .query("fundDeposits")
        .order("desc")
        .collect();
    }

    // Other officers can only see their own deposits
    return await ctx.db
      .query("fundDeposits")
      .withIndex("by_depositedBy", (q) => q.eq("depositedBy", userId))
      .collect();
  },
});

export const listMine = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";

    return await ctx.db
      .query("fundDeposits")
      .withIndex("by_depositedBy", (q) => q.eq("depositedBy", userId))
      .collect();
  },
});

export const listByStatus = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    status: v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);

    // Only admins can filter by status
    if (user.role !== "Administrator") {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("fundDeposits")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

export const get = query({
  args: { logtoId: v.string(), authToken: v.string(), id: v.id("fundDeposits") },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const deposit = await ctx.db.get(args.id);
    if (!deposit) return null;

    const userId = user.logtoId ?? user.authUserId ?? "";
    const canManage = user.role === "Administrator";
    if (!canManage && deposit.depositedBy !== userId) {
      throw new Error("Unauthorized");
    }

    return deposit;
  },
});

export const getStats = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";

    // Get deposits based on role
    const deposits =
      user.role === "Administrator"
        ? await ctx.db.query("fundDeposits").collect()
        : await ctx.db
            .query("fundDeposits")
            .withIndex("by_depositedBy", (q) => q.eq("depositedBy", userId))
            .collect();

    const total = deposits.length;
    const pending = deposits.filter((d) => d.status === "pending").length;
    const verified = deposits.filter((d) => d.status === "verified").length;
    const rejected = deposits.filter((d) => d.status === "rejected").length;
    const totalAmount = deposits
      .filter((d) => d.status === "verified")
      .reduce((sum, d) => sum + d.amount, 0);

    return {
      total,
      pending,
      verified,
      rejected,
      totalAmount,
    };
  },
});

// Mutations
export const create = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    title: v.string(),
    amount: v.number(),
    purpose: v.string(),
    depositDate: v.number(),
    depositMethod: v.union(
      v.literal("cash"),
      v.literal("check"),
      v.literal("bank_transfer"),
      v.literal("other"),
    ),
    otherDepositMethod: v.optional(v.string()),
    description: v.optional(v.string()),
    referenceNumber: v.optional(v.string()),
    receiptFiles: v.optional(v.array(v.string())),
    isIeeeDeposit: v.optional(v.boolean()),
    ieeeDepositSource: v.optional(
      v.union(
        v.literal("upp"),
        v.literal("section"),
        v.literal("region"),
        v.literal("global"),
        v.literal("society"),
        v.literal("other"),
      ),
    ),
    needsBankTransfer: v.optional(v.boolean()),
    bankTransferInstructions: v.optional(v.string()),
    bankTransferFiles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";

    const { logtoId, authToken, ...data } = args;

    // Validate that if depositMethod is "other", otherDepositMethod is provided
    if (
      args.depositMethod === "other" &&
      !args.otherDepositMethod?.trim()
    ) {
      throw new Error(
        "Please specify deposit method when 'Other' is selected"
      );
    }

    // Create initial audit log
    const initialAuditLog = {
      action: "submitted",
      createdBy: userId,
      createdByName: user.name || user.email,
      timestamp: Date.now(),
      note: "Deposit submitted for review",
    };

    return await ctx.db.insert("fundDeposits", {
      ...data,
      depositedBy: userId,
      depositedByName: user.name || user.email,
      depositedByEmail: user.email,
      status: "pending",
      submittedAt: Date.now(),
      auditLogs: [initialAuditLog],
    });
  },
});

export const update = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("fundDeposits"),
    title: v.string(),
    amount: v.number(),
    purpose: v.string(),
    depositDate: v.number(),
    depositMethod: v.union(
      v.literal("cash"),
      v.literal("check"),
      v.literal("bank_transfer"),
      v.literal("other"),
    ),
    otherDepositMethod: v.optional(v.string()),
    description: v.optional(v.string()),
    referenceNumber: v.optional(v.string()),
    receiptFiles: v.optional(v.array(v.string())),
    isIeeeDeposit: v.optional(v.boolean()),
    ieeeDepositSource: v.optional(
      v.union(
        v.literal("upp"),
        v.literal("section"),
        v.literal("region"),
        v.literal("global"),
        v.literal("society"),
        v.literal("other"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";

    // Get the existing deposit
    const deposit = await ctx.db.get(args.id);
    if (!deposit) {
      throw new Error("Deposit not found");
    }

    // Users can only edit their own pending deposits
    if (deposit.depositedBy !== userId && user.role !== "Administrator") {
      throw new Error("Unauthorized");
    }

    if (deposit.status !== "pending") {
      throw new Error("Can only edit pending deposits");
    }

    const { logtoId, authToken, id, ...updateData } = args;

    // Get existing deposit for audit trail
    const previousData = {
      title: deposit.title,
      amount: deposit.amount,
      purpose: deposit.purpose,
      depositDate: deposit.depositDate,
      depositMethod: deposit.depositMethod,
      description: deposit.description,
      referenceNumber: deposit.referenceNumber,
      receiptFiles: deposit.receiptFiles,
      isIeeeDeposit: deposit.isIeeeDeposit,
      ieeeDepositSource: deposit.ieeeDepositSource,
    };

    // Create edit audit log
    const editAuditLog = {
      action: "edited",
      createdBy: userId,
      createdByName: user.name || user.email,
      timestamp: Date.now(),
      note: "Deposit details updated",
      previousData,
      newData: {
        title: args.title,
        amount: args.amount,
        purpose: args.purpose,
        depositDate: args.depositDate,
        depositMethod: args.depositMethod,
        description: args.description,
        referenceNumber: args.referenceNumber,
        receiptFiles: args.receiptFiles,
        isIeeeDeposit: args.isIeeeDeposit,
        ieeeDepositSource: args.ieeeDepositSource,
      },
    };

    // Update deposit
    await ctx.db.patch(args.id, {
      ...updateData,
      editedBy: userId,
      editedByName: user.name || user.email,
      editedAt: Date.now(),
      auditLogs: [...(deposit.auditLogs || []), editAuditLog],
    });

    return args.id;
  },
});

export const updateStatus = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("fundDeposits"),
    status: v.union(v.literal("verified"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const adminId = admin.logtoId ?? admin.authUserId ?? "";

    // Get the existing deposit
    const deposit = await ctx.db.get(args.id);
    if (!deposit) {
      throw new Error("Deposit not found");
    }

    // Prevent status changes if not pending
    if (deposit.status !== "pending") {
      throw new Error("Can only change status of pending deposits");
    }

    // If rejecting, require a reason
    if (args.status === "rejected" && !args.rejectionReason?.trim()) {
      throw new Error("Rejection reason is required");
    }

    // Create status change audit log
    const statusAuditLog = {
      action: args.status,
      createdBy: adminId,
      createdByName: admin.name || admin.email,
      timestamp: Date.now(),
      note: args.rejectionReason || `Status changed to ${args.status}`,
      previousData: { status: deposit.status },
      newData: { status: args.status },
    };

    // Update deposit status
    await ctx.db.patch(args.id, {
      status: args.status,
      verifiedBy: adminId,
      verifiedByName: admin.name || admin.email,
      verifiedAt: Date.now(),
      rejectionReason:
        args.status === "rejected" ? args.rejectionReason : undefined,
      auditLogs: [...(deposit.auditLogs || []), statusAuditLog],
    });

    return args.id;
  },
});

export const deleteRequest = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("fundDeposits"),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";

    // Get the existing deposit
    const deposit = await ctx.db.get(args.id);
    if (!deposit) {
      throw new Error("Deposit not found");
    }

    // Users can only delete their own pending deposits
    if (deposit.depositedBy !== userId && user.role !== "Administrator") {
      throw new Error("Unauthorized");
    }

    if (user.role !== "Administrator" && deposit.status !== "pending") {
      throw new Error("Can only delete pending deposits");
    }

    // Delete the deposit
    await ctx.db.delete(args.id);

    return args.id;
  },
});

export const addReceiptFile = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("fundDeposits"),
    fileUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";

    // Get the existing deposit
    const deposit = await ctx.db.get(args.id);
    if (!deposit) {
      throw new Error("Deposit not found");
    }

    // Users can only add files to their own pending deposits
    if (deposit.depositedBy !== userId && user.role !== "Administrator") {
      throw new Error("Unauthorized");
    }

    if (deposit.status !== "pending") {
      throw new Error("Can only add files to pending deposits");
    }

    // Add the file URL
    await ctx.db.patch(args.id, {
      receiptFiles: [...(deposit.receiptFiles || []), args.fileUrl],
    });

    return args.id;
  },
});

export const removeReceiptFile = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("fundDeposits"),
    fileUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";

    // Get the existing deposit
    const deposit = await ctx.db.get(args.id);
    if (!deposit) {
      throw new Error("Deposit not found");
    }

    // Users can only remove files from their own pending deposits
    if (deposit.depositedBy !== userId && user.role !== "Administrator") {
      throw new Error("Unauthorized");
    }

    if (deposit.status !== "pending") {
      throw new Error("Can only remove files from pending deposits");
    }

    // Remove the file URL
    await ctx.db.patch(args.id, {
      receiptFiles: (deposit.receiptFiles || []).filter(
        (url) => url !== args.fileUrl
      ),
    });

    return args.id;
  },
});

export const generateUploadUrl = mutation({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
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
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    return await ctx.storage.getUrl(args.storageId);
  },
});
