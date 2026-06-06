import { internalMutation } from "../_generated/server";

/**
 * Clears legacy string `resume` values before deploying the structured resume schema.
 * Run once via the Convex dashboard or CLI before pushing the schema change.
 */
export const clearLegacyResumeStrings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let cleared = 0;

    for (const user of users) {
      const resume = user.resume as unknown;
      if (resume !== undefined && typeof resume === "string") {
        await ctx.db.patch(user._id, { resume: undefined });
        cleared += 1;
      }
    }

    return { cleared };
  },
});
