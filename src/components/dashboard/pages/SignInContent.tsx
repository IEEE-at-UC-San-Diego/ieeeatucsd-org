import React, { useState } from 'react';
import { auth, signInWithPopup, GoogleAuthProvider } from '../../../firebase/client';
import { Skeleton } from '../../ui/skeleton';

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

// Google Icon SVG Component
const GoogleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12.545,10.917v2.919h4.74c-0.195,1.248-1.458,3.656-4.74,3.656c-2.853,0-5.182-2.363-5.182-5.275c0-2.912,2.329-5.275,5.182-5.275c1.625,0,3.058,0.55,4.204,1.626l-3.04,2.919C13.862,9.292,13.254,10.917,12.545,10.917z" fill="#EB4335" />
        <path d="M12,20.75c4.125,0,7.583-1.366,7.583-7.583c0-0.5-0.046-0.991-0.133-1.458H12v2.919h4.74c-0.195,1.248-1.458,3.656-4.74,3.656C8.692,16.5,6.818,14.137,6.818,12c0-2.912,2.329-5.275,5.182-5.275c1.625,0,3.058,0.55,4.204,1.626l-3.04,2.919C13.862,9.292,13.254,10.917,12.545,10.917v2.919h4.74c-0.195,1.248-1.458,3.656-4.74,3.656C8.692,16.5,6.818,14.137,6.818,12z" fill="#34A853" />
        <path d="M12,20.75c4.125,0,7.583-1.366,7.583-7.583c0-0.5-0.046-0.991-0.133-1.458H12v2.919h4.74c-0.195,1.248-1.458,3.656-4.74,3.656C8.692,16.5,6.818,14.137,6.818,12c0-2.912,2.329-5.275,5.182-5.275c1.625,0,3.058,0.55,4.204,1.626l-3.04,2.919C13.862,9.292,13.254,10.917,12.545,10.917v2.919h4.74c-0.195,1.248-1.458,3.656-4.74,3.656C8.692,16.5,6.818,14.137,6.818,12z" fill="#4285F4" />
        <path d="M12,20.75c4.125,0,7.583-1.366,7.583-7.583c0-0.5-0.046-0.991-0.133-1.458H12v2.919h4.74c-0.195,1.248-1.458,3.656-4.74,3.656C8.692,16.5,6.818,14.137,6.818,12c0-2.912,2.329-5.275,5.182-5.275c1.625,0,3.058,0.55,4.204,1.626l-3.04,2.919C13.862,9.292,13.254,10.917,12.545,10.917v2.919h4.74c-0.195,1.248-1.458,3.656-4.74,3.656C8.692,16.5,6.818,14.137,6.818,12z" fill="#FBBC05" />
    </svg>
);

// Loading Skeleton for Sign In Button
const SignInButtonSkeleton = () => (
    <div className="w-full">
        <Skeleton className="h-12 w-full rounded-xl" />
    </div>
);

export default function SignInContent() {
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Extract invite ID from URL
    const getInviteId = () => {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('invite');
    };

    const handleGoogleSignIn = async () => {
        setError(null);
        setLoading(true);

        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
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

            window.location.href = '/dashboard/overview';
        } catch (err: any) {
            setError(err.message || 'Failed to sign in with Google');
        } finally {
            setLoading(false);
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
                            Welcome to IEEE UCSD
                        </h1>
                        <p className="text-gray-600 text-sm mb-3">
                            Sign in to access your dashboard
                        </p>
                        <div className="bg-ieee-blue-50 border border-ieee-blue-100 rounded-lg p-3 mb-2">
                            <p className="text-ieee-blue-700 text-xs font-medium">
                                💡 Recommended: Use your UCSD Google account (@ucsd.edu) for seamless access
                            </p>
                        </div>
                    </div>

                    {/* Sign In Section */}
                    <div className="px-8 pb-8">
                        {loading ? (
                            <SignInButtonSkeleton />
                        ) : (
                            <button
                                onClick={handleGoogleSignIn}
                                disabled={loading}
                                className="w-full flex items-center justify-center px-6 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ieee-blue-100 transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed group"
                                aria-label="Sign in with Google"
                            >
                                <span>Continue with Google</span>
                            </button>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div
                                className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"
                                role="alert"
                                aria-live="polite"
                            >
                                <p className="text-sm text-red-600 text-center">{error}</p>
                            </div>
                        )}

                        {/* Security Notice */}
                        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start">
                                <div className="flex-shrink-0">
                                    <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <h3 className="text-sm font-medium text-blue-800">
                                        Secure Authentication
                                    </h3>
                                    <p className="text-xs text-blue-700 mt-1">
                                        Your sign-in is protected by Google's security systems and IEEE UCSD's authentication protocols.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-white/80">
                        Need access?{' '}
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
                        By signing in, you agree to IEEE UCSD's terms of service and privacy policy.
                    </p>
                </div>
            </div>
        </div>
    );
} 