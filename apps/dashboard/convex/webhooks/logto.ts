/**
 * Logto Webhook Handlers
 *
 * This file provides HTTP endpoints (via Convex httpRouter) to handle Logto webhook events.
 * These webhooks receive events from Logto and sync changes to Convex.
 *
 * PRD Reference:
 * - Section 6: "Incoming Webhook (Logto -> Convex)" - Lines 208-211
 * - Appendix B: "Sync Triggers" - Lines 438-443
 *
 * Supported Event Types:
 * - user.created: Create new user in Convex
 * - user.updated: Update user profile in Convex
 * - user.roles.updated: Sync role changes to Convex
 *
 * @module convex/webhooks/logto
 */

// eslint-disable @typescript-eslint/ban-types -- Convex http handlers have specific types
/* eslint-disable @typescript-eslint/no-explicit-any -- Convex ctx type is not easily typed */

import { httpRouter } from 'convex/server';
import { api } from '../_generated/api';

/**
 * ============================================================================
 * TYPES AND INTERFACES
 * ============================================================================
 */

/**
 * Common webhook payload structure from Logto
 */
interface LogtoWebhookPayload {
  /** Event type (e.g., 'user.created', 'user.updated') */
  event: string;
  /** Logto subject ID of the user */
  userId: string;
  /** Timestamp of the event */
  timestamp: string;
  /** Additional event-specific data */
  data?: unknown;
}

/**
 * User data payload for user.created and user.updated events
 */
interface LogtoUserData {
  sub: string;
  email?: string;
  name?: string;
  username?: string;
  picture?: string;
  phone?: string;
  emailVerified?: boolean;
}

/**
 * Role data payload for user.roles.updated event
 */
interface LogtoRolesData {
  sub: string;
  /** Array of role IDs or names */
  roleIds?: string[];
  /** Array of role objects with details */
  roles?: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

/**
 * ============================================================================
 * WEBHOOK VERIFICATION
 * ============================================================================
 */

/**
 * Verify webhook signature
 *
 * Logto signs webhook payloads with a secret. We verify the signature
 * to ensure the webhook is genuinely from Logto.
 *
 * @param body - The raw request body as string
 * @param signature - The signature from the X-Logto-Signature header
 * @returns Promise resolving to true if signature is valid, false otherwise
 */
async function verifyWebhookSignature(
  body: string,
  signature: string
): Promise<boolean> {
  const webhookSecret = process.env.LOGTO_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('LOGTO_WEBHOOK_SECRET not set, skipping signature verification');
    // In production, this should throw an error instead of returning true
    return true;
  }

  if (!signature) {
    return false;
  }

  try {
    // Create HMAC SHA-256 hash of the body
    const crypto = await import('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('base64');

    // Compare signatures with timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * ============================================================================
 * WEBHANDLER HELPERS
 * ============================================================================
 */

/**
 * Parse event data and extract Logto subject ID
 */
async function parseWebhookPayload(request: Request): Promise<LogtoWebhookPayload | null> {
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return null;
    }

    const payload: unknown = await request.json();

    // Basic type guard
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'event' in payload &&
      'userId' in payload
    ) {
      return payload as LogtoWebhookPayload;
    }

    return null;
  } catch (error) {
    console.error('Error parsing webhook payload:', error);
    return null;
  }
}

/**
 * ============================================================================
 * HTTP ROUTER CONFIGURATION
 * ============================================================================
 */

const http = httpRouter();

/**
 * Handle user.created event
 *
 * Creates a new user in Convex when Logto sends a user.created webhook.
 *
 * Webhook payload structure:
 * {
 *   "event": "user.created",
 *   "userId": "<logto-sub>",
 *   "data": {
 *     "email": "user@example.com",
 *     "name": "John Doe",
 *     ...
 *   }
 * }
 */
// Wrap handler to match Convex httpRouter type expectations
const handleUserCreated: Function = async (ctx: any, request: Request) => {
    try {
      // Get raw body for signature verification
      const body = await request.text();

      // Verify webhook signature
      const signature = request.headers.get('x-logto-signature') || '';
      const isValidSignature = await verifyWebhookSignature(body, signature);

      if (!isValidSignature) {
        console.warn('Invalid webhook signature for user.created');
        return new Response('Invalid signature', {
          status: 401,
        });
      }

      // Parse the payload
      const payload = await parseWebhookPayload(request);

      if (!payload) {
        return new Response('Invalid payload', { status: 400 });
      }

      const userData = payload.data as LogtoUserData | undefined;

      if (!userData?.sub) {
        return new Response('Missing user data', { status: 400 });
      }

      // Create the user in Convex
      const userId = await ctx.runMutation(api.users.getOrCreateUser, {
        logtoSub: userData.sub,
        email: userData.email || '',
        name: userData.name || userData.username,
        avatarUrl: userData.picture,
      });

      console.log(`Created user ${userId} from Logto webhook`);

      return new Response(
        JSON.stringify({ success: true, userId: userId.toString() }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Error handling user.created webhook:', error);
      return new Response('Internal server error', { status: 500 });
    }
};

http.route({
  path: '/webhooks/logto/user.created',
  method: 'POST',
  handler: handleUserCreated as any,
});

/**
 * Handle user.updated event
 *
 * Updates user profile in Convex when Logto sends a user.updated webhook.
 *
 * Webhook payload structure:
 * {
 *   "event": "user.updated",
 *   "userId": "<logto-sub>",
 *   "data": {
 *     "email": "updated@example.com",
 *     "name": "Updated Name",
 *     ...
 *   }
 * }
 */
const handleUserUpdated: Function = async (ctx: any, request: Request) => {
    try {
      // Get raw body for signature verification
      const body = await request.text();

      // Verify webhook signature
      const signature = request.headers.get('x-logto-signature') || '';
      const isValidSignature = await verifyWebhookSignature(body, signature);

      if (!isValidSignature) {
        console.warn('Invalid webhook signature for user.updated');
        return new Response('Invalid signature', { status: 401 });
      }

      // Parse the payload
      const payload = await parseWebhookPayload(request);

      if (!payload) {
        return new Response('Invalid payload', { status: 400 });
      }

      const userData = payload.data as LogtoUserData | undefined;

      if (!userData?.sub) {
        return new Response('Missing user data', { status: 400 });
      }

      // Find the user by Logto sub
      const user = await ctx.runQuery(api.users.getUserByLogtoSub, {
        logtoSub: userData.sub,
      });

      if (!user) {
        // User not found, create them
        const userId = await ctx.runMutation(api.users.getOrCreateUser, {
          logtoSub: userData.sub,
          email: userData.email || '',
          name: userData.name || userData.username,
          avatarUrl: userData.picture,
        });

        console.log(`Created user ${userId} from user.updated webhook (user didn't exist)`);

        return new Response(
          JSON.stringify({ success: true, userId: userId.toString() }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Update the user profile
      // Note: getOrCreateUser updates the user if it exists
      await ctx.runMutation(api.users.getOrCreateUser, {
        logtoSub: userData.sub,
        email: userData.email || user.email,
        name: userData.name || userData.username || user.name,
        avatarUrl: userData.picture || user.avatarUrl,
      });

      console.log(`Updated user ${user._id} from Logto webhook`);

      return new Response(
        JSON.stringify({ success: true, userId: user._id.toString() }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Error handling user.updated webhook:', error);
      return new Response('Internal server error', { status: 500 });
    }
};

http.route({
  path: '/webhooks/logto/user.updated',
  method: 'POST',
  handler: handleUserUpdated as any,
});

/**
 * Handle user.roles.updated event
 *
 * Syncs role changes from Logto to Convex when Logto sends a webhook.
 *
 * Webhook payload structure:
 * {
 *   "event": "user.roles.updated",
 *   "userId": "<logto-sub>",
 *   "data": {
 *     "roleIds": ["member", "officer"],
 *     "roles": [...]
 *   }
 * }
 */
const handleRolesUpdated: Function = async (ctx: any, request: Request) => {
    try {
      // Get raw body for signature verification
      const body = await request.text();

      // Verify webhook signature
      const signature = request.headers.get('x-logto-signature') || '';
      const isValidSignature = await verifyWebhookSignature(body, signature);

      if (!isValidSignature) {
        console.warn('Invalid webhook signature for user.roles.updated');
        return new Response('Invalid signature', { status: 401 });
      }

      // Parse the payload
      const payload = await parseWebhookPayload(request);

      if (!payload) {
        return new Response('Invalid payload', { status: 400 });
      }

      const rolesData = payload.data as LogtoRolesData | undefined;

      if (!rolesData) {
        return new Response('Missing roles data', { status: 400 });
      }

      // Extract role names from the payload
      // The payload may have roleIds (array of IDs) or roles (array of role objects)
      const roles = rolesData.roleIds || rolesData.roles?.map((r) => r.name || r.id) || [];

      if (!rolesData.sub) {
        return new Response('Missing user sub', { status: 400 });
      }

      // Find the user by Logto sub
      const user = await ctx.runQuery(api.users.getUserByLogtoSub, {
        logtoSub: rolesData.sub,
      });

      if (!user) {
        console.warn(`User with sub ${rolesData.sub} not found for role update`);
        return new Response('User not found', { status: 404 });
      }

      // Sync the roles to Convex
      const updatedRoles = await ctx.runMutation(api.users.syncRolesFromLogto, {
        userId: user._id,
        roles,
      });

      console.log(`Synced roles for user ${user._id}:`, updatedRoles);

      return new Response(
        JSON.stringify({ success: true, roles: updatedRoles }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Error handling user.roles.updated webhook:', error);
      return new Response('Internal server error', { status: 500 });
    }
};

http.route({
  path: '/webhooks/logto/user.roles.updated',
  method: 'POST',
  handler: handleRolesUpdated as any,
});

/**
 * ============================================================================
 * NAMED EXPORTS FOR INDIVIDUAL HANDLERS
 * ============================================================================
 *
 * These are exported to allow direct import and registration in http.ts
 * or by individual routes as needed.
 */

export const getUserWebhookCreatedByLogto = http;

/**
 * ============================================================================
 * DEFAULT EXPORT
 * ============================================================================
 */

export default http;
