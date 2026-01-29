import { useState, useEffect, useMemo } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { app, auth, db } from "../../../../../firebase/client";
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
import { normalizeMajorName } from "../../../../../utils/majorNormalization";
import { showToast } from "../../../shared/utils/toast";

export const useUserManagement = () => {
  const [user, userLoading, userError] = useAuthState(auth);
  const [users, setUsers] = useState<(FirestoreUser & { id: string })[]>([]);
  const [loading, setLoading] = useState(true); // Start true for better UX (data fetching begins immediately)
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

  // Real-time listener for users - removed, now in useEffect

  // Initialize data with real-time listeners
  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      showToast.error("Please log in to access user management");
      setLoading(false);
      return;
    }

    setLoading(true);
    setRoleLoading(true);

    // Initialize unsubscribe functions for mutual cleanup in error handlers
    let currentUserUnsubscribe: (() => void) | null = null;
    let usersUnsubscribe: (() => void) | null = null;

    // Real-time listener for current user
    currentUserUnsubscribe = onSnapshot(
      doc(db, "users", user.uid),
      (userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const currentUserData = {
            id: user.uid,
            ...userData,
          } as FirestoreUser & { id: string };

          setCurrentUser(currentUserData);
          setCurrentUserRole(userData.role || "Member");
        }
        setRoleLoading(false);
      },
      (error) => {
        console.error("Error fetching current user:", error);
        showToast.error(
          "Failed to load your user data. Please refresh the page.",
        );
        setRoleLoading(false);
        setLoading(false);
        // Clean up users listener if it exists
        if (usersUnsubscribe) {
          usersUnsubscribe();
        }
      },
    );

    // Real-time listener for users with proper filtering
    usersUnsubscribe = onSnapshot(
      query(
        collection(db, "users"),
        where("role", "in", [
          "Member",
          "General Officer",
          "Executive Officer",
          "Administrator",
          "Sponsor",
        ]),
        orderBy("name", "asc"),
      ),
      (snapshot) => {
        const usersData = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
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
          } as FirestoreUser & { id: string };
        });

        setUsers(usersData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching users:", error);
        showToast.error("Failed to load users. Please try again.");
        setLoading(false);
        // Clean up current user listener if it exists
        if (currentUserUnsubscribe) {
          currentUserUnsubscribe();
        }
      },
    );

    // Cleanup listeners on unmount
    return () => {
      if (currentUserUnsubscribe) currentUserUnsubscribe();
      if (usersUnsubscribe) usersUnsubscribe();
    };
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
        showToast.error("User not found");
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
        showToast.error(
          "You do not have permission to change this user's role",
        );
        return;
      }

      if (
        !UserPermissionService.canEditUserPosition(
          currentUserRole,
          targetUser,
          currentUser?.id,
        )
      ) {
        showToast.error(
          "You do not have permission to change this user's position",
        );
        return;
      }

      // Normalize major name before saving
      const normalizedMajor = normalizeMajorName(userData.major);

      // Use server-side API for user updates
      const response = await fetch("/api/update-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userData.id,
          name: userData.name,
          role: userData.role,
          position: userData.position || "",
          status: userData.status,
          pid: userData.pid || "",
          memberId: userData.memberId || "",
          major: normalizedMajor || "",
          graduationYear: userData.graduationYear || null,
          team: userData.team || null,
          points: userData.points,
          adminUserId: user?.uid,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to update user");
      }

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

      showToast.success("User updated successfully");
      // Data will auto-update via real-time listener
    } catch (error) {
      console.error("Error updating user:", error);
      showToast.error(
        error instanceof Error
          ? error.message
          : "Failed to update user. Please try again.",
      );
    }
  };

  // Delete user
  const deleteUser = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) {
      showToast.error("User not found");
      return;
    }

    if (!UserPermissionService.canDeleteUser(currentUserRole, targetUser)) {
      showToast.error("You do not have permission to delete this user");
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

      showToast.success("User deleted successfully");
      // Data will auto-update via real-time listener
    } catch (error) {
      console.error("Error deleting user:", error);
      showToast.error("Failed to delete user. Please try again.");
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
        showToast.error(
          "You do not have permission to invite users with this role",
        );
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

      showToast.success("Invite sent successfully");
    } catch (error) {
      console.error("Error sending invite:", error);
      showToast.error("Failed to send invite. Please try again.");
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

      showToast.success("Member added successfully");
      // Data will auto-update via real-time listener
    } catch (error) {
      console.error("Error adding member:", error);
      showToast.error("Failed to add member. Please try again.");
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
  };
};
