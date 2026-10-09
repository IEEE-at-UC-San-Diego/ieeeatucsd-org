import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OAH_TZ, utcToZoned, zonedToUtc } from "../../lib/tz";
import "./oah.css";

interface Occurrence {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  description?: string;
  location?: string;
}

interface Props {
  calendarUrl: string;
}

interface DayCell {
  y: number;
  m: number;
  d: number;
  key: string;
  dow: number;
  startUtc: number;
  endUtc: number;
}

interface Placed {
  ev: Occurrence;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const HOUR_PX = 56;

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function addDays(y: number, m: number, d: number, n: number) {
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return {
    y: dt.getUTCFullYear(),
    m: dt.getUTCMonth() + 1,
    d: dt.getUTCDate(),
  };
}

function weekOf(ms: number): { y: number; m: number; d: number } {
  const p = utcToZoned(ms, OAH_TZ);
  const sinceMonday = (p.dow + 6) % 7;
  return addDays(p.y, p.m, p.d, -sinceMonday);
}

function buildDays(monday: { y: number; m: number; d: number }): DayCell[] {
  return Array.from({ length: 7 }, (_, i) => {
    const a = addDays(monday.y, monday.m, monday.d, i);
    const b = addDays(monday.y, monday.m, monday.d, i + 1);
    const dow = new Date(Date.UTC(a.y, a.m - 1, a.d)).getUTCDay();
    return {
      ...a,
      key: dayKey(a.y, a.m, a.d),
      dow,
      startUtc: zonedToUtc(a.y, a.m, a.d, 0, 0, OAH_TZ),
      endUtc: zonedToUtc(b.y, b.m, b.d, 0, 0, OAH_TZ),
    };
  });
}

function minutesIn(day: DayCell, ms: number) {
  if (ms >= day.endUtc) return 24 * 60;
  if (ms <= day.startUtc) return 0;
  const p = utcToZoned(ms, OAH_TZ);
  return p.h * 60 + p.mi;
}

function fmtClock(min: number, withMeridiem: boolean) {
  const h24 = Math.floor(min / 60) % 24;
  const mi = min % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const base = mi === 0 ? `${h12}` : `${h12}:${pad(mi)}`;
  return withMeridiem ? `${base} ${h24 < 12 ? "AM" : "PM"}` : base;
}

const meridiem = (min: number) =>
  Math.floor(min / 60) % 24 < 12 ? "AM" : "PM";

function fmtRange(startMin: number, endMin: number) {
  const same = meridiem(startMin) === meridiem(endMin);
  return `${fmtClock(startMin, !same)} – ${fmtClock(endMin, true)}`;
}

/** Greedy lane assignment so overlapping events sit side by side. */
function layoutDay(day: DayCell, events: Occurrence[]): Placed[] {
  const items: Placed[] = events
    .filter((ev) => !ev.allDay)
    .map((ev) => ({
      ev,
      startMin: minutesIn(day, Date.parse(ev.start)),
      endMin: minutesIn(day, Date.parse(ev.end)),
      lane: 0,
      lanes: 1,
    }))
    .filter((p) => p.endMin > p.startMin)
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const laneEnds: number[] = [];

  const flush = () => {
    const lanes = laneEnds.length || 1;
    cluster.forEach((p) => (p.lanes = lanes));
    cluster = [];
    laneEnds.length = 0;
    clusterEnd = -1;
  };

  for (const p of items) {
    if (cluster.length && p.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= p.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(p.endMin);
    } else {
      laneEnds[lane] = p.endMin;
    }
    p.lane = lane;
    cluster.push(p);
    clusterEnd = Math.max(clusterEnd, p.endMin);
  }
  flush();
  return items;
}

export default function OpenAccessCalendar({ calendarUrl }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [monday, setMonday] = useState(() => weekOf(Date.now()));
  const [events, setEvents] = useState<Occurrence[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const cache = useRef(new Map<string, Occurrence[]>());

  const days = useMemo(() => buildDays(monday), [monday]);
  const weekKey = days[0].key;

  // keep "now" fresh without re-rendering constantly
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const cached = cache.current.get(weekKey);
    if (cached) {
      setEvents(cached);
      setStatus("ready");
      return;
    }
    const ctrl = new AbortController();
    setStatus("loading");
    const qs = new URLSearchParams({
      start: new Date(days[0].startUtc).toISOString(),
      end: new Date(days[6].endUtc).toISOString(),
    });
    fetch(`/api/oah?${qs}`, { signal: ctrl.signal })
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((data: { events: Occurrence[] }) => {
        cache.current.set(weekKey, data.events);
        setEvents(data.events);
        setStatus("ready");
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setEvents([]);
        setStatus("error");
      });
    return () => ctrl.abort();
  }, [weekKey, days]);

  const placedByDay = useMemo(
    () =>
      days.map((day) =>
        layoutDay(
          day,
          events.filter(
            (ev) =>
              Date.parse(ev.end) > day.startUtc &&
              Date.parse(ev.start) < day.endUtc,
          ),
        ),
      ),
    [days, events],
  );

  // visible hour window follows the week's events (never shorter than 8h)
  const [firstHour, lastHour] = useMemo(() => {
    let lo = 24 * 60;
    let hi = 0;
    for (const col of placedByDay) {
      for (const p of col) {
        lo = Math.min(lo, p.startMin);
        hi = Math.max(hi, p.endMin);
      }
    }
    if (lo > hi) return [10, 18];
    let first = Math.max(0, Math.floor(lo / 60) - 1);
    let last = Math.min(24, Math.ceil(hi / 60) + 1);
    if (last - first < 8) last = Math.min(24, first + 8);
    if (last - first < 8) first = Math.max(0, last - 8);
    return [first, last];
  }, [placedByDay]);

  const hours = Array.from(
    { length: lastHour - firstHour },
    (_, i) => firstHour + i,
  );
  const bodyHeight = hours.length * HOUR_PX;

  const todayParts = utcToZoned(now, OAH_TZ);
  const todayKey = dayKey(todayParts.y, todayParts.m, todayParts.d);
  const nowMin = todayParts.h * 60 + todayParts.mi;
  const isCurrentWeek = days.some((d) => d.key === todayKey);

  const go = useCallback((delta: number) => {
    setMonday((m) => addDays(m.y, m.m, m.d, delta * 7));
  }, []);
  const goToday = useCallback(() => setMonday(weekOf(Date.now())), []);

  const first = days[0];
  const last = days[6];
  const rangeLabel =
    first.m === last.m
      ? `${MONTHS[first.m - 1]} ${first.d} – ${last.d}`
      : `${MONTHS[first.m - 1]} ${first.d} – ${MONTHS[last.m - 1]} ${last.d}`;
  const yearLabel =
    first.y === last.y
      ? String(first.y)
      : `${first.y}/${String(last.y).slice(2)}`;

  const totalEvents = placedByDay.reduce((n, c) => n + c.length, 0);

  return (
    <div className="oah" data-status={status}>
      <div className="oah-bar">
        <div>
          <h3 className="oah-range">
            {rangeLabel} <span>{yearLabel}</span>
          </h3>
        </div>
        <div className="oah-controls">
          <button
            type="button"
            className="oah-today"
            onClick={goToday}
            disabled={isCurrentWeek}
          >
            Today
          </button>
          <button
            type="button"
            className="oah-nav"
            onClick={() => go(-1)}
            aria-label="Previous week"
          >
            ←
          </button>
          <button
            type="button"
            className="oah-nav"
            onClick={() => go(1)}
            aria-label="Next week"
          >
            →
          </button>
        </div>
      </div>

      {/* Week grid (tablet and up) */}
      <div
        className="oah-week"
        role="group"
        aria-label={`Open Access Hours, week of ${rangeLabel}`}
      >
        <div className="oah-head">
          <div />
          {days.map((day) => {
            const isToday = day.key === todayKey;
            return (
              <div
                key={day.key}
                className={`oah-dayhead${isToday ? " is-today" : ""}`}
              >
                <span className="oah-dow">{DAY_NAMES[day.dow]}</span>
                <span className="oah-date">{day.d}</span>
              </div>
            );
          })}
        </div>

        <div className="oah-body" style={{ height: bodyHeight }}>
          <div className="oah-gutter" aria-hidden="true">
            {hours.map((h, i) => (
              <span
                key={h}
                className={i === 0 ? "is-first" : undefined}
                style={{ top: i * HOUR_PX }}
              >
                {fmtClock(h * 60, true)}
              </span>
            ))}
          </div>
          {days.map((day, di) => {
            const isToday = day.key === todayKey;
            const weekend = day.dow === 0 || day.dow === 6;
            return (
              <div
                key={day.key}
                className={`oah-col${weekend ? " is-weekend" : ""}${isToday ? " is-today" : ""}`}
                style={{ ["--hour" as string]: `${HOUR_PX}px` }}
              >
                {placedByDay[di].map((p) => {
                  const top = ((p.startMin - firstHour * 60) / 60) * HOUR_PX;
                  const height = Math.max(
                    ((p.endMin - p.startMin) / 60) * HOUR_PX,
                    26,
                  );
                  const ongoing =
                    now >= Date.parse(p.ev.start) && now < Date.parse(p.ev.end);
                  const past = Date.parse(p.ev.end) <= now;
                  const width = 100 / p.lanes;
                  return (
                    <article
                      key={p.ev.id}
                      className={`oah-event${ongoing ? " is-now" : ""}${past ? " is-past" : ""}`}
                      style={{
                        top,
                        height,
                        left: `calc(${p.lane * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                      }}
                      title={`${p.ev.title}\n${fmtRange(p.startMin, p.endMin)}${p.ev.location ? `\n${p.ev.location}` : ""}`}
                    >
                      <h4>{p.ev.title}</h4>
                      <p>{fmtRange(p.startMin, p.endMin)}</p>
                    </article>
                  );
                })}
                {isToday &&
                  nowMin >= firstHour * 60 &&
                  nowMin <= lastHour * 60 && (
                    <div
                      className="oah-now"
                      style={{
                        top: ((nowMin - firstHour * 60) / 60) * HOUR_PX,
                      }}
                      aria-hidden="true"
                    />
                  )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agenda (phones) */}
      <ol className="oah-agenda">
        {days.map((day, di) => {
          const isToday = day.key === todayKey;
          const items = placedByDay[di];
          return (
            <li key={day.key} className={isToday ? "is-today" : ""}>
              <div className="oah-agenda-day">
                <span className="oah-dow">{DAY_NAMES[day.dow]}</span>
                <span className="oah-date">{day.d}</span>
              </div>
              <ul>
                {items.length === 0 && <li className="oah-none">—</li>}
                {items.map((p) => (
                  <li
                    key={p.ev.id}
                    className={Date.parse(p.ev.end) <= now ? "is-past" : ""}
                  >
                    <p className="oah-agenda-time">
                      {fmtRange(p.startMin, p.endMin)}
                    </p>
                    <p className="oah-agenda-title">{p.ev.title}</p>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>

      <div className="oah-foot">
        <p>
          {status === "loading" && "Loading schedule…"}
          {status === "error" &&
            "The schedule could not be loaded right now. Open the Google Calendar instead."}
          {status === "ready" &&
            (totalEvents === 0
              ? "No Open Access Hours scheduled this week."
              : "Times shown in Pacific Time.")}
        </p>
        <a
          className="btn-link"
          href={calendarUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open in Google Calendar
        </a>
      </div>
    </div>
  );
}
