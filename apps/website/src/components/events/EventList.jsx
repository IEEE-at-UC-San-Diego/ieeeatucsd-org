import React, { useEffect, useState } from "react";

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

const EventList = ({ CALENDAR_API_KEY, EVENT_CALENDAR_ID }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const apiKey = CALENDAR_API_KEY;
    const calendarId = EVENT_CALENDAR_ID;
    const userTimeZone = "America/Los_Angeles";

    const loadGapiAndListEvents = async () => {
      try {
        // console.log("Starting to load events...");

        if (typeof window.gapi === "undefined") {
          // console.log("Loading GAPI script...");
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://apis.google.com/js/api.js";
            document.body.appendChild(script);
            script.onload = () => {
              // console.log("GAPI script loaded");
              window.gapi.load("client", resolve);
            };
            script.onerror = () => {
              console.error("Failed to load GAPI script");
              reject(new Error("Failed to load the Google API script."));
            };
          });
        }

        // console.log("Initializing GAPI client...");
        await window.gapi.client.init({
          apiKey: apiKey,
          discoveryDocs: [
            "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
          ],
        });

        // console.log("Fetching events...");
        const response = await window.gapi.client.calendar.events.list({
          calendarId: calendarId,
          timeZone: userTimeZone,
          singleEvents: true,
          timeMin: new Date().toISOString(),
          maxResults: 3,
          orderBy: "startTime",
        });

        // console.log("Response received:", response);

        if (response.result.items) {
          setEvents(response.result.items);
        }
      } catch (error) {
        console.error("Detailed Error: ", error);
        setError(error.message || "Failed to load events");
      } finally {
        setLoading(false);
      }
    };

    if (!CALENDAR_API_KEY) {
      setError("API key is missing");
      setLoading(false);
      return;
    }

    setLoading(true);
    loadGapiAndListEvents();
  }, [CALENDAR_API_KEY]);

  if (!CALENDAR_API_KEY) {
    return (
      <div className="text-white">
        Error: Calendar API key is not configured
      </div>
    );
  }

  return (
    <div className="border-t border-ieee-blue-100/15">
      {error && <p className="text-white">Error: {error}</p>}
      {!loading && !error && events.length === 0 && (
        <UpcomingEvent
          name="No Upcoming Events!"
          location={SHRUG}
          date=""
          time=""
          description="There are no upcoming events. Check back soon."
        />
      )}
      {!loading && !error && events.length > 0 && (
        <div>
          {events.map((event, index) => {
            const startDate = new Date(
              event.start.dateTime || event.start.date,
            );
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
                key={index}
                name={event.summary || "No Title"}
                location={event.location || "No location provided"}
                date={`${day} ${date}`}
                time={time}
                description={event.description || "No description available."}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EventList;
