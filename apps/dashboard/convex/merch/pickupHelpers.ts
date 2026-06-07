/** Business scheduling uses America/Los_Angeles; timestamps are stored in UTC. */
export const LA_TIMEZONE = "America/Los_Angeles";

export const DEFAULT_EVENT_CUTOFF_HOURS = 24;
export const DEFAULT_PROJECT_SPACE_CUTOFF_HOURS = 24;
export const DEFAULT_VISIBILITY_WEEKS = 4;

type EventPickupConfig = {
  startDate: number;
  merchPickupCutoffType?: "relative" | "absolute";
  merchPickupCutoffAt?: number;
};

type ScheduleException = {
  date: string;
  type: "skip" | "override";
  startTimeMinutes?: number;
  endTimeMinutes?: number;
  instructions?: string;
  capacity?: number;
};

export type PickupSchedule = {
  dayOfWeek: number;
  startTimeMinutes: number;
  endTimeMinutes: number;
  instructions: string;
  capacity?: number;
  cutoffHoursBefore: number;
  exceptions: ScheduleException[];
};

export function getTimezoneOffsetMs(atUtc: number, timeZone: string) {
  const date = new Date(atUtc);
  const utcDate = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone }));
  return tzDate.getTime() - utcDate.getTime();
}

export function laLocalToUtc(
  year: number,
  month: number,
  day: number,
  minutesFromMidnight: number,
) {
  const hour = Math.floor(minutesFromMidnight / 60);
  const minute = minutesFromMidnight % 60;
  let utc = Date.UTC(year, month - 1, day, hour + 8, minute);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offset = getTimezoneOffsetMs(utc, LA_TIMEZONE);
    utc = Date.UTC(year, month - 1, day, hour, minute) - offset;
  }
  return utc;
}

export function formatLaDateKey(utcMs: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(utcMs));
}

export function getLaDateParts(utcMs: number) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: LA_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(utcMs)).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function getLaWeekday(utcMs: number) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: LA_TIMEZONE,
    weekday: "short",
  }).format(new Date(utcMs));
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
}

export function addLaDays(year: number, month: number, day: number, days: number) {
  const anchor = laLocalToUtc(year, month, day, 12 * 60);
  const next = anchor + days * 24 * 60 * 60 * 1000;
  const parts = getLaDateParts(next);
  return { year: parts.year, month: parts.month, day: parts.day };
}

/**
 * Relative cutoff: merchPickupCutoffAt is hours before event start (default 24).
 * Absolute cutoff: merchPickupCutoffAt is a fixed UTC timestamp.
 */
export function computeEventPickupCutoff(
  event: EventPickupConfig,
  defaultRelativeHours = DEFAULT_EVENT_CUTOFF_HOURS,
) {
  const cutoffType = event.merchPickupCutoffType ?? "relative";
  if (cutoffType === "absolute") {
    return (
      event.merchPickupCutoffAt ??
      event.startDate - defaultRelativeHours * 60 * 60 * 1000
    );
  }
  const hoursBefore = event.merchPickupCutoffAt ?? defaultRelativeHours;
  return event.startDate - hoursBefore * 60 * 60 * 1000;
}

export function isPickupOptionSelectable(
  option: {
    status: "active" | "closed" | "cancelled";
    cutoffAt: number;
    capacity?: number;
    orderCount: number;
    windowEnd: number;
  },
  now = Date.now(),
) {
  if (option.status !== "active") return false;
  if (now >= option.cutoffAt) return false;
  if (option.capacity !== undefined && option.orderCount >= option.capacity) return false;
  if (now >= option.windowEnd) return false;
  return true;
}

function resolveScheduleWindow(
  schedule: PickupSchedule,
  year: number,
  month: number,
  day: number,
) {
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const exception = schedule.exceptions.find((entry) => entry.date === dateKey);
  if (exception?.type === "skip") {
    return null;
  }

  const startMinutes = exception?.startTimeMinutes ?? schedule.startTimeMinutes;
  const endMinutes = exception?.endTimeMinutes ?? schedule.endTimeMinutes;
  const instructions = exception?.instructions ?? schedule.instructions;
  const capacity = exception?.capacity ?? schedule.capacity;

  if (endMinutes <= startMinutes) {
    return null;
  }

  const windowStart = laLocalToUtc(year, month, day, startMinutes);
  const windowEnd = laLocalToUtc(year, month, day, endMinutes);
  const cutoffAt = windowStart - schedule.cutoffHoursBefore * 60 * 60 * 1000;

  return {
    dateKey,
    windowStart,
    windowEnd,
    instructions,
    capacity,
    cutoffAt,
  };
}

export function generateScheduleWindows(
  schedule: PickupSchedule,
  visibilityWeeks: number,
  fromUtc = Date.now(),
) {
  const windows: Array<{
    dateKey: string;
    windowStart: number;
    windowEnd: number;
    instructions: string;
    capacity?: number;
    cutoffAt: number;
  }> = [];

  const today = getLaDateParts(fromUtc);
  let cursor = { year: today.year, month: today.month, day: today.day };

  for (let dayOffset = 0; dayOffset < visibilityWeeks * 7; dayOffset += 1) {
    if (dayOffset > 0) {
      cursor = addLaDays(cursor.year, cursor.month, cursor.day, 1);
    }

    const probe = laLocalToUtc(cursor.year, cursor.month, cursor.day, 12 * 60);
    if (getLaWeekday(probe) !== schedule.dayOfWeek) {
      continue;
    }

    const resolved = resolveScheduleWindow(
      schedule,
      cursor.year,
      cursor.month,
      cursor.day,
    );
    if (!resolved) continue;
    if (resolved.windowEnd <= fromUtc) continue;
    windows.push(resolved);
  }

  return windows;
}
