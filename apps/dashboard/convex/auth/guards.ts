/**
 * Convex Authentication and Authorization Middleware
 *
 * This file provides server-side auth functions for Convex queries and mutations.
 * It verifies sessions and enforces role-based access control.
 *
 * PRD Reference:
 * - Section 6 (Authentication and Authorization Mapping) - Lines 125-224
 * - Appendix C (Sample Convex Schema) - Lines 461-487
 *
 * @module convex/auth/guards
 */

// Note: query, mutation imports may be used when creating actual query/mutation functions
// They're kept for future use
// import { query, mutation } from '../_generated/server';

// Define QueryContext type for our use
// This is the context passed to query/mutation/action handlers
export type QueryContext = {
  db: any;
  auth: {
    getUserIdentity(): Promise<any>;
  };
  scheduler: any;
};

/**
 * ============================================================================
 * AUTH GUARD TYPES
 * ============================================================================
 */

/**
 * Extended user identity with roles
 *
 * This type extends Convex's basic identity to include role information
 * for authorization decisions.
 */
export interface IdentityWithRoles {
  /** The Convex user ID */
  userId: string;
  /** The Logto subject ID */
  logtoSub: string;
  /** The user's email address */
  email: string;
  /** The user's assigned roles */
  roles: string[];
  /** User's display name (optional) */
  name?: string;
}

/**
 * Result type for getSessionUser
 */
export type SessionUser = IdentityWithRoles | null;

/**
 * ============================================================================
 * AUTHENTICATION GUARDS
 * ============================================================================
 */

/**
 * Verify session and return user from Convex
 *
 * This function:
 * 1. Gets the authenticated identity from Convex (via ctx.auth.getUserIdentity())
 * 2. Looks up the user in the users table by their Logto subject ID
 * 3. Fetches their roles from the userRoles table
 * 4. Returns the complete user information with roles
 *
 * PRD Reference: Section 6 - "Central guard helper: getSessionUser()"
 *
 * @param ctx - The Convex QueryContext (from query/mutation/action handler)
 * @returns Promise resolving to user info with roles, or null if not authenticated
 * @throws Error if there's a system failure (not for unauthenticated users)
 */
export async function getSessionUser(
  ctx: QueryContext
): Promise<IdentityWithRoles | null> {
  try {
    // Get the authenticated identity from Convex
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      // No authenticated user
      return null;
    }

    // Extract Logto subject ID from the identity
    // The identity token issuer should contain the Logto sub
    const logtoSub = identity.subject;

    if (!logtoSub) {
      console.error('Identity found but missing subject ID');
      return null;
    }

    // Look up the user by Logto sub
    const user = await ctx.db
      .query('users')
      .withIndex('byLogtoSub', (q: any) => q.eq('logtoSub', logtoSub))
      .unique();

    if (!user) {
      // User authenticated but not found in our database
      // This could happen if the user was deleted from Convex but still has a valid token
      console.warn(`Authenticated user with sub ${logtoSub} not found in users table`);
      return null;
    }

    // Get the user's roles
    const roleDoc = await ctx.db
      .query('userRoles')
      .withIndex('byUser', (q: any) => q.eq('userId', user._id))
      .unique();

    const roles = roleDoc?.roles ?? [];

    return {
      userId: user._id,
      logtoSub: user.logtoSub,
      email: user.email,
      name: user.name,
      roles,
    };
  } catch (error) {
    console.error('Error in getSessionUser:', error);
    throw new Error('Failed to verify session');
  }
}

/**
 * Require specific roles, throw error if not authorized
 *
 * This function:
 * 1. Verifies the user is authenticated
 * 2. Checks if the user has at least one of the required roles
 * 3. Throws an error if not authorized
 *
 * PRD Reference: Section 6 - "Central guard helper: requireRoles(roles[])"
 *
 * @param ctx - The Convex QueryContext (from query/mutation/action handler)
 * @param requiredRoles - Array of role names that grant access (any one is sufficient)
 * @returns Promise resolving to the authenticated user with roles
 * @throws Error if user is not authenticated or lacks required roles
 */
export async function requireRoles(
  ctx: QueryContext,
  requiredRoles: string[]
): Promise<IdentityWithRoles> {
  const user = await getSessionUser(ctx);

  if (!user) {
    throw new Error(
      'Authentication required: Please sign in to access this resource'
    );
  }

  // Check if user has any of the required roles
  const hasRequiredRole = requiredRoles.some((role) => user.roles.includes(role));

  if (!hasRequiredRole) {
    throw new Error(
      `Authorization required: This resource requires one of the following roles: ${requiredRoles.join(', ')}`
    );
  }

  return user;
}

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Check if user is authenticated
 *
 * Lightweight check that doesn't fetch full user data.
 *
 * @param ctx - The Convex QueryContext
 * @returns Promise resolving to true if authenticated, false otherwise
 */
export async function isAuthenticated(ctx: QueryContext): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  return identity !== null;
}

/**
 * Check if user has a specific role
 *
 * @param ctx - The Convex QueryContext
 * @param role - The role to check
 * @returns Promise resolving to true if user has the role, false otherwise
 */
export async function userHasRole(
  ctx: QueryContext,
  role: string
): Promise<boolean> {
  const user = await getSessionUser(ctx);
  if (!user) return false;
  return user.roles.includes(role);
}

/**
 * Check if user has any of the specified roles
 *
 * @param ctx - The Convex QueryContext
 * @param roles - Array of roles to check
 * @returns Promise resolving to true if user has any of the roles, false otherwise
 */
export async function userHasAnyRole(
  ctx: QueryContext,
  roles: string[]
): Promise<boolean> {
  const user = await getSessionUser(ctx);
  if (!user) return false;
  return roles.some((role) => user.roles.includes(role));
}

/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */

export default {
  getSessionUser,
  requireRoles,
  isAuthenticated,
  userHasRole,
  userHasAnyRole,
};
