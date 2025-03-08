import { useState, useEffect } from 'react';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Update } from '../../../scripts/pocketbase/Update';
import { Collections } from '../../../schemas/pocketbase/schema';
import { toast } from 'react-hot-toast';

// Default notification preferences
const DEFAULT_NOTIFICATION_PREFERENCES = {
    emailNotifications: true,
    eventReminders: true,
    eventUpdates: true,
    reimbursementUpdates: true,
    officerAnnouncements: true,
    marketingEmails: false
};

export default function NotificationSettings() {
    const auth = Authentication.getInstance();
    const update = Update.getInstance();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Notification preferences
    const [preferences, setPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES);

    useEffect(() => {
        const loadPreferences = async () => {
            try {
                const user = auth.getCurrentUser();
                if (user) {
                    // If user has notification_preferences, parse and use them
                    // Otherwise use defaults
                    if (user.notification_preferences && typeof user.notification_preferences === 'string' && user.notification_preferences.trim() !== '') {
                        try {
                            const savedPrefs = JSON.parse(user.notification_preferences);
                            setPreferences(prev => ({
                                ...prev,
                                ...savedPrefs
                            }));
                        } catch (e) {
                            console.error('Error parsing notification preferences:', e);
                            // Initialize with defaults and save to user profile
                            await initializeDefaultPreferences(user.id);
                        }
                    } else {
                        // Initialize with defaults and save to user profile
                        await initializeDefaultPreferences(user.id);
                    }
                }
            } catch (error) {
                console.error('Error loading notification preferences:', error);
                toast.error('Failed to load notification preferences');
            } finally {
                setLoading(false);
            }
        };

        loadPreferences();
    }, []);

    // Initialize default preferences if not set
    const initializeDefaultPreferences = async (userId: string) => {
        try {
            await update.updateFields(
                Collections.USERS,
                userId,
                { notification_preferences: JSON.stringify(DEFAULT_NOTIFICATION_PREFERENCES) }
            );
            setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
            console.log('Initialized default notification preferences');
        } catch (error) {
            console.error('Error initializing default notification preferences:', error);
        }
    };

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

        try {
            const user = auth.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            // Save preferences as JSON string
            await update.updateFields(
                Collections.USERS,
                user.id,
                { notification_preferences: JSON.stringify(preferences) }
            );

            toast.success('Notification preferences saved successfully!');
        } catch (error) {
            console.error('Error saving notification preferences:', error);
            toast.error('Failed to save notification preferences');
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

                <p className="text-sm text-info mt-6 mb-6">
                    Note: Some critical notifications about your account cannot be disabled.
                </p>

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