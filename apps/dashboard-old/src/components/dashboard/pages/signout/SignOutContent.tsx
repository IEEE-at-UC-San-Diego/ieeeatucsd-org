import React, { useState } from 'react';
import { auth } from '../../../../firebase/client';
import { Skeleton } from '@heroui/react';

// Blue IEEE Logo SVG Component
const BlueIEEELogo = ({ className = "w-32 h-auto" }: { className?: string }) => (
    <img
        src="/logos/blue_logo_only.svg"
        alt="IEEE UCSD Logo"
        className={className}
        role="img"
        aria-label="IEEE UCSD Logo"
    />
);

// Loading Skeleton for Sign Out Button
const SignOutButtonSkeleton = () => (
    <div className="w-full space-y-3">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
    </div>
);

export default function SignOutContent() {
    const [loading, setLoading] = useState(false);

    const handleSignOut = async () => {
        setLoading(true);
        try {
            await auth.signOut();
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/signin';
        } catch (error) {
            console.error('Logout failed', error);
            setLoading(false);
        }
    };

    const handleCancel = () => {
        // Go back to previous page, or dashboard overview as fallback
        if (document.referrer && !document.referrer.includes('/signin') && !document.referrer.includes('/signout')) {
            window.history.back();
        } else {
            window.location.href = '/overview';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full">
                {/* Main Card */}
                <div className="bg-white shadow-xl rounded-2xl border border-gray-100 overflow-hidden">
                    {/* Header Section */}
                    <div className="px-8 pt-10 pb-6 text-center">
                        {/* IEEE Logo */}
                        <div className="flex justify-center mb-6">
                            <BlueIEEELogo className="w-20 h-20" />
                        </div>

                        {/* Title and Subtitle */}
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            Sign Out
                        </h1>
                        <p className="text-gray-600 text-sm">
                            Are you sure you want to sign out?
                        </p>
                    </div>

                    {/* Sign Out Section */}
                    <div className="px-8 pb-10">
                        {loading ? (
                            <SignOutButtonSkeleton />
                        ) : (
                            <div className="space-y-3">
                                <button
                                    onClick={handleSignOut}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Confirm sign out"
                                >
                                    <span>Sign Out</span>
                                </button>

                                <button
                                    onClick={handleCancel}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center px-6 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-100 transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Cancel sign out"
                                >
                                    <span>Cancel</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-500">
                        Having trouble?{' '}
                        <a
                            href="mailto:ieee@ucsd.edu"
                            className="font-medium text-blue-600 hover:text-blue-500 transition-colors duration-200"
                        >
                            Contact IEEE UCSD
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}