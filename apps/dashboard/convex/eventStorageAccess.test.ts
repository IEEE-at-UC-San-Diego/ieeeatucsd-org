import { describe, expect, it } from "vitest";
import type { EventDocumentViewer } from "./eventReadAccess";
import {
  EventStorageAccess,
  type EventStorageSource,
} from "./eventStorageAccess";
import type { UserRole } from "./permissions";

function viewer(
  role: UserRole,
  overrides: Partial<EventDocumentViewer> = {},
): EventDocumentViewer {
  return { role, logtoId: `logto|${role}`, ...overrides };
}

function event(overrides: EventStorageSource = {}): EventStorageSource {
  return {
    requestedUser: "logto|submitter",
    files: ["storage_flyer"],
    roomBookingFiles: ["storage_room"],
    graphicsFiles: ["storage_graphics"],
    invoices: [
      {
        invoiceFile: "storage_invoice",
        additionalFiles: ["storage_receipt"],
      },
    ],
    ...overrides,
  };
}

describe("EventStorageAccess.canReadStorageId", () => {
  it("hides every attached file from a plain member", () => {
    const events = [event()];
    const member = viewer("Member", { logtoId: "logto|member" });
    for (const storageId of [
      "storage_flyer",
      "storage_room",
      "storage_graphics",
      "storage_invoice",
      "storage_receipt",
    ]) {
      expect(
        EventStorageAccess.canReadStorageId(member, events, storageId),
      ).toBe(false);
    }
  });

  it("does not treat a VCO title on a member as officer access", () => {
    expect(
      EventStorageAccess.canReadStorageId(
        viewer("Member", {
          logtoId: "logto|member",
          position: "Vice Chair Operations",
        }),
        [event()],
        "storage_invoice",
      ),
    ).toBe(false);
  });

  it("rejects a storage id that is not attached to an event", () => {
    const events = [
      event({
        invoices: [
          {
            invoiceFile: "storage_invoice",
            additionalFiles: [],
          },
        ],
      }),
    ];
    const withNote = {
      ...events[0],
      graphicsUploadNote: "storage_unattached",
      reviewFeedback: "storage_unattached",
      auditLogs: [{ fileUrl: "storage_unattached" }],
    };
    expect(
      EventStorageAccess.canReadStorageId(
        viewer("General Officer"),
        [withNote],
        "storage_unattached",
      ),
    ).toBe(false);
    expect(
      EventStorageAccess.canReadStorageId(
        viewer("Member", { logtoId: "logto|submitter" }),
        [withNote],
        "storage_unattached",
      ),
    ).toBe(false);
    expect(
      EventStorageAccess.canReadStorageId(viewer("Administrator"), events, ""),
    ).toBe(false);
  });

  it("lets the requester read files attached to their event", () => {
    const events = [event()];
    const requester = viewer("Member", { logtoId: "logto|submitter" });
    expect(
      EventStorageAccess.canReadStorageId(requester, events, "storage_invoice"),
    ).toBe(true);
    expect(
      EventStorageAccess.canReadStorageId(requester, events, "storage_receipt"),
    ).toBe(true);
    expect(
      EventStorageAccess.canReadStorageId(requester, events, "storage_room"),
    ).toBe(true);
    expect(
      EventStorageAccess.canReadStorageId(
        requester,
        events,
        "storage_graphics",
      ),
    ).toBe(true);
  });

  it("matches a requester stored under authUserId", () => {
    const events = [event({ requestedUser: "auth|submitter" })];
    expect(
      EventStorageAccess.canReadStorageId(
        viewer("Member", {
          logtoId: "logto|submitter",
          authUserId: "auth|submitter",
        }),
        events,
        "storage_flyer",
      ),
    ).toBe(true);
  });

  it("does not let a requester read another event's file", () => {
    expect(
      EventStorageAccess.canReadStorageId(
        viewer("Member", { logtoId: "logto|submitter" }),
        [
          event({
            requestedUser: "logto|someone-else",
            files: ["storage_other"],
          }),
        ],
        "storage_other",
      ),
    ).toBe(false);
  });

  it("lets an officer read a file attached to any event", () => {
    const events = [event()];
    for (const role of [
      "General Officer",
      "Executive Officer",
      "Administrator",
    ] as const) {
      expect(
        EventStorageAccess.canReadStorageId(
          viewer(role, { logtoId: "logto|officer" }),
          events,
          "storage_invoice",
        ),
      ).toBe(true);
      expect(
        EventStorageAccess.canReadStorageId(
          viewer(role, { logtoId: "logto|officer" }),
          events,
          "storage_missing",
        ),
      ).toBe(false);
    }
  });
});
