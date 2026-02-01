/**
 * User and Role React Hooks
 *
 * This file provides custom React hooks for managing user roles and
 * synchronization between Logto (auth provider) and Convex (backend database).
 *
 * These hooks integrate with both Logto's authentication context and
 * Convex's data layer to provide a unified interface for:
 * - User role management
 * - Authentication state
 * - Role-based access control (RBAC)
 *
 * Per PRD Section 6: Bidirectional sync architecture (Logto ↔ Convex)
 *
 * @module lib/user/hooks
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useLogto, UserInfoResponse } from "@logto/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * ============================================================================
 * TYPES
 * ============================================================================
 */

/**
 * User roles available in the system
 * Per PRD Section 6: Primary roles definition
 */
export type UserRole =
  | "member"
  | "general_officer"
  | "executive_officer"
  | "member_at_large"
  | "past_officer"
  | "sponsor"
  | "administrator";

/**
 * User data structure combining Logto and Convex information
 */
export interface UserData {
  /** Convex user document ID */
  userId: Id<"users"> | null;
  /** Logto subject identifier */
  logtoSub: string | null;
  /** User email address */
  email: string | null;
  /** User display name */
  name: string | null;
  /** User avatar URL */
  avatarUrl: string | null;
  /** Current roles assigned to user */
  roles: UserRole[];
  /** Whether user data is being loaded */
  isLoading: boolean;
  /** Any error that occurred during sync */
  error: Error | null;
  /** Whether user has been synced with Convex */
  isSynced: boolean;
}

/**
 * ============================================================================
 * MAIN HOOK: useUserRoles
 * ============================================================================
 */

/**
 * React hook to fetch and synchronize user roles between Logto and Convex
 *
 * This hook manages the bidirectional synchronization of user data and roles:
 * 1. Fetches user info from Logto
 * 2. Creates/updates user in Convex via getOrCreateUser
 * 3. Fetches roles from Convex
 * 4. Provides role synchronization methods
 *
 * PRD Reference:
 * - Section 6: Auth Flow (New) - Steps 3-5
 * - Section 6: Logto ↔ Convex Role Sync
 *
 * @returns UserData object with roles, loading state, and error information
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { roles, isLoading, isSynced } = useUserRoles();
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (!isSynced) return <ErrorMessage />;
 *
 *   return (
 *     <div>
 *       <p>Roles: {roles.join(', ')}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useUserRoles(): UserData {
  const { isAuthenticated, isLoading: isLogtoLoading, fetchUserInfo } = useLogto();
  const [userInfo, setUserInfo] = useState<UserInfoResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isSynced, setIsSynced] = useState(false);

  // Convex mutations
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);

  // Fetch user info from Logto when authenticated
  useEffect(() => {
    if (isAuthenticated && !isLogtoLoading) {
      fetchUserInfo()
        .then((info) => {
          setUserInfo(info);
          setError(null);
        })
        .catch((err) => {
          setError(err instanceof Error ? err : new Error("Failed to fetch user info"));
          setUserInfo(null);
        });
    } else if (!isAuthenticated) {
      setUserInfo(null);
      setIsSynced(false);
    }
  }, [isAuthenticated, isLogtoLoading, fetchUserInfo]);

  // Query user from Convex by logtoSub
  const userDoc = useQuery(
    api.users.getUserByLogtoSub,
    userInfo?.sub ? { logtoSub: userInfo.sub } : "skip"
  );

  // Query roles from Convex once user exists
  const rolesFromConvex = useQuery(
    api.users.getUserRoles,
    userDoc?._id ? { userId: userDoc._id } : "skip"
  );

  // Sync user to Convex when Logto user info is available
  useEffect(() => {
    if (userInfo?.sub && !userDoc && isAuthenticated && !isLogtoLoading) {
      // User exists in Logto but not in Convex - create them
      getOrCreateUser({
        logtoSub: userInfo.sub,
        email: userInfo.email ?? "",
        name: userInfo.name ?? undefined,
        avatarUrl: userInfo.picture ?? undefined,
      })
        .then(() => {
          setIsSynced(true);
          setError(null);
        })
        .catch((err) => {
          setError(err instanceof Error ? err : new Error("Failed to sync user to Convex"));
          setIsSynced(false);
        });
    } else if (userDoc) {
      setIsSynced(true);
    }
  }, [userInfo, userDoc, isAuthenticated, isLogtoLoading, getOrCreateUser]);

  // Memoize the user data object
  return useMemo(() => {
    const isLoading = isLogtoLoading || (isAuthenticated && !isSynced);

    return {
      userId: userDoc?._id ?? null,
      logtoSub: userInfo?.sub ?? null,
      email: userInfo?.email ?? null,
      name: userInfo?.name ?? null,
      avatarUrl: userInfo?.picture ?? null,
      roles: (rolesFromConvex as UserRole[]) ?? [],
      isLoading,
      error,
      isSynced,
    };
  }, [userDoc, userInfo, rolesFromConvex, isLogtoLoading, isAuthenticated, isSynced, error]);
}

/**
 * ============================================================================
 * ROLE CHECK HOOKS
 * ============================================================================
 */

/**
 * Hook to check if the current user has a specific role
 *
 * This is a convenience wrapper around useUserRoles that provides
 * a simple boolean check for a single role.
 *
 * @param role - The role to check for (e.g., "administrator", "general_officer")
 * @returns Boolean indicating if user has the role
 *
 * @example
 * ```tsx
 * function AdminPanel() {
 *   const isAdmin = useHasRole("administrator");
 *
 *   if (!isAdmin) return <AccessDenied />;
 *
 *   return <AdminControls />;
 * }
 * ```
 */
export function useHasRole(role: UserRole): boolean {
  const { roles, isLoading } = useUserRoles();

  if (isLoading) {
    return false; // Default to false while loading
  }

  return roles.includes(role);
}

/**
 * Hook to check if the current user has any of the specified roles
 *
 * Useful for checking against multiple acceptable roles (e.g., any officer type).
 *
 * @param roles - Array of roles to check for
 * @returns Boolean indicating if user has any of the roles
 *
 * @example
 * ```tsx
 * function OfficerSection() {
 *   const canAccess = useHasAnyRole(["general_officer", "executive_officer", "administrator"]);
 *
 *   if (!canAccess) return null;
 *
 *   return <OfficerTools />;
 * }
 * ```
 */
export function useHasAnyRole(roles: UserRole[]): boolean {
  const { roles: userRoles, isLoading } = useUserRoles();

  if (isLoading) {
    return false; // Default to false while loading
  }

  return roles.some((role) => userRoles.includes(role));
}

/**
 * Hook to check if the current user has all of the specified roles
 *
 * @param roles - Array of roles to check for
 * @returns Boolean indicating if user has all of the roles
 *
 * @example
 * ```tsx
 * function SpecialFeature() {
 *   const hasAllRoles = useHasAllRoles(["member", "officer"]);
 *
 *   return hasAllRoles ? <SpecialContent /> : null;
 * }
 * ```
 */
export function useHasAllRoles(roles: UserRole[]): boolean {
  const { roles: userRoles, isLoading } = useUserRoles();

  if (isLoading) {
    return false; // Default to false while loading
  }

  return roles.every((role) => userRoles.includes(role));
}

/**
 * ============================================================================
 * AUTHENTICATION STATE HOOKS
 * ============================================================================
 */

/**
 * Simple hook wrapper for authentication state
 *
 * Provides a clean interface to check authentication status and get basic
 * user identifiers. This is a lightweight alternative to useUserRoles when
 * you only need auth state, not roles.
 *
 * @returns Object with isAuthenticated flag and user identifiers
 *
 * @example
 * ```tsx
 * function Navbar() {
 *   const { isAuthenticated, userId, logtoSub } = useIsAuthenticated();
 *
 *   return (
 *     <nav>
 *       {isAuthenticated ? (
 *         <UserMenu userId={userId} />
 *       ) : (
 *         <SignInButton />
 *       )}
 *     </nav>
 *   );
 * }
 * ```
 */
export function useIsAuthenticated(): {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: Id<"users"> | null;
  logtoSub: string | null;
  email: string | null;
} {
  const { isAuthenticated, isLoading: isLogtoLoading } = useLogto();
  const { userId, logtoSub, email, isLoading: isRolesLoading } = useUserRoles();

  return {
    isAuthenticated,
    isLoading: isLogtoLoading || isRolesLoading,
    userId,
    logtoSub,
    email,
  };
}

/**
 * ============================================================================
 * ROLE MANAGEMENT HOOKS (Admin Functions)
 * ============================================================================
 */

/**
 * Hook for administrators to update user roles
 *
 * Provides functions to manually update roles and sync them to Logto.
 * This should only be used by admin/management interfaces.
 *
 * PRD Reference:
 * - Section 6: "Role changes: Admin UI updates role in Convex -> Convex action updates Logto"
 *
 * @returns Object with updateRoles function and loading state
 *
 * @example
 * ```tsx
 * function UserRoleManager({ userId }: { userId: Id<"users"> }) {
 *   const { updateRoles, isLoading, error } = useUpdateRoles();
 *   const currentUser = useUserRoles();
 *
 *   const handleAddRole = async (role: UserRole) => {
 *     const newRoles = [...currentUser.roles, role];
 *     await updateRoles(userId, newRoles, currentUser.userId);
 *   };
 *
 *   return (
 *     <div>
 *       {error && <ErrorMessage error={error} />}
 *       <RoleSelector onSelect={handleAddRole} disabled={isLoading} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useUpdateRoles(): {
  updateRoles: (userId: Id<"users">, roles: UserRole[], performedBy?: Id<"users">) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
} {
  const [error, setError] = useState<Error | null>(null);
  const updateRolesMutation = useMutation(api.users.updateRolesManually);

  const updateRoles = useCallback(
    async (userId: Id<"users">, roles: UserRole[], performedBy?: Id<"users">) => {
      setError(null);
      try {
        await updateRolesMutation({
          userId,
          roles,
          performedBy,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to update roles");
        setError(error);
        throw error;
      }
    },
    [updateRolesMutation]
  );

  return {
    updateRoles,
    isLoading: false, // Convex mutations don't expose loading state directly
    error,
  };
}

/**
 * Hook to sync roles from Logto to Convex
 *
 * Used when receiving role updates from Logto webhooks or manual refresh.
 * This pushes Logto's role state to Convex.
 *
 * PRD Reference:
 * - Section 6: "Incoming Webhook (Logto -> Convex)"
 *
 * @returns Object with syncRoles function and loading state
 */
export function useSyncRolesFromLogto(): {
  syncRoles: (userId: Id<"users">, roles: UserRole[]) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
} {
  const [error, setError] = useState<Error | null>(null);
  const syncRolesMutation = useMutation(api.users.syncRolesFromLogto);

  const syncRoles = useCallback(
    async (userId: Id<"users">, roles: UserRole[]) => {
      setError(null);
      try {
        await syncRolesMutation({
          userId,
          roles,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to sync roles from Logto");
        setError(error);
        throw error;
      }
    },
    [syncRolesMutation]
  );

  return {
    syncRoles,
    isLoading: false,
    error,
  };
}

/**
 * ============================================================================
 * UTILITY HOOKS
 * ============================================================================
 */

/**
 * Hook to get role audit history for a user
 *
 * Fetches the audit trail showing all role changes for a specific user.
 * Useful for admin interfaces showing role change history.
 *
 * @param userId - Convex user ID to fetch audit for
 * @param limit - Maximum number of entries (default 50)
 * @returns Audit entries or null if loading
 */
export function useRoleAuditHistory(userId: Id<"users"> | null, limit: number = 50) {
  return useQuery(
    api.users.getRoleAuditHistory,
    userId ? { userId, limit } : "skip"
  );
}

/**
 * Hook to check role access with loading state handling
 *
 * Returns a tri-state: "loading", "authorized", or "unauthorized"
 * Useful for UI that needs to show different states during auth check.
 *
 * @param requiredRoles - Roles that grant access
 * @returns "loading" | "authorized" | "unauthorized"
 *
 * @example
 * ```tsx
 * function ProtectedRoute({ children }: { children: React.ReactNode }) {
 *   const accessState = useRoleAccess(["administrator"]);
 *
 *   if (accessState === "loading") return <LoadingScreen />;
 *   if (accessState === "unauthorized") return <AccessDenied />;
 *
 *   return <>{children}</>;
 * }
 * ```
 */
export function useRoleAccess(requiredRoles: UserRole[]): "loading" | "authorized" | "unauthorized" {
  const { roles, isLoading } = useUserRoles();

  if (isLoading) {
    return "loading";
  }

  const hasRequiredRole = requiredRoles.some((role) => roles.includes(role));

  return hasRequiredRole ? "authorized" : "unauthorized";
}
