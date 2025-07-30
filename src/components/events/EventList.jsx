import React, { useEffect, useState } from "react";

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
    <div className="bg-ieee-yellow w-3 h-3 md:w-4 md:h-4 rounded-full absolute -top-1.5 -left-1.5" />
  </div>
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
    <div>
      {error && <p className="text-white">Error: {error}</p>}
      {!loading && !error && events.length === 0 && (
        <UpcomingEvent
          name="No Upcoming Events!"
          location="¯\_(ツ)_/¯"
          date=""
          time=""
          delay={0}
          description="There are no upcoming events! Check back again soon :)
...or just wait for the entire page to load. This is here by default LOL"
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
                delay={index}
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
