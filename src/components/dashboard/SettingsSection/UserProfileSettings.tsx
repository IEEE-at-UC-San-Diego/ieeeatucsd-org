import { useState, useEffect } from 'react';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Update } from '../../../scripts/pocketbase/Update';
import { Collections, type User } from '../../../schemas/pocketbase/schema';
import allMajors from '../../../data/allUCSDMajors.txt?raw';
import { toast } from 'react-hot-toast';

interface UserProfileSettingsProps {
    logtoApiEndpoint?: string;
}

export default function UserProfileSettings({
    logtoApiEndpoint: propLogtoApiEndpoint
}: UserProfileSettingsProps) {
    const auth = Authentication.getInstance();
    const update = Update.getInstance();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logtoUserId, setLogtoUserId] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        username: '',
        major: '',
        graduation_year: '',
        zelle_information: '',
        pid: '',
        member_id: ''
    });

    // Access environment variables directly
    const envLogtoApiEndpoint = import.meta.env.LOGTO_API_ENDPOINT;

    // Use environment variables or props (fallback)
    const logtoApiEndpoint = envLogtoApiEndpoint || propLogtoApiEndpoint;

    useEffect(() => {
        const loadUserData = async () => {
            try {
                const currentUser = auth.getCurrentUser();
                if (!currentUser) {
                    // Don't show error toast on dashboard page for unauthenticated users
                    if (!window.location.pathname.includes('/dashboard')) {
                        throw new Error('User not authenticated');
                    }
                    return;
                }

                // Get the Logto user ID from PocketBase's external auth collection
                const pb = auth.getPocketBase();
                try {
                    const externalAuthRecord = await pb.collection('_externalAuths').getFirstListItem(`recordRef="${currentUser.id}" && provider="oidc"`);
                    const logtoId = externalAuthRecord.providerId;
                    if (!logtoId) {
                        throw new Error('No Logto ID found in external auth record');
                    }
                    setLogtoUserId(logtoId);

                    // Fetch user data from Logto through our server-side API
                    const logtoResponse = await fetch('/api/get-logto-user', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            userId: logtoId,
                            logtoApiEndpoint: logtoApiEndpoint
                        })
                    });

                    if (!logtoResponse.ok) {
                        throw new Error('Failed to fetch Logto user data');
                    }

                    const logtoUser = await logtoResponse.json();
                    // Extract username from Logto data or email if not set
                    const defaultUsername = logtoUser.data?.username || currentUser.email?.split('@')[0] || '';

                    // Remove all the major matching logic and just use the server value directly
                    setUser(currentUser);
                    setFormData({
                        name: currentUser.name || '',
                        email: currentUser.email || '',
                        username: defaultUsername,
                        major: currentUser.major || '',
                        graduation_year: currentUser.graduation_year?.toString() || '',
                        zelle_information: currentUser.zelle_information || '',
                        pid: currentUser.pid || '',
                        member_id: currentUser.member_id || ''
                    });

                    // If username is blank in Logto, update it
                    if (!logtoUser.data?.username && currentUser.email) {
                        try {
                            const emailUsername = currentUser.email.split('@')[0];
                            await updateLogtoUser(logtoId, emailUsername);
                        } catch (error) {
                            console.error('Error setting default username:', error);
                        }
                    }
                } catch (error) {
                    console.error('Error fetching external auth record:', error);
                    // Don't show error toast on dashboard page for unauthenticated users
                    if (auth.isAuthenticated() || !window.location.pathname.includes('/dashboard')) {
                        toast.error('Could not determine your user ID. Please try again later or contact support.');
                    }
                }
            } catch (error) {
                console.error('Error loading user data:', error);
                // Don't show error toast on dashboard page for unauthenticated users
                if (auth.isAuthenticated() || !window.location.pathname.includes('/dashboard')) {
                    toast.error('Failed to load user data. Please try again later.');
                }
            } finally {
                setLoading(false);
            }
        };

        loadUserData();
    }, [logtoApiEndpoint]);

    const updateLogtoUser = async (userId: string, username: string) => {
        try {
            // First get the current user data from Logto through our server-side API
            const getCurrentResponse = await fetch('/api/get-logto-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    logtoApiEndpoint
                })
            });

            if (!getCurrentResponse.ok) {
                throw new Error('Failed to fetch current Logto user data');
            }

            const currentLogtoUser = await getCurrentResponse.json();

            // Now update the user with new username through our server-side API
            const response = await fetch('/api/update-logto-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    username,
                    logtoApiEndpoint,
                    profile: {
                        ...currentLogtoUser.data?.profile,
                        preferredUsername: username
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update Logto username');
            }
        } catch (error) {
            console.error('Error updating Logto username:', error);
            throw error;
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            if (!user) throw new Error('User not authenticated');
            if (!logtoUserId) throw new Error('Could not determine your user ID');

            // Update username in Logto if changed
            if (formData.username !== user.username) {
                await updateLogtoUser(logtoUserId, formData.username);
            }

            const updateData: Partial<User> = {
                name: formData.name,
                major: formData.major || undefined,
                zelle_information: formData.zelle_information || undefined,
                pid: formData.pid || undefined,
                member_id: formData.member_id || undefined
            };

            // Only include graduation_year if it's a valid number
            if (formData.graduation_year && !isNaN(Number(formData.graduation_year))) {
                updateData.graduation_year = Number(formData.graduation_year);
            }

            await update.updateFields(Collections.USERS, user.id, updateData);

            // Update local user state
            setUser(prev => prev ? { ...prev, ...updateData } : null);

            toast.success('Profile updated successfully!');
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Failed to update profile. Please try again.');
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

    if (!user) {
        return (
            <div className="alert alert-error">
                <div>
                    <span>You must be logged in to access this page.</span>
                </div>
            </div>
        );
    }

    return (
        <div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-control">
                    <label className="label">
                        <span className="label-text">Full Name</span>
                    </label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="input input-bordered w-full"
                        required
                    />
                </div>

                <div className="form-control">
                    <label className="label">
                        <span className="label-text">Username</span>
                    </label>
                    <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleInputChange}
                        className="input input-bordered w-full"
                        pattern="^[A-Z_a-z]\w*$"
                        title="Username must start with a letter or underscore and can contain only letters, numbers, and underscores"
                        required
                    />
                </div>

                <div className="form-control">
                    <label className="label">
                        <span className="label-text">Email Address</span>
                        <span className="label-text-alt text-info">Cannot be changed</span>
                    </label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        className="input input-bordered w-full"
                        disabled
                    />
                    <label className="label">
                        <span className="label-text-alt">Email changes must be processed by an administrator</span>
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">PID</span>
                            <span className="label-text-alt text-info">UCSD Student ID</span>
                        </label>
                        <input
                            type="text"
                            name="pid"
                            value={formData.pid}
                            onChange={handleInputChange}
                            className="input input-bordered w-full"
                            placeholder="A12345678"
                            pattern="[A-Za-z][0-9]{8}"
                            title="PID format: A12345678"
                        />
                    </div>

                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">IEEE Member ID</span>
                            <span className="label-text-alt text-info">Optional</span>
                        </label>
                        <input
                            type="text"
                            name="member_id"
                            value={formData.member_id}
                            onChange={handleInputChange}
                            className="input input-bordered w-full"
                            placeholder="IEEE Membership Number"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Major</span>
                        </label>
                        <select
                            name="major"
                            value={formData.major}
                            onChange={handleInputChange}
                            className="select select-bordered w-full"
                        >
                            <option value="">Select a major</option>
                            {(() => {
                                const standardMajors = allMajors
                                    .split('\n')
                                    .filter(major => major.trim() !== '')
                                    .sort((a, b) => a.localeCompare(b));

                                if (formData.major && !standardMajors.includes(formData.major)) {
                                    standardMajors.push(formData.major);
                                    standardMajors.sort((a, b) => a.localeCompare(b));
                                }

                                return standardMajors.map((major, index) => (
                                    <option key={index} value={major}>
                                        {major}
                                    </option>
                                ));
                            })()}
                        </select>
                    </div>

                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Graduation Year</span>
                        </label>
                        <input
                            type="number"
                            name="graduation_year"
                            value={formData.graduation_year}
                            onChange={handleInputChange}
                            className="input input-bordered w-full"
                            min="2000"
                            max="2100"
                        />
                    </div>
                </div>

                <div className="form-control">
                    <label className="label">
                        <span className="label-text">Zelle Information (for reimbursements)</span>
                    </label>
                    <input
                        type="text"
                        name="zelle_information"
                        value={formData.zelle_information}
                        onChange={handleInputChange}
                        className="input input-bordered w-full"
                        placeholder="Email or phone number associated with your Zelle account"
                    />
                </div>

                <div className="form-control mt-6">
                    <button
                        type="submit"
                        className={`btn btn-primary ${saving ? 'loading' : ''}`}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
} 