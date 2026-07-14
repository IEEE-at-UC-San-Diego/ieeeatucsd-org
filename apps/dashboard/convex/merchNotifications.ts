import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { v } from "convex/values";
import { requireMerchManager } from "./lib/merchAuth";
import { retryDelayMs, shouldDeliverInApp } from "./lib/merchValidation";

const MAX_ATTEMPTS = 5;
const PROCESSING_TIMEOUT_MS = 10 * 60_000;

export const claimNext = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db
      .query("merchNotificationOutbox")
      .withIndex("by_state_nextAttemptAt", (q) => q.eq("state", "processing"))
      .take(100);
    for (const item of stale) {
      if ((item.processingStartedAt ?? item.updatedAt) <= now - PROCESSING_TIMEOUT_MS) {
        await ctx.db.patch(item._id, {
          state: item.attempts >= MAX_ATTEMPTS ? "dead_letter" : "pending",
          nextAttemptAt: now,
          lastError: "Processor lease expired",
          updatedAt: now,
        });
      }
    }

    const item = await ctx.db
      .query("merchNotificationOutbox")
      .withIndex("by_state_nextAttemptAt", (q) =>
        q.eq("state", "pending").lte("nextAttemptAt", now),
      )
      .first();
    if (!item) return null;
    const attempts = item.attempts + 1;
    await ctx.db.patch(item._id, {
      state: "processing",
      attempts,
      processingStartedAt: now,
      updatedAt: now,
    });

    // Dashboard notifications are committed independently from email delivery.
    if (shouldDeliverInApp(item.inAppDeliveredAt)) {
      const user = await ctx.db.get(item.recipientUserId);
      const userId = user?.logtoId ?? user?.authUserId;
      if (userId) {
        const titles = {
          order_confirmation: "Merch order confirmed",
          rescheduled: "Merch pickup rescheduled",
          canceled_refunded: "Merch order canceled and refunded",
          fulfilled: "Merch order picked up",
        } as const;
        await ctx.db.insert("notifications", {
          userId,
          type: `merch_${item.kind}`,
          title: titles[item.kind],
          message: `Order update: ${String(item.payload?.orderNumber ?? "your merch order")}`,
          data: { orderId: item.orderId, kind: item.kind },
          read: false,
          createdAt: now,
        });
      }
      await ctx.db.patch(item._id, { inAppDeliveredAt: now });
    }
    return { ...item, attempts };
  },
});

export const markSent = internalMutation({
  args: { outboxId: v.id("merchNotificationOutbox") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.outboxId);
    if (!item || item.state === "sent") return;
    const now = Date.now();
    await ctx.db.patch(item._id, {
      state: "sent",
      sentAt: now,
      processingStartedAt: undefined,
      lastError: undefined,
      updatedAt: now,
    });
  },
});

export const markFailed = internalMutation({
  args: { outboxId: v.id("merchNotificationOutbox"), error: v.string() },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.outboxId);
    if (!item || item.state === "sent") return;
    const now = Date.now();
    const dead = item.attempts >= MAX_ATTEMPTS;
    await ctx.db.patch(item._id, {
      state: dead ? "dead_letter" : "pending",
      nextAttemptAt: dead ? now : now + retryDelayMs(item.attempts),
      processingStartedAt: undefined,
      lastError: args.error.slice(0, 1_000),
      updatedAt: now,
    });
  },
});

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const scheduledProcess = internalAction({
  args: {},
  handler: async (ctx) => {
    for (let processed = 0; processed < 25; processed += 1) {
      const item = await ctx.runMutation(internal.merchNotifications.claimNext, {});
      if (!item) break;
      try {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) throw new Error("Missing RESEND_API_KEY");
        const subjectByKind = {
          order_confirmation: "Your IEEE merch order is confirmed",
          rescheduled: "Your IEEE merch pickup was rescheduled",
          canceled_refunded: "Your IEEE merch order was canceled and refunded",
          fulfilled: "Your IEEE merch order was picked up",
        } as const;
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": item.idempotencyKey,
          },
          body: JSON.stringify({
            from: process.env.MERCH_EMAIL_FROM ?? "IEEE at UCSD <noreply@ieeeatucsd.org>",
            to: [item.recipientEmail],
            subject: subjectByKind[item.kind],
            html: `<h1>${escapeHtml(subjectByKind[item.kind])}</h1><p>Order ${escapeHtml(item.payload?.orderNumber)}</p><p>Sign in to the IEEE at UCSD dashboard for details.</p>`,
          }),
        });
        if (!response.ok) {
          throw new Error(`Resend returned ${response.status}: ${(await response.text()).slice(0, 500)}`);
        }
        await ctx.runMutation(internal.merchNotifications.markSent, {
          outboxId: item._id,
        });
      } catch (error) {
        await ctx.runMutation(internal.merchNotifications.markFailed, {
          outboxId: item._id,
          error: error instanceof Error ? error.message : "Unknown email delivery error",
        });
      }
    }
  },
});

export const listForManager = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    state: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("sent"),
        v.literal("dead_letter"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    await requireMerchManager(ctx, args.logtoId, args.authToken);
    const rows = args.state
      ? await ctx.db
          .query("merchNotificationOutbox")
          .withIndex("by_state_nextAttemptAt", (q) => q.eq("state", args.state!))
          .take(250)
      : await ctx.db.query("merchNotificationOutbox").order("desc").take(250);
    return rows.map(({ payload, ...row }) => ({
      ...row,
      orderNumber: payload?.orderNumber,
    }));
  },
});

export const retryDeadLetter = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    outboxId: v.id("merchNotificationOutbox"),
  },
  handler: async (ctx, args) => {
    await requireMerchManager(ctx, args.logtoId, args.authToken);
    const item = await ctx.db.get(args.outboxId);
    if (!item) throw new Error("Outbox item not found");
    if (item.state !== "dead_letter") throw new Error("Only dead letters can be retried");
    const now = Date.now();
    await ctx.db.patch(item._id, {
      state: "pending",
      attempts: 0,
      nextAttemptAt: now,
      lastError: undefined,
      updatedAt: now,
    });
  },
});
