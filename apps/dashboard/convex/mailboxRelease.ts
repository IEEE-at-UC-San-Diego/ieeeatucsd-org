import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { canonicalMailbox } from "./mailboxClaim";
import { requireCurrentUser } from "./permissions";

export const releaseIEEEEmail = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    ieeeEmail: v.string(),
    claimToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx, args.logtoId, args.authToken);
    const mailbox = canonicalMailbox(args.ieeeEmail);
    if (!mailbox || canonicalMailbox(user.ieeeEmail ?? "") !== mailbox) {
      return null;
    }
    if (user.ieeeEmailClaimToken !== args.claimToken) {
      return null;
    }
    await ctx.db.patch(user._id, {
      hasIEEEEmail: false,
      ieeeEmail: undefined,
      ieeeEmailClaimToken: undefined,
      ieeeEmailCreatedAt: undefined,
      lastUpdated: Date.now(),
    });
    return user._id;
  },
});
