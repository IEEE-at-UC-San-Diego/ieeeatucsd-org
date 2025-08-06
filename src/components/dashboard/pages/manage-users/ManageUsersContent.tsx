import React, { useState } from 'react';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { useUserManagement } from './hooks/useUserManagement';
import type { UserModalData, InviteModalData } from './types/UserManagementTypes';
import { UserManagementTableSkeleton, MetricCardSkeleton } from '../../../ui/loading';
import DashboardHeader from '../../shared/DashboardHeader';

// Import refactored components
import UserStatsCards from './components/UserStatsCards';
import UserFilters from './components/UserFilters';
import UserTable from './components/UserTable';
import UserModal from './components/UserModal';
import InviteModal from './components/InviteModal';
import AddMemberModal from './components/AddMemberModal';

export default function ManageUsersContent() {
    const {
        // Data
        filteredUsers,
        currentUser,
        currentUserRole,
        stats,

        // State
        loading,
        error,
        success,
        filters,
        sortConfig,

        // Actions
        updateUser,
        deleteUser,
        sendInvite,
        addExistingMember,
        updateFilters,
        updateSort,
        clearMessages,

        // Permissions
        permissions,

        // Auth
        user,
        userLoading,
        userError
    } = useUserManagement();

    // Modal states
    const [showUserModal, setShowUserModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [editingUser, setEditingUser] = useState<UserModalData | null>(null);

    // Handle user actions
    const handleEditUser = (user: any) => {
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
            points: user.points || 0,
            // IEEE Email fields
            hasIEEEEmail: user.hasIEEEEmail || false,
            ieeeEmail: user.ieeeEmail || '',
            ieeeEmailCreatedAt: user.ieeeEmailCreatedAt || null,
            ieeeEmailStatus: user.ieeeEmailStatus || 'active'
        });
        setShowUserModal(true);
    };

    const handleSaveUser = async (userData: UserModalData) => {
        await updateUser(userData);
        if (!error) {
            setShowUserModal(false);
            setEditingUser(null);
        }
    };

    const handleSendInvite = async (inviteData: InviteModalData) => {
        await sendInvite(inviteData);
        if (!error) {
            setShowInviteModal(false);
        }
    };

    const handleAddExistingMember = async (userId: string, newRole: any, newPosition: string) => {
        await addExistingMember(userId, newRole, newPosition);
        if (!error) {
            setShowAddMemberModal(false);
        }
    };

    const handleEmailAction = async (action: 'disable' | 'enable' | 'delete', userId: string, email?: string) => {
        if (!user?.uid || !email) {
            console.error('Missing required parameters for email action');
            return;
        }

        // Clear any existing messages
        clearMessages();

        try {
            let endpoint = '';
            switch (action) {
                case 'disable':
                    endpoint = '/api/disable-ieee-email';
                    break;
                case 'enable':
                    endpoint = '/api/enable-ieee-email';
                    break;
                case 'delete':
                    endpoint = '/api/delete-ieee-email';
                    break;
                default:
                    throw new Error(`Invalid email action: ${action}`);
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    email,
                    adminUserId: user.uid
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                // Update the user's email status in Firebase
                const db = getFirestore();
                const userRef = doc(db, 'users', userId);

                try {
                    if (action === 'delete') {
                        await updateDoc(userRef, {
                            hasIEEEEmail: false,
                            ieeeEmail: null,
                            ieeeEmailCreatedAt: null,
                            ieeeEmailStatus: null
                        });
                    } else {
                        await updateDoc(userRef, {
                            ieeeEmailStatus: action === 'disable' ? 'disabled' : 'active'
                        });
                    }
                } catch (firebaseError) {
                    console.error('Error updating Firebase:', firebaseError);
                    // Continue with the operation even if Firebase update fails
                }

                // Refresh the users list
                try {
                    await fetchUsers();
                } catch (fetchError) {
                    console.error('Error refreshing users list:', fetchError);
                }

                // Close the modal and show success message
                setShowUserModal(false);
                setEditingUser(null);

                console.log(`Email ${action} successful:`, result.message);
            } else {
                throw new Error(result.message || `Failed to ${action} email`);
            }
        } catch (error) {
            console.error(`Email ${action} failed:`, error);

            // Set error message that will be displayed in the UI
            const errorMessage = error instanceof Error
                ? error.message
                : `Failed to ${action} email. Please try again.`;

            // You can add a toast notification here or set an error state
            // For now, we'll just log the error
            console.error('Email operation error:', errorMessage);
        }
    };

    // Show loading while we're fetching the user auth, role, or data
    const isFullyLoading = userLoading || loading;

    if (isFullyLoading) {
        return (
            <div className="space-y-6">
                <DashboardHeader
                    title="Manage Users"
                    subtitle="Manage user accounts, roles, and permissions"
                    showSearch={false}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[...Array(4)].map((_, i) => (
                        <MetricCardSkeleton key={i} />
                    ))}
                </div>
                <UserManagementTableSkeleton />
            </div>
        );
    }

    // If user doesn't have access, show access denied message
    if (user && !permissions.hasUserManagementAccess) {
        return (
            <div className="space-y-6">
                <DashboardHeader
                    title="Manage Users"
                    subtitle="Manage user accounts, roles, and permissions"
                    showSearch={false}
                />
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <div className="text-red-400 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
                    <p className="text-gray-500">You don't have permission to access user management.</p>
                    <p className="text-gray-500">Contact an administrator if you need access.</p>
                </div>
            </div>
        );
    }

    // Show access denied if no user is logged in
    if (!user) {
        return (
            <div className="space-y-6">
                <DashboardHeader
                    title="Manage Users"
                    subtitle="Manage user accounts, roles, and permissions"
                    showSearch={false}
                />
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <div className="text-gray-400 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
                    <p className="text-gray-500">Please log in to access user management.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="">
            <DashboardHeader
                title="Manage Users"
                subtitle="Manage user accounts, roles, and permissions"
                showSearch={false}
            />
            <div className="space-y-6 p-6 mx-">
                {/* Error/Success Messages */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                            <div className="ml-auto pl-3">
                                <button
                                    onClick={clearMessages}
                                    className="text-red-400 hover:text-red-600"
                                >
                                    <span className="sr-only">Dismiss</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-green-800">{success}</p>
                            </div>
                            <div className="ml-auto pl-3">
                                <button
                                    onClick={clearMessages}
                                    className="text-green-400 hover:text-green-600"
                                >
                                    <span className="sr-only">Dismiss</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats Cards */}
                <UserStatsCards stats={stats} />

                {/* Filters */}
                <UserFilters
                    filters={filters}
                    onFiltersChange={updateFilters}
                    onShowInviteModal={() => setShowInviteModal(true)}
                    onShowAddMemberModal={() => setShowAddMemberModal(true)}
                    canManageUsers={permissions.hasUserManagementAccess}
                />

                {/* Users Table */}
                <UserTable
                    users={filteredUsers}
                    sortConfig={sortConfig}
                    onSort={updateSort}
                    onEditUser={handleEditUser}
                    onDeleteUser={deleteUser}
                    permissions={permissions}
                    currentUserId={currentUser?.id}
                />

                {/* User Modal */}
                <UserModal
                    isOpen={showUserModal}
                    onClose={() => {
                        setShowUserModal(false);
                        setEditingUser(null);
                    }}
                    onSave={handleSaveUser}
                    editingUser={editingUser}
                    availableRoles={permissions.getAvailableRoles(editingUser?.id === currentUser?.id)}
                    canEditRole={editingUser ? permissions.canEditUserRole(editingUser as any) : true}
                    canEditPosition={editingUser ? permissions.canEditUserPosition(editingUser as any) : true}
                    canEditPoints={currentUserRole === 'Administrator'}
                    canManageEmails={permissions.canManageEmails}
                    onEmailAction={handleEmailAction}
                    loading={loading}
                />

                {/* Invite Modal */}
                <InviteModal
                    isOpen={showInviteModal}
                    onClose={() => setShowInviteModal(false)}
                    onSave={handleSendInvite}
                    availableRoles={permissions.getAvailableRoles(false)}
                    loading={loading}
                />

                {/* Add Member Modal */}
                <AddMemberModal
                    isOpen={showAddMemberModal}
                    onClose={() => setShowAddMemberModal(false)}
                    onSave={handleAddExistingMember}
                    availableRoles={permissions.getAvailableRoles(false)}
                    loading={loading}
                />

            </div>
        </div>
    );
}
