import { useState, useEffect } from 'react';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Update } from '../../../scripts/pocketbase/Update';
import { Collections, type User } from '../../../schemas/pocketbase/schema';
import allMajors from '../../../data/allUCSDMajors.txt?raw';
import { toast } from 'react-hot-toast';

export default function UserProfileSettings() {
    const auth = Authentication.getInstance();
    const update = Update.getInstance();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        major: '',
        graduation_year: '',
        zelle_information: '',
        pid: '',
        member_id: ''
    });

    // Parse the majors list from the text file and sort alphabetically
    const majorsList = allMajors
        .split('\n')
        .filter(major => major.trim() !== '')
        .sort((a, b) => a.localeCompare(b));

    useEffect(() => {
        const loadUserData = async () => {
            try {
                const currentUser = auth.getCurrentUser();
                if (currentUser) {
                    setUser(currentUser);
                    setFormData({
                        name: currentUser.name || '',
                        email: currentUser.email || '',
                        major: currentUser.major || '',
                        graduation_year: currentUser.graduation_year?.toString() || '',
                        zelle_information: currentUser.zelle_information || '',
                        pid: currentUser.pid || '',
                        member_id: currentUser.member_id || ''
                    });
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
                            {majorsList.map((major, index) => (
                                <option key={index} value={major}>
                                    {major}
                                </option>
                            ))}
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