import React, { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/client";
import { Pagination } from "@heroui/react";
import { useUserManagement } from "./hooks/useUserManagement";
import type {
  UserModalData,
  InviteModalData,
} from "./types/UserManagementTypes";
import {
  UserManagementTableSkeleton,
  MetricCardSkeleton,
} from "../../../ui/loading";

// Import refactored components
import UserStatsCards from "./components/UserStatsCards";
import UserFilters from "./components/UserFilters";
import UserTable from "./components/UserTable";
import UserModal from "./components/UserModal";
import InviteModal from "./components/InviteModal";
import AddMemberModal from "./components/AddMemberModal";
import { showToast } from "../../shared/utils/toast";

export default function ManageUsersContent() {
  const {
    // Data
    filteredUsers,
    currentUser,
    currentUserRole,
    stats,

    // State
    loading,
    filters,
    sortConfig,

    // Actions
    updateUser,
    deleteUser,
    sendInvite,
    addExistingMember,
    updateFilters,
    updateSort,

    // Permissions
    permissions,

    // Auth
    user,
    userLoading,
    userError,
  } = useUserManagement();

  // Modal states
  const [showUserModal, setShowUserModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserModalData | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // Show 10 users per page

  // Reset pagination when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortConfig]);

  // Pagination calculations
  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Handle user actions
  const handleEditUser = (user: any) => {
    setEditingUser({
      id: user.id,
      name: user.name || "",
      email: user.email || "",
      role: user.role || "Member",
      position: user.position || "",
      status: user.status || "active",
      pid: user.pid || "",
      memberId: user.memberId || "",
      major: user.major || "",
      graduationYear: user.graduationYear || undefined,
      points: user.points || 0,
      // IEEE Email fields
      hasIEEEEmail: user.hasIEEEEmail || false,
      ieeeEmail: user.ieeeEmail || "",
      ieeeEmailCreatedAt: user.ieeeEmailCreatedAt || null,
      ieeeEmailStatus: user.ieeeEmailStatus || "active",
      // Team field (optional for officers)
      team: user.team,
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async (userData: UserModalData) => {
    await updateUser(userData);
    setShowUserModal(false);
    setEditingUser(null);
  };

  const handleSendInvite = async (inviteData: InviteModalData) => {
    await sendInvite(inviteData);
    setShowInviteModal(false);
  };

  const handleAddExistingMember = async (
    userId: string,
    newRole: any,
    newPosition: string,
  ) => {
    await addExistingMember(userId, newRole, newPosition);
    setShowAddMemberModal(false);
  };

  const handleEmailAction = async (
    action: "disable" | "enable" | "delete",
    userId: string,
    email?: string,
  ) => {
    if (!user?.uid || !email) {
      console.error("Missing required parameters for email action");
      return;
    }

    try {
      let endpoint = "";
      switch (action) {
        case "disable":
          endpoint = "/api/disable-ieee-email";
          break;
        case "enable":
          endpoint = "/api/enable-ieee-email";
          break;
        case "delete":
          endpoint = "/api/delete-ieee-email";
          break;
        default:
          throw new Error(`Invalid email action: ${action}`);
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          email,
          adminUserId: user.uid,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Update the user's email status in Firebase
        const userRef = doc(db, "users", userId);

        try {
          if (action === "delete") {
            await updateDoc(userRef, {
              hasIEEEEmail: false,
              ieeeEmail: null,
              ieeeEmailCreatedAt: null,
              ieeeEmailStatus: null,
            });
          } else {
            await updateDoc(userRef, {
              ieeeEmailStatus: action === "disable" ? "disabled" : "active",
            });
          }
        } catch (firebaseError) {
          console.error("Error updating Firebase:", firebaseError);
          // Continue with the operation even if Firebase update fails
        }

        // Close the modal and show success message
        // Real-time listener will automatically update the users list
        setShowUserModal(false);
        setEditingUser(null);

        showToast.success(`Email ${action}d successfully`);
      } else {
        throw new Error(result.message || `Failed to ${action} email`);
      }
    } catch (error) {
      console.error(`Email ${action} failed:`, error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : `Failed to ${action} email. Please try again.`;

      showToast.error(errorMessage);
    }
  };

  // Show loading while we're fetching the user auth, role, or data
  const isFullyLoading = userLoading || loading;

  if (isFullyLoading) {
    return (
      <div className="space-y-6 p-6">
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
      <div className="space-y-6 p-6">
        <div className="bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-red-400 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Access Denied
          </h3>
          <p className="text-gray-500">
            You don't have permission to access user management.
          </p>
          <p className="text-gray-500">
            Contact an administrator if you need access.
          </p>
        </div>
      </div>
    );
  }

  // Show access denied if no user is logged in
  if (!user) {
    return (
      <div className="space-y-6 p-6">
        <div className="bg-white rounded-2xl shadow p-8 text-center">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Authentication Required
          </h3>
          <p className="text-gray-500">
            Please log in to access user management.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
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
          users={paginatedUsers}
          sortConfig={sortConfig}
          onSort={updateSort}
          onEditUser={handleEditUser}
          onDeleteUser={deleteUser}
          permissions={permissions}
          currentUserId={currentUser?.id}
        />

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{startIndex + 1}</span>{" "}
                  to{" "}
                  <span className="font-medium">
                    {Math.min(endIndex, totalItems)}
                  </span>{" "}
                  of <span className="font-medium">{totalItems}</span> results
                </p>
              </div>
              <Pagination
                total={totalPages}
                page={currentPage}
                onChange={setCurrentPage}
                showControls
                showShadow
                color="primary"
              />
            </div>
          </div>
        )}

        {/* User Modal */}
        <UserModal
          isOpen={showUserModal}
          onClose={() => {
            setShowUserModal(false);
            setEditingUser(null);
          }}
          onSave={handleSaveUser}
          editingUser={editingUser}
          availableRoles={permissions.getAvailableRoles(
            editingUser?.id === currentUser?.id,
          )}
          canEditRole={
            editingUser ? permissions.canEditUserRole(editingUser as any) : true
          }
          canEditPosition={
            editingUser
              ? permissions.canEditUserPosition(editingUser as any)
              : true
          }
          canEditPoints={currentUserRole === "Administrator"}
          canManageEmails={permissions.canManageEmails}
          onEmailAction={handleEmailAction}
          loading={loading}
          currentUserId={currentUser?.id}
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
