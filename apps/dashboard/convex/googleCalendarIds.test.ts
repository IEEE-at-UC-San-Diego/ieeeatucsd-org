import { describe, expect, it } from "vite-plus/test";
import { isManagedGoogleCalendarEventId } from "./googleCalendarIds";

describe("isManagedGoogleCalendarEventId", () => {
  it("matches generated IEEE published and internal event IDs", () => {
    expect(isManagedGoogleCalendarEventId("ieeepublishedabc123")).toBe(true);
    expect(isManagedGoogleCalendarEventId("ieeeinternalabc123")).toBe(true);
  });

  it("does not claim unrelated Google Calendar event IDs", () => {
    expect(isManagedGoogleCalendarEventId("ieee-office-hours")).toBe(false);
    expect(isManagedGoogleCalendarEventId("not-ieeeinternalabc123")).toBe(
      false,
    );
    expect(isManagedGoogleCalendarEventId("abc123")).toBe(false);
  });
});
