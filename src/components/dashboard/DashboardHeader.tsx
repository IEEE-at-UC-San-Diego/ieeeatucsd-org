import React, { useState, useEffect } from 'react';
import { Search, Calendar, Bell, User, LogOut, Settings, Award, ChevronDown, X } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getFirestore, doc, getDoc, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { auth } from '../../firebase/client';
import type { User as UserType } from './types/firestore';

interface DashboardHeaderProps {
    title: string;
    subtitle: string;
    searchPlaceholder?: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    children?: React.ReactNode;
    showSearch?: boolean;
}

interface Event {
    id: string;
    eventName: string;
    startDate: any;
    location: string;
}

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'reimbursement' | 'event' | 'system';
    createdAt: any;
    read: boolean;
}

export default function DashboardHeader({
    title,
    subtitle,
    searchPlaceholder = "Search...",
    searchValue = "",
    onSearchChange,
    children,
    showSearch = true
}: DashboardHeaderProps) {
    const [user] = useAuthState(auth);
    const [userData, setUserData] = useState<UserType | null>(null);
    const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showCalendarDropdown, setShowCalendarDropdown] = useState(false);
    const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
    const [showProfileDropdown, setShowProfileDropdown] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const db = getFirestore();

    useEffect(() => {
        if (!user) return;

        // Fetch user data
        const fetchUserData = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    setUserData(userDoc.data() as UserType);
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };

        fetchUserData();
    }, [user, db]);

    useEffect(() => {
        if (!user) return;

        // Fetch upcoming events
        const eventsQuery = query(
            collection(db, 'events'),
            where('published', '==', true),
            orderBy('startDate', 'asc'),
            limit(5)
        );

        const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
            const events = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Event[];

            // Filter for upcoming events
            const now = new Date();
            const upcoming = events.filter(event => {
                const startDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
                return startDate > now;
            });

            setUpcomingEvents(upcoming);
        });

        // Fetch notifications
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(10)
        );

        const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
            const notifs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Notification[];

            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.read).length);
        });

        return () => {
            unsubscribeEvents();
            unsubscribeNotifications();
        };
    }, [user, db]);

    const CalendarDropdown = () => (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Upcoming Events</h3>
            </div>
            <div className="max-h-64 overflow-y-auto">
                {upcomingEvents.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                        No upcoming events
                    </div>
                ) : (
                    upcomingEvents.map((event) => (
                        <div key={event.id} className="p-4 border-b border-gray-100 hover:bg-gray-50">
                            <h4 className="font-medium text-gray-900 text-sm">{event.eventName}</h4>
                            <p className="text-sm text-gray-500">
                                {event.startDate?.toDate ? event.startDate.toDate().toLocaleDateString() : 'TBD'}
                            </p>
                            <p className="text-xs text-gray-400 truncate">{event.location}</p>
                        </div>
                    ))
                )}
            </div>
            <div className="p-3 border-t border-gray-200">
                <a
                    href="/dashboard/events"
                    className="text-sm text-blue-600 hover:text-blue-800 min-h-[44px] flex items-center"
                >
                    View all events →
                </a>
            </div>
        </div>
    );

    const NotificationDropdown = () => (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Notifications</h3>
            </div>
            <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                        No notifications
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <div key={notification.id} className={`p-4 border-b border-gray-100 hover:bg-gray-50 ${!notification.read ? 'bg-blue-50' : ''}`}>
                            <h4 className="font-medium text-gray-900 text-sm">{notification.title}</h4>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{notification.message}</p>
                            <p className="text-xs text-gray-400 mt-2">
                                {notification.createdAt?.toDate ? notification.createdAt.toDate().toLocaleDateString() : 'Recently'}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    const ProfileDropdown = () => (
        <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{userData?.name || 'User'}</p>
                        <p className="text-sm text-gray-500 truncate">{userData?.email}</p>
                    </div>
                </div>
            </div>
            <div className="p-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                    <div className="flex items-center space-x-3">
                        <Award className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-gray-700">Points</span>
                    </div>
                    <span className="text-sm font-bold text-yellow-600">{userData?.points || 0}</span>
                </div>
            </div>
            <div className="p-2 space-y-1">
                <a
                    href="/dashboard/settings"
                    className="flex items-center space-x-3 p-3 text-sm text-gray-700 hover:bg-gray-100 rounded-lg min-h-[44px]"
                >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                </a>
                <a
                    href="/dashboard/signout"
                    className="flex items-center space-x-3 p-3 text-sm text-red-600 hover:bg-red-50 rounded-lg min-h-[44px]"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                </a>
            </div>
        </div>
    );

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            if (!target.closest('[data-dropdown]')) {
                setShowCalendarDropdown(false);
                setShowNotificationDropdown(false);
                setShowProfileDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className="hidden md:block bg-white shadow-sm border-b border-gray-200 px-4 md:px-6 py-4">
            <div className="flex items-center gap-4">
                {/* Title Section */}
                <div className="flex-shrink-0">
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900">{title}</h1>
                    <p className="text-sm md:text-base text-gray-600">{subtitle}</p>
                </div>

                {/* Search and Controls Section */}
                <div className="flex items-center space-x-2 md:space-x-4 flex-1 min-w-0">
                    {showSearch && (
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder={searchPlaceholder}
                                value={searchValue}
                                onChange={(e) => onSearchChange?.(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base min-h-[44px]"
                            />
                        </div>
                    )}
                    {children && (
                        <div className="flex items-center space-x-2 md:space-x-3">
                            {children}
                        </div>
                    )}
                </div>

                {/* Icons Section */}
                <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
                    {/* Calendar Icon */}
                    <div className="relative" data-dropdown>
                        <button
                            onClick={() => {
                                setShowCalendarDropdown(!showCalendarDropdown);
                                setShowNotificationDropdown(false);
                                setShowProfileDropdown(false);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            aria-label="Calendar"
                        >
                            <Calendar className="w-5 h-5" />
                        </button>
                        {showCalendarDropdown && <CalendarDropdown />}
                    </div>

                    {/* Notification Icon */}
                    <div className="relative" data-dropdown>
                        <button
                            onClick={() => {
                                setShowNotificationDropdown(!showNotificationDropdown);
                                setShowCalendarDropdown(false);
                                setShowProfileDropdown(false);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors relative min-h-[44px] min-w-[44px] flex items-center justify-center"
                            aria-label="Notifications"
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>
                        {showNotificationDropdown && <NotificationDropdown />}
                    </div>

                    {/* Profile Icon */}
                    <div className="relative" data-dropdown>
                        <button
                            onClick={() => {
                                setShowProfileDropdown(!showProfileDropdown);
                                setShowCalendarDropdown(false);
                                setShowNotificationDropdown(false);
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            aria-label="Profile menu"
                        >
                            <User className="w-5 h-5" />
                        </button>
                        {showProfileDropdown && <ProfileDropdown />}
                    </div>
                </div>
            </div>
        </header>
    );
} 