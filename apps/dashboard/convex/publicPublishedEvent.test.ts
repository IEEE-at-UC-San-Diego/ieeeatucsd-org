import { describe, expect, it } from "vitest";
import { PublicPublishedEvent } from "./publicPublishedEvent";

const calendarMeta = {
  publicGoogleEventId: "evt_1",
  publicGoogleEventUrl: "https://calendar.example/event",
  publicGoogleCalendarId: "cal@group.calendar.google.com",
  publicGoogleCalendarSubscribeUrl: "https://calendar.example/subscribe",
  publicGoogleCalendarIcsUrl: "https://calendar.example/cal.ics",
};

describe("PublicPublishedEvent.fromDocument", () => {
  it("keeps only the public listing fields", () => {
    const view = PublicPublishedEvent.fromDocument(
      {
        _id: "events:workshop",
        eventName: "Late Workshop",
        eventDescription: "Soldering",
        eventCode: "WS-18",
        location: "CSE 1202",
        files: ["https://cdn.example/flyer.png"],
        pointsToReward: 10,
        startDate: 1_762_000_000_000,
        endDate: 1_762_003_600_000,
        published: true,
        eventType: "technical",
        hasFood: true,
      },
      { attendeeCount: 12, ...calendarMeta },
    );

    expect(view).toEqual({
      _id: "events:workshop",
      eventName: "Late Workshop",
      eventDescription: "Soldering",
      eventCode: "WS-18",
      location: "CSE 1202",
      files: ["https://cdn.example/flyer.png"],
      pointsToReward: 10,
      startDate: 1_762_000_000_000,
      endDate: 1_762_003_600_000,
      published: true,
      eventType: "technical",
      hasFood: true,
      attendeeCount: 12,
      ...calendarMeta,
    });
  });

  it("drops VCO pipeline, invoice, and request-workflow fields", () => {
    const fatEvent = {
      _id: "events:industry-night",
      eventName: "Industry Night",
      eventDescription: "Career fair",
      location: "Price Center Ballroom",
      startDate: 1_762_100_000_000,
      endDate: 1_762_106_000_000,
      published: true,
      eventType: "professional" as const,
      finId: "FIN-4491",
      funded: true,
      tresOwner: "vco",
      dateTbd: false,
      invoices: [{ vendor: "Catering Co", total: 840, invoiceFile: "file_1" }],
      auditLogs: [{ id: "1", action: "updated", performedBy: "logto|officer" }],
      requestedUser: "logto|submitter",
      roomBookingFiles: ["file_booking"],
      graphicsFiles: ["file_graphic"],
      reviewFeedback: "Need AS logo",
      declinedReason: null,
      status: "approved",
      asFundingRequired: true,
      needsAsFunding: true,
      expectedAttendance: 200,
      department: "events",
      createdAt: 1_760_000_000_000,
      _creationTime: 1_760_000_000_000,
    };

    const view = PublicPublishedEvent.fromDocument(fatEvent, {
      attendeeCount: 0,
      ...calendarMeta,
    });

    expect(view).not.toHaveProperty("finId");
    expect(view).not.toHaveProperty("funded");
    expect(view).not.toHaveProperty("tresOwner");
    expect(view).not.toHaveProperty("invoices");
    expect(view).not.toHaveProperty("auditLogs");
    expect(view).not.toHaveProperty("requestedUser");
    expect(view).not.toHaveProperty("roomBookingFiles");
    expect(view).not.toHaveProperty("reviewFeedback");
    expect(view).not.toHaveProperty("status");
    expect(view).not.toHaveProperty("_creationTime");
    expect(Object.keys(view)).toEqual(
      expect.arrayContaining([
        "_id",
        "eventName",
        "eventDescription",
        "location",
        "startDate",
        "endDate",
        "attendeeCount",
      ]),
    );
  });
});
