import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminAccess } from "./permissions";

export const list = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx, args.logtoId, args.authToken);
    return await ctx.db.query("officerRejections").order("desc").collect();
  },
});

export const create = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    name: v.string(),
    email: v.string(),
    positions: v.array(v.string()),
    customMessage: v.optional(v.string()),
    emailSent: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminAccess(ctx, args.logtoId, args.authToken);
    const adminId = admin.logtoId ?? admin.authUserId ?? "";
    const { logtoId, authToken, ...data } = args;
    return await ctx.db.insert("officerRejections", {
      ...data,
      email: data.email.trim().toLowerCase(),
      positions: data.positions.map((position) => position.trim()).filter(Boolean),
      sentBy: adminId,
      sentAt: Date.now(),
    });
  },
});
