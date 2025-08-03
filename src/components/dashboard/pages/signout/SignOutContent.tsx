import React, { useState } from 'react';
import { auth } from '../../../../firebase/client';
import { Skeleton } from '../../../ui/skeleton';

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
            window.location.href = '/';
        } catch (error) {
            console.error('Logout failed', error);
            setLoading(false);
        }
    };

    const handleCancel = () => {
        // Go back to previous page, or dashboard overview as fallback
        if (document.referrer && !document.referrer.includes('/dashboard/signin') && !document.referrer.includes('/dashboard/signout')) {
            window.history.back();
        } else {
            window.location.href = '/dashboard/overview';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-ieee-black via-ieee-blue-300 to-ieee-black flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            {/* Background Pattern */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-ieee-yellow/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-ieee-blue-100/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative max-w-md w-full">
                {/* Main Card */}
                <div className="bg-white/95 backdrop-blur-sm shadow-2xl rounded-2xl border border-white/20 overflow-hidden">
                    {/* Header Section */}
                    <div className="px-8 pt-8 pb-6 text-center">
                        {/* IEEE Logo */}
                        <div className="flex justify-center mb-6">
                            <div className="p-4 bg-gradient-to-br from-ieee-blue-100 to-ieee-blue-100/80 rounded-2xl shadow-lg">
                                <BlueIEEELogo className="w-16 h-16" />
                            </div>
                        </div>

                        {/* Title and Subtitle */}
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            Sign Out
                        </h1>
                        <p className="text-gray-600 text-sm">
                            Are you sure you want to sign out of your IEEE UCSD account?
                        </p>
                    </div>

                    {/* Sign Out Section */}
                    <div className="px-8 pb-8">
                        {/* Warning Notice */}
                        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-start">
                                <div className="flex-shrink-0">
                                    <svg className="w-5 h-5 text-amber-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-amber-800">
                                        You'll be signed out
                                    </h3>
                                    <p className="text-xs text-amber-700 mt-1">
                                        You'll need to sign in again to access your dashboard and account information.
                                    </p>
                                </div>
                            </div>
                        </div>

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
                                    <span>Yes, Sign me out</span>
                                </button>

                                <button
                                    onClick={handleCancel}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center px-6 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ieee-blue-100 transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <p className="text-sm text-white/80">
                        Having trouble?{' '}
                        <a
                            href="mailto:ieee@ucsd.edu"
                            className="font-medium text-ieee-yellow hover:text-ieee-yellow/80 transition-colors duration-200"
                        >
                            Contact IEEE UCSD
                        </a>
                    </p>
                </div>

                {/* Additional Info */}
                <div className="mt-4 text-center">
                    <p className="text-xs text-white/60">
                        Your session will be securely terminated and all local data cleared.
                    </p>
                </div>
            </div>
        </div>
    );
}