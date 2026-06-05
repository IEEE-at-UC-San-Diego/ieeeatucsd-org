import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  requireCurrentUser,
  requireOfficerAccess,
  requireAdminAccess,
} from "./permissions";

// Fund Request Queries
export const listMine = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    return await ctx.db
      .query("fundRequests")
      .withIndex("by_requestedBy", (q) => q.eq("requestedBy", userId))
      .collect();
  },
});

export const listAll = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    return await ctx.db.query("fundRequests").collect();
  },
});

export const get = query({
  args: { logtoId: v.string(), authToken: v.string(), id: v.id("fundRequests") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const request = await ctx.db.get(args.id);
    if (!request) return null;

    const userId = user.logtoId ?? user.authUserId ?? "";
    const canManage = user.role === "Administrator" || user.role === "Executive Officer" || user.role === "General Officer";
    if (!canManage && request.requestedBy !== userId) {
      throw new Error("Unauthorized");
    }

    return request;
  },
});

export const listByDepartment = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    department: v.union(
      v.literal("events"),
      v.literal("projects"),
      v.literal("internal"),
      v.literal("other"),
    ),
    startDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const requests = await ctx.db
      .query("fundRequests")
      .withIndex("by_department", (q) => q.eq("department", args.department))
      .collect();

    let filtered = requests.filter((r) => r.status !== "draft");
    if (args.startDate !== undefined) {
      filtered = filtered.filter((r) => r.createdAt >= args.startDate!);
    }
    return filtered;
  },
});

export const listByStatus = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("needs_info"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("completed"),
    ),
    department: v.union(
      v.literal("events"),
      v.literal("projects"),
      v.literal("internal"),
      v.literal("other"),
    ),
  },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const statusFilter = await ctx.db
      .query("fundRequests")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();

    if (args.department) {
      return statusFilter.filter((r) => r.department === args.department);
    }
    return statusFilter;
  },
});

export const create = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    title: v.string(),
    purpose: v.string(),
    category: v.union(
      v.literal("event"),
      v.literal("travel"),
      v.literal("equipment"),
      v.literal("software"),
      v.literal("other"),
      v.literal("general"),
      v.literal("projects"),
    ),
    department: v.union(
      v.literal("events"),
      v.literal("projects"),
      v.literal("internal"),
      v.literal("other"),
    ),
    amount: v.number(),
    fundSource: v.optional(v.union(v.literal("ece"), v.literal("ieee"), v.literal("other"))),
    vendorLinks: v.optional(
      v.array(
        v.object({
          id: v.string(),
          url: v.string(),
          itemName: v.optional(v.string()),
          quantity: v.optional(v.number()),
        }),
      ),
    ),
    attachments: v.optional(
      v.array(
        v.object({
          id: v.string(),
          url: v.string(),
          name: v.string(),
          size: v.number(),
          type: v.string(),
          uploadedAt: v.number(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    const { logtoId, authToken, ...data } = args;
    const now = Date.now();

    const auditLogId = crypto.randomUUID();
    const auditLogs = [
      {
        id: auditLogId,
        action: "created" as const,
        performedBy: userId,
        performedByName: user.name,
        timestamp: now,
        newStatus: "submitted" as const,
      },
    ];

    return await ctx.db.insert("fundRequests", {
      ...data,
      status: "submitted" as const,
      requestedBy: userId,
      submittedBy: userId,
      submittedByName: user.name,
      submittedByEmail: user.email,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
      auditLogs,
    });
  },
});

export const update = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("fundRequests"),
    title: v.optional(v.string()),
    purpose: v.optional(v.string()),
    category: v.union(
      v.literal("event"),
      v.literal("travel"),
      v.literal("equipment"),
      v.literal("software"),
      v.literal("other"),
      v.literal("general"),
      v.literal("projects"),
    ),
    department: v.union(
      v.literal("events"),
      v.literal("projects"),
      v.literal("internal"),
      v.literal("other"),
    ),
    amount: v.optional(v.number()),
    fundSource: v.optional(v.union(v.literal("ece"), v.literal("ieee"), v.literal("other"))),
    vendorLinks: v.optional(
      v.array(
        v.object({
          id: v.string(),
          url: v.string(),
          itemName: v.optional(v.string()),
          quantity: v.optional(v.number()),
        }),
      ),
    ),
    attachments: v.optional(
      v.array(
        v.object({
          id: v.string(),
          url: v.string(),
          name: v.string(),
          size: v.number(),
          type: v.string(),
          uploadedAt: v.number(),
        }),
      ),
    ),
    infoResponseNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    const { id, logtoId, authToken, ...data } = args;

    const existingRequest = await ctx.db.get(id);
    if (!existingRequest) {
      throw new Error("Fund request not found");
    }

    // Only the request owner can update their own fund request
    if (existingRequest.requestedBy !== userId) {
      throw new Error("You can only edit your own fund requests");
    }

    const now = Date.now();
    const auditLog = {
      id: crypto.randomUUID(),
      action: (existingRequest.status === "needs_info" ? "info_provided" : "updated") as
        | "info_provided"
        | "updated",
      performedBy: userId,
      performedByName: user.name,
      timestamp: now,
      previousStatus: existingRequest.status,
      newStatus: "submitted" as const,
    };

    const auditLogs = [...(existingRequest.auditLogs || []), auditLog];

    await ctx.db.patch(id, {
      ...data,
      status: "submitted" as const,
      updatedAt: now,
      auditLogs: auditLogs as any,
      submittedAt: now,
    });

    return id;
  },
});

export const updateStatus = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("fundRequests"),
    status: v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("needs_info"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("completed"),
    ),
    reviewNotes: v.optional(v.string()),
    infoRequestNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const { id, status, reviewNotes, infoRequestNotes } = args;
    const adminId = admin.logtoId ?? admin.authUserId ?? "";

    const existingRequest = await ctx.db.get(id);
    if (!existingRequest) {
      throw new Error("Fund request not found");
    }

    const now = Date.now();
    const auditLog = {
      id: crypto.randomUUID(),
      action: status === "needs_info" ? ("info_requested" as const) : status,
      performedBy: adminId,
      performedByName: admin.name,
      timestamp: now,
      previousStatus: existingRequest.status,
      newStatus: status,
      notes: reviewNotes || infoRequestNotes,
    };

    const auditLogs = [...(existingRequest.auditLogs || []), auditLog];

    await ctx.db.patch(id, {
      status,
      updatedAt: now,
      reviewNotes,
      infoRequestNotes,
      auditLogs: auditLogs as any,
    });

    return id;
  },
});

export const updateFundSource = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("fundRequests"),
    fundSource: v.union(v.literal("ece"), v.literal("ieee"), v.literal("other")),
  },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const { id, fundSource } = args;

    const existingRequest = await ctx.db.get(id);
    if (!existingRequest) {
      throw new Error("Fund request not found");
    }

    const now = Date.now();
    await ctx.db.patch(id, {
      fundSource,
      updatedAt: now,
    });

    return id;
  },
});

export const deleteRequest = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("fundRequests"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";

    const request = await ctx.db.get(args.id);
    if (!request) {
      throw new Error("Fund request not found");
    }

    if (request.requestedBy !== userId) {
      throw new Error("You can only delete your own requests");
    }

    if (request.status !== "draft") {
      throw new Error("You can only delete draft requests");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Budget Configuration Queries
export const getBudgetConfig = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    department: v.union(
      v.literal("events"),
      v.literal("projects"),
      v.literal("internal"),
      v.literal("other"),
    ),
  },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const config = await ctx.db
      .query("budgetConfigs")
      .withIndex("by_department", (q) => q.eq("department", args.department))
      .first();
    return config;
  },
});

export const getAllBudgetConfigs = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    return await ctx.db.query("budgetConfigs").collect();
  },
});

export const createBudgetConfig = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    department: v.union(
      v.literal("events"),
      v.literal("projects"),
      v.literal("internal"),
      v.literal("other"),
    ),
    totalBudget: v.number(),
    startDate: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const admin = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const adminId = admin.logtoId ?? admin.authUserId ?? "";
    const { logtoId, authToken, ...data } = args;

    const now = Date.now();
    return await ctx.db.insert("budgetConfigs", {
      ...data,
      updatedAt: now,
      updatedBy: adminId,
      updatedByName: admin.name,
    });
  },
});

export const updateBudgetConfig = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    department: v.union(
      v.literal("events"),
      v.literal("projects"),
      v.literal("internal"),
      v.literal("other"),
    ),
    totalBudget: v.optional(v.number()),
    startDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const admin = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const adminId = admin.logtoId ?? admin.authUserId ?? "";
    const { logtoId, authToken, department, ...data } = args;

    const config = await ctx.db
      .query("budgetConfigs")
      .withIndex("by_department", (q) => q.eq("department", department))
      .first();

    const now = Date.now();
    const updateData = {
      ...data,
      department,
      updatedAt: now,
      updatedBy: adminId,
      updatedByName: admin.name,
    };

    if (!config) {
      if (data.totalBudget === undefined || data.startDate === undefined) {
        throw new Error(
          "Budget config does not exist. totalBudget and startDate are required to create it.",
        );
      }
      const createData = {
        ...updateData,
        totalBudget: data.totalBudget,
        startDate: data.startDate,
      };
      return await ctx.db.insert("budgetConfigs", createData);
    }

    await ctx.db.patch(config._id, updateData);
    return config._id;
  },
});

// Budget Adjustment Queries
export const getBudgetAdjustments = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    department: v.union(
      v.literal("events"),
      v.literal("projects"),
      v.literal("internal"),
      v.literal("other"),
    ),
  },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    return await ctx.db
      .query("budgetAdjustments")
      .withIndex("by_department", (q) => q.eq("department", args.department))
      .collect();
  },
});

export const createBudgetAdjustment = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    department: v.union(
      v.literal("events"),
      v.literal("projects"),
      v.literal("internal"),
      v.literal("other"),
    ),
    amount: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const admin = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const adminId = admin.logtoId ?? admin.authUserId ?? "";
    const { logtoId, authToken, ...data } = args;

    const now = Date.now();
    return await ctx.db.insert("budgetAdjustments", {
      ...data,
      createdAt: now,
      createdBy: adminId,
      createdByName: admin.name,
    });
  },
});

export const deleteBudgetAdjustment = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("budgetAdjustments"),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const adjustment = await ctx.db.get(args.id);

    if (!adjustment) {
      throw new Error("Budget adjustment not found");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Budget Stats Query
export const getBudgetStats = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    department: v.union(
      v.literal("events"),
      v.literal("projects"),
      v.literal("internal"),
      v.literal("other"),
    ),
  },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);

    // Get budget config
    const config = await ctx.db
      .query("budgetConfigs")
      .withIndex("by_department", (q) => q.eq("department", args.department))
      .first();

    const totalBudget = config?.totalBudget || 0;
    const startDate = config?.startDate ? config.startDate : 0;

    // Get all fund requests for this department
    const requests = await ctx.db
      .query("fundRequests")
      .withIndex("by_department", (q) => q.eq("department", args.department))
      .collect();

    // Filter by start date and status
    const deptRequests = requests.filter((r) => r.status !== "draft" && r.createdAt >= startDate);

    // Get budget adjustments
    const adjustments = await ctx.db
      .query("budgetAdjustments")
      .withIndex("by_department", (q) => q.eq("department", args.department))
      .collect();

    const adjustmentsTotal = adjustments.reduce((sum, a) => sum + a.amount, 0);

    // Calculate used budget
    const requestsUsed = deptRequests
      .filter((r) => r.status === "approved" || r.status === "completed")
      .reduce((sum, r) => sum + r.amount, 0);

    const usedBudget = requestsUsed + adjustmentsTotal;

    // Calculate pending budget
    const pendingBudget = deptRequests
      .filter((r) => r.status === "submitted" || r.status === "needs_info")
      .reduce((sum, r) => sum + r.amount, 0);

    const remainingBudget = totalBudget - usedBudget - pendingBudget;
    const percentUsed = totalBudget > 0 ? ((usedBudget + pendingBudget) / totalBudget) * 100 : 0;

    return {
      totalBudget,
      usedBudget,
      pendingBudget,
      remainingBudget,
      percentUsed,
      startDate,
      adjustmentsTotal,
      isConfigured: !!config,
    };
  },
});
