import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminAccess } from "./permissions";

export const get = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    return await ctx.db.query("organizationSettings").first();
  },
});

export const getPublicOnboardingEmailConfig = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("organizationSettings").first();
    return {
      googleSheetsContactListUrl: settings?.googleSheetsContactListUrl,
      directOnboardingEmailTemplate: settings?.directOnboardingEmailTemplate,
    };
  },
});

export const update = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    googleSheetsContactListUrl: v.optional(v.string()),
    directOnboardingEmailTemplate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const adminId = admin.logtoId ?? admin.authUserId ?? "";
    const existing = await ctx.db.query("organizationSettings").first();

    const data = {
      googleSheetsContactListUrl: args.googleSheetsContactListUrl,
      directOnboardingEmailTemplate: args.directOnboardingEmailTemplate,
      updatedBy: adminId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("organizationSettings", data);
  },
});
