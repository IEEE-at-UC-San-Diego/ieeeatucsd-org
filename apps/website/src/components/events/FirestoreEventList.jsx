import { useMemo } from "react";

const UpcomingEvent = ({ name, location, date, time, description }) => (
  <div className="text-white w-full max-w-lg pl-4 md:pl-8 border-l-2 md:border-l-4 border-white/70 pb-8 md:pb-12 relative">
    <p
      className="py-2 px-4 md:px-6 w-fit border border-white/30 font-light rounded-full text-sm md:text-lg lg:text-xl"
    >
      {name}
    </p>
    <div
      className="space-y-2 md:space-y-0 md:flex md:flex-wrap md:gap-4 text-sm md:text-base lg:text-lg my-4"
    >
      <div className="flex items-center flex-wrap">
        <span className="font-medium mr-2">Location:</span>
        <span className="break-words">{location}</span>
      </div>
      {date && (
        <div className="flex items-center">
          <span className="font-medium mr-2">Date:</span>
          <span>{date}</span>
        </div>
      )}
      {time && (
        <div className="flex items-center">
          <span className="font-medium mr-2">Time:</span>
          <span>{time}</span>
        </div>
      )}
    </div>
    <p
      className="text-xs md:text-sm lg:text-base text-white/60 break-words"
    >
      {description}
    </p>
    <div className="bg-ieee-yellow w-3 h-3 md:w-4 md:h-4 rounded-full absolute -top-1.5 -left-[0.57rem]" />
  </div>
);

/** @param {{ events?: any[] }} props */
const FirestoreEventList = ({ events = [] }) => {
  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return [...events]
      .filter((event) => Number(event.startDate) >= now)
      .sort((a, b) => Number(a.startDate) - Number(b.startDate))
      .slice(0, 3);
  }, [events]);

  if (upcomingEvents.length === 0) {
    return (
      <div className="text-white">
        <UpcomingEvent
          name="No Upcoming Events!"
          location="¯\\_(ツ)_/¯"
          date=""
          time=""
          description="There are no upcoming events! Check back again soon :)"
        />
      </div>
    );
  }

  return (
    <div>
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
