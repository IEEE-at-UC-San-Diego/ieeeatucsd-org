import type { APIRoute } from "astro";
import { expandEvents, parseIcs } from "../../lib/ics";
import { buildGoogleCalendarIcsUrl } from "../../lib/calendarLinks";
import { OAH_CALENDAR_ID } from "../../config/oah";

// Open Access Hours feed: the public Google Calendar, expanded into the
// occurrences that fall inside the requested window.
export const prerender = false;

const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; events: ReturnType<typeof parseIcs> } | null = null;

async function loadEvents() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.events;
  const res = await fetch(buildGoogleCalendarIcsUrl(OAH_CALENDAR_ID), {
    headers: { Accept: "text/calendar" },
  });
  if (!res.ok) throw new Error(`calendar responded ${res.status}`);
  const events = parseIcs(await res.text());
  cache = { at: Date.now(), events };
  return events;
}

export const GET: APIRoute = async ({ url }) => {
  const start = Date.parse(url.searchParams.get("start") ?? "");
  const end = Date.parse(url.searchParams.get("end") ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return json({ error: "start and end (ISO) are required" }, 400);
  }
  // keep requests bounded to roughly two months
  if (end - start > 62 * 86400000) {
    return json({ error: "range too large" }, 400);
  }
  try {
    const events = await loadEvents();
    return json({ events: expandEvents(events, start, end) }, 200, {
      "Cache-Control": "public, max-age=60",
    });
  } catch (err) {
    if (cache) {
      return json(
        { events: expandEvents(cache.events, start, end), stale: true },
        200,
      );
    }
    return json({ error: "calendar unavailable" }, 502);
  }
};

function json(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
