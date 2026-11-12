import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { runStorageReferenceBackfill } from "./storageReferences";

export const backfillStorageReferences = internalMutation({
  args: {},
  handler: async (ctx) => {
    const result = await runStorageReferenceBackfill(ctx);
    if (!result.done) {
      await ctx.scheduler.runAfter(
        0,
        internal.storageReferenceBackfill.backfillStorageReferences,
        {},
      );
    }
    return result;
  },
});
