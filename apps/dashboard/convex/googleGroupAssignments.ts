import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminAccess } from "./permissions";

export const create = mutation({
  args: {
    email: v.string(),
    googleGroup: v.string(),
    role: v.optional(v.string()),
    success: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("googleGroupAssignments", {
      email: args.email,
      googleGroup: args.googleGroup,
      role: args.role,
      assignedAt: Date.now(),
      success: args.success,
      error: args.error,
    });
  },
});

export const list = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    return await ctx.db.query("googleGroupAssignments").collect();
  },
});
