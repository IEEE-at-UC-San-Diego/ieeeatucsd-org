import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { UserAuth } from "./userAuth";

export const applyVerifiedAuthUpsert = internalMutation({
  args: {
    logtoId: v.string(),
    email: v.string(),
    name: v.string(),
    avatar: v.optional(v.string()),
    signInMethod: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await UserAuth.applyVerifiedAuthUpsert(ctx, args);
  },
});
