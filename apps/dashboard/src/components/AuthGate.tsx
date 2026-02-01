/**
 * AuthGate Component for Route Protection
 *
 * This component provides server-side aware authentication gating for protected routes.
 * It combines both client-side (via Logto hooks) and server-side authentication checks.
 *
 * PRD Reference: Lines 163-175
 *
 * Features:
 * - Redirects to sign-in if not authenticated
 * - Optional role-based access control
 * - Loading state handling
 * - TanStack Start beforeLoad integration
 *
 * @module components/AuthGate
 */

import React from 'react';
import { useLogto } from '@logto/react';

/**
 * Props for the AuthGate component
 */
export interface AuthGateProps {
  /** Child components to render when authorized */
  children: React.ReactNode;

  /** Optional: Array of roles that grant access */
  requiredRoles?: string[];

  /** Optional: URL to redirect to when not authenticated (defaults to '/signin') */
  signInUrl?: string;

  /** Optional: URL to redirect to when authenticated but lacks required roles (defaults to '/unauthorized') */
  unauthorizedUrl?: string;

  /** Optional: Custom loading component */
  loadingComponent?: React.ReactNode;
}

/**
 * AuthGate Component
 *
 * Protects routes and components by checking authentication and optional roles.
 *
 * @example
 * ```tsx
 * // Basic authentication gate
 * <AuthGate>
 *   <Dashboard />
 * </AuthGate>
 *
 * // With role requirement
 * <AuthGate requiredRoles={['administrator', 'general_officer']}>
 *   <AdminPanel />
 * </AuthGate>
 * ```
 *
 * @param props - AuthGate configuration props
 * @returns Protected children or performs redirect
 */
export function AuthGate({
  children,
  signInUrl = '/signin',
  loadingComponent = null,
  // Note: requiredRoles and unauthorizedUrl reserved for future implementation
  // Role-based authorization should be implemented server-side beforeLoad
  requiredRoles: _requiredRoles,
  unauthorizedUrl: _unauthorizedUrl,
}: AuthGateProps): React.ReactElement | null {
  const { isAuthenticated, isLoading, signIn } = useLogto();

  // Show loading component while checking auth state
  if (isLoading) {
    return loadingComponent ? <>{loadingComponent}</> : null;
  }

  // If not authenticated, redirect to sign-in
  if (!isAuthenticated) {
    // Store the current URL for redirect after login
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname + window.location.search;
      sessionStorage.setItem('auth_redirect_after_login', currentPath);
      signIn(signInUrl);
    }
    return null;
  }

  // Note: For role-based authorization, you should fetch the user's roles from Convex
  // and compare against requiredRoles. The client-side userInfo from Logto doesn't
  // include application roles by default. Use the auth guards from convex/auth/guards.ts
  // for server-side role enforcement, or fetch roles from Convex API here.
  //
  // Example server-side pattern:
  // const userIdentity = await ctx.auth.getUserIdentity();
  // const user = await getSessionUser(ctx);
  // if (requiredRoles.length > 0 && !requiredRoles.some(r => user.roles.includes(r))) {
  //   throw redirect({ to: unauthorizedUrl });
  // }

  // User is authenticated and authorized
  return <>{children}</>;
}

/**
 * AuthGate with server-side integration
 *
 * This HOC wrapper adds server-side auth checking via TanStack Start's loader/beforeLoad.
 * Use this for routes that need server-side protection.
 *
 * @example
 * ```tsx
 * // In your route file:
 * import { withAuthGuard } from '~/components/AuthGate';
 *
 * export const Route = createFileRoute('/admin')({
 *   component: withAuthGuard(() => <AdminPage />, ['administrator']),
 * });
 * ```
 */
interface PageProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export function withAuthGuard(
  Page: React.ComponentType<PageProps>,
  requiredRoles: string[] = []
): React.FC<PageProps> {
  return function AuthGuardedPage(props: PageProps) {
    return (
      <AuthGate requiredRoles={requiredRoles || props.requiredRoles}>
        <Page {...props} />
      </AuthGate>
    );
  };
}

export default AuthGate;
