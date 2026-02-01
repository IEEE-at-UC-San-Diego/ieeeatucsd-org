/**
 * User and Role Management Functions for Convex
 *
 * This file provides mutations and queries for user management and role
 * synchronization between Logto (auth provider) and Convex (backend database).
 *
 * Per PRD Section 6 (Authentication and Authorization Mapping):
 * - Bidirectional sync between Logto and Convex
 * - Role audit trail for all changes
 * - Last-writer-wins conflict resolution with provenance tracking
 *
 * @module convex/users
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * ============================================================================
 * USER MANAGEMENT FUNCTIONS
 * ============================================================================
 */

/**
 * Get or create a user based on Logto subject ID
 *
 * This is the primary entry point for user creation during authentication.
 * If the user exists by logtoSub, updates their profile info.
 * If not, creates a new user with the provided details.
 *
 * PRD Reference: Section 6, Auth Flow (New) - Step 4
 *
 * @param logtoSub - Logto subject identifier (unique)
 * @param email - User's email address
 * @param name - Optional display name
 * @param avatarUrl - Optional avatar URL
 * @returns The user document ID (internal Convex ID)
 */
export const getOrCreateUser = mutation({
  args: {
    logtoSub: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if user exists by logtoSub
    const existingUser = await ctx.db
      .query("users")
      .withIndex("byLogtoSub", (q) => q.eq("logtoSub", args.logtoSub))
      .unique();

    if (existingUser) {
      // Update existing user with latest info from Logto
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        name: args.name ?? existingUser.name,
        avatarUrl: args.avatarUrl ?? existingUser.avatarUrl,
        updatedAt: now,
      });

      return existingUser._id;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      logtoSub: args.logtoSub,
      email: args.email,
      name: args.name,
      avatarUrl: args.avatarUrl,
      createdAt: now,
      updatedAt: now,
    });

    // Initialize default role (member) in userRoles table
    await ctx.db.insert("userRoles", {
      userId,
      roles: ["member"],
      source: "logto",
      updatedAt: now,
    });

    // Create audit entry for initial role assignment
    await ctx.db.insert("roleAudit", {
      userId,
      roles: ["member"],
      previousRoles: [],
      action: "granted",
      source: "logto_sync",
      performedBy: undefined,
      timestamp: now,
    });

    return userId;
  },
});

/**
 * Get user by Logto subject ID
 *
 * Query function to retrieve user document by their Logto identifier.
 * Returns null if user not found.
 *
 * PRD Reference: Appendix C - users table with byLogtoSub index
 *
 * @param logtoSub - Logto subject identifier
 * @returns User document or null
 */
export const getUserByLogtoSub = query({
  args: {
    logtoSub: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("byLogtoSub", (q) => q.eq("logtoSub", args.logtoSub))
      .unique();

    return user;
  },
});

/**
 * Get user by email address
 *
 * Query function to retrieve user document by email.
 * Useful for invitation flows and admin lookups.
 *
 * PRD Reference: Appendix C - users table with byEmail index
 *
 * @param email - User's email address
 * @returns User document or null
 */
export const getUserByEmail = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("byEmail", (q) => q.eq("email", args.email))
      .unique();

    return user;
  },
});

/**
 * ============================================================================
 * ROLE MANAGEMENT FUNCTIONS
 * ============================================================================
 */

/**
 * Synchronize roles from Logto to Convex
 *
 * This mutation updates Convex userRoles table when Logto sends role updates.
 * It compares incoming roles with current roles, updates if changed,
 * and creates an audit entry.
 *
 * PRD Reference:
 * - Section 6: "Incoming Webhook (Logto -> Convex)"
 * - Appendix B: "Logto to Convex Mapping"
 *
 * Primary roles: member, general_officer, executive_officer, member_at_large,
 * past_officer, sponsor, administrator
 *
 * @param userId - Convex user ID
 * @param roles - Array of role names from Logto
 * @returns Updated roles array
 */
export const syncRolesFromLogto = mutation({
  args: {
    userId: v.id("users"),
    roles: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error(`User not found: ${args.userId}`);
    }

    // Get current user roles
    const currentRoleDoc = await ctx.db
      .query("userRoles")
      .withIndex("byUser", (q) => q.eq("userId", args.userId))
      .unique();

    const currentRoles = currentRoleDoc?.roles ?? [];

    // Check if roles have changed (sort and compare)
    const sortedIncoming = [...args.roles].sort();
    const sortedCurrent = [...currentRoles].sort();
    const hasChanged =
      sortedIncoming.length !== sortedCurrent.length ||
      sortedIncoming.some((role, i) => role !== sortedCurrent[i]);

    if (!hasChanged) {
      // No changes needed
      return currentRoles;
    }

    // Determine what action to log
    const action = currentRoles.length === 0 ? "granted" : "synced";

    if (currentRoleDoc) {
      // Update existing role document
      await ctx.db.patch(currentRoleDoc._id, {
        roles: args.roles,
        source: "logto",
        updatedAt: now,
      });
    } else {
      // Create new role document
      await ctx.db.insert("userRoles", {
        userId: args.userId,
        roles: args.roles,
        source: "logto",
        updatedAt: now,
      });
    }

    // Create audit entry
    await ctx.db.insert("roleAudit", {
      userId: args.userId,
      roles: args.roles,
      previousRoles: currentRoles,
      action,
      source: "logto_sync",
      performedBy: undefined,
      timestamp: now,
    });

    return args.roles;
  },
});

/**
 * Get user's roles
 *
 * Query function to retrieve current roles for a user.
 * Returns empty array if no roles are assigned.
 *
 * PRD Reference: Appendix C - userRoles table
 *
 * @param userId - Convex user ID
 * @returns Array of role names
 */
export const getUserRoles = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const roleDoc = await ctx.db
      .query("userRoles")
      .withIndex("byUser", (q) => q.eq("userId", args.userId))
      .unique();

    return roleDoc?.roles ?? [];
  },
});

/**
 * Update roles manually (admin function)
 *
 * This mutation allows administrators to update user roles directly in Convex.
 * It also calls Logto Management API (via action) to update roles in Logto,
 * maintaining bidirectional sync.
 *
 * PRD Reference:
 * - Section 6: "Outgoing Update (Convex -> Logto)"
 * - Appendix B: "Conflict Policy" - Last-writer-wins
 *
 * @param userId - Convex user ID to update
 * @param roles - New array of role names
 * @param performedBy - Optional ID of admin performing the action
 * @returns Updated roles array
 */
export const updateRolesManually = mutation({
  args: {
    userId: v.id("users"),
    roles: v.array(v.string()),
    performedBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error(`User not found: ${args.userId}`);
    }

    // Verify performer exists (if provided)
    if (args.performedBy) {
      const performer = await ctx.db.get(args.performedBy);
      if (!performer) {
        throw new Error(`Performer not found: ${args.performedBy}`);
      }
    }

    // Get current roles
    const currentRoleDoc = await ctx.db
      .query("userRoles")
      .withIndex("byUser", (q) => q.eq("userId", args.userId))
      .unique();

    const currentRoles = currentRoleDoc?.roles ?? [];

    // Check if roles have changed
    const sortedIncoming = [...args.roles].sort();
    const sortedCurrent = [...currentRoles].sort();
    const hasChanged =
      sortedIncoming.length !== sortedCurrent.length ||
      sortedIncoming.some((role, i) => role !== sortedCurrent[i]);

    if (!hasChanged) {
      return currentRoles;
    }

    // Update or create role document
    if (currentRoleDoc) {
      await ctx.db.patch(currentRoleDoc._id, {
        roles: args.roles,
        source: "convex",
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userRoles", {
        userId: args.userId,
        roles: args.roles,
        source: "convex",
        updatedAt: now,
      });
    }

    // Create audit entry
    await ctx.db.insert("roleAudit", {
      userId: args.userId,
      roles: args.roles,
      previousRoles: currentRoles,
      action: "synced",
      source: "manual_update",
      performedBy: args.performedBy,
      timestamp: now,
    });

    // Call Logto Management API to update roles in Logto
    // This maintains bidirectional sync between Convex and Logto
    // Note: Scheduler will call the action defined in actions/logto.ts
    // The action itself runs in the Node.js environment and can make HTTP requests
    import { internal } from './_generated/api';
    
    try {
      // Schedule the role sync to Logto via action
      // Note: This imports internal after checking types are generated
      await ctx.scheduler.runAfter(0, internal.actions.logto.updateRolesInLogto, {
        logtoSub: user.logtoSub,
        roles: args.roles,
      });
    } catch (error) {
      console.error('Error scheduling Logto role sync:', error);
      // Don't fail the entire operation if Logto sync fails
      // The role is updated in Convex, and we can retry later
      // TODO: In Phase 2, mark a reconciliationNeeded flag on the user
    }

    return args.roles;
  },
});

/**
 * Get role audit history for a user
 *
 * Query function to retrieve audit trail for role changes.
 * Results are ordered by timestamp descending (most recent first).
 *
 * PRD Reference: Appendix C - roleAudit table
 *
 * @param userId - Convex user ID
 * @param limit - Maximum number of entries to return (default 50)
 * @returns Array of audit entries
 */
export const getRoleAuditHistory = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const auditEntries = await ctx.db
      .query("roleAudit")
      .withIndex("byUserAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    return auditEntries;
  },
});

/**
 * Check if user has a specific role
 *
 * Convenience query to check role membership.
 *
 * @param userId - Convex user ID
 * @param role - Role name to check
 * @returns Boolean indicating if user has the role
 */
export const hasRole = query({
  args: {
    userId: v.id("users"),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const roleDoc = await ctx.db
      .query("userRoles")
      .withIndex("byUser", (q) => q.eq("userId", args.userId))
      .unique();

    return roleDoc?.roles.includes(args.role) ?? false;
  },
});

/**
 * Check if user has any of the specified roles
 *
 * Convenience query for role-based access checks.
 *
 * @param userId - Convex user ID
 * @param roles - Array of role names to check
 * @returns Boolean indicating if user has any of the roles
 */
export const hasAnyRole = query({
  args: {
    userId: v.id("users"),
    roles: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const roleDoc = await ctx.db
      .query("userRoles")
      .withIndex("byUser", (q) => q.eq("userId", args.userId))
      .unique();

    if (!roleDoc?.roles.length) {
      return false;
    }

    return args.roles.some((role) => roleDoc.roles.includes(role));
  },
});

/**
 * Get current user based on Logto subject
 *
 * Query function to get the current authenticated user.
 * Designed for use with the Logto auth provider integration.
 *
 * @param logtoSub - Logto subject identifier (optional, can skip query)
 * @returns User document or null
 */
export const getCurrent = query({
  args: {
    logtoSub: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.logtoSub) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("byLogtoSub", (q) => q.eq("logtoSub", args.logtoSub))
      .unique();

    return user;
  },
});
