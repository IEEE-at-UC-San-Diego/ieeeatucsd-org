import React from 'react';
import {
    Home,
    Calendar,
    CreditCard,
    Settings,
    LogOut,
    Users,
    DollarSign,
    Database
} from 'lucide-react';
import type { NavigationCategory, SidebarProps } from './types/navigation';
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
        ]
    },
    {
        title: "Officer Actions",
        items: [
            { icon: Calendar, label: 'Manage Events', href: NAVIGATION_PATHS.MANAGE_EVENTS },
            { icon: DollarSign, label: 'Manage Reimbursements', href: NAVIGATION_PATHS.MANAGE_REIMBURSEMENTS },
            { icon: Users, label: 'Manage Users', href: NAVIGATION_PATHS.MANAGE_USERS },
        ]
    },
    {
        title: "Development",
        items: [
            { icon: Database, label: 'Firebase Test', href: NAVIGATION_PATHS.FIREBASE_TEST },
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
    const isActiveRoute = (href: string): boolean => {
        if (currentPath === '/dashboard' || currentPath === '/dashboard/') {
            return href === NAVIGATION_PATHS.OVERVIEW;
        }
        return currentPath === href;
    };

    return (
        <div className="w-64 bg-white shadow-lg h-full">
            {/* Logo */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center">
                    <div className="w-8 h-8 flex items-center justify-center">
                        <img
                            src="/logos/white_logo_only.svg"
                            alt="IEEE UCSD Logo"
                            className="w-8 h-8"
                        />
                    </div>
                    <span className="ml-3 text-xl font-bold text-gray-800">IEEE UCSD</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="mt-6 px-4 pb-6 overflow-y-auto">
                {navigationCategories.map((category, categoryIndex) => (
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
        </div>
    );
} 