/**
 * React hooks for authentication system
 *
 * This file provides custom React hooks for accessing and managing
 * authentication state within components.
 *
 * Updated for Logto integration and Convex role synchronization.
 * Per PRD Section 6: Bidirectional role sync between Logto and Convex
 *
 * @module lib/auth/hooks
 */

import { useContext, useEffect, useState, useMemo } from "react";
import { useLogto, UserInfoResponse } from "@logto/react";
import { AuthContext } from "./AuthContext";
import type { User } from "./types";
import { AuthenticationError } from "./errors";
import {
  useUserRoles,
  useHasRole as useUserHasRole,
  useHasAnyRole as useUserHasAnyRole,
  useIsAuthenticated as useUserIsAuthenticated,
} from "../user/hooks";

/**
 * Map Logto user info to our User type
 *
 * Enhanced to include role data from Convex when available.
 *
 * @param logtoUser - User info from Logto
 * @param roles - Roles from Convex (optional)
 * @returns User object compatible with our auth system
 */
export function mapLogtoUser(
  logtoUser: UserInfoResponse | undefined,
  roles: string[] = []
): User | null {
  if (!logtoUser) return null;

  // Determine primary role (highest precedence)
  const rolePriority = [
    "administrator",
    "executive_officer",
    "general_officer",
    "member_at_large",
    "past_officer",
    "sponsor",
    "member",
  ];

  const primaryRole =
    rolePriority.find((r) => roles.includes(r)) ||
    roles[0] ||
    "member";

  return {
    id: logtoUser.sub,
    email: logtoUser.email ?? "",
    name: logtoUser.name ?? logtoUser.username ?? "",
    role: primaryRole,
    roles: roles,
  };
}

/**
 * Hook to access the authentication context
 * Must be used within an AuthProvider
 *
 * @returns The authentication context value
 * @throws {Error} If used outside of AuthProvider
 * @deprecated Use useLogto() or useUserRoles() directly for new code
 */
export function useAuth(): NonNullable<typeof AuthContext extends React.Context<infer T> ? T : never> {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error(
      "useAuth must be used within an AuthProvider. " +
        "Make sure your component is wrapped with <AuthProvider>."
    );
  }

  return context;
}

/**
 * Hook that provides authentication state using Logto with Convex role integration
 *
 * This is the preferred hook for new code. It combines Logto authentication
 * with role data from Convex for complete user information.
 *
 * Per PRD Section 6: Auth Flow (New) - Step 4-5
 *
 * @returns Object with user data, auth state, and role information
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { user, isAuthenticated, isLoading } = useLogtoAuth();
 *
 *   if (isLoading) return <Loading />;
 *   if (!isAuthenticated) return <SignInPrompt />;
 *
 *   return <Welcome name={user?.name} roles={user?.roles} />;
 * }
 * ```
 */
export function useLogtoAuth() {
  const { isAuthenticated, isLoading: isLogtoLoading, signIn, signOut, fetchUserInfo } = useLogto();
  const [logtoError, setLogtoError] = useState<Error | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfoResponse | null>(null);

  // Use the new user role hooks for role data
  const { roles, isLoading: isRolesLoading, error: rolesError, isSynced } = useUserRoles();

  // Fetch user info from Logto when authenticated
  useEffect(() => {
    if (isAuthenticated && !isLogtoLoading) {
      fetchUserInfo()
        .then((info) => {
          setUserInfo(info);
          setLogtoError(null);
        })
        .catch((err) => {
          setLogtoError(err instanceof Error ? err : new Error("Failed to fetch user info"));
          setUserInfo(null);
        });
    } else if (!isAuthenticated) {
      setUserInfo(null);
    }
  }, [isAuthenticated, isLogtoLoading, fetchUserInfo]);

  /**
   * Login function (compatibility shim)
   * Note: Logto uses OAuth redirect, so actual login happens via signIn button
   */
  const login = async (_credentials: { username: string; password: string }) => {
    throw new Error("Use signIn() from useLogto() for Logto authentication");
  };

  /**
   * Logout function
   */
  const logout = async () => {
    const redirectUri = window.location.origin;
    await signOut(redirectUri);
  };

  /**
   * Refresh user data
   */
  const refreshUser = async () => {
    try {
      const userInfo = await fetchUserInfo();
      setUserInfo(userInfo);
      setLogtoError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to refresh user");
      setLogtoError(error);
      throw error;
    }
  };

  // Build the enhanced user object with role data
  const user = useMemo(() => {
    if (!userInfo) return null;
    return mapLogtoUser(userInfo, roles);
  }, [userInfo, roles]);

  // Combine loading states and errors
  const isLoading = isLogtoLoading || isRolesLoading || (isAuthenticated && !isSynced);
  const error = logtoError || rolesError;

  return {
    user,
    isAuthenticated,
    isLoading,
    isSynced,
    login,
    logout,
    refreshUser,
    error,
    roles,
  };
}

/**
 * Hook that requires authentication and redirects if not authenticated
 *
 * @param redirectUrl - URL to redirect to if not authenticated (defaults to '/signin')
 */
export function useRequireAuth(redirectUrl: string = "/signin"): void {
  const { isAuthenticated, isLoading } = useLogto();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && typeof window !== "undefined") {
      // Store current URL for redirect after login
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== redirectUrl) {
        sessionStorage.setItem("auth_redirect_after_login", currentPath);
      }

      // Redirect to login page
      window.location.href = redirectUrl;
    }
  }, [isAuthenticated, isLoading, redirectUrl]);
}

/**
 * Hook to get the current authenticated user
 *
 * @returns The current User or null if not authenticated
 */
export function useUser(): User | null {
  const { user } = useLogtoAuth();
  return user;
}

/**
 * Hook to check if user has a specific role
 *
 * Enhanced version that checks roles from Convex via useUserRoles.
 * Per PRD Section 6: Role checking against Convex-stored roles
 *
 * @param role - The role to check for
 * @returns boolean indicating if user has the role
 */
export function useHasRole(role: string): boolean {
  return useUserHasRole(role as import("../user/hooks").UserRole);
}

/**
 * Hook to check if user has any of the specified roles
 *
 * Enhanced version that checks roles from Convex via useUserRoles.
 *
 * @param roles - Array of roles to check
 * @returns boolean indicating if user has any of the roles
 */
export function useHasAnyRole(roles: string[]): boolean {
  return useUserHasAnyRole(roles as import("../user/hooks").UserRole[]);
}

/**
 * Hook to check if user has all of the specified roles
 *
 * @param roles - Array of roles to check
 * @returns boolean indicating if user has all of the roles
 */
export function useHasAllRoles(roles: string[]): boolean {
  const { roles: userRoles } = useUserRoles();

  if (userRoles.length === 0) return false;

  return roles.every((role) => userRoles.includes(role));
}

/**
 * Hook to get authentication loading state
 *
 * @returns boolean indicating if auth state is being loaded
 */
export function useAuthLoading(): boolean {
  const { isLoading: isLogtoLoading } = useLogto();
  const { isLoading: isRolesLoading } = useUserRoles();

  return isLogtoLoading || isRolesLoading;
}

/**
 * Hook to check if user is authenticated
 *
 * Enhanced version that includes Convex sync status.
 *
 * @returns Object with authentication status and user info
 */
export function useIsAuthenticated(): {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string | null;
  logtoSub: string | null;
} {
  const { isAuthenticated, isLoading: isLogtoLoading } = useLogto();
  const { userId, logtoSub, isLoading: isRolesLoading } = useUserIsAuthenticated();

  return {
    isAuthenticated,
    isLoading: isLogtoLoading || isRolesLoading,
    userId: userId ?? null,
    logtoSub,
  };
}

/**
 * Hook to perform login with error handling
 *
 * @returns Object with login function and loading state
 * @deprecated Use useLogto().signIn() directly
 */
export function useLogin(): {
  login: (username: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
} {
  const { login, isLoading } = useLogtoAuth();
  const [error, setError] = useState<Error | null>(null);

  const handleLogin = async (
    username: string,
    password: string
  ): Promise<void> => {
    setError(null);
    try {
      await login({ username, password });
    } catch (err) {
      const error =
        err instanceof Error ? err : new AuthenticationError("Login failed");
      setError(error);
      throw error;
    }
  };

  return { login: handleLogin, isLoading, error };
}

/**
 * Hook to perform logout
 *
 * @returns Object with logout function and loading state
 */
export function useLogout(): {
  logout: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
} {
  const { logout, isLoading } = useLogtoAuth();
  const [error, setError] = useState<Error | null>(null);

  const handleLogout = async (): Promise<void> => {
    setError(null);
    try {
      await logout();
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Logout failed");
      setError(error);
      throw error;
    }
  };

  return { logout: handleLogout, isLoading, error };
}

/**
 * Hook to require specific roles for access
 *
 * Redirects or renders fallback if user doesn't have required roles.
 *
 * Per PRD Section 6: Protected routes with role checks
 *
 * @param requiredRoles - Array of roles that grant access
 * @param options - Configuration for unauthorized access
 * @returns Object with access state and user info
 *
 * @example
 * ```tsx
 * function AdminRoute({ children }: { children: React.ReactNode }) {
 *   const { hasAccess, isLoading } = useRequireRole(["administrator"]);
 *
 *   if (isLoading) return <Loading />;
 *   if (!hasAccess) return <AccessDenied />;
 *
 *   return <>{children}</>;
 * }
 * ```
 */
export function useRequireRole(
  requiredRoles: string[],
  options: {
    redirectTo?: string;
    onUnauthorized?: () => void;
  } = {}
): {
  hasAccess: boolean;
  isLoading: boolean;
  user: User | null;
} {
  const { isAuthenticated, isLoading: isAuthLoading } = useLogto();
  const { roles, isLoading: isRolesLoading } = useUserRoles();
  const { user } = useLogtoAuth();

  const isLoading = isAuthLoading || isRolesLoading;

  const hasAccess = useMemo(() => {
    if (!isAuthenticated || roles.length === 0) return false;
    return requiredRoles.some((role) => roles.includes(role));
  }, [isAuthenticated, roles, requiredRoles]);

  useEffect(() => {
    if (!isLoading && !hasAccess) {
      if (options.onUnauthorized) {
        options.onUnauthorized();
      } else if (options.redirectTo && typeof window !== "undefined") {
        window.location.href = options.redirectTo;
      }
    }
  }, [isLoading, hasAccess, options]);

  return { hasAccess, isLoading, user };
}
