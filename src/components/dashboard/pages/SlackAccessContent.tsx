import React, { useState, useEffect } from 'react';
import { Mail, Key, Eye, EyeOff, AlertCircle, CheckCircle, Loader2, MessageSquare, Shield, RefreshCw, Inbox } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth } from '../../../firebase/client';
import DashboardHeader from '../DashboardHeader';
import type { User as UserType } from '../types/firestore';

interface EmailGenerationState {
    isGenerating: boolean;
    isResetting: boolean;
    generatedEmail: string | null;
    error: string | null;
    success: string | null;
}

interface EmailInboxState {
    isAuthenticated: boolean;
    isLoading: boolean;
    isRefreshing: boolean;
    emails: any[];
    error: string | null;
}

export default function SlackAccessContent() {
    const [user] = useAuthState(auth);
    const [userData, setUserData] = useState<UserType | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [customPassword, setCustomPassword] = useState('');
    const [emailState, setEmailState] = useState<EmailGenerationState>({
        isGenerating: false,
        isResetting: false,
        generatedEmail: null,
        error: null,
        success: null
    });
    const [inboxState, setInboxState] = useState<EmailInboxState>({
        isAuthenticated: false,
        isLoading: false,
        isRefreshing: false,
        emails: [],
        error: null
    });

    const db = getFirestore();

    useEffect(() => {
        if (!user) return;

        const fetchUserData = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data() as UserType & { hasIEEEEmail?: boolean; ieeeEmail?: string };
                    setUserData(data);

                    // If user already has an IEEE email, set it in the state
                    if (data.hasIEEEEmail && data.ieeeEmail) {
                        setEmailState(prev => ({
                            ...prev,
                            generatedEmail: data.ieeeEmail || null,
                            success: 'You already have an IEEE email account'
                        }));
                    }
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };

        fetchUserData();
    }, [user, db]);

    const extractUsername = (email: string): string => {
        return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    const generateIEEEEmail = async () => {
        if (!user || !userData) {
            setEmailState(prev => ({ ...prev, error: 'User authentication required' }));
            return;
        }

        // Validate email format
        if (!userData.email || !userData.email.includes('@')) {
            setEmailState(prev => ({ ...prev, error: 'Invalid user email format' }));
            return;
        }

        // Validate password
        if (!customPassword.trim()) {
            setEmailState(prev => ({ ...prev, error: 'Password is required' }));
            return;
        }

        if (customPassword.length < 8) {
            setEmailState(prev => ({ ...prev, error: 'Password must be at least 8 characters long' }));
            return;
        }

        setEmailState(prev => ({ ...prev, isGenerating: true, error: null, success: null }));

        try {
            const username = extractUsername(userData.email);
            const proposedEmail = `${username}@ieeeucsd.org`;

            // First check if the email already exists
            const checkResponse = await fetch('/api/check-email-exists', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: proposedEmail
                }),
            });

            if (checkResponse.ok) {
                const checkResult = await checkResponse.json();
                if (checkResult.exists) {
                    setEmailState(prev => ({
                        ...prev,
                        isGenerating: false,
                        error: `Email ${proposedEmail} already exists. Please contact webmaster@ieeeucsd.org for assistance.`
                    }));
                    return;
                }
            }

            // Proceed with email creation
            const response = await fetch('/api/create-ieee-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.uid,
                    name: userData.name,
                    email: userData.email,
                    password: customPassword
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                // Update Firebase to track that user has created IEEE email
                try {
                    const userRef = doc(db, 'users', user.uid);
                    await updateDoc(userRef, {
                        hasIEEEEmail: true,
                        ieeeEmail: result.data.ieeeEmail,
                        ieeeEmailCreatedAt: new Date()
                    });
                } catch (firebaseError) {
                    console.error('Error updating Firebase:', firebaseError);
                    // Don't fail the whole process if Firebase update fails
                }

                setEmailState(prev => ({
                    ...prev,
                    isGenerating: false,
                    generatedEmail: result.data.ieeeEmail,
                    success: result.data.message
                }));
                setCustomPassword(''); // Clear password field
            } else {
                setEmailState(prev => ({
                    ...prev,
                    isGenerating: false,
                    error: result.message || 'Failed to create IEEE email'
                }));
            }
        } catch (error) {
            console.error('Error creating IEEE email:', error);
            setEmailState(prev => ({
                ...prev,
                isGenerating: false,
                error: error instanceof Error ? error.message : 'Failed to create IEEE email. Please try again.'
            }));
        }
    };

    const resetEmailPassword = async () => {
        if (!emailState.generatedEmail) {
            setEmailState(prev => ({ ...prev, error: 'No IEEE email found to reset password for' }));
            return;
        }

        // Validate password
        if (!customPassword.trim()) {
            setEmailState(prev => ({ ...prev, error: 'Password is required for reset' }));
            return;
        }

        if (customPassword.length < 8) {
            setEmailState(prev => ({ ...prev, error: 'Password must be at least 8 characters long' }));
            return;
        }

        setEmailState(prev => ({ ...prev, isResetting: true, error: null, success: null }));

        try {
            const response = await fetch('/api/reset-email-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: emailState.generatedEmail,
                    password: customPassword
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                setEmailState(prev => ({
                    ...prev,
                    isResetting: false,
                    success: result.message
                }));
                setCustomPassword(''); // Clear password field
            } else {
                setEmailState(prev => ({
                    ...prev,
                    isResetting: false,
                    error: result.message || 'Failed to reset password'
                }));
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            setEmailState(prev => ({
                ...prev,
                isResetting: false,
                error: error instanceof Error ? error.message : 'Failed to reset password. Please try again.'
            }));
        }
    };

    const authenticateInbox = async () => {
        if (!emailState.generatedEmail) return;

        setInboxState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // Simulate IMAP authentication and email fetching
            // In a real implementation, this would connect to the email server
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Simulate successful authentication and email retrieval
            const mockEmails = [
                {
                    id: 1,
                    subject: 'Welcome to IEEE UCSD Slack Workspace',
                    from: 'slack-notifications@ieeeucsd.org',
                    date: new Date().toLocaleDateString(),
                    preview: 'You have been invited to join the IEEE UCSD Slack workspace. Click the link below to get started...',
                    isRead: false
                },
                {
                    id: 2,
                    subject: 'Slack Account Verification',
                    from: 'noreply@slack.com',
                    date: new Date(Date.now() - 86400000).toLocaleDateString(), // Yesterday
                    preview: 'Please verify your email address to complete your Slack account setup...',
                    isRead: true
                },
                {
                    id: 3,
                    subject: 'IEEE UCSD - Slack Access Instructions',
                    from: 'webmaster@ieeeatucsd.org',
                    date: new Date(Date.now() - 172800000).toLocaleDateString(), // 2 days ago
                    preview: 'Here are the instructions for accessing the IEEE UCSD Slack workspace using your new email...',
                    isRead: true
                }
            ];

            setInboxState(prev => ({
                ...prev,
                isLoading: false,
                isAuthenticated: true,
                emails: mockEmails
            }));
        } catch (error) {
            setInboxState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Failed to authenticate with email server. Please try again later.'
            }));
        }
    };

    const refreshInbox = async () => {
        if (!inboxState.isAuthenticated) return;

        setInboxState(prev => ({ ...prev, isRefreshing: true, error: null }));

        try {
            // Simulate refreshing emails
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Add a new mock email to simulate new messages
            const newEmail = {
                id: Date.now(),
                subject: 'New Slack Message Notification',
                from: 'notifications@slack.com',
                date: new Date().toLocaleDateString(),
                preview: 'You have new messages in the IEEE UCSD Slack workspace...',
                isRead: false
            };

            setInboxState(prev => ({
                ...prev,
                isRefreshing: false,
                emails: [newEmail, ...prev.emails]
            }));
        } catch (error) {
            setInboxState(prev => ({
                ...prev,
                isRefreshing: false,
                error: 'Failed to refresh inbox. Please try again.'
            }));
        }
    };

    if (!user || !userData) {
        return (
            <div className="p-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
                    <div className="space-y-4">
                        <div className="h-32 bg-gray-200 rounded"></div>
                        <div className="h-32 bg-gray-200 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    const username = extractUsername(userData.email);

    return (
        <div className="min-h-screen bg-gray-50">
            <DashboardHeader
                title="Slack Access"
                subtitle="Generate IEEE email for Slack authentication and manage your inbox"
                showSearch={false}
            />

            <div className="p-4 sm:p-6">

                {/* Disclaimer */}
                <div className="mb-6 lg:mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                        <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <h3 className="font-medium text-amber-800 mb-1">Important Notice</h3>
                            <p className="text-sm text-amber-700">
                                This email address is exclusively for Slack authentication and should not be used for any other purposes.
                                It provides access to the IEEE UCSD Slack workspace only.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Slack Workspace Information */}
                <div className="mb-6 lg:mb-8 bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                    <div className="flex items-center space-x-3 mb-4 sm:mb-6">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <MessageSquare className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">IEEE UCSD Slack Workspace</h2>
                            <p className="text-sm text-gray-600">Connect with fellow members and stay updated</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <h3 className="font-medium text-gray-900 mb-2">Workspace URL</h3>
                            <p className="text-sm text-gray-600">ieeeucsdofficers.slack.com</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <h3 className="font-medium text-gray-900 mb-2">Access Method</h3>
                            <p className="text-sm text-gray-600">Use your IEEE email to join</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <h3 className="font-medium text-gray-900 mb-2">Support</h3>
                            <p className="text-sm text-gray-600">Contact webmaster@ieeeucsd.org</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
                    {/* Email Generation Section */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                        <div className="flex items-center space-x-3 mb-4 sm:mb-6">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Mail className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">IEEE Email Generation</h2>
                                <p className="text-sm text-gray-600">Create your Slack-specific IEEE email</p>
                            </div>
                        </div>

                        {/* Current User Info */}
                        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
                            <h3 className="font-medium text-gray-900 mb-2">Your Information</h3>
                            <div className="space-y-1 text-sm">
                                <p><span className="font-medium">Name:</span> {userData.name}</p>
                                <p><span className="font-medium">Current Email:</span> {userData.email}</p>
                                <p><span className="font-medium">Proposed IEEE Email:</span> {username}@ieeeucsd.org</p>
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="mb-4 sm:mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Password <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={customPassword}
                                    onChange={(e) => setCustomPassword(e.target.value)}
                                    placeholder="Enter a secure password"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                >
                                    {showPassword ? (
                                        <EyeOff className="w-4 h-4 text-gray-400" />
                                    ) : (
                                        <Eye className="w-4 h-4 text-gray-400" />
                                    )}
                                </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Create a secure password for your IEEE email account. You'll use this to access your email and Slack.
                            </p>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={generateIEEEEmail}
                            disabled={emailState.isGenerating || !customPassword.trim()}
                            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                        >
                            {emailState.isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Generating...</span>
                                </>
                            ) : (
                                <>
                                    <Mail className="w-4 h-4" />
                                    <span>Generate IEEE Email</span>
                                </>
                            )}
                        </button>

                        {!customPassword.trim() && (
                            <p className="text-xs text-red-500 mt-2">
                                Please enter a password to generate your IEEE email
                            </p>
                        )}

                        {/* Success/Error Messages */}
                        {emailState.success && (
                            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                                <div className="flex items-start space-x-2">
                                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-green-700">{emailState.success}</p>
                                </div>
                            </div>
                        )}

                        {emailState.error && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                <div className="flex items-start space-x-2">
                                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-red-700">{emailState.error}</p>
                                </div>
                            </div>
                        )}

                        {/* Generated Email Display */}
                        {emailState.generatedEmail && (
                            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <h3 className="font-medium text-green-800 mb-2">Email Created Successfully!</h3>
                                <p className="text-sm text-green-700 mb-3">
                                    <span className="font-medium">IEEE Email:</span> {emailState.generatedEmail}
                                </p>

                                {/* Reset Password Button */}
                                <button
                                    onClick={resetEmailPassword}
                                    disabled={emailState.isResetting || !customPassword.trim()}
                                    className="bg-green-600 text-white py-1 px-3 rounded text-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                                >
                                    {emailState.isResetting ? (
                                        <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>Resetting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="w-3 h-3" />
                                            <span>Reset Password</span>
                                        </>
                                    )}
                                </button>

                                {!customPassword.trim() && (
                                    <p className="text-xs text-red-500 mt-1">
                                        Enter a new password to reset
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Email Inbox Preview Section */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <Inbox className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-gray-900">Email Inbox Preview</h2>
                                    <p className="text-sm text-gray-600">View your Slack-related emails</p>
                                </div>
                            </div>
                            {inboxState.isAuthenticated && (
                                <button
                                    onClick={refreshInbox}
                                    disabled={inboxState.isRefreshing}
                                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Refresh inbox"
                                >
                                    <RefreshCw className={`w-4 h-4 ${inboxState.isRefreshing ? 'animate-spin' : ''}`} />
                                </button>
                            )}
                        </div>

                        {!emailState.generatedEmail ? (
                            <div className="text-center py-8">
                                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-500">Generate an IEEE email first to access the inbox</p>
                            </div>
                        ) : !inboxState.isAuthenticated ? (
                            <div className="text-center py-8">
                                <button
                                    onClick={authenticateInbox}
                                    disabled={inboxState.isLoading}
                                    className="bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
                                >
                                    {inboxState.isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Authenticating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Key className="w-4 h-4" />
                                            <span>Access Inbox</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {inboxState.emails.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Inbox className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                        <p className="text-gray-500">No emails found</p>
                                    </div>
                                ) : (
                                    inboxState.emails.map((email) => (
                                        <div key={email.id} className={`p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors ${email.isRead ? 'border-gray-200 bg-white' : 'border-blue-200 bg-blue-50'
                                            }`}>
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex items-center space-x-2">
                                                    {!email.isRead && (
                                                        <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                                                    )}
                                                    <h4 className={`text-sm ${email.isRead ? 'font-normal text-gray-900' : 'font-semibold text-gray-900'}`}>
                                                        {email.subject}
                                                    </h4>
                                                </div>
                                                <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{email.date}</span>
                                            </div>
                                            <p className="text-xs text-gray-600 mb-1">From: {email.from}</p>
                                            <p className="text-sm text-gray-700 line-clamp-2">{email.preview}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {inboxState.error && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                                <div className="flex items-start space-x-2">
                                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-red-700">{inboxState.error}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Instructions Section */}
                <div className="mt-6 lg:mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">How to Join IEEE UCSD Slack</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">1</div>
                            <div>
                                <h3 className="font-medium text-gray-900 mb-1">Generate your IEEE email</h3>
                                <p className="text-sm text-gray-600">Use the form above to create your IEEE email address for Slack access.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">2</div>
                            <div>
                                <h3 className="font-medium text-gray-900 mb-1">Check your inbox</h3>
                                <p className="text-sm text-gray-600">Look for the Slack invitation email in your inbox preview or your personal email.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">3</div>
                            <div>
                                <h3 className="font-medium text-gray-900 mb-1">Join the workspace</h3>
                                <p className="text-sm text-gray-600">Click the invitation link and use your IEEE email to join ieeeucsdofficers.slack.com.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">4</div>
                            <div>
                                <h3 className="font-medium text-gray-900 mb-1">Start collaborating</h3>
                                <p className="text-sm text-gray-600">Connect with other IEEE UCSD members and participate in discussions.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
