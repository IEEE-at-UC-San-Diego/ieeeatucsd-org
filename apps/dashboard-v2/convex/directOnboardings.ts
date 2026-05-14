import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminAccess } from "./permissions";

export const list = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    return await ctx.db.query("directOnboardings").collect();
  },
});

export const create = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    name: v.string(),
    email: v.string(),
    role: v.string(),
    position: v.string(),
    team: v.optional(v.string()),
    emailSent: v.boolean(),
    googleGroupAssigned: v.boolean(),
    googleGroup: v.optional(v.string()),
    logtoRoleGranted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const adminId = admin.logtoId ?? admin.authUserId ?? "";
    const { logtoId, authToken, ...rest } = args;
    const now = Date.now();
    return await ctx.db.insert("directOnboardings", {
      ...rest,
      onboardedBy: adminId,
      onboardedAt: now,
      ...(args.logtoRoleGranted && { logtoRoleGrantedAt: now }),
    });
  },
});

export const updateGoogleGroup = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    id: v.id("directOnboardings"),
    googleGroupAssigned: v.boolean(),
    googleGroup: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    await ctx.db.patch(args.id, {
      googleGroupAssigned: args.googleGroupAssigned,
      googleGroup: args.googleGroup,
    });
    return args.id;
  },
});
