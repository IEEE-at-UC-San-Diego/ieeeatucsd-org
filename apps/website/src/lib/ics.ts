// Minimal iCalendar reader: just enough to expand a public Google Calendar
// feed (weekly/daily repeats, per-date overrides, exceptions) into concrete
// occurrences for a time window.

import { utcToZoned, zonedToUtc, OAH_TZ } from "./tz";

export interface Occurrence {
  id: string;
  title: string;
  /** ISO instants (UTC) */
  start: string;
  end: string;
  allDay: boolean;
  description?: string;
  location?: string;
}

interface RawEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  status?: string;
  start: number;
  end: number;
  allDay: boolean;
  tz: string;
  localStart: { y: number; m: number; d: number; h: number; mi: number };
  rrule?: Record<string, string>;
  exdates: Set<number>;
  recurrenceId?: number;
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

function unescapeText(v: string) {
  return v
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): Prop | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const head = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const p of head.slice(1)) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  return { name: head[0].toUpperCase(), params, value: line.slice(colon + 1) };
}

interface Stamp {
  ms: number;
  allDay: boolean;
  tz: string;
  local: { y: number; m: number; d: number; h: number; mi: number };
}

function parseStamp(prop: Prop, fallbackTz: string): Stamp | null {
  const v = prop.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const allDay = prop.params.VALUE === "DATE" || m[4] === undefined;
  const h = Number(m[4] ?? 0);
  const mi = Number(m[5] ?? 0);
  const tz = prop.params.TZID || fallbackTz;
  if (m[7] === "Z") {
    const ms = Date.UTC(y, mo - 1, d, h, mi);
    const z = utcToZoned(ms, fallbackTz);
    return {
      ms,
      allDay,
      tz: fallbackTz,
      local: { y: z.y, m: z.m, d: z.d, h: z.h, mi: z.mi },
    };
  }
  return {
    ms: zonedToUtc(y, mo, d, h, mi, tz),
    allDay,
    tz,
    local: { y, m: mo, d, h, mi },
  };
}

function parseRrule(v: string) {
  const out: Record<string, string> = {};
  for (const part of v.split(";")) {
    const [k, val] = part.split("=");
    if (k && val) out[k.toUpperCase()] = val;
  }
  return out;
}

export function parseIcs(text: string, defaultTz: string = OAH_TZ): RawEvent[] {
  const lines = unfold(text);
  const events: RawEvent[] = [];
  let cur: (Partial<RawEvent> & { dtstart?: Stamp; dtend?: Stamp }) | null =
    null;
  let calTz = defaultTz;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = { exdates: new Set() };
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur?.dtstart) {
        const s = cur.dtstart;
        const e = cur.dtend ?? {
          ...s,
          ms: s.ms + (s.allDay ? 86400000 : 3600000),
        };
        events.push({
          uid: cur.uid ?? `${s.ms}`,
          summary: cur.summary ?? "",
          description: cur.description,
          location: cur.location,
          status: cur.status,
          start: s.ms,
          end: e.ms,
          allDay: s.allDay,
          tz: s.tz,
          localStart: s.local,
          rrule: cur.rrule,
          exdates: cur.exdates ?? new Set(),
          recurrenceId: cur.recurrenceId,
        });
      }
      cur = null;
      continue;
    }
    const prop = parseLine(line);
    if (!prop) continue;
    if (!cur) {
      if (prop.name === "X-WR-TIMEZONE") calTz = prop.value.trim();
      continue;
    }
    switch (prop.name) {
      case "UID":
        cur.uid = prop.value.trim();
        break;
      case "SUMMARY":
        cur.summary = unescapeText(prop.value);
        break;
      case "DESCRIPTION":
        cur.description = unescapeText(prop.value);
        break;
      case "LOCATION":
        cur.location = unescapeText(prop.value);
        break;
      case "STATUS":
        cur.status = prop.value.trim().toUpperCase();
        break;
      case "DTSTART":
        cur.dtstart = parseStamp(prop, calTz) ?? undefined;
        break;
      case "DTEND":
        cur.dtend = parseStamp(prop, calTz) ?? undefined;
        break;
      case "RRULE":
        cur.rrule = parseRrule(prop.value);
        break;
      case "EXDATE":
        for (const v of prop.value.split(",")) {
          const s = parseStamp({ ...prop, value: v }, calTz);
          if (s) cur.exdates!.add(s.ms);
        }
        break;
      case "RECURRENCE-ID": {
        const s = parseStamp(prop, calTz);
        if (s) cur.recurrenceId = s.ms;
        break;
      }
    }
  }
  return events;
}

/** Monday-based index of a weekday code. */
const dowIndex = (code: string) => DAY_CODES.indexOf(code.slice(-2));

function expandSeries(
  ev: RawEvent,
  rangeStart: number,
  rangeEnd: number,
): number[] {
  const rule = ev.rrule;
  if (!rule) return [ev.start];
  const freq = rule.FREQ;
  const interval = Math.max(1, Number(rule.INTERVAL ?? 1));
  const count = rule.COUNT ? Number(rule.COUNT) : Infinity;
  let until = Infinity;
  if (rule.UNTIL) {
    const s = parseStamp(
      { name: "UNTIL", params: { TZID: ev.tz }, value: rule.UNTIL },
      ev.tz,
    );
    if (s) until = s.allDay ? s.ms + 86400000 - 1 : s.ms;
  }
  const { y, m, d, h, mi } = ev.localStart;
  const out: number[] = [];

  if (freq === "DAILY") {
    let n = 0;
    for (let i = 0; i < 4000 && n < count; i++) {
      const dayUtc = Date.UTC(y, m - 1, d + i * interval);
      const dt = new Date(dayUtc);
      const t = zonedToUtc(
        dt.getUTCFullYear(),
        dt.getUTCMonth() + 1,
        dt.getUTCDate(),
        h,
        mi,
        ev.tz,
      );
      if (t > until || t > rangeEnd) break;
      n++;
      out.push(t);
    }
    return out;
  }

  if (freq === "WEEKLY") {
    const startDow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const days = rule.BYDAY
      ? rule.BYDAY.split(",")
          .map(dowIndex)
          .filter((i) => i >= 0)
      : [startDow];
    // Week anchor = Monday of DTSTART's week
    const mondayOffset = (startDow + 6) % 7;
    let n = 0;
    for (let w = 0; w < 1500 && n < count; w++) {
      const weekMonday = Date.UTC(
        y,
        m - 1,
        d - mondayOffset + w * 7 * interval,
      );
      const slots = days
        .map((dw) => (dw + 6) % 7) // Monday-based offset
        .sort((a, b) => a - b);
      let pastEnd = false;
      for (const off of slots) {
        const dt = new Date(weekMonday + off * 86400000);
        const t = zonedToUtc(
          dt.getUTCFullYear(),
          dt.getUTCMonth() + 1,
          dt.getUTCDate(),
          h,
          mi,
          ev.tz,
        );
        if (t < ev.start) continue;
        if (t > until) {
          pastEnd = true;
          break;
        }
        if (n >= count) break;
        n++;
        out.push(t);
        if (t > rangeEnd) pastEnd = true;
      }
      if (pastEnd) break;
    }
    return out;
  }

  // Other frequencies: show the first occurrence only.
  return [ev.start];
}

export function expandEvents(
  events: RawEvent[],
  rangeStart: number,
  rangeEnd: number,
): Occurrence[] {
  const overrides = new Map<string, RawEvent>();
  for (const e of events) {
    if (e.recurrenceId !== undefined)
      overrides.set(`${e.uid}|${e.recurrenceId}`, e);
  }
  const out: Occurrence[] = [];
  const push = (e: RawEvent, start: number, end: number) => {
    if (e.status === "CANCELLED") return;
    if (end <= rangeStart || start >= rangeEnd) return;
    out.push({
      id: `${e.uid}@${start}`,
      title: e.summary,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      allDay: e.allDay,
      description: e.description,
      location: e.location,
    });
  };

  for (const e of events) {
    if (e.recurrenceId !== undefined) {
      push(e, e.start, e.end); // an overridden occurrence
      continue;
    }
    const duration = e.end - e.start;
    for (const start of expandSeries(e, rangeStart, rangeEnd)) {
      if (e.exdates.has(start)) continue;
      if (overrides.has(`${e.uid}|${start}`)) continue;
      push(e, start, start + duration);
    }
  }
  out.sort((a, b) => a.start.localeCompare(b.start));
  return out;
}
