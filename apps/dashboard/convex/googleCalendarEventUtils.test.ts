import { describe, expect, it, vi } from "vitest";
import {
  getGoogleCalendarEventTimeRangeError,
  normalizeGoogleCalendarEventsForSync,
} from "./googleCalendarEventUtils";

describe("getGoogleCalendarEventTimeRangeError", () => {
  it("accepts a valid Google Calendar event range", () => {
    expect(
      getGoogleCalendarEventTimeRangeError({
        id: "ieee-valid",
        summary: "Valid event",
        start: { dateTime: "2026-03-31T18:00:00.000Z" },
        end: { dateTime: "2026-03-31T19:00:00.000Z" },
      }),
    ).toBeNull();
  });

  it("rejects an empty Google Calendar event range", () => {
    expect(
      getGoogleCalendarEventTimeRangeError({
        id: "ieee-empty",
        summary: "Empty event",
        start: { dateTime: "2026-03-31T18:00:00.000Z" },
        end: { dateTime: "2026-03-31T18:00:00.000Z" },
      }),
    ).toContain("end must be after start");
  });
});

describe("normalizeGoogleCalendarEventsForSync", () => {
  it("replaces an invalid end time with a three-hour duration", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const normalizedEvents = normalizeGoogleCalendarEventsForSync("calendar-id", [
      {
        id: "ieee-valid",
        summary: "Valid event",
        start: { dateTime: "2026-03-31T18:00:00.000Z" },
        end: { dateTime: "2026-03-31T19:00:00.000Z" },
      },
      {
        id: "ieee-invalid",
        summary: "Invalid event",
        start: { dateTime: "2026-03-31T20:00:00.000Z" },
        end: { dateTime: "2026-03-31T19:00:00.000Z" },
      },
    ]);

    expect(normalizedEvents).toHaveLength(2);
    expect(normalizedEvents[0]?.id).toBe("ieee-valid");
    expect(normalizedEvents[1]?.end.dateTime).toBe("2026-03-31T23:00:00.000Z");
    expect(warnSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
  });

  it("still skips events with an invalid start time", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const normalizedEvents = normalizeGoogleCalendarEventsForSync("calendar-id", [
      {
        id: "ieee-invalid-start",
        summary: "Invalid start",
        start: { dateTime: "not-a-date" },
        end: { dateTime: "2026-03-31T19:00:00.000Z" },
      },
    ]);

    expect(normalizedEvents).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalledOnce();

    errorSpy.mockRestore();
  });
});
