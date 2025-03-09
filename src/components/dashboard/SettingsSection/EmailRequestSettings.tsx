import { useState, useEffect } from 'react';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Update } from '../../../scripts/pocketbase/Update';
import { Collections, type User } from '../../../schemas/pocketbase/schema';
import { toast } from 'react-hot-toast';

export default function EmailRequestSettings() {
    const auth = Authentication.getInstance();
    const update = Update.getInstance();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState(false);
    const [isOfficer, setIsOfficer] = useState(false);

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

            // Update the user record to mark email as requested
            const pb = auth.getPocketBase();
            await pb.collection(Collections.USERS).update(user.id, {
                requested_email: true
            });

            // Refresh user data
            const updatedUser = auth.getCurrentUser();
            setUser(updatedUser);

            toast.success('Email request submitted successfully! Our team will process your request soon.');
        } catch (error) {
            console.error('Error requesting email:', error);
            toast.error('Failed to submit email request. Please try again later.');
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
            <div className="alert alert-info">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>IEEE email addresses are only available to officers. If you are an officer and don't see the option to request an email, please contact the webmaster.</span>
            </div>
        );
    }

    if (user?.requested_email) {
        return (
            <div className="space-y-4">
                <div className="alert alert-success">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>You have requested an IEEE email address. Our team is processing your request.</span>
                </div>

                <div className="card bg-base-200 p-4">
                    <h3 className="font-bold text-lg mb-2">What happens next?</h3>
                    <ol className="list-decimal list-inside space-y-2">
                        <li>Our webmaster will create your email address (typically firstname.lastname@ieeeucsd.org)</li>
                        <li>You'll receive an email with your credentials and setup instructions</li>
                        <li>You can use this email for IEEE-related communications</li>
                    </ol>
                </div>

                <div className="alert alert-info">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>If you have any questions or need help with your IEEE email, please contact <a href="mailto:webmaster@ieeeucsd.org" className="underline">webmaster@ieeeucsd.org</a></span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-sm">
                As an IEEE officer, you're eligible for an official IEEE UCSD email address. This email can be used for all IEEE-related communications and provides a professional identity when representing the organization.
            </p>

            <div className="card bg-base-200 p-4">
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
                        Processing...
                    </>
                ) : (
                    'Request IEEE Email Address'
                )}
            </button>

            <div className="text-xs opacity-70">
                <p>By requesting an email, you agree to use it responsibly and in accordance with IEEE UCSD policies.</p>
                <p>Email addresses are typically in the format firstname.lastname@ieeeucsd.org</p>
            </div>
        </div>
    );
} 