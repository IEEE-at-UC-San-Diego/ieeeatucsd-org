import { useMemo, useState } from "react";
import {
  buildGoogleCalendarIcsUrl,
  buildGoogleCalendarSubscribeUrl,
  downloadEventIcs,
} from "../../lib/calendarLinks";

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

    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++)
      days.push(new Date(year, month, i));
    while (days.length % 7 !== 0) days.push(null);

    return days;
  };

  const formatDate = (date) => date.toISOString().split("T")[0];
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

  return (
    <div className="md:w-[90vw] w-[95vw] mx-auto p-[3vw] relative z-10">
      <div className="flex justify-center mb-[2vw]">
        <div className="bg-gradient-to-t from-ieee-blue-100/5 to-ieee-blue-100/25 rounded-[1.5vw] p-[1vw] backdrop-blur-sm w-[30vw] px-[2vw]">
          <div className="flex items-center gap-[3vw]">
            <button
              onClick={() => changeMonth(-1)}
              className="text-white hover:text-ieee-yellow transition-colors text-[2vw] bg-ieee-black/40 w-[4vw] h-[4vw] rounded-[1vw] flex items-center justify-center"
            >
              ←
            </button>
            <h2 className="text-white text-[2.5vw] font-bold whitespace-nowrap">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={() => changeMonth(1)}
              className="text-white hover:text-gray transition-colors text-[2vw] bg-ieee-black/40 w-[4vw] h-[4vw] rounded-[1vw] flex items-center justify-center"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {publicCalendarId && (
        <div className="flex justify-center mb-4">
          <div className="w-full max-w-3xl bg-gradient-to-r from-ieee-blue-100/35 to-ieee-black/50 border border-ieee-yellow/40 rounded-2xl px-4 py-3 md:px-5 md:py-4 shadow-lg shadow-black/30">
            <p className="text-white font-semibold text-sm md:text-base mb-2">
              Add IEEE Events To Your Calendar
            </p>
            <p className="text-white/80 text-xs md:text-sm mb-3">
              Subscribe once to stay synced, or open an individual event below.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={buildGoogleCalendarSubscribeUrl(publicCalendarId)}
                target="_blank"
                rel="noreferrer"
                className="text-xs md:text-sm text-black bg-ieee-yellow px-3 py-1.5 rounded-full font-semibold hover:brightness-95 transition"
              >
                Subscribe in Google Calendar
              </a>
              <a
                href={buildGoogleCalendarIcsUrl(publicCalendarId)}
                target="_blank"
                rel="noreferrer"
                className="text-xs md:text-sm text-white bg-white/15 px-3 py-1.5 rounded-full hover:bg-white/25 transition"
              >
                Subscribe via ICS Feed
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-t from-ieee-blue-100/5 to-ieee-blue-100/25 rounded-[1.5vw] p-[1vw] relative">
        <div className="grid grid-cols-7 gap-[0.5vw] mb-[1vw]">
          {weekDays.map((day, index) => (
            <div key={day} className="flex justify-center w-full">
              <div
                className={`text-white text-center font-semibold p-[0.5vw] text-[1.2vw] bg-ieee-black/60 w-full h-[4vw] flex items-center justify-center
                ${
                  index === 0
                    ? "rounded-tl-[2vw] rounded-[0.5vw]"
                    : index === 6
                      ? "rounded-tr-[2vw] rounded-[0.5vw]"
                      : "rounded-[0.5vw]"
                }`}
              >
                {day}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-[0.5vw] relative">
          {getDaysInMonth(currentDate).map((day, index) => (
            <div
              key={index}
              className={`min-h-[10vw] p-[0.5vw] rounded relative ${day ? "bg-white/5" : "bg-transparent"} border border-white/10 ${
                isToday(day)
                  ? "ring-2 ring-ieee-yellow/60 bg-ieee-yellow/10"
                  : ""
              }`}
            >
              {day && (
                <>
                  <div className="text-white mb-[0.5vw] text-[1vw]">
                    {day.getDate()}
                  </div>
                  <div className="space-y-[0.5vw]">
                    {getEventsForDay(day)
                      .slice(0, 3)
                      .map((event) => (
                        <button
                          type="button"
                          key={event._id}
                          className="w-full text-left text-[0.75vw] border border-ieee-yellow text-white p-[0.45vw] rounded truncate hover:bg-white/10 transition-colors"
                          onClick={() => setSelectedEvent(event)}
                        >
                          {event.eventName}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-gradient-to-b from-ieee-blue-100/90 to-ieee-black border border-ieee-yellow/40 rounded-2xl p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-white text-lg md:text-xl font-bold leading-tight">
                  {selectedEvent.eventName}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="text-white/70 hover:text-white text-xl leading-none"
                  aria-label="Close event details"
                >
                  ×
                </button>
              </div>

              <p className="text-white/90 text-sm mb-1">
                {new Date(Number(selectedEvent.startDate)).toLocaleString()} -{" "}
                {new Date(Number(selectedEvent.endDate)).toLocaleTimeString()}
              </p>
              {selectedEvent.location && (
                <p className="text-white/80 text-sm mb-2">
                  {selectedEvent.location}
                </p>
              )}
              {selectedEvent.eventDescription && (
                <p className="text-white/75 text-sm mb-4 line-clamp-4">
                  {selectedEvent.eventDescription}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {selectedEvent.publicGoogleEventUrl && (
                  <a
                    href={selectedEvent.publicGoogleEventUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs md:text-sm px-3 py-1.5 rounded-full bg-ieee-yellow text-black font-semibold hover:brightness-95 transition"
                  >
                    Add This Event (Google)
                  </a>
                )}
                <button
                  type="button"
                  onClick={() =>
                    downloadEventIcs({
                      id:
                        selectedEvent.publicGoogleEventId || selectedEvent._id,
                      title: selectedEvent.eventName,
                      description: selectedEvent.eventDescription,
                      location: selectedEvent.location,
                      startDate: Number(selectedEvent.startDate),
                      endDate: Number(selectedEvent.endDate),
                    })
                  }
                  className="text-xs md:text-sm px-3 py-1.5 rounded-full bg-white/15 text-white hover:bg-white/25 transition"
                >
                  Download Event ICS
                </button>
              </div>

              {publicCalendarId && (
                <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap gap-2">
                  <a
                    href={buildGoogleCalendarSubscribeUrl(publicCalendarId)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-3 py-1.5 rounded-full bg-white/15 text-white hover:bg-white/25 transition"
                  >
                    Subscribe Full Calendar
                  </a>
                  <a
                    href={buildGoogleCalendarIcsUrl(publicCalendarId)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-3 py-1.5 rounded-full bg-white/15 text-white hover:bg-white/25 transition"
                  >
                    Full Calendar ICS Feed
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Calendar;
