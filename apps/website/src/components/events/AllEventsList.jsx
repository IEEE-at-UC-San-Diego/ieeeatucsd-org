import { useMemo, useState } from "react";
import {
  buildGoogleCalendarIcsUrl,
  buildGoogleCalendarSubscribeUrl,
  downloadEventIcs,
} from "../../lib/calendarLinks";

const EventCard = ({ event, publicCalendarId }) => {
  const startDate = new Date(Number(event.startDate));
  const endDate = new Date(Number(event.endDate));

  const formatDate = (date) =>
    date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const formatTime = (date) =>
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

  const isUpcoming = startDate > new Date();
  const isPast = endDate < new Date();

  return (
    <article className="border-b border-ieee-blue-100/15 py-8">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <h3 className="title-3 text-white">{event.eventName}</h3>
        <span
          className={`rounded-md border px-3 py-1 text-xs font-medium ${
            isUpcoming
              ? "border-ieee-yellow/40 bg-ieee-yellow/10 text-ieee-yellow"
              : isPast
                ? "border-white/15 bg-white/5 text-white/50"
                : "border-ieee-blue-100/40 bg-ieee-blue-100/10 text-ieee-blue-100"
          }`}
        >
          {isUpcoming ? "Upcoming" : isPast ? "Past" : "Ongoing"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-white/80">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-ieee-blue-100"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-mono-tech text-ieee-blue-100">
            {formatDate(startDate)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-ieee-blue-100"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            {formatTime(startDate)} - {formatTime(endDate)}
          </span>
        </div>

        {event.location && (
          <div className="flex items-center gap-2">
            <svg
              className="h-4 w-4 text-ieee-blue-100"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{event.location}</span>
          </div>
        )}
      </div>

      {event.eventDescription && (
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70">
          {event.eventDescription}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {event.publicGoogleEventUrl && (
          <a
            href={event.publicGoogleEventUrl}
            target="_blank"
            rel="noreferrer"
            className="ieee-btn ieee-btn-ghost ieee-btn-sm"
          >
            Open in Google Calendar
          </a>
        )}
        <button
          type="button"
          onClick={() =>
            downloadEventIcs({
              id: event.publicGoogleEventId || event._id,
              title: event.eventName,
              description: event.eventDescription,
              location: event.location,
              startDate: Number(event.startDate),
              endDate: Number(event.endDate),
            })
          }
          className="ieee-btn ieee-btn-primary ieee-btn-sm"
        >
          Download Event ICS
        </button>
        {publicCalendarId && (
          <a
            href={buildGoogleCalendarSubscribeUrl(publicCalendarId)}
            target="_blank"
            rel="noreferrer"
            className="ieee-btn ieee-btn-ghost ieee-btn-sm"
          >
            Subscribe Calendar
          </a>
        )}
      </div>
    </article>
  );
};

/** @param {{ events?: any[]; publicCalendarId?: string }} props */
const AllEventsList = ({ events = [], publicCalendarId = "" }) => {
  const [filter, setFilter] = useState("all");

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => Number(b.startDate) - Number(a.startDate)),
    [events],
  );

  const filteredEvents = useMemo(() => {
    return sortedEvents.filter((event) => {
      if (filter === "all") return true;
      const startDate = new Date(Number(event.startDate));
      const endDate = new Date(Number(event.endDate));
      const now = new Date();
      if (filter === "upcoming") return startDate > now;
      if (filter === "past") return endDate < now;
      return true;
    });
  }, [filter, sortedEvents]);

  return (
    <div className="max-w-4xl py-8">
      <div className="mb-8">
        <h2 className="headline text-white">All Events</h2>
        {publicCalendarId && (
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={buildGoogleCalendarSubscribeUrl(publicCalendarId)}
              target="_blank"
              rel="noreferrer"
              className="ieee-btn ieee-btn-primary ieee-btn-sm"
            >
              Subscribe Public Calendar
            </a>
            <a
              href={buildGoogleCalendarIcsUrl(publicCalendarId)}
              target="_blank"
              rel="noreferrer"
              className="ieee-btn ieee-btn-ghost ieee-btn-sm"
            >
              Public Calendar ICS Feed
            </a>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { key: "all", label: "All Events" },
            { key: "upcoming", label: "Upcoming" },
            { key: "past", label: "Past Events" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`ieee-btn ieee-btn-sm ${
                filter === key ? "ieee-btn-primary" : "ieee-btn-ghost"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="border-t border-ieee-blue-100/15 py-12 text-white/70">
          <p className="text-xl">No events found for the selected filter.</p>
        </div>
      ) : (
        <div className="border-t border-ieee-blue-100/15">
          {filteredEvents.map((event) => (
            <EventCard
              key={event._id}
              event={event}
              publicCalendarId={publicCalendarId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AllEventsList;
