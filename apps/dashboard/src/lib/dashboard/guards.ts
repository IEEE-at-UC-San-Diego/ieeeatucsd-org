/**
 * Dashboard route guards
 *
 * Role-based access control utilities for protecting routes.
 * Uses Convex userRoles table for role checking.
 */

import type { UserRole } from "@/config/navigation";

/**
 * Checks if user has the required role
 *
 * @param userRoles - Array of roles the user has
 * @param requiredRole - Single role required
 * @returns true if user has the required role
 */
export function requireRole(
  userRoles: string[],
  requiredRole: UserRole
): boolean {
  return userRoles.includes(requiredRole);
}

/**
 * Checks if user has any of the required roles
 *
 * @param userRoles - Array of roles the user has
 * @param requiredRoles - Array of roles (user needs at least one)
 * @returns true if user has at least one of the required roles
 */
export function requireAnyRole(
  userRoles: string[],
  requiredRoles: UserRole[]
): boolean {
  if (requiredRoles.length === 0) {
    return true;
  }
  return requiredRoles.some((role) => userRoles.includes(role));
}

/**
 * Checks if user has all of the required roles
 *
 * @param userRoles - Array of roles the user has
 * @param requiredRoles - Array of roles (user needs all of them)
 * @returns true if user has all of the required roles
 */
export function requireAllRoles(
  userRoles: string[],
  requiredRoles: UserRole[]
): boolean {
  if (requiredRoles.length === 0) {
    return true;
  }
  return requiredRoles.every((role) => userRoles.includes(role));
}

/**
 * Gets the highest priority role from user's roles
 * Priority order: administrator > executive_officer > general_officer > member_at_large > past_officer > sponsor > member
 *
 * @param userRoles - Array of roles the user has
 * @returns The highest priority role
 */
export function getPrimaryRole(userRoles: string[]): UserRole {
  const rolePriority: UserRole[] = [
    "administrator",
    "executive_officer",
    "general_officer",
    "member_at_large",
    "past_officer",
    "sponsor",
    "member",
  ];

  for (const role of rolePriority) {
    if (userRoles.includes(role)) {
      return role;
    }
  }

  return "member";
}
