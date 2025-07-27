import React, { useState } from 'react';
import { LogOut, CheckCircle, ArrowRight } from 'lucide-react';
import { auth } from '../../../firebase/client';

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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <div className="flex justify-center">
                        <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-xl">◇</span>
                        </div>
                    </div>
                    <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
                        Sign out of your account
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Are you sure you want to sign out?
                    </p>
                </div>

                <div className="bg-white py-8 px-6 shadow-lg rounded-lg">
                    <div className="text-center space-y-6">
                        <div className="flex justify-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                                <LogOut className="w-8 h-8 text-red-600" />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                You're about to sign out
                            </h3>
                            <p className="text-sm text-gray-600">
                                You'll need to sign in again to access your IEEE UCSD dashboard and account information.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={handleSignOut}
                                disabled={loading}
                                className="w-full flex justify-center items-center py-2 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                {loading ? 'Signing out...' : 'Yes, Sign me out'}
                            </button>

                            <button
                                type="button"
                                onClick={handleCancel}
                                className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-xs text-gray-500">
                        Having trouble?{' '}
                        <a href="#" className="text-blue-600 hover:text-blue-500">
                            Contact IEEE UCSD Support
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
} 