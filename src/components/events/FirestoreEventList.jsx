import React, { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { app } from "../../firebase/client";

const UpcomingEvent = ({ name, location, date, time, delay, description }) => (
  <div className="text-white w-full max-w-lg pl-4 md:pl-8 border-l-2 md:border-l-4 border-white/70 pb-8 md:pb-12 relative">
    <p
      data-inview
      className={`animate-duration-500 animate-delay-${delay * 200} in-view:animate-fade-left py-2 px-4 md:px-6 w-fit border border-white/30 font-light rounded-full text-sm md:text-lg lg:text-xl`}
    >
      {name}
    </p>
    <div
      data-inview
      className={`animate-duration-500 animate-delay-${delay * 200 + 100} in-view:animate-fade-left space-y-2 md:space-y-0 md:flex md:flex-wrap md:gap-4 text-sm md:text-base lg:text-lg my-4`}
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
      data-inview
      className={`animate-duration-500 animate-delay-${delay * 200 + 200} in-view:animate-fade-left text-xs md:text-sm lg:text-base text-white/60 break-words`}
    >
      {description}
    </p>
    <div className="bg-ieee-yellow w-3 h-3 md:w-4 md:h-4 rounded-full absolute -top-1.5 -left-[0.57rem]" />
  </div>
);

const FirestoreEventList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const fetchEvents = async () => {
      try {
        setLoading(true);
        setError(null);

        const db = getFirestore(app);
        const eventsRef = collection(db, "events");

        // Query published events, ordered by start date
        const q = query(
          eventsRef,
          where("published", "==", true),
          orderBy("startDate", "asc"),
        );

        const eventsSnapshot = await getDocs(q);

        const eventsData = eventsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
          };
        });

        // Filter for upcoming events (start date >= today)
        const now = new Date();
        const upcomingEvents = eventsData.filter((event) => {
          const startDate = event.startDate?.toDate
            ? event.startDate.toDate()
            : new Date(event.startDate);
          return startDate >= now;
        });

        // Take only the first 3 upcoming events
        setEvents(upcomingEvents.slice(0, 3));
      } catch (error) {
        console.error("Error fetching events from Firestore:", error);
        setError("Failed to load events");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [mounted]);

  if (!mounted || loading) {
    return (
      <div className="text-white">
        <UpcomingEvent
          name="Loading Events..."
          location="Please wait..."
          date=""
          time=""
          delay={0}
          description="Fetching the latest events from our database..."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-white">
        <UpcomingEvent
          name="Error Loading Events"
          location="Something went wrong"
          date=""
          time=""
          delay={0}
          description={error}
        />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-white">
        <UpcomingEvent
          name="No Upcoming Events!"
          location="¯\_(ツ)_/¯"
          date=""
          time=""
          delay={0}
          description="There are no upcoming events! Check back again soon :)"
        />
      </div>
    );
  }

  return (
    <div>
      {events.map((event, index) => {
        const startDate = event.startDate?.toDate
          ? event.startDate.toDate()
          : new Date(event.startDate);
        const day = startDate.toLocaleDateString("en-US", {
          weekday: "short",
        });
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
            key={event.id}
            name={event.eventName || "No Title"}
            location={event.location || "No location provided"}
            date={`${day} ${date}`}
            time={time}
            delay={index}
            description={event.eventDescription || "No description available."}
          />
        );
      })}
    </div>
  );
};

export default FirestoreEventList;
