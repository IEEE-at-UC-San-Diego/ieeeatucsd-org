import React, { useState, useEffect } from 'react';
import { Menu, X, Bell, User, Calendar, Award, Settings, LogOut } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getFirestore, doc, getDoc, collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { auth } from '../../firebase/client';
import type { User as UserType } from './types/firestore';

interface MobileHeaderProps {
    title: string;
    onMenuToggle: () => void;
    isMenuOpen: boolean;
}

interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'reimbursement' | 'event' | 'system';
    createdAt: any;
    read: boolean;
}

export default function MobileHeader({ title, onMenuToggle, isMenuOpen }: MobileHeaderProps) {
    const [user] = useAuthState(auth);
    const [userData, setUserData] = useState<UserType | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
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

        // Fetch notifications
        const notificationsQuery = query(
            collection(db, 'notifications'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(5) // Limit to 5 for mobile
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
            unsubscribeNotifications();
        };
    }, [user, db]);

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
                setShowNotificationDropdown(false);
                setShowProfileDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <header className="md:hidden sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
            <div className="flex items-center justify-between px-4 py-3">
                {/* Left side - Hamburger menu and logo */}
                <div className="flex items-center space-x-3">
                    <button
                        onClick={onMenuToggle}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={isMenuOpen}
                    >
                        {isMenuOpen ? (
                            <X className="w-6 h-6" />
                        ) : (
                            <Menu className="w-6 h-6" />
                        )}
                    </button>
                    
                    <div className="flex items-center space-x-2">
                        <img
                            src="/logos/blue_logo_only.svg"
                            alt="IEEE UCSD Logo"
                            className="w-8 h-8"
                        />
                        <span className="text-lg font-bold text-gray-800 truncate">{title}</span>
                    </div>
                </div>

                {/* Right side - Notifications and profile */}
                <div className="flex items-center space-x-2">
                    {/* Notification Icon */}
                    <div className="relative" data-dropdown>
                        <button
                            onClick={() => {
                                setShowNotificationDropdown(!showNotificationDropdown);
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
