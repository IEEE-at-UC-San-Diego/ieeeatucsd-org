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
  <div className="text-white w-[40vw] pl-[8%] md:border-l-[0.3vw] border-l-[0.5vw] border-white/70 md:pb-[5%] pb-[10%] relative">
    <p
      data-inview
      className={`animate-duration-500 animate-delay-${delay * 200} in-view:animate-fade-left py-[0.2%] pl-[8%] md:pl-[2%] md:pr-[2%] w-fit border-[0.1vw] font-light rounded-full md:text-[1.3vw] text-[2.3vw]`}
    >
      {name}
    </p>
    <div
      data-inview
      className={`animate-duration-500 animate-delay-${delay * 200 + 100} in-view:animate-fade-left md:flex justify-between items-center min-w-[70%] w-fit md:text-[1.2vw] text-[2vw] my-[2%]`}
    >
      Location: {location}
      {date && (
        <>
          <div className="md:visible invisible bg-white h-[0.5vw] w-[0.5vw] rounded-full mx-[0.5vw]" />
          <p>{date}</p>
        </>
      )}
      {time && (
        <>
          <div className="md:visible invisible bg-white h-[0.5vw] w-[0.5vw] rounded-full mx-[0.5vw]" />
          <p>{time}</p>
        </>
      )}
    </div>
    <p
      data-inview
      className={`animate-duration-500 animate-delay-${delay * 200 + 200} in-view:animate-fade-left md:text-[1vw] text-[1.8vw] text-white/60`}
    >
      {description}
    </p>
    <div className="bg-ieee-yellow md:h-[1.2vw] h-[1.5vw] md:w-[1.2vw] w-[1.5vw] rounded-full absolute -top-[1.5%] -left-[2%]" />
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
