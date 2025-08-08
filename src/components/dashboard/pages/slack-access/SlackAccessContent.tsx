import React, { useState, useEffect } from 'react';
import { Mail, Key, Eye, EyeOff, AlertCircle, CheckCircle, Loader2, MessageSquare, Shield, RefreshCw, Inbox, X, Paperclip, Check, Download, FileText, File, Image, FileVideo, FileAudio, Archive, ExternalLink } from 'lucide-react';
import DOMPurify from 'dompurify';
import { useAuthState } from 'react-firebase-hooks/auth';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth } from '../../../../firebase/client';
import DashboardHeader from '../../shared/DashboardHeader';
import type { User as UserType, UserRole } from '../../shared/types/firestore';

interface EmailGenerationState {
    isGenerating: boolean;
    isResetting: boolean;
    generatedEmail: string | null;
    error: string | null;
    success: string | null;
}

interface EmailMessage {
    id: string;
    subject: string;
    from: string;
    date: string;
    preview: string;
    isRead: boolean;
    uid: number;
    attachmentCount?: number;
}

interface EmailInboxState {
    isAuthenticated: boolean;
    isLoading: boolean;
    isRefreshing: boolean;
    emails: EmailMessage[];
    error: string | null;
    credentials: {
        email: string;
        password: string;
    } | null;
}

export default function SlackAccessContent() {
    const [user] = useAuthState(auth);
    const [userData, setUserData] = useState<UserType | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [customPassword, setCustomPassword] = useState('');
    const [passwordValidation, setPasswordValidation] = useState({ isValid: false, strength: 0, requirements: { minLength: false, hasUppercase: false, hasLowercase: false, hasNumber: false, hasSpecialChar: false } });

    // Separate state for inbox authentication password
    const [showInboxPassword, setShowInboxPassword] = useState(false);
    const [inboxPassword, setInboxPassword] = useState('');
    const [inboxPasswordValidation, setInboxPasswordValidation] = useState({ isValid: false, strength: 0, requirements: { minLength: false, hasUppercase: false, hasLowercase: false, hasNumber: false, hasSpecialChar: false } });

    // Email pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [emailsPerPage] = useState(12); // 12 emails per page for good grid layout

    const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
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
        error: null,
        credentials: null
    });

    const db = getFirestore();

    // Check if user can reset password (officers and above)
    const canResetPassword = userData?.role && ['General Officer', 'Executive Officer', 'Past Officer', 'Administrator'].includes(userData.role);

    useEffect(() => {
        if (!user) return;

        const fetchUserData = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data() as UserType & { hasIEEEEmail?: boolean; ieeeEmail?: string; ieeeEmailCreatedAt?: any };
                    setUserData(data);


                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };

        fetchUserData();
    }, [user, db]);

    // Update password validation when passwords change
    useEffect(() => {
        setPasswordValidation(validatePassword(customPassword));
    }, [customPassword]);

    useEffect(() => {
        setInboxPasswordValidation(validatePassword(inboxPassword));
    }, [inboxPassword]);

    // Reset pagination when emails change
    useEffect(() => {
        setCurrentPage(1);
    }, [inboxState.emails.length]);

    const extractUsername = (email: string): string => {
        return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    // Password validation functions
    const validatePassword = (password: string) => {
        const requirements = {
            minLength: password.length >= 8,
            hasUppercase: /[A-Z]/.test(password),
            hasLowercase: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)
        };

        const isValid = Object.values(requirements).every(req => req);
        const strength = Object.values(requirements).filter(req => req).length;

        return {
            isValid,
            strength,
            requirements
        };
    };



    const openEmailModal = (email: EmailMessage) => {
        setSelectedEmail(email);
        setIsModalOpen(true);
    };

    const closeEmailModal = () => {
        setSelectedEmail(null);
        setIsModalOpen(false);
    };

    // Keyboard event handlers
    const handleIEEEPasswordKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (userData?.hasIEEEEmail) {
                // Trigger password reset if user has IEEE email
                if (!emailState.isResetting && customPassword.trim() && passwordValidation.isValid) {
                    resetEmailPassword();
                }
            } else {
                // Trigger email generation if user doesn't have IEEE email
                if (!emailState.isGenerating && customPassword.trim() && passwordValidation.isValid) {
                    generateIEEEEmail();
                }
            }
        }
    };

    const handleInboxPasswordKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Trigger inbox authentication
            if (!inboxState.isLoading && inboxPassword.trim()) {
                authenticateInbox();
            }
        }
    };

    // Pagination helper functions
    const getPaginatedEmails = () => {
        const startIndex = (currentPage - 1) * emailsPerPage;
        const endIndex = startIndex + emailsPerPage;
        return inboxState.emails.slice(startIndex, endIndex);
    };

    const getTotalPages = () => {
        return Math.ceil(inboxState.emails.length / emailsPerPage);
    };

    const goToPage = (page: number) => {
        setCurrentPage(page);
    };

    const goToPreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const goToNextPage = () => {
        if (currentPage < getTotalPages()) {
            setCurrentPage(currentPage + 1);
        }
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

        const validation = validatePassword(customPassword);
        if (!validation.isValid) {
            const missingRequirements: string[] = [];
            if (!validation.requirements.minLength) missingRequirements.push('at least 8 characters');
            if (!validation.requirements.hasUppercase) missingRequirements.push('an uppercase letter');
            if (!validation.requirements.hasLowercase) missingRequirements.push('a lowercase letter');
            if (!validation.requirements.hasNumber) missingRequirements.push('a number');
            if (!validation.requirements.hasSpecialChar) missingRequirements.push('a special character');

            setEmailState(prev => ({
                ...prev,
                error: `Password must contain ${missingRequirements.join(', ')}.`
            }));
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
                        error: `Email ${proposedEmail} already exists. Please contact webmaster@ieeeatucsd.org for assistance.`
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
        const ieeeEmail = emailState.generatedEmail || userData?.ieeeEmail;
        if (!ieeeEmail) {
            setEmailState(prev => ({ ...prev, error: 'No IEEE email found to reset password for' }));
            return;
        }

        // Validate password
        if (!customPassword.trim()) {
            setEmailState(prev => ({ ...prev, error: 'Password is required for reset' }));
            return;
        }

        const validation = validatePassword(customPassword);
        if (!validation.isValid) {
            const missingRequirements: string[] = [];
            if (!validation.requirements.minLength) missingRequirements.push('at least 8 characters');
            if (!validation.requirements.hasUppercase) missingRequirements.push('an uppercase letter');
            if (!validation.requirements.hasLowercase) missingRequirements.push('a lowercase letter');
            if (!validation.requirements.hasNumber) missingRequirements.push('a number');
            if (!validation.requirements.hasSpecialChar) missingRequirements.push('a special character');

            setEmailState(prev => ({
                ...prev,
                error: `Password must contain ${missingRequirements.join(', ')}.`
            }));
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
                    email: ieeeEmail,
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
        const ieeeEmail = emailState.generatedEmail || userData?.ieeeEmail;
        if (!ieeeEmail || !inboxPassword.trim()) {
            setInboxState(prev => ({
                ...prev,
                error: 'IEEE email and password are required to access inbox'
            }));
            return;
        }

        setInboxState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const response = await fetch('/api/fetch-emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: ieeeEmail,
                    password: inboxPassword
                }),
            });

            const result = await response.json();

            if (result.success) {
                setInboxState(prev => ({
                    ...prev,
                    isLoading: false,
                    isAuthenticated: true,
                    emails: result.emails || [],
                    credentials: {
                        email: ieeeEmail,
                        password: inboxPassword
                    }
                }));
                setInboxPassword(''); // Clear inbox password for security
            } else {
                const errorMessage = result.message || 'Failed to authenticate with email server';
                const isAuthError = errorMessage.toLowerCase().includes('authentication') ||
                    errorMessage.toLowerCase().includes('password') ||
                    errorMessage.toLowerCase().includes('login');

                setInboxState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: isAuthError
                        ? 'Login failed. Please check your password and try again. If the issue persists, contact webmaster@ieeeatucsd.org for assistance.'
                        : 'Connection failed. Please try again. If the issue persists, contact webmaster@ieeeatucsd.org for assistance.'
                }));
            }
        } catch (error) {
            console.error('Error authenticating inbox:', error);
            setInboxState(prev => ({
                ...prev,
                isLoading: false,
                error: 'Connection failed. Please try again. If the issue persists, contact webmaster@ieeeatucsd.org for assistance.'
            }));
        }
    };

    const refreshInbox = async () => {
        if (!inboxState.isAuthenticated || !inboxState.credentials) return;

        setInboxState(prev => ({ ...prev, isRefreshing: true, error: null }));

        try {
            const response = await fetch('/api/fetch-emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: inboxState.credentials.email,
                    password: inboxState.credentials.password
                }),
            });

            const result = await response.json();

            if (result.success) {
                setInboxState(prev => ({
                    ...prev,
                    isRefreshing: false,
                    emails: result.emails || []
                }));
            } else {
                setInboxState(prev => ({
                    ...prev,
                    isRefreshing: false,
                    error: 'Failed to refresh inbox. Please try again. If the issue persists, contact webmaster@ieeeatucsd.org for assistance.'
                }));
            }
        } catch (error) {
            console.error('Error refreshing inbox:', error);
            setInboxState(prev => ({
                ...prev,
                isRefreshing: false,
                error: 'Failed to refresh inbox. Please try again. If the issue persists, contact webmaster@ieeeatucsd.org for assistance.'
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
                            <p className="text-sm text-gray-600">Contact webmaster@ieeeatucsd.org</p>
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
                                <h2 className="text-lg font-semibold text-gray-900">
                                    {userData.hasIEEEEmail ? 'IEEE Email Management' : 'IEEE Email Generation'}
                                </h2>
                                <p className="text-sm text-gray-600">
                                    {userData.hasIEEEEmail ? 'Manage your existing IEEE email' : 'Create your Slack-specific IEEE email'}
                                </p>
                            </div>
                        </div>

                        {/* Current User Info */}
                        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
                            <h3 className="font-medium text-gray-900 mb-2">Your Information</h3>
                            <div className="space-y-1 text-sm">
                                <p><span className="font-medium">Name:</span> {userData.name}</p>
                                <p><span className="font-medium">Personal Email:</span> {userData.email}</p>
                                {userData.hasIEEEEmail ? (
                                    <>
                                        <p><span className="font-medium">IEEE Email:</span> {userData.ieeeEmail}</p>
                                        <p><span className="font-medium">Created:</span> {userData.ieeeEmailCreatedAt ? new Date(userData.ieeeEmailCreatedAt.toDate()).toLocaleDateString() : 'Unknown'}</p>
                                    </>
                                ) : (
                                    <p><span className="font-medium">Proposed IEEE Email:</span> {username}@ieeeucsd.org</p>
                                )}
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="mb-4 sm:mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                {userData.hasIEEEEmail ? 'New Password' : 'Password'} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={customPassword}
                                    onChange={(e) => setCustomPassword(e.target.value)}
                                    onKeyDown={handleIEEEPasswordKeyDown}
                                    placeholder={userData?.hasIEEEEmail ? "Enter new password" : "Enter a secure password"}
                                    required
                                    disabled={userData?.hasIEEEEmail && !canResetPassword}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 disabled:bg-gray-100 disabled:cursor-not-allowed"
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

                            {/* Password Strength Indicator */}
                            {customPassword && (
                                <PasswordStrengthIndicator validation={passwordValidation} />
                            )}

                            <p className="text-xs text-gray-500 mt-2">
                                {userData.hasIEEEEmail
                                    ? canResetPassword
                                        ? 'Enter a new secure password to reset your IEEE email password.'
                                        : 'Password reset is only available to officers and administrators.'
                                    : 'Create a secure password for your IEEE email account. You\'ll use this to access your email and Slack.'
                                }
                            </p>
                        </div>

                        {/* Action Button */}
                        {userData.hasIEEEEmail ? (
                            canResetPassword ? (
                                <button
                                    onClick={resetEmailPassword}
                                    disabled={emailState.isResetting || !customPassword.trim() || !passwordValidation.isValid}
                                    className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                                >
                                    {emailState.isResetting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Resetting Password...</span>
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="w-4 h-4" />
                                            <span>Reset Password</span>
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="w-full p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                    <div className="flex items-start space-x-3">
                                        <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-medium text-amber-800 mb-1">Password Reset Restricted</h4>
                                            <p className="text-sm text-amber-700">
                                                Only officers and administrators can reset their IEEE email passwords.
                                                Please contact an administrator for assistance.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )
                        ) : (
                            <button
                                onClick={generateIEEEEmail}
                                disabled={emailState.isGenerating || !customPassword.trim() || !passwordValidation.isValid}
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

                        {/* Generated Email Display - Only show for new email creation */}
                        {emailState.generatedEmail && !userData.hasIEEEEmail && (
                            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <h3 className="font-medium text-green-800 mb-2">Email Created Successfully!</h3>
                                <p className="text-sm text-green-700">
                                    <span className="font-medium">IEEE Email:</span> {emailState.generatedEmail}
                                </p>
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

                        {(!emailState.generatedEmail && !userData.hasIEEEEmail) ? (
                            <div className="text-center py-8">
                                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-500">Generate an IEEE email first to access the inbox</p>
                            </div>
                        ) : !inboxState.isAuthenticated ? (
                            <div className="text-center py-8">
                                <div className="max-w-sm mx-auto space-y-4">
                                    <div>
                                        <Key className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                                        <p className="text-gray-600 mb-2">Enter your IEEE email password to access the inbox</p>
                                        <p className="text-sm text-gray-500 mb-4">
                                            Email: {emailState.generatedEmail || userData?.ieeeEmail}
                                        </p>
                                    </div>

                                    <div className="relative">
                                        <input
                                            type={showInboxPassword ? 'text' : 'password'}
                                            value={inboxPassword}
                                            onChange={(e) => setInboxPassword(e.target.value)}
                                            onKeyDown={handleInboxPasswordKeyDown}
                                            placeholder="Enter your IEEE email password"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowInboxPassword(!showInboxPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                        >
                                            {showInboxPassword ? (
                                                <EyeOff className="w-4 h-4 text-gray-400" />
                                            ) : (
                                                <Eye className="w-4 h-4 text-gray-400" />
                                            )}
                                        </button>
                                    </div>

                                    <button
                                        onClick={authenticateInbox}
                                        disabled={inboxState.isLoading || !inboxPassword.trim()}
                                        className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
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

                                    {!customPassword.trim() && (
                                        <p className="text-xs text-red-500">
                                            Password is required to access your inbox
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {inboxState.isRefreshing && (
                                    <div className="text-center py-4">
                                        <Loader2 className="w-6 h-6 animate-spin text-purple-600 mx-auto mb-2" />
                                        <p className="text-sm text-gray-600">Refreshing emails...</p>
                                    </div>
                                )}

                                {inboxState.emails.length === 0 && !inboxState.isRefreshing ? (
                                    <div className="text-center py-8">
                                        <Inbox className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                        <p className="text-gray-500">No emails found in your inbox</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Try refreshing or check if you have received any Slack invitations
                                        </p>
                                    </div>
                                ) : inboxState.emails.length > 0 ? (
                                    <>
                                        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2 text-xs text-purple-700">
                                                    <MessageSquare className="w-3 h-3" />
                                                    <span>Slack-related emails are marked with this icon</span>
                                                </div>
                                                <div className="text-xs text-gray-600">
                                                    {inboxState.emails.length} email{inboxState.emails.length !== 1 ? 's' : ''} total
                                                </div>
                                            </div>
                                        </div>

                                        {/* Email Grid */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                            {getPaginatedEmails().map((email) => {
                                                // Check if email is Slack-related
                                                const isSlackRelated =
                                                    email.subject.toLowerCase().includes('slack') ||
                                                    email.from.toLowerCase().includes('slack') ||
                                                    email.from.toLowerCase().includes('ieeeucsd');

                                                return (
                                                    <div
                                                        key={email.id}
                                                        onClick={() => openEmailModal(email)}
                                                        className={`p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer ${email.isRead ? 'border-gray-200 bg-white' : 'border-blue-200 bg-blue-50'
                                                            }`}>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                                {!email.isRead && (
                                                                    <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                                                                )}
                                                                {isSlackRelated && (
                                                                    <MessageSquare className="w-3 h-3 text-purple-600 flex-shrink-0" />
                                                                )}
                                                                <h4 className={`text-sm truncate ${email.isRead ? 'font-normal text-gray-900' : 'font-semibold text-gray-900'}`}>
                                                                    {email.subject}
                                                                </h4>
                                                            </div>
                                                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{email.date}</span>
                                                        </div>
                                                        <p className="text-xs text-gray-600 mb-2 truncate">From: {email.from}</p>
                                                        <p className="text-sm text-gray-700 line-clamp-3 mb-2">{email.preview}</p>
                                                        <p className="text-xs text-blue-600">Click to view full email</p>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Pagination */}
                                        {getTotalPages() > 1 && (
                                            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={goToPreviousPage}
                                                        disabled={currentPage === 1}
                                                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Previous
                                                    </button>
                                                    <button
                                                        onClick={goToNextPage}
                                                        disabled={currentPage === getTotalPages()}
                                                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-sm text-gray-600">
                                                        Page {currentPage} of {getTotalPages()}
                                                    </span>
                                                    <div className="flex space-x-1">
                                                        {Array.from({ length: Math.min(5, getTotalPages()) }, (_, i) => {
                                                            const pageNum = i + 1;
                                                            return (
                                                                <button
                                                                    key={pageNum}
                                                                    onClick={() => goToPage(pageNum)}
                                                                    className={`w-8 h-8 text-sm rounded ${currentPage === pageNum
                                                                        ? 'bg-purple-600 text-white'
                                                                        : 'border border-gray-300 hover:bg-gray-50'
                                                                        }`}
                                                                >
                                                                    {pageNum}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : null}
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
                                <h3 className="font-medium text-gray-900 mb-1">Sign up for Slack</h3>
                                <p className="text-sm text-gray-600">Use the ieeeucsd.org email to sign up for Slack.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">3</div>
                            <div>
                                <h3 className="font-medium text-gray-900 mb-1">Use the email reader to read Slack</h3>
                                <p className="text-sm text-gray-600">Read the Slack confirmation email in your inbox preview.</p>
                            </div>
                        </div>
                        <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">4</div>
                            <div>
                                <h3 className="font-medium text-gray-900 mb-1">Start collaborating</h3>
                                <p className="text-sm text-gray-600">Connect with other IEEE UCSD members and participate in the different channels.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Email Modal */}
            {isModalOpen && selectedEmail && (
                <EmailModal
                    email={selectedEmail}
                    credentials={inboxState.credentials}
                    onClose={closeEmailModal}
                />
            )}
        </div>
    );
}

// Password Strength Indicator Component
interface PasswordStrengthIndicatorProps {
    validation: {
        isValid: boolean;
        strength: number;
        requirements: {
            minLength: boolean;
            hasUppercase: boolean;
            hasLowercase: boolean;
            hasNumber: boolean;
            hasSpecialChar: boolean;
        };
    };
}

function PasswordStrengthIndicator({ validation }: PasswordStrengthIndicatorProps) {
    const getStrengthColor = (strength: number) => {
        if (strength <= 2) return 'bg-red-500';
        if (strength <= 3) return 'bg-yellow-500';
        if (strength <= 4) return 'bg-blue-500';
        return 'bg-green-500';
    };

    const getStrengthText = (strength: number) => {
        if (strength <= 2) return 'Weak';
        if (strength <= 3) return 'Fair';
        if (strength <= 4) return 'Good';
        return 'Strong';
    };

    return (
        <div className="mt-2 space-y-2">
            {/* Strength Bar */}
            <div className="flex items-center space-x-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(validation.strength)}`}
                        style={{ width: `${(validation.strength / 5) * 100}%` }}
                    />
                </div>
                <span className={`text-xs font-medium ${validation.strength <= 2 ? 'text-red-600' : validation.strength <= 3 ? 'text-yellow-600' : validation.strength <= 4 ? 'text-blue-600' : 'text-green-600'}`}>
                    {getStrengthText(validation.strength)}
                </span>
            </div>

            {/* Requirements List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                <div className={`flex items-center space-x-1 ${validation.requirements.minLength ? 'text-green-600' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 ${validation.requirements.minLength ? 'text-green-600' : 'text-gray-400'}`} />
                    <span>8+ characters</span>
                </div>
                <div className={`flex items-center space-x-1 ${validation.requirements.hasUppercase ? 'text-green-600' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 ${validation.requirements.hasUppercase ? 'text-green-600' : 'text-gray-400'}`} />
                    <span>Uppercase letter</span>
                </div>
                <div className={`flex items-center space-x-1 ${validation.requirements.hasLowercase ? 'text-green-600' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 ${validation.requirements.hasLowercase ? 'text-green-600' : 'text-gray-400'}`} />
                    <span>Lowercase letter</span>
                </div>
                <div className={`flex items-center space-x-1 ${validation.requirements.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 ${validation.requirements.hasNumber ? 'text-green-600' : 'text-gray-400'}`} />
                    <span>Number</span>
                </div>
                <div className={`flex items-center space-x-1 ${validation.requirements.hasSpecialChar ? 'text-green-600' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 ${validation.requirements.hasSpecialChar ? 'text-green-600' : 'text-gray-400'}`} />
                    <span>Special character</span>
                </div>
            </div>
        </div>
    );
}

// Email Modal Component
interface EmailModalProps {
    email: EmailMessage;
    credentials: { email: string; password: string } | null;
    onClose: () => void;
}

// Helper function to get file type icon
const getFileTypeIcon = (contentType: string, filename: string) => {
    const type = contentType.toLowerCase();
    const ext = filename.toLowerCase().split('.').pop() || '';

    if (type.includes('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
        return <Image className="w-4 h-4 text-blue-500" />;
    }
    if (type.includes('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv'].includes(ext)) {
        return <FileVideo className="w-4 h-4 text-purple-500" />;
    }
    if (type.includes('audio/') || ['mp3', 'wav', 'flac', 'aac'].includes(ext)) {
        return <FileAudio className="w-4 h-4 text-green-500" />;
    }
    if (type.includes('application/pdf') || ext === 'pdf') {
        return <FileText className="w-4 h-4 text-red-500" />;
    }
    if (type.includes('application/zip') || type.includes('application/x-rar') || ['zip', 'rar', '7z', 'tar'].includes(ext)) {
        return <Archive className="w-4 h-4 text-orange-500" />;
    }
    if (type.includes('application/msword') || type.includes('application/vnd.openxmlformats-officedocument') || ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
        return <FileText className="w-4 h-4 text-blue-600" />;
    }
    return <File className="w-4 h-4 text-gray-500" />;
};

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

function EmailModal({ email, credentials, onClose }: EmailModalProps) {
    const [emailContent, setEmailContent] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'html' | 'text'>('html');

    useEffect(() => {
        const fetchEmailContent = async () => {
            if (!credentials) {
                setError('Authentication required to view email content');
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch('/api/fetch-email-content', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: credentials.email,
                        password: credentials.password,
                        uid: email.uid
                    }),
                });

                const result = await response.json();

                if (result.success) {
                    setEmailContent(result.emailContent);
                    // Set default view mode based on available content
                    if (result.emailContent.htmlContent) {
                        setViewMode('html');
                    } else if (result.emailContent.textContent) {
                        setViewMode('text');
                    }
                } else {
                    setError(result.message || 'Unable to load email content. Please try again.');
                }
            } catch (err) {
                console.error('Error fetching email content:', err);
                setError('Network error occurred while loading email. Please check your connection and try again.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchEmailContent();
    }, [email.uid, credentials]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <style>{`
                .email-content img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    transition: transform 0.2s ease;
                }
                .email-content img:hover {
                    transform: scale(1.02);
                    cursor: pointer;
                }
                .email-content img[src=""], .email-content img:not([src]) {
                    display: none;
                }
                .email-content table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 16px 0;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .email-content td, .email-content th {
                    padding: 12px;
                    border: 1px solid #e5e7eb;
                    text-align: left;
                }
                .email-content th {
                    background-color: #f9fafb;
                    font-weight: 600;
                }
                .email-content a {
                    color: #2563eb;
                    text-decoration: none;
                    border-bottom: 1px solid transparent;
                    transition: all 0.2s ease;
                }
                .email-content a:hover {
                    color: #1d4ed8;
                    border-bottom-color: #1d4ed8;
                }
                .email-content a[href^="http"]:not([href*="${window.location.hostname}"])::after {
                    content: " ↗";
                    font-size: 0.8em;
                    opacity: 0.7;
                }
                .email-content blockquote {
                    border-left: 4px solid #3b82f6;
                    padding-left: 16px;
                    margin: 16px 0;
                    background-color: #f8fafc;
                    padding: 16px;
                    border-radius: 0 8px 8px 0;
                    font-style: italic;
                }
                .email-content ul, .email-content ol {
                    padding-left: 24px;
                    margin: 12px 0;
                }
                .email-content li {
                    margin: 4px 0;
                }
                .email-content h1, .email-content h2, .email-content h3, .email-content h4, .email-content h5, .email-content h6 {
                    margin: 20px 0 12px 0;
                    font-weight: 600;
                    line-height: 1.3;
                }
                .email-content p {
                    margin: 12px 0;
                    line-height: 1.6;
                }
            `}</style>
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                {/* Clean Modal Header */}
                <div className="bg-white border-b border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Mail className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Email Details</h2>
                                <p className="text-gray-600 text-sm">
                                    {email.subject.length > 50 ? `${email.subject.substring(0, 50)}...` : email.subject}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 group"
                            >
                                <X className="w-5 h-5 text-gray-600 group-hover:text-gray-800" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Modal Content */}
                <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 px-6">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-pulse"></div>
                                <div className="absolute inset-0 w-16 h-16 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
                            </div>
                            <div className="mt-6 text-center">
                                <h3 className="text-lg font-medium text-gray-900 mb-2">Loading Email Content</h3>
                                <p className="text-gray-600">Please wait while we fetch your email...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="p-8">
                            <div className="max-w-md mx-auto text-center">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertCircle className="w-8 h-8 text-red-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Email</h3>
                                <p className="text-gray-600 mb-6">{error}</p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Try Again
                                </button>
                            </div>
                        </div>
                    ) : emailContent ? (
                        <div className="p-6">
                            {/* Enhanced Email Headers */}
                            <div className="mb-6 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 border border-gray-200">
                                <div className="flex flex-col space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-lg font-semibold text-gray-900 leading-tight mb-1">
                                                {emailContent.subject}
                                            </h3>
                                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                                                <span className="font-medium">From:</span>
                                                <span className="text-gray-800">{emailContent.from}</span>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0">
                                            <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full border">
                                                {new Date(emailContent.date).toLocaleDateString('en-US', {
                                                    weekday: 'short',
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                                        <span className="font-medium">To:</span>
                                        <span className="text-gray-800">{emailContent.to}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Attachments */}
                            {emailContent.attachments && emailContent.attachments.length > 0 && (
                                <div className="mb-6">
                                    <div className="flex items-center space-x-2 mb-4">
                                        <div className="p-1.5 bg-blue-100 rounded-lg">
                                            <Paperclip className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <h4 className="text-sm font-semibold text-gray-900">
                                            {emailContent.attachments.length} Attachment{emailContent.attachments.length > 1 ? 's' : ''}
                                        </h4>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {emailContent.attachments.map((attachment: any, index: number) => (
                                            <div key={index} className="group flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200">
                                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                    <div className="flex-shrink-0">
                                                        {getFileTypeIcon(attachment.contentType, attachment.filename)}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-900 transition-colors">
                                                            {attachment.filename.length > 25 ? `${attachment.filename.substring(0, 22)}...${attachment.filename.split('.').pop()}` : attachment.filename}
                                                        </p>
                                                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                                                            <span className="px-2 py-0.5 bg-white rounded-full border text-xs">
                                                                {attachment.contentType.split('/')[1]?.toUpperCase() || 'FILE'}
                                                            </span>
                                                            <span>•</span>
                                                            <span className="font-medium">{formatFileSize(attachment.size)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    className="p-2 hover:bg-blue-100 rounded-lg transition-colors duration-200 group-hover:bg-blue-100"
                                                    title="Download attachment (feature coming soon)"
                                                    disabled
                                                >
                                                    <Download className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Enhanced Email Content */}
                            <div className="border-t border-gray-200 pt-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-2">
                                        <div className="p-1.5 bg-green-100 rounded-lg">
                                            <Mail className="w-4 h-4 text-green-600" />
                                        </div>
                                        <h4 className="text-sm font-semibold text-gray-900">Message Content</h4>
                                    </div>
                                    {emailContent && (emailContent.htmlContent || emailContent.textContent) && (emailContent.htmlContent && emailContent.textContent) && (
                                        <div className="flex bg-gradient-to-r from-gray-100 to-blue-100 rounded-lg p-1 border border-gray-200">
                                            <button
                                                onClick={() => setViewMode('html')}
                                                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all duration-200 ${viewMode === 'html'
                                                    ? 'bg-white text-blue-600 shadow-sm border border-blue-200'
                                                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                                                    }`}
                                            >
                                                Rich View
                                            </button>
                                            <button
                                                onClick={() => setViewMode('text')}
                                                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all duration-200 ${viewMode === 'text'
                                                    ? 'bg-white text-blue-600 shadow-sm border border-blue-200'
                                                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                                                    }`}
                                            >
                                                Plain Text
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Enhanced Content Display */}
                                {viewMode === 'html' && emailContent.htmlContent ? (
                                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        <div
                                            className="prose prose-sm max-w-none p-6 email-content"
                                            dangerouslySetInnerHTML={{
                                                __html: DOMPurify.sanitize(emailContent.htmlContent, {
                                                    ALLOWED_TAGS: [
                                                        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
                                                        'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                                                        'blockquote', 'div', 'span', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot',
                                                        'img', 'figure', 'figcaption', 'pre', 'code', 'hr', 'sub', 'sup',
                                                        'small', 'mark', 'ins', 'abbr', 'cite', 'q', 'dfn', 'time'
                                                    ],
                                                    ALLOWED_ATTR: [
                                                        'href', 'target', 'rel', 'style', 'class', 'id',
                                                        'src', 'alt', 'width', 'height', 'title',
                                                        'colspan', 'rowspan', 'align', 'valign',
                                                        'datetime', 'cite'
                                                    ],
                                                    ALLOW_DATA_ATTR: false,
                                                    ADD_ATTR: ['target', 'rel'],
                                                    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
                                                    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button']
                                                }).replace(
                                                    /<a\s+(?:[^>]*?\s+)?href="([^"]*)"(?![^>]*rel=)/gi,
                                                    '<a href="$1" target="_blank" rel="noopener noreferrer"'
                                                )
                                            }}
                                        />
                                    </div>
                                ) : viewMode === 'text' && emailContent.textContent ? (
                                    <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-6 rounded-xl border border-gray-200">
                                        <pre className="whitespace-pre-wrap text-sm text-gray-900 font-mono leading-relaxed">
                                            {emailContent.textContent}
                                        </pre>
                                    </div>
                                ) : emailContent.htmlContent ? (
                                    // Fallback to HTML if text mode selected but no text content
                                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        <div
                                            className="prose prose-sm max-w-none p-6 email-content"
                                            dangerouslySetInnerHTML={{
                                                __html: DOMPurify.sanitize(emailContent.htmlContent, {
                                                    ALLOWED_TAGS: [
                                                        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
                                                        'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                                                        'blockquote', 'div', 'span', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot',
                                                        'img', 'figure', 'figcaption', 'pre', 'code', 'hr', 'sub', 'sup',
                                                        'small', 'mark', 'ins', 'abbr', 'cite', 'q', 'dfn', 'time'
                                                    ],
                                                    ALLOWED_ATTR: [
                                                        'href', 'target', 'rel', 'style', 'class', 'id',
                                                        'src', 'alt', 'width', 'height', 'title',
                                                        'colspan', 'rowspan', 'align', 'valign',
                                                        'datetime', 'cite'
                                                    ],
                                                    ALLOW_DATA_ATTR: false,
                                                    ADD_ATTR: ['target', 'rel'],
                                                    FORBID_ATTR: ['onerror', 'onload', 'onclick'],
                                                    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button']
                                                }).replace(
                                                    /<a\s+(?:[^>]*?\s+)?href="([^"]*)"(?![^>]*rel=)/gi,
                                                    '<a href="$1" target="_blank" rel="noopener noreferrer"'
                                                )
                                            }}
                                        />
                                    </div>
                                ) : emailContent.textContent ? (
                                    // Fallback to text if HTML mode selected but no HTML content
                                    <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-6 rounded-xl border border-gray-200">
                                        <pre className="whitespace-pre-wrap text-sm text-gray-900 font-mono leading-relaxed">
                                            {emailContent.textContent}
                                        </pre>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                                        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Mail className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Content Available</h3>
                                        <p className="text-gray-600">This email appears to be empty or the content could not be loaded.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
