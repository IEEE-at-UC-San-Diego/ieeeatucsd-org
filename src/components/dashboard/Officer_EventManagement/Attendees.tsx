import { useEffect, useState, useMemo, useCallback } from 'react';
import { Get } from '../../../scripts/pocketbase/Get';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { SendLog } from '../../../scripts/pocketbase/SendLog';
import { DataSyncService } from '../../../scripts/database/DataSyncService';
import { Collections } from '../../../schemas/pocketbase/schema';
import { Icon } from "@iconify/react";
import type { Event, AttendeeEntry, User as SchemaUser } from "../../../schemas/pocketbase";

// Extended User interface with additional properties needed for this component
interface User extends SchemaUser {
    member_type: string;
}

// Cache for storing user data
const userCache = new Map<string, {
    data: User;
    timestamp: number;
}>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const ITEMS_PER_PAGE = 50;

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

// Add new interface for selected fields
interface EventFields {
    id: true;
    event_name: true;
    attendees: true;
}

interface UserFields {
    id: true;
    name: true;
    email: true;
    pid: true;
    member_id: true;
    member_type: true;
    graduation_year: true;
    major: true;
}

// Constants for field selection
const EVENT_FIELDS: (keyof EventFields)[] = ['id', 'event_name', 'attendees'];
const USER_FIELDS: (keyof UserFields)[] = ['id', 'name', 'email', 'pid', 'member_id', 'member_type', 'graduation_year', 'major'];

export default function Attendees() {
    const [eventId, setEventId] = useState<string>('');
    const [eventName, setEventName] = useState<string>('');
    const [users, setUsers] = useState<Map<string, User>>(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [attendeesList, setAttendeesList] = useState<AttendeeEntry[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [processedSearchTerms, setProcessedSearchTerms] = useState<string[]>([]);

    const get = Get.getInstance();
    const auth = Authentication.getInstance();

    // Memoize search terms processing
    const updateProcessedSearchTerms = useCallback((searchTerm: string) => {
        const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean);
        setProcessedSearchTerms(terms);
        setCurrentPage(1); // Reset to first page on new search
    }, []);

    // Memoize filtered attendees
    const filteredAttendees = useMemo(() => {
        if (!searchTerm.trim()) return attendeesList;

        return attendeesList.filter(attendee => {
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

            return processedSearchTerms.every(term =>
                searchableValues.some(value => value.includes(term))
            );
        });
    }, [attendeesList, users, processedSearchTerms]);

    // Memoize paginated attendees
    const paginatedAttendees = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAttendees.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredAttendees, currentPage]);

    // Memoize pagination info
    const paginationInfo = useMemo(() => {
        const totalPages = Math.ceil(filteredAttendees.length / ITEMS_PER_PAGE);
        return {
            totalPages,
            hasNextPage: currentPage < totalPages,
            hasPrevPage: currentPage > 1
        };
    }, [filteredAttendees.length, currentPage]);

    // Optimized user data fetching with cache
    const fetchUserData = useCallback(async (userIds: string[]) => {
        const now = Date.now();
        const uncachedIds: string[] = [];
        const cachedUsers = new Map<string, User>();

        // Check cache first
        userIds.forEach(id => {
            const cached = userCache.get(id);
            if (cached && now - cached.timestamp < CACHE_DURATION) {
                cachedUsers.set(id, cached.data);
            } else {
                uncachedIds.push(id);
            }
        });

        // If we have all users in cache, return early
        if (uncachedIds.length === 0) {
            return cachedUsers;
        }

        // Fetch uncached users
        try {
            const dataSync = DataSyncService.getInstance();

            // Sync users collection for the uncached IDs
            if (uncachedIds.length > 0) {
                const idFilter = uncachedIds.map(id => `id = "${id}"`).join(' || ');
                await dataSync.syncCollection(Collections.USERS, idFilter);
            }

            // Get users from IndexedDB
            const users = await Promise.all(
                uncachedIds.map(async id => {
                    try {
                        return await dataSync.getItem<User>(Collections.USERS, id);
                    } catch (error) {
                        console.error(`Failed to fetch user ${id}:`, error);
                        return null;
                    }
                })
            );

            // Update cache and merge with cached users
            users.forEach(user => {
                if (user) {
                    userCache.set(user.id, { data: user, timestamp: now });
                    cachedUsers.set(user.id, user);
                }
            });
        } catch (error) {
            console.error('Failed to fetch uncached users:', error);
        }

        return cachedUsers;
    }, []);

    // Listen for the custom event
    useEffect(() => {
        const handleUpdateAttendees = async (e: CustomEvent<{ eventId: string; eventName: string }>) => {
            setEventId(e.detail.eventId);
            setEventName(e.detail.eventName);
            setCurrentPage(1); // Reset pagination on new event

            // Log the attendees view action
            try {
                const sendLog = SendLog.getInstance();
                await sendLog.send(
                    "view",
                    "event_attendees",
                    `Viewed attendees for event: ${e.detail.eventName}`
                );
            } catch (error) {
                console.error('Failed to log attendees view:', error);
            }
        };

        window.addEventListener('updateAttendees', handleUpdateAttendees as unknown as EventListener);
        return () => {
            window.removeEventListener('updateAttendees', handleUpdateAttendees as unknown as EventListener);
        };
    }, []);

    // Update search terms when search input changes
    useEffect(() => {
        updateProcessedSearchTerms(searchTerm);
    }, [searchTerm, updateProcessedSearchTerms]);

    // Fetch event data when eventId changes
    useEffect(() => {
        let isMounted = true;
        const fetchEventData = async () => {
            if (!eventId || !auth.isAuthenticated()) {
                if (!auth.isAuthenticated()) {
                    console.log('User not authenticated');
                    setError('Authentication required');
                }
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const dataSync = DataSyncService.getInstance();

                // Sync the event data
                await dataSync.syncCollection(Collections.EVENTS, `id = "${eventId}"`);

                // Get the event from IndexedDB
                const event = await dataSync.getItem<Event>(Collections.EVENTS, eventId);

                if (!isMounted) return;

                if (!event) {
                    setError('Event not found');
                    setAttendeesList([]);
                    setUsers(new Map());
                    return;
                }

                if (!event.attendees?.length) {
                    setAttendeesList([]);
                    setUsers(new Map());
                    return;
                }

                setAttendeesList(event.attendees);

                // Fetch user details with cache
                const userIds = [...new Set(event.attendees.map(a => a.user_id))];
                const userMap = await fetchUserData(userIds);

                if (isMounted) {
                    setUsers(userMap);
                }
            } catch (error) {
                if (isMounted) {
                    console.error('Failed to fetch event data:', error);
                    setError('Failed to load event data');
                    setAttendeesList([]);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchEventData();
        return () => { isMounted = false; };
    }, [eventId, auth, fetchUserData]);

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

    // Function to download attendees as CSV
    const downloadAttendeesCSV = () => {
        // Function to sanitize and format CSV cell content
        const escapeCSV = (cell: any): string => {
            // Convert to string and replace any newlines with spaces
            const value = (cell?.toString() || '').replace(/[\r\n]+/g, ' ').trim();

            // If the value contains quotes or commas, wrap in quotes and escape internal quotes
            if (value.includes('"') || value.includes(',')) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        };

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
        ].map(escapeCSV);

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
            ].map(escapeCSV);
        });

        // Combine headers and rows with Windows-style line endings
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\r\n');

        // Create blob with UTF-8 BOM for better Excel compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        // Create filename with date and time
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `${eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_attendees_${timestamp}.csv`;

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up the URL object
    };

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
                <Icon icon="heroicons:exclamation-circle" className="h-6 w-6" />
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
                <Icon icon="heroicons:user-group" className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
                                <Icon icon="heroicons:magnifying-glass" className="h-5 w-5 opacity-70" />
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
                        <Icon icon="heroicons:arrow-down-tray" className="h-4 w-4" />
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

            {/* Table with pagination */}
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
                        {paginatedAttendees.map((attendee, index) => {
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

            {/* Pagination Controls */}
            {paginationInfo.totalPages > 1 && (
                <div className="flex justify-center mt-4">
                    <div className="join">
                        <button
                            className="join-item btn btn-sm"
                            disabled={!paginationInfo.hasPrevPage}
                            onClick={() => setCurrentPage(1)}
                        >
                            «
                        </button>
                        <button
                            className="join-item btn btn-sm"
                            disabled={!paginationInfo.hasPrevPage}
                            onClick={() => setCurrentPage(p => p - 1)}
                        >
                            ‹
                        </button>
                        <button className="join-item btn btn-sm">
                            Page {currentPage} of {paginationInfo.totalPages}
                        </button>
                        <button
                            className="join-item btn btn-sm"
                            disabled={!paginationInfo.hasNextPage}
                            onClick={() => setCurrentPage(p => p + 1)}
                        >
                            ›
                        </button>
                        <button
                            className="join-item btn btn-sm"
                            disabled={!paginationInfo.hasNextPage}
                            onClick={() => setCurrentPage(paginationInfo.totalPages)}
                        >
                            »
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
