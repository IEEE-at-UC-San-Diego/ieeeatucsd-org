import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_generated/server", () => ({
  query: (definition: unknown) => definition,
  mutation: (definition: unknown) => definition,
}));

vi.mock("./permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./permissions")>();
  return {
    ...actual,
    requireCurrentUser: vi.fn(),
  };
});

import type { Doc, Id } from "./_generated/dataModel";
import { remove, update } from "./events";
import { requireCurrentUser, type UserRole } from "./permissions";

type MutationHandler = {
  handler: (ctx: unknown, args: Record<string, unknown>) => Promise<unknown>;
};

const requireUser = vi.mocked(requireCurrentUser);

function asMutation(value: unknown): MutationHandler {
  return value as MutationHandler;
}

function actor(role: UserRole, logtoId: string): Doc<"users"> {
  return {
    _id: "users:actor" as Id<"users">,
    _creationTime: 0,
    email: "actor@example.com",
    emailVisibility: false,
    verified: true,
    name: "Test user",
    signedUp: true,
    requestedEmail: false,
    role,
    status: "active",
    joinDate: 0,
    logtoId,
  };
}

function draftEvent(ownerId: string) {
  return {
    _id: "events:draft",
    requestedUser: ownerId,
    status: "draft",
    published: false,
    isDraft: true,
    startDate: Date.parse("2027-01-19T18:00:00.000Z"),
    endDate: Date.parse("2027-01-19T20:00:00.000Z"),
  };
}

function eventCtx(event: ReturnType<typeof draftEvent>) {
  return {
    db: {
      get: vi.fn(async () => event),
      delete: vi.fn(async () => undefined),
      patch: vi.fn(async () => undefined),
      insert: vi.fn(async () => "googleCalendarDeletionQueue:1"),
    },
  };
}

describe("events.remove", () => {
  beforeEach(() => {
    requireUser.mockReset();
  });

  it("lets the owner delete their own draft", async () => {
    const ownerId = "logto|owner";
    requireUser.mockResolvedValue(actor("Member", ownerId));
    const ctx = eventCtx(draftEvent(ownerId));

    await expect(
      asMutation(remove).handler(ctx, {
        logtoId: ownerId,
        authToken: "token",
        id: "events:draft",
      }),
    ).resolves.toBe("events:draft");

    expect(ctx.db.delete).toHaveBeenCalledWith("events:draft");
  });

  it("lets a general officer delete a draft they can already edit", async () => {
    const officerId = "logto|officer";
    requireUser.mockResolvedValue(actor("General Officer", officerId));
    const ctx = eventCtx(draftEvent("logto|organizer"));
    const args = {
      logtoId: officerId,
      authToken: "token",
      id: "events:draft",
    };

    await expect(asMutation(update).handler(ctx, args)).resolves.toBe(
      "events:draft",
    );
    await expect(asMutation(remove).handler(ctx, args)).resolves.toBe(
      "events:draft",
    );

    expect(ctx.db.delete).toHaveBeenCalledWith("events:draft");
  });

  it("rejects a delete from someone who cannot edit the event", async () => {
    const memberId = "logto|member";
    requireUser.mockResolvedValue(actor("Member", memberId));
    const ctx = eventCtx(draftEvent("logto|organizer"));
    const args = {
      logtoId: memberId,
      authToken: "token",
      id: "events:draft",
    };

    await expect(asMutation(update).handler(ctx, args)).rejects.toThrow(
      "You can only edit your own events",
    );
    await expect(asMutation(remove).handler(ctx, args)).rejects.toThrow(
      "You can only delete your own events",
    );
    expect(ctx.db.delete).not.toHaveBeenCalled();
  });
});
