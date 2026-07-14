export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PRODUCT_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function assertSafeInteger(
  value: number,
  label: string,
  minimum = Number.MIN_SAFE_INTEGER,
) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be a safe integer of at least ${minimum}`);
  }
}

export function requireTrimmed(value: string, label: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  if (normalized.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters`);
  }
  return normalized;
}

export function normalizeSku(sku: string) {
  return requireTrimmed(sku, "SKU", 80).toUpperCase();
}

export function validateAvailabilityWindow(
  availableFrom?: number,
  availableUntil?: number,
) {
  if (availableFrom !== undefined && !Number.isFinite(availableFrom)) {
    throw new Error("Availability start is invalid");
  }
  if (availableUntil !== undefined && !Number.isFinite(availableUntil)) {
    throw new Error("Availability end is invalid");
  }
  if (
    availableFrom !== undefined &&
    availableUntil !== undefined &&
    availableUntil <= availableFrom
  ) {
    throw new Error("Availability end must be after its start");
  }
}

export function generatePickupSlots(
  startAt: number,
  endAt: number,
  durationMinutes: number,
) {
  assertSafeInteger(startAt, "Window start", 0);
  assertSafeInteger(endAt, "Window end", 1);
  assertSafeInteger(durationMinutes, "Slot duration", 1);
  if (endAt <= startAt) throw new Error("Window end must be after its start");
  const durationMs = durationMinutes * 60_000;
  if (!Number.isSafeInteger(durationMs)) throw new Error("Slot duration is too large");

  const slots: Array<{ startAt: number; endAt: number }> = [];
  for (let cursor = startAt; cursor + durationMs <= endAt; cursor += durationMs) {
    slots.push({ startAt: cursor, endAt: cursor + durationMs });
    if (slots.length > 500) throw new Error("A pickup window may create at most 500 slots");
  }
  if (slots.length === 0) throw new Error("Window must contain at least one full slot");
  return slots;
}

export function isAtCapacity(bookedCount: number, capacity?: number) {
  return capacity !== undefined && bookedCount >= capacity;
}

export function computePickupHealth(
  status: "pending" | "fulfilled" | "canceled",
  pickupHealth: "scheduled" | "overdue" | "action_required",
  pickupEndAt: number,
  now: number,
) {
  if (status !== "pending") return pickupHealth;
  if (pickupHealth === "action_required" || pickupHealth === "overdue") return pickupHealth;
  return now > pickupEndAt ? "overdue" : "scheduled";
}

export function retryDelayMs(attempt: number) {
  const exponent = Math.max(0, Math.min(6, attempt - 1));
  return 60_000 * 2 ** exponent;
}

export function aggregateRequestedQuantities<T extends { productId: string; quantity: number }>(
  lines: T[],
) {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    assertSafeInteger(line.quantity, "Quantity", 1);
    const next = (quantities.get(line.productId) ?? 0) + line.quantity;
    assertSafeInteger(next, "Requested product quantity", 1);
    quantities.set(line.productId, next);
  }
  return quantities;
}

export function assertProductCanActivate(hasImage: boolean, activeVariantCount: number) {
  if (!hasImage) throw new Error("An active product needs an image");
  if (activeVariantCount < 1) {
    throw new Error("An active product needs at least one active variant");
  }
}

export function assertCanDeactivateVariant(
  productIsActive: boolean,
  remainingActiveVariantCount: number,
) {
  if (productIsActive && remainingActiveVariantCount < 1) {
    throw new Error("An active product must retain at least one active variant");
  }
}

export function assertPurchaseInventoryReversal(
  original: { quantityDelta: number; kind: string },
  reversal: { quantityDelta: number; kind: string },
) {
  if (reversal.quantityDelta !== -original.quantityDelta) {
    throw new Error("Inventory reversal must exactly negate the original movement");
  }
  if (reversal.kind !== "cancellation" || original.kind !== "purchase") {
    throw new Error("Only a cancellation may reverse a purchase movement");
  }
}

export function fulfillmentDisposition(status: "pending" | "fulfilled" | "canceled") {
  if (status === "fulfilled") return "already_fulfilled" as const;
  if (status === "canceled") return "canceled" as const;
  return "fulfill" as const;
}

export function scannerPreviewDisposition(orderExists: boolean) {
  return orderExists ? ("found" as const) : ("invalid" as const);
}

export function normalizeOrderCode(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "");
  return /^[0-9a-f]{48}$/.test(normalized) ? normalized : null;
}

export function merchFeatureMode(settings?: {
  merchStoreEnabled?: boolean;
  merchCheckoutEnabled?: boolean;
} | null) {
  if (!settings?.merchStoreEnabled) return "hidden" as const;
  return settings.merchCheckoutEnabled ? ("checkout" as const) : ("read_only" as const);
}

export function shouldDeliverInApp(inAppDeliveredAt?: number) {
  return inAppDeliveredAt === undefined;
}

export function checkoutRequestFingerprint(args: {
  lines: Array<{
    productId: string;
    variantId: string;
    quantity: number;
    expectedProductRevision: number;
    expectedVariantRevision: number;
    expectedUnitPrice: number;
  }>;
  pickup:
    | { type: "event"; pickupEventId: string }
    | { type: "slot"; pickupSlotId: string };
}) {
  const lines = [...args.lines]
    .map((line) => ({ ...line }))
    .sort((a, b) =>
      `${a.productId}:${a.variantId}`.localeCompare(`${b.productId}:${b.variantId}`),
    );
  return JSON.stringify({ lines, pickup: args.pickup });
}

export function staleCartConflict(args: {
  productId: string;
  variantId: string;
  sku: string;
  expectedProductRevision: number;
  expectedVariantRevision: number;
  expectedUnitPrice: number;
  currentProductRevision: number;
  currentVariantRevision: number;
  currentUnitPrice: number;
  stockOnHand: number;
}) {
  return {
    code: "STALE_CART" as const,
    productId: args.productId,
    variantId: args.variantId,
    sku: args.sku,
    expected: {
      productRevision: args.expectedProductRevision,
      variantRevision: args.expectedVariantRevision,
      unitPrice: args.expectedUnitPrice,
    },
    current: {
      productRevision: args.currentProductRevision,
      variantRevision: args.currentVariantRevision,
      unitPrice: args.currentUnitPrice,
      stockOnHand: args.stockOnHand,
    },
  };
}
