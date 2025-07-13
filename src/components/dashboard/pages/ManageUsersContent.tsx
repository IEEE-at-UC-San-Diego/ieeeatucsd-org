import React, { useState, useEffect } from 'react';
import { Search, Calendar, Bell, User, Plus, Filter, Edit, Trash2, UserCheck, UserX, Mail, Shield, Users, GraduationCap, Send, X } from 'lucide-react';
import { getFirestore, collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore';
import { app } from '../../../firebase/client';
import type { User as FirestoreUser, UserRole } from '../types/firestore';

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
}

interface InviteModalData {
    name: string;
    email: string;
    role: UserRole;
    position: string;
    message: string;
}

export default function ManageUsersContent() {
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

    const db = getFirestore(app);

    const roles: UserRole[] = ['Member', 'General Officer', 'Executive Officer', 'Member at Large', 'Past Officer', 'Sponsor'];

    useEffect(() => {
        fetchUsers();
    }, []);

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
                    inviteAccepted: data.inviteAccepted
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
            graduationYear: user.graduationYear || undefined
        });
        setShowUserModal(true);
    };

    const handleUpdateUser = async () => {
        if (!editingUser || !editingUser.id) return;

        try {
            const userRef = doc(db, 'users', editingUser.id);
            await updateDoc(userRef, {
                name: editingUser.name,
                role: editingUser.role,
                position: editingUser.position || '',
                status: editingUser.status,
                pid: editingUser.pid || '',
                memberId: editingUser.memberId || '',
                major: editingUser.major || '',
                graduationYear: editingUser.graduationYear || null
            });

            setSuccess('User updated successfully');
            setShowUserModal(false);
            setEditingUser(null);
            fetchUsers();
        } catch (error) {
            console.error('Error updating user:', error);
            setError('Failed to update user');
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'users', userId));
            setSuccess('User deleted successfully');
            fetchUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            setError('Failed to delete user');
        }
    };

    const handleSendInvite = async () => {
        try {
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

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active':
                return <UserCheck className="w-4 h-4" />;
            case 'inactive':
                return <UserX className="w-4 h-4" />;
            case 'suspended':
                return <UserX className="w-4 h-4" />;
            default:
                return <User className="w-4 h-4" />;
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

    return (
        <div className="flex-1 overflow-auto">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search members..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="relative">
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                                className="appearance-none bg-white px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
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
                                className="appearance-none bg-white px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
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

                    <div className="flex items-center space-x-4">
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Calendar className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Bell className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <User className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Manage Users Content */}
            <main className="p-6">
                <div className="grid grid-cols-1 gap-6">
                    {/* Page Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Manage Users</h1>
                            <p className="text-gray-600">Manage IEEE UCSD member accounts and permissions</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => setShowInviteModal(true)}
                                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <Send className="w-4 h-4" />
                                <span>Send Invite</span>
                            </button>
                            <button
                                onClick={() => {
                                    setEditingUser({
                                        name: '',
                                        email: '',
                                        role: 'Member',
                                        position: '',
                                        status: 'active'
                                    });
                                    setShowUserModal(true);
                                }}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add Member</span>
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

                    {/* User Management Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Total Members</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.totalMembers}</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
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
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Activity
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Join Date
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredUsers.map((user) => (
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
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {user.joinDate ? user.joinDate.toDate().toLocaleDateString() : 'Unknown'}
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
                                                        <button
                                                            onClick={() => handleDeleteUser(user.id)}
                                                            className="text-red-600 hover:text-red-900"
                                                            title="Remove Member"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
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
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingUser.id ? 'Edit Member' : 'Add Member'}
                            </h2>
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
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="email@ucsd.edu"
                                        />
                                    </div>
                                </div>

                                <div className={editingUser.id ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "grid grid-cols-1 gap-4"}>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                                        <div className="relative">
                                            <select
                                                value={editingUser.role}
                                                onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                                                className="appearance-none w-full px-4 py-3 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-pointer"
                                            >
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
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g. Webmaster, President, Vice President"
                                    />
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
        </div>
    );
} 