import { useState, useEffect, useMemo } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { app, auth } from "../../../../../firebase/client";
import { useAuthState } from "react-firebase-hooks/auth";
import type {
  User as FirestoreUser,
  UserRole,
} from "../../../shared/types/firestore";
import type {
  UserModalData,
  InviteModalData,
  UserFilters,
  SortConfig,
} from "../types/UserManagementTypes";
import { UserFilteringService } from "../utils/userFiltering";
import { UserPermissionService } from "../utils/userPermissions";
import { PublicProfileService } from "../../../shared/services/publicProfile";

export const useUserManagement = () => {
  const [user, userLoading, userError] = useAuthState(auth);
  const [users, setUsers] = useState<(FirestoreUser & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<
    (FirestoreUser & { id: string }) | null
  >(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("Member");
  const [roleLoading, setRoleLoading] = useState(false);

  // Filters and sorting
  const [filters, setFilters] = useState<UserFilters>({
    searchTerm: "",
    roleFilter: "all",
    statusFilter: "all",
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "name",
    direction: "asc",
  });

  const db = getFirestore(app);

  // Fetch users from Firestore
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);

      const usersData = usersSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || "",
          email: data.email || "",
          role: data.role || "Member",
          position: data.position || "",
          status: data.status || "active",
          pid: data.pid || "",
          memberId: data.memberId || "",
          major: data.major || "",
          graduationYear: data.graduationYear || null,
          points: data.points || 0,
          joinDate: data.joinDate || null,
          signInMethod: data.signInMethod || null,
          ...data,
        } as FirestoreUser & { id: string };
      });

      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
      setError("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Get current user info
  const getCurrentUser = async () => {
    if (!user) return;

    try {
      setRoleLoading(true);
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentUserData = {
          id: user.uid,
          ...userData,
        } as FirestoreUser & { id: string };

        setCurrentUser(currentUserData);
        setCurrentUserRole(userData.role || "Member");
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    } finally {
      setRoleLoading(false);
    }
  };

  // Initialize data
  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      setError("Please log in to access user management");
      setLoading(false);
      return;
    }

    getCurrentUser();
    fetchUsers();
  }, [user, userLoading]);

  // Filter and sort users
  const filteredUsers = useMemo(() => {
    const filtered = UserFilteringService.filterUsers(users, filters);
    return UserFilteringService.sortUsers(filtered, sortConfig);
  }, [users, filters, sortConfig]);

  // Update user
  const updateUser = async (userData: UserModalData) => {
    if (!userData.id) return;

    try {
      const targetUser = users.find((u) => u.id === userData.id);
      if (!targetUser) {
        setError("User not found");
        return;
      }

      // Check permissions
      if (
        !UserPermissionService.canEditUserRole(
          currentUserRole,
          targetUser,
          currentUser?.id,
        )
      ) {
        setError("You do not have permission to change this user's role");
        return;
      }

      if (
        !UserPermissionService.canEditUserPosition(
          currentUserRole,
          targetUser,
          currentUser?.id,
        )
      ) {
        setError("You do not have permission to change this user's position");
        return;
      }

      const userRef = doc(db, "users", userData.id);
      const updateData: any = {
        name: userData.name,
        role: userData.role,
        position: userData.position || "",
        status: userData.status,
        pid: userData.pid || "",
        memberId: userData.memberId || "",
        major: userData.major || "",
        graduationYear: userData.graduationYear || null,
        updatedAt: new Date(),
      };

      // Only administrators can modify points
      if (
        currentUserRole === "Administrator" &&
        userData.points !== undefined
      ) {
        updateData.points = userData.points;
      }

      await updateDoc(userRef, updateData);

      // Sync to public profile
      try {
        const publicProfileData: any = {
          name: userData.name,
          position: userData.position || "",
        };

        if (
          currentUserRole === "Administrator" &&
          userData.points !== undefined
        ) {
          publicProfileData.points = userData.points;
        }

        await PublicProfileService.syncPublicProfile(
          userData.id,
          publicProfileData,
        );
      } catch (error) {
        console.error("Error syncing public profile:", error);
      }

      setSuccess("User updated successfully");
      await fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      setError("Failed to update user. Please try again.");
    }
  };

  // Delete user
  const deleteUser = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) {
      setError("User not found");
      return;
    }

    if (!UserPermissionService.canDeleteUser(currentUserRole, targetUser)) {
      setError("You do not have permission to delete this user");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete ${targetUser.name}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "users", userId));

      // Also delete the user's public profile if it exists
      try {
        await deleteDoc(doc(db, "public_profiles", userId));
      } catch (error) {
        // Don't fail the whole operation if public profile deletion fails
      }

      setSuccess("User deleted successfully");
      await fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      setError("Failed to delete user. Please try again.");
    }
  };

  // Send invite
  const sendInvite = async (inviteData: InviteModalData) => {
    try {
      if (
        !UserPermissionService.canInviteWithRole(
          currentUserRole,
          inviteData.role,
        )
      ) {
        setError("You do not have permission to invite users with this role");
        return;
      }

      // Create invite record in Firebase
      const inviteRef = await addDoc(collection(db, "invites"), {
        name: inviteData.name,
        email: inviteData.email,
        role: inviteData.role,
        position: inviteData.position,
        message: inviteData.message,
        invitedBy: user?.uid,
        invitedAt: new Date(),
        status: "pending",
      });

      // Send email via API
      const response = await fetch("/api/email/send-user-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: inviteData.email,
          name: inviteData.name,
          role: inviteData.role,
          position: inviteData.position,
          message: inviteData.message,
          inviteId: inviteRef.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send invite email");
      }

      setSuccess("Invite sent successfully");
    } catch (error) {
      console.error("Error sending invite:", error);
      setError("Failed to send invite. Please try again.");
    }
  };

  // Add existing member (promote to officer)
  const addExistingMember = async (
    memberId: string,
    newRole: UserRole,
    newPosition: string,
  ) => {
    try {
      const userRef = doc(db, "users", memberId);
      const updateData: any = {
        role: newRole,
        position: newPosition,
        updatedAt: new Date(),
      };

      const member = users.find((u) => u.id === memberId);
      if (member?.status === "inactive") {
        updateData.status = "active";
      }

      await updateDoc(userRef, updateData);

      // Sync to public profile
      try {
        await PublicProfileService.syncPublicProfile(memberId, {
          position: newPosition,
        });
      } catch (error) {
        console.error("Error syncing public profile:", error);
      }

      setSuccess("Member added successfully");
      await fetchUsers();
    } catch (error) {
      console.error("Error adding member:", error);
      setError("Failed to add member. Please try again.");
    }
  };

  // Update filters
  const updateFilters = (newFilters: Partial<UserFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  // Update sort config
  const updateSort = (field: string) => {
    setSortConfig((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Clear messages
  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // Calculate stats
  const stats = useMemo(() => {
    return UserFilteringService.calculateStats(users);
  }, [users]);

  // Permission checks
  const permissions = useMemo(
    () => ({
      hasUserManagementAccess:
        UserPermissionService.hasUserManagementAccess(currentUserRole),
      canInviteWithRole: (role: UserRole) =>
        UserPermissionService.canInviteWithRole(currentUserRole, role),
      getAvailableRoles: (isCurrentUser: boolean = false) =>
        UserPermissionService.getAvailableRoles(currentUserRole, isCurrentUser),
      canEditUserRole: (targetUser: FirestoreUser & { id: string }) =>
        UserPermissionService.canEditUserRole(
          currentUserRole,
          targetUser,
          currentUser?.id,
        ),
      canEditUserPosition: (targetUser: FirestoreUser & { id: string }) =>
        UserPermissionService.canEditUserPosition(
          currentUserRole,
          targetUser,
          currentUser?.id,
        ),
      canDeleteUser: (targetUser: FirestoreUser & { id: string }) =>
        UserPermissionService.canDeleteUser(currentUserRole, targetUser),
      isOAuthUser: (targetUserId: string) =>
        UserPermissionService.isOAuthUser(targetUserId, users, user),
      // Email management permissions
      canManageEmails: UserPermissionService.canManageEmails(currentUserRole),
      canEditUserEmail: (targetUser: FirestoreUser & { id: string }) =>
        UserPermissionService.canEditUserEmail(
          currentUserRole,
          targetUser,
          currentUser?.id,
        ),
      canDisableUserEmail: (targetUser: FirestoreUser & { id: string }) =>
        UserPermissionService.canDisableUserEmail(currentUserRole, targetUser),
      canDeleteUserEmail: (targetUser: FirestoreUser & { id: string }) =>
        UserPermissionService.canDeleteUserEmail(currentUserRole, targetUser),
    }),
    [currentUserRole, currentUser, users, user],
  );

  return {
    // Data
    users,
    filteredUsers,
    currentUser,
    currentUserRole,
    stats,

    // State
    loading: userLoading || roleLoading || loading,
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
    fetchUsers,

    // Permissions
    permissions,

    // Auth
    user,
    userLoading,
    userError,
  };
};
