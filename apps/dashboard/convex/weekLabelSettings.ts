import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireOfficerAccess } from "./permissions";

export const get = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const settings = await ctx.db.query("organizationSettings").first();

    return {
      fallWeek0Start: settings?.fallWeek0Start ?? "",
      winterWeek1Start: settings?.winterWeek1Start ?? "",
      springWeek1Start: settings?.springWeek1Start ?? "",
    };
  },
});

export const update = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    fallWeek0Start: v.optional(v.string()),
    winterWeek1Start: v.optional(v.string()),
    springWeek1Start: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireOfficerAccess(ctx, args.logtoId, args.authToken);
    const userId = user.logtoId ?? user.authUserId ?? "";
    const existing = await ctx.db.query("organizationSettings").first();

    const patch = {
      fallWeek0Start: args.fallWeek0Start,
      winterWeek1Start: args.winterWeek1Start,
      springWeek1Start: args.springWeek1Start,
      updatedBy: userId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("organizationSettings", patch);
  },
});
