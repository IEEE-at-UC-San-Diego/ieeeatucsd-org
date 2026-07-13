import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { applyInventoryChange } from "./lib/merchInventory";
import { requireMerchManager, requireMerchShopper } from "./lib/merchAuth";
import {
  ALLOWED_PRODUCT_IMAGE_TYPES,
  assertCanDeactivateVariant,
  assertProductCanActivate,
  assertSafeInteger,
  MAX_PRODUCT_IMAGE_BYTES,
  merchFeatureMode,
  normalizeSku,
  requireTrimmed,
  validateAvailabilityWindow,
} from "./lib/merchValidation";

const authArgs = { logtoId: v.string(), authToken: v.string() };
const productStatus = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("archived"),
);
const optionValues = v.array(v.object({ name: v.string(), value: v.string() }));

async function imageUrl(ctx: { storage: { getUrl: (id: any) => Promise<string | null> } }, id?: any) {
  return id ? (await ctx.storage.getUrl(id)) ?? undefined : undefined;
}

function randomClaimToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function deleteOwnedMerchImageIfUnreferenced(ctx: any, storageId: any) {
  const claim = await ctx.db
    .query("merchImageUploads")
    .withIndex("by_storageId", (q: any) => q.eq("storageId", storageId))
    .unique();
  if (!claim || (claim.state !== "claimed" && claim.state !== "uploaded")) return false;
  const [products, orders] = await Promise.all([
    ctx.db.query("merchProducts").collect(),
    ctx.db.query("merchOrders").collect(),
  ]);
  if (
    products.some((product: any) => product.imageStorageId === storageId) ||
    orders.some((order: any) =>
      order.lines.some((line: any) => line.imageStorageId === storageId),
    )
  ) {
    return false;
  }
  await ctx.storage.delete(storageId);
  await ctx.db.patch(claim._id, { state: "deleted", updatedAt: Date.now() });
  return true;
}

export const listActive = query({
  args: authArgs,
  handler: async (ctx, args) => {
    await requireMerchShopper(ctx, args.logtoId, args.authToken);
    const settings = await ctx.db.query("organizationSettings").first();
    if (merchFeatureMode(settings) === "hidden") return [];
    const now = Date.now();
    const products = await ctx.db
      .query("merchProducts")
      .withIndex("by_status_displayOrder", (q) => q.eq("status", "active"))
      .collect();
    const visible = products.filter(
      (product) =>
        (product.availableFrom === undefined || product.availableFrom <= now) &&
        (product.availableUntil === undefined || product.availableUntil > now),
    );
    return await Promise.all(
      visible.map(async (product) => {
        const variants = await ctx.db
          .query("merchVariants")
          .withIndex("by_product", (q) => q.eq("productId", product._id))
          .collect();
        return {
          _id: product._id,
          name: product.name,
          description: product.description,
          imageUrl: await imageUrl(ctx, product.imageStorageId),
          purchaseLimit: product.purchaseLimit,
          displayOrder: product.displayOrder,
          revision: product.revision,
          variants: variants
            .filter((variant) => variant.active)
            .map((variant) => ({
              _id: variant._id,
              sku: variant.sku,
              optionValues: variant.optionValues,
              pointPrice: variant.pointPrice,
              stockOnHand: variant.stockOnHand,
              available: variant.stockOnHand > 0,
              revision: variant.revision,
            })),
        };
      }),
    );
  },
});

export const listForManager = query({
  args: authArgs,
  handler: async (ctx, args) => {
    await requireMerchManager(ctx, args.logtoId, args.authToken);
    const products = await ctx.db.query("merchProducts").collect();
    return await Promise.all(
      products
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(async (product) => ({
          ...product,
          imageUrl: await imageUrl(ctx, product.imageStorageId),
          variants: await ctx.db
            .query("merchVariants")
            .withIndex("by_product", (q) => q.eq("productId", product._id))
            .collect(),
        })),
    );
  },
});

export const createProduct = mutation({
  args: {
    ...authArgs,
    name: v.string(),
    description: v.string(),
    status: v.optional(productStatus),
    availableFrom: v.optional(v.number()),
    availableUntil: v.optional(v.number()),
    purchaseLimit: v.optional(v.number()),
    displayOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const name = requireTrimmed(args.name, "Product name", 160);
    const description = requireTrimmed(args.description, "Description", 4_000);
    assertSafeInteger(args.displayOrder, "Display order", 0);
    if (args.purchaseLimit !== undefined) {
      assertSafeInteger(args.purchaseLimit, "Purchase limit", 1);
    }
    validateAvailabilityWindow(args.availableFrom, args.availableUntil);
    if (args.status === "active") {
      throw new Error("Create the product as a draft, then add its image and variants before activation");
    }
    const now = Date.now();
    return await ctx.db.insert("merchProducts", {
      name,
      description,
      status: args.status ?? "draft",
      availableFrom: args.availableFrom,
      availableUntil: args.availableUntil,
      purchaseLimit: args.purchaseLimit,
      displayOrder: args.displayOrder,
      revision: 1,
      createdAt: now,
      createdBy: manager._id,
      updatedAt: now,
      updatedBy: manager._id,
    });
  },
});

export const updateProduct = mutation({
  args: {
    ...authArgs,
    productId: v.id("merchProducts"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(productStatus),
    availableFrom: v.optional(v.union(v.number(), v.null())),
    availableUntil: v.optional(v.union(v.number(), v.null())),
    purchaseLimit: v.optional(v.union(v.number(), v.null())),
    displayOrder: v.optional(v.number()),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");
    if (product.revision !== args.expectedRevision) throw new Error("Product was updated; refresh and retry");
    if (product.status === "archived" && args.status && args.status !== "archived") {
      throw new Error("Archived products cannot be reactivated");
    }
    const availableFrom = args.availableFrom === null ? undefined : (args.availableFrom ?? product.availableFrom);
    const availableUntil = args.availableUntil === null ? undefined : (args.availableUntil ?? product.availableUntil);
    const purchaseLimit = args.purchaseLimit === null ? undefined : (args.purchaseLimit ?? product.purchaseLimit);
    validateAvailabilityWindow(availableFrom, availableUntil);
    if (purchaseLimit !== undefined) assertSafeInteger(purchaseLimit, "Purchase limit", 1);
    if (args.displayOrder !== undefined) assertSafeInteger(args.displayOrder, "Display order", 0);
    if (args.status === "active") {
      const variants = await ctx.db
        .query("merchVariants")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .collect();
      assertProductCanActivate(
        product.imageStorageId !== undefined,
        variants.filter((variant) => variant.active).length,
      );
    }
    await ctx.db.patch(product._id, {
      name: args.name === undefined ? product.name : requireTrimmed(args.name, "Product name", 160),
      description:
        args.description === undefined
          ? product.description
          : requireTrimmed(args.description, "Description", 4_000),
      status: args.status ?? product.status,
      availableFrom,
      availableUntil,
      purchaseLimit,
      displayOrder: args.displayOrder ?? product.displayOrder,
      revision: product.revision + 1,
      updatedAt: Date.now(),
      updatedBy: manager._id,
    });
    return product._id;
  },
});

export const archiveProduct = mutation({
  args: { ...authArgs, productId: v.id("merchProducts"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");
    if (product.revision !== args.expectedRevision) throw new Error("Product was updated; refresh and retry");
    if (product.status === "archived") return product._id;
    await ctx.db.patch(product._id, {
      status: "archived",
      revision: product.revision + 1,
      updatedAt: Date.now(),
      updatedBy: manager._id,
    });
    return product._id;
  },
});

export const createVariant = mutation({
  args: {
    ...authArgs,
    productId: v.id("merchProducts"),
    sku: v.string(),
    optionValues,
    pointPrice: v.number(),
    initialStock: v.number(),
    active: v.optional(v.boolean()),
    requestId: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const product = await ctx.db.get(args.productId);
    if (!product || product.status === "archived") throw new Error("Product is unavailable");
    assertSafeInteger(args.pointPrice, "Point price", 1);
    assertSafeInteger(args.initialStock, "Initial stock", 0);
    const normalizedSku = normalizeSku(args.sku);
    const conflict = await ctx.db
      .query("merchVariants")
      .withIndex("by_normalizedSku", (q) => q.eq("normalizedSku", normalizedSku))
      .unique();
    if (conflict) throw new Error("SKU already exists");
    const options = args.optionValues.map((option) => ({
      name: requireTrimmed(option.name, "Option name", 80),
      value: requireTrimmed(option.value, "Option value", 120),
    }));
    if (new Set(options.map((option) => option.name.toLowerCase())).size !== options.length) {
      throw new Error("Variant option names must be unique");
    }
    const now = Date.now();
    const variantId = await ctx.db.insert("merchVariants", {
      productId: product._id,
      sku: requireTrimmed(args.sku, "SKU", 80),
      normalizedSku,
      optionValues: options,
      pointPrice: args.pointPrice,
      stockOnHand: 0,
      active: args.active ?? true,
      revision: 1,
      createdAt: now,
      createdBy: manager._id,
      updatedAt: now,
      updatedBy: manager._id,
    });
    if (args.initialStock > 0) {
      await applyInventoryChange(ctx, {
        variantId,
        quantityDelta: args.initialStock,
        kind: "initial",
        sourceId: product._id,
        idempotencyKey: `inventory:initial:${args.requestId}`,
        actorId: manager._id,
        reason: args.reason,
      });
    } else {
      requireTrimmed(args.reason, "Inventory reason", 500);
    }
    await ctx.db.patch(product._id, {
      revision: product.revision + 1,
      updatedAt: now,
      updatedBy: manager._id,
    });
    return variantId;
  },
});

export const updateVariant = mutation({
  args: {
    ...authArgs,
    variantId: v.id("merchVariants"),
    sku: v.optional(v.string()),
    optionValues: v.optional(optionValues),
    pointPrice: v.optional(v.number()),
    active: v.optional(v.boolean()),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const variant = await ctx.db.get(args.variantId);
    if (!variant) throw new Error("Variant not found");
    if (variant.revision !== args.expectedRevision) throw new Error("Variant was updated; refresh and retry");
    const product = await ctx.db.get(variant.productId);
    if (!product || product.status === "archived") throw new Error("Archived merchandise cannot be edited");
    if (args.pointPrice !== undefined) assertSafeInteger(args.pointPrice, "Point price", 1);
    if (args.active === false && variant.active && product.status === "active") {
      const siblings = await ctx.db
        .query("merchVariants")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .collect();
      assertCanDeactivateVariant(
        true,
        siblings.filter((sibling) => sibling._id !== variant._id && sibling.active).length,
      );
    }
    let sku = variant.sku;
    let normalizedSku = variant.normalizedSku;
    if (args.sku !== undefined) {
      sku = requireTrimmed(args.sku, "SKU", 80);
      normalizedSku = normalizeSku(sku);
      const conflict = await ctx.db
        .query("merchVariants")
        .withIndex("by_normalizedSku", (q) => q.eq("normalizedSku", normalizedSku))
        .unique();
      if (conflict && conflict._id !== variant._id) throw new Error("SKU already exists");
    }
    const options = (args.optionValues ?? variant.optionValues).map((option) => ({
      name: requireTrimmed(option.name, "Option name", 80),
      value: requireTrimmed(option.value, "Option value", 120),
    }));
    if (new Set(options.map((option) => option.name.toLowerCase())).size !== options.length) {
      throw new Error("Variant option names must be unique");
    }
    await ctx.db.patch(variant._id, {
      sku,
      normalizedSku,
      optionValues: options,
      pointPrice: args.pointPrice ?? variant.pointPrice,
      active: args.active ?? variant.active,
      revision: variant.revision + 1,
      updatedAt: Date.now(),
      updatedBy: manager._id,
    });
    await ctx.db.patch(product._id, {
      revision: product.revision + 1,
      updatedAt: Date.now(),
      updatedBy: manager._id,
    });
    return variant._id;
  },
});

export const adjustInventory = mutation({
  args: {
    ...authArgs,
    variantId: v.id("merchVariants"),
    quantityDelta: v.number(),
    reason: v.string(),
    requestId: v.string(),
  },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    return await applyInventoryChange(ctx, {
      variantId: args.variantId,
      quantityDelta: args.quantityDelta,
      kind: "adjustment",
      sourceId: args.requestId,
      idempotencyKey: `inventory:adjustment:${args.requestId}`,
      actorId: manager._id,
      reason: args.reason,
    });
  },
});

export const listInventoryHistory = query({
  args: { ...authArgs, variantId: v.id("merchVariants") },
  handler: async (ctx, args) => {
    await requireMerchManager(ctx, args.logtoId, args.authToken);
    return await ctx.db
      .query("merchInventoryEntries")
      .withIndex("by_variant_createdAt", (q) => q.eq("variantId", args.variantId))
      .order("desc")
      .take(250);
  },
});

export const reconcileInventory = query({
  args: authArgs,
  handler: async (ctx, args) => {
    await requireMerchManager(ctx, args.logtoId, args.authToken);
    const variants = await ctx.db.query("merchVariants").collect();
    const results = await Promise.all(
      variants.map(async (variant) => {
        const entries = await ctx.db
          .query("merchInventoryEntries")
          .withIndex("by_variant_createdAt", (q) => q.eq("variantId", variant._id))
          .collect();
        const ledgerQuantity = entries.reduce((sum, entry) => sum + entry.quantityDelta, 0);
        return {
          variantId: variant._id,
          sku: variant.sku,
          summaryQuantity: variant.stockOnHand,
          ledgerQuantity,
          difference: variant.stockOnHand - ledgerQuantity,
          reconciles: variant.stockOnHand === ledgerQuantity,
        };
      }),
    );
    return { reconciles: results.every((result) => result.reconciles), variants: results };
  },
});

export const generateImageUploadUrl = mutation({
  args: authArgs,
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const now = Date.now();
    const claimToken = randomClaimToken();
    await ctx.db.insert("merchImageUploads", {
      claimToken,
      managerId: manager._id,
      state: "pending",
      createdAt: now,
      expiresAt: now + 60 * 60_000,
      updatedAt: now,
    });
    return { uploadUrl: await ctx.storage.generateUploadUrl(), claimToken };
  },
});

export const registerImageUpload = mutation({
  args: {
    ...authArgs,
    claimToken: v.string(),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const claim = await ctx.db
      .query("merchImageUploads")
      .withIndex("by_claimToken", (q) => q.eq("claimToken", args.claimToken))
      .unique();
    if (!claim || claim.managerId !== manager._id || claim.state !== "pending") {
      throw new Error("Image upload claim is invalid or already used");
    }
    if (claim.expiresAt <= Date.now()) throw new Error("Image upload claim expired");
    const storageConflict = await ctx.db
      .query("merchImageUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .first();
    if (storageConflict) throw new Error("Uploaded file is already claimed");
    const metadata = await ctx.db.system.get(args.storageId);
    if (!metadata || metadata._creationTime < claim.createdAt - 5_000) {
      throw new Error("Uploaded image does not belong to this upload intent");
    }
    if (!metadata.contentType || !ALLOWED_PRODUCT_IMAGE_TYPES.has(metadata.contentType)) {
      await ctx.db.patch(claim._id, { state: "deleted", updatedAt: Date.now() });
      throw new Error("Product image type is not supported");
    }
    if (metadata.size > MAX_PRODUCT_IMAGE_BYTES) {
      await ctx.db.patch(claim._id, { state: "deleted", updatedAt: Date.now() });
      throw new Error("Product image must be 5MB or smaller");
    }
    await ctx.db.patch(claim._id, {
      storageId: args.storageId,
      state: "uploaded",
      updatedAt: Date.now(),
    });
    return args.storageId;
  },
});

export const finalizeProductImage = mutation({
  args: {
    ...authArgs,
    productId: v.id("merchProducts"),
    claimToken: v.string(),
    fileName: v.string(),
    expectedRevision: v.number(),
  },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");
    if (product.revision !== args.expectedRevision) throw new Error("Product was updated; refresh and retry");
    const claim = await ctx.db
      .query("merchImageUploads")
      .withIndex("by_claimToken", (q) => q.eq("claimToken", args.claimToken))
      .unique();
    if (
      !claim ||
      claim.managerId !== manager._id ||
      claim.state !== "uploaded" ||
      !claim.storageId ||
      claim.expiresAt <= Date.now()
    ) {
      throw new Error("Registered merch image upload is invalid or expired");
    }
    const metadata = await ctx.db.system.get(claim.storageId);
    if (!metadata) throw new Error("Uploaded image not found");
    if (!metadata.contentType || !ALLOWED_PRODUCT_IMAGE_TYPES.has(metadata.contentType)) {
      await ctx.storage.delete(claim.storageId);
      await ctx.db.patch(claim._id, { state: "deleted", updatedAt: Date.now() });
      throw new Error("Product image type is not supported");
    }
    if (metadata.size > MAX_PRODUCT_IMAGE_BYTES) {
      await ctx.storage.delete(claim.storageId);
      await ctx.db.patch(claim._id, { state: "deleted", updatedAt: Date.now() });
      throw new Error("Product image must be 5MB or smaller");
    }
    const oldStorageId = product.imageStorageId;
    await ctx.db.patch(product._id, {
      imageStorageId: claim.storageId,
      imageContentType: metadata.contentType,
      imageFileName: requireTrimmed(args.fileName, "Image file name", 240),
      revision: product.revision + 1,
      updatedAt: Date.now(),
      updatedBy: manager._id,
    });
    await ctx.db.patch(claim._id, {
      state: "claimed",
      productId: product._id,
      updatedAt: Date.now(),
    });
    // Keep replaced images if an order snapshot references them; otherwise remove them.
    if (oldStorageId && oldStorageId !== claim.storageId) {
      await deleteOwnedMerchImageIfUnreferenced(ctx, oldStorageId);
    }
    return claim.storageId;
  },
});

export const removeProductImage = mutation({
  args: { ...authArgs, productId: v.id("merchProducts"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const manager = await requireMerchManager(ctx, args.logtoId, args.authToken);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");
    if (product.revision !== args.expectedRevision) throw new Error("Product was updated; refresh and retry");
    if (product.status === "active") {
      throw new Error("Move the product to draft or archived before removing its image");
    }
    await ctx.db.patch(product._id, {
      imageStorageId: undefined,
      imageContentType: undefined,
      imageFileName: undefined,
      revision: product.revision + 1,
      updatedAt: Date.now(),
      updatedBy: manager._id,
    });
    if (product.imageStorageId) {
      await deleteOwnedMerchImageIfUnreferenced(ctx, product.imageStorageId);
    }
  },
});

export const cleanupOrphanImageUploads = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const uploaded = await ctx.db
      .query("merchImageUploads")
      .withIndex("by_state_expiresAt", (q) =>
        q.eq("state", "uploaded").lt("expiresAt", now),
      )
      .take(50);
    let deletedFiles = 0;
    for (const claim of uploaded) {
      if (claim.storageId && (await deleteOwnedMerchImageIfUnreferenced(ctx, claim.storageId))) {
        deletedFiles += 1;
      }
    }
    const abandoned = await ctx.db
      .query("merchImageUploads")
      .withIndex("by_state_expiresAt", (q) =>
        q.eq("state", "pending").lt("expiresAt", now),
      )
      .take(50);
    await Promise.all(abandoned.map((claim) => ctx.db.delete(claim._id)));
    return { deletedFiles, deletedClaims: abandoned.length };
  },
});
