import { internalMutation } from "../_generated/server";
import { storedIeeeEmailAfterBackfill } from "../mailboxClaim";

/**
 * Lowercase legacy ieeeEmail values so by_ieeeEmail matches the canonical mailbox.
 *
 *   pnpm exec convex run migrations/lowercaseIeeeEmails:lowercaseIeeeEmails '{}'
 */
export const lowercaseIeeeEmails = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let updated = 0;
    let unchanged = 0;
    for (const user of users) {
      const next = storedIeeeEmailAfterBackfill(user.ieeeEmail);
      if (!next.changed) {
        if (user.ieeeEmail !== undefined) unchanged += 1;
        continue;
      }
      await ctx.db.patch(user._id, { ieeeEmail: next.ieeeEmail });
      updated += 1;
    }
    return { updated, unchanged };
  },
});
