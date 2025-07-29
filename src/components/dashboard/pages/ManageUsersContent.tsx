import React, { useState, useEffect } from 'react';
import { Search, Calendar, Bell, User, Plus, Filter, Edit, Trash2, UserCheck, UserX, Mail, Shield, Users, GraduationCap, Send, X, CheckCircle, Clock, XCircle, AlertCircle, Check, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { getFirestore, collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, where, orderBy, limit, getDoc } from 'firebase/firestore';
import { app, auth } from '../../../firebase/client';
import type { User as FirestoreUser, UserRole } from '../types/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { PublicProfileService } from '../services/publicProfile';

interface UserModalData {
    id?: string;
    name: string;
    email: string;
    role: UserRole;
    position?: string;
    status: 'active' | 'inactive' | 'suspended';
    pid?: string;
    memberId?: string;
    major?: string;
    graduationYear?: number;
    points?: number;
}

interface InviteModalData {
    name: string;
    email: string;
    role: UserRole;
    position: string;
    message: string;
}

export default function ManageUsersContent() {
    const [user, userLoading, userError] = useAuthState(auth);
    const [users, setUsers] = useState<(FirestoreUser & { id: string })[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<(FirestoreUser & { id: string })[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
    const [showUserModal, setShowUserModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [editingUser, setEditingUser] = useState<UserModalData | null>(null);
    const [inviteData, setInviteData] = useState<InviteModalData>({
        name: '',
        email: '',
        role: 'Member',
        position: '',
        message: 'You have been invited to join IEEE UCSD. Please click the link below to create your account and get started.'
    });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<(FirestoreUser & { id: string }) | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<UserRole>('Member');
    const [roleLoading, setRoleLoading] = useState(false);

    // Add Member Search state
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [memberSearchTerm, setMemberSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<(FirestoreUser & { id: string })[]>([]);
    const [selectedMember, setSelectedMember] = useState<(FirestoreUser & { id: string }) | null>(null);
    const [newRole, setNewRole] = useState<UserRole>('General Officer');
    const [newPosition, setNewPosition] = useState('');

    // Sorting state
    const [sortField, setSortField] = useState<string>('name');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const db = getFirestore(app);

    const roles: UserRole[] = ['Member', 'General Officer', 'Executive Officer', 'Member at Large', 'Past Officer', 'Sponsor', 'Administrator'];

    // Sortable header component
    const SortableHeader = ({ field, children, className = "" }: { field: string; children: React.ReactNode; className?: string }) => (
        <th
            className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${className}`}
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-1">
                {children}
                {sortField === field ? (
                    sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                ) : (
                    <ChevronsUpDown className="w-4 h-4 opacity-50" />
                )}
            </div>
        </th>
    );

    // Sorting function
    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Sort users based on current sort field and direction
    const sortedUsers = React.useMemo(() => {
        return [...filteredUsers].sort((a, b) => {
            let aValue: any = '';
            let bValue: any = '';

            switch (sortField) {
                case 'name':
                    aValue = a.name || a.email || '';
                    bValue = b.name || b.email || '';
                    break;
                case 'email':
                    aValue = a.email || '';
                    bValue = b.email || '';
                    break;
                case 'role':
                    aValue = a.role || '';
                    bValue = b.role || '';
                    break;
                case 'status':
                    aValue = a.status || '';
                    bValue = b.status || '';
                    break;
                case 'major':
                    aValue = a.major || '';
                    bValue = b.major || '';
                    break;
                case 'graduationYear':
                    aValue = a.graduationYear || 0;
                    bValue = b.graduationYear || 0;
                    break;
                case 'points':
                    aValue = a.points || 0;
                    bValue = b.points || 0;
                    break;
                case 'joinDate':
                    aValue = a.joinDate ? (a.joinDate.toMillis ? a.joinDate.toMillis() : a.joinDate.toDate ? a.joinDate.toDate().getTime() : 0) : 0;
                    bValue = b.joinDate ? (b.joinDate.toMillis ? b.joinDate.toMillis() : b.joinDate.toDate ? b.joinDate.toDate().getTime() : 0) : 0;
                    break;
                case 'lastLogin':
                    aValue = a.lastLogin ? (a.lastLogin.toMillis ? a.lastLogin.toMillis() : a.lastLogin.toDate ? a.lastLogin.toDate().getTime() : 0) : 0;
                    bValue = b.lastLogin ? (b.lastLogin.toMillis ? b.lastLogin.toMillis() : b.lastLogin.toDate ? b.lastLogin.toDate().getTime() : 0) : 0;
                    break;
                default:
                    return 0;
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredUsers, sortField, sortDirection]);

    useEffect(() => {
        console.log('User auth state:', { user: user?.uid, userLoading, userError });

        if (userLoading) return; // Wait for auth to resolve

        if (!user) {
            setCurrentUserRole('Member');
            setCurrentUser(null);
            return;
        }

        // Get current user info
        const getCurrentUser = async () => {
            try {
                setRoleLoading(true);
                console.log('Fetching user role for:', user.uid);

                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const currentUserData = {
                        id: user.uid,
                        ...userData
                    } as FirestoreUser & { id: string };

                    console.log('User data found:', { role: userData.role, name: userData.name });
                    setCurrentUser(currentUserData);
                    setCurrentUserRole(userData.role || 'Member');
                } else {
                    console.log('No user document found for:', user.uid);
                    setCurrentUserRole('Member');
                    setCurrentUser(null);
                }
            } catch (error) {
                console.error('Error fetching current user:', error);
                setCurrentUserRole('Member');
                setCurrentUser(null);
            } finally {
                setRoleLoading(false);
            }
        };

        getCurrentUser();
        fetchUsers();
    }, [user, userLoading]);

    useEffect(() => {
        filterUsers();
    }, [users, searchTerm, roleFilter, statusFilter]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log('Starting to fetch users...');

            const usersRef = collection(db, 'users');
            console.log('Users collection reference created');

            // First try to get all users without any query constraints
            const usersSnapshot = await getDocs(usersRef);
            console.log('Users snapshot retrieved:', usersSnapshot.size, 'documents');

            if (usersSnapshot.empty) {
                console.warn('No users found in the database');
                setError('No users found in the database');
                setUsers([]);
                return;
            }

            const usersData = usersSnapshot.docs.map(doc => {
                const data = doc.data();
                console.log('User document:', doc.id, data);

                return {
                    id: doc.id,
                    email: data.email || '',
                    emailVisibility: data.emailVisibility ?? true,
                    verified: data.verified ?? false,
                    name: data.name || '',
                    username: data.username,
                    avatar: data.avatar,
                    pid: data.pid,
                    memberId: data.memberId,
                    graduationYear: data.graduationYear,
                    major: data.major,
                    zelleInformation: data.zelleInformation,
                    lastLogin: data.lastLogin,
                    notificationPreferences: data.notificationPreferences || {},
                    displayPreferences: data.displayPreferences || {},
                    accessibilitySettings: data.accessibilitySettings || {},
                    resume: data.resume,
                    signedUp: data.signedUp ?? false,
                    requestedEmail: data.requestedEmail ?? false,
                    role: data.role || 'Member',
                    position: data.position,
                    status: data.status || 'active',
                    joinDate: data.joinDate || { toDate: () => new Date() },
                    eventsAttended: data.eventsAttended || 0,
                    points: data.points || 0,
                    invitedBy: data.invitedBy,
                    inviteAccepted: data.inviteAccepted,
                    lastUpdated: data.lastUpdated || data.joinDate || { toDate: () => new Date() },
                    lastUpdatedBy: data.lastUpdatedBy,
                    signInMethod: data.signInMethod || 'email'
                };
            }) as (FirestoreUser & { id: string })[];

            console.log('Processed users data:', usersData.length, usersData);
            setUsers(usersData);

        } catch (error) {
            console.error('Error fetching users:', error);
            setError('Failed to fetch users: ' + (error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const filterUsers = () => {
        let filtered = [...users];

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(user =>
                user.name?.toLowerCase().includes(term) ||
                user.email?.toLowerCase().includes(term) ||
                user.major?.toLowerCase().includes(term) ||
                user.memberId?.toLowerCase().includes(term)
            );
        }

        // Role filter
        if (roleFilter !== 'all') {
            filtered = filtered.filter(user => user.role === roleFilter);
        }

        // Status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(user => user.status === statusFilter);
        }

        setFilteredUsers(filtered);
    };

    // Search for members to add (could be enhanced to search external databases)
    const searchMembers = () => {
        if (!memberSearchTerm || memberSearchTerm.length < 2) {
            setSearchResults([]);
            return;
        }

        const term = memberSearchTerm.toLowerCase();
        // Search all users, not just inactive ones
        const results = users.filter(user =>
            user.name?.toLowerCase().includes(term) ||
            user.email?.toLowerCase().includes(term) ||
            user.major?.toLowerCase().includes(term) ||
            user.memberId?.toLowerCase().includes(term) ||
            user.pid?.toLowerCase().includes(term)
        );

        console.log('Search term:', term);
        console.log('Total users:', users.length);
        console.log('Search results:', results.length);

        setSearchResults(results);
    };

    // Auto-search when search term changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            searchMembers();
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
    }, [memberSearchTerm, users]);

    const handleAddExistingMember = async () => {
        if (!selectedMember) return;

        try {
            // Update the member's role, position, and status
            const userRef = doc(db, 'users', selectedMember.id);
            const updateData: any = {
                role: newRole,
                position: newPosition,
                lastUpdated: new Date(),
                lastUpdatedBy: user?.uid || 'unknown'
            };

            // If the member is inactive, activate them
            if (selectedMember.status === 'inactive') {
                updateData.status = 'active';
            }

            await updateDoc(userRef, updateData);

            setSuccess(`${selectedMember.name || selectedMember.email} has been promoted to ${newRole}${newPosition ? ` as ${newPosition}` : ''}`);
            setShowAddMemberModal(false);
            setSelectedMember(null);
            setMemberSearchTerm('');
            setSearchResults([]);
            setNewRole('General Officer');
            setNewPosition('');
            fetchUsers();
        } catch (error) {
            console.error('Error updating member:', error);
            setError('Failed to promote member');
        }
    };

    const handleEditUser = (user: FirestoreUser & { id: string }) => {
        setEditingUser({
            id: user.id,
            name: user.name || '',
            email: user.email || '',
            role: user.role || 'Member',
            position: user.position || '',
            status: user.status || 'active',
            pid: user.pid || '',
            memberId: user.memberId || '',
            major: user.major || '',
            graduationYear: user.graduationYear || undefined,
            points: user.points || 0
        });
        setShowUserModal(true);
    };

    const handleUpdateUser = async () => {
        if (!editingUser || !editingUser.id) return;

        try {
            // Find the target user to check permissions
            const targetUser = users.find(u => u.id === editingUser.id);
            if (!targetUser) {
                setError('User not found');
                return;
            }

            // Check role edit permission
            if (!canEditUserRole(targetUser)) {
                setError('You do not have permission to change this user\'s role');
                return;
            }

            // Check position edit permission 
            if (!canEditUserPosition(targetUser)) {
                setError('You do not have permission to change this user\'s position');
                return;
            }

            const userRef = doc(db, 'users', editingUser.id);
            const updateData: any = {
                name: editingUser.name,
                role: editingUser.role,
                position: editingUser.position || '',
                status: editingUser.status,
                pid: editingUser.pid || '',
                memberId: editingUser.memberId || '',
                major: editingUser.major || '',
                graduationYear: editingUser.graduationYear || null,
                lastUpdated: new Date(),
                lastUpdatedBy: user?.uid || 'unknown'
            };

            // Only administrators can modify points
            if (currentUserRole === 'Administrator' && editingUser.points !== undefined) {
                updateData.points = editingUser.points;
            }

            await updateDoc(userRef, updateData);

            // Sync points to public profile if points were updated
            if (currentUserRole === 'Administrator' && editingUser.points !== undefined) {
                try {
                    await PublicProfileService.updateUserStats(editingUser.id, {
                        points: editingUser.points
                    });
                } catch (profileError) {
                    console.warn('Failed to update public profile, but user update succeeded:', profileError);
                }
            }

            setSuccess('User updated successfully');
            setShowUserModal(false);
            setEditingUser(null);
            fetchUsers();
        } catch (error) {
            console.error('Error updating user:', error);
            setError('Failed to update user');
        }
    };

    const canDeleteUser = (targetUser: FirestoreUser & { id: string }): boolean => {
        // Only Administrators can delete other Administrators or Executive Officers
        if (['Administrator', 'Executive Officer'].includes(targetUser.role)) {
            return currentUserRole === 'Administrator';
        }

        // Both Administrators and Executive Officers can delete other roles
        return hasUserManagementAccess();
    };

    const handleDeleteUser = async (userId: string) => {
        const targetUser = users.find(u => u.id === userId);
        if (!targetUser) {
            setError('User not found');
            return;
        }

        if (!canDeleteUser(targetUser)) {
            setError('You do not have permission to delete this user');
            return;
        }

        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            // Delete the user document
            await deleteDoc(doc(db, 'users', userId));

            // Also delete the user's public profile if it exists
            try {
                await deleteDoc(doc(db, 'public_profiles', userId));
            } catch (profileError) {
                console.warn('Failed to delete public profile or profile does not exist:', profileError);
                // Don't fail the whole operation if public profile deletion fails
            }

            setSuccess('User and public profile deleted successfully');
            fetchUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            setError('Failed to delete user');
        }
    };

    const handleSendInvite = async () => {
        try {
            // Check permission before sending invite
            if (!canInviteWithRole(inviteData.role)) {
                setError('You do not have permission to invite users with this role');
                return;
            }

            setLoading(true);

            // Create invite record in Firebase
            const inviteRef = await addDoc(collection(db, 'invites'), {
                name: inviteData.name,
                email: inviteData.email,
                role: inviteData.role,
                position: inviteData.position,
                message: inviteData.message,
                status: 'pending',
                createdAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            });

            // Send email via Resend
            const response = await fetch('/api/email/send-user-invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: inviteData.name,
                    email: inviteData.email,
                    role: inviteData.role,
                    position: inviteData.position,
                    message: inviteData.message,
                    inviteId: inviteRef.id
                }),
            });

            if (response.ok) {
                setSuccess('Invitation sent successfully');
                setShowInviteModal(false);
                setInviteData({
                    name: '',
                    email: '',
                    role: 'Member',
                    position: '',
                    message: 'You have been invited to join IEEE UCSD. Please click the link below to create your account and get started.'
                });
            } else {
                setError('Failed to send invitation email');
            }
        } catch (error) {
            console.error('Error sending invite:', error);
            setError('Failed to send invitation');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'inactive':
                return 'bg-yellow-100 text-yellow-800';
            case 'suspended':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active':
                return <CheckCircle className="w-3 h-3" />;
            case 'inactive':
                return <Clock className="w-3 h-3" />;
            case 'suspended':
                return <XCircle className="w-3 h-3" />;
            default:
                return <AlertCircle className="w-3 h-3" />;
        }
    };

    const getRoleColor = (role: UserRole) => {
        switch (role) {
            case 'Executive Officer':
                return 'bg-purple-100 text-purple-800';
            case 'General Officer':
                return 'bg-blue-100 text-blue-800';
            case 'Member at Large':
                return 'bg-indigo-100 text-indigo-800';
            case 'Past Officer':
                return 'bg-gray-100 text-gray-800';
            case 'Sponsor':
                return 'bg-yellow-100 text-yellow-800';
            case 'Member':
            default:
                return 'bg-green-100 text-green-800';
        }
    };

    const getStats = () => {
        const totalMembers = users.length;
        const activeMembers = users.filter(u => u.status === 'active').length;
        const officers = users.filter(u => ['General Officer', 'Executive Officer'].includes(u.role)).length;
        const thisMonth = new Date();
        thisMonth.setDate(1);
        const newThisMonth = users.filter(u => u.joinDate && u.joinDate.toDate() >= thisMonth).length;

        return { totalMembers, activeMembers, officers, newThisMonth };
    };

    const stats = getStats();

    // Permission checks
    const hasUserManagementAccess = () => {
        return currentUserRole === 'Executive Officer' || currentUserRole === 'Administrator';
    };

    const canEditUserRole = (targetUser: FirestoreUser & { id: string }) => {
        // Executive Officers cannot change Administrator users
        if (currentUserRole === 'Executive Officer' && targetUser.role === 'Administrator') {
            return false;
        }

        // Administrators can change anyone's role including their own
        if (currentUserRole === 'Administrator') {
            return true;
        }

        // Executive Officers cannot change their own role
        if (currentUserRole === 'Executive Officer' && currentUser && targetUser.id === currentUser.id) {
            return false;
        }

        // Executive Officers can change other users' roles except Administrators
        if (currentUserRole === 'Executive Officer' && targetUser.role !== 'Administrator') {
            return true;
        }

        return false;
    };

    const canEditUserPosition = (targetUser: FirestoreUser & { id: string }) => {
        // Administrators can change anyone's position including their own
        if (currentUserRole === 'Administrator') {
            return true;
        }

        // Executive Officers cannot change their own position
        if (currentUserRole === 'Executive Officer' && currentUser && targetUser.id === currentUser.id) {
            return false;
        }

        // Executive Officers cannot change Administrator positions
        if (currentUserRole === 'Executive Officer' && targetUser.role === 'Administrator') {
            return false;
        }

        return hasUserManagementAccess();
    };

    const canInviteWithRole = (role: UserRole) => {
        // Only administrators can invite executive officers or administrators
        if (['Executive Officer', 'Administrator'].includes(role)) {
            return currentUserRole === 'Administrator';
        }
        return hasUserManagementAccess();
    };

    const getAvailableRoles = (isCurrentUser: boolean = false): UserRole[] => {
        if (currentUserRole === 'Administrator') {
            // Administrators can assign any role to anyone including themselves
            return roles;
        } else if (currentUserRole === 'Executive Officer') {
            if (isCurrentUser) {
                // Executive Officers cannot change their own role - return only their current role
                return [currentUserRole];
            }
            // Executive Officers can assign any role except Administrator to others
            return roles.filter(role => role !== 'Administrator');
        }

        return ['Member'];
    };

    // Helper function to detect if user is OAuth user  
    const isOAuthUser = (targetUserId: string) => {
        // Find the user in our users list and check their signInMethod
        const targetUser = users.find(u => u.id === targetUserId);
        if (targetUser && targetUser.signInMethod) {
            // Consider anything other than 'email' as OAuth
            return targetUser.signInMethod !== 'email';
        }

        // Fallback: if we can't find the sign-in method and this is the current user,
        // check the auth providers
        if (user && user.uid === targetUserId) {
            return user.providerData.some(provider =>
                provider.providerId !== 'password' &&
                provider.providerId !== 'email'
            );
        }

        return false;
    };

    // Show loading while we're fetching the user auth or role
    if (userLoading || roleLoading) {
        return (
            <div className="flex-1 overflow-auto">
                <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Loading...</h1>
                            <p className="text-gray-600">Checking permissions...</p>
                        </div>
                    </div>
                </header>
                <main className="p-6">
                    <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                </main>
            </div>
        );
    }

    // If user doesn't have access, show access denied message
    if (user && !hasUserManagementAccess()) {
        return (
            <div className="flex-1 overflow-auto">
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
                            <p className="text-gray-600">You don't have permission to access this page</p>
                        </div>
                    </div>
                </header>
                <main className="p-6">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                        <div className="flex items-center">
                            <Shield className="h-8 w-8 text-red-600" />
                            <div className="ml-4">
                                <h3 className="text-lg font-semibold text-red-800">Access Restricted</h3>
                                <p className="text-red-700">Only Executive Officers and Administrators can access user management.</p>
                                <p className="text-red-600 text-sm mt-2">Current role: {currentUserRole}</p>
                                <p className="text-red-600 text-sm">User ID: {user?.uid}</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // Show access denied if no user is logged in
    if (!user) {
        return (
            <div className="flex-1 overflow-auto">
                <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
                            <p className="text-gray-600">Please log in to access this page</p>
                        </div>
                    </div>
                </header>
                <main className="p-6">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                        <div className="flex items-center">
                            <Shield className="h-8 w-8 text-red-600" />
                            <div className="ml-4">
                                <h3 className="text-lg font-semibold text-red-800">Authentication Required</h3>
                                <p className="text-red-700">You must be logged in to access user management.</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto">
            {/* Header - Hidden on mobile, using DashboardHeader pattern */}
            <header className="hidden md:block bg-white shadow-sm border-b border-gray-200 px-4 md:px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 md:space-x-4 flex-1 min-w-0">
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search members..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base min-h-[44px]"
                            />
                        </div>
                        <div className="relative">
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                                className="appearance-none bg-white px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer min-h-[44px] text-base"
                            >
                                <option value="all">🎭 All Roles</option>
                                {roles.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                        <div className="relative">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive' | 'suspended')}
                                className="appearance-none bg-white px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer min-h-[44px] text-base"
                            >
                                <option value="all">📊 All Status</option>
                                <option value="active">✅ Active</option>
                                <option value="inactive">⏸️ Inactive</option>
                                <option value="suspended">🚫 Suspended</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 md:space-x-4">
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                            <Calendar className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                            <Bell className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
                            <User className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Manage Users Content */}
            <main className="p-4 md:p-6">
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                    {/* Page Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-6">
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Manage Users</h1>
                            <p className="text-sm md:text-base text-gray-600">Manage IEEE UCSD member accounts and permissions</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <button
                                onClick={() => setShowInviteModal(true)}
                                className="flex items-center justify-center space-x-2 px-3 md:px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px] text-sm md:text-base"
                            >
                                <Send className="w-4 h-4" />
                                <span className="hidden sm:inline">Send Invite</span>
                                <span className="sm:hidden">Invite</span>
                            </button>
                            <button
                                onClick={() => setShowAddMemberModal(true)}
                                className="flex items-center justify-center space-x-2 px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors min-h-[44px] text-sm md:text-base"
                                title="Promote an existing member to officer with role and position"
                            >
                                <Plus className="w-4 h-4" />
                                <span className="hidden sm:inline">Promote to Officer</span>
                                <span className="sm:hidden">Promote</span>
                            </button>
                        </div>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-700">{error}</p>
                            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 ml-2">×</button>
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-green-700">{success}</p>
                            <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700 ml-2">×</button>
                        </div>
                    )}

                    {/* Mobile Filters */}
                    <div className="md:hidden bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">Search & Filters</h3>
                        <div className="space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Search members..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base min-h-[44px]"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                    <select
                                        value={roleFilter}
                                        onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                                        className="w-full appearance-none bg-white px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer min-h-[44px] text-sm"
                                    >
                                        <option value="all">🎭 All Roles</option>
                                        {roles.map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="relative">
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive' | 'suspended')}
                                        className="w-full appearance-none bg-white px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer min-h-[44px] text-sm"
                                    >
                                        <option value="all">📊 All Status</option>
                                        <option value="active">✅ Active</option>
                                        <option value="inactive">⏸️ Inactive</option>
                                        <option value="suspended">🚫 Suspended</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* User Management Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-4 md:mb-6">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-600">Total Members</p>
                                    <p className="text-lg md:text-2xl font-bold text-gray-900">{stats.totalMembers}</p>
                                </div>
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <Users className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Active Members</p>
                                    <p className="text-2xl font-bold text-green-600">{stats.activeMembers}</p>
                                </div>
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <UserCheck className="w-6 h-6 text-green-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Officers</p>
                                    <p className="text-2xl font-bold text-purple-600">{stats.officers}</p>
                                </div>
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-purple-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">New This Month</p>
                                    <p className="text-2xl font-bold text-blue-600">{stats.newThisMonth}</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <GraduationCap className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Members Table */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">All Members ({filteredUsers.length})</h2>
                        </div>
                        <div className="overflow-x-auto">
                            {loading ? (
                                <div className="p-6 text-center">
                                    <p className="text-gray-500">Loading users...</p>
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <SortableHeader field="name">
                                                Member
                                            </SortableHeader>
                                            <SortableHeader field="major">
                                                Academic Info
                                            </SortableHeader>
                                            <SortableHeader field="role">
                                                Role
                                            </SortableHeader>
                                            <SortableHeader field="status">
                                                Status
                                            </SortableHeader>
                                            <SortableHeader field="points">
                                                Activity
                                            </SortableHeader>
                                            <SortableHeader field="joinDate">
                                                Joined / Last Login
                                            </SortableHeader>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sortedUsers.map((user) => (
                                            <tr key={user.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                            <span className="text-blue-600 font-medium text-sm">
                                                                {user.name ? user.name.split(' ').map((n: string) => n[0]).join('') : 'U'}
                                                            </span>
                                                        </div>
                                                        <div className="ml-4">
                                                            <div className="text-sm font-medium text-gray-900">{user.name || 'No name'}</div>
                                                            <div className="text-sm text-gray-500">{user.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-sm text-gray-900">{user.major || 'Not specified'}</div>
                                                        <div className="text-sm text-gray-500">
                                                            {user.graduationYear ? `Class of ${user.graduationYear}` : 'Year not specified'}
                                                        </div>
                                                        <div className="text-xs text-gray-400">{user.memberId || user.pid || 'No ID'}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                                                            {user.role}
                                                        </span>
                                                        {user.position && (
                                                            <div className="text-xs text-gray-500 mt-1">{user.position}</div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className={`inline-flex items-center space-x-1 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.status)}`}>
                                                        {getStatusIcon(user.status)}
                                                        <span className="capitalize">{user.status}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-sm text-gray-900">{user.eventsAttended || 0} events</div>
                                                        <div className="text-sm text-gray-500">{user.points || 0} points</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-sm text-gray-900">
                                                            Joined: {user.joinDate ? user.joinDate.toDate().toLocaleDateString() : 'Not completed'}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            Last Login: {user.lastLogin ? user.lastLogin.toDate().toLocaleDateString() : 'Never'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <button
                                                            onClick={() => handleEditUser(user)}
                                                            className="text-blue-600 hover:text-blue-900"
                                                            title="Edit Member"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button className="text-green-600 hover:text-green-900" title="Send Email">
                                                            <Mail className="w-4 h-4" />
                                                        </button>
                                                        {canDeleteUser(user) && (
                                                            <button
                                                                onClick={() => handleDeleteUser(user.id)}
                                                                className="text-red-600 hover:text-red-900"
                                                                title="Remove Member"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* User Edit/Add Modal */}
            {showUserModal && editingUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editingUser.id ? 'Edit Member' : 'Add Existing Member'}
                                </h2>
                                {!editingUser.id && (
                                    <p className="text-sm text-gray-600 mt-1">
                                        Add an existing IEEE UCSD member to the digital system. For new people, use "Send Invite" instead.
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => {
                                    setShowUserModal(false);
                                    setEditingUser(null);
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto" style={{ maxHeight: '60vh' }}>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={editingUser.name}
                                            onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Full name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Email <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            value={editingUser.email}
                                            onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                            disabled={!!(editingUser.id && isOAuthUser(editingUser.id))}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                                            placeholder="email@ucsd.edu"
                                        />
                                        {editingUser.id && isOAuthUser(editingUser.id) && (
                                            <p className="text-xs text-gray-500 mt-1">Email cannot be changed for users who signed in with OAuth providers</p>
                                        )}
                                    </div>
                                </div>

                                <div className={editingUser.id ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                                        <div className="relative">
                                            <select
                                                value={editingUser.role}
                                                onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                                                disabled={!!(editingUser.id && currentUser && editingUser.id === currentUser.id && currentUserRole === 'Executive Officer')}
                                                className="appearance-none w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {getAvailableRoles(editingUser.id === currentUser?.id).map(role => (
                                                    <option key={role} value={role}>{role}</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                        {editingUser.id && currentUser && editingUser.id === currentUser.id && currentUserRole === 'Executive Officer' && (
                                            <p className="text-xs text-gray-500 mt-1">Executive Officers cannot change their own role</p>
                                        )}
                                    </div>
                                    {editingUser.id && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                            <div className="relative">
                                                <select
                                                    value={editingUser.status}
                                                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as 'active' | 'inactive' | 'suspended' })}
                                                    className="appearance-none w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
                                                >
                                                    <option value="active">✅ Active</option>
                                                    <option value="inactive">⏸️ Inactive</option>
                                                    <option value="suspended">🚫 Suspended</option>
                                                </select>
                                                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                                    <input
                                        type="text"
                                        value={editingUser.position || ''}
                                        onChange={(e) => setEditingUser({ ...editingUser, position: e.target.value })}
                                        disabled={!!(editingUser.id && currentUser && editingUser.id === currentUser.id && currentUserRole === 'Executive Officer')}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                        placeholder="e.g. Webmaster, President, Vice President"
                                    />
                                    {editingUser.id && currentUser && editingUser.id === currentUser.id && currentUserRole === 'Executive Officer' && (
                                        <p className="text-xs text-gray-500 mt-1">Executive Officers cannot change their own position</p>
                                    )}
                                </div>

                                {editingUser.id && (
                                    <>
                                        <div className="border-t border-gray-200 pt-4">
                                            <h4 className="text-sm font-medium text-gray-700 mb-3">Additional Information</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">PID</label>
                                                <input
                                                    type="text"
                                                    value={editingUser.pid || ''}
                                                    onChange={(e) => setEditingUser({ ...editingUser, pid: e.target.value })}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="A12345678"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Member ID</label>
                                                <input
                                                    type="text"
                                                    value={editingUser.memberId || ''}
                                                    onChange={(e) => setEditingUser({ ...editingUser, memberId: e.target.value })}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="IEEE Member ID"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Major</label>
                                                <input
                                                    type="text"
                                                    value={editingUser.major || ''}
                                                    onChange={(e) => setEditingUser({ ...editingUser, major: e.target.value })}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="Computer Science"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">Graduation Year</label>
                                                <input
                                                    type="number"
                                                    value={editingUser.graduationYear || ''}
                                                    onChange={(e) => setEditingUser({ ...editingUser, graduationYear: parseInt(e.target.value) || undefined })}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="2025"
                                                />
                                            </div>
                                        </div>

                                        {/* Points field - only for administrators */}
                                        {currentUserRole === 'Administrator' && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Points <span className="text-yellow-600">(Admin Only)</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={editingUser.points || 0}
                                                    onChange={(e) => setEditingUser({ ...editingUser, points: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="0"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Manually adjust user points. Negative values are allowed for penalties.
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-6 border-t border-gray-200">
                            <button
                                onClick={() => {
                                    setShowUserModal(false);
                                    setEditingUser(null);
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateUser}
                                disabled={!editingUser.name || !editingUser.email}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {editingUser.id ? 'Update Member' : 'Add Member'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-900">Send Invitation</h2>
                            <button
                                onClick={() => setShowInviteModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto" style={{ maxHeight: '60vh' }}>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={inviteData.name}
                                            onChange={(e) => setInviteData({ ...inviteData, name: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Full name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Email <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            value={inviteData.email}
                                            onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="email@ucsd.edu"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                                        <div className="relative">
                                            <select
                                                value={inviteData.role}
                                                onChange={(e) => setInviteData({ ...inviteData, role: e.target.value as UserRole })}
                                                className="appearance-none w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
                                            >
                                                {getAvailableRoles().map(role => (
                                                    <option key={role} value={role}>{role}</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                        {!canInviteWithRole(inviteData.role) && (
                                            <p className="text-xs text-red-500 mt-1">You cannot invite users with this role</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                                        <input
                                            type="text"
                                            value={inviteData.position}
                                            onChange={(e) => setInviteData({ ...inviteData, position: e.target.value })}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g. Webmaster, President"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                                    <textarea
                                        value={inviteData.message}
                                        onChange={(e) => setInviteData({ ...inviteData, message: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Custom invitation message..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-6 border-t border-gray-200">
                            <button
                                onClick={() => setShowInviteModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendInvite}
                                disabled={!inviteData.name || !inviteData.email || loading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Sending...' : 'Send Invitation'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Existing Member Modal */}
            {showAddMemberModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Promote Member to Officer</h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    Search for an existing member and promote them to an officer role with a position
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowAddMemberModal(false);
                                    setMemberSearchTerm('');
                                    setSearchResults([]);
                                    setSelectedMember(null);
                                    setNewRole('General Officer');
                                    setNewPosition('');
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto" style={{ maxHeight: '60vh' }}>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Search for Member
                                        </label>
                                        <input
                                            type="text"
                                            value={memberSearchTerm}
                                            onChange={(e) => setMemberSearchTerm(e.target.value)}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Search by name, email, major, Student ID (PID), or Member ID..."
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Type at least 2 characters to search. Results update automatically.
                                        </p>
                                    </div>
                                </div>

                                {memberSearchTerm && memberSearchTerm.length >= 2 && (
                                    <div className="mt-4 text-sm text-gray-600">
                                        {searchResults.length > 0 ? (
                                            `Found ${searchResults.length} member${searchResults.length !== 1 ? 's' : ''}`
                                        ) : (
                                            users.length > 0 ? 'No members found matching your search criteria' : 'Loading members...'
                                        )}
                                    </div>
                                )}

                                {searchResults.length > 0 && (
                                    <div className="mt-6 bg-gray-50 rounded-lg shadow-sm border border-gray-200">
                                        <div className="px-4 py-3 border-b border-gray-200">
                                            <h3 className="text-lg font-semibold text-gray-900">Search Results ({searchResults.length})</h3>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Member
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Academic Info
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Role
                                                        </th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            Actions
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {searchResults.map((user) => (
                                                        <tr key={user.id} className={`hover:bg-gray-50 ${selectedMember?.id === user.id ? 'bg-blue-50 border-blue-200' : ''}`}>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center">
                                                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                                        <span className="text-blue-600 font-medium text-sm">
                                                                            {user.name ? user.name.split(' ').map((n: string) => n[0]).join('') : 'U'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="ml-4">
                                                                        <div className="text-sm font-medium text-gray-900">{user.name || 'No name'}</div>
                                                                        <div className="text-sm text-gray-500">{user.email}</div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div>
                                                                    <div className="text-sm text-gray-900">{user.major || 'Not specified'}</div>
                                                                    <div className="text-sm text-gray-500">
                                                                        {user.graduationYear ? `Class of ${user.graduationYear}` : 'Year not specified'}
                                                                    </div>
                                                                    <div className="text-xs text-gray-400">
                                                                        {user.memberId && `Member ID: ${user.memberId}`}
                                                                        {user.pid && `${user.memberId ? ' | ' : ''}PID: ${user.pid}`}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div>
                                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                                                                        {user.role}
                                                                    </span>
                                                                    {user.position && (
                                                                        <div className="text-xs text-gray-500 mt-1">{user.position}</div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                <button
                                                                    onClick={() => setSelectedMember(selectedMember?.id === user.id ? null : user)}
                                                                    className={`${selectedMember?.id === user.id ? 'text-blue-600 hover:text-blue-900' : 'text-green-600 hover:text-green-900'}`}
                                                                    title={selectedMember?.id === user.id ? 'Deselect' : 'Select Member'}
                                                                >
                                                                    {selectedMember?.id === user.id ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {selectedMember && (
                                    <div className="mt-6 space-y-4">
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <h4 className="font-semibold text-blue-900 mb-2">Selected Member:</h4>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <span className="font-medium text-blue-700">Name:</span> {selectedMember.name || selectedMember.email}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-blue-700">Current Role:</span> {selectedMember.role}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-blue-700">Status:</span> {selectedMember.status}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-blue-700">Member ID:</span> {selectedMember.memberId || selectedMember.pid || 'Not set'}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-blue-700">Major:</span> {selectedMember.major || 'Not specified'}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-blue-700">Graduation Year:</span> {selectedMember.graduationYear || 'Not specified'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                            <h4 className="font-semibold text-green-900 mb-4">Promote to Officer:</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        New Role <span className="text-red-500">*</span>
                                                    </label>
                                                    <select
                                                        value={newRole}
                                                        onChange={(e) => setNewRole(e.target.value as UserRole)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="General Officer">General Officer</option>
                                                        <option value="Executive Officer">Executive Officer</option>
                                                        <option value="Member at Large">Member at Large</option>
                                                        <option value="Past Officer">Past Officer</option>
                                                        <option value="Administrator">Administrator</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Position <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={newPosition}
                                                        onChange={(e) => setNewPosition(e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="e.g., Vice President, Secretary, Events Chair..."
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-3 text-sm text-green-700">
                                                <strong>Action:</strong> {selectedMember.name || selectedMember.email} will be promoted to {newRole}
                                                {newPosition && ` as ${newPosition}`}
                                                {selectedMember.status === 'inactive' && ' and activated'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-6 border-t border-gray-200">
                            <button
                                onClick={() => {
                                    setShowAddMemberModal(false);
                                    setMemberSearchTerm('');
                                    setSearchResults([]);
                                    setSelectedMember(null);
                                    setNewRole('General Officer');
                                    setNewPosition('');
                                }}
                                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddExistingMember}
                                disabled={!selectedMember || !newPosition.trim() || loading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Processing...' : 'Promote to Officer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 