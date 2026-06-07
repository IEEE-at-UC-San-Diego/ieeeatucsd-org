import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireMerchAdmin, requireMerchOfficer } from "./helpers";
import { isPickupOptionSelectable } from "./pickupHelpers";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ReadinessIssue = {
  code: string;
  message: string;
};

type MerchSettingsDoc = Doc<"merchSettings">;

const DEFAULT_SETTINGS = {
  storeEnabled: false,
  updatedAt: 0,
} as const;

async function loadSettings(ctx: QueryCtx | MutationCtx): Promise<MerchSettingsDoc | null> {
  return ctx.db.query("merchSettings").first();
}

async function getOrCreateSettings(ctx: MutationCtx): Promise<MerchSettingsDoc> {
  const existing = await loadSettings(ctx);
  if (existing) return existing;

  const id = await ctx.db.insert("merchSettings", {
    storeEnabled: false,
    updatedAt: Date.now(),
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Failed to initialize merch settings");
  return created;
}

export async function evaluateStoreReadiness(ctx: QueryCtx | MutationCtx) {
  const issues: ReadinessIssue[] = [];

  const activeReleases = await ctx.db
    .query("merchReleases")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .collect();
  if (activeReleases.length === 0) {
    issues.push({
      code: "no_active_release",
      message: "At least one active release is required",
    });
  }

  let hasInventory = false;
  for (const release of activeReleases) {
    const variants = await ctx.db
      .query("merchVariants")
      .withIndex("by_releaseId", (q) => q.eq("releaseId", release._id))
      .collect();
    for (const variant of variants) {
      if (!variant.enabled) continue;
      const available = variant.onHand - variant.reserved;
      if (available > 0) {
        hasInventory = true;
      }
      if (release.defaultPointPrice <= 0 && variant.pointPriceOverride === undefined) {
        issues.push({
          code: "invalid_price",
          message: `Release ${release._id} has invalid pricing`,
        });
      }
    }

    const product = await ctx.db.get(release.productId);
    if (!product || product.status !== "active") {
      issues.push({
        code: "inactive_product",
        message: "Active release must belong to an active product",
      });
    } else if (!product.primaryImageStorageId || !product.primaryImageAlt.trim()) {
      issues.push({
        code: "missing_product_content",
        message: `${product.name} is missing required image content`,
      });
    }
  }

  if (!hasInventory) {
    issues.push({
      code: "no_inventory",
      message: "At least one variant must have available inventory",
    });
  }

  const pickupOptions = await ctx.db
    .query("merchPickupOptions")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .collect();
  const eligiblePickup = pickupOptions.filter((option) =>
    isPickupOptionSelectable(option),
  );
  if (eligiblePickup.length === 0) {
    issues.push({
      code: "no_pickup",
      message: "At least one eligible pickup option is required",
    });
  }

  const publishedPolicy = await ctx.db
    .query("merchPolicies")
    .withIndex("by_status", (q) => q.eq("status", "published"))
    .first();
  if (!publishedPolicy) {
    issues.push({
      code: "no_policy",
      message: "A published merchandise policy is required",
    });
  }

  return {
    ready: issues.length === 0,
    issues,
    summary: {
      activeReleaseCount: activeReleases.length,
      eligiblePickupCount: eligiblePickup.length,
      hasPublishedPolicy: Boolean(publishedPolicy),
    },
  };
}

export const getSettings = query({
  args: {
    logtoId: v.optional(v.string()),
    authToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.logtoId && args.authToken) {
      await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    }

    const settings = (await loadSettings(ctx)) ?? DEFAULT_SETTINGS;
    const readiness = await evaluateStoreReadiness(ctx);

    return {
      storeEnabled: settings.storeEnabled,
      updatedAt: settings.updatedAt,
      lastToggleReason:
        "lastToggleReason" in settings ? settings.lastToggleReason : undefined,
      lastReadinessCheckAt:
        "lastReadinessCheckAt" in settings
          ? settings.lastReadinessCheckAt
          : undefined,
      readiness,
    };
  },
});

export const getPublicSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = (await loadSettings(ctx)) ?? DEFAULT_SETTINGS;
    const announcement = await ctx.db
      .query("merchAnnouncements")
      .withIndex("by_active", (q) => q.eq("active", true))
      .first();

    const now = Date.now();
    const bannerActive =
      announcement &&
      (announcement.activeFrom === undefined || announcement.activeFrom <= now) &&
      (announcement.activeUntil === undefined || announcement.activeUntil >= now);

    return {
      storeEnabled: settings.storeEnabled,
      announcement: bannerActive
        ? {
            message: announcement.message,
            linkUrl: announcement.linkUrl,
            linkLabel: announcement.linkLabel,
          }
        : null,
    };
  },
});

export const setStoreEnabled = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    enabled: v.boolean(),
    reason: v.string(),
    confirmReadinessBypass: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const officer = await requireMerchAdmin(ctx, args.logtoId, args.authToken);
    if (!args.reason.trim()) throw new Error("Toggle reason is required");

    const settings = await getOrCreateSettings(ctx);
    const readiness = await evaluateStoreReadiness(ctx);

    if (args.enabled && !readiness.ready && !args.confirmReadinessBypass) {
      throw new Error(
        `Store is not ready: ${readiness.issues.map((i) => i.message).join("; ")}`,
      );
    }

    const now = Date.now();
    await ctx.db.patch(settings._id, {
      storeEnabled: args.enabled,
      updatedAt: now,
      updatedBy: officer._id,
      lastToggleReason: args.reason.trim(),
      lastReadinessCheckAt: now,
    });

    return {
      storeEnabled: args.enabled,
      readiness,
    };
  },
});

export const runReadinessCheck = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    return evaluateStoreReadiness(ctx);
  },
});
