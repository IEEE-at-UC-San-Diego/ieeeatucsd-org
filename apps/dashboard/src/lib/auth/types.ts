/**
 * Authentication system type definitions
 *
 * This file defines all interfaces and types used throughout the authentication system.
 */

/**
 * User entity representing an authenticated user
 * @interface
 */
export interface User {
  /** Unique identifier for the user (Logto sub) */
  id: string;

  /** User's email address */
  email: string;

  /** User's full name */
  name: string;

  /**
   * User's primary role in the system
   * @deprecated Use roles array instead for multi-role support
   */
  role: string;

  /**
   * User's roles from Convex
   * Per PRD Section 6: Multi-role support with Logto/Convex sync
   */
  roles?: string[];
}

/**
 * Login credentials required for authentication
 * @interface
 */
export interface LoginCredentials {
  /** Username or email for login */
  username: string;

  /** Plain text password for authentication */
  password: string;
}

/**
 * Session data stored for an authenticated session
 * @interface
 */
export interface SessionData {
  /** Unique identifier for the session */
  sessionId: string;

  /** Unix timestamp (in milliseconds) when the session expires */
  expiresAt: number;

  /** User ID associated with this session */
  userId: string;
}

/**
 * Adapter interface for authentication providers
 * Implement this interface to create custom authentication adapters
 * @interface
 */
export interface AuthAdapter {
  /**
   * Authenticate a user with their credentials
   * @param credentials - The login credentials (username and password)
   * @returns Promise resolving to the authenticated User
   * @throws {AuthenticationError} When credentials are invalid
   * @throws {ValidationError} When credentials format is invalid
   */
  authenticate(credentials: LoginCredentials): Promise<User>;

  /**
   * Validate an existing session
   * @param sessionId - The session ID to validate
   * @returns Promise resolving to the SessionData if valid
   * @throws {SessionExpiredError} When session is invalid or expired
   */
  validateSession(sessionId: string): Promise<SessionData>;

  /**
   * Refresh an existing session to extend its expiry
   * @param sessionId - The session ID to refresh
   * @returns Promise resolving to the updated SessionData with new expiry
   * @throws {SessionExpiredError} When session cannot be refreshed
   */
  refreshSession(sessionId: string): Promise<SessionData>;

  /**
   * Logout and invalidate a session
   * @param sessionId - The session ID to invalidate
   * @returns Promise that resolves when logout is complete
   */
  logout(sessionId: string): Promise<void>;
}
