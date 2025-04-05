import { useState, useEffect } from 'react';
import { Get } from '../../../scripts/pocketbase/Get';
import { Collections } from '../../../schemas/pocketbase/schema';
import type { Event, EventAttendee } from '../../../schemas/pocketbase/schema';
import { Authentication } from '../../../scripts/pocketbase/Authentication';

export default function EventTimeline() {
    const [events, setEvents] = useState<Event[]>([]);
    const [attendeesByEvent, setAttendeesByEvent] = useState<Map<string, number>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<number | string>(30); // Default to 30 days

    const get = Get.getInstance();
    const auth = Authentication.getInstance();

    useEffect(() => {
        // Listen for analytics data updates from the parent component
        const handleAnalyticsUpdate = (event: CustomEvent) => {
            const { events, attendees, timeRange } = event.detail;
            setTimeRange(timeRange);
            processData(events, attendees);
        };

        window.addEventListener('analyticsDataUpdated', handleAnalyticsUpdate as EventListener);

        // Initial data load
        loadData();

        return () => {
            window.removeEventListener('analyticsDataUpdated', handleAnalyticsUpdate as EventListener);
        };
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);

            // Calculate date range
            const endDate = new Date();
            let startDate;

            if (timeRange === "all") {
                startDate = new Date(0); // Beginning of time
            } else {
                startDate = new Date();
                startDate.setDate(startDate.getDate() - (typeof timeRange === 'number' ? timeRange : 30));
            }

            // Format dates for filter
            const startDateStr = startDate.toISOString();
            const endDateStr = endDate.toISOString();

            // Build filter
            const filter = timeRange === "all"
                ? "published = true"
                : `published = true && start_date >= "${startDateStr}" && start_date <= "${endDateStr}"`;

            // Get events
            const events = await get.getAll<Event>(Collections.EVENTS, filter, "start_date");

            // Get event attendees
            const attendeesFilter = timeRange === "all"
                ? ""
                : `time_checked_in >= "${startDateStr}" && time_checked_in <= "${endDateStr}"`;

            const attendees = await get.getAll<EventAttendee>(Collections.EVENT_ATTENDEES, attendeesFilter);

            processData(events, attendees);
        } catch (err) {
            console.error('Error loading event timeline data:', err);
            setError('Failed to load event timeline data');
        } finally {
            setLoading(false);
        }
    };

    const processData = (events: Event[], attendees: EventAttendee[]) => {
        if (!events || events.length === 0) {
            setEvents([]);
            setAttendeesByEvent(new Map());
            return;
        }

        // Sort events by date (newest first)
        const sortedEvents = [...events].sort((a, b) => {
            return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
        });

        // Count attendees per event
        const attendeesByEvent = new Map<string, number>();
        attendees.forEach(attendee => {
            if (!attendeesByEvent.has(attendee.event)) {
                attendeesByEvent.set(attendee.event, 0);
            }
            attendeesByEvent.set(attendee.event, attendeesByEvent.get(attendee.event)! + 1);
        });

        setEvents(sortedEvents);
        setAttendeesByEvent(attendeesByEvent);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (startDate: string, endDate: string) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const durationMs = end.getTime() - start.getTime();
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

        if (hours === 0) {
            return `${minutes} min`;
        } else if (minutes === 0) {
            return `${hours} hr`;
        } else {
            return `${hours} hr ${minutes} min`;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="alert alert-error">
                <div className="flex-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <label>{error}</label>
                </div>
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-base-content/70">No events found for the selected time period</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="table w-full">
                <thead>
                    <tr>
                        <th>Event Name</th>
                        <th>Date</th>
                        <th>Duration</th>
                        <th>Location</th>
                        <th>Attendees</th>
                        <th>Food</th>
                    </tr>
                </thead>
                <tbody>
                    {events.map(event => (
                        <tr key={event.id} className="hover">
                            <td className="font-medium">{event.event_name}</td>
                            <td>{formatDate(event.start_date)}</td>
                            <td>{formatDuration(event.start_date, event.end_date)}</td>
                            <td>{event.location}</td>
                            <td>
                                <div className="badge badge-primary">
                                    {attendeesByEvent.get(event.id) || 0}
                                </div>
                            </td>
                            <td>
                                {event.has_food ? (
                                    <div className="badge badge-success">Yes</div>
                                ) : (
                                    <div className="badge badge-ghost">No</div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}