import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = (
  import.meta as ImportMeta & {
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
).glob("./**/*.ts");
const authToken = "unused-with-test-identity";

type Seed = {
  memberId: Id<"users">;
  member2Id: Id<"users">;
  officerId: Id<"users">;
  managerId: Id<"users">;
  productId: Id<"merchProducts">;
  variantId: Id<"merchVariants">;
  slotId: Id<"merchPickupSlots">;
  slot2Id: Id<"merchPickupSlots">;
};

async function seedStore(balance = 100, stock = 2, capacity = 2, purchaseLimit?: number) {
  // convex-test 0.0.41 is the newest release compatible with this repository's
  // Convex runtime. Omit one unrelated legacy table whose `_updatedAt` field the
  // older harness cannot parse, while retaining schema/index validation here.
  const { sponsorDomains: _legacyTable, ...testTables } = schema.tables;
  const testSchema = { ...schema, tables: testTables } as typeof schema;
  const t = convexTest(testSchema, modules);
  const now = Date.now();
  const ids = await t.run(async (ctx): Promise<Seed> => {
    const user = async (logtoId: string, role: "Member" | "General Officer" | "Executive Officer") =>
      await ctx.db.insert("users", {
        logtoId,
        email: `${logtoId}@example.com`,
        emailVisibility: false,
        verified: true,
        name: logtoId,
        signedUp: true,
        requestedEmail: false,
        role,
        status: "active",
        joinDate: now,
        points: logtoId === "member" ? balance : 0,
        lifetimePointsEarned: logtoId === "member" ? balance : 0,
      });
    const memberId = await user("member", "Member");
    const member2Id = await user("member2", "Member");
    const officerId = await user("officer", "General Officer");
    const managerId = await user("manager", "Executive Officer");
    await ctx.db.insert("pointAccounts", {
      userId: memberId,
      balance,
      lifetimeEarned: balance,
      initializedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("pointAccounts", {
      userId: member2Id,
      balance,
      lifetimeEarned: balance,
      initializedAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("organizationSettings", {
      merchStoreEnabled: true,
      merchCheckoutEnabled: true,
      merchMemberCancellationCutoffMinutes: 30,
    });
    const productId = await ctx.db.insert("merchProducts", {
      name: "Integration Tee",
      description: "Test product",
      status: "active",
      purchaseLimit,
      displayOrder: 0,
      revision: 1,
      createdAt: now,
      createdBy: managerId,
      updatedAt: now,
      updatedBy: managerId,
    });
    const variantId = await ctx.db.insert("merchVariants", {
      productId,
      sku: "TEE-TEST",
      normalizedSku: "tee-test",
      optionValues: [{ name: "Size", value: "M" }],
      pointPrice: 25,
      stockOnHand: stock,
      active: true,
      revision: 1,
      createdAt: now,
      createdBy: managerId,
      updatedAt: now,
      updatedBy: managerId,
    });
    await ctx.db.insert("merchInventoryEntries", {
      variantId,
      quantityDelta: stock,
      resultingQuantity: stock,
      kind: "initial",
      idempotencyKey: "seed-stock",
      actorId: managerId,
      reason: "Integration test seed",
      createdAt: now,
    });
    const windowId = await ctx.db.insert("merchPickupWindows", {
      requestId: "integration-window",
      displayName: "Project Space",
      address: "EBU1-4710",
      timezone: "America/Los_Angeles",
      startAt: now + 3_600_000,
      endAt: now + 10_800_000,
      slotDurationMinutes: 60,
      defaultCapacity: capacity,
      enabled: true,
      createdAt: now,
      createdBy: managerId,
      updatedAt: now,
      updatedBy: managerId,
    });
    const slotId = await ctx.db.insert("merchPickupSlots", {
      windowId,
      startAt: now + 3_600_000,
      endAt: now + 7_200_000,
      capacity,
      bookedCount: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      updatedBy: managerId,
    });
    const slot2Id = await ctx.db.insert("merchPickupSlots", {
      windowId,
      startAt: now + 7_200_000,
      endAt: now + 10_800_000,
      capacity,
      bookedCount: 0,
      enabled: true,
      createdAt: now,
      updatedAt: now,
      updatedBy: managerId,
    });
    return { memberId, member2Id, officerId, managerId, productId, variantId, slotId, slot2Id };
  });
  return { t, ...ids };
}

function checkoutArgs(seed: Seed, idempotencyKey = "checkout-integration-1") {
  return {
    logtoId: "member",
    authToken,
    lines: [
      {
        productId: seed.productId,
        variantId: seed.variantId,
        quantity: 1,
        expectedProductRevision: 1,
        expectedVariantRevision: 1,
        expectedUnitPrice: 25,
      },
    ],
    pickup: { type: "slot" as const, pickupSlotId: seed.slotId },
    idempotencyKey,
  };
}

describe("merch transactional integration", () => {
  test("checkout retry, cancellation retry, and every exact reversal are idempotent", async () => {
    const seed = await seedStore();
    const member = seed.t.withIdentity({ subject: "member" });
    const args = checkoutArgs(seed);
    const first = await member.mutation(api.merchOrders.checkout, args);
    const retry = await member.mutation(api.merchOrders.checkout, args);
    expect(retry._id).toBe(first._id);
    expect(first.lines[0]).toEqual({
      productName: "Integration Tee",
      variantName: "M",
      sku: "TEE-TEST",
      unitPrice: 25,
      quantity: 1,
      lineTotal: 25,
      imageUrl: undefined,
    });

    const canceled = await member.mutation(api.merchOrders.cancelMine, {
      logtoId: "member",
      authToken,
      orderId: first._id,
      requestId: "cancel-integration-1",
    });
    const cancelRetry = await member.mutation(api.merchOrders.cancelMine, {
      logtoId: "member",
      authToken,
      orderId: first._id,
      requestId: "cancel-integration-1",
    });
    expect(canceled.status).toBe("canceled");
    expect(cancelRetry.status).toBe("canceled");

    const state = await seed.t.run(async (ctx) => ({
      orders: await ctx.db.query("merchOrders").collect(),
      pointEntries: await ctx.db.query("pointLedgerEntries").collect(),
      inventoryEntries: await ctx.db.query("merchInventoryEntries").collect(),
      account: await ctx.db
        .query("pointAccounts")
        .withIndex("by_userId", (q) => q.eq("userId", seed.memberId))
        .unique(),
      variant: await ctx.db.get(seed.variantId),
      slot: await ctx.db.get(seed.slotId),
    }));
    expect(state.orders).toHaveLength(1);
    expect(state.pointEntries.map((entry) => entry.balanceDelta)).toEqual([-25, 25]);
    expect(state.inventoryEntries.map((entry) => entry.quantityDelta)).toEqual([2, -1, 1]);
    expect(state.account?.balance).toBe(100);
    expect(state.variant?.stockOnHand).toBe(2);
    expect(state.slot?.bookedCount).toBe(0);
  });

  test("a rejected checkout leaves order, ledger, stock, and capacity unchanged", async () => {
    const seed = await seedStore(10, 1, 1);
    const member = seed.t.withIdentity({ subject: "member" });
    await expect(
      member.mutation(api.merchOrders.checkout, checkoutArgs(seed)),
    ).rejects.toThrow();
    const state = await seed.t.run(async (ctx) => ({
      orders: await ctx.db.query("merchOrders").collect(),
      pointEntries: await ctx.db.query("pointLedgerEntries").collect(),
      inventoryEntries: await ctx.db.query("merchInventoryEntries").collect(),
      variant: await ctx.db.get(seed.variantId),
      slot: await ctx.db.get(seed.slotId),
    }));
    expect(state.orders).toHaveLength(0);
    expect(state.pointEntries).toHaveLength(0);
    expect(state.inventoryEntries).toHaveLength(1);
    expect(state.variant?.stockOnHand).toBe(1);
    expect(state.slot?.bookedCount).toBe(0);
  });

  test("a reused checkout key with changed semantics is rejected without a second debit", async () => {
    const seed = await seedStore(100, 3, 3);
    const member = seed.t.withIdentity({ subject: "member" });
    const args = checkoutArgs(seed, "checkout-fingerprint");
    await member.mutation(api.merchOrders.checkout, args);
    await expect(
      member.mutation(api.merchOrders.checkout, {
        ...args,
        lines: [{ ...args.lines[0], quantity: 2 }],
      }),
    ).rejects.toThrow();
    const state = await seed.t.run(async (ctx) => ({
      orders: await ctx.db.query("merchOrders").collect(),
      purchases: (await ctx.db.query("pointLedgerEntries").collect()).filter(
        (entry) => entry.kind === "purchase",
      ),
      variant: await ctx.db.get(seed.variantId),
    }));
    expect(state.orders).toHaveLength(1);
    expect(state.purchases).toHaveLength(1);
    expect(state.variant?.stockOnHand).toBe(2);
  });

  test("competing checkouts cannot take the same last stock unit", async () => {
    const seed = await seedStore(100, 1, 2);
    const first = seed.t.withIdentity({ subject: "member" });
    const second = seed.t.withIdentity({ subject: "member2" });
    const results = await Promise.allSettled([
      first.mutation(api.merchOrders.checkout, checkoutArgs(seed, "last-stock-1")),
      second.mutation(api.merchOrders.checkout, {
        ...checkoutArgs(seed, "last-stock-2"),
        logtoId: "member2",
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const state = await seed.t.run(async (ctx) => ({
      orders: await ctx.db.query("merchOrders").collect(),
      variant: await ctx.db.get(seed.variantId),
    }));
    expect(state.orders).toHaveLength(1);
    expect(state.variant?.stockOnHand).toBe(0);
  });

  test("competing checkouts cannot overbook the last pickup capacity", async () => {
    const seed = await seedStore(100, 2, 1);
    const first = seed.t.withIdentity({ subject: "member" });
    const second = seed.t.withIdentity({ subject: "member2" });
    const results = await Promise.allSettled([
      first.mutation(api.merchOrders.checkout, checkoutArgs(seed, "last-slot-1")),
      second.mutation(api.merchOrders.checkout, {
        ...checkoutArgs(seed, "last-slot-2"),
        logtoId: "member2",
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const state = await seed.t.run(async (ctx) => ({
      orders: await ctx.db.query("merchOrders").collect(),
      slot: await ctx.db.get(seed.slotId),
      variant: await ctx.db.get(seed.variantId),
    }));
    expect(state.orders).toHaveLength(1);
    expect(state.slot?.bookedCount).toBe(1);
    expect(state.variant?.stockOnHand).toBe(1);
  });

  test("concurrent attempts cannot bypass a per-member purchase limit", async () => {
    const seed = await seedStore(100, 2, 2, 1);
    const member = seed.t.withIdentity({ subject: "member" });
    const results = await Promise.allSettled([
      member.mutation(api.merchOrders.checkout, checkoutArgs(seed, "limit-race-1")),
      member.mutation(api.merchOrders.checkout, {
        ...checkoutArgs(seed, "limit-race-2"),
        pickup: { type: "slot" as const, pickupSlotId: seed.slot2Id },
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const state = await seed.t.run(async (ctx) => ({
      orders: await ctx.db.query("merchOrders").collect(),
      purchases: (await ctx.db.query("pointLedgerEntries").collect()).filter(
        (entry) => entry.kind === "purchase",
      ),
    }));
    expect(state.orders).toHaveLength(1);
    expect(state.purchases).toHaveLength(1);
  });

  test("reschedule retry transfers capacity exactly once", async () => {
    const seed = await seedStore();
    const member = seed.t.withIdentity({ subject: "member" });
    const manager = seed.t.withIdentity({ subject: "manager" });
    const order = await member.mutation(api.merchOrders.checkout, checkoutArgs(seed));
    const args = {
      logtoId: "manager",
      authToken,
      orderId: order._id,
      pickup: { type: "slot" as const, pickupSlotId: seed.slot2Id },
      reason: "Member requested another time",
      requestId: "reschedule-integration-1",
    };
    await manager.mutation(api.merchOrders.rescheduleForManager, args);
    await manager.mutation(api.merchOrders.rescheduleForManager, args);
    const state = await seed.t.run(async (ctx) => ({
      firstSlot: await ctx.db.get(seed.slotId),
      secondSlot: await ctx.db.get(seed.slot2Id),
      events: await ctx.db
        .query("merchOrderEvents")
        .withIndex("by_order_createdAt", (q) => q.eq("orderId", order._id))
        .collect(),
    }));
    expect(state.firstSlot?.bookedCount).toBe(0);
    expect(state.secondSlot?.bookedCount).toBe(1);
    expect(state.events.filter((event) => event.action === "rescheduled")).toHaveLength(1);
  });

  test("fulfillment is preview-first and repeat confirmation is idempotent", async () => {
    const seed = await seedStore();
    const member = seed.t.withIdentity({ subject: "member" });
    const officer = seed.t.withIdentity({ subject: "officer" });
    const order = await member.mutation(api.merchOrders.checkout, checkoutArgs(seed));
    const preview = await officer.query(api.merchFulfillment.previewByToken, {
      logtoId: "officer",
      authToken,
      token: order.qrToken!,
    });
    expect(preview.result).toBe("found");
    expect((await seed.t.run((ctx) => ctx.db.get(order._id)))?.status).toBe("pending");

    const confirmArgs = {
      logtoId: "officer",
      authToken,
      orderId: order._id,
      token: order.qrToken!,
      requestId: "fulfill-integration-1",
    };
    const confirmations = await Promise.all([
      officer.mutation(api.merchFulfillment.confirm, confirmArgs),
      officer.mutation(api.merchFulfillment.confirm, {
        ...confirmArgs,
        requestId: "fulfill-integration-2",
      }),
    ]);
    expect(confirmations.map((result) => result.result).sort()).toEqual([
      "already_fulfilled",
      "fulfilled",
    ]);
    const events = await seed.t.run((ctx) =>
      ctx.db
        .query("merchOrderEvents")
        .withIndex("by_order_createdAt", (q) => q.eq("orderId", order._id))
        .collect(),
    );
    expect(events.filter((event) => event.action === "fulfilled")).toHaveLength(1);
  });

  test("inactive managers cannot adjust point balances", async () => {
    const seed = await seedStore();
    await seed.t.run(async (ctx) => {
      await ctx.db.patch(seed.managerId, { status: "suspended" });
    });
    const manager = seed.t.withIdentity({ subject: "manager" });
    await expect(
      manager.mutation(api.points.adjust, {
        logtoId: "manager",
        authToken,
        userId: seed.memberId,
        amount: 5,
        mode: "spendable_only",
        reason: "Should be rejected",
        requestId: "adjust-integration-1",
      }),
    ).rejects.toThrow("active, fully onboarded");
  });

  test("inactive shoppers and non-manager officers are rejected server-side", async () => {
    const seed = await seedStore();
    await seed.t.run((ctx) => ctx.db.patch(seed.memberId, { status: "inactive" }));
    const member = seed.t.withIdentity({ subject: "member" });
    await expect(
      member.mutation(api.merchOrders.checkout, checkoutArgs(seed)),
    ).rejects.toThrow("active, fully onboarded");

    const officer = seed.t.withIdentity({ subject: "officer" });
    await expect(
      officer.query(api.merchCatalog.reconcileInventory, {
        logtoId: "officer",
        authToken,
      }),
    ).rejects.toThrow("admin access required");
  });
});
