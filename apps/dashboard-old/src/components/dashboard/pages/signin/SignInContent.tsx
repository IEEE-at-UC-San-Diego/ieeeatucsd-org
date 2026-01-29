import React, { useState, useEffect } from 'react';
import { auth, signInWithPopup, GoogleAuthProvider, browserPopupRedirectResolver } from '../../../../firebase/client';
import { Skeleton } from '@heroui/react';
import CircuitBackground from './CircuitBackground';
import { Toaster, toast } from 'sonner';

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

// Loading Skeleton for Sign In Button
const SignInButtonSkeleton = () => (
    <div className="w-full">
        <Skeleton className="h-12 w-full rounded-lg" />
    </div>
);

export default function SignInContent() {
    // const [error, setError] = useState<string | null>(null); // Removed error state
    const [loading, setLoading] = useState(false);
    const [storageWarning, setStorageWarning] = useState(false);

    // Check sessionStorage accessibility on mount
    useEffect(() => {
        try {
            const testKey = '__firebase_test__';
            sessionStorage.setItem(testKey, 'test');
            sessionStorage.removeItem(testKey);
        } catch (e) {
            setStorageWarning(true);
            console.warn('SessionStorage is not accessible. This may cause authentication issues.');
        }
    }, []);

    // Extract invite ID from URL
    const getInviteId = () => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('invite');
    };

    const handleGoogleSignIn = async () => {
        // setError(null); // No longer needed
        setLoading(true);

        try {
            // Configure Google Auth Provider with custom parameters
            const provider = new GoogleAuthProvider();

            // Add custom parameters to improve compatibility
            provider.setCustomParameters({
                prompt: 'select_account', // Always show account selection
            });

            // Attempt sign in with popup using explicit resolver for better compatibility
            const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
            const idToken = await result.user.getIdToken();
            const inviteId = getInviteId();

            const response = await fetch('/api/set-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken, inviteId, signInMethod: 'google' }),
            });

            if (!response.ok) {
                throw new Error('Failed to set session');
            }

            window.location.href = '/overview';
        } catch (err: any) {
            console.error('Sign-in error:', err);

            // Handle specific Firebase Auth errors
            let errorMessage = 'Failed to sign in with Google';

            if (err.code === 'auth/popup-blocked') {
                errorMessage = 'Popup was blocked by your browser because of privacy settings. Please allow popups for this site.';
            } else if (err.code === 'auth/popup-closed-by-user') {
                errorMessage = 'Sign-in was cancelled.';
            } else if (err.code === 'auth/cancelled-popup-request') {
                errorMessage = 'Another sign-in popup is already open.';
            } else if (err.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your internet connection.';
            } else if (err.code === 'auth/internal-error' || err.message?.includes('initial state')) {
                errorMessage = 'Authentication error. Browser privacy settings might be blocking access.';
                setStorageWarning(true);
            } else if (err.message) {
                errorMessage = err.message;
            }

            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 overflow-hidden bg-gray-50">
            {/* Background Animation */}
            <CircuitBackground />
            <Toaster richColors />

            <div className="relative z-10 w-full max-w-md">
                <div className="bg-white/90 backdrop-blur-sm py-10 px-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-gray-900/5 sm:rounded-2xl sm:px-10">
                    {/* Header Section */}
                    <div className="mb-8 text-center">
                        <div className="flex justify-center mb-6">
                            <BlueIEEELogo className="w-24 h-24" />
                        </div>
                        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
                            Welcome
                        </h2>
                        <p className="text-sm text-gray-600">
                            Sign in to the <span className="font-semibold text-gray-800">IEEE Student Branch at UC San Diego</span> dashboard
                        </p>
                    </div>

                    <div>
                        {loading ? (
                            <SignInButtonSkeleton />
                        ) : (
                            <button
                                onClick={handleGoogleSignIn}
                                disabled={loading}
                                className="w-full relative flex justify-center items-center px-4 py-3.5 border border-transparent text-sm font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 shadow-md transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                                aria-label="Sign in with Google"
                            >
                                Continue with Google
                            </button>
                        )}
                    </div>

                    {storageWarning && (
                        <div className="mt-6 rounded-md bg-yellow-50 p-4 border border-yellow-200">
                            <div className="flex">
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">Browser Issue</h3>
                                    <div className="mt-2 text-sm text-yellow-700">
                                        <p>Your browser settings may be hindering the sign-in process.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 border-t border-gray-100 pt-6">
                        <div className="relative flex justify-center text-sm">
                            <span className="bg-white/50 px-2 text-gray-500">
                                Need access? <a href="mailto:ieee@ucsd.edu" className="font-semibold text-blue-600 hover:text-blue-500">Contact IEEE UCSD</a>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}