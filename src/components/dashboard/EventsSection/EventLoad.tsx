import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { Get } from "../../../scripts/pocketbase/Get";

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

        // Store event data in window object with unique ID
        const eventDataId = `event_${event.id}`;
        window[eventDataId] = event;

        return (
            <div key={event.id} className="card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                <div className="card-body p-5">
                    <div className="flex flex-col h-full">
                        <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1">
                                <h3 className="card-title text-lg font-semibold mb-1 line-clamp-2">{event.event_name}</h3>
                                <div className="flex items-center gap-2 text-sm text-base-content/70">
                                    <div className="badge badge-primary badge-sm">{event.points_to_reward} pts</div>
                                </div>
                            </div>
                            <div className="text-right shrink-0 text-base-content/80">
                                <div className="text-sm font-medium">
                                    {startDate.toLocaleDateString("en-US", {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                    })}
                                </div>
                                <div className="text-xs mt-0.5 opacity-75">
                                    {startDate.toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="text-sm text-base-content/70 mb-3 line-clamp-2">
                            {event.description || "No description available"}
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-base-content/80">
                                <Icon icon="mdi:map-marker" className="w-4 h-4 text-primary shrink-0" />
                                <span className="text-sm">{event.location}</span>
                            </div>
                            {isPastEvent && event.files && event.files.length > 0 && (
                                <button
                                    onClick={() => window.openDetailsModal(event)}
                                    className="btn btn-sm btn-primary w-[90px] inline-flex items-center justify-center"
                                >
                                    <div className="flex items-center gap-1">
                                        <Icon icon="mdi:file-document-outline" className="w-4 h-4" />
                                        <span>Files</span>
                                    </div>
                                </button>
                            )}
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
                "-start_date"
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

            setEvents({ upcoming, ongoing, past });
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
                <div className="card bg-base-100 shadow-xl border border-base-200 hover:border-primary transition-all duration-300 hover:-translate-y-1 transform mb-6">
                    <div className="card-body">
                        <h3 className="card-title mb-4">Ongoing Events</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[...Array(3)].map((_, i) => (
                                <div key={`ongoing-skeleton-${i}`}>{createSkeletonCard()}</div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Upcoming Events */}
                <div className="card bg-base-100 shadow-xl border border-base-200 hover:border-primary transition-all duration-300 hover:-translate-y-1 transform mb-6">
                    <div className="card-body">
                        <h3 className="card-title mb-4">Upcoming Events</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[...Array(3)].map((_, i) => (
                                <div key={`upcoming-skeleton-${i}`}>{createSkeletonCard()}</div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Past Events */}
                <div className="card bg-base-100 shadow-xl border border-base-200 hover:border-primary transition-all duration-300 hover:-translate-y-1 transform">
                    <div className="card-body">
                        <h3 className="card-title mb-4">Past Events</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <div className="card bg-base-100 shadow-xl border border-base-200 hover:border-primary transition-all duration-300 hover:-translate-y-1 transform mb-6">
                    <div className="card-body">
                        <h3 className="card-title mb-4">Ongoing Events</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {events.ongoing.map(renderEventCard)}
                        </div>
                    </div>
                </div>
            )}

            {/* Upcoming Events */}
            {events.upcoming.length > 0 && (
                <div className="card bg-base-100 shadow-xl border border-base-200 hover:border-primary transition-all duration-300 hover:-translate-y-1 transform mb-6">
                    <div className="card-body">
                        <h3 className="card-title mb-4">Upcoming Events</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {events.upcoming.map(renderEventCard)}
                        </div>
                    </div>
                </div>
            )}

            {/* Past Events */}
            {events.past.length > 0 && (
                <div className="card bg-base-100 shadow-xl border border-base-200 hover:border-primary transition-all duration-300 hover:-translate-y-1 transform">
                    <div className="card-body">
                        <h3 className="card-title mb-4">Past Events</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {events.past.map(renderEventCard)}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default EventLoad;
