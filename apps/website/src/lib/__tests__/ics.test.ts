import { describe, expect, it } from "vitest";
import { expandEvents, parseIcs } from "../ics";
import { OAH_TZ, utcToZoned, zonedToUtc } from "../tz";

const LA = OAH_TZ;

const vevent = (...lines: string[]) =>
  ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

const calendar = (...events: string[]) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "X-WR-TIMEZONE:America/Los_Angeles",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

/** Expand a feed over [from, to) given as UTC ISO strings. */
const expand = (ics: string, from: string, to: string) =>
  expandEvents(parseIcs(ics), Date.parse(from), Date.parse(to));

const starts = (ics: string, from: string, to: string) =>
  expand(ics, from, to).map((o) => o.start);

// US daylight saving time ended on Sunday 2026-11-01.
const WIDE_FROM = "2026-10-25T00:00:00Z";
const WIDE_TO = "2026-11-17T00:00:00Z";

describe("timezone helpers", () => {
  it("converts Pacific wall time to the right instant on either side of the DST change", () => {
    // PDT (UTC-7) before the change, PST (UTC-8) after it
    expect(new Date(zonedToUtc(2026, 10, 26, 10, 0, LA)).toISOString()).toBe(
      "2026-10-26T17:00:00.000Z",
    );
    expect(new Date(zonedToUtc(2026, 11, 2, 10, 0, LA)).toISOString()).toBe(
      "2026-11-02T18:00:00.000Z",
    );
  });

  it("round-trips an instant through Pacific wall time", () => {
    const ms = Date.parse("2026-11-02T18:30:00Z");
    expect(utcToZoned(ms, LA)).toMatchObject({
      y: 2026,
      m: 11,
      d: 2,
      h: 10,
      mi: 30,
      dow: 1, // Monday
    });
  });
});

describe("repeating events", () => {
  it("keeps a Pacific-time repeat at the same local hour across the DST change", () => {
    const ics = calendar(
      vevent(
        "UID:a",
        "SUMMARY:Weekly",
        "DTSTART;TZID=America/Los_Angeles:20261026T100000",
        "DTEND;TZID=America/Los_Angeles:20261026T120000",
        "RRULE:FREQ=WEEKLY;BYDAY=MO",
      ),
    );
    expect(starts(ics, WIDE_FROM, "2026-11-10T00:00:00Z")).toEqual([
      "2026-10-26T17:00:00.000Z", // 10:00 PDT
      "2026-11-02T18:00:00.000Z", // 10:00 PST
      "2026-11-09T18:00:00.000Z",
    ]);
  });

  it("keeps a UTC-stamped repeat at the same UTC time across the DST change", () => {
    const ics = calendar(
      vevent(
        "UID:utc",
        "SUMMARY:UTC weekly",
        "DTSTART:20261026T170000Z",
        "DTEND:20261026T190000Z",
        "RRULE:FREQ=WEEKLY",
      ),
    );
    expect(starts(ics, WIDE_FROM, "2026-11-10T00:00:00Z")).toEqual([
      "2026-10-26T17:00:00.000Z",
      "2026-11-02T17:00:00.000Z",
      "2026-11-09T17:00:00.000Z",
    ]);
  });

  it("keeps each occurrence's duration", () => {
    const ics = calendar(
      vevent(
        "UID:d",
        "SUMMARY:Two hours",
        "DTSTART;TZID=America/Los_Angeles:20261026T100000",
        "DTEND;TZID=America/Los_Angeles:20261026T120000",
        "RRULE:FREQ=WEEKLY;BYDAY=MO",
      ),
    );
    const [first] = expand(ics, WIDE_FROM, WIDE_TO);
    expect(Date.parse(first.end) - Date.parse(first.start)).toBe(2 * 3600_000);
  });

  it("expands several BYDAY values", () => {
    const ics = calendar(
      vevent(
        "UID:m",
        "SUMMARY:Mon and Wed",
        "DTSTART;TZID=America/Los_Angeles:20261026T100000",
        "DTEND;TZID=America/Los_Angeles:20261026T110000",
        "RRULE:FREQ=WEEKLY;BYDAY=MO,WE",
      ),
    );
    expect(starts(ics, WIDE_FROM, "2026-11-05T00:00:00Z")).toEqual([
      "2026-10-26T17:00:00.000Z", // Mon
      "2026-10-28T17:00:00.000Z", // Wed
      "2026-11-02T18:00:00.000Z", // Mon
      "2026-11-04T18:00:00.000Z", // Wed
    ]);
  });

  it("stops at UNTIL (inclusive) and at COUNT", () => {
    const until = calendar(
      vevent(
        "UID:u",
        "SUMMARY:Until",
        "DTSTART;TZID=America/Los_Angeles:20261026T100000",
        "DTEND;TZID=America/Los_Angeles:20261026T110000",
        "RRULE:FREQ=WEEKLY;UNTIL=20261102T185959Z;BYDAY=MO",
      ),
    );
    expect(starts(until, WIDE_FROM, WIDE_TO)).toEqual([
      "2026-10-26T17:00:00.000Z",
      "2026-11-02T18:00:00.000Z",
    ]);

    const count = calendar(
      vevent(
        "UID:c",
        "SUMMARY:Count",
        "DTSTART;TZID=America/Los_Angeles:20261026T100000",
        "DTEND;TZID=America/Los_Angeles:20261026T110000",
        "RRULE:FREQ=WEEKLY;COUNT=2;BYDAY=MO",
      ),
    );
    expect(starts(count, WIDE_FROM, WIDE_TO)).toHaveLength(2);
  });

  it("supports daily repeats with an interval", () => {
    const ics = calendar(
      vevent(
        "UID:day",
        "SUMMARY:Every other day",
        "DTSTART;TZID=America/Los_Angeles:20261026T100000",
        "DTEND;TZID=America/Los_Angeles:20261026T110000",
        "RRULE:FREQ=DAILY;INTERVAL=2;COUNT=3",
      ),
    );
    expect(expand(ics, WIDE_FROM, WIDE_TO).map((o) => o.start)).toEqual([
      "2026-10-26T17:00:00.000Z",
      "2026-10-28T17:00:00.000Z",
      "2026-10-30T17:00:00.000Z",
    ]);
  });
});

describe("exceptions and overrides", () => {
  const master = vevent(
    "UID:series",
    "SUMMARY:Shift",
    "DTSTART;TZID=America/Los_Angeles:20261026T100000",
    "DTEND;TZID=America/Los_Angeles:20261026T120000",
    "RRULE:FREQ=WEEKLY;BYDAY=MO",
  );

  it("skips dates listed in EXDATE", () => {
    const withEx = calendar(
      vevent(
        "UID:series",
        "SUMMARY:Shift",
        "DTSTART;TZID=America/Los_Angeles:20261026T100000",
        "DTEND;TZID=America/Los_Angeles:20261026T120000",
        "RRULE:FREQ=WEEKLY;BYDAY=MO",
        "EXDATE;TZID=America/Los_Angeles:20261102T100000",
      ),
    );
    expect(starts(withEx, WIDE_FROM, "2026-11-10T00:00:00Z")).toEqual([
      "2026-10-26T17:00:00.000Z",
      "2026-11-09T18:00:00.000Z",
    ]);
  });

  it("replaces an occurrence with its moved override", () => {
    const moved = vevent(
      "UID:series",
      "SUMMARY:Shift (moved)",
      "RECURRENCE-ID;TZID=America/Los_Angeles:20261102T100000",
      "DTSTART;TZID=America/Los_Angeles:20261102T140000",
      "DTEND;TZID=America/Los_Angeles:20261102T160000",
    );
    const result = expand(
      calendar(master, moved),
      WIDE_FROM,
      "2026-11-10T00:00:00Z",
    );
    expect(result.map((o) => o.start)).toEqual([
      "2026-10-26T17:00:00.000Z",
      "2026-11-02T22:00:00.000Z", // moved to 14:00 PST
      "2026-11-09T18:00:00.000Z",
    ]);
    expect(result[1].title).toBe("Shift (moved)");
  });

  it("drops an occurrence whose override is cancelled", () => {
    const cancelled = vevent(
      "UID:series",
      "SUMMARY:Shift",
      "STATUS:CANCELLED",
      "RECURRENCE-ID;TZID=America/Los_Angeles:20261102T100000",
      "DTSTART;TZID=America/Los_Angeles:20261102T100000",
      "DTEND;TZID=America/Los_Angeles:20261102T120000",
    );
    expect(
      starts(calendar(master, cancelled), WIDE_FROM, "2026-11-10T00:00:00Z"),
    ).toEqual(["2026-10-26T17:00:00.000Z", "2026-11-09T18:00:00.000Z"]);
  });
});

describe("single and all-day events", () => {
  it("returns a one-off event only inside the requested window", () => {
    const ics = calendar(
      vevent(
        "UID:once",
        "SUMMARY:Once",
        "DTSTART;TZID=America/Los_Angeles:20261105T170000",
        "DTEND;TZID=America/Los_Angeles:20261105T190000",
      ),
    );
    expect(
      expand(ics, "2026-11-05T00:00:00Z", "2026-11-07T00:00:00Z"),
    ).toHaveLength(1);
    expect(
      expand(ics, "2026-11-06T12:00:00Z", "2026-11-08T00:00:00Z"),
    ).toHaveLength(0);
  });

  it("marks date-only events as all-day, from Pacific midnight", () => {
    const ics = calendar(
      vevent(
        "UID:closed",
        "SUMMARY:Project Space closed",
        "DTSTART;VALUE=DATE:20261105",
        "DTEND;VALUE=DATE:20261106",
      ),
    );
    const [only] = expand(ics, WIDE_FROM, WIDE_TO);
    expect(only.allDay).toBe(true);
    expect(only.start).toBe("2026-11-05T08:00:00.000Z"); // 00:00 PST
    expect(only.end).toBe("2026-11-06T08:00:00.000Z");
  });

  it("unfolds long lines and unescapes text", () => {
    const ics = calendar(
      vevent(
        "UID:fold",
        "SUMMARY:Daniel\\, Hannah\\; and a very long title that gets fo",
        " lded by the calendar",
        "DTSTART;TZID=America/Los_Angeles:20261105T170000",
        "DTEND;TZID=America/Los_Angeles:20261105T190000",
      ),
    );
    const [only] = expand(ics, WIDE_FROM, WIDE_TO);
    expect(only.title).toBe(
      "Daniel, Hannah; and a very long title that gets folded by the calendar",
    );
  });
});
