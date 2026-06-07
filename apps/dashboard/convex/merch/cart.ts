import { mutation, query } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import {
  getUserPurchasedQuantityForRelease,
  getUserPurchasedQuantityForVariant,
  getVariantPointPrice,
  isReleaseOnSale,
} from "./orderHelpers";
import {
  getStockDisplay,
  requireStoreAccess,
  requireStorePurchaseAccess,
} from "./helpers";

async function getOrCreateCart(ctx: { db: MutationCtx["db"] }, userId: Id<"users">) {
  const existing = await ctx.db
    .query("merchCarts")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();

  if (existing) return existing;

  const cartId = await ctx.db.insert("merchCarts", {
    userId,
    items: [],
    updatedAt: Date.now(),
  });
  const cart = await ctx.db.get(cartId);
  if (!cart) throw new Error("Failed to create cart");
  return cart;
}

type CartValidationIssue = {
  variantId: Id<"merchVariants">;
  code: string;
  message: string;
};

async function validateCartItemLimits(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  item: Doc<"merchCarts">["items"][number],
  nextQuantity: number,
): Promise<CartValidationIssue | null> {
  const variant = await ctx.db.get(item.variantId);
  const release = await ctx.db.get(item.releaseId);
  const product = await ctx.db.get(item.productId);

  if (!variant || !release || !product) {
    return {
      variantId: item.variantId,
      code: "not_found",
      message: "Item is no longer available",
    };
  }

  if (product.status !== "active" || !variant.enabled) {
    return {
      variantId: item.variantId,
      code: "unavailable",
      message: "This variant is no longer available",
    };
  }

  if (!isReleaseOnSale(release)) {
    return {
      variantId: item.variantId,
      code: "not_on_sale",
      message: "This release is not currently on sale",
    };
  }

  if (nextQuantity <= 0) {
    return {
      variantId: item.variantId,
      code: "invalid_quantity",
      message: "Quantity must be at least 1",
    };
  }

  const available = Math.max(0, variant.onHand - variant.reserved);
  if (nextQuantity > available) {
    return {
      variantId: item.variantId,
      code: "insufficient_inventory",
      message: `Only ${available} available`,
    };
  }

  const releasePurchased = await getUserPurchasedQuantityForRelease(
    ctx,
    userId,
    release._id,
  );
  const otherCartQty = 0;
  const releaseLimit = release.releasePurchaseLimit;
  if (releaseLimit !== undefined && releasePurchased + nextQuantity + otherCartQty > releaseLimit) {
    const remaining = Math.max(0, releaseLimit - releasePurchased);
    return {
      variantId: item.variantId,
      code: "release_limit",
      message: `Release limit allows ${remaining} more`,
    };
  }

  const variantPurchased = await getUserPurchasedQuantityForVariant(
    ctx,
    userId,
    variant._id,
  );
  const variantLimit = variant.variantPurchaseLimit;
  if (variantLimit !== undefined && variantPurchased + nextQuantity > variantLimit) {
    const remaining = Math.max(0, variantLimit - variantPurchased);
    return {
      variantId: item.variantId,
      code: "variant_limit",
      message: `Variant limit allows ${remaining} more`,
    };
  }

  return null;
}

async function enrichCartItems(
  ctx: QueryCtx,
  userId: Id<"users">,
  items: Doc<"merchCarts">["items"],
) {
  const enriched = [];
  for (const item of items) {
    const variant = await ctx.db.get(item.variantId);
    const release = await ctx.db.get(item.releaseId);
    const product = await ctx.db.get(item.productId);
    if (!variant || !release || !product) continue;

    const pointPrice = getVariantPointPrice(release, variant);
    const available = Math.max(0, variant.onHand - variant.reserved);
    const issue = await validateCartItemLimits(ctx, userId, item, item.quantity);
    const imageStorageId =
      variant.imageStorageId ?? product.primaryImageStorageId ?? undefined;
    const imageUrl = imageStorageId
      ? await ctx.storage.getUrl(imageStorageId)
      : null;

    enriched.push({
      ...item,
      productName: product.name,
      variantLabel: variant.label,
      sku: variant.sku,
      pointPrice,
      lineTotal: pointPrice * item.quantity,
      available,
      stockDisplay: getStockDisplay(available, variant.lowStockThreshold),
      imageUrl,
      issue,
    });
  }

  return enriched;
}

export const getCart = query({
  args: { logtoId: v.string(), authToken: v.string() },
  handler: async (ctx, args) => {
    const user = await requireStoreAccess(ctx, args.logtoId, args.authToken);
    const cart = await ctx.db
      .query("merchCarts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (!cart || cart.items.length === 0) {
      return { items: [], pointTotal: 0, itemCount: 0, canPurchase: false };
    }

    const items = await enrichCartItems(ctx, user._id, cart.items);
    const pointTotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const hasIssues = items.some((item) => item.issue !== null);

    return {
      items,
      pointTotal,
      itemCount,
      canPurchase: !hasIssues,
      updatedAt: cart.updatedAt,
    };
  },
});

export const addItem = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    variantId: v.id("merchVariants"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireStorePurchaseAccess(ctx, args.logtoId, args.authToken);
    if (args.quantity <= 0) throw new Error("Quantity must be at least 1");

    const variant = await ctx.db.get(args.variantId);
    if (!variant) throw new Error("Variant not found");
    const release = await ctx.db.get(variant.releaseId);
    const product = await ctx.db.get(variant.productId);
    if (!release || !product) throw new Error("Product not found");

    const cart = await getOrCreateCart(ctx, user._id);
    const existingIndex = cart.items.findIndex((item) => item.variantId === args.variantId);
    const nextQuantity =
      existingIndex >= 0
        ? cart.items[existingIndex]!.quantity + args.quantity
        : args.quantity;

    const draftItem = {
      variantId: variant._id,
      releaseId: release._id,
      productId: product._id,
      quantity: nextQuantity,
    };
    const issue = await validateCartItemLimits(ctx, user._id, draftItem, nextQuantity);
    if (issue) throw new Error(issue.message);

    const nextItems = [...cart.items];
    if (existingIndex >= 0) {
      nextItems[existingIndex] = draftItem;
    } else {
      nextItems.push(draftItem);
    }

    await ctx.db.patch(cart._id, {
      items: nextItems,
      updatedAt: Date.now(),
    });

    return { cartId: cart._id, itemCount: nextItems.length };
  },
});

export const updateQuantity = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    variantId: v.id("merchVariants"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireStorePurchaseAccess(ctx, args.logtoId, args.authToken);
    const cart = await getOrCreateCart(ctx, user._id);
    const existing = cart.items.find((item) => item.variantId === args.variantId);
    if (!existing) throw new Error("Item not in cart");

    if (args.quantity <= 0) {
      await ctx.db.patch(cart._id, {
        items: cart.items.filter((item) => item.variantId !== args.variantId),
        updatedAt: Date.now(),
      });
      return;
    }

    const draftItem = { ...existing, quantity: args.quantity };
    const issue = await validateCartItemLimits(ctx, user._id, draftItem, args.quantity);
    if (issue) throw new Error(issue.message);

    await ctx.db.patch(cart._id, {
      items: cart.items.map((item) =>
        item.variantId === args.variantId ? draftItem : item,
      ),
      updatedAt: Date.now(),
    });
  },
});

export const removeItem = mutation({
  args: {
    logtoId: v.string(),
    authToken: v.string(),
    variantId: v.id("merchVariants"),
  },
  handler: async (ctx, args) => {
    const user = await requireStorePurchaseAccess(ctx, args.logtoId, args.authToken);
    const cart = await ctx.db
      .query("merchCarts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!cart) return;

    await ctx.db.patch(cart._id, {
      items: cart.items.filter((item) => item.variantId !== args.variantId),
      updatedAt: Date.now(),
    });
  },
});
