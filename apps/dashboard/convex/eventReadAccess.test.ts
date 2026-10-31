import { describe, expect, it } from "vitest";
import { EventReadAccess, type EventDocumentViewer } from "./eventReadAccess";
import type { UserRole } from "./permissions";

const PUBLIC_KEYS = [
  "_id",
  "eventName",
  "eventDescription",
  "eventCode",
  "location",
  "files",
  "pointsToReward",
  "startDate",
  "endDate",
  "published",
  "eventType",
  "hasFood",
];

const SENSITIVE_KEYS = [
  "invoices",
  "finId",
  "funded",
  "tresOwner",
  "dateTbd",
  "progAppDoneAt",
  "progAppDoneBy",
  "tresStartDoneAt",
  "tresStartDoneBy",
  "tresFinishDoneAt",
  "tresFinishDoneBy",
  "auditLogs",
  "requestedUser",
  "roomBookingFiles",
  "graphicsFiles",
  "reviewFeedback",
  "status",
  "asFundingRequired",
  "needsAsFunding",
  "department",
  "_creationTime",
];

function viewer(
  role: UserRole,
  overrides: Partial<EventDocumentViewer> = {},
): EventDocumentViewer {
  return {
    role,
    logtoId: `logto|${role}`,
    ...overrides,
  };
}

function fundedEvent(overrides: Record<string, unknown> = {}) {
  return {
    _id: "events:industry-night",
    _creationTime: 1_760_000_000_000,
    eventName: "Industry Night",
    eventDescription: "Career fair",
    eventCode: "IN-24",
    location: "Price Center Ballroom",
    files: ["https://cdn.example/flyer.png"],
    pointsToReward: 5,
    startDate: 1_762_100_000_000,
    endDate: 1_762_106_000_000,
    published: true,
    eventType: "professional" as const,
    hasFood: true,
    requestedUser: "logto|submitter",
    department: "events",
    status: "approved",
    asFundingRequired: true,
    needsAsFunding: true,
    expectedAttendance: 200,
    roomBookingFiles: ["file_booking"],
    graphicsFiles: ["file_graphic"],
    reviewFeedback: "Need AS logo",
    auditLogs: [{ id: "1", action: "updated", performedBy: "logto|officer" }],
    invoices: [{ vendor: "Catering Co", total: 840, invoiceFile: "file_1" }],
    dateTbd: false,
    finId: "FIN-4491",
    funded: true,
    tresOwner: "vco" as const,
    progAppDoneAt: 1_761_000_000_000,
    progAppDoneBy: "logto|vco",
    tresStartDoneAt: 1_761_100_000_000,
    tresStartDoneBy: "logto|vco",
    tresFinishDoneAt: 1_761_200_000_000,
    tresFinishDoneBy: "logto|vco",
    ...overrides,
  };
}

describe("EventReadAccess.forViewer", () => {
  it("hides invoices and funding fields from a plain member", () => {
    const event = fundedEvent();
    const view = EventReadAccess.forViewer(viewer("Member"), event);

    expect(view).not.toBe(event);
    expect(Object.keys(view ?? {}).sort()).toEqual([...PUBLIC_KEYS].sort());
    for (const key of SENSITIVE_KEYS) {
      expect(view).not.toHaveProperty(key);
    }
    expect(view).toMatchObject({
      _id: "events:industry-night",
      eventName: "Industry Night",
      eventCode: "IN-24",
      location: "Price Center Ballroom",
      pointsToReward: 5,
      published: true,
    });
  });

  it("does not treat a VCO title on a member as funding access", () => {
    const view = EventReadAccess.forViewer(
      viewer("Member", { position: "Vice Chair Operations" }),
      fundedEvent(),
    );

    expect(view).not.toHaveProperty("invoices");
    expect(view).not.toHaveProperty("finId");
    expect(view).not.toHaveProperty("funded");
  });

  it("returns the full document to an officer authorized to view funding", () => {
    const event = fundedEvent();
    const vco = EventReadAccess.forViewer(
      viewer("General Officer", {
        logtoId: "logto|vco",
        position: "Vice Chair Operations",
      }),
      event,
    );
    const executive = EventReadAccess.forViewer(
      viewer("Executive Officer", { logtoId: "logto|exec" }),
      event,
    );

    expect(vco).toBe(event);
    expect(executive).toBe(event);
    expect(vco).toMatchObject({
      invoices: [{ vendor: "Catering Co", total: 840, invoiceFile: "file_1" }],
      finId: "FIN-4491",
      funded: true,
      tresOwner: "vco",
      progAppDoneBy: "logto|vco",
    });
  });

  it("returns the full document to an officer who manages funding tools", () => {
    const event = fundedEvent();
    const view = EventReadAccess.forViewer(
      viewer("General Officer", { logtoId: "logto|events-chair" }),
      event,
    );

    expect(view).toBe(event);
    expect(view).toHaveProperty("invoices");
    expect(view).toMatchObject({ finId: "FIN-4491", funded: true });
  });

  it("returns the full document to the event requester", () => {
    const event = fundedEvent();
    const view = EventReadAccess.forViewer(
      viewer("Member", { logtoId: "logto|submitter" }),
      event,
    );

    expect(view).toBe(event);
    expect(view).toHaveProperty("invoices");
    expect(view).toMatchObject({ finId: "FIN-4491" });
  });

  it("matches a requester stored under authUserId", () => {
    const event = fundedEvent({ requestedUser: "auth|submitter" });
    const view = EventReadAccess.forViewer(
      viewer("Member", {
        logtoId: "logto|submitter",
        authUserId: "auth|submitter",
      }),
      event,
    );

    expect(view).toBe(event);
    expect(view).toHaveProperty("invoices");
  });

  it("returns null when the event does not exist", () => {
    expect(EventReadAccess.forViewer(viewer("Member"), null)).toBeNull();
    expect(EventReadAccess.forViewer(viewer("Administrator"), null)).toBeNull();
  });
});
