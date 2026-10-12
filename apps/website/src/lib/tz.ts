// Small timezone helpers built on Intl (no dependencies). Shared by the
// server-side iCal expander and the client-side week view.

export const OAH_TZ = "America/Los_Angeles";

export interface ZonedParts {
  y: number;
  m: number; // 1-12
  d: number;
  h: number;
  mi: number;
  /** 0 = Sunday … 6 = Saturday */
  dow: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant in `tz`. */
export function utcToZoned(ms: number, tz: string = OAH_TZ): ZonedParts {
  const parts: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const dow = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day),
  ).getUTCDay();
  return {
    y: parts.year,
    m: parts.month,
    d: parts.day,
    h: parts.hour === 24 ? 0 : parts.hour,
    mi: parts.minute,
    dow,
  };
}

function offsetMs(utcMs: number, tz: string) {
  const p = utcToZoned(utcMs, tz);
  const seconds = Math.floor(utcMs / 1000) * 1000;
  return (
    Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, new Date(utcMs).getUTCSeconds()) -
    seconds
  );
}

/** The instant at which the wall clock in `tz` reads y-m-d h:mi. */
export function zonedToUtc(
  y: number,
  m: number,
  d: number,
  h = 0,
  mi = 0,
  tz: string = OAH_TZ,
): number {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let utc = guess - offsetMs(guess, tz);
  const second = guess - offsetMs(utc, tz);
  if (second !== utc) utc = second;
  return utc;
}
