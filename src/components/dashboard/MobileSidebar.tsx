import React, { useState, useEffect } from 'react';
import {
    Home,
    Calendar,
    CreditCard,
    Settings,
    LogOut,
    Users,
    DollarSign,
    Database,
    Trophy,
    Banknote,
    FileText,
    X,
    MessageSquare
} from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { auth } from '../../firebase/client';
import { Skeleton } from '../ui/skeleton';
import type { NavigationCategory, SidebarProps } from './types/navigation';
import type { UserRole } from './types/firestore';
import { NAVIGATION_PATHS } from './types/navigation';

interface MobileSidebarProps extends SidebarProps {
    currentPath?: string;
    isOpen: boolean;
    onClose: () => void;
}

const navigationCategories: NavigationCategory[] = [
    {
        title: "Member Actions",
        items: [
            { icon: Home, label: 'Overview', href: NAVIGATION_PATHS.OVERVIEW },
            { icon: Calendar, label: 'Events', href: NAVIGATION_PATHS.EVENTS },
            { icon: CreditCard, label: 'Reimbursement', href: NAVIGATION_PATHS.REIMBURSEMENT },
            { icon: Trophy, label: 'Leaderboard', href: NAVIGATION_PATHS.LEADERBOARD },
        ]
    },
    {
        title: "General Officers",
        requiresRole: ['General Officer', 'Executive Officer', 'Administrator'],
        items: [
            { icon: Calendar, label: 'Manage Events', href: NAVIGATION_PATHS.MANAGE_EVENTS },
            { icon: Banknote, label: 'Fund Deposits', href: NAVIGATION_PATHS.FUND_DEPOSITS },
            { icon: MessageSquare, label: 'Slack Access', href: NAVIGATION_PATHS.SLACK_ACCESS },
        ]
    },
    {
        title: "Executive Officers",
        requiresRole: ['Executive Officer', 'Administrator'],
        items: [
            { icon: DollarSign, label: 'Manage Reimbursements', href: NAVIGATION_PATHS.MANAGE_REIMBURSEMENTS },
            { icon: Users, label: 'Manage Users', href: NAVIGATION_PATHS.MANAGE_USERS },
            { icon: FileText, label: 'Constitution Builder', href: NAVIGATION_PATHS.CONSTITUTION_BUILDER },
        ]
    },
    {
        title: "Account",
        items: [
            { icon: Settings, label: 'Settings', href: NAVIGATION_PATHS.SETTINGS },
            { icon: LogOut, label: 'Sign Out', href: NAVIGATION_PATHS.SIGNOUT },
        ]
    }
];

export function MobileSidebar({ currentPath = '', isOpen, onClose }: MobileSidebarProps) {
    const [user, userLoading] = useAuthState(auth);
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
    const [isLoadingRole, setIsLoadingRole] = useState(false);
    const db = getFirestore();

    useEffect(() => {
        // Don't start role fetching until user auth is resolved
        if (userLoading) return;

        if (!user) {
            setCurrentUserRole('Member'); // Default for non-logged in users
            setIsLoadingRole(false);
            return;
        }

        // Only start loading role if we have a user and haven't loaded role yet
        if (user && currentUserRole === null) {
            const fetchUserRole = async () => {
                try {
                    setIsLoadingRole(true);
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setCurrentUserRole(userData.role || 'Member');
                    } else {
                        setCurrentUserRole('Member');
                    }
                } catch (error) {
                    console.error('Error fetching user role:', error);
                    setCurrentUserRole('Member'); // Default to Member if error
                } finally {
                    setIsLoadingRole(false);
                }
            };

            fetchUserRole();
        }
    }, [user, userLoading, currentUserRole, db]);

    const isActiveRoute = (href: string): boolean => {
        if (currentPath === '/dashboard' || currentPath === '/dashboard/') {
            return href === NAVIGATION_PATHS.OVERVIEW;
        }
        return currentPath === href;
    };

    const canAccessCategory = (category: NavigationCategory): boolean => {
        if (!category.requiresRole || !currentUserRole) return true;
        return category.requiresRole.includes(currentUserRole);
    };

    // Show skeleton if user auth is loading OR role is loading OR role hasn't been determined yet
    const isLoading = userLoading || isLoadingRole || currentUserRole === null;

    // Only filter categories when we have a confirmed role
    const filteredCategories = currentUserRole ? navigationCategories.filter(canAccessCategory) : [];

    // Handle click on navigation item
    const handleNavClick = () => {
        onClose();
    };

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Prevent body scroll when menu is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const NavigationSkeleton = () => (
        <div className="px-6 pb-6 overflow-y-auto">
            {/* Member Actions skeleton */}
            <div className="mb-8">
                <Skeleton className="h-4 w-24 mb-4" />
                <ul className="space-y-2">
                    {[1, 2, 3].map((itemIndex) => (
                        <li key={itemIndex}>
                            <div className="flex items-center p-4">
                                <Skeleton className="w-6 h-6 mr-4" />
                                <Skeleton className="h-5 w-20" />
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Generic loading section */}
            <div className="mb-8">
                <Skeleton className="h-4 w-16 mb-4" />
                <ul className="space-y-2">
                    <li>
                        <div className="flex items-center p-4">
                            <Skeleton className="w-6 h-6 mr-4" />
                            <Skeleton className="h-5 w-16" />
                        </div>
                    </li>
                </ul>
            </div>

            {/* Account actions skeleton */}
            <div className="mb-8">
                <Skeleton className="h-4 w-16 mb-4" />
                <ul className="space-y-2">
                    {[1, 2].map((itemIndex) => (
                        <li key={itemIndex}>
                            <div className="flex items-center p-4">
                                <Skeleton className="w-6 h-6 mr-4" />
                                <Skeleton className="h-5 w-16" />
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={handleBackdropClick}
                aria-hidden="true"
            />

            {/* Sidebar */}
            <div className={`relative flex flex-col w-80 max-w-[85vw] bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                {/* Header with close button */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center">
                        <div className="w-8 h-8 flex items-center justify-center">
                            <img
                                src="/logos/blue_logo_only.svg"
                                alt="IEEE UCSD Logo"
                                className="w-8 h-8"
                            />
                        </div>
                        <span className="ml-3 text-xl font-bold text-gray-800">IEEE UCSD</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label="Close menu"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Navigation */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <NavigationSkeleton />
                    ) : (
                        <nav className="mt-6 px-6 pb-6">
                            {filteredCategories.map((category, categoryIndex) => (
                                <div key={categoryIndex} className="mb-8">
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                                        {category.title}
                                    </h3>
                                    <ul className="space-y-2">
                                        {category.items.map((item, index) => {
                                            const isActive = isActiveRoute(item.href);
                                            return (
                                                <li key={index}>
                                                    <a
                                                        href={item.href}
                                                        onClick={handleNavClick}
                                                        className={`flex items-center p-4 text-base font-medium rounded-lg transition-colors min-h-[44px] ${isActive
                                                            ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600'
                                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                                            }`}
                                                    >
                                                        <item.icon className={`w-6 h-6 mr-4 ${isActive ? 'text-blue-600' : 'text-gray-400'
                                                            }`} />
                                                        {item.label}
                                                    </a>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ))}
                        </nav>
                    )}
                </div>
            </div>
        </div>
    );
}
