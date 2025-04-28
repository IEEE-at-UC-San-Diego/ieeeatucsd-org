import { useState, useEffect } from 'react';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Collections, type User } from '../../../schemas/pocketbase/schema';
import { toast } from 'react-hot-toast';

export default function EmailRequestSettings() {
    const auth = Authentication.getInstance();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState(false);
    const [resettingPassword, setResettingPassword] = useState(false);
    const [isOfficer, setIsOfficer] = useState(false);
    const [createdEmail, setCreatedEmail] = useState<string | null>(null);
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    // For initial email creation
    const [initialPassword, setInitialPassword] = useState('');
    const [initialConfirmPassword, setInitialConfirmPassword] = useState('');
    const [initialPasswordError, setInitialPasswordError] = useState('');
    const [showEmailForm, setShowEmailForm] = useState(false);

    useEffect(() => {
        const loadUserData = async () => {
            try {
                setLoading(true);
                const currentUser = auth.getCurrentUser();
                if (!currentUser) {
                    // Don't show toast on dashboard page for unauthenticated users
                    if (!window.location.pathname.includes('/dashboard')) {
                        toast.error('You must be logged in to access this page');
                    }
                    return;
                }

                setUser(currentUser);

                // Check if user is an officer
                const pb = auth.getPocketBase();
                try {
                    const officerRecord = await pb.collection('officers').getFirstListItem(`user="${currentUser.id}"`);
                    if (officerRecord) {
                        setIsOfficer(true);
                    }
                } catch (error) {
                    // Not an officer, which is fine
                    console.log('User is not an officer');
                }
            } catch (error) {
                console.error('Error loading user data:', error);
                // Don't show toast on dashboard page for unauthenticated users
                if (auth.isAuthenticated() || !window.location.pathname.includes('/dashboard')) {
                    toast.error('Failed to load user data. Please try again later.');
                }
            } finally {
                setLoading(false);
            }
        };

        loadUserData();
    }, []);

    const toggleEmailForm = () => {
        setShowEmailForm(!showEmailForm);
        setInitialPassword('');
        setInitialConfirmPassword('');
        setInitialPasswordError('');
    };

    const validateInitialPassword = () => {
        if (initialPassword.length < 8) {
            setInitialPasswordError('Password must be at least 8 characters long');
            return false;
        }

        if (initialPassword !== initialConfirmPassword) {
            setInitialPasswordError('Passwords do not match');
            return false;
        }

        setInitialPasswordError('');
        return true;
    };

    const handleRequestEmail = async () => {
        if (!user) return;

        if (initialPassword && !validateInitialPassword()) {
            return;
        }

        try {
            setRequesting(true);

            // Determine what the email will be
            const emailUsername = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, "");
            const emailDomain = import.meta.env.PUBLIC_MXROUTE_EMAIL_DOMAIN || 'ieeeucsd.org';
            const expectedEmail = `${emailUsername}@${emailDomain}`;

            // Call the API to create the email account
            const response = await fetch('/api/create-ieee-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.id,
                    name: user.name,
                    email: user.email,
                    password: initialPassword || undefined
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Email created successfully
                setCreatedEmail(result.data.ieeeEmail);

                // Update the user record to mark email as requested
                const pb = auth.getPocketBase();
                await pb.collection(Collections.USERS).update(user.id, {
                    requested_email: true
                });

                toast.success('IEEE email created successfully!');
                setShowEmailForm(false);
            } else {
                toast.error(result.message || 'Failed to create email. Please contact the webmaster for assistance.');
            }
        } catch (error) {
            console.error('Error requesting email:', error);
            toast.error('Failed to create email. Please try again later.');
        } finally {
            setRequesting(false);
        }
    };

    const togglePasswordReset = () => {
        setShowPasswordReset(!showPasswordReset);
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError('');
    };

    const validatePassword = () => {
        if (newPassword.length < 8) {
            setPasswordError('Password must be at least 8 characters long');
            return false;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match');
            return false;
        }

        setPasswordError('');
        return true;
    };

    const handleResetPassword = async () => {
        if (!user || !user.requested_email) return;

        if (!validatePassword()) {
            return;
        }

        // Determine the email address
        const emailAddress = createdEmail || (user ? `${user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, "")}@ieeeucsd.org` : '');

        try {
            setResettingPassword(true);

            // Call the API to reset the password
            const response = await fetch('/api/reset-email-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: emailAddress,
                    password: newPassword
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                toast.success('Password reset successfully!');
                setShowPasswordReset(false);
                setNewPassword('');
                setConfirmPassword('');
            } else {
                toast.error(result.message || 'Failed to reset password. Please contact the webmaster for assistance.');
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            toast.error('Failed to reset password. Please try again later.');
        } finally {
            setResettingPassword(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
        );
    }

    if (!isOfficer) {
        return (
            <div className="p-4 bg-base-200 rounded-lg">
                <p>IEEE email addresses are only available to officers. If you are an officer and don't see the option to request an email, please contact the webmaster.</p>
            </div>
        );
    }

    if (user?.requested_email || createdEmail) {
        return (
            <div className="space-y-6">
                <div className="p-4 bg-base-200 rounded-lg">
                    <h3 className="font-bold text-lg mb-2">
                        {createdEmail ? 'Your IEEE Email Address' : 'Email Request Status'}
                    </h3>

                    <div className="mb-4">
                        <p className="text-xl font-mono bg-base-100 p-2 rounded-sm">
                            {createdEmail || (user ? `${user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, "")}@ieeeucsd.org` : '')}
                        </p>
                        {initialPassword ? (
                            <p className="mt-2 text-sm">Your email has been created with the password you provided.</p>
                        ) : (
                            <p className="mt-2 text-sm">Check your personal email for login instructions.</p>
                        )}
                    </div>

                    <div className="mb-4">
                        <h4 className="font-semibold mb-1">Access Your Email</h4>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Webmail: <a href="https://mail.ieeeucsd.org" target="_blank" rel="noopener noreferrer" className="link link-primary">https://mail.ieeeucsd.org</a></li>
                        </ul>
                    </div>

                    <div className="mt-4">
                        {!showPasswordReset ? (
                            <button
                                className="btn btn-secondary w-full"
                                onClick={togglePasswordReset}
                            >
                                Reset Email Password
                            </button>
                        ) : (
                            <div className="space-y-4 p-4 bg-base-100 rounded-lg">
                                <h4 className="font-semibold">Reset Your Email Password</h4>

                                <div className="alert alert-warning">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    <span>
                                        <strong>Important:</strong> After resetting your password, you'll need to update it in any email clients, Gmail integrations, or mobile devices where you've set up this email account.
                                    </span>
                                </div>

                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text">New Password</span>
                                    </label>
                                    <input
                                        type="password"
                                        className="input input-bordered"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Enter new password"
                                    />
                                </div>

                                <div className="form-control">
                                    <label className="label">
                                        <span className="label-text">Confirm Password</span>
                                    </label>
                                    <input
                                        type="password"
                                        className="input input-bordered"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm new password"
                                    />
                                </div>

                                {passwordError && (
                                    <div className="text-error text-sm">{passwordError}</div>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        className="btn btn-secondary flex-1"
                                        onClick={handleResetPassword}
                                        disabled={resettingPassword}
                                    >
                                        {resettingPassword ? (
                                            <>
                                                <span className="loading loading-spinner loading-sm"></span>
                                                Resetting...
                                            </>
                                        ) : (
                                            'Reset Password'
                                        )}
                                    </button>
                                    <button
                                        className="btn btn-outline"
                                        onClick={togglePasswordReset}
                                        disabled={resettingPassword}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {!showPasswordReset && (
                            <p className="text-xs mt-2 opacity-70">
                                Reset your IEEE email password to a new password of your choice.
                            </p>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-base-200 rounded-lg">
                    <h3 className="font-bold text-lg mb-4">Setting Up Your IEEE Email in Gmail</h3>

                    <div className="mb-6">
                        <h4 className="font-semibold mb-2">First Step: Set Up Sending From Your IEEE Email</h4>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>Go to settings (gear icon) → Accounts and Import</li>
                            <li>In the section that says <span className="text-blue-600">Send mail as:</span>, select <span className="text-blue-600">Reply from the same address the message was sent to</span></li>
                            <li>In that same section, select <span className="text-blue-600">Add another email address</span></li>
                            <li>For the Name, put your actual name (e.g. Charles Nguyen) if this is your personal ieeeucsd.org or put the department name (e.g. IEEEUCSD Webmaster)</li>
                            <li>For the Email address, put the email that was provided for you</li>
                            <li>Make sure the <span className="text-blue-600">Treat as an alias</span> button is selected. Go to the next step</li>
                            <li>For the SMTP Server, put <span className="text-blue-600">mail.ieeeucsd.org</span></li>
                            <li>For the username, put in your <span className="text-blue-600">FULL ieeeucsd email address</span></li>
                            <li>For the password, put in the email's password</li>
                            <li>For the port, put in <span className="text-blue-600">587</span></li>
                            <li>Make sure you select <span className="text-blue-600">Secured connection with TLS</span></li>
                            <li>Go back to mail.ieeeucsd.org and verify the email that Google has sent you</li>
                        </ol>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-2">Second Step: Set Up Receiving Your IEEE Email</h4>
                        <ol className="list-decimal list-inside space-y-2">
                            <li>Go to settings (gear icon) → Accounts and Import</li>
                            <li>In the section that says <span className="text-blue-600">Check mail from other accounts:</span>, select <span className="text-blue-600">Add a mail account</span></li>
                            <li>Put in the ieeeucsd email and hit next</li>
                            <li>Make sure <span className="text-blue-600">Import emails from my other account (POP3)</span> is selected, then hit next</li>
                            <li>For the username, put in your full ieeeucsd.org email</li>
                            <li>For the password, put in your ieeeucsd.org password</li>
                            <li>For the POP Server, put in <span className="text-blue-600">mail.ieeeucsd.org</span></li>
                            <li>For the Port, put in <span className="text-blue-600">995</span></li>
                            <li>Select <span className="text-blue-600">Leave a copy of retrieved message on the server</span></li>
                            <li>Select <span className="text-blue-600">Always use a secure connection (SSL) when retrieving mail</span></li>
                            <li>Select <span className="text-blue-600">Label incoming messages</span></li>
                            <li>Then hit <span className="text-blue-600">Add Account</span></li>
                        </ol>
                    </div>
                </div>

                <div className="p-4 bg-base-200 rounded-lg">
                    <p className="text-sm">
                        If you have any questions or need help with your IEEE email, please contact <a href="mailto:webmaster@ieeeucsd.org" className="underline">webmaster@ieeeucsd.org</a>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {!showEmailForm ? (
                <>
                    <p className="text-sm">
                        As an IEEE officer, you're eligible for an official IEEE UCSD email address. This email can be used for all IEEE-related communications and provides a professional identity when representing the organization.
                    </p>

                    <div className="p-4 bg-base-200 rounded-lg">
                        <h3 className="font-bold text-lg mb-2">Benefits of an IEEE email:</h3>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Professional communication with sponsors and partners</li>
                            <li>Consistent branding for IEEE UCSD</li>
                            <li>Separation between personal and IEEE communications</li>
                            <li>Access to IEEE UCSD shared resources</li>
                        </ul>
                    </div>

                    <div className="p-4 bg-base-200 rounded-lg">
                        <h3 className="font-bold text-lg mb-2">Your IEEE Email Address</h3>
                        <p className="text-sm mb-2">When you request an email, you'll receive:</p>
                        <p className="text-xl font-mono bg-base-100 p-2 rounded-sm">
                            {user?.email ? `${user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, "")}@ieeeucsd.org` : 'Loading...'}
                        </p>
                    </div>

                    <button
                        className="btn btn-primary w-full"
                        onClick={toggleEmailForm}
                    >
                        Request IEEE Email Address
                    </button>

                    <div className="text-xs opacity-70">
                        <p>By requesting an email, you agree to use it responsibly and in accordance with IEEE UCSD policies.</p>
                    </div>
                </>
            ) : (
                <div className="p-4 bg-base-200 rounded-lg space-y-4">
                    <h3 className="font-bold text-lg">Create Your IEEE Email</h3>

                    <div className="p-4 bg-base-100 rounded-lg">
                        <p className="font-semibold">Your email address will be:</p>
                        <p className="text-xl font-mono mt-2">
                            {user?.email ? `${user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, "")}@ieeeucsd.org` : 'Loading...'}
                        </p>
                    </div>

                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Choose a Password</span>
                        </label>
                        <input
                            type="password"
                            className="input input-bordered"
                            value={initialPassword}
                            onChange={(e) => setInitialPassword(e.target.value)}
                            placeholder="Enter password (min. 8 characters)"
                        />
                    </div>

                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Confirm Password</span>
                        </label>
                        <input
                            type="password"
                            className="input input-bordered"
                            value={initialConfirmPassword}
                            onChange={(e) => setInitialConfirmPassword(e.target.value)}
                            placeholder="Confirm password"
                        />
                    </div>

                    {initialPasswordError && (
                        <div className="text-error text-sm">{initialPasswordError}</div>
                    )}

                    <p className="text-sm opacity-70">
                        Leave the password fields empty if you want a secure random password to be generated and sent to your personal email.
                    </p>

                    <div className="flex gap-2">
                        <button
                            className="btn btn-primary flex-1"
                            onClick={handleRequestEmail}
                            disabled={requesting}
                        >
                            {requesting ? (
                                <>
                                    <span className="loading loading-spinner loading-sm"></span>
                                    Creating Email...
                                </>
                            ) : (
                                'Create IEEE Email'
                            )}
                        </button>
                        <button
                            className="btn btn-outline"
                            onClick={toggleEmailForm}
                            disabled={requesting}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
} 