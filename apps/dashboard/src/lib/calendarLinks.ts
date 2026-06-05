const DEFAULT_TIMEZONE = "America/Los_Angeles";

function formatUtcForIcs(timestamp: number): string {
  const date = new Date(timestamp);
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildGoogleCalendarSubscribeUrl(calendarId: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendarId)}`;
}

export function buildGoogleCalendarIcsUrl(calendarId: string): string {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
}

export function buildGoogleCalendarEventUrl(eventId: string, calendarId: string): string {
  const eid = btoa(`${eventId} ${calendarId}`);
  return `https://calendar.google.com/calendar/u/0/r/eventedit/${encodeURIComponent(eid)}`;
}

export function buildEventIcsContent(event: {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDate: number;
  endDate: number;
  timezone?: string;
}): string {
  const now = formatUtcForIcs(Date.now());
  const dtStart = formatUtcForIcs(event.startDate);
  const dtEnd = formatUtcForIcs(event.endDate);
  const timezone = event.timezone || DEFAULT_TIMEZONE;
  const description = event.description || "";
  const location = event.location || "";

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IEEE at UCSD//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(event.id)}@ieeeatucsd.org`,
    `DTSTAMP:${now}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `X-WR-TIMEZONE:${escapeIcsText(timezone)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadEventIcs(
  event: {
    id: string;
    title: string;
    description?: string;
    location?: string;
    startDate: number;
    endDate: number;
    timezone?: string;
  },
  filename = "event.ics",
): void {
  const content = buildEventIcsContent(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
