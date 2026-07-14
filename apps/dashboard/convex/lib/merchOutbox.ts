import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function enqueueMerchNotification(
  ctx: MutationCtx,
  args: {
    orderId: Id<"merchOrders">;
    recipientUserId: Id<"users">;
    recipientEmail: string;
    kind: "order_confirmation" | "rescheduled" | "canceled_refunded" | "fulfilled";
    payload: unknown;
    idempotencyKey: string;
  },
) {
  const existing = await ctx.db
    .query("merchNotificationOutbox")
    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", args.idempotencyKey))
    .unique();
  if (existing) return existing._id;
  const now = Date.now();
  return await ctx.db.insert("merchNotificationOutbox", {
    ...args,
    state: "pending",
    attempts: 0,
    nextAttemptAt: now,
    createdAt: now,
    updatedAt: now,
  });
}
