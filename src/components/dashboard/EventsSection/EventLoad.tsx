import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { Get } from "../../../scripts/pocketbase/Get";
import { Authentication } from "../../../scripts/pocketbase/Authentication";

interface Event {
    id: string;
    event_name: string;
    event_code: string;
    location: string;
    points_to_reward: number;
    attendees: AttendeeEntry[];
    start_date: string;
    end_date: string;
    has_food: boolean;
    description: string;
    files: string[];
}

interface AttendeeEntry {
    user_id: string;
    time_checked_in: string;
    food: string;
}

declare global {
    interface Window {
        openDetailsModal: (event: Event) => void;
        downloadAllFiles: () => Promise<void>;
        currentEventId: string;
        [key: string]: any;
    }
}

const EventLoad = () => {
    const [events, setEvents] = useState<{
        upcoming: Event[];
        ongoing: Event[];
        past: Event[];
    }>({
        upcoming: [],
        ongoing: [],
        past: [],
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadEvents();
    }, []);

    const createSkeletonCard = () => (
        <div className="card bg-base-200 shadow-lg animate-pulse">
            <div className="card-body p-5">
                <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                            <div className="skeleton h-6 w-3/4 mb-2"></div>
                            <div className="flex items-center gap-2">
                                <div className="skeleton h-5 w-16"></div>
                                <div className="skeleton h-5 w-20"></div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className="skeleton h-5 w-24 mb-1"></div>
                            <div className="skeleton h-4 w-16"></div>
                        </div>
                    </div>

                    <div className="skeleton h-4 w-full mb-3"></div>

                    <div className="flex items-center gap-2">
                        <div className="skeleton h-4 w-4"></div>
                        <div className="skeleton h-4 w-1/2"></div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderEventCard = (event: Event) => {
        const startDate = new Date(event.start_date);
        const endDate = new Date(event.end_date);
        const now = new Date();
        const isPastEvent = endDate < now;

        // Get current user to check attendance
        const auth = Authentication.getInstance();
        const currentUser = auth.getCurrentUser();
        const hasAttended = currentUser && event.attendees?.some(entry => entry.user_id === currentUser.id);

        // Store event data in window object with unique ID
        const eventDataId = `event_${event.id}`;
        window[eventDataId] = event;

        return (
            <div key={event.id} className="card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                <div className="card-body p-3 sm:p-4">
                    <div className="flex flex-col h-full">
                        <div className="flex flex-col gap-2">
                            <div className="flex-1">
                                <h3 className="card-title text-base sm:text-lg font-semibold mb-1 line-clamp-2">{event.event_name}</h3>
                                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-base-content/70">
                                    <div className="badge badge-primary badge-sm">{event.points_to_reward} pts</div>
                                    <div className="text-xs sm:text-sm opacity-75">
                                        {startDate.toLocaleDateString("en-US", {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric",
                                        })}
                                        {" • "}
                                        {startDate.toLocaleTimeString("en-US", {
                                            hour: "numeric",
                                            minute: "2-digit",
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-xs sm:text-sm text-base-content/70 my-2 line-clamp-2">
                            {event.description || "No description available"}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
                            {event.files && event.files.length > 0 && (
                                <button
                                    onClick={() => window.openDetailsModal(event)}
                                    className="btn btn-ghost btn-sm text-xs sm:text-sm gap-1 h-8 min-h-0 px-2"
                                >
                                    <Icon icon="heroicons:document-duplicate" className="h-3 w-3 sm:h-4 sm:w-4" />
                                    Files ({event.files.length})
                                </button>
                            )}
                            {isPastEvent && (
                                <div className={`badge ${hasAttended ? 'badge-success' : 'badge-ghost'} text-xs gap-1`}>
                                    <Icon
                                        icon={hasAttended ? "heroicons:check-circle" : "heroicons:x-circle"}
                                        className="h-3 w-3"
                                    />
                                    {hasAttended ? 'Attended' : 'Not Attended'}
                                </div>
                            )}
                            <div className="text-xs sm:text-sm opacity-75 ml-auto">
                                {event.location}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const loadEvents = async () => {
        try {
            const get = Get.getInstance();
            const allEvents = await get.getAll<Event>(
                "events",
                "published = true",
                "-start_date",
                {
                    fields: ["*"],
                    disableAutoCancellation: true
                }
            );

            // Split events into upcoming, ongoing, and past based on start and end dates
            const now = new Date();
            const { upcoming, ongoing, past } = allEvents.reduce(
                (acc, event) => {
                    // Convert UTC dates to local time
                    const startDate = new Date(event.start_date);
                    const endDate = new Date(event.end_date);

                    // Set both dates and now to midnight for date-only comparison
                    const startLocal = new Date(
                        startDate.getFullYear(),
                        startDate.getMonth(),
                        startDate.getDate(),
                        startDate.getHours(),
                        startDate.getMinutes()
                    );
                    const endLocal = new Date(
                        endDate.getFullYear(),
                        endDate.getMonth(),
                        endDate.getDate(),
                        endDate.getHours(),
                        endDate.getMinutes()
                    );
                    const nowLocal = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        now.getDate(),
                        now.getHours(),
                        now.getMinutes()
                    );

                    if (startLocal > nowLocal) {
                        acc.upcoming.push(event);
                    } else if (endLocal < nowLocal) {
                        acc.past.push(event);
                    } else {
                        acc.ongoing.push(event);
                    }
                    return acc;
                },
                {
                    upcoming: [] as Event[],
                    ongoing: [] as Event[],
                    past: [] as Event[],
                }
            );

            // Sort events
            upcoming.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
            ongoing.sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
            past.sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());

            setEvents({
                upcoming: upcoming.slice(0, 50),  // Limit to 50 events per section
                ongoing: ongoing.slice(0, 50),
                past: past.slice(0, 50)
            });
            setLoading(false);
        } catch (error) {
            console.error("Failed to load events:", error);
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <>
                {/* Ongoing Events */}
                <div className="card bg-base-100 shadow-xl border border-base-200 hover:border-primary transition-all duration-300 hover:-translate-y-1 transform mb-4 sm:mb-6 mx-4 sm:mx-6">
                    <div className="card-body p-4 sm:p-6">
                        <h3 className="card-title text-base sm:text-lg mb-3 sm:mb-4">Ongoing Events</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {[...Array(3)].map((_, i) => (
                                <div key={`ongoing-skeleton-${i}`}>{createSkeletonCard()}</div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Upcoming Events */}
                <div className="card bg-base-100 shadow-xl border border-base-200 hover:border-primary transition-all duration-300 hover:-translate-y-1 transform mb-4 sm:mb-6 mx-4 sm:mx-6">
                    <div className="card-body p-4 sm:p-6">
                        <h3 className="card-title text-base sm:text-lg mb-3 sm:mb-4">Upcoming Events</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {[...Array(3)].map((_, i) => (
                                <div key={`upcoming-skeleton-${i}`}>{createSkeletonCard()}</div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Past Events */}
                <div className="card bg-base-100 shadow-xl border border-base-200 hover:border-primary transition-all duration-300 hover:-translate-y-1 transform mx-4 sm:mx-6">
                    <div className="card-body p-4 sm:p-6">
                        <h3 className="card-title text-base sm:text-lg mb-3 sm:mb-4">Past Events</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {[...Array(3)].map((_, i) => (
                                <div key={`past-skeleton-${i}`}>{createSkeletonCard()}</div>
                            ))}
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            {/* Ongoing Events */}
            {events.ongoing.length > 0 && (
                <div className="card bg-base-100 shadow-xl border border-base-200 hover:border-primary transition-all duration-300 hover:-translate-y-1 transform mb-4 sm:mb-6 mx-4 sm:mx-6">
                    <div className="card-body p-4 sm:p-6">
                        <h3 className="card-title text-base sm:text-lg mb-3 sm:mb-4">Ongoing Events</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {events.ongoing.map(renderEventCard)}
                        </div>
                    </div>
                </div>
            )}

            {/* Upcoming Events */}
            {events.upcoming.length > 0 && (
                <div className="card bg-base-100 shadow-xl border border-base-200 hover:border-primary transition-all duration-300 hover:-translate-y-1 transform mb-4 sm:mb-6 mx-4 sm:mx-6">
                    <div className="card-body p-4 sm:p-6">
                        <h3 className="card-title text-base sm:text-lg mb-3 sm:mb-4">Upcoming Events</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {events.upcoming.map(renderEventCard)}
                        </div>
                    </div>
                </div>
            )}

            {/* Past Events */}
            {events.past.length > 0 && (
                <div className="card bg-base-100 shadow-xl border border-base-200 hover:border-primary transition-all duration-300 hover:-translate-y-1 transform mx-4 sm:mx-6">
                    <div className="card-body p-4 sm:p-6">
                        <h3 className="card-title text-base sm:text-lg mb-3 sm:mb-4">Past Events</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {events.past.map(renderEventCard)}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default EventLoad;
