import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { GRAPHICS_ATTACH_DENIED } from "./eventGraphicsAttachment";

const SECRET = "storage-write-test-secret";
process.env.CONVEX_SESSION_SECRET = SECRET;

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"]);

// The deployed schema has a `_updatedAt` field convex-test 0.0.41 rejects.
// These tests only touch the tables create, update, and getStorageUrl use.
const schema = defineSchema({
  users: defineTable({
    logtoId: v.optional(v.string()),
    authUserId: v.optional(v.string()),
    email: v.string(),
    emailVisibility: v.boolean(),
    verified: v.boolean(),
    name: v.string(),
    signedUp: v.boolean(),
    requestedEmail: v.boolean(),
    role: v.union(v.literal("Member"), v.literal("General Officer")),
    status: v.literal("active"),
    joinDate: v.number(),
  }).index("by_logtoId", ["logtoId"]),
  events: defineTable({
    eventName: v.string(),
    eventDescription: v.string(),
    eventCode: v.optional(v.string()),
    location: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    published: v.optional(v.boolean()),
    status: v.optional(v.string()),
    requestedUser: v.optional(v.string()),
    flyersCompleted: v.optional(v.boolean()),
    isDraft: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
    roomBookingFiles: v.optional(v.array(v.string())),
    graphicsFiles: v.optional(v.array(v.string())),
    invoices: v.optional(
      v.array(
        v.object({
          id: v.string(),
          vendor: v.string(),
          items: v.array(
            v.object({
              description: v.string(),
              quantity: v.number(),
              unitPrice: v.number(),
              total: v.number(),
            }),
          ),
          tax: v.number(),
          tip: v.number(),
          invoiceFile: v.optional(v.string()),
          additionalFiles: v.array(v.string()),
          subtotal: v.number(),
          total: v.number(),
        }),
      ),
    ),
  }).index("by_requestedUser", ["requestedUser"]),
  storageFileOwners: defineTable({
    storageId: v.string(),
    ownerId: v.string(),
  }).index("by_storageId", ["storageId"]),
  storageUploadGrants: defineTable({
    ownerId: v.string(),
    sha256: v.string(),
    createdAt: v.number(),
  }).index("by_ownerId_and_sha256", ["ownerId", "sha256"]),
});

const MEMBER = "logto|member";
const OFFICER = "logto|officer";

async function authToken(sub: string) {
  const payload = {
    sub,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
    v: 1,
  };
  const encoded = encodeURIComponent(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(encoded),
  );
  const hex = [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `${encoded}.${hex}`;
}

function invoice(invoiceFile?: string, additionalFiles: string[] = []) {
  return {
    id: "inv_1",
    vendor: "Cafe",
    items: [
      { description: "Coffee", quantity: 1, unitPrice: 3, total: 3 },
    ],
    tax: 0,
    tip: 0,
    ...(invoiceFile ? { invoiceFile } : {}),
    additionalFiles,
    subtotal: 3,
    total: 3,
  };
}

function createArgs(
  token: string,
  logtoId: string,
  extra: Record<string, unknown> = {},
) {
  return {
    logtoId,
    authToken: token,
    eventName: "Social",
    eventDescription: "Member event",
    location: "Price Center",
    startDate: 1_700_000_000_000,
    endDate: 1_700_003_600_000,
    ...extra,
  };
}

async function seedUser(
  t: ReturnType<typeof convexTest>,
  logtoId: string,
  role: "Member" | "General Officer",
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      logtoId,
      email: `${role}@example.com`,
      emailVisibility: false,
      verified: true,
      name: role,
      signedUp: true,
      requestedEmail: false,
      role,
      status: "active",
      joinDate: 1,
    });
  });
}

async function rejectionMessage(promise: Promise<unknown>) {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe("events create and update storage ids", () => {
  it("rejects a foreign storage id on create and leaves getStorageUrl denied", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, MEMBER, "Member");
    const token = await authToken(MEMBER);
    const foreignId = await t.run(async (ctx) => ctx.storage.store(new Blob(["secret"])));

    for (const extra of [
      { roomBookingFiles: [foreignId] },
      { invoices: [invoice(foreignId)] },
      { invoices: [invoice(undefined, [foreignId])] },
    ]) {
      const message = await rejectionMessage(
        t.mutation(api.events.create, createArgs(token, MEMBER, extra)),
      );
      expect(message).toContain(GRAPHICS_ATTACH_DENIED);
    }

    const saved = await t.run(async (ctx) => ctx.db.query("events").collect());
    expect(saved).toHaveLength(0);
    const readMessage = await rejectionMessage(
      t.mutation(api.events.getStorageUrl, {
        logtoId: MEMBER,
        authToken: token,
        storageId: foreignId,
      }),
    );
    expect(readMessage).toContain("Storage file is not attached to an event you can view");
  });

  it("rejects a foreign storage id on update and does not store it", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, MEMBER, "Member");
    const token = await authToken(MEMBER);
    const foreignId = await t.run(async (ctx) => ctx.storage.store(new Blob(["secret"])));
    const eventId = await t.run(async (ctx) =>
      ctx.db.insert("events", {
        eventName: "Mine",
        eventDescription: "desc",
        location: "Here",
        startDate: 1_700_000_000_000,
        endDate: 1_700_003_600_000,
        requestedUser: MEMBER,
        status: "draft",
      }),
    );

    for (const extra of [
      { roomBookingFiles: [foreignId] },
      { invoices: [invoice(foreignId)] },
      { invoices: [invoice(undefined, [foreignId])] },
      { graphicsFiles: [foreignId] },
    ]) {
      const message = await rejectionMessage(
        t.mutation(api.events.update, {
          logtoId: MEMBER,
          authToken: token,
          id: eventId,
          ...extra,
        }),
      );
      expect(message).toContain(GRAPHICS_ATTACH_DENIED);
    }

    const saved = await t.run(async (ctx) => ctx.db.get(eventId));
    expect(saved?.roomBookingFiles ?? []).toEqual([]);
    expect(saved?.graphicsFiles ?? []).toEqual([]);
    expect(saved?.invoices ?? []).toEqual([]);
    const readMessage = await rejectionMessage(
      t.mutation(api.events.getStorageUrl, {
        logtoId: MEMBER,
        authToken: token,
        storageId: foreignId,
      }),
    );
    expect(readMessage).toContain("Storage file is not attached to an event you can view");
  });

  it("lets a member save a file they uploaded and then resolve it", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, MEMBER, "Member");
    const token = await authToken(MEMBER);
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["poster"])));
    await t.run(async (ctx) => {
      await ctx.db.insert("storageFileOwners", { storageId, ownerId: MEMBER });
    });

    const eventId = await t.mutation(
      api.events.create,
      createArgs(token, MEMBER, {
        roomBookingFiles: [storageId],
        invoices: [invoice(storageId, [storageId])],
      }),
    );
    const graphicsId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["graphic"])),
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("storageFileOwners", {
        storageId: graphicsId,
        ownerId: MEMBER,
      });
    });
    await t.mutation(api.events.update, {
      logtoId: MEMBER,
      authToken: token,
      id: eventId,
      graphicsFiles: [graphicsId],
    });

    const saved = await t.run(async (ctx) => ctx.db.get(eventId));
    expect(saved?.roomBookingFiles).toEqual([storageId]);
    expect(saved?.invoices?.[0]?.invoiceFile).toBe(storageId);
    expect(saved?.invoices?.[0]?.additionalFiles).toEqual([storageId]);
    expect(saved?.graphicsFiles).toEqual([graphicsId]);

    const url = await t.mutation(api.events.getStorageUrl, {
      logtoId: MEMBER,
      authToken: token,
      storageId: graphicsId,
    });
    expect(url).toMatch(/^https:\/\/.+\/api\/storage\/.+/);
  });

  it("still lets a member resend a link and a file already on their event", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, MEMBER, "Member");
    const token = await authToken(MEMBER);
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["poster"])));
    const eventId = await t.run(async (ctx) =>
      ctx.db.insert("events", {
        eventName: "Mine",
        eventDescription: "desc",
        location: "Here",
        startDate: 1_700_000_000_000,
        endDate: 1_700_003_600_000,
        requestedUser: MEMBER,
        status: "submitted",
        roomBookingFiles: ["https://drive.example/booking", storageId],
      }),
    );

    const createdId = await t.mutation(
      api.events.create,
      createArgs(token, MEMBER, {
        roomBookingFiles: ["https://drive.example/new"],
      }),
    );
    const created = await t.run(async (ctx) => ctx.db.get(createdId));
    expect(created?.roomBookingFiles).toEqual(["https://drive.example/new"]);

    await t.mutation(api.events.update, {
      logtoId: MEMBER,
      authToken: token,
      id: eventId,
      roomBookingFiles: ["https://drive.example/booking", storageId],
    });
    const saved = await t.run(async (ctx) => ctx.db.get(eventId));
    expect(saved?.roomBookingFiles).toEqual([
      "https://drive.example/booking",
      storageId,
    ]);
  });

  it("rejects an unattached storage id from an officer on create", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, OFFICER, "General Officer");
    const token = await authToken(OFFICER);
    const foreignId = await t.run(async (ctx) => ctx.storage.store(new Blob(["secret"])));
    const message = await rejectionMessage(
      t.mutation(
        api.events.create,
        createArgs(token, OFFICER, { roomBookingFiles: [foreignId] }),
      ),
    );
    expect(message).toContain(GRAPHICS_ATTACH_DENIED);
  });
});
