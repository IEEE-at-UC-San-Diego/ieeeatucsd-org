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

const EventCard = ({ event, index }) => {
  const startDate = event.startDate?.toDate
    ? event.startDate.toDate()
    : new Date(event.startDate);
  const endDate = event.endDate?.toDate
    ? event.endDate.toDate()
    : new Date(event.endDate);

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const isUpcoming = startDate > new Date();
  const isPast = endDate < new Date();

  return (
    <div
      className={`bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-6 border border-white/20 hover:bg-white/15 transition-all duration-300 animate-duration-500 animate-delay-${index * 100} in-view:animate-fade-up`}
      data-inview
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-white text-xl font-bold">{event.eventName}</h3>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            isUpcoming
              ? "bg-green-500/20 text-green-300"
              : isPast
                ? "bg-gray-500/20 text-gray-300"
                : "bg-blue-500/20 text-blue-300"
          }`}
        >
          {isUpcoming ? "Upcoming" : isPast ? "Past" : "Ongoing"}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center text-white/80">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
              clipRule="evenodd"
            />
          </svg>
          <span>{formatDate(startDate)}</span>
        </div>

        <div className="flex items-center text-white/80">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
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
          <div className="flex items-center text-white/80">
            <svg
              className="w-4 h-4 mr-2"
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
        <p className="text-white/70 text-sm leading-relaxed mb-4">
          {event.eventDescription}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {event.pointsToReward > 0 && (
            <span className="text-ieee-yellow font-medium">
              {event.pointsToReward} points
            </span>
          )}
          {event.hasFood && (
            <span className="text-green-300 text-sm">🍕 Food provided</span>
          )}
        </div>

        {event.eventType && (
          <span className="text-white/60 text-xs uppercase tracking-wide">
            {event.eventType}
          </span>
        )}
      </div>
    </div>
  );
};

const AllEventsList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // all, upcoming, past
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

        // Query published events, ordered by start date (newest first)
        const q = query(
          eventsRef,
          where("published", "==", true),
          orderBy("startDate", "desc"),
        );

        const eventsSnapshot = await getDocs(q);

        const eventsData = eventsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
          };
        });

        setEvents(eventsData);
      } catch (error) {
        console.error("Error fetching events from Firestore:", error);
        setError("Failed to load events");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [mounted]);

  const filteredEvents = events.filter((event) => {
    if (filter === "all") return true;

    const startDate = event.startDate?.toDate
      ? event.startDate.toDate()
      : new Date(event.startDate);
    const endDate = event.endDate?.toDate
      ? event.endDate.toDate()
      : new Date(event.endDate);
    const now = new Date();

    if (filter === "upcoming") return startDate > now;
    if (filter === "past") return endDate < now;

    return true;
  });

  if (!mounted || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ieee-yellow mx-auto mb-4"></div>
          <p>Loading events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center text-white">
          <p className="text-red-300">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-white text-3xl font-bold mb-4">All Events</h2>

        {/* Filter buttons */}
        <div className="flex space-x-4 mb-6">
          {[
            { key: "all", label: "All Events" },
            { key: "upcoming", label: "Upcoming" },
            { key: "past", label: "Past Events" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-full transition-all duration-200 ${
                filter === key
                  ? "bg-ieee-yellow text-black font-medium"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="text-center text-white/70 py-12">
          <p className="text-xl">No events found for the selected filter.</p>
        </div>
      ) : (
        <div>
          {filteredEvents.map((event, index) => (
            <EventCard key={event.id} event={event} index={index} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AllEventsList;
