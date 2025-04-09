import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { Get } from "../../../scripts/pocketbase/Get";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import { DataSyncService } from "../../../scripts/database/DataSyncService";
import { DexieService } from "../../../scripts/database/DexieService";
import { Collections } from "../../../schemas/pocketbase/schema";
import type { Event, AttendeeEntry, EventAttendee } from "../../../schemas/pocketbase";

// Extended Event interface with additional properties needed for this component
interface ExtendedEvent extends Event {
    description?: string; // This component uses 'description' but schema has 'event_description'
}

declare global {
    interface Window {
        openDetailsModal: (event: ExtendedEvent) => void;
        downloadAllFiles: () => Promise<void>;
        currentEventId: string;
        [key: string]: any;
    }
}
// Helper function to validate event data integrity
const isValidEvent = (event: any): boolean => {
    if (!event || typeof event !== 'object') return false;

    // Check required fields
    if (!event.id || !event.event_name) return false;

    // Validate date fields
    try {
        const startDate = new Date(event.start_date);
        const endDate = new Date(event.end_date);

        // Check if dates are valid
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.warn(`Event ${event.id} has invalid date format`, {
                start: event.start_date,
                end: event.end_date
            });
            return false;
        }

        return true;
    } catch (error) {
        console.warn(`Error validating event ${event?.id || 'unknown'}:`, error);
        return false;
    }
};

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
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

    const toggleDescription = (eventId: string) => {
        setExpandedDescriptions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(eventId)) {
                newSet.delete(eventId);
            } else {
                newSet.add(eventId);
            }
            return newSet;
        });
    };

    // Function to clear the events cache and force a fresh sync
    const refreshEvents = async () => {
        try {
            setRefreshing(true);

            // Get DexieService instance
            const dexieService = DexieService.getInstance();
            const db = dexieService.getDB();

            // Clear events table
            if (db && db.events) {
                // console.log("Clearing events cache...");
                await db.events.clear();
                // console.log("Events cache cleared successfully");
            }

            // Reset sync timestamp for events by updating it to 0
            // First get the current record
            const currentInfo = await dexieService.getLastSync(Collections.EVENTS);
            // Then update it with a timestamp of 0 (forcing a fresh sync)
            await dexieService.updateLastSync(Collections.EVENTS);
            // console.log("Events sync timestamp reset");

            // Reload events
            setLoading(true);
            await loadEvents();

        } catch (error) {
            console.error("Error refreshing events:", error);
            setErrorMessage("Failed to refresh events. Please try again.");
        } finally {
            setRefreshing(false);
        }
    };

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
        try {
            // Get authentication instance
            const auth = Authentication.getInstance();
            const currentUser = auth.getCurrentUser();

            // Check if user has attended this event by querying the event_attendees collection
            let hasAttended = false;
            if (currentUser) {
                // We'll check attendance status when displaying the card
                // This will be done asynchronously after rendering
                setTimeout(async () => {
                    try {
                        const get = Get.getInstance();
                        const attendees = await get.getList<EventAttendee>(
                            Collections.EVENT_ATTENDEES,
                            1,
                            1,
                            `user="${currentUser.id}" && event="${event.id}"`
                        );

                        const hasAttendedEvent = attendees.totalItems > 0;

                        // Store the attendance status in the window object with the event
                        const eventDataId = `event_${event.id}`;
                        if (window[eventDataId]) {
                            window[eventDataId].hasAttended = hasAttendedEvent;
                        }

                        // Update the card UI based on attendance status
                        const cardElement = document.getElementById(`event-card-${event.id}`);
                        if (cardElement) {
                            const attendedBadge = document.getElementById(`attendance-badge-${event.id}`);
                            if (attendedBadge && hasAttendedEvent) {
                                attendedBadge.classList.remove('badge-ghost');
                                attendedBadge.classList.add('badge-success');

                                // Update the icon and text
                                const icon = attendedBadge.querySelector('svg');
                                if (icon) {
                                    icon.setAttribute('icon', 'heroicons:check-circle');
                                }

                                // Update the text content
                                attendedBadge.textContent = '';

                                // Recreate the icon
                                const iconElement = document.createElement('span');
                                iconElement.className = 'h-3 w-3';
                                iconElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10s-4.477 10-10 10zm-.997-6l7.07-7.071l-1.414-1.414l-5.656 5.657l-2.829-2.829l-1.414 1.414L11.003 16z"/></svg>';
                                attendedBadge.appendChild(iconElement);

                                // Add the text
                                const textNode = document.createTextNode(' Attended');
                                attendedBadge.appendChild(textNode);
                            }
                        }
                    } catch (error) {
                        console.error("Error checking attendance status:", error);
                    }
                }, 0);
            }

            // Store event data in window object with unique ID
            const eventDataId = `event_${event.id}`;
            window[eventDataId] = event;

            const startDate = new Date(event.start_date);
            const endDate = new Date(event.end_date);
            const now = new Date();
            const isPastEvent = endDate < now;
            const isExpanded = expandedDescriptions.has(event.id);
            const description = event.event_description || "No description available";

            return (
                <div id={`event-card-${event.id}`} key={event.id} className="card bg-base-200 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                    <div className="card-body p-4">
                        {/* Event Header */}
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="card-title text-base sm:text-lg font-semibold line-clamp-2">{event.event_name}</h3>
                            <div className="badge badge-primary badge-sm flex-shrink-0">{event.points_to_reward} pts</div>
                        </div>

                        {/* Event Description */}
                        <div className="mb-3">
                            <p className={`text-xs sm:text-sm text-base-content/70 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                {description}
                            </p>
                            {description.length > 80 && (
                                <button
                                    onClick={() => toggleDescription(event.id)}
                                    className="text-xs text-primary hover:text-primary-focus mt-1 flex items-center"
                                >
                                    {isExpanded ? (
                                        <>
                                            <Icon icon="heroicons:chevron-up" className="h-3 w-3 mr-1" />
                                            Show less
                                        </>
                                    ) : (
                                        <>
                                            <Icon icon="heroicons:chevron-down" className="h-3 w-3 mr-1" />
                                            Show more
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Event Details */}
                        <div className="grid grid-cols-1 gap-1 mb-3 text-xs sm:text-sm">
                            <div className="flex items-center gap-2">
                                <Icon icon="heroicons:calendar" className="h-3.5 w-3.5 text-primary" />
                                <span>
                                    {startDate.toLocaleDateString("en-US", {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                    })}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Icon icon="heroicons:clock" className="h-3.5 w-3.5 text-primary" />
                                <span>
                                    {startDate.toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                    })}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Icon icon="heroicons:map-pin" className="h-3.5 w-3.5 text-primary" />
                                <span className="line-clamp-1">{event.location || "No location specified"}</span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 mt-auto">
                            {event.files && event.files.length > 0 && (
                                <button
                                    onClick={() => window.openDetailsModal(event as ExtendedEvent)}
                                    className="btn btn-accent btn-sm text-xs sm:text-sm gap-1 h-8 min-h-0 px-3 shadow-md hover:shadow-lg transition-all duration-300 rounded-full"
                                >
                                    <Icon icon="heroicons:document-duplicate" className="h-3 w-3 sm:h-4 sm:w-4" />
                                    Files ({event.files.length})
                                </button>
                            )}
                            {isPastEvent && (
                                <div id={`attendance-badge-${event.id}`} className={`badge ${hasAttended ? 'badge-success' : 'badge-ghost'} text-xs gap-1 ml-auto`}>
                                    <Icon
                                        icon={hasAttended ? "heroicons:check-circle" : "heroicons:x-circle"}
                                        className="h-3 w-3"
                                    />
                                    {hasAttended ? 'Attended' : 'Not Attended'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        } catch (error) {
            console.error("Error rendering event card:", error);
            return null;
        }
    };

    const loadEvents = async () => {
        try {
            const get = Get.getInstance();
            const dataSync = DataSyncService.getInstance();
            const auth = Authentication.getInstance();

            // console.log("Starting to load events...");

            // Check if user is authenticated
            if (!auth.isAuthenticated()) {
                // Silently return without error when on dashboard page
                if (window.location.pathname.includes('/dashboard')) {
                    setLoading(false);
                    return;
                }
                console.error("User not authenticated, cannot load events");
                setLoading(false);
                return;
            }

            // Force sync to ensure we have the latest data
            // console.log("Syncing events collection...");
            let syncSuccess = false;
            let retryCount = 0;
            const maxRetries = 3;

            while (!syncSuccess && retryCount < maxRetries) {
                try {
                    if (retryCount > 0) {
                        // console.log(`Retry attempt ${retryCount} of ${maxRetries}...`);
                        // Add a small delay between retries
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                    }

                    await dataSync.syncCollection(Collections.EVENTS, "published = true", "-start_date");
                    // console.log("Events collection synced successfully");
                    syncSuccess = true;
                } catch (syncError) {
                    retryCount++;
                    console.error(`Error syncing events collection (attempt ${retryCount}/${maxRetries}):`, syncError);

                    if (retryCount >= maxRetries) {
                        console.warn("Max retry attempts reached, continuing with local data");
                    }
                }
            }

            // Get events from IndexedDB
            // console.log("Fetching events from IndexedDB...");
            const allEvents = await dataSync.getData<Event>(
                Collections.EVENTS,
                false, // Don't force sync again
                "published = true",
                "-start_date"
            );

            // console.log(`Retrieved ${allEvents.length} events from IndexedDB`);

            // Filter out invalid events
            const validEvents = allEvents.filter(event => isValidEvent(event));
            // console.log(`Filtered out ${allEvents.length - validEvents.length} invalid events`);

            // If no valid events found in IndexedDB, try fetching directly from PocketBase as fallback
            let eventsToProcess = validEvents;
            if (allEvents.length === 0) {
                // console.log("No events found in IndexedDB, trying direct PocketBase fetch...");
                try {
                    const pbEvents = await get.getAll<Event>(
                        Collections.EVENTS,
                        "published = true",
                        "-start_date"
                    );
                    // console.log(`Retrieved ${pbEvents.length} events directly from PocketBase`);

                    // Filter out invalid events from PocketBase results
                    const validPbEvents = pbEvents.filter(event => isValidEvent(event));
                    // console.log(`Filtered out ${pbEvents.length - validPbEvents.length} invalid events from PocketBase`);

                    eventsToProcess = validPbEvents;

                    // Store these events in IndexedDB for future use
                    if (validPbEvents.length > 0) {
                        const dexieService = DexieService.getInstance();
                        const db = dexieService.getDB();
                        if (db && db.events) {
                            // console.log(`Storing ${validPbEvents.length} valid PocketBase events in IndexedDB...`);
                            await db.events.bulkPut(validPbEvents);
                        }
                    }
                } catch (pbError) {
                    console.error("Error fetching events from PocketBase:", pbError);
                }
            }

            // Split events into upcoming, ongoing, and past based on start and end dates
            // console.log("Categorizing events...");
            const now = new Date();
            const { upcoming, ongoing, past } = eventsToProcess.reduce(
                (acc, event) => {
                    try {
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
                    } catch (dateError) {
                        console.error("Error processing event dates:", dateError, event);
                        // If we can't process dates properly, put in past events as fallback
                        acc.past.push(event);
                    }
                    return acc;
                },
                {
                    upcoming: [] as Event[],
                    ongoing: [] as Event[],
                    past: [] as Event[],
                }
            );

            // console.log(`Categorized events: ${upcoming.length} upcoming, ${ongoing.length} ongoing, ${past.length} past`);

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

            // Attempt to diagnose the error
            if (error instanceof Error) {
                console.error(`Error type: ${error.name}, Message: ${error.message}`);
                console.error(`Stack trace: ${error.stack}`);

                // Check for network-related errors
                if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('connection')) {
                    console.error("Network-related error detected");

                    // Try to load from IndexedDB only as a last resort
                    try {
                        // console.log("Attempting to load events from IndexedDB only...");
                        const dexieService = DexieService.getInstance();
                        const db = dexieService.getDB();
                        if (db && db.events) {
                            const allCachedEvents = await db.events.filter(event => event.published === true).toArray();
                            // console.log(`Found ${allCachedEvents.length} cached events in IndexedDB`);

                            // Filter out invalid events
                            const cachedEvents = allCachedEvents.filter(event => isValidEvent(event));
                            // console.log(`Filtered out ${allCachedEvents.length - cachedEvents.length} invalid cached events`);

                            if (cachedEvents.length > 0) {
                                // Process these events
                                const now = new Date();
                                const { upcoming, ongoing, past } = cachedEvents.reduce(
                                    (acc, event) => {
                                        try {
                                            const startDate = new Date(event.start_date);
                                            const endDate = new Date(event.end_date);

                                            if (startDate > now) {
                                                acc.upcoming.push(event);
                                            } else if (endDate < now) {
                                                acc.past.push(event);
                                            } else {
                                                acc.ongoing.push(event);
                                            }
                                        } catch (e) {
                                            acc.past.push(event);
                                        }
                                        return acc;
                                    },
                                    {
                                        upcoming: [] as Event[],
                                        ongoing: [] as Event[],
                                        past: [] as Event[],
                                    }
                                );

                                // Sort and set events
                                upcoming.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
                                ongoing.sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
                                past.sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());

                                setEvents({
                                    upcoming: upcoming.slice(0, 50),
                                    ongoing: ongoing.slice(0, 50),
                                    past: past.slice(0, 50)
                                });
                                // console.log("Successfully loaded events from cache");
                            }
                        }
                    } catch (cacheError) {
                        console.error("Failed to load events from cache:", cacheError);
                    }
                }
            }

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

    // Check if there are no events at all
    const noEvents = events.ongoing.length === 0 && events.upcoming.length === 0 && events.past.length === 0;

    return (
        <>
            {/* No Events Message */}
            {noEvents && (
                <div className="card bg-base-100 shadow-xl border border-base-200 mx-4 sm:mx-6 p-8">
                    <div className="text-center">
                        <Icon icon="heroicons:calendar" className="w-16 h-16 mx-auto text-base-content/30 mb-4" />
                        <h3 className="text-xl font-bold mb-2">No Events Found</h3>
                        <p className="text-base-content/70 mb-4">
                            There are currently no events to display. This could be due to:
                        </p>
                        <ul className="list-disc text-left max-w-md mx-auto text-base-content/70 mb-6">
                            <li className="mb-1">No events have been published yet</li>
                            <li className="mb-1">There might be a connection issue with the event database</li>
                            <li className="mb-1">The events data might be temporarily unavailable</li>
                        </ul>
                        <button
                            onClick={refreshEvents}
                            className="btn btn-primary"
                            disabled={refreshing}
                        >
                            {refreshing ? (
                                <>
                                    <Icon icon="heroicons:arrow-path" className="w-5 h-5 mr-2 animate-spin" />
                                    Refreshing...
                                </>
                            ) : (
                                <>
                                    <Icon icon="heroicons:arrow-path" className="w-5 h-5 mr-2" />
                                    Refresh Events
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

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
