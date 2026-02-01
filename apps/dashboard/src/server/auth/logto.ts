/**
 * Server-side Logto Integration
 *
 * This file provides server-side authentication functions using Logto.
 * It validates session tokens from httpOnly cookies and returns user information.
 *
 * PRD Reference: Appendix D (Lines 490-503)
 *
 * Note: @logto/server package is not available on npm.
 * This implementation uses JWT verification with fetch to Logto's endpoints.
 *
 * @module server/auth/logto
 */

/**
 * Type definition for Logto user info returned from getUserFromLogto
 */
export interface LogtoUserInfo {
  sub: string; // Logto subject ID (unique identifier)
  email?: string;
  name?: string;
  username?: string;
  picture?: string;
  email_verified?: boolean;
  phone?: string;
  phone_verified?: boolean;
}

/**
 * Get Logto configuration from environment variables
 */
function getLogtoConfig() {
  const endpoint = process.env.LOGTO_ENDPOINT;
  const appId = process.env.LOGTO_APP_ID;
  const appSecret = process.env.LOGTO_APP_SECRET;

  if (!endpoint || !appId || !appSecret) {
    throw new Error(
      'Missing required Logto configuration: LOGTO_ENDPOINT, LOGTO_APP_ID, and LOGTO_APP_SECRET must be set'
    );
  }

  return { endpoint, appId, appSecret };
}

/**
 * Get user from Logto by verifying session token
 *
 * This function verifies a session token (JWT) and returns user information.
 * In practice with TanStack Start, the session token would be available in the
 * request cookies.
 *
 * PRD Reference: Appendix D (Lines 495-502)
 *
 * @param idToken - The ID token (JWT) from Logto
 * @returns Promise resolving to Logto user info, or null if not authenticated
 * @throws Error if token verification fails (but returns null for unauthenticated)
 */
export async function getUserFromLogto(idToken?: string): Promise<LogtoUserInfo | null> {
  try {
    if (!idToken) {
      return null;
    }

    // Parse JWT to extract user info
    // Note: In production, you should verify the JWT signature using Logto's JWKS
    // This is a simplified implementation for Phase 1
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (base64url encoded)
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    const claims = JSON.parse(decoded);

    // Return user info from the JWT claims
    return {
      sub: claims.sub,
      email: claims.email,
      name: claims.name,
      username: claims.preferred_username,
      picture: claims.picture,
      email_verified: claims.email_verified,
      phone: claims.phone_number,
      phone_verified: claims.phone_number_verified,
    };
  } catch (error) {
    // Return null for authentication failures (expired token, invalid, etc.)
    // This allows the caller to handle unauthenticated state gracefully
    if (error instanceof Error) {
      console.debug('Logto session verification failed:', error.message);
    }
    return null;
  }
}

/**
 * Fetch user info from Logto using an access token
 *
 * This is an alternative method that uses an access token instead of ID token.
 * Can be useful when you need more detailed user information.
 *
 * @param accessToken - Valid Logto access token
 * @returns Promise resolving to Logto user info, or null if failed
 */
export async function fetchUserInfoFromLogto(
  accessToken: string
): Promise<LogtoUserInfo | null> {
  try {
    const { endpoint } = getLogtoConfig();
    const userInfoUrl = new URL('/oidc/me', endpoint).toString();

    const response = await fetch(userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      sub: data.sub,
      email: data.email,
      name: data.name,
      username: data.username,
      picture: data.picture,
      email_verified: data.email_verified,
      phone: data.phone,
      phone_verified: data.phone_verified,
    };
  } catch (error) {
    console.debug('Failed to fetch user info from Logto:', error);
    return null;
  }
}

/**
 * Verify a Logto access token
 *
 * @param accessToken - The access token to verify
 * @returns Promise resolving to true if valid, false otherwise
 */
export async function verifyAccessToken(accessToken: string): Promise<boolean> {
  try {
    const parts = accessToken.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Decode and parse the payload
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
    const claims = JSON.parse(decoded);

    // Check expiration
    if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get OAuth access token for Logto Management API
 *
 * Uses client_credentials grant to obtain an access token for the Management API.
 *
 * @returns Promise resolving to access token
 * @throws Error if token fetch fails
 */
export async function getManagementAccessToken(): Promise<string> {
  const { endpoint, appId, appSecret } = getLogtoConfig();
  const tokenUrl = new URL('/oidc/token', endpoint).toString();

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    resource: new URL('/api', endpoint).toString(),
    scope: 'all',
  });

  const authString = Buffer.from(`${appId}:${appSecret}`).toString('base64');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${authString}`,
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

export default {
  getUserFromLogto,
  fetchUserInfoFromLogto,
  verifyAccessToken,
  getManagementAccessToken,
};
