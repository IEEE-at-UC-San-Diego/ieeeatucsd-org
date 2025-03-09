import { useState, useEffect } from 'react';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Update } from '../../../scripts/pocketbase/Update';
import { Collections, type User } from '../../../schemas/pocketbase/schema';
import { toast } from 'react-hot-toast';

export default function EmailRequestSettings() {
    const auth = Authentication.getInstance();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState(false);
    const [isOfficer, setIsOfficer] = useState(false);
    const [createdEmail, setCreatedEmail] = useState<string | null>(null);

    useEffect(() => {
        const loadUserData = async () => {
            try {
                setLoading(true);
                const currentUser = auth.getCurrentUser();
                if (!currentUser) {
                    toast.error('You must be logged in to access this page');
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
                toast.error('Failed to load user data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        loadUserData();
    }, []);

    const handleRequestEmail = async () => {
        if (!user) return;

        try {
            setRequesting(true);

            // Call the API to create the email account
            const response = await fetch('/api/create-ieee-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.id,
                    name: user.name,
                    email: user.email
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

                toast.success('IEEE email created successfully! Check your email for login details.');
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
            <div className="space-y-4">
                <div className="p-4 bg-base-200 rounded-lg">
                    <h3 className="font-bold text-lg mb-2">
                        {createdEmail ? 'Your IEEE Email Address' : 'Email Request Status'}
                    </h3>

                    {createdEmail && (
                        <div className="mb-4">
                            <p className="text-xl font-mono bg-base-100 p-2 rounded">{createdEmail}</p>
                            <p className="mt-2 text-sm">Check your personal email for login instructions.</p>
                        </div>
                    )}

                    <div className="mb-4">
                        <h4 className="font-semibold mb-1">Access Your Email</h4>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Webmail: <a href="https://heracles.mxrouting.net:2096/" target="_blank" rel="noopener noreferrer" className="link link-primary">https://heracles.mxrouting.net:2096/</a></li>
                            <li>IMAP/SMTP settings: <a href="https://mxroute.com/setup/" target="_blank" rel="noopener noreferrer" className="link link-primary">https://mxroute.com/setup/</a></li>
                        </ul>
                    </div>

                    <p className="text-sm">
                        If you have any questions or need help with your IEEE email, please contact <a href="mailto:webmaster@ieeeucsd.org" className="underline">webmaster@ieeeucsd.org</a>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
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

            <button
                className="btn btn-primary w-full"
                onClick={handleRequestEmail}
                disabled={requesting}
            >
                {requesting ? (
                    <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Creating Email...
                    </>
                ) : (
                    'Create IEEE Email Address'
                )}
            </button>

            <div className="text-xs opacity-70">
                <p>By requesting an email, you agree to use it responsibly and in accordance with IEEE UCSD policies.</p>
                <p>Your email address will be based on your current email username.</p>
            </div>
        </div>
    );
} 