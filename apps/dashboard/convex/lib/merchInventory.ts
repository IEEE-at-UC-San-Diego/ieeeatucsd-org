import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  assertPurchaseInventoryReversal,
  assertSafeInteger,
  requireTrimmed,
} from "./merchValidation";

type InventoryChange = {
  variantId: Id<"merchVariants">;
  quantityDelta: number;
  kind: "initial" | "purchase" | "cancellation" | "adjustment";
  orderId?: Id<"merchOrders">;
  sourceId?: string;
  idempotencyKey: string;
  actorId: Id<"users">;
  reason: string;
  reversalOf?: Id<"merchInventoryEntries">;
};

export async function applyInventoryChange(ctx: MutationCtx, args: InventoryChange) {
  assertSafeInteger(args.quantityDelta, "Inventory change");
  if (args.quantityDelta === 0) throw new Error("Inventory change cannot be zero");
  const idempotencyKey = requireTrimmed(args.idempotencyKey, "Idempotency key", 200);
  const reason = requireTrimmed(args.reason, "Inventory reason", 500);

  const existing = await ctx.db
    .query("merchInventoryEntries")
    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
    .unique();
  if (existing) {
    if (
      existing.variantId !== args.variantId ||
      existing.quantityDelta !== args.quantityDelta ||
      existing.kind !== args.kind ||
      existing.orderId !== args.orderId ||
      existing.sourceId !== args.sourceId ||
      existing.actorId !== args.actorId ||
      existing.reason !== reason ||
      existing.reversalOf !== args.reversalOf
    ) {
      throw new Error("Inventory idempotency key was reused for another operation");
    }
    return existing;
  }

  const variant = await ctx.db.get(args.variantId);
  if (!variant) throw new Error("Variant not found");
  const resultingQuantity = variant.stockOnHand + args.quantityDelta;
  assertSafeInteger(resultingQuantity, "Resulting stock", 0);

  if (args.reversalOf) {
    const original = await ctx.db.get(args.reversalOf);
    if (!original || original.variantId !== args.variantId) {
      throw new Error("Inventory entry to reverse was not found");
    }
    if (!args.orderId || original.orderId !== args.orderId) {
      throw new Error("Inventory reversal must belong to the original order");
    }
    assertPurchaseInventoryReversal(original, args);
    const priorReversal = await ctx.db
      .query("merchInventoryEntries")
      .withIndex("by_reversalOf", (q) => q.eq("reversalOf", args.reversalOf))
      .first();
    if (priorReversal) throw new Error("Inventory movement has already been reversed");
  }

  const now = Date.now();
  const entryId = await ctx.db.insert("merchInventoryEntries", {
    variantId: args.variantId,
    quantityDelta: args.quantityDelta,
    resultingQuantity,
    kind: args.kind,
    orderId: args.orderId,
    sourceId: args.sourceId,
    idempotencyKey,
    actorId: args.actorId,
    reason,
    reversalOf: args.reversalOf,
    createdAt: now,
  });
  await ctx.db.patch(args.variantId, {
    stockOnHand: resultingQuantity,
    updatedAt: now,
    updatedBy: args.actorId,
  });
  const entry = await ctx.db.get(entryId);
  if (!entry) throw new Error("Failed to write inventory movement");
  return entry;
}
