/**
 * Authentication guards and higher-order components
 *
 * This file provides utility functions and HOCs for protecting routes
 * and components that require authentication.
 */

import React, { useEffect, ComponentType } from 'react';
import type { User } from './types';
import { useAuth } from './hooks';

/**
 * Check if authentication is required and user is authenticated
 * @param isAuthenticated - Whether the user is currently authenticated
 * @returns boolean indicating if access should be granted
 */
export function requireAuth(isAuthenticated: boolean): boolean {
  return isAuthenticated;
}

/**
 * Check if user should be redirected away from authenticated-only page
 * @param isAuthenticated - Whether the user is currently authenticated
 * @returns boolean indicating if user should be redirected
 */
export function shouldRedirectToLogin(isAuthenticated: boolean): boolean {
  return !isAuthenticated;
}

/**
 * Check if authenticated user should be redirected away from public-only page (e.g., login)
 * @param isAuthenticated - Whether the user is currently authenticated
 * @param redirectUrl - Optional URL to redirect to (defaults to '/dashboard')
 * @returns boolean indicating if redirect should occur
 */
export function redirectIfAuthenticated(
  isAuthenticated: boolean,
  redirectUrl: string = '/dashboard'
): boolean {
  if (isAuthenticated && typeof window !== 'undefined') {
    window.location.href = redirectUrl;
    return true;
  }
  return false;
}

/**
 * Props injected by the withAuthGuard HOC
 * @interface
 */
export interface WithAuthGuardProps {
  /** Whether the user is authenticated (injected by HOC) */
  isAuthenticated: boolean;
  /** The current user (injected by HOC) */
  user: User | null;
}

/**
 * Higher-order component that guards a component with authentication check
 * Redirects to login if user is not authenticated
 * @param Component - The component to wrap
 * @returns Wrapped component with auth guard
 */
export function withAuthGuard<P extends object>(
  Component: ComponentType<P & WithAuthGuardProps>
): React.FC<P> {
  const AuthGuardedComponent: React.FC<P> = (props) => {
    const { isAuthenticated, user, isLoading } = useAuth();

    useEffect(() => {
      if (!isLoading && !isAuthenticated && typeof window !== 'undefined') {
        // Store current URL for redirect after login
        const currentPath = window.location.pathname + window.location.search;
        sessionStorage.setItem('auth_redirect_after_login', currentPath);

        // Redirect to login
        window.location.href = '/signin';
      }
    }, [isAuthenticated, isLoading]);

    // Show nothing while loading or redirecting
    if (isLoading || !isAuthenticated) {
      return null;
    }

    // Render the wrapped component with auth props
    return React.createElement(Component, {
      ...props,
      isAuthenticated,
      user,
    });
  };

  // Set display name for debugging
  const componentName = Component.displayName || Component.name || 'Component';
  AuthGuardedComponent.displayName = `withAuthGuard(${componentName})`;

  return AuthGuardedComponent;
}

/**
 * Higher-order component that redirects authenticated users away
 * Useful for login/signup pages that shouldn't be accessible to logged-in users
 * @param Component - The component to wrap
 * @param redirectUrl - URL to redirect authenticated users to
 * @returns Wrapped component with guest-only guard
 */
export function withGuestOnly<P extends object>(
  Component: ComponentType<P>,
  redirectUrl: string = '/dashboard'
): React.FC<P> {
  const GuestOnlyComponent: React.FC<P> = (props) => {
    const { isAuthenticated, isLoading } = useAuth();

    useEffect(() => {
      if (!isLoading && isAuthenticated && typeof window !== 'undefined') {
        window.location.href = redirectUrl;
      }
    }, [isAuthenticated, isLoading]);

    // Show nothing while loading or if authenticated (will redirect)
    if (isLoading || isAuthenticated) {
      return null;
    }

    return React.createElement(Component, props);
  };

  const componentName = Component.displayName || Component.name || 'Component';
  GuestOnlyComponent.displayName = `withGuestOnly(${componentName})`;

  return GuestOnlyComponent;
}

/**
 * Higher-order component that guards based on specific role
 * @param Component - The component to wrap
 * @param allowedRoles - Array of roles that are allowed access
 * @returns Wrapped component with role-based guard
 */
export function withRoleGuard<P extends object>(
  Component: ComponentType<P & WithAuthGuardProps>,
  allowedRoles: string[]
): React.FC<P> {
  const RoleGuardedComponent: React.FC<P> = (props) => {
    const { isAuthenticated, user, isLoading } = useAuth();

    useEffect(() => {
      if (!isLoading) {
        if (!isAuthenticated && typeof window !== 'undefined') {
          // Not authenticated, redirect to login
          const currentPath = window.location.pathname + window.location.search;
          sessionStorage.setItem('auth_redirect_after_login', currentPath);
          window.location.href = '/signin';
        } else if (
          isAuthenticated &&
          user &&
          !allowedRoles.includes(user.role) &&
          typeof window !== 'undefined'
        ) {
          // Authenticated but wrong role, redirect to unauthorized
          window.location.href = '/unauthorized';
        }
      }
    }, [isAuthenticated, isLoading, user]);

    // Show nothing while loading or if not authorized
    if (
      isLoading ||
      !isAuthenticated ||
      (user && !allowedRoles.includes(user.role))
    ) {
      return null;
    }

    return React.createElement(Component, {
      ...props,
      isAuthenticated,
      user,
    });
  };

  const componentName = Component.displayName || Component.name || 'Component';
  RoleGuardedComponent.displayName = `withRoleGuard(${componentName})`;

  return RoleGuardedComponent;
}

/**
 * Check if user has required role
 * @param user - The user to check
 * @param requiredRole - The required role
 * @returns boolean indicating if user has the required role
 */
export function hasRole(user: User | null, requiredRole: string): boolean {
  if (!user) return false;
  return user.role === requiredRole;
}

/**
 * Check if user has any of the required roles
 * @param user - The user to check
 * @param requiredRoles - Array of allowed roles
 * @returns boolean indicating if user has any of the required roles
 */
export function hasAnyRole(
  user: User | null,
  requiredRoles: string[]
): boolean {
  if (!user) return false;
  return requiredRoles.includes(user.role);
}

/**
 * Assert that user is authenticated, throw otherwise
 * @param isAuthenticated - Whether user is authenticated
 * @param message - Optional custom error message
 * @throws {Error} If user is not authenticated
 */
export function assertAuthenticated(
  isAuthenticated: boolean,
  message: string = 'User must be authenticated'
): void {
  if (!isAuthenticated) {
    throw new Error(message);
  }
}

/**
 * Assert that user has required role, throw otherwise
 * @param user - The user to check
 * @param requiredRole - The required role
 * @throws {Error} If user doesn't have the required role
 */
export function assertRole(
  user: User | null,
  requiredRole: string
): void {
  if (!user || user.role !== requiredRole) {
    throw new Error(`User must have role: ${requiredRole}`);
  }
}

export default {
  requireAuth,
  shouldRedirectToLogin,
  redirectIfAuthenticated,
  withAuthGuard,
  withGuestOnly,
  withRoleGuard,
  hasRole,
  hasAnyRole,
  assertAuthenticated,
  assertRole,
};
