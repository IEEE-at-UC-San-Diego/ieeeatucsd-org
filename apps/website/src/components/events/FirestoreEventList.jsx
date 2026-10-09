import { useMemo } from "react";

const SHRUG = "¯\\_(ツ)_/¯";

const UpcomingEvent = ({ name, location, date, time, description }) => (
  <article className="border-b border-ieee-blue-100/15 py-6 last:border-b-0">
    <h3 className="title-3 text-white">{name}</h3>
    <dl className="mt-3 space-y-1.5 text-sm">
      <div className="flex gap-3">
        <dt className="mono-label w-16 shrink-0 pt-0.5">Location:</dt>
        <dd className="text-white/80">
          {location === SHRUG ? (
            <span className="whitespace-nowrap font-mono-tech">{location}</span>
          ) : (
            location
          )}
        </dd>
      </div>
      {date && (
        <div className="flex gap-3">
          <dt className="mono-label w-16 shrink-0 pt-0.5">Date:</dt>
          <dd className="font-mono-tech text-ieee-blue-100">{date}</dd>
        </div>
      )}
      {time && (
        <div className="flex gap-3">
          <dt className="mono-label w-16 shrink-0 pt-0.5">Time:</dt>
          <dd className="font-mono-tech text-ieee-blue-100">{time}</dd>
        </div>
      )}
    </dl>
    <p className="mt-4 text-sm leading-relaxed text-white/70">{description}</p>
  </article>
);

/** @param {{ events?: any[] }} props */
const FirestoreEventList = ({ events = [] }) => {
  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return [...events]
      .filter((event) => Number(event.startDate) >= now)
      .sort((a, b) => Number(a.startDate) - Number(b.startDate))
      .slice(0, 2);
  }, [events]);

  if (upcomingEvents.length === 0) {
    return (
      <div className="border-t border-ieee-blue-100/15">
        <UpcomingEvent
          name="No Upcoming Events!"
          location={SHRUG}
          date=""
          time=""
          description="There are no upcoming events! Check back again soon :)"
        />
      </div>
    );
  }

  return (
    <div className="border-t border-ieee-blue-100/15">
      {upcomingEvents.map((event) => {
        const startDate = new Date(Number(event.startDate));
        const day = startDate.toLocaleDateString("en-US", { weekday: "short" });
        const date = startDate.toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        const time = startDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });

        return (
          <UpcomingEvent
            key={event._id}
            name={event.eventName || "No Title"}
            location={event.location || "No location provided"}
            date={`${day} ${date}`}
            time={time}
            description={event.eventDescription || "No description available."}
          />
        );
      })}
    </div>
  );
};

export default FirestoreEventList;
