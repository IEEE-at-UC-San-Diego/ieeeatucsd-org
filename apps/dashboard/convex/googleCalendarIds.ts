export function generateGoogleCalendarEventId(
  type: "published" | "internal",
  eventId: string,
): string {
  // Google event IDs must use a-v and 0-9 characters.
  const raw = `ieee${type}${eventId}`.toLowerCase();
  const mapped = Array.from(raw)
    .map((char) => (/[a-v0-9]/.test(char) ? char : String(char.charCodeAt(0) % 10)))
    .join("");
  return mapped.length >= 5 ? mapped.slice(0, 1024) : mapped.padEnd(5, "0");
}

export function isManagedGoogleCalendarEventId(eventId: string): boolean {
  return eventId.startsWith("ieeepublished") || eventId.startsWith("ieeeinternal");
}

function toBase64(input: string): string {
  return btoa(input);
}

export function buildGoogleCalendarEventUrl(eventId: string, calendarId: string): string {
  const eid = toBase64(`${eventId} ${calendarId}`);
  return `https://calendar.google.com/calendar/u/0/r/eventedit/${encodeURIComponent(eid)}`;
}

export function buildGoogleCalendarSubscribeUrl(calendarId: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(calendarId)}`;
}

export function buildGoogleCalendarIcsUrl(calendarId: string): string {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
}
