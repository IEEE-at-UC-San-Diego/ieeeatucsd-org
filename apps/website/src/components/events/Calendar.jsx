import { useMemo, useState } from "react";
import {
  buildGoogleCalendarIcsUrl,
  buildGoogleCalendarSubscribeUrl,
  downloadEventIcs,
} from "../../lib/calendarLinks";

const DAY_FORMAT = { dateStyle: "medium" };
const TIME_FORMAT = { hour: "numeric", minute: "2-digit" };

/** "Oct 8, 2026, 6:00 PM – 8:00 PM" (no seconds; end date only when it differs). */
function formatEventRange(event) {
  const start = new Date(Number(event.startDate));
  const end = new Date(Number(event.endDate));
  const startText = `${start.toLocaleDateString("en-US", DAY_FORMAT)}, ${start.toLocaleTimeString("en-US", TIME_FORMAT)}`;
  if (Number.isNaN(end.getTime())) return startText;
  const sameDay = start.toDateString() === end.toDateString();
  const endText = sameDay
    ? end.toLocaleTimeString("en-US", TIME_FORMAT)
    : `${end.toLocaleDateString("en-US", DAY_FORMAT)}, ${end.toLocaleTimeString("en-US", TIME_FORMAT)}`;
  return `${startText} – ${endText}`;
}

/** @param {{ events?: any[]; publicCalendarId?: string }} props */
const Calendar = ({ events = [], publicCalendarId = "" }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);

  const monthNames = [
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
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const monthEvents = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return events
      .filter((event) => {
        const start = new Date(Number(event.startDate));
        return start.getFullYear() === year && start.getMonth() === month;
      })
      .sort((a, b) => Number(a.startDate) - Number(b.startDate));
  }, [currentDate, events]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let i = firstDay.getDay(); i > 0; i--)
      days.push(new Date(year, month, 1 - i));
    for (let i = 1; i <= lastDay.getDate(); i++)
      days.push(new Date(year, month, i));
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1];
      days.push(
        new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
      );
    }

    return days;
  };

  // Local calendar day, matching how the grid cells are built. toISOString()
  // would use UTC and push evening events onto the next day.
  const formatDate = (date) =>
    `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const getEventsForDay = (day) => {
    if (!day) return [];
    const dayKey = formatDate(day);
    return monthEvents.filter(
      (event) => formatDate(new Date(Number(event.startDate))) === dayKey,
    );
  };

  const changeMonth = (increment) => {
    setCurrentDate(
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + increment,
        1,
      ),
    );
  };

  const isToday = (day) => {
    if (!day) return false;
    const now = new Date();
    return (
      day.getDate() === now.getDate() &&
      day.getMonth() === now.getMonth() &&
      day.getFullYear() === now.getFullYear()
    );
  };

  const isSameMonth = (day) =>
    day.getMonth() === currentDate.getMonth() &&
    day.getFullYear() === currentDate.getFullYear();

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ieee-blue-100/15 pb-5">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl md:text-4xl">
          {monthNames[currentDate.getMonth()]}{" "}
          <span className="font-mono-tech font-normal text-white/45">
            {currentDate.getFullYear()}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
            className="ieee-btn ieee-btn-ghost h-11 w-11 rounded-lg !px-0 text-base"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
            className="ieee-btn ieee-btn-ghost h-11 w-11 rounded-lg !px-0 text-base"
          >
            →
          </button>
        </div>
      </div>

      {publicCalendarId && (
        <div className="surface-flat mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div className="max-w-xl">
            <p className="font-medium text-white">
              Add IEEE Events To Your Calendar
            </p>
            <p className="mt-1 text-sm text-white/60">
              Subscribe once to stay synced, or open an individual event below.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={buildGoogleCalendarSubscribeUrl(publicCalendarId)}
              target="_blank"
              rel="noreferrer"
              className="ieee-btn ieee-btn-primary ieee-btn-sm"
            >
              Subscribe in Google Calendar
            </a>
            <a
              href={buildGoogleCalendarIcsUrl(publicCalendarId)}
              target="_blank"
              rel="noreferrer"
              className="ieee-btn ieee-btn-ghost ieee-btn-sm"
            >
              Subscribe via ICS Feed
            </a>
          </div>
        </div>
      )}

      <div className="mt-6 border-l border-t border-ieee-blue-100/15">
        <div className="grid grid-cols-7">
          {weekDays.map((day) => (
            <div
              key={day}
              className="mono-label border-b border-r border-ieee-blue-100/15 py-2.5 text-center"
            >
              {day}
            </div>
          ))}

          {getDaysInMonth(currentDate).map((day, index) => {
            const inMonth = isSameMonth(day);
            const dayEvents = inMonth ? getEventsForDay(day) : [];
            return (
              <div
                key={index}
                className={`flex min-h-[3.75rem] flex-col border-b border-r border-ieee-blue-100/15 p-1.5 sm:min-h-[6rem] sm:p-2 ${
                  inMonth ? "" : "bg-white/[0.012]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`font-mono-tech text-xs sm:text-sm ${
                      isToday(day)
                        ? "text-ieee-yellow"
                        : inMonth
                          ? "text-white/60"
                          : "text-white/25"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {isToday(day) && (
                    <span
                      className="h-1 w-1 bg-ieee-yellow"
                      aria-hidden="true"
                    />
                  )}
                </div>

                {dayEvents.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <button
                        type="button"
                        key={event._id}
                        onClick={() => setSelectedEvent(event)}
                        aria-label={event.eventName}
                        className="flex w-full items-center gap-1.5 px-0.5 py-0.5 text-left transition-colors hover:bg-ieee-blue-100/10 focus-visible:bg-ieee-blue-100/10 focus-visible:outline-none"
                      >
                        <span
                          className="h-3 w-[2px] shrink-0 bg-ieee-blue-100/80"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 truncate text-[0.62rem] leading-tight text-ieee-blue-100 sm:text-xs">
                          {event.eventName}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ieee-black/85 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={selectedEvent.eventName}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-ieee-blue-100/20 bg-[#0d1324] p-6 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)]"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold leading-tight text-white md:text-xl">
                {selectedEvent.eventName}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                aria-label="Close event details"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/15 text-xl leading-none text-white/60 transition-colors hover:border-white/30 hover:text-white"
              >
                ×
              </button>
            </div>

            <p className="font-mono-tech text-sm text-ieee-blue-100">
              {formatEventRange(selectedEvent)}
            </p>
            {selectedEvent.location && (
              <p className="mt-1 text-sm text-white/70">
                {selectedEvent.location}
              </p>
            )}
            {selectedEvent.eventDescription && (
              <p className="line-clamp-4 mt-3 text-sm text-white/70">
                {selectedEvent.eventDescription}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              {selectedEvent.publicGoogleEventUrl && (
                <a
                  href={selectedEvent.publicGoogleEventUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ieee-btn ieee-btn-primary ieee-btn-sm"
                >
                  Add This Event (Google)
                </a>
              )}
              <button
                type="button"
                onClick={() =>
                  downloadEventIcs({
                    id: selectedEvent.publicGoogleEventId || selectedEvent._id,
                    title: selectedEvent.eventName,
                    description: selectedEvent.eventDescription,
                    location: selectedEvent.location,
                    startDate: Number(selectedEvent.startDate),
                    endDate: Number(selectedEvent.endDate),
                  })
                }
                className="ieee-btn ieee-btn-ghost ieee-btn-sm"
              >
                Download Event ICS
              </button>
            </div>

            {publicCalendarId && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-ieee-blue-100/15 pt-5">
                <a
                  href={buildGoogleCalendarSubscribeUrl(publicCalendarId)}
                  target="_blank"
                  rel="noreferrer"
                  className="ieee-btn ieee-btn-ghost ieee-btn-sm"
                >
                  Subscribe Full Calendar
                </a>
                <a
                  href={buildGoogleCalendarIcsUrl(publicCalendarId)}
                  target="_blank"
                  rel="noreferrer"
                  className="ieee-btn ieee-btn-ghost ieee-btn-sm"
                >
                  Full Calendar ICS Feed
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
