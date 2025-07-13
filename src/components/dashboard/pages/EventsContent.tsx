import React, { useState, useEffect } from 'react';
import { Search, Calendar, Bell, User, Filter, MapPin, Clock, Users, UserCheck, X, Award } from 'lucide-react';
import { getFirestore, collection, getDocs, query, where, orderBy, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '../../../firebase/client';

interface Event {
    id: string;
    eventName: string;
    eventDescription: string;
    location: string;
    startDate: any;
    endDate: any;
    pointsToReward: number;
    attendees?: string[];
    published: boolean;
    capacity?: number;
    eventCode: string;
}

interface UserStats {
    lastEventAttended: string;
    totalPointsEarned: number;
    totalEventsAttended: number;
}

export default function EventsContent() {
    const [events, setEvents] = useState<Event[]>([]);
    const [userStats, setUserStats] = useState<UserStats>({
        lastEventAttended: 'None',
        totalPointsEarned: 0,
        totalEventsAttended: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [checkingIn, setCheckingIn] = useState<string | null>(null);

    const db = getFirestore(app);
    const auth = getAuth(app);
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (currentUser) {
            fetchEvents();
            fetchUserStats();
        }
    }, [currentUser]);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            setError(null);

            const eventsRef = collection(db, 'events');
            // Try to fetch published events, but handle the case where there might be no published field
            let eventsSnapshot;
            try {
                const eventsQuery = query(
                    eventsRef,
                    where('published', '==', true),
                    orderBy('startDate', 'asc')
                );
                eventsSnapshot = await getDocs(eventsQuery);
            } catch (queryError) {
                console.warn('Failed to query with published filter, fetching all events:', queryError);
                // Fallback: get all events if the published field doesn't exist
                eventsSnapshot = await getDocs(eventsRef);
            }

            const eventsData = eventsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Ensure all required fields have defaults
                    published: data.published ?? true,
                    pointsToReward: data.pointsToReward ?? 0,
                    attendees: data.attendees ?? []
                };
            }) as Event[];

            // Filter for published events if the field exists
            const publishedEvents = eventsData.filter(event => event.published);

            console.log('Fetched published events:', publishedEvents.length, publishedEvents);
            setEvents(publishedEvents);
        } catch (error) {
            console.error('Error fetching events:', error);
            setError('Failed to fetch events');
        } finally {
            setLoading(false);
        }
    };

    const fetchUserStats = async () => {
        if (!currentUser) return;

        try {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                setUserStats({
                    lastEventAttended: userData.lastEventAttended || 'None',
                    totalPointsEarned: userData.points || 0,
                    totalEventsAttended: userData.eventsAttended || 0
                });
            }
        } catch (error) {
            console.error('Error fetching user stats:', error);
        }
    };

    const handleCheckIn = async (eventId: string, eventName: string, points: number) => {
        if (!currentUser) {
            setError('Please log in to check in');
            return;
        }

        try {
            setCheckingIn(eventId);

            // Update event with user check-in
            const eventRef = doc(db, 'events', eventId);
            await updateDoc(eventRef, {
                attendees: arrayUnion(currentUser.uid)
            });

            // Update user with event attendance and points
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                lastEventAttended: eventName,
                points: userStats.totalPointsEarned + points,
                eventsAttended: userStats.totalEventsAttended + 1
            });

            // Refresh user stats
            fetchUserStats();

            // Show success message (you could add a toast notification here)
            alert(`Successfully checked in to ${eventName}! You earned ${points} points.`);

        } catch (error) {
            console.error('Error checking in:', error);
            setError('Failed to check in to event');
        } finally {
            setCheckingIn(null);
        }
    };

    const getUpcomingEvents = () => {
        const now = new Date();
        return events.filter(event => {
            const eventDate = event.startDate?.toDate?.() || new Date(event.startDate);
            return eventDate >= now;
        });
    };

    const getPastEvents = () => {
        const now = new Date();
        return events.filter(event => {
            const eventDate = event.endDate?.toDate?.() || event.startDate?.toDate?.() || new Date(event.startDate);
            return eventDate < now;
        });
    };

    const getFilteredEvents = (eventsList: Event[]) => {
        if (!searchTerm) return eventsList;

        return eventsList.filter(event =>
            event.eventName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            event.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
            event.eventDescription.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    const isUserCheckedIn = (event: Event) => {
        return currentUser && event.attendees?.includes(currentUser.uid);
    };

    const upcomingEvents = getFilteredEvents(getUpcomingEvents());
    const pastEvents = getFilteredEvents(getPastEvents());

    return (
        <div className="flex-1 overflow-auto">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search events..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Calendar className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Bell className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <User className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Events Content */}
            <main className="p-6">
                <div className="grid grid-cols-1 gap-6">
                    {/* Page Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Events</h1>
                            <p className="text-gray-600">View IEEE UCSD events and check in to earn points</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                <Filter className="w-4 h-4" />
                                <span>Filter</span>
                            </button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-700">{error}</p>
                        </div>
                    )}

                    {/* User Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Last Event Attended</p>
                                    <p className="text-lg font-bold text-gray-900 truncate">{userStats.lastEventAttended}</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Calendar className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Total Points Earned</p>
                                    <p className="text-2xl font-bold text-green-600">{userStats.totalPointsEarned}</p>
                                </div>
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <Award className="w-6 h-6 text-green-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Total Events Attended</p>
                                    <p className="text-2xl font-bold text-purple-600">{userStats.totalEventsAttended}</p>
                                </div>
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                    <Users className="w-6 h-6 text-purple-600" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
                            <p className="text-gray-500">Loading events...</p>
                        </div>
                    ) : (
                        <>
                            {/* Upcoming Events */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Events ({upcomingEvents.length})</h2>
                                {upcomingEvents.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No upcoming events found</p>
                                ) : (
                                    <div className="space-y-4">
                                        {upcomingEvents.map((event) => (
                                            <div
                                                key={event.id}
                                                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                                                onClick={() => setSelectedEvent(event)}
                                            >
                                                <div className="flex items-center space-x-4">
                                                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                                        <Calendar className="w-6 h-6 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-medium text-gray-900">{event.eventName}</h3>
                                                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                                            <div className="flex items-center space-x-1">
                                                                <Clock className="w-4 h-4" />
                                                                <span>{event.startDate?.toDate?.()?.toLocaleDateString() || 'TBD'}</span>
                                                            </div>
                                                            <div className="flex items-center space-x-1">
                                                                <MapPin className="w-4 h-4" />
                                                                <span>{event.location}</span>
                                                            </div>
                                                            <div className="flex items-center space-x-1">
                                                                <Award className="w-4 h-4" />
                                                                <span>{event.pointsToReward} points</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-4">
                                                    <div className="text-right">
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {event.attendees?.length || 0}{event.capacity ? `/${event.capacity}` : ''}
                                                        </p>
                                                        <p className="text-xs text-gray-500">Checked In</p>
                                                    </div>
                                                    {isUserCheckedIn(event) ? (
                                                        <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                                                            ✓ Checked In
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCheckIn(event.id, event.eventName, event.pointsToReward);
                                                            }}
                                                            disabled={checkingIn === event.id}
                                                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                                        >
                                                            <UserCheck className="w-4 h-4" />
                                                            <span>{checkingIn === event.id ? 'Checking In...' : 'Check In'}</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Past Events */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Past Events ({pastEvents.length})</h2>
                                {pastEvents.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No past events found</p>
                                ) : (
                                    <div className="space-y-4">
                                        {pastEvents.map((event) => (
                                            <div
                                                key={event.id}
                                                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg opacity-75 cursor-pointer hover:opacity-100 transition-opacity"
                                                onClick={() => setSelectedEvent(event)}
                                            >
                                                <div className="flex items-center space-x-4">
                                                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                                        <Calendar className="w-6 h-6 text-gray-400" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-medium text-gray-900">{event.eventName}</h3>
                                                        <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                                            <div className="flex items-center space-x-1">
                                                                <Clock className="w-4 h-4" />
                                                                <span>{event.startDate?.toDate?.()?.toLocaleDateString() || 'TBD'}</span>
                                                            </div>
                                                            <div className="flex items-center space-x-1">
                                                                <MapPin className="w-4 h-4" />
                                                                <span>{event.location}</span>
                                                            </div>
                                                            <div className="flex items-center space-x-1">
                                                                <Award className="w-4 h-4" />
                                                                <span>{event.pointsToReward} points</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-4">
                                                    <div className="text-right">
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {event.attendees?.length || 0}{event.capacity ? `/${event.capacity}` : ''}
                                                        </p>
                                                        <p className="text-xs text-gray-500">Attended</p>
                                                    </div>
                                                    {isUserCheckedIn(event) ? (
                                                        <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                                                            ✓ Attended
                                                        </span>
                                                    ) : (
                                                        <span className="px-3 py-1 bg-gray-100 text-gray-800 text-sm font-medium rounded-full">
                                                            Not Attended
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </main>

            {/* Event Details Modal */}
            {selectedEvent && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-900">{selectedEvent.eventName}</h2>
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto" style={{ maxHeight: '60vh' }}>
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                                    <p className="text-gray-900">{selectedEvent.eventDescription || 'No description available'}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-700 mb-2">Date & Time</h3>
                                        <p className="text-gray-900">
                                            {selectedEvent.startDate?.toDate?.()?.toLocaleString() || 'TBD'}
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-700 mb-2">Location</h3>
                                        <p className="text-gray-900">{selectedEvent.location}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-700 mb-2">Points Reward</h3>
                                        <p className="text-gray-900">{selectedEvent.pointsToReward} points</p>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-700 mb-2">Event Code</h3>
                                        <p className="text-gray-900 font-mono">{selectedEvent.eventCode}</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">Attendance</h3>
                                    <p className="text-gray-900">
                                        {selectedEvent.attendees?.length || 0} people checked in
                                        {selectedEvent.capacity && ` (of ${selectedEvent.capacity} capacity)`}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-6 border-t border-gray-200">
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                            {!isUserCheckedIn(selectedEvent) && getUpcomingEvents().includes(selectedEvent) && (
                                <button
                                    onClick={() => {
                                        handleCheckIn(selectedEvent.id, selectedEvent.eventName, selectedEvent.pointsToReward);
                                        setSelectedEvent(null);
                                    }}
                                    disabled={checkingIn === selectedEvent.id}
                                    className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    <UserCheck className="w-4 h-4" />
                                    <span>Check In</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 