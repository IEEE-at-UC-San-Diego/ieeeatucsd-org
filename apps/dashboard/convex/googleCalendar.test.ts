import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  type CalendarEvent,
  type GoogleCalendarSyncState,
  fetchGoogleCalendarEvents,
  selectGoogleCalendarDeletionsForSync,
  syncCalendar,
} from "./googleCalendar";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

function requestUrl(input: RequestInfo | URL) {
  return input instanceof Request ? input.url : input.toString();
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

const laterSourceEvent: CalendarEvent = {
  id: "ieeepublishedlater",
  summary: "Later source event",
  start: {
    dateTime: "2026-04-03T18:00:00.000Z",
    timeZone: "America/Los_Angeles",
  },
  end: {
    dateTime: "2026-04-03T19:00:00.000Z",
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

const staleInternalEvent: CalendarEvent = {
  id: "ieeeinternalstale",
  summary: "Stale internal event",
  start: {
    dateTime: "2026-04-02T18:00:00.000Z",
    timeZone: "America/Los_Angeles",
  },
  end: {
    dateTime: "2026-04-02T19:00:00.000Z",
    timeZone: "America/Los_Angeles",
  },
};

const staleCandidateState: GoogleCalendarSyncState = {
  calendarId: "calendar-id",
  lastSuccessfulSourceCount: 2,
  staleCandidates: [
    {
      eventId: staleManagedEvent.id,
      firstSeenMissingAt: 1_000,
      lastSeenMissingAt: 1_000,
      missingSyncCount: 1,
      startMs: Date.parse(staleManagedEvent.start.dateTime),
    },
  ],
  updatedAt: 1_000,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("fetchGoogleCalendarEvents", () => {
  it("fetches every Google Calendar list page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [activeEvent],
          nextPageToken: "page-2",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          items: [staleManagedEvent],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const events = await fetchGoogleCalendarEvents(
      "access-token",
      "calendar-id",
    );

    expect(events.map((event) => event.id)).toEqual([
      "ieeepublishedactive",
      "ieeepublishedstale",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(requestUrl(fetchMock.mock.calls[0]?.[0]));
    expect(firstUrl.searchParams.get("maxResults")).toBe("2500");
    expect(firstUrl.searchParams.get("singleEvents")).toBe("true");
    expect(firstUrl.searchParams.get("orderBy")).toBe("startTime");
    expect(firstUrl.searchParams.get("showDeleted")).toBe("false");
    expect(firstUrl.searchParams.has("pageToken")).toBe(false);

    const secondUrl = new URL(requestUrl(fetchMock.mock.calls[1]?.[0]));
    expect(secondUrl.searchParams.get("pageToken")).toBe("page-2");
  });
});

describe("selectGoogleCalendarDeletionsForSync", () => {
  it("deduplicates explicit delete requests and skips events that are currently protected by the source", () => {
    const pendingDeletions = [
      {
        _id: "queue-1",
        calendar: "public",
        googleEventId: "ieeepublishedstale",
        reason: "event_unpublished",
        createdAt: 1,
      },
      {
        _id: "queue-2",
        calendar: "public",
        googleEventId: "ieeepublishedstale",
        reason: "event_deleted",
        createdAt: 2,
      },
      {
        _id: "queue-3",
        calendar: "public",
        googleEventId: "ieeepublishedactive",
        reason: "event_unpublished",
        createdAt: 3,
      },
    ] as any;

    const result = selectGoogleCalendarDeletionsForSync(
      pendingDeletions,
      new Set(["ieeepublishedactive"]),
    );

    expect(result.deletionsToProcess).toMatchObject([
      {
        calendar: "public",
        googleEventId: "ieeepublishedstale",
        queueIds: ["queue-1", "queue-2"],
      },
    ]);
    expect(result.skippedQueueIds).toEqual(["queue-3"]);
  });
});

describe("syncCalendar", () => {
  it("does not prune stale managed events even when allowEmptyPrune is requested", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    let listRequestCount = 0;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || "GET";
        const url = requestUrl(input);
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
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const stats = await syncCalendar(
      "access-token",
      "calendar-id",
      [activeEvent, laterSourceEvent],
      {
        allowEmptyPrune: true,
        syncState: staleCandidateState,
        nowMs: 2_000,
      },
    );

    expect(stats).toMatchObject({
      calendarId: "calendar-id",
      existingCount: 2,
      upsertCount: 2,
      deletedCount: 0,
      deferredDeleteCount: 1,
      staleCandidateCount: 1,
      pruneSkippedReason: "prune_disabled_without_deletion_queue",
    });

    const secondPageIndex = calls.findIndex((call) =>
      call.url.includes("pageToken=page-2"),
    );

    expect(secondPageIndex).toBeGreaterThan(-1);
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
    expect(
      calls.some(
        (call) =>
          call.url.includes("/events/ieeepublishedactive") &&
          call.method === "DELETE",
      ),
    ).toBe(false);
  });

  it("defers deleting stale managed events beyond the source event horizon", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || "GET";
        const url = requestUrl(input);
        calls.push({ method, url });

        if (method === "GET") {
          return jsonResponse({
            items: [activeEvent, staleManagedEvent, staleInternalEvent],
          });
        }

        return jsonResponse({});
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const stats = await syncCalendar("access-token", "calendar-id", [
      activeEvent,
    ]);

    expect(stats).toMatchObject({
      calendarId: "calendar-id",
      existingCount: 3,
      managedExistingCount: 3,
      upsertCount: 1,
      deletedCount: 0,
      deferredDeleteCount: 2,
      staleCandidateCount: 2,
      pruneSkippedReason: "prune_disabled_without_deletion_queue",
    });
    expect(stats.sourceMaxStartMs).toBe(Date.parse(activeEvent.start.dateTime));
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("forces write payloads to confirmed so cancelled Google tombstones are revived", async () => {
    const calls: Array<{ method: string; url: string; body?: string }> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || "GET";
        const url = requestUrl(input);
        calls.push({
          method,
          url,
          body: typeof init?.body === "string" ? init.body : undefined,
        });

        if (method === "GET") {
          return jsonResponse({
            items: [activeEvent],
          });
        }

        return jsonResponse({ status: "confirmed" });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await syncCalendar("access-token", "calendar-id", [activeEvent]);

    const putCall = calls.find((call) => call.method === "PUT");
    expect(putCall).toBeDefined();
    expect(new URL(putCall?.url || "").searchParams.get("sendUpdates")).toBe(
      "none",
    );
    expect(JSON.parse(putCall?.body || "{}")).toMatchObject({
      id: activeEvent.id,
      status: "confirmed",
    });
  });

  it("suppresses Google attendee update emails when creating events", async () => {
    const calls: Array<{ method: string; url: string; body?: string }> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || "GET";
        const url = requestUrl(input);
        calls.push({
          method,
          url,
          body: typeof init?.body === "string" ? init.body : undefined,
        });

        if (method === "GET") {
          return jsonResponse({ items: [] });
        }

        if (method === "PUT") {
          return new Response("", { status: 404 });
        }

        return jsonResponse({ status: "confirmed" });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await syncCalendar("access-token", "calendar-id", [activeEvent]);

    const postCall = calls.find((call) => call.method === "POST");
    expect(postCall).toBeDefined();
    expect(new URL(postCall?.url || "").searchParams.get("sendUpdates")).toBe(
      "none",
    );
    expect(JSON.parse(postCall?.body || "{}")).toMatchObject({
      id: activeEvent.id,
      status: "confirmed",
    });
  });

  it("marks stale managed events on the first valid missing sync", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || "GET";
        const url = requestUrl(input);
        calls.push({ method, url });

        if (method === "GET") {
          return jsonResponse({
            items: [activeEvent, staleManagedEvent],
          });
        }

        return jsonResponse({});
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const stats = await syncCalendar("access-token", "calendar-id", [
      activeEvent,
      laterSourceEvent,
    ]);

    expect(stats).toMatchObject({
      calendarId: "calendar-id",
      existingCount: 2,
      managedExistingCount: 2,
      upsertCount: 2,
      deletedCount: 0,
      deferredDeleteCount: 1,
      staleCandidateCount: 1,
      pruneSkippedReason: "prune_disabled_without_deletion_queue",
    });
    expect(stats.nextSyncState.staleCandidates).toMatchObject([
      {
        eventId: staleManagedEvent.id,
        missingSyncCount: 1,
      },
    ]);
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("does not delete stale managed events on the second valid missing sync without explicit pruning", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || "GET";
        const url = requestUrl(input);
        calls.push({ method, url });

        if (method === "GET") {
          return jsonResponse({
            items: [activeEvent, staleManagedEvent],
          });
        }

        return jsonResponse({});
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const firstStats = await syncCalendar(
      "access-token",
      "calendar-id",
      [activeEvent, laterSourceEvent],
      {
        allowEmptyPrune: false,
        nowMs: 1_000,
      },
    );
    const secondStats = await syncCalendar(
      "access-token",
      "calendar-id",
      [activeEvent, laterSourceEvent],
      {
        allowEmptyPrune: false,
        syncState: firstStats.nextSyncState,
        nowMs: 2_000,
      },
    );

    expect(firstStats).toMatchObject({
      deletedCount: 0,
      deferredDeleteCount: 1,
      staleCandidateCount: 1,
      pruneSkippedReason: "prune_disabled_without_deletion_queue",
    });
    expect(secondStats).toMatchObject({
      deletedCount: 0,
      deferredDeleteCount: 1,
      staleCandidateCount: 1,
      pruneSkippedReason: "prune_disabled_without_deletion_queue",
    });
    const deleteCalls = calls.filter((call) => call.method === "DELETE");
    expect(deleteCalls).toHaveLength(0);
  });

  it("skips deletion when an empty source would prune existing managed events", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || "GET";
        const url = requestUrl(input);
        calls.push({ method, url });

        if (method === "GET") {
          return jsonResponse({
            items: [staleManagedEvent, staleInternalEvent],
          });
        }

        return jsonResponse({});
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const stats = await syncCalendar("access-token", "calendar-id", []);

    expect(stats).toMatchObject({
      calendarId: "calendar-id",
      existingCount: 2,
      managedExistingCount: 2,
      upsertCount: 0,
      deletedCount: 0,
      deferredDeleteCount: 2,
      staleCandidateCount: 0,
      pruneSkippedReason: "empty_source_would_delete_existing_managed_events",
    });
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("does not allow empty-source pruning when requested", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || "GET";
        const url = requestUrl(input);
        calls.push({ method, url });

        if (method === "GET") {
          return jsonResponse({
            items: [staleManagedEvent, staleInternalEvent],
          });
        }

        return jsonResponse({});
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const stats = await syncCalendar("access-token", "calendar-id", [], {
      allowEmptyPrune: true,
    });

    expect(stats).toMatchObject({
      calendarId: "calendar-id",
      existingCount: 2,
      managedExistingCount: 2,
      upsertCount: 0,
      deletedCount: 0,
      deferredDeleteCount: 2,
      staleCandidateCount: 0,
      pruneSkippedReason: "empty_source_would_delete_existing_managed_events",
    });
    const deleteCalls = calls.filter((call) => call.method === "DELETE");
    expect(deleteCalls).toHaveLength(0);
  });

  it("refuses to delete every managed event when source IDs do not match existing calendar IDs", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    const replacementEvent: CalendarEvent = {
      ...activeEvent,
      id: "ieeepublishedreplacement",
    };
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || "GET";
        const url = requestUrl(input);
        calls.push({ method, url });

        if (method === "GET") {
          return jsonResponse({
            items: [staleManagedEvent, staleInternalEvent],
          });
        }

        return jsonResponse({});
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const stats = await syncCalendar("access-token", "calendar-id", [
      replacementEvent,
    ]);

    expect(stats).toMatchObject({
      calendarId: "calendar-id",
      existingCount: 2,
      managedExistingCount: 2,
      upsertCount: 1,
      deletedCount: 0,
      deferredDeleteCount: 2,
      staleCandidateCount: 0,
      pruneSkippedReason: "refusing_to_delete_all_managed_events",
    });
    expect(calls.some((call) => call.method === "PUT")).toBe(true);
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("defers deletion when source count drops sharply from the last successful sync", async () => {
    const calls: Array<{ method: string; url: string }> = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || "GET";
        const url = requestUrl(input);
        calls.push({ method, url });

        if (method === "GET") {
          return jsonResponse({
            items: [activeEvent, staleManagedEvent],
          });
        }

        return jsonResponse({});
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const stats = await syncCalendar(
      "access-token",
      "calendar-id",
      [activeEvent, laterSourceEvent],
      {
        allowEmptyPrune: false,
        syncState: {
          ...staleCandidateState,
          lastSuccessfulSourceCount: 10,
        },
        nowMs: 2_000,
      },
    );

    expect(stats).toMatchObject({
      deletedCount: 0,
      deferredDeleteCount: 1,
      staleCandidateCount: 0,
      previousSourceCount: 10,
      pruneSkippedReason: "source_count_drop_from_last_successful_sync",
    });
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  });
});
