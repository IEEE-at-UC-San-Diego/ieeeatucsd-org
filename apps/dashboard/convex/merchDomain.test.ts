import { describe, expect, it } from "vitest";
import {
  aggregateRequestedQuantities,
  assertCanDeactivateVariant,
  assertProductCanActivate,
  assertPurchaseInventoryReversal,
  checkoutRequestFingerprint,
  fulfillmentDisposition,
  generatePickupSlots,
  merchFeatureMode,
  normalizeOrderCode,
  isAtCapacity,
  retryDelayMs,
  scannerPreviewDisposition,
  shouldDeliverInApp,
  staleCartConflict,
} from "./lib/merchValidation";
import { assertActiveOnboarded, assertMerchShopper } from "./lib/merchAuth";
import { assertValidPointReversal } from "./lib/pointsLedger";
import { safeManagerOrderResult, safeMemberTimelineEvent } from "./lib/merchOrders";
import { hasAdminAccess, hasOfficerAccess, type UserRole } from "./permissions";

describe("merch domain invariants", () => {
  it("aggregates all variants of a product for purchase limits", () => {
    const totals = aggregateRequestedQuantities([
      { productId: "shirt", quantity: 2 },
      { productId: "shirt", quantity: 3 },
      { productId: "hat", quantity: 1 },
    ]);
    expect(totals.get("shirt")).toBe(5);
    expect(totals.get("hat")).toBe(1);
  });

  it("canonicalizes checkout retries and detects changed requests", () => {
    const a = checkoutRequestFingerprint({
      lines: [
        { productId: "p", variantId: "v2", quantity: 1, expectedProductRevision: 1, expectedVariantRevision: 2, expectedUnitPrice: 5 },
        { productId: "p", variantId: "v1", quantity: 1, expectedProductRevision: 1, expectedVariantRevision: 1, expectedUnitPrice: 5 },
      ],
      pickup: { type: "event", pickupEventId: "e" },
    });
    const b = checkoutRequestFingerprint({
      lines: [
        { productId: "p", variantId: "v1", quantity: 1, expectedProductRevision: 1, expectedVariantRevision: 1, expectedUnitPrice: 5 },
        { productId: "p", variantId: "v2", quantity: 1, expectedProductRevision: 1, expectedVariantRevision: 2, expectedUnitPrice: 5 },
      ],
      pickup: { type: "event", pickupEventId: "e" },
    });
    expect(a).toBe(b);
    expect(a).not.toBe(
      checkoutRequestFingerprint({
        lines: [{ productId: "p", variantId: "v1", quantity: 2, expectedProductRevision: 1, expectedVariantRevision: 1, expectedUnitPrice: 5 }],
        pickup: { type: "event", pickupEventId: "e" },
      }),
    );
  });

  it("returns old and current values in stale-cart conflict data", () => {
    const conflict = staleCartConflict({
      productId: "p",
      variantId: "v",
      sku: "SHIRT-M",
      expectedProductRevision: 1,
      expectedVariantRevision: 2,
      expectedUnitPrice: 10,
      currentProductRevision: 3,
      currentVariantRevision: 4,
      currentUnitPrice: 12,
      stockOnHand: 7,
    });
    expect(conflict).toMatchObject({
      code: "STALE_CART",
      expected: { productRevision: 1, variantRevision: 2, unitPrice: 10 },
      current: { productRevision: 3, variantRevision: 4, unitPrice: 12, stockOnHand: 7 },
    });
  });

  it("requires active onboarding across merch authorization", () => {
    expect(() => assertActiveOnboarded({ signedUp: true, status: "active" })).not.toThrow();
    for (const status of ["inactive", "suspended"]) {
      expect(() => assertActiveOnboarded({ signedUp: true, status })).toThrow("active");
    }
    expect(() => assertActiveOnboarded({ signedUp: false, status: "active" })).toThrow("onboarded");
    expect(() => assertMerchShopper({ signedUp: true, status: "active", role: "Sponsor" })).toThrow("eligible");
    for (const role of ["Member", "General Officer", "Executive Officer", "Administrator"]) {
      expect(() => assertMerchShopper({ signedUp: true, status: "active", role })).not.toThrow();
    }
  });

  it("enforces the manager and fulfiller role matrix", () => {
    const roles: UserRole[] = [
      "Member",
      "General Officer",
      "Executive Officer",
      "Member at Large",
      "Past Officer",
      "Sponsor",
      "Administrator",
    ];
    expect(roles.filter(hasAdminAccess)).toEqual(["Executive Officer", "Administrator"]);
    expect(roles.filter(hasOfficerAccess)).toEqual([
      "General Officer",
      "Executive Officer",
      "Administrator",
    ]);
  });

  it("requires image and an active variant before activation", () => {
    expect(() => assertProductCanActivate(false, 1)).toThrow("image");
    expect(() => assertProductCanActivate(true, 0)).toThrow("active variant");
    expect(() => assertProductCanActivate(true, 1)).not.toThrow();
  });

  it("prevents deactivating the last variant of an active product", () => {
    expect(() => assertCanDeactivateVariant(true, 0)).toThrow("retain");
    expect(() => assertCanDeactivateVariant(true, 1)).not.toThrow();
    expect(() => assertCanDeactivateVariant(false, 0)).not.toThrow();
  });

  it("only permits an exact cancellation reversal of a purchase", () => {
    expect(() =>
      assertPurchaseInventoryReversal(
        { quantityDelta: -2, kind: "purchase" },
        { quantityDelta: 2, kind: "cancellation" },
      ),
    ).not.toThrow();
    expect(() =>
      assertPurchaseInventoryReversal(
        { quantityDelta: -2, kind: "purchase" },
        { quantityDelta: 1, kind: "cancellation" },
      ),
    ).toThrow("exactly negate");
    expect(() =>
      assertPurchaseInventoryReversal(
        { quantityDelta: -2, kind: "adjustment" },
        { quantityDelta: 2, kind: "cancellation" },
      ),
    ).toThrow("Only a cancellation");
  });

  it("rejects partial, excessive, and wrong-source point refunds", () => {
    const original = {
      balanceDelta: -20,
      lifetimeDelta: 0,
      kind: "purchase" as const,
      sourceType: "merch_order",
      sourceId: "order-1",
    };
    expect(() =>
      assertValidPointReversal(original, {
        balanceDelta: 20,
        lifetimeDelta: 0,
        kind: "refund",
        sourceType: "merch_order",
        sourceId: "order-1",
      }),
    ).not.toThrow();
    for (const balanceDelta of [10, 30]) {
      expect(() =>
        assertValidPointReversal(original, {
          balanceDelta,
          lifetimeDelta: 0,
          kind: "refund",
          sourceType: "merch_order",
          sourceId: "order-1",
        }),
      ).toThrow("exactly negate");
    }
    expect(() =>
      assertValidPointReversal(original, {
        balanceDelta: 20,
        lifetimeDelta: 0,
        kind: "refund",
        sourceType: "merch_order",
        sourceId: "order-2",
      }),
    ).toThrow("same order");
  });

  it("generates only complete bounded pickup slots", () => {
    const start = Date.UTC(2026, 10, 1, 8);
    expect(generatePickupSlots(start, start + 75 * 60_000, 30)).toEqual([
      { startAt: start, endAt: start + 30 * 60_000 },
      { startAt: start + 30 * 60_000, endAt: start + 60 * 60_000 },
    ]);
  });

  it("keeps fulfilled bookings counted against pickup capacity", () => {
    // Fulfillment does not release capacity; only cancellation/reschedule does.
    expect(isAtCapacity(1, 1)).toBe(true);
    expect(isAtCapacity(0, 1)).toBe(false);
  });

  it("returns idempotent terminal fulfillment dispositions", () => {
    expect(fulfillmentDisposition("pending")).toBe("fulfill");
    expect(fulfillmentDisposition("fulfilled")).toBe("already_fulfilled");
    expect(fulfillmentDisposition("canceled")).toBe("canceled");
  });

  it("returns a query-safe invalid scanner result", () => {
    expect(scannerPreviewDisposition(false)).toBe("invalid");
    expect(scannerPreviewDisposition(true)).toBe("found");
  });

  it("normalizes readable fallback order codes without losing entropy", () => {
    const token = "0123456789abcdef0123456789abcdef0123456789abcdef";
    const grouped = token.toUpperCase().match(/.{1,8}/g)!.join(" - ");
    expect(normalizeOrderCode(grouped)).toBe(token);
    expect(normalizeOrderCode("not-a-token")).toBeNull();
  });

  it("enforces hidden, read-only, and checkout feature modes", () => {
    expect(merchFeatureMode()).toBe("hidden");
    expect(merchFeatureMode({ merchStoreEnabled: false, merchCheckoutEnabled: true })).toBe(
      "hidden",
    );
    expect(merchFeatureMode({ merchStoreEnabled: true, merchCheckoutEnabled: false })).toBe(
      "read_only",
    );
    expect(merchFeatureMode({ merchStoreEnabled: true, merchCheckoutEnabled: true })).toBe(
      "checkout",
    );
  });

  it("does not duplicate in-app delivery during email retry", () => {
    expect(shouldDeliverInApp()).toBe(true);
    expect(shouldDeliverInApp(Date.now())).toBe(false);
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(5)).toBe(16 * 60_000);
  });

  it("removes internal audit identifiers from the member timeline", () => {
    const projected = safeMemberTimelineEvent({
      action: "canceled",
      beforeStatus: "pending",
      afterStatus: "canceled",
      reason: "Requested by member",
      createdAt: 123,
      actorId: "staff-secret",
      requestId: "request-secret",
      pointLedgerEntryId: "ledger-secret",
    } as any);
    expect(projected).toEqual({
      action: "canceled",
      beforeStatus: "pending",
      afterStatus: "canceled",
      reason: "Requested by member",
      createdAt: 123,
    });
    expect(projected).not.toHaveProperty("actorId");
    expect(projected).not.toHaveProperty("requestId");
    expect(projected).not.toHaveProperty("pointLedgerEntryId");
  });

  it("keeps QR and accounting links out of manager mutation results", () => {
    const projected = safeManagerOrderResult({
      _id: "order-id",
      orderNumber: "M-ABC",
      ownerName: "Member",
      ownerEmail: "member@example.com",
      status: "pending",
      pickupHealth: "scheduled",
      pickupSnapshot: { label: "Pickup", address: "Room", startAt: 1, endAt: 2, timezone: "UTC" },
      totalPoints: 10,
      lines: [{ productName: "Shirt", variantName: "M", sku: "S-M", quantity: 1, unitPrice: 10, lineTotal: 10 }],
      qrToken: "secret-token",
      purchaseLedgerEntryId: "secret-ledger",
      createdAt: 1,
      updatedAt: 1,
    } as any);
    expect(projected).not.toHaveProperty("qrToken");
    expect(projected).not.toHaveProperty("purchaseLedgerEntryId");
    expect(projected.lines[0]).not.toHaveProperty("purchaseInventoryEntryId");
  });
});
