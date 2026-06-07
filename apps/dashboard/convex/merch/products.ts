import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  buildVariantLabel,
  cartesianProduct,
  generateSkuPrefix,
  getStockDisplay,
  requireMerchAdmin,
  requireMerchCatalogAdmin,
  requireMerchOfficer,
} from "./helpers";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

async function validateProductImageStorage(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
) {
  const metadata = await ctx.db.system.get(storageId);
  if (!metadata) {
    throw new Error("Uploaded image not found");
  }
  const contentType = metadata.contentType ?? "";
  if (contentType && !ALLOWED_IMAGE_TYPES.has(contentType)) {
    await ctx.storage.delete(storageId);
    throw new Error("Image must be JPEG, PNG, WebP, or GIF");
  }
  if (metadata.size > MAX_IMAGE_BYTES) {
    await ctx.storage.delete(storageId);
    throw new Error("Image must be 5MB or smaller");
  }
}

async function getSettings(ctx: { db: { query: (table: "merchSettings") => { first: () => Promise<{ storeEnabled: boolean } | null> } } }) {
  const settings = await ctx.db.query("merchSettings").first();
  return settings ?? { storeEnabled: false };
}

export const getSettingsPublic = query({
  args: { logtoId: v.optional(v.string()), authToken: v.optional(v.string()) },
  handler: async (ctx) => {
    return getSettings(ctx);
  },
});

export const listProducts = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const products = await ctx.db.query("merchProducts").collect();
    const filtered = products
      .filter((p) => args.includeArchived || p.status === "active")
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return Promise.all(
      filtered.map(async (product) => ({
        ...product,
        imageUrl: product.primaryImageStorageId
          ? await ctx.storage.getUrl(product.primaryImageStorageId)
          : null,
      })),
    );
  },
});

export const listStorefront = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const settings = await getSettings(ctx);
    const canPreview = user.role !== "Sponsor";

    if (!settings.storeEnabled && !canPreview) {
      return { mode: "coming_soon" as const, products: [] };
    }

    const products = await ctx.db
      .query("merchProducts")
      .withIndex("by_status_sortOrder", (q) => q.eq("status", "active"))
      .collect();

    const result = [];
    for (const product of products.sort((a, b) => a.sortOrder - b.sortOrder)) {
      const releases = await ctx.db
        .query("merchReleases")
        .withIndex("by_productId", (q) => q.eq("productId", product._id))
        .collect();
      const activeRelease = releases.find((r) => r.status === "active");
      if (!activeRelease) continue;

      const variants = await ctx.db
        .query("merchVariants")
        .withIndex("by_releaseId", (q) => q.eq("releaseId", activeRelease._id))
        .collect();
      const enabledVariants = variants.filter((v) => v.enabled);
      const availableTotal = enabledVariants.reduce(
        (sum, v) => sum + Math.max(0, v.onHand - v.reserved),
        0,
      );
      const imageUrl = product.primaryImageStorageId
        ? await ctx.storage.getUrl(product.primaryImageStorageId)
        : null;

      result.push({
        _id: product._id,
        name: product.name,
        shortDescription: product.shortDescription,
        featured: product.featured,
        imageUrl,
        releaseId: activeRelease._id,
        pointPrice: activeRelease.defaultPointPrice,
        stockDisplay: getStockDisplay(availableTotal, 5),
        preview: !settings.storeEnabled,
      });
    }

    return {
      mode: settings.storeEnabled ? ("live" as const) : ("preview" as const),
      products: result,
    };
  },
});

export const getStorefrontProduct = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    productId: v.id("merchProducts"),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const settings = await getSettings(ctx);

    const product = await ctx.db.get(args.productId);
    if (!product || product.status !== "active") return null;

    const releases = await ctx.db
      .query("merchReleases")
      .withIndex("by_productId", (q) => q.eq("productId", product._id))
      .collect();
    const activeRelease = releases.find((r) => r.status === "active");
    if (!activeRelease) return null;

    const variants = await ctx.db
      .query("merchVariants")
      .withIndex("by_releaseId", (q) => q.eq("releaseId", activeRelease._id))
      .collect();

    const enabledVariants = variants
      .filter((variant) => variant.enabled)
      .map((variant) => {
        const available = Math.max(0, variant.onHand - variant.reserved);
        return {
          _id: variant._id,
          sku: variant.sku,
          label: variant.label,
          optionValues: variant.optionValues,
          pointPrice: variant.pointPriceOverride ?? activeRelease.defaultPointPrice,
          available,
          stockDisplay: getStockDisplay(available, variant.lowStockThreshold),
        };
      });

    const primaryImageUrl = product.primaryImageStorageId
      ? await ctx.storage.getUrl(product.primaryImageStorageId)
      : null;

    const additionalImages = await Promise.all(
      (product.additionalImages ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(async (image) => ({
          alt: image.alt,
          url: await ctx.storage.getUrl(image.storageId),
        })),
    );

    return {
      mode: settings.storeEnabled ? ("live" as const) : ("preview" as const),
      product: {
        _id: product._id,
        name: product.name,
        shortDescription: product.shortDescription,
        detailedDescription: product.detailedDescription ?? null,
        sizingGuide: product.sizingGuide ?? null,
        fulfillmentNotes: product.fulfillmentNotes ?? null,
        primaryImageUrl,
        primaryImageAlt: product.primaryImageAlt,
        additionalImages: additionalImages.filter(
          (image): image is { alt: string; url: string } => image.url !== null,
        ),
      },
      release: {
        _id: activeRelease._id,
        defaultPointPrice: activeRelease.defaultPointPrice,
        releasePurchaseLimit: activeRelease.releasePurchaseLimit ?? null,
        optionGroups: activeRelease.optionGroups,
      },
      variants: enabledVariants,
    };
  },
});

export const createProduct = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    name: v.string(),
    shortDescription: v.string(),
    categoryId: v.id("merchCategories"),
    primaryImageAlt: v.string(),
    primaryImageStorageId: v.optional(v.id("_storage")),
    defaultPointPrice: v.number(),
    releasePurchaseLimit: v.optional(v.number()),
    optionGroups: v.optional(
      v.array(v.object({ name: v.string(), values: v.array(v.string()) })),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireMerchCatalogAdmin(ctx, args.logtoId, args.authToken);
    if (args.primaryImageStorageId) {
      await validateProductImageStorage(ctx, args.primaryImageStorageId);
    }
    const now = Date.now();
    const all = await ctx.db.query("merchProducts").collect();
    const maxOrder = all.reduce((max, p) => Math.max(max, p.sortOrder), 0);

    const productId = await ctx.db.insert("merchProducts", {
      name: args.name.trim(),
      shortDescription: args.shortDescription.trim(),
      primaryImageAlt: args.primaryImageAlt.trim(),
      ...(args.primaryImageStorageId && {
        primaryImageStorageId: args.primaryImageStorageId,
      }),
      categoryId: args.categoryId,
      featured: false,
      sortOrder: maxOrder + 1,
      status: "active",
      createdAt: now,
      createdBy: admin._id,
      updatedAt: now,
    });

    const optionGroups =
      args.optionGroups && args.optionGroups.length > 0
        ? args.optionGroups
        : [{ name: "Default", values: ["Standard"] }];

    const releaseId = await ctx.db.insert("merchReleases", {
      productId,
      releaseNumber: 1,
      status: "active",
      defaultPointPrice: args.defaultPointPrice,
      releasePurchaseLimit: args.releasePurchaseLimit,
      optionGroups,
      structureLocked: false,
      createdAt: now,
      createdBy: admin._id,
      updatedAt: now,
    });

    const combinations = cartesianProduct(optionGroups.map((g) => g.values));
    const skuPrefix = generateSkuPrefix(args.name, 1);

    for (let i = 0; i < combinations.length; i++) {
      const optionValues = combinations[i] ?? ["Standard"];
      await ctx.db.insert("merchVariants", {
        releaseId,
        productId,
        sku: `${skuPrefix}-${String(i + 1).padStart(3, "0")}`,
        optionValues,
        label: buildVariantLabel(optionValues),
        enabled: true,
        onHand: 0,
        reserved: 0,
        returnedPendingInspection: 0,
        lowStockThreshold: 5,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { productId, releaseId };
  },
});

export const updateProduct = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    productId: v.id("merchProducts"),
    name: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    featured: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const { productId, logtoId: _l, authToken: _a, ...updates } = args;
    await ctx.db.patch(productId, { ...updates, updatedAt: Date.now() });
  },
});

export const setProductImage = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    productId: v.id("merchProducts"),
    primaryImageStorageId: v.id("_storage"),
    primaryImageAlt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireMerchCatalogAdmin(ctx, args.logtoId, args.authToken);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    await validateProductImageStorage(ctx, args.primaryImageStorageId);

    const alt =
      args.primaryImageAlt?.trim() || product.primaryImageAlt || product.name;

    await ctx.db.patch(args.productId, {
      primaryImageStorageId: args.primaryImageStorageId,
      primaryImageAlt: alt,
      updatedAt: Date.now(),
    });
  },
});

export const archiveProduct = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    productId: v.id("merchProducts"),
  },
  handler: async (ctx, args) => {
    await requireMerchCatalogAdmin(ctx, args.logtoId, args.authToken);
    await ctx.db.patch(args.productId, { status: "archived", updatedAt: Date.now() });
    const releases = await ctx.db
      .query("merchReleases")
      .withIndex("by_productId", (q) => q.eq("productId", args.productId))
      .collect();
    await Promise.all(
      releases.map((r) =>
        ctx.db.patch(r._id, { status: "archived", updatedAt: Date.now() }),
      ),
    );
  },
});

export const pauseRelease = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    releaseId: v.id("merchReleases"),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    await ctx.db.patch(args.releaseId, { status: "paused", updatedAt: Date.now() });
  },
});

export const resumeRelease = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    releaseId: v.id("merchReleases"),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    await ctx.db.patch(args.releaseId, { status: "active", updatedAt: Date.now() });
  },
});

export const updateReleasePricing = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    releaseId: v.id("merchReleases"),
    defaultPointPrice: v.number(),
    releasePurchaseLimit: v.optional(v.number()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await requireMerchAdmin(ctx, args.logtoId, args.authToken);
    if (!args.reason.trim()) throw new Error("Price change reason is required");
    await ctx.db.patch(args.releaseId, {
      defaultPointPrice: args.defaultPointPrice,
      releasePurchaseLimit: args.releasePurchaseLimit,
      updatedAt: Date.now(),
    });
  },
});

export const getProductDetail = query({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    productId: v.id("merchProducts"),
  },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    const releases = await ctx.db
      .query("merchReleases")
      .withIndex("by_productId", (q) => q.eq("productId", args.productId))
      .collect();

    const releasesWithVariants = await Promise.all(
      releases.map(async (release) => {
        const variants = await ctx.db
          .query("merchVariants")
          .withIndex("by_releaseId", (q) => q.eq("releaseId", release._id))
          .collect();
        return { ...release, variants };
      }),
    );

    const imageUrl = product.primaryImageStorageId
      ? await ctx.storage.getUrl(product.primaryImageStorageId)
      : null;

    return { product: { ...product, imageUrl }, releases: releasesWithVariants };
  },
});

export const listActiveReleases = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    const releases = await ctx.db
      .query("merchReleases")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const result = [];
    for (const release of releases) {
      const product = await ctx.db.get(release.productId);
      if (!product || product.status !== "active") continue;
      result.push({
        releaseId: release._id,
        productId: product._id,
        productName: product.name,
        releaseNumber: release.releaseNumber,
        defaultPointPrice: release.defaultPointPrice,
      });
    }

    return result.sort((a, b) => a.productName.localeCompare(b.productName));
  },
});

export const generateUploadUrl = mutation({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    await requireMerchOfficer(ctx, args.logtoId, args.authToken);
    return ctx.storage.generateUploadUrl();
  },
});
