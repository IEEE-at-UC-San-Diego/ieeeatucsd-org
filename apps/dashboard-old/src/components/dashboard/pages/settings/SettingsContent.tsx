import React, { useState, useEffect } from 'react';
import { Save, Shield, UserCircle, Upload, FileText, AlertCircle, CheckCircle, Eye, EyeOff, LayoutDashboard, Sidebar, PanelTop } from 'lucide-react';
import { auth, db } from '../../../../firebase/client';
import { doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, onAuthStateChanged } from 'firebase/auth';
import type { User, NavigationLayout } from '../../shared/types/firestore';
import { PublicProfileService } from '../../shared/services/publicProfile';
import { Skeleton } from '@heroui/react';
import { normalizeMajorName } from '../../../../utils/majorNormalization';
import { useNavigationPreference } from '../../shared/hooks/useNavigationPreference';

export default function SettingsContent() {
    const [userData, setUserData] = useState<User | null>(null);
    const [loading, setLoading] = useState(true); // Start true for better UX (data fetching begins immediately)
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isGoogleUser, setIsGoogleUser] = useState(false);

    // Navigation preference
    const { navigationLayout, setNavigationLayout, loading: navPrefLoading } = useNavigationPreference();
    const [savingNavPref, setSavingNavPref] = useState(false);

    // Profile form state
    const [profileData, setProfileData] = useState({
        name: '',
        pid: '',
        major: '',
        graduationYear: '',
        memberId: '',
        zelleInformation: ''
    });

    // Password form state
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });

    // Resume state
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [uploadingResume, setUploadingResume] = useState(false);

    // Use db from client import
    const storage = getStorage();

    useEffect(() => {
        let userDataUnsubscribe: (() => void) | null = null;

        const authUnsubscribe = onAuthStateChanged(auth, (user) => {
            // Clean up previous user data listener if it exists
            if (userDataUnsubscribe) {
                userDataUnsubscribe();
                userDataUnsubscribe = null;
            }

            if (user) {
                userDataUnsubscribe = loadUserData(user);
            } else {
                setError('Not authenticated');
                setLoading(false);
            }
        });

        return () => {
            authUnsubscribe();
            if (userDataUnsubscribe) {
                userDataUnsubscribe();
            }
        };
    }, []);

    const loadUserData = (user: any) => {
        try {
            // Check if user logged in with Google
            const isGoogle = user.providerData.some((provider: any) =>
                provider.providerId === 'google.com'
            );
            setIsGoogleUser(isGoogle);

            // Set up real-time listener for user data
            const userRef = doc(db, 'users', user.uid);
            const unsubscribe = onSnapshot(
                userRef,
                (userSnap) => {
                    if (userSnap.exists()) {
                        const data = userSnap.data() as User;
                        setUserData(data);
                        setProfileData({
                            name: data.name || '',
                            pid: data.pid || '',
                            major: data.major || '',
                            graduationYear: data.graduationYear?.toString() || '',
                            memberId: data.memberId || '',
                            zelleInformation: data.zelleInformation || ''
                        });
                    }
                    setLoading(false);
                },
                (err: any) => {
                    setError(err.message);
                    setLoading(false);
                }
            );

            // Store unsubscribe function for cleanup
            return unsubscribe;
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
            return () => { };
        }
    };

    const handleProfileUpdate = async () => {
        if (!auth.currentUser) return;

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);

            // Normalize major name before saving
            const normalizedMajor = normalizeMajorName(profileData.major);

            const updateData: Partial<User> = {
                name: profileData.name,
            };

            // Only add fields that have values (avoid undefined)
            if (profileData.pid) {
                updateData.pid = profileData.pid;
            }
            if (normalizedMajor) {
                updateData.major = normalizedMajor;
            }
            if (profileData.graduationYear) {
                updateData.graduationYear = parseInt(profileData.graduationYear);
            }
            if (profileData.memberId) {
                updateData.memberId = profileData.memberId;
            }
            if (profileData.zelleInformation) {
                updateData.zelleInformation = profileData.zelleInformation;
            }

            // Update private user document
            await updateDoc(userRef, updateData);

            // Sync public profile data (only include fields with values)
            const publicProfileData: any = {
                name: profileData.name,
                points: userData?.points || 0,
                eventsAttended: userData?.eventsAttended || 0,
                position: userData?.position || userData?.role || 'Member'
            };

            // Only add optional fields if they have values
            if (normalizedMajor) {
                publicProfileData.major = normalizedMajor;
            }
            if (profileData.graduationYear) {
                publicProfileData.graduationYear = parseInt(profileData.graduationYear);
            }

            await PublicProfileService.syncPublicProfile(auth.currentUser.uid, publicProfileData);

            setSuccess('Profile updated successfully!');

            // Update local state
            setUserData(prev => prev ? { ...prev, ...updateData } : null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePasswordChange = async () => {
        if (!auth.currentUser || isGoogleUser) return;

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setError('New password must be at least 6 characters');
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            // Reauthenticate user with current password
            const credential = EmailAuthProvider.credential(
                auth.currentUser.email!,
                passwordData.currentPassword
            );
            await reauthenticateWithCredential(auth.currentUser, credential);

            // Update password
            await updatePassword(auth.currentUser, passwordData.newPassword);

            setSuccess('Password updated successfully!');
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
        } catch (err: any) {
            if (err.code === 'auth/wrong-password') {
                setError('Current password is incorrect');
            } else {
                setError(err.message);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleResumeUpload = async () => {
        if (!resumeFile || !auth.currentUser) return;

        setUploadingResume(true);
        setError(null);
        setSuccess(null);

        try {
            // Delete old resume if it exists
            if (userData?.resume) {
                try {
                    // Extract path from download URL
                    const url = new URL(userData.resume);
                    const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
                    if (pathMatch) {
                        const storagePath = decodeURIComponent(pathMatch[1]);
                        const oldResumeRef = ref(storage, storagePath);
                        await deleteObject(oldResumeRef);
                    }
                } catch (deleteError) {
                    console.warn('Failed to delete old resume:', deleteError);
                }
            }

            // Upload new resume
            const fileName = `${Date.now()}_${resumeFile.name}`;
            const storageRef = ref(storage, `resumes/${auth.currentUser.uid}/${fileName}`);

            const uploadTask = uploadBytesResumable(storageRef, resumeFile);
            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', null, reject, () => resolve(uploadTask.snapshot.ref));
            });

            const downloadURL = await getDownloadURL(storageRef);

            // Update user document with new resume URL
            const userRef = doc(db, 'users', auth.currentUser.uid);
            await updateDoc(userRef, { resume: downloadURL });

            setUserData(prev => prev ? { ...prev, resume: downloadURL } : null);
            setResumeFile(null);
            setSuccess('Resume uploaded successfully!');
        } catch (err: any) {
            setError('Failed to upload resume: ' + err.message);
        } finally {
            setUploadingResume(false);
        }
    };

    const handleResumeRemove = async () => {
        if (!auth.currentUser || !userData?.resume) return;

        if (!confirm('Are you sure you want to remove your resume?')) return;

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            // Delete from storage
            try {
                // Extract path from download URL
                const url = new URL(userData.resume);
                const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
                if (pathMatch) {
                    const storagePath = decodeURIComponent(pathMatch[1]);
                    const resumeRef = ref(storage, storagePath);
                    await deleteObject(resumeRef);
                }
            } catch (deleteError) {
                console.warn('Failed to delete resume from storage:', deleteError);
            }

            // Update user document
            const userRef = doc(db, 'users', auth.currentUser.uid);
            await updateDoc(userRef, { resume: null });

            setUserData(prev => prev ? { ...prev, resume: undefined } : null);
            setSuccess('Resume removed successfully!');
        } catch (err: any) {
            setError('Failed to remove resume: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleNavigationLayoutChange = async (layout: NavigationLayout) => {
        setSavingNavPref(true);
        setError(null);
        setSuccess(null);

        try {
            await setNavigationLayout(layout);
            setSuccess('Navigation layout updated successfully! The page will reload to apply changes.');

            // Reload page after a short delay to apply the new layout
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err: any) {
            setError('Failed to update navigation layout: ' + err.message);
        } finally {
            setSavingNavPref(false);
        }
    };

    // Helper function to detect if current user is OAuth user
    const isCurrentUserOAuth = () => {
        if (userData?.signInMethod) {
            return userData.signInMethod !== 'email';
        }

        // Fallback: check auth providers
        if (auth.currentUser) {
            return auth.currentUser.providerData.some(provider =>
                provider.providerId !== 'password' &&
                provider.providerId !== 'email'
            );
        }

        return false;
    };

    if (loading) {
        return (
            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="mb-8">
                        <Skeleton className="h-8 w-48 mb-2" />
                        <Skeleton className="h-4 w-96" />
                    </div>

                    {/* Profile Settings Card */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <Skeleton className="h-6 w-32 mb-6" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <Skeleton className="h-4 w-16 mb-2" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                                <div>
                                    <Skeleton className="h-4 w-16 mb-2" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                                <div>
                                    <Skeleton className="h-4 w-20 mb-2" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <Skeleton className="h-4 w-24 mb-2" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                                <div>
                                    <Skeleton className="h-4 w-20 mb-2" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                                <div>
                                    <Skeleton className="h-4 w-16 mb-2" />
                                    <Skeleton className="h-24 w-full" />
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <Skeleton className="h-10 w-32" />
                        </div>
                    </div>

                    {/* Resume Upload Card */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <Skeleton className="h-6 w-24 mb-6" />
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                            <div className="text-center space-y-4">
                                <Skeleton className="h-12 w-12 mx-auto rounded" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-48 mx-auto" />
                                    <Skeleton className="h-3 w-32 mx-auto" />
                                </div>
                                <Skeleton className="h-10 w-24 mx-auto" />
                            </div>
                        </div>
                    </div>

                    {/* Password Change Card */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <Skeleton className="h-6 w-32 mb-6" />
                        <div className="space-y-4 max-w-md">
                            <div>
                                <Skeleton className="h-4 w-28 mb-2" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <div>
                                <Skeleton className="h-4 w-24 mb-2" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <div>
                                <Skeleton className="h-4 w-32 mb-2" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <Skeleton className="h-10 w-32" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                        <p className="text-gray-600">Manage your account settings and preferences</p>
                    </div>
                </div>
            </header>

            {/* Settings Content */}
            <main className="p-4 md:p-6">
                <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
                    {/* Status Messages */}
                    {error && (
                        <div className="flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm md:text-base">{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="flex items-center space-x-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
                            <CheckCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm md:text-base">{success}</span>
                        </div>
                    )}

                    {/* Profile Settings */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                        <div className="flex items-center space-x-3 mb-4 md:mb-6">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <UserCircle className="w-5 h-5 text-blue-600" />
                            </div>
                            <h2 className="text-base md:text-lg font-semibold text-gray-900">Profile Settings</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base min-h-[44px]"
                                    placeholder="John Doe"
                                    value={profileData.name}
                                    onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed text-base min-h-[44px]"
                                    value={userData?.email || ''}
                                    disabled
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    {isCurrentUserOAuth()
                                        ? 'Email cannot be changed for users who signed in with OAuth providers'
                                        : 'Email cannot be changed'
                                    }
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Student ID (PID)</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="A12345678"
                                    value={profileData.pid}
                                    onChange={(e) => setProfileData(prev => ({ ...prev, pid: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Major</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Computer Science"
                                    value={profileData.major}
                                    onChange={(e) => setProfileData(prev => ({ ...prev, major: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Expected Graduation Year</label>
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="2025"
                                    min="2024"
                                    max="2030"
                                    value={profileData.graduationYear}
                                    onChange={(e) => setProfileData(prev => ({ ...prev, graduationYear: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">IEEE Member ID (Optional)</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="12345678"
                                    value={profileData.memberId}
                                    onChange={(e) => setProfileData(prev => ({ ...prev, memberId: e.target.value }))}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Zelle Information (Optional)</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Phone number or email for reimbursements"
                                    value={profileData.zelleInformation}
                                    onChange={(e) => setProfileData(prev => ({ ...prev, zelleInformation: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end mt-6">
                            <button
                                onClick={handleProfileUpdate}
                                disabled={saving}
                                className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-5 h-5" />
                                <span>{saving ? 'Saving...' : 'Save Profile'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Navigation Layout Preference */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                        <div className="flex items-center space-x-3 mb-4 md:mb-6">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <LayoutDashboard className="w-5 h-5 text-purple-600" />
                            </div>
                            <div>
                                <h2 className="text-base md:text-lg font-semibold text-gray-900">Navigation Layout</h2>
                                <p className="text-xs md:text-sm text-gray-500">Choose your preferred navigation style</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Horizontal Navbar Option */}
                            <button
                                onClick={() => handleNavigationLayoutChange('horizontal')}
                                disabled={savingNavPref || navPrefLoading}
                                className={`relative p-6 border-2 rounded-lg transition-all text-left ${navigationLayout === 'horizontal'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${navigationLayout === 'horizontal' ? 'bg-blue-100' : 'bg-gray-100'
                                        }`}>
                                        <PanelTop className={`w-6 h-6 ${navigationLayout === 'horizontal' ? 'text-blue-600' : 'text-gray-600'
                                            }`} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-lg text-gray-900 mb-1">Horizontal Navbar</h3>
                                        <p className="text-sm text-gray-600">Traditional top navigation bar with dropdown menus</p>
                                    </div>
                                </div>
                                {navigationLayout === 'horizontal' && (
                                    <div className="absolute top-3 right-3">
                                        <CheckCircle className="w-6 h-6 text-blue-600" />
                                    </div>
                                )}
                                {/* Visual Preview - Horizontal Navbar Only */}
                                <div className="mt-3 p-2 bg-white rounded border border-gray-200 h-28 w-full flex flex-col">
                                    <div className="h-8 bg-[#0A2463] rounded flex items-center px-2 gap-1 mb-1.5 flex-shrink-0">
                                        {/* Logo */}
                                        <div className="h-4 w-4 bg-white rounded-sm flex-shrink-0"></div>
                                        {/* Nav items */}
                                        <div className="flex gap-1 ml-auto">
                                            <div className="h-2 w-8 bg-white/20 rounded"></div>
                                            <div className="h-2 w-8 bg-white/10 rounded"></div>
                                            <div className="h-2 w-8 bg-white/10 rounded"></div>
                                        </div>
                                    </div>
                                    <div className="flex-1 bg-gray-100 rounded min-h-0"></div>
                                </div>
                            </button>

                            {/* Sidebar Option */}
                            <button
                                onClick={() => handleNavigationLayoutChange('sidebar')}
                                disabled={savingNavPref || navPrefLoading}
                                className={`relative p-6 border-2 rounded-lg transition-all text-left ${navigationLayout === 'sidebar'
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${navigationLayout === 'sidebar' ? 'bg-blue-100' : 'bg-gray-100'
                                        }`}>
                                        <Sidebar className={`w-6 h-6 ${navigationLayout === 'sidebar' ? 'text-blue-600' : 'text-gray-600'
                                            }`} />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-lg text-gray-900 mb-1">Sidebar Navigation</h3>
                                        <p className="text-sm text-gray-600">Collapsible sidebar with organized menu groups</p>
                                    </div>
                                </div>
                                {navigationLayout === 'sidebar' && (
                                    <div className="absolute top-3 right-3">
                                        <CheckCircle className="w-6 h-6 text-blue-600" />
                                    </div>
                                )}
                                {/* Visual Preview - Sidebar Only */}
                                <div className="mt-3 p-2 bg-white rounded border border-gray-200 h-28 w-full flex gap-1.5">
                                    <div className="w-20 bg-[#0A2463] rounded p-2 flex flex-col gap-1.5 flex-shrink-0">
                                        {/* Logo area */}
                                        <div className="h-3 bg-white rounded mb-1"></div>
                                        {/* Menu items */}
                                        <div className="space-y-1">
                                            <div className="h-2 bg-white/20 rounded"></div>
                                            <div className="h-2 bg-white/10 rounded"></div>
                                            <div className="h-2 bg-white/10 rounded"></div>
                                            <div className="h-2 bg-white/10 rounded"></div>
                                        </div>
                                        {/* Spacer */}
                                        <div className="flex-1 min-h-0"></div>
                                        {/* User section at bottom */}
                                        <div className="h-3 bg-white/10 rounded"></div>
                                    </div>
                                    <div className="flex-1 bg-gray-100 rounded min-h-0"></div>
                                </div>
                            </button>
                        </div>

                        {savingNavPref && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-700">Updating navigation layout...</p>
                            </div>
                        )}
                    </div>

                    {/* Resume Settings */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <FileText className="w-5 h-5 text-green-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900">Resume</h2>
                        </div>

                        {userData?.resume ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <div className="flex items-center space-x-3">
                                        <FileText className="w-8 h-8 text-gray-400" />
                                        <div>
                                            <p className="font-medium text-gray-900">Current Resume</p>
                                            <p className="text-sm text-gray-500">Uploaded resume file</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <a
                                            href={userData.resume}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                            View
                                        </a>
                                        <button
                                            onClick={handleResumeRemove}
                                            disabled={saving}
                                            className="px-3 py-2 text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <h3 className="font-medium text-gray-900 mb-2">Replace Resume</h3>
                                    <div className="flex items-center space-x-4">
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx"
                                            onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                                            className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                        <button
                                            onClick={handleResumeUpload}
                                            disabled={!resumeFile || uploadingResume}
                                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Upload className="w-4 h-4" />
                                            <span>{uploadingResume ? 'Uploading...' : 'Replace'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-gray-600">No resume uploaded. Upload your resume for networking opportunities.</p>
                                <div className="flex items-center space-x-4">
                                    <input
                                        type="file"
                                        accept=".pdf,.doc,.docx"
                                        onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                                        className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                    <button
                                        onClick={handleResumeUpload}
                                        disabled={!resumeFile || uploadingResume}
                                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Upload className="w-4 h-4" />
                                        <span>{uploadingResume ? 'Uploading...' : 'Upload'}</span>
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500">Accepted formats: PDF, DOC, DOCX</p>
                            </div>
                        )}
                    </div>

                    {/* Security Settings */}
                    {!isGoogleUser && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center space-x-3 mb-6">
                                <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-red-600" />
                                </div>
                                <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPasswords.current ? 'text' : 'password'}
                                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="••••••••"
                                            value={passwordData.currentPassword}
                                            onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPasswords.new ? 'text' : 'password'}
                                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="••••••••"
                                            value={passwordData.newPassword}
                                            onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPasswords.confirm ? 'text' : 'password'}
                                            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="••••••••"
                                            value={passwordData.confirmPassword}
                                            onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-end mt-6">
                                    <button
                                        onClick={handlePasswordChange}
                                        disabled={saving || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                                        className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Shield className="w-5 h-5" />
                                        <span>{saving ? 'Updating...' : 'Update Password'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {isGoogleUser && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                            <div className="flex items-center space-x-2 text-blue-700">
                                <Shield className="w-5 h-5" />
                                <span className="font-medium">Google Account</span>
                            </div>
                            <p className="text-blue-600 mt-2">
                                You signed in with Google. To change your password, please visit your Google Account settings.
                            </p>
                        </div>
                    )}

                    {/* Legal Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                        <div className="flex items-center space-x-3 mb-4 md:mb-6">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FileText className="w-5 h-5 text-gray-600" />
                            </div>
                            <div>
                                <h2 className="text-base md:text-lg font-semibold text-gray-900">Legal</h2>
                                <p className="text-xs md:text-sm text-gray-500">Review our policies and terms</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <a
                                href="/terms-of-service"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                            >
                                <div className="flex items-center space-x-3">
                                    <FileText className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                                    <div>
                                        <p className="font-medium text-gray-900 group-hover:text-blue-700">Terms of Service</p>
                                        <p className="text-xs text-gray-500">Our terms and conditions</p>
                                    </div>
                                </div>
                                <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                            <a
                                href="/privacy-policy"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                            >
                                <div className="flex items-center space-x-3">
                                    <Shield className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                                    <div>
                                        <p className="font-medium text-gray-900 group-hover:text-blue-700">Privacy Policy</p>
                                        <p className="text-xs text-gray-500">How we handle your data</p>
                                    </div>
                                </div>
                                <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
} 