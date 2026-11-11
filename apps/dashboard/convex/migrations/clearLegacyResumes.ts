import { internalMutation } from "../_generated/server";
import { patchTracked } from "../storageReferences";

/**
 * One-time migration: clears legacy string `resume` values before the object schema.
 *
 *   pnpm exec convex run migrations/clearLegacyResumes:clearLegacyResumeStrings '{}'
 */
export const clearLegacyResumeStrings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let cleared = 0;

    for (const user of users) {
      const resume = user.resume as unknown;
      if (resume !== undefined && typeof resume === "string") {
        await patchTracked(ctx, "users", user._id, { resume: undefined });
        cleared += 1;
      }
    }

    return { cleared };
  },
});
