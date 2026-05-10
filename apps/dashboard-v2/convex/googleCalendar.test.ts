import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type CalendarEvent,
  fetchGoogleCalendarEvents,
  syncCalendar,
} from "./googleCalendar";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

const activeEvent: CalendarEvent = {
  id: "ieeepublishedactive",
  summary: "Active event",
  start: {
    dateTime: "2026-03-31T18:00:00.000Z",
    timeZone: "America/Los_Angeles",
  },
  end: {
    dateTime: "2026-03-31T19:00:00.000Z",
    timeZone: "America/Los_Angeles",
  },
};

const staleManagedEvent: CalendarEvent = {
  id: "ieeepublishedstale",
  summary: "Stale event",
  start: {
    dateTime: "2026-04-01T18:00:00.000Z",
    timeZone: "America/Los_Angeles",
  },
  end: {
    dateTime: "2026-04-01T19:00:00.000Z",
    timeZone: "America/Los_Angeles",
  },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchGoogleCalendarEvents", () => {
  it("fetches every Google Calendar list page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        items: [activeEvent],
        nextPageToken: "page-2",
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [staleManagedEvent],
      }));
    vi.stubGlobal("fetch", fetchMock);

    const events = await fetchGoogleCalendarEvents("access-token", "calendar-id");

    expect(events.map((event) => event.id)).toEqual([
      "ieeepublishedactive",
      "ieeepublishedstale",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(firstUrl.searchParams.get("maxResults")).toBe("2500");
    expect(firstUrl.searchParams.get("singleEvents")).toBe("true");
    expect(firstUrl.searchParams.get("orderBy")).toBe("startTime");
    expect(firstUrl.searchParams.get("showDeleted")).toBe("false");
    expect(firstUrl.searchParams.has("pageToken")).toBe(false);

    const secondUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(secondUrl.searchParams.get("pageToken")).toBe("page-2");
  });
});

describe("syncCalendar", () => {
  it("deletes stale managed events only after all Google Calendar pages are fetched", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    let listRequestCount = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method || "GET";
      const url = String(input);
      calls.push({ method, url });

      if (method === "GET") {
        listRequestCount += 1;
        if (listRequestCount === 1) {
          return jsonResponse({
            items: [activeEvent],
            nextPageToken: "page-2",
          });
        }

        return jsonResponse({
          items: [staleManagedEvent],
        });
      }

      return jsonResponse({});
    });
    vi.stubGlobal("fetch", fetchMock);

    const stats = await syncCalendar("access-token", "calendar-id", [activeEvent]);

    expect(stats).toMatchObject({
      calendarId: "calendar-id",
      existingCount: 2,
      upsertCount: 1,
      deletedCount: 1,
    });

    const secondPageIndex = calls.findIndex((call) => call.url.includes("pageToken=page-2"));
    const deleteIndex = calls.findIndex((call) => call.method === "DELETE");
    const deletedUrl = calls[deleteIndex]?.url || "";

    expect(secondPageIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(secondPageIndex);
    expect(deletedUrl).toContain("/events/ieeepublishedstale");
    expect(calls.some((call) => call.url.includes("/events/ieeepublishedactive") && call.method === "DELETE")).toBe(
      false,
    );
  });
});
