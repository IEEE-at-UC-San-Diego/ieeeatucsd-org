import { useState, useEffect } from 'react';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Update } from '../../../scripts/pocketbase/Update';
import { Collections } from '../../../schemas/pocketbase/schema';

export default function NotificationSettings() {
    const auth = Authentication.getInstance();
    const update = Update.getInstance();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Notification preferences
    const [preferences, setPreferences] = useState({
        emailNotifications: true,
        eventReminders: true,
        eventUpdates: true,
        reimbursementUpdates: true,
        officerAnnouncements: true,
        marketingEmails: false
    });

    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const user = auth.getCurrentUser();
                if (user) {
                    // If user has notification_preferences, parse and use them
                    // Otherwise use defaults
                    if (user.notification_preferences) {
                        try {
                            const savedPrefs = JSON.parse(user.notification_preferences);
                            setPreferences(prev => ({
                                ...prev,
                                ...savedPrefs
                            }));
                        } catch (e) {
                            console.error('Error parsing notification preferences:', e);
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading notification preferences:', error);
                setErrorMessage('Failed to load notification preferences');
            } finally {
                setLoading(false);
            }
        };

        loadPreferences();
    }, []);

    const handleToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setPreferences(prev => ({
            ...prev,
            [name]: checked
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setSuccessMessage('');
        setErrorMessage('');

        try {
            const user = auth.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            // Save preferences as JSON string
            await update.updateFields(
                Collections.USERS,
                user.id,
                { notification_preferences: JSON.stringify(preferences) }
            );

            setSuccessMessage('Notification preferences saved successfully!');

            // Clear success message after 3 seconds
            setTimeout(() => {
                setSuccessMessage('');
            }, 3000);
        } catch (error) {
            console.error('Error saving notification preferences:', error);
            setErrorMessage('Failed to save notification preferences');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-8">
                <div className="loading loading-spinner loading-lg"></div>
            </div>
        );
    }

    return (
        <div>
            {successMessage && (
                <div className="alert alert-success mb-4">
                    <div>
                        <span>{successMessage}</span>
                    </div>
                </div>
            )}

            {errorMessage && (
                <div className="alert alert-error mb-4">
                    <div>
                        <span>{errorMessage}</span>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="space-y-4">
                    <div className="form-control">
                        <label className="cursor-pointer label justify-start gap-4">
                            <input
                                type="checkbox"
                                name="emailNotifications"
                                className="toggle toggle-primary"
                                checked={preferences.emailNotifications}
                                onChange={handleToggleChange}
                            />
                            <div>
                                <span className="label-text font-medium">Email Notifications</span>
                                <p className="text-xs opacity-70">Receive notifications via email</p>
                            </div>
                        </label>
                    </div>

                    <div className="form-control">
                        <label className="cursor-pointer label justify-start gap-4">
                            <input
                                type="checkbox"
                                name="eventReminders"
                                className="toggle toggle-primary"
                                checked={preferences.eventReminders}
                                onChange={handleToggleChange}
                            />
                            <div>
                                <span className="label-text font-medium">Event Reminders</span>
                                <p className="text-xs opacity-70">Receive reminders about upcoming events</p>
                            </div>
                        </label>
                    </div>

                    <div className="form-control">
                        <label className="cursor-pointer label justify-start gap-4">
                            <input
                                type="checkbox"
                                name="eventUpdates"
                                className="toggle toggle-primary"
                                checked={preferences.eventUpdates}
                                onChange={handleToggleChange}
                            />
                            <div>
                                <span className="label-text font-medium">Event Updates</span>
                                <p className="text-xs opacity-70">Receive updates about events you've registered for</p>
                            </div>
                        </label>
                    </div>

                    <div className="form-control">
                        <label className="cursor-pointer label justify-start gap-4">
                            <input
                                type="checkbox"
                                name="reimbursementUpdates"
                                className="toggle toggle-primary"
                                checked={preferences.reimbursementUpdates}
                                onChange={handleToggleChange}
                            />
                            <div>
                                <span className="label-text font-medium">Reimbursement Updates</span>
                                <p className="text-xs opacity-70">Receive updates about your reimbursement requests</p>
                            </div>
                        </label>
                    </div>

                    <div className="form-control">
                        <label className="cursor-pointer label justify-start gap-4">
                            <input
                                type="checkbox"
                                name="officerAnnouncements"
                                className="toggle toggle-primary"
                                checked={preferences.officerAnnouncements}
                                onChange={handleToggleChange}
                            />
                            <div>
                                <span className="label-text font-medium">Officer Announcements</span>
                                <p className="text-xs opacity-70">Receive important announcements from IEEE UCSD officers</p>
                            </div>
                        </label>
                    </div>

                    <div className="form-control">
                        <label className="cursor-pointer label justify-start gap-4">
                            <input
                                type="checkbox"
                                name="marketingEmails"
                                className="toggle toggle-primary"
                                checked={preferences.marketingEmails}
                                onChange={handleToggleChange}
                            />
                            <div>
                                <span className="label-text font-medium">Marketing Emails</span>
                                <p className="text-xs opacity-70">Receive promotional emails about IEEE UCSD events and opportunities</p>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="alert alert-info mt-6 mb-6">
                    <div>
                        <span>
                            Note: Some critical notifications about your account cannot be disabled.
                        </span>
                    </div>
                </div>

                <div className="form-control">
                    <button
                        type="submit"
                        className={`btn btn-primary ${saving ? 'loading' : ''}`}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Preferences'}
                    </button>
                </div>
            </form>
        </div>
    );
} 