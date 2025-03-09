import React, { useEffect, useState } from "react";

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
