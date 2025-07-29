import React, { useState, useEffect } from 'react';
import { Search, Calendar, Bell, User, Filter, MapPin, Clock, Users, UserCheck, X, Award, FileText, Eye, Download } from 'lucide-react';
import { getFirestore, collection, getDocs, query, where, orderBy, doc, getDoc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app } from '../../../firebase/client';
import DashboardHeader from '../DashboardHeader';
import { PublicProfileService } from '../services/publicProfile';

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
    hasFood?: boolean;
    files?: string[];
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
    const [checkedInEvents, setCheckedInEvents] = useState<Set<string>>(new Set());

    const db = getFirestore(app);
    const auth = getAuth(app);

    // Utility function to determine if an event is currently active
    const isEventCurrentlyActive = (event: Event) => {
        if (!event.published) return false;

        const now = new Date();
        const startDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
        const endDate = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);

        return now >= startDate && now <= endDate;
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('User authenticated, fetching events:', user.uid);
                fetchEvents();
                fetchUserStats();
            } else {
                console.log('No user authenticated, still fetching public events');
                // Even without authentication, we can fetch public events
                fetchEvents();
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (auth.currentUser && events.length > 0) {
            fetchUserCheckedInEvents();
        }
    }, [auth.currentUser, events]);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            setError(null);

            const eventsRef = collection(db, 'events');
            let eventsSnapshot;

            // First try to get only published events with simple query
            try {
                const publishedQuery = query(
                    eventsRef,
                    where('published', '==', true)
                );
                eventsSnapshot = await getDocs(publishedQuery);
                console.log('Successfully fetched published events:', eventsSnapshot.docs.length);
            } catch (queryError) {
                console.warn('Failed to query published events, trying all events:', queryError);
                // Fallback: get all events and filter client-side
                eventsSnapshot = await getDocs(eventsRef);
                console.log('Fallback: fetched all events:', eventsSnapshot.docs.length);
            }

            const eventsData = eventsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Ensure all required fields have defaults
                    published: data.published ?? false, // Default to false for safety
                    pointsToReward: data.pointsToReward ?? 0,
                    attendees: data.attendees ?? [],
                    eventCode: data.eventCode ?? '',
                    eventName: data.eventName ?? data.name ?? 'Untitled Event',
                    hasFood: data.hasFood ?? false,
                    files: data.files ?? []
                };
            }) as Event[];

            // Always filter for published events client-side
            const publishedEvents = eventsData.filter(event => event.published === true);

            // Sort by start date
            publishedEvents.sort((a, b) => {
                const dateA = a.startDate?.toDate ? a.startDate.toDate() : new Date(a.startDate);
                const dateB = b.startDate?.toDate ? b.startDate.toDate() : new Date(b.startDate);
                return dateA.getTime() - dateB.getTime();
            });

            console.log('=== EVENT DEBUGGING ===');
            console.log('Current user:', auth.currentUser?.uid || 'Not authenticated');
            console.log('Total events fetched:', eventsData.length);
            console.log('Events with published field:', eventsData.filter(e => e.published !== undefined).length);
            console.log('Events where published = true:', publishedEvents.length);
            console.log('All events data:', eventsData.map(e => ({
                id: e.id,
                name: e.eventName,
                published: e.published,
                startDate: e.startDate,
                location: e.location
            })));
            console.log('Published events:', publishedEvents.map(e => ({
                id: e.id,
                name: e.eventName,
                published: e.published,
                startDate: e.startDate
            })));
            console.log('Final published events after filtering:', publishedEvents.length, publishedEvents);
            setEvents(publishedEvents);

            if (publishedEvents.length === 0) {
                console.warn('No published events found. Check that events are properly published.');
                console.log('Debug: All events from database:', eventsData);
            }
        } catch (error) {
            console.error('Error fetching events:', error);
            setError('Failed to fetch events: ' + (error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserStats = async () => {
        if (!auth.currentUser) return;

        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);
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

    const fetchUserCheckedInEvents = async () => {
        if (!auth.currentUser) return;

        try {
            const checkedInSet = new Set<string>();

            // For each event, check if user has checked in
            for (const event of events) {
                try {
                    const attendeeRef = doc(db, 'events', event.id, 'attendees', auth.currentUser.uid);
                    const attendeeSnap = await getDoc(attendeeRef);
                    if (attendeeSnap.exists()) {
                        checkedInSet.add(event.id);
                    }
                } catch (error) {
                    // Continue if there's an error checking a specific event
                    console.warn(`Error checking attendance for event ${event.id}:`, error);
                }
            }

            setCheckedInEvents(checkedInSet);
        } catch (error) {
            console.error('Error fetching user checked-in events:', error);
        }
    };

    const handleCheckIn = async (event: Event) => {
        if (!auth.currentUser) {
            setError('Please log in to check in');
            return;
        }

        // Check if event is currently active
        if (!isEventCurrentlyActive(event)) {
            const now = new Date();
            const startDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
            const endDate = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);

            if (now < startDate) {
                alert(`This event hasn't started yet. Check-in opens on ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString()}.`);
                return;
            } else if (now > endDate) {
                alert('This event has already ended. Check-in is no longer available.');
                return;
            } else if (!event.published) {
                alert('This event is not currently available for check-in.');
                return;
            }
        }

        try {
            setCheckingIn(event.id);

            // Ask for event code first
            const enteredCode = prompt(`Please enter the event code for "${event.eventName}":`);
            if (!enteredCode) {
                setCheckingIn(null);
                return; // User cancelled
            }

            // Validate event code
            if (enteredCode.toUpperCase() !== event.eventCode?.toUpperCase()) {
                alert('Incorrect event code. Please try again.');
                setCheckingIn(null);
                return;
            }

            // Ask for food preference if the event has food
            let foodPreference = '';
            if (event.hasFood) {
                foodPreference = prompt('This event has food! What would you like? (e.g., Vegetarian, Vegan, No preference, etc.)') || 'No preference';
            }

            // Create check-in record in attendees subcollection
            const attendeeRef = doc(db, 'events', event.id, 'attendees', auth.currentUser.uid);
            await setDoc(attendeeRef, {
                userId: auth.currentUser.uid,
                timeCheckedIn: new Date(),
                food: foodPreference,
                pointsEarned: event.pointsToReward,
                eventCode: enteredCode // Store the code they used to check in
            });

            // Update user with event attendance and points
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const newPoints = userStats.totalPointsEarned + event.pointsToReward;
            const newEventsAttended = userStats.totalEventsAttended + 1;

            await updateDoc(userRef, {
                lastEventAttended: event.eventName,
                points: newPoints,
                eventsAttended: newEventsAttended
            });

            // Sync to public profile
            try {
                await PublicProfileService.updateUserStats(auth.currentUser.uid, {
                    points: newPoints,
                    eventsAttended: newEventsAttended
                });
            } catch (error) {
                console.error('Error syncing to public profile:', error);
                // Don't fail the whole check-in process if public profile sync fails
            }

            // Add event to checked-in set
            setCheckedInEvents(prev => new Set(prev).add(event.id));

            // Refresh user stats
            fetchUserStats();

            // Show success message
            const message = event.hasFood && foodPreference
                ? `Successfully checked in to ${event.eventName}! You earned ${event.pointsToReward} points. Food preference: ${foodPreference}`
                : `Successfully checked in to ${event.eventName}! You earned ${event.pointsToReward} points.`;
            alert(message);

        } catch (error) {
            console.error('Error checking in:', error);
            setError('Failed to check in to event: ' + (error as Error).message);
        } finally {
            setCheckingIn(null);
        }
    };

    const getUpcomingEvents = () => {
        const now = new Date();
        return events.filter(event => {
            const eventDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
            return eventDate >= now;
        });
    };

    const getPastEvents = () => {
        const now = new Date();
        return events.filter(event => {
            const eventDate = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.startDate);
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
        return auth.currentUser && checkedInEvents.has(event.id);
    };

    const upcomingEvents = getFilteredEvents(getUpcomingEvents());
    const pastEvents = getFilteredEvents(getPastEvents());

    return (
        <div className="flex-1 overflow-auto">
            {/* Header */}
            <DashboardHeader
                title="Events"
                subtitle="View IEEE UCSD events and check in to earn points"
                searchPlaceholder="Search events..."
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
            >
                <button
                    onClick={() => fetchEvents()}
                    disabled={loading}
                    className="flex items-center space-x-2 px-3 md:px-4 py-2 border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 min-h-[44px] text-sm md:text-base"
                >
                    <Calendar className="w-4 h-4" />
                    <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh Events'}</span>
                    <span className="sm:hidden">{loading ? 'Refresh...' : 'Refresh'}</span>
                </button>
            </DashboardHeader>

            {/* Events Content */}
            <main className="p-4 md:p-6">
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-sm md:text-base text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Debug Info - Show all events from database for debugging */}
                    {process.env.NODE_ENV === 'development' && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h3 className="font-medium text-yellow-800 mb-2">DEBUG: Database Events</h3>
                            <p className="text-sm text-yellow-700">
                                Total events in database: {loading ? 'Loading...' : 'Check console for details'}
                            </p>
                            <p className="text-sm text-yellow-700">
                                Published events found: {events.length}
                            </p>
                            <p className="text-sm text-yellow-700">
                                Open browser console to see detailed event data
                            </p>
                        </div>
                    )}

                    {/* User Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-600">Last Event Attended</p>
                                    <p className="text-base md:text-lg font-bold text-gray-900 truncate">{userStats.lastEventAttended}</p>
                                </div>
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Calendar className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-600">Total Points Earned</p>
                                    <p className="text-xl md:text-2xl font-bold text-green-600">{userStats.totalPointsEarned}</p>
                                </div>
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Award className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6 sm:col-span-2 lg:col-span-1">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-600">Total Events Attended</p>
                                    <p className="text-xl md:text-2xl font-bold text-purple-600">{userStats.totalEventsAttended}</p>
                                </div>
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Users className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Check-in Section */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 md:p-6 mb-4 md:mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base md:text-lg font-semibold text-gray-900 flex items-center">
                                    <UserCheck className="w-5 h-5 mr-2 text-blue-600" />
                                    Quick Check-in
                                </h2>
                                <p className="text-sm text-gray-600">Check into events happening today</p>
                            </div>
                        </div>

                        {/* Today's Events for Check-in */}
                        {(() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const tomorrow = new Date(today);
                            tomorrow.setDate(tomorrow.getDate() + 1);

                            const todaysEvents = events.filter(event => {
                                const eventDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
                                return eventDate >= today && eventDate < tomorrow;
                            });

                            if (todaysEvents.length === 0) {
                                return (
                                    <div className="text-center py-8">
                                        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-500">No events happening today</p>
                                    </div>
                                );
                            }

                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {todaysEvents.map(event => {
                                        const eventDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
                                        return (
                                            <div key={event.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-medium text-gray-900 truncate">{event.eventName}</h3>
                                                        <div className="flex items-center text-sm text-gray-500 mt-1">
                                                            <Clock className="w-4 h-4 mr-1" />
                                                            <span>{eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                                                        </div>
                                                        <div className="flex items-center text-sm text-gray-500 mt-1">
                                                            <MapPin className="w-4 h-4 mr-1" />
                                                            <span className="truncate">{event.location}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-2 ml-2">
                                                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                                                            {event.pointsToReward} pts
                                                        </span>
                                                        {event.hasFood && (
                                                            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                                                                🍕 Food
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {!isEventCurrentlyActive(event) ? (
                                                    <button
                                                        disabled={true}
                                                        className="w-full bg-gray-100 text-gray-600 py-2 px-4 rounded-lg cursor-not-allowed flex items-center justify-center space-x-2"
                                                    >
                                                        <span>Check-in Not Available</span>
                                                    </button>
                                                ) : isUserCheckedIn(event) ? (
                                                    <button
                                                        disabled={true}
                                                        className="w-full bg-green-100 text-green-800 py-2 px-4 rounded-lg cursor-not-allowed flex items-center justify-center space-x-2"
                                                    >
                                                        <span>✓ Already Checked In</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleCheckIn(event)}
                                                        disabled={checkingIn === event.id}
                                                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                                                    >
                                                        {checkingIn === event.id ? (
                                                            <>
                                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                                <span>Checking In...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span>Check In</span>
                                                                <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium">
                                                                    +{event.pointsToReward} pts
                                                                </span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
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
                                                    {isEventCurrentlyActive(event) && (
                                                        <div className="text-right">
                                                            <p className="text-sm font-medium text-gray-900">
                                                                {event.attendees?.length || 0}{event.capacity ? `/${event.capacity}` : ''}
                                                            </p>
                                                            <p className="text-xs text-gray-500">Checked In</p>
                                                        </div>
                                                    )}
                                                    {!isEventCurrentlyActive(event) ? (
                                                        <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm font-medium rounded-full">
                                                            Check-in Not Available
                                                        </span>
                                                    ) : isUserCheckedIn(event) ? (
                                                        <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                                                            ✓ Checked In
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCheckIn(event);
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
                                                            Past Event
                                                        </p>
                                                        <p className="text-xs text-gray-500">Ended</p>
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
                                    {isEventCurrentlyActive(selectedEvent) && (
                                        <div>
                                            <h3 className="text-sm font-medium text-gray-700 mb-2">Current Attendance</h3>
                                            <p className="text-gray-900">
                                                {selectedEvent.attendees?.length || 0} people checked in
                                                {selectedEvent.capacity && ` (of ${selectedEvent.capacity} capacity)`}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Public Files Section */}
                                {selectedEvent.files && selectedEvent.files.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                                            <FileText className="w-4 h-4 mr-2" />
                                            Event Files
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {selectedEvent.files.map((fileUrl, index) => {
                                                const fileName = `Event File ${index + 1}`;
                                                const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileUrl);
                                                const isPdf = /\.pdf$/i.test(fileUrl);

                                                return (
                                                    <div key={index} className="border rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm font-medium text-gray-700 truncate">{fileName}</span>
                                                            <div className="flex space-x-2">
                                                                <a
                                                                    href={fileUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-blue-600 hover:text-blue-800 p-1 rounded transition-colors"
                                                                    title="View File"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </a>
                                                                <a
                                                                    href={fileUrl}
                                                                    download={fileName}
                                                                    className="text-green-600 hover:text-green-800 p-1 rounded transition-colors"
                                                                    title="Download File"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                </a>
                                                            </div>
                                                        </div>
                                                        {isImage && (
                                                            <img
                                                                src={fileUrl}
                                                                alt={fileName}
                                                                className="w-full h-20 object-cover rounded cursor-pointer"
                                                                onClick={() => window.open(fileUrl, '_blank')}
                                                            />
                                                        )}
                                                        {isPdf && (
                                                            <div className="w-full h-20 bg-red-100 rounded flex items-center justify-center cursor-pointer"
                                                                onClick={() => window.open(fileUrl, '_blank')}>
                                                                <FileText className="w-6 h-6 text-red-600" />
                                                                <span className="ml-2 text-red-600 text-sm font-medium">PDF</span>
                                                            </div>
                                                        )}
                                                        {!isImage && !isPdf && (
                                                            <div className="w-full h-20 bg-gray-200 rounded flex items-center justify-center cursor-pointer"
                                                                onClick={() => window.open(fileUrl, '_blank')}>
                                                                <FileText className="w-6 h-6 text-gray-600" />
                                                                <span className="ml-2 text-gray-600 text-sm font-medium">File</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-6 border-t border-gray-200">
                            <button
                                onClick={() => setSelectedEvent(null)}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                            {!isUserCheckedIn(selectedEvent) && isEventCurrentlyActive(selectedEvent) && (
                                <button
                                    onClick={() => {
                                        handleCheckIn(selectedEvent);
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