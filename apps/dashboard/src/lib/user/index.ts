/**
 * User Management Module
 *
 * This module exports all user and role management hooks and types.
 * Per PRD Section 6: Logto ↔ Convex role synchronization
 *
 * @module lib/user
 */

// Export all hooks
export {
  useUserRoles,
  useHasRole,
  useHasAnyRole,
  useHasAllRoles,
  useIsAuthenticated,
  useUpdateRoles,
  useSyncRolesFromLogto,
  useRoleAuditHistory,
  useRoleAccess,
} from "./hooks";

// Export types
export type { UserData, UserRole } from "./hooks";
