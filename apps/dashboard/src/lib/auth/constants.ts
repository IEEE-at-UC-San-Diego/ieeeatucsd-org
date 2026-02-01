/**
 * Authentication system constants
 *
 * This file contains all constant values used throughout the authentication system.
 */

/**
 * Storage key for session data in localStorage/sessionStorage
 * @constant
 */
export const STORAGE_KEY = 'ieee_auth_session' as const;

/**
 * Session timeout in milliseconds (24 hours)
 * @constant
 */
export const SESSION_TIMEOUT = 86400000 as const;

/**
 * Refresh threshold in milliseconds before session expiry (5 minutes)
 * Sessions should be refreshed when within this threshold of expiring
 * @constant
 */
export const REFRESH_THRESHOLD = 300000 as const;
