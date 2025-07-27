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
    FileText
} from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { auth } from '../../firebase/client';
import { Skeleton } from '../ui/skeleton';
import type { NavigationCategory, SidebarProps } from './types/navigation';
import type { UserRole } from './types/firestore';
import { NAVIGATION_PATHS } from './types/navigation';

interface SidebarComponentProps extends SidebarProps {
    currentPath?: string;
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

export function Sidebar({ currentPath = '' }: SidebarComponentProps) {
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

    // Always filter categories based on current role, even during loading we use the default role
    const filteredCategories = currentUserRole ? navigationCategories.filter(canAccessCategory) :
        navigationCategories.filter(cat => !cat.requiresRole); // Show only non-restricted categories if no role yet

    // Show skeleton if user auth is loading OR role is loading
    const isLoading = userLoading || isLoadingRole;

    const NavigationSkeleton = () => (
        <nav className="mt-6 px-4 pb-6 overflow-y-auto">
            {/* Member Actions skeleton */}
            <div className="mb-8">
                <Skeleton className="h-3 w-24 mb-3 ml-3" />
                <ul className="space-y-1">
                    {[1, 2, 3].map((itemIndex) => (
                        <li key={itemIndex}>
                            <div className="flex items-center px-3 py-2">
                                <Skeleton className="w-5 h-5 mr-3" />
                                <Skeleton className="h-4 w-20" />
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Generic loading section */}
            <div className="mb-8">
                <Skeleton className="h-3 w-16 mb-3 ml-3" />
                <ul className="space-y-1">
                    <li>
                        <div className="flex items-center px-3 py-2">
                            <Skeleton className="w-5 h-5 mr-3" />
                            <Skeleton className="h-4 w-16" />
                        </div>
                    </li>
                </ul>
            </div>

            {/* Account actions skeleton */}
            <div className="mb-8">
                <Skeleton className="h-3 w-16 mb-3 ml-3" />
                <ul className="space-y-1">
                    {[1, 2].map((itemIndex) => (
                        <li key={itemIndex}>
                            <div className="flex items-center px-3 py-2">
                                <Skeleton className="w-5 h-5 mr-3" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );

    return (
        <div className="w-64 bg-white shadow-lg h-full">
            {/* Logo */}
            <div className="p-6 border-b border-gray-200">
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
            </div>

            {/* Navigation */}
            {isLoading ? (
                <NavigationSkeleton />
            ) : (
                <nav className="mt-6 px-4 pb-6 overflow-y-auto">
                    {filteredCategories.map((category, categoryIndex) => (
                        <div key={categoryIndex} className="mb-8">
                            <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                {category.title}
                            </h3>
                            <ul className="space-y-1">
                                {category.items.map((item, index) => {
                                    const isActive = isActiveRoute(item.href);
                                    return (
                                        <li key={index}>
                                            <a
                                                href={item.href}
                                                className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${isActive
                                                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                                    }`}
                                            >
                                                <item.icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-600' : 'text-gray-400'
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
    );
} 