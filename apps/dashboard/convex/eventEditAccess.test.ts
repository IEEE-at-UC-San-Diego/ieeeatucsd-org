import { describe, expect, it } from "vitest";
import { EventEditAccess, type EventEditor } from "./eventEditAccess";
import type { UserRole } from "./permissions";

function editor(
  role: UserRole,
  overrides: Partial<EventEditor> = {},
): EventEditor {
  return { role, logtoId: `logto|${role}`, ...overrides };
}

describe("EventEditAccess", () => {
  it("lets an officer edit another person's approved event", () => {
    expect(
      EventEditAccess.denialReason(editor("General Officer"), {
        requestedUser: "logto|someone-else",
        status: "approved",
      }),
    ).toBeNull();
    expect(
      EventEditAccess.denialReason(editor("Executive Officer"), {
        requestedUser: "logto|someone-else",
        status: "declined",
      }),
    ).toBeNull();
    expect(
      EventEditAccess.denialReason(editor("Administrator"), {
        requestedUser: "logto|someone-else",
        status: "approved",
      }),
    ).toBeNull();
  });

  it("lets a member edit their own draft", () => {
    const member = editor("Member", { logtoId: "logto|member" });
    expect(
      EventEditAccess.denialReason(member, {
        requestedUser: "logto|member",
        status: "draft",
      }),
    ).toBeNull();
  });

  it("matches the requester by authUserId when logtoId is absent", () => {
    const member = editor("Member", {
      logtoId: undefined,
      authUserId: "auth|member",
    });
    expect(
      EventEditAccess.denialReason(member, {
        requestedUser: "auth|member",
        status: "submitted",
      }),
    ).toBeNull();
  });

  it("rejects a member editing someone else's event", () => {
    expect(() =>
      EventEditAccess.assertCanEdit(editor("Member"), {
        requestedUser: "logto|owner",
        status: "draft",
      }),
    ).toThrow("You can only edit your own events");
  });

  it("rejects a member editing their own approved event", () => {
    const member = editor("Member", { logtoId: "logto|member" });
    expect(() =>
      EventEditAccess.assertCanEdit(member, {
        requestedUser: "logto|member",
        status: "approved",
      }),
    ).toThrow(
      "Cannot edit an event that has already been approved or declined",
    );
  });

  it("does not treat a member with a VCO title as an officer", () => {
    expect(() =>
      EventEditAccess.assertCanEdit(editor("Member"), {
        requestedUser: "logto|owner",
        status: "pending",
      }),
    ).toThrow("You can only edit your own events");
  });
});
