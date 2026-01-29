import React, { useState, useEffect } from 'react';
import { Mail, Key, Eye, EyeOff, AlertCircle, CheckCircle, Loader2, MessageSquare, Shield, RefreshCw, Inbox, ExternalLink } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../../../firebase/client';
import type { User as UserType } from '../../shared/types/firestore';
import { Spinner, Card, CardBody, Input, Button, Pagination as HeroPagination, Tooltip, Chip } from '@heroui/react';
import PasswordStrengthIndicator from './components/PasswordStrengthIndicator';
import EmailModal from './components/EmailModal';
import type { EmailMessage, EmailInboxState, EmailGenerationState } from './types';

export default function SlackAccessContent() {
    const [user] = useAuthState(auth);
    const [userData, setUserData] = useState<UserType & { hasIEEEEmail?: boolean; ieeeEmail?: string; ieeeEmailCreatedAt?: any } | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [customPassword, setCustomPassword] = useState('');
    const [passwordValidation, setPasswordValidation] = useState({ isValid: false, strength: 0, requirements: { minLength: false, hasUppercase: false, hasLowercase: false, hasNumber: false, hasSpecialChar: false } });

    // Separate state for inbox authentication password
    const [showInboxPassword, setShowInboxPassword] = useState(false);
    const [inboxPassword, setInboxPassword] = useState('');
    const [inboxPasswordValidation, setInboxPasswordValidation] = useState({ isValid: false, strength: 0, requirements: { minLength: false, hasUppercase: false, hasLowercase: false, hasNumber: false, hasSpecialChar: false } });

    // Email pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [emailsPerPage] = useState(12);

    const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
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

    useEffect(() => {
        setPasswordValidation(validatePassword(customPassword));
    }, [customPassword]);

    useEffect(() => {
        setInboxPasswordValidation(validatePassword(inboxPassword));
    }, [inboxPassword]);

    useEffect(() => {
        setCurrentPage(1);
    }, [inboxState.emails.length]);

    const extractUsername = (email: string): string => {
        return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    };

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

        return { isValid, strength, requirements };
    };

    const handleIEEEPasswordKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (userData?.hasIEEEEmail) {
                if (!emailState.isResetting && customPassword.trim() && passwordValidation.isValid) {
                    resetEmailPassword();
                }
            } else {
                if (!emailState.isGenerating && customPassword.trim() && passwordValidation.isValid) {
                    generateIEEEEmail();
                }
            }
        }
    };

    const handleInboxPasswordKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!inboxState.isLoading && inboxPassword.trim()) {
                authenticateInbox();
            }
        }
    };

    const getPaginatedEmails = () => {
        const startIndex = (currentPage - 1) * emailsPerPage;
        const endIndex = startIndex + emailsPerPage;
        return inboxState.emails.slice(startIndex, endIndex);
    };

    const generateIEEEEmail = async () => {
        if (!user || !userData) {
            setEmailState(prev => ({ ...prev, error: 'User authentication required' }));
            return;
        }

        if (!userData.email || !userData.email.includes('@')) {
            setEmailState(prev => ({ ...prev, error: 'Invalid user email format' }));
            return;
        }

        if (!customPassword.trim()) {
            setEmailState(prev => ({ ...prev, error: 'Password is required' }));
            return;
        }

        const validation = validatePassword(customPassword);
        if (!validation.isValid) {
            setEmailState(prev => ({ ...prev, error: 'Password does not meet requirements.' }));
            return;
        }

        setEmailState(prev => ({ ...prev, isGenerating: true, error: null, success: null }));

        try {
            const username = extractUsername(userData.email);
            const proposedEmail = `${username}@ieeeatucsd.org`;

            const checkResponse = await fetch('/api/check-email-exists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: proposedEmail }),
            });

            if (checkResponse.ok) {
                const checkResult = await checkResponse.json();
                if (checkResult.exists) {
                    setEmailState(prev => ({
                        ...prev,
                        isGenerating: false,
                        error: `Email ${proposedEmail} already exists. Please contact webmaster@ieeeatucsd.org.`
                    }));
                    return;
                }
            }

            const response = await fetch('/api/create-ieee-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    name: userData.name,
                    email: userData.email,
                    password: customPassword
                }),
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();

            if (result.success) {
                try {
                    const userRef = doc(db, 'users', user.uid);
                    await updateDoc(userRef, {
                        hasIEEEEmail: true,
                        ieeeEmail: result.data.ieeeEmail,
                        ieeeEmailCreatedAt: new Date()
                    });
                } catch (firebaseError) {
                    console.error('Error updating Firebase:', firebaseError);
                }

                setEmailState(prev => ({
                    ...prev,
                    isGenerating: false,
                    generatedEmail: result.data.ieeeEmail,
                    success: result.data.message
                }));
                setCustomPassword('');
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
                error: error instanceof Error ? error.message : 'Failed to create IEEE email.'
            }));
        }
    };

    const resetEmailPassword = async () => {
        const ieeeEmail = emailState.generatedEmail || userData?.ieeeEmail;
        if (!ieeeEmail || !customPassword.trim()) {
            setEmailState(prev => ({ ...prev, error: 'Email and password required' }));
            return;
        }

        const validation = validatePassword(customPassword);
        if (!validation.isValid) {
            setEmailState(prev => ({ ...prev, error: 'Password does not meet requirements.' }));
            return;
        }

        setEmailState(prev => ({ ...prev, isResetting: true, error: null, success: null }));

        try {
            const response = await fetch('/api/reset-email-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: ieeeEmail, password: customPassword }),
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const result = await response.json();

            if (result.success) {
                setEmailState(prev => ({
                    ...prev,
                    isResetting: false,
                    success: result.message
                }));
                setCustomPassword('');
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
                error: error instanceof Error ? error.message : 'Failed to reset password.'
            }));
        }
    };

    const authenticateInbox = async () => {
        const ieeeEmail = emailState.generatedEmail || userData?.ieeeEmail;
        if (!ieeeEmail || !inboxPassword.trim()) {
            setInboxState(prev => ({ ...prev, error: 'Credentials required' }));
            return;
        }

        setInboxState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const response = await fetch('/api/fetch-emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: ieeeEmail, password: inboxPassword }),
            });

            const result = await response.json();

            if (result.success) {
                setInboxState(prev => ({
                    ...prev,
                    isLoading: false,
                    isAuthenticated: true,
                    emails: result.emails || [],
                    credentials: { email: ieeeEmail, password: inboxPassword }
                }));
                setInboxPassword('');
            } else {
                const errorMessage = result.message || 'Failed to authenticate';
                const isAuthError = errorMessage.toLowerCase().includes('password') || errorMessage.toLowerCase().includes('login');
                setInboxState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: isAuthError ? 'Login failed. Check password.' : 'Connection failed.'
                }));
            }
        } catch (error) {
            console.error('Error authenticating inbox:', error);
            setInboxState(prev => ({ ...prev, isLoading: false, error: 'Connection failed.' }));
        }
    };

    const refreshInbox = async () => {
        if (!inboxState.isAuthenticated || !inboxState.credentials) return;
        setInboxState(prev => ({ ...prev, isRefreshing: true, error: null }));

        try {
            const response = await fetch('/api/fetch-emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inboxState.credentials),
            });

            const result = await response.json();
            if (result.success) {
                setInboxState(prev => ({ ...prev, isRefreshing: false, emails: result.emails || [] }));
            } else {
                setInboxState(prev => ({ ...prev, isRefreshing: false, error: 'Failed to refresh.' }));
            }
        } catch (error) {
            setInboxState(prev => ({ ...prev, isRefreshing: false, error: 'Failed to refresh.' }));
        }
    };

    if (!user || !userData) {
        return (
            <div className="p-6">
                <Spinner size="lg" />
            </div>
        );
    }

    const username = extractUsername(userData.email);

    return (
        <div className="w-full">
            <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

                {/* Notice */}
                <div className="p-4 bg-warning-50 border border-warning-200 rounded-xl flex items-start gap-3">
                    <Shield className="w-5 h-5 text-warning-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <h3 className="font-semibold text-warning-900 text-sm">Important Notice</h3>
                        <p className="text-sm text-warning-800/80 mt-0.5">
                            This email address is exclusively for Slack authentication. It provides access to the IEEE UCSD Slack workspace only.
                        </p>
                    </div>
                </div>

                {/* Slack Workspace Info */}
                <Card shadow="sm" className="rounded-2xl">
                    <CardBody className="p-6">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 bg-indigo-50 rounded-xl">
                                <MessageSquare className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">IEEE UCSD Slack Workspace</h2>
                                <p className="text-gray-500 text-sm">Connect with fellow members and stay updated</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <h3 className="font-semibold text-gray-900 text-sm mb-1">Workspace URL</h3>
                                <p className="text-sm text-primary font-medium">ieeeucsdofficers.slack.com</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <h3 className="font-semibold text-gray-900 text-sm mb-1">Access Method</h3>
                                <p className="text-sm text-gray-600">Use your IEEE email to join</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <h3 className="font-semibold text-gray-900 text-sm mb-1">Support</h3>
                                <p className="text-sm text-gray-600">Contact webmaster@ieeeatucsd.org</p>
                            </div>
                        </div>
                    </CardBody>
                </Card>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Email Management */}
                    <Card shadow="sm" className="rounded-2xl">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-3 bg-blue-50 rounded-xl">
                                    <Mail className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">
                                        {userData.hasIEEEEmail ? 'IEEE Email Management' : 'IEEE Email Generation'}
                                    </h2>
                                    <p className="text-gray-500 text-sm">
                                        {userData.hasIEEEEmail ? 'Manage your existing IEEE email' : 'Create your Slack-specific IEEE email'}
                                    </p>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <dl className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <dt className="text-gray-500">Name</dt>
                                        <dd className="font-medium text-gray-900">{userData.name}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-gray-500">Personal Email</dt>
                                        <dd className="font-medium text-gray-900">{userData.email}</dd>
                                    </div>
                                    {userData.hasIEEEEmail ? (
                                        <>
                                            <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
                                                <dt className="text-gray-500">IEEE Email</dt>
                                                <dd className="font-medium text-primary">{userData.ieeeEmail}</dd>
                                            </div>
                                            <div className="flex justify-between">
                                                <dt className="text-gray-500">Created</dt>
                                                <dd className="font-medium text-gray-900">{userData.ieeeEmailCreatedAt ? new Date(userData.ieeeEmailCreatedAt.toDate()).toLocaleDateString() : 'Unknown'}</dd>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex justify-between pt-2 border-t border-gray-200 mt-2">
                                            <dt className="text-gray-500">Proposed IEEE Email</dt>
                                            <dd className="font-medium text-primary">{username}@ieeeatucsd.org</dd>
                                        </div>
                                    )}
                                </dl>
                            </div>

                            {/* Password input */}
                            <div className="mb-4 sm:mb-6">
                                <Input
                                    label={userData.hasIEEEEmail ? "New Password" : "Password"}
                                    placeholder={userData.hasIEEEEmail ? "Enter new password" : "Enter a secure password"}
                                    type={showPassword ? "text" : "password"}
                                    value={customPassword}
                                    onValueChange={setCustomPassword}
                                    onKeyDown={handleIEEEPasswordKeyDown}
                                    isRequired
                                    isDisabled={userData.hasIEEEEmail && !canResetPassword}
                                    endContent={
                                        <button className="focus:outline-none" type="button" onClick={() => setShowPassword(!showPassword)}>
                                            {showPassword ? (
                                                <EyeOff className="text-2xl text-default-400 pointer-events-none" />
                                            ) : (
                                                <Eye className="text-2xl text-default-400 pointer-events-none" />
                                            )}
                                        </button>
                                    }
                                    description={
                                        userData.hasIEEEEmail && !canResetPassword
                                            ? "Password reset is only available to officers and administrators."
                                            : undefined
                                    }
                                />
                                {customPassword && <PasswordStrengthIndicator validation={passwordValidation} />}
                            </div>

                            {userData.hasIEEEEmail ? (
                                canResetPassword ? (
                                    <Button
                                        color="success"
                                        className="w-full text-white"
                                        onPress={resetEmailPassword}
                                        isLoading={emailState.isResetting}
                                        isDisabled={!customPassword.trim() || !passwordValidation.isValid}
                                        startContent={!emailState.isResetting && <RefreshCw className="w-4 h-4" />}
                                    >
                                        {emailState.isResetting ? "Resetting Password..." : "Reset Password"}
                                    </Button>
                                ) : (
                                    <div className="w-full p-4 bg-warning-50 border border-warning-200 rounded-lg flex items-start gap-3">
                                        <Shield className="w-5 h-5 text-warning-600 mt-0.5" />
                                        <div>
                                            <h4 className="font-medium text-warning-800 mb-1">Restricted</h4>
                                            <p className="text-sm text-warning-700">Contact administrator to reset.</p>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <Button
                                    color="primary"
                                    className="w-full"
                                    onPress={generateIEEEEmail}
                                    isLoading={emailState.isGenerating}
                                    isDisabled={!customPassword.trim() || !passwordValidation.isValid}
                                    startContent={!emailState.isGenerating && <Mail className="w-4 h-4" />}
                                >
                                    {emailState.isGenerating ? "Generating..." : "Generate IEEE Email"}
                                </Button>
                            )}

                            {/* Status Messages */}
                            {emailState.success && (
                                <div className="mt-4 p-3 bg-success-50 border border-success-200 rounded-md flex items-start gap-2">
                                    <CheckCircle className="w-4 h-4 text-success-600 mt-0.5" />
                                    <p className="text-sm text-success-700">{emailState.success}</p>
                                </div>
                            )}
                            {emailState.error && (
                                <div className="mt-4 p-3 bg-danger-50 border border-danger-200 rounded-md flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-danger-600 mt-0.5" />
                                    <p className="text-sm text-danger-700">{emailState.error}</p>
                                </div>
                            )}

                            {emailState.generatedEmail && !userData.hasIEEEEmail && (
                                <div className="mt-6 p-4 bg-success-50 border border-success-200 rounded-lg">
                                    <h3 className="font-medium text-success-800 mb-2">Created Successfully!</h3>
                                    <p className="text-sm text-success-700">
                                        <span className="font-medium">IEEE Email:</span> {emailState.generatedEmail}
                                    </p>
                                </div>
                            )}
                        </CardBody>
                    </Card>

                    {/* Inbox Preview */}
                    <Card shadow="sm" className="rounded-2xl h-full">
                        <CardBody className="p-6 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-purple-50 rounded-xl">
                                        <Inbox className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900">Inbox Preview</h2>
                                        <p className="text-gray-500 text-sm">View your Slack-related emails</p>
                                    </div>
                                </div>
                                {inboxState.isAuthenticated && (
                                    <Button
                                        isIconOnly
                                        variant="light"
                                        color="secondary"
                                        onPress={refreshInbox}
                                        isLoading={inboxState.isRefreshing}
                                    >
                                        {!inboxState.isRefreshing && <RefreshCw className="w-5 h-5" />}
                                    </Button>
                                )}
                            </div>

                            <div className="flex-1 min-h-[400px]">
                                {(!emailState.generatedEmail && !userData.hasIEEEEmail) ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                        <div className="bg-gray-100 p-4 rounded-full mb-4">
                                            <Mail className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <h3 className="text-gray-900 font-medium mb-1">No Email Account</h3>
                                        <p className="text-gray-500 text-sm max-w-xs">
                                            Generate an IEEE email first.
                                        </p>
                                    </div>
                                ) : !inboxState.isAuthenticated ? (
                                    <div className="h-full flex flex-col items-center justify-center p-8 bg-gray-50 rounded-xl border border-gray-200">
                                        <div className="w-full max-w-sm space-y-6 text-center">
                                            <div>
                                                <div className="bg-purple-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                    <Key className="w-8 h-8 text-purple-600" />
                                                </div>
                                                <h3 className="text-gray-900 font-bold text-lg mb-2">Authentication Required</h3>
                                                <p className="text-gray-500 text-sm">
                                                    Enter password for<br />
                                                    <span className="font-medium text-gray-700">{emailState.generatedEmail || userData?.ieeeEmail}</span>
                                                </p>
                                            </div>
                                            <div className="space-y-4">
                                                <Input
                                                    placeholder="Enter password"
                                                    type={showInboxPassword ? "text" : "password"}
                                                    value={inboxPassword}
                                                    onValueChange={setInboxPassword}
                                                    onKeyDown={handleInboxPasswordKeyDown}
                                                    endContent={
                                                        <button className="focus:outline-none" type="button" onClick={() => setShowInboxPassword(!showInboxPassword)}>
                                                            {showInboxPassword ? (
                                                                <EyeOff className="text-2xl text-default-400 pointer-events-none" />
                                                            ) : (
                                                                <Eye className="text-2xl text-default-400 pointer-events-none" />
                                                            )}
                                                        </button>
                                                    }
                                                />
                                                <Button
                                                    color="secondary"
                                                    className="w-full"
                                                    onPress={authenticateInbox}
                                                    isLoading={inboxState.isLoading}
                                                    isDisabled={!inboxPassword.trim()}
                                                    startContent={!inboxState.isLoading && <Key className="w-4 h-4" />}
                                                >
                                                    {inboxState.isLoading ? "Authenticating..." : "Access Inbox"}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col h-full">
                                        {inboxState.emails.length === 0 && !inboxState.isRefreshing ? (
                                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-500">
                                                <Inbox className="w-12 h-12 text-gray-300 mb-3" />
                                                <p>Inbox is empty</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                                                    {getPaginatedEmails().map((email) => {
                                                        const isSlackRelated = email.subject.toLowerCase().includes('slack') || email.from.toLowerCase().includes('slack');
                                                        return (
                                                            <div
                                                                key={email.id}
                                                                onClick={() => setSelectedEmail(email)}
                                                                className={`group p-4 rounded-xl border transition-all cursor-pointer relative hover:shadow-md ${email.isRead ? 'bg-white border-gray-200 hover:border-purple-200' : 'bg-purple-50/30 border-purple-100 hover:border-purple-200'
                                                                    }`}
                                                            >
                                                                <div className="flex justify-between items-start gap-4 mb-2">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        {!email.isRead && <span className="w-2 h-2 rounded-full bg-purple-600 flex-shrink-0" />}
                                                                        {isSlackRelated && (
                                                                            <Chip size="sm" color="secondary" variant="flat" className="h-5 text-[10px]">SLACK</Chip>
                                                                        )}
                                                                        <h4 className={`text-sm truncate ${!email.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                                                                            {email.subject || '(No Subject)'}
                                                                        </h4>
                                                                    </div>
                                                                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">{email.date}</span>
                                                                </div>
                                                                <p className="text-xs text-gray-500 mb-2 truncate"><span className="font-medium text-gray-600">{email.from}</span></p>
                                                                <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{email.preview}</p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {Math.ceil(inboxState.emails.length / emailsPerPage) > 1 && (
                                                    <div className="flex justify-center pt-4 border-t border-gray-100 mt-4">
                                                        <HeroPagination
                                                            total={Math.ceil(inboxState.emails.length / emailsPerPage)}
                                                            page={currentPage}
                                                            onChange={setCurrentPage}
                                                            size="sm"
                                                            color="secondary"
                                                        />
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                                {inboxState.error && (
                                    <div className="mt-4 p-3 bg-danger-50 border border-danger-200 rounded-lg flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-danger-600 mt-0.5" />
                                        <p className="text-sm text-danger-700">{inboxState.error}</p>
                                    </div>
                                )}
                            </div>
                        </CardBody>
                    </Card>
                </div>

                {/* Instructions */}
                <Card shadow="sm" className="rounded-2xl">
                    <CardBody className="p-6">
                        <h2 className="text-lg font-bold text-gray-900 mb-6">How to Join IEEE UCSD Slack</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { step: 1, title: "Generate IEEE Email", desc: "Use the form above to create your IEEE email address." },
                                { step: 2, title: "Sign up for Slack", desc: "Use your new @ieeeatucsd.org email to sign up." },
                                { step: 3, title: "Verify Email", desc: "Check the inbox preview above for the confirmation code." },
                                { step: 4, title: "Collaborate", desc: "Join channels and start chatting with the team." }
                            ].map((item) => (
                                <div key={item.step} className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                                        {item.step}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-sm mb-1">{item.title}</h3>
                                        <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardBody>
                </Card>
            </main>

            {selectedEmail && (
                <EmailModal
                    email={selectedEmail}
                    credentials={inboxState.credentials}
                    onClose={() => setSelectedEmail(null)}
                />
            )}
        </div>
    );
}
