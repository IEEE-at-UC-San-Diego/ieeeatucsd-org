import { useEffect, useState } from 'react';
import { Get } from '../../../scripts/pocketbase/Get';
import { Authentication } from '../../../scripts/pocketbase/Authentication';

// Add HighlightText component
const HighlightText = ({ text, searchTerms }: { text: string | number | null | undefined, searchTerms: string[] }) => {
    // Convert input to string and handle null/undefined
    const textStr = String(text ?? '');

    if (!searchTerms.length || !textStr) return <>{textStr}</>;

    try {
        const escapedTerms = searchTerms.map(term =>
            term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        );
        const parts = textStr.split(new RegExp(`(${escapedTerms.join('|')})`, 'gi'));

        return (
            <>
                {parts.map((part, i) => {
                    const isMatch = searchTerms.some(term =>
                        part.toLowerCase().includes(term.toLowerCase())
                    );
                    return isMatch ? (
                        <mark key={i} className="bg-primary/20 rounded px-1">{part}</mark>
                    ) : (
                        <span key={i}>{part}</span>
                    );
                })}
            </>
        );
    } catch (error) {
        console.error('Error in HighlightText:', error);
        return <>{textStr}</>;
    }
};

interface AttendeeEntry {
    user_id: string;
    time_checked_in: string;
    food: string;
}

interface User {
    id: string;
    name: string;
    email: string;
    pid: string;
    member_id: string;
    member_type: string;
    graduation_year: string;
    major: string;
}

interface Event {
    id: string;
    event_name: string;
    attendees: AttendeeEntry[];
}

export default function Attendees() {
    const [eventId, setEventId] = useState<string>('');
    const [eventName, setEventName] = useState<string>('');
    const [users, setUsers] = useState<Map<string, User>>(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attendeesList, setAttendeesList] = useState<AttendeeEntry[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredAttendees, setFilteredAttendees] = useState<AttendeeEntry[]>([]);
    const [processedSearchTerms, setProcessedSearchTerms] = useState<string[]>([]);

    const get = Get.getInstance();
    const auth = Authentication.getInstance();

    // Listen for the custom event
    useEffect(() => {
        const handleUpdateAttendees = (e: CustomEvent<{ eventId: string; eventName: string }>) => {
            console.log('Received updateAttendees event:', e.detail);
            setEventId(e.detail.eventId);
            setEventName(e.detail.eventName);
        };

        // Add event listener
        window.addEventListener('updateAttendees', handleUpdateAttendees as EventListener);

        // Cleanup
        return () => {
            window.removeEventListener('updateAttendees', handleUpdateAttendees as EventListener);
        };
    }, []);

    // Filter attendees when search term or attendees list changes
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredAttendees(attendeesList);
            setProcessedSearchTerms([]);
            return;
        }

        const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
        setProcessedSearchTerms(terms);

        const filtered = attendeesList.filter(attendee => {
            const user = users.get(attendee.user_id);
            if (!user) return false;

            const searchableValues = [
                user.name,
                user.email,
                user.pid,
                user.member_id,
                user.member_type,
                user.graduation_year,
                user.major,
                attendee.food,
                new Date(attendee.time_checked_in).toLocaleString(),
            ].map(value => (value || '').toString().toLowerCase());

            return terms.every(term =>
                searchableValues.some(value => value.includes(term))
            );
        });

        setFilteredAttendees(filtered);
    }, [searchTerm, attendeesList, users]);

    // Function to download attendees as CSV
    const downloadAttendeesCSV = () => {
        // Create CSV headers
        const headers = [
            'Name',
            'Email',
            'PID',
            'Member ID',
            'Member Type',
            'Graduation Year',
            'Major',
            'Check-in Time',
            'Food Choice'
        ];

        // Create CSV rows
        const rows = attendeesList.map(attendee => {
            const user = users.get(attendee.user_id);
            const checkInTime = new Date(attendee.time_checked_in).toLocaleString();
            return [
                user?.name || 'Unknown User',
                user?.email || 'N/A',
                user?.pid || 'N/A',
                user?.member_id || 'N/A',
                user?.member_type || 'N/A',
                user?.graduation_year || 'N/A',
                user?.major || 'N/A',
                checkInTime,
                attendee.food || 'N/A'
            ];
        });

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `${eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_attendees.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

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
        <div className="flex flex-col h-[calc(100vh-16rem)]">
            <div className="flex flex-col gap-4 mb-4">
                {/* Search and Actions Row */}
                <div className="flex justify-between items-center gap-4">
                    <div className="flex-1 flex gap-2">
                        <div className="join flex-1">
                            <div className="join-item bg-base-200 flex items-center px-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 opacity-70" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search attendees..."
                                className="input input-bordered join-item w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <button
                        className="btn btn-primary btn-sm gap-2"
                        onClick={downloadAttendeesCSV}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Download CSV
                    </button>
                </div>

                {/* Stats Row */}
                <div className="flex justify-between items-center">
                    <div className="text-sm opacity-70">
                        Total Attendees: {attendeesList.length}
                    </div>
                    {searchTerm && (
                        <div className="text-sm opacity-70">
                            Showing: {filteredAttendees.length} matches
                        </div>
                    )}
                </div>
            </div>

            {/* Updated table with highlighting */}
            <div className="overflow-x-auto flex-1">
                <table className="table table-zebra w-full">
                    <thead className="sticky top-0 bg-base-100">
                        <tr>
                            <th className="bg-base-100">Name</th>
                            <th className="bg-base-100">Email</th>
                            <th className="bg-base-100">PID</th>
                            <th className="bg-base-100">Member ID</th>
                            <th className="bg-base-100">Member Type</th>
                            <th className="bg-base-100">Graduation Year</th>
                            <th className="bg-base-100">Major</th>
                            <th className="bg-base-100">Check-in Time</th>
                            <th className="bg-base-100">Food Choice</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAttendees.map((attendee, index) => {
                            const user = users.get(attendee.user_id);
                            const checkInTime = new Date(attendee.time_checked_in).toLocaleString();

                            return (
                                <tr key={`${attendee.user_id}-${index}`}>
                                    <td><HighlightText text={user?.name || 'Unknown User'} searchTerms={processedSearchTerms} /></td>
                                    <td><HighlightText text={user?.email || 'N/A'} searchTerms={processedSearchTerms} /></td>
                                    <td><HighlightText text={user?.pid || 'N/A'} searchTerms={processedSearchTerms} /></td>
                                    <td><HighlightText text={user?.member_id || 'N/A'} searchTerms={processedSearchTerms} /></td>
                                    <td><HighlightText text={user?.member_type || 'N/A'} searchTerms={processedSearchTerms} /></td>
                                    <td><HighlightText text={user?.graduation_year || 'N/A'} searchTerms={processedSearchTerms} /></td>
                                    <td><HighlightText text={user?.major || 'N/A'} searchTerms={processedSearchTerms} /></td>
                                    <td><HighlightText text={checkInTime} searchTerms={processedSearchTerms} /></td>
                                    <td><HighlightText text={attendee.food || 'N/A'} searchTerms={processedSearchTerms} /></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
