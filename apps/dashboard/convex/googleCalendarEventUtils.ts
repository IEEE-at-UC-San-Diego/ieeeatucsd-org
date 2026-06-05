export interface SyncableGoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
}

const DEFAULT_GOOGLE_EVENT_DURATION_MS = 3 * 60 * 60 * 1000;

function parseGoogleCalendarDateTime(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getGoogleCalendarEventTimeRangeError(
  event: SyncableGoogleCalendarEvent,
): string | null {
  const start = parseGoogleCalendarDateTime(event.start.dateTime);
  const end = parseGoogleCalendarDateTime(event.end.dateTime);

  if (start === null || end === null) {
    return `invalid event timestamps (start=${event.start.dateTime}, end=${event.end.dateTime})`;
  }

  if (end <= start) {
    return `end must be after start (start=${event.start.dateTime}, end=${event.end.dateTime})`;
  }

  return null;
}

export function normalizeGoogleCalendarEventsForSync<T extends SyncableGoogleCalendarEvent>(
  calendarId: string,
  events: T[],
): T[] {
  return events.flatMap((event) => {
    const start = parseGoogleCalendarDateTime(event.start.dateTime);
    if (start === null) {
      console.error(
        `Skipping Google Calendar sync for calendar ${calendarId}, event ${event.id} (${event.summary}): invalid start timestamp (${event.start.dateTime})`,
      );
      return [];
    }

    const end = parseGoogleCalendarDateTime(event.end.dateTime);
    if (end !== null && end > start) {
      return [event];
    }

    const normalizedEvent = {
      ...event,
      end: {
        ...event.end,
        dateTime: new Date(start + DEFAULT_GOOGLE_EVENT_DURATION_MS).toISOString(),
      },
    };

    console.warn(
      `Normalizing Google Calendar event duration for calendar ${calendarId}, event ${event.id} (${event.summary}): end=${event.end.dateTime} -> ${normalizedEvent.end.dateTime}`,
    );
    return [normalizedEvent];
  });
}
