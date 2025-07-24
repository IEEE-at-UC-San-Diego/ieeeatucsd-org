import React, { useState, useEffect } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { app } from "../../firebase/client";

const Calendar = ({ CALENDAR_API_KEY, EVENT_CALENDAR_ID }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    const endingDay = lastDay.getDay();

    const days = [];
    // Add empty slots for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    // Add empty slots for remaining days in the last week
    const remainingDays = 6 - endingDay;
    for (let i = 0; i < remainingDays; i++) {
      days.push(null);
    }
    return days;
  };

  // Format date to match event dates
  const formatDate = (date) => {
    if (!date) return "";
    return date.toISOString().split("T")[0];
  };

  // Get events for a specific day
  const getEventsForDay = (day) => {
    if (!day) return [];
    const dayStr = formatDate(day);
    return events.filter((event) => {
      let eventDate;
      if (event.start.dateTime) {
        // For events with specific times, convert to local timezone
        const date = new Date(event.start.dateTime);
        eventDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .split("T")[0];
      } else {
        // For all-day events, use the date directly
        eventDate = event.start.date;
      }
      return eventDate === dayStr;
    });
  };

  // Format time for display
  const formatEventTime = (dateTimeStr) => {
    if (!dateTimeStr) return "";
    const date = new Date(dateTimeStr);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const calendarId = EVENT_CALENDAR_ID;
    const userTimeZone = "America/Los_Angeles";

    const fetchFirestoreEvents = async () => {
      try {
        const db = getFirestore(app);
        const eventsRef = collection(db, "events");

        // Get first and last day of current month for filtering
        const firstDay = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1,
        );
        const lastDay = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0,
        );

        // Query published events
        const q = query(
          eventsRef,
          where("published", "==", true),
          orderBy("startDate", "asc"),
        );

        const eventsSnapshot = await getDocs(q);

        const firestoreEvents = eventsSnapshot.docs
          .map((doc) => {
            const data = doc.data();
            const startDate = data.startDate?.toDate
              ? data.startDate.toDate()
              : new Date(data.startDate);
            const endDate = data.endDate?.toDate
              ? data.endDate.toDate()
              : new Date(data.endDate);

            // Transform to Google Calendar format
            return {
              id: doc.id,
              summary: data.eventName,
              description: data.eventDescription,
              location: data.location,
              start: {
                dateTime: startDate.toISOString(),
                date: null,
              },
              end: {
                dateTime: endDate.toISOString(),
                date: null,
              },
              source: "firestore", // Mark as Firestore event
            };
          })
          .filter((event) => {
            // Filter events in current month
            const eventDate = new Date(event.start.dateTime);
            return eventDate >= firstDay && eventDate <= lastDay;
          });

        return firestoreEvents;
      } catch (error) {
        console.error("Error fetching Firestore events:", error);
        return [];
      }
    };

    const loadGapiAndListEvents = async () => {
      try {
        let googleEvents = [];

        // Try to load Google Calendar events if API key is provided
        if (CALENDAR_API_KEY && calendarId) {
          if (typeof window.gapi === "undefined") {
            await new Promise((resolve, reject) => {
              const script = document.createElement("script");
              script.src = "https://apis.google.com/js/api.js";
              document.body.appendChild(script);
              script.onload = () => {
                window.gapi.load("client", resolve);
              };
              script.onerror = () => {
                reject(new Error("Failed to load the Google API script."));
              };
            });
          }

          await window.gapi.client.init({
            apiKey: CALENDAR_API_KEY,
            discoveryDocs: [
              "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
            ],
          });

          // Get first and last day of current month
          const firstDay = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            1,
          );
          const lastDay = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth() + 1,
            0,
          );

          const response = await window.gapi.client.calendar.events.list({
            calendarId: calendarId,
            timeZone: userTimeZone,
            singleEvents: true,
            timeMin: firstDay.toISOString(),
            timeMax: lastDay.toISOString(),
            orderBy: "startTime",
          });

          if (response.result.items) {
            googleEvents = response.result.items.map((event) => ({
              ...event,
              source: "google", // Mark as Google Calendar event
            }));
          }
        }

        // Fetch Firestore events
        const firestoreEvents = await fetchFirestoreEvents();

        // Combine both event sources
        const allEvents = [...googleEvents, ...firestoreEvents];

        // Sort combined events by start time
        allEvents.sort((a, b) => {
          const dateA = new Date(a.start.dateTime || a.start.date);
          const dateB = new Date(b.start.dateTime || b.start.date);
          return dateA - dateB;
        });

        setEvents(allEvents);
      } catch (error) {
        console.error("Error loading events: ", error);

        // If Google Calendar fails, try to load just Firestore events
        try {
          const firestoreEvents = await fetchFirestoreEvents();
          setEvents(firestoreEvents);
        } catch (firestoreError) {
          console.error("Error loading Firestore events:", firestoreError);
          setError("Failed to load events");
        }
      } finally {
        setLoading(false);
      }
    };

    setLoading(true);
    loadGapiAndListEvents();
  }, [CALENDAR_API_KEY, EVENT_CALENDAR_ID, currentDate, mounted]);

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

  const changeMonth = (increment) => {
    setCurrentDate(
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + increment,
        1,
      ),
    );
  };

  const handleEventMouseEnter = (event, e) => {
    const target = e.target;
    setTooltipPosition({
      x: e.clientX,
      y: e.clientY,
    });
    setHoveredEvent({ event, target });
  };

  const handleEventMouseLeave = () => {
    setHoveredEvent(null);
  };

  const handleMouseMove = (e) => {
    if (hoveredEvent) {
      // Check if the mouse is still over the event element
      const rect = hoveredEvent.target.getBoundingClientRect();
      const isStillHovering =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (!isStillHovering) {
        setHoveredEvent(null);
      } else {
        setTooltipPosition({
          x: e.clientX,
          y: e.clientY,
        });
      }
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (hoveredEvent) {
        const rect = hoveredEvent.target.getBoundingClientRect();
        const mouseX = tooltipPosition.x - 15; // Subtract the offset added to the tooltip
        const mouseY = tooltipPosition.y - 15;

        const isStillHovering =
          mouseX >= rect.left &&
          mouseX <= rect.right &&
          mouseY >= rect.top &&
          mouseY <= rect.bottom;

        if (!isStillHovering) {
          setHoveredEvent(null);
        }
      }
    };

    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [hoveredEvent, tooltipPosition]);

  if (!CALENDAR_API_KEY) {
    return (
      <div className="text-white">
        Error: Calendar API key is not configured
      </div>
    );
  }

  return (
    <div
      className="md:w-[90vw] w-[95vw] mx-auto p-[3vw] relative z-10"
      onMouseMove={handleMouseMove}
    >
      {/* Hovering Calendar Header */}
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

      {/* Main Calendar Body */}
      <div className="bg-gradient-to-t from-ieee-blue-100/5 to-ieee-blue-100/25 rounded-[1.5vw] p-[1vw] relative">
        {/* Week Days Header */}
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

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-[0.5vw] relative">
          {getDaysInMonth(currentDate).map((day, index) => (
            <div
              key={index}
              className={`min-h-[10vw] p-[0.5vw] rounded relative ${
                day ? "bg-white/5" : "bg-transparent"
              } border border-white/10`}
            >
              {day && (
                <>
                  <div className="text-white mb-[0.5vw] text-[1vw]">
                    {day.getDate()}
                  </div>
                  <div className="space-y-[0.5vw]">
                    {getEventsForDay(day).map((event, eventIndex) => (
                      <div
                        key={eventIndex}
                        className={`text-[0.8vw] border text-white p-[0.5vw] rounded truncate cursor-pointer hover:bg-white/10 transition-colors relative ${
                          event.source === 'firestore' 
                            ? 'border-ieee-yellow bg-ieee-yellow/10' 
                            : 'border-gray-300'
                        }`}
                        onMouseEnter={(e) => handleEventMouseEnter(event, e)}
                        onMouseLeave={handleEventMouseLeave}
                      >
                        {event.summary}
                        {event.source === 'firestore' && (
                          <div className="absolute -top-1 -right-1 w-2 h-2 bg-ieee-yellow rounded-full"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Tooltip */}
        {hoveredEvent && (
          <div
            className="fixed z-[9999] bg-ieee-blue-100 text-white p-[1vw] rounded-[0.5vw] shadow-xl border border-white/20 min-w-[15vw]"
            style={{
              left: `${tooltipPosition.x + 15}px`,
              top: `${tooltipPosition.y + 15}px`,
            }}
          >
            <h3 className="text-[1vw] font-semibold mb-[0.5vw] flex items-center gap-2">
              {hoveredEvent.event.summary}
              {hoveredEvent.event.source === 'firestore' && (
                <span className="text-ieee-yellow text-[0.7vw] bg-ieee-yellow/20 px-2 py-1 rounded">
                  IEEE Event
                </span>
              )}
            </h3>
            {hoveredEvent.event.description && (
              <p className="text-[0.8vw] mb-[0.5vw] text-white/80">
                {hoveredEvent.event.description}
              </p>
            )}
            <div className="text-[0.8vw] text-white/90">
              {hoveredEvent.event.start.dateTime ? (
                <>
                  <p>
                    Start: {formatEventTime(hoveredEvent.event.start.dateTime)}
                  </p>
                  <p>End: {formatEventTime(hoveredEvent.event.end.dateTime)}</p>
                </>
              ) : (
                <p>All day event</p>
              )}
              {hoveredEvent.event.location && (
                <p className="mt-[0.3vw]">
                  Location: {hoveredEvent.event.location}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Calendar;
