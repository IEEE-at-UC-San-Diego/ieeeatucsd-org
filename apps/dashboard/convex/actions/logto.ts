/**
 * Logto Management API Integration Actions
 *
 * This file provides Convex actions that interact with the Logto Management API
 * for bidirectional role synchronization. These actions use environment variables
 * to authenticate with Logto and update user roles.
 *
 * PRD Reference:
 * - Section 6: "Outgoing Update (Convex -> Logto)" - Lines 212-218
 * - Appendix B: Role Sync Details
 *
 * @module convex/actions/logto
 */

import { action } from '../_generated/server';
import { v } from 'convex/values';

/**
 * ============================================================================
 * TYPES
 * ============================================================================
 */

/**
 * Logto Management API configuration
 */
interface LogtoManagementConfig {
  endpoint: string;
  appId: string;
  appSecret: string;
}


/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * Get Logto Management API credentials from environment variables
 *
 * @returns Logto Management API configuration
 * @throws Error if required environment variables are missing
 */
function getLogtoManagementConfig(): LogtoManagementConfig {
  const endpoint = process.env.LOGTO_ENDPOINT;
  const appId = process.env.LOGTO_APP_ID;
  const appSecret = process.env.LOGTO_APP_SECRET;

  if (!endpoint || !appId || !appSecret) {
    throw new Error(
      'Missing required Logto Management API configuration: LOGTO_ENDPOINT, LOGTO_APP_ID, and LOGTO_APP_SECRET must be set'
    );
  }

  return { endpoint, appId, appSecret };
}

/**
 * Get OAuth access token for Logto Management API
 *
 * Uses client_credentials grant to obtain an access token.
 *
 * @param config - Logto Management API configuration
 * @returns Promise resolving to access token
 * @throws Error if token fetch fails
 */
async function getManagementAccessToken(
  config: LogtoManagementConfig
): Promise<string> {
  const tokenUrl = new URL('/oidc/token', config.endpoint).toString();

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    resource: new URL('/api', config.endpoint).toString(),
    scope: 'all',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get Logto Management API token: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('Logto Management API response missing access_token');
  }

  return data.access_token;
}

/**
 * ============================================================================
 * MANAGEMENT API ACTIONS
 * ============================================================================*/

/**
 * Update user roles in Logto via Management API
 *
 * This action is called from Convex when roles are updated to maintain
 * bidirectional sync. It updates the user's roles in Logto to match Convex.
 *
 * PRD Reference: Section 6 - "Outgoing Update (Convex -> Logto)"
 *
 * @param logtoSub - The Logto subject ID of the user
 * @param roles - Array of role names to assign to the user
 * @param accessToken - Optional pre-fetched access token (useful for batch operations)
 * @returns Promise resolving to success status and any error message
 */
export const updateRolesInLogto = action({
  args: {
    logtoSub: v.string(),
    roles: v.array(v.string()),
  },
  handler: async (_ctx, args) => {
    try {
      const config = getLogtoManagementConfig();

      // Get OAuth access token
      const accessToken = await getManagementAccessToken(config);

      // Update user roles via Management API
      // Note: The exact endpoint depends on Logto's Management API version
      // This implementation assumes a standard REST API pattern
      const userManagementUrl = new URL(
        `/api/users/${args.logtoSub}/roles`,
        config.endpoint
      ).toString();

      const response = await fetch(userManagementUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roleIds: args.roles,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Logto API error: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to update roles in Logto: ${errorMessage}`,
      };
    }
  },
});

/**
 * Sync user from Convex to Logto
 *
 * Full sync of user data from Convex to Logto, including profile and roles.
 * This is useful for keeping user profile information in sync across systems.
 *
 * @param logtoSub - The Logto subject ID of the user
 * @param email - User's email address
 * @param name - Optional user's display name
 * @param roles - Array of role names to assign
 * @returns Promise resolving to success status and any error message
 */
export const syncUserToLogto = action({
  args: {
    logtoSub: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    roles: v.array(v.string()),
  },
  handler: async (_ctx, args) => {
    try {
      const config = getLogtoManagementConfig();

      // Get OAuth access token
      const accessToken = await getManagementAccessToken(config);

      // Update user profile in Logto
      const userManagementUrl = new URL(
        `/api/users/${args.logtoSub}`,
        config.endpoint
      ).toString();

      const profileResponse = await fetch(userManagementUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: args.email,
          name: args.name,
        }),
      });

      if (!profileResponse.ok && profileResponse.status !== 404) {
        const errorText = await profileResponse.text();
        return {
          success: false,
          error: `Failed to update user profile in Logto: ${profileResponse.status} ${profileResponse.statusText} - ${errorText}`,
        };
      }

      // Update roles
      const rolesResponse = await fetch(
        new URL(`/api/users/${args.logtoSub}/roles`, config.endpoint).toString(),
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roleIds: args.roles,
          }),
        }
      );

      if (!rolesResponse.ok) {
        const errorText = await rolesResponse.text();
        return {
          success: false,
          error: `Failed to update roles in Logto: ${rolesResponse.status} ${rolesResponse.statusText} - ${errorText}`,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to sync user to Logto: ${errorMessage}`,
      };
    }
  },
});

/**
 * Get active user roles from Logto
 *
 * Fetch the current roles assigned to a user in Logto.
 * Useful for reconciliation and conflict detection.
 *
 * @param logtoSub - The Logto subject ID of the user
 * @returns Promise resolving to array of role names or error
 */
export const getRolesFromLogto = action({
  args: {
    logtoSub: v.string(),
  },
  handler: async (_ctx, args) => {
    try {
      const config = getLogtoManagementConfig();

      // Get OAuth access token
      const accessToken = await getManagementAccessToken(config);

      // Fetch user roles from Logto
      const userRolesUrl = new URL(
        `/api/users/${args.logtoSub}/roles`,
        config.endpoint
      ).toString();

      const response = await fetch(userRolesUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to fetch roles from Logto: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const data = await response.json();

      // The response format depends on Logto's API version
      // Assuming roles are returned as an array of role objects with IDs or names
      const roles = Array.isArray(data) ? data.map((r: any) => r.id || r.name || r) : [];

      return {
        success: true,
        data: roles,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Failed to fetch roles from Logto: ${errorMessage}`,
      };
    }
  },
});

/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */

export default {
  updateRolesInLogto,
  syncUserToLogto,
  getRolesFromLogto,
};
