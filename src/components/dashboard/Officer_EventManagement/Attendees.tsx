import { useEffect, useState } from 'react';
import { Get } from '../../pocketbase/Get';
import { Authentication } from '../../pocketbase/Authentication';

interface AttendeeEntry {
    user_id: string;
    time_checked_in: string;
    food: string;
}

interface User {
    id: string;
    name: string;
    email: string;
}

interface Event {
    id: string;
    attendees: AttendeeEntry[];
}

export default function Attendees() {
    const [eventId, setEventId] = useState<string>('');
    const [users, setUsers] = useState<Map<string, User>>(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attendeesList, setAttendeesList] = useState<AttendeeEntry[]>([]);

    const get = Get.getInstance();
    const auth = Authentication.getInstance();

    // Listen for the custom event
    useEffect(() => {
        const handleUpdateAttendees = (e: CustomEvent<{ eventId: string; eventName: string }>) => {
            console.log('Received updateAttendees event:', e.detail);
            setEventId(e.detail.eventId);
        };

        // Add event listener
        window.addEventListener('updateAttendees', handleUpdateAttendees as EventListener);

        // Cleanup
        return () => {
            window.removeEventListener('updateAttendees', handleUpdateAttendees as EventListener);
        };
    }, []);

    // Fetch event data when eventId changes
    useEffect(() => {
        const fetchEventData = async () => {
            if (!eventId) {
                console.log('No eventId provided');
                return;
            }

            if (!auth.isAuthenticated()) {
                console.log('User not authenticated');
                setError('Authentication required');
                return;
            }

            try {
                setLoading(true);
                setError(null);

                console.log('Fetching event data for:', eventId);
                const event = await get.getOne<Event>('events', eventId);

                if (!event.attendees || !Array.isArray(event.attendees)) {
                    console.log('No attendees found or invalid format');
                    setAttendeesList([]);
                    return;
                }

                console.log('Found attendees:', {
                    count: event.attendees.length,
                    sample: event.attendees.slice(0, 2)
                });
                setAttendeesList(event.attendees);

                // Fetch user details
                const userIds = [...new Set(event.attendees.map(a => a.user_id))];
                console.log('Fetching details for users:', userIds);

                const userPromises = userIds.map(async (userId) => {
                    try {
                        return await get.getOne<User>('users', userId);
                    } catch (error) {
                        console.error(`Failed to fetch user ${userId}:`, error);
                        return null;
                    }
                });

                const userResults = await Promise.all(userPromises);
                const userMap = new Map<string, User>();

                userResults.forEach(user => {
                    if (user) {
                        userMap.set(user.id, user);
                    }
                });

                console.log('Fetched user details:', {
                    totalUsers: userMap.size,
                    userIds: Array.from(userMap.keys())
                });
                setUsers(userMap);
            } catch (error) {
                console.error('Failed to fetch event data:', error);
                setError('Failed to load event data');
                setAttendeesList([]);
            } finally {
                setLoading(false);
            }
        };

        fetchEventData();
    }, [eventId]); // Re-run when eventId changes

    // Reset state when modal is closed
    useEffect(() => {
        const handleModalClose = () => {
            setEventId('');
            setAttendeesList([]);
            setUsers(new Map());
            setError(null);
        };

        const modal = document.getElementById('attendeesModal');
        if (modal) {
            modal.addEventListener('close', handleModalClose);
            return () => modal.removeEventListener('close', handleModalClose);
        }
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="alert alert-error">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
            </div>
        );
    }

    if (!eventId) {
        return null;
    }

    if (!attendeesList || attendeesList.length === 0) {
        return (
            <div className="text-center py-8 text-base-content/70">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 opacity-50" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                <p>No attendees yet</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <div className="mb-4 text-sm opacity-70">
                Total Attendees: {attendeesList.length}
            </div>
            <table className="table table-zebra w-full">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Check-in Time</th>
                        <th>Food Choice</th>
                    </tr>
                </thead>
                <tbody>
                    {attendeesList.map((attendee, index) => {
                        const user = users.get(attendee.user_id);
                        const checkInTime = new Date(attendee.time_checked_in).toLocaleString();

                        return (
                            <tr key={`${attendee.user_id}-${index}`}>
                                <td>{user?.name || 'Unknown User'}</td>
                                <td>{user?.email || 'N/A'}</td>
                                <td>{checkInTime}</td>
                                <td>{attendee.food || 'N/A'}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
