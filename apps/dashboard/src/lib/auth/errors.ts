/**
 * Authentication system error classes
 *
 * This file defines custom error classes used throughout the authentication system.
 */

/**
 * Base error class for all authentication-related errors
 * @extends Error
 */
export class AuthError extends Error {
  /**
   * Creates a new AuthError instance
   * @param message - The error message
   */
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';

    // Maintains proper stack trace for where error was thrown (V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthError);
    }
  }
}

/**
 * Error thrown when authentication fails (e.g., invalid credentials during login)
 * @extends AuthError
 */
export class AuthenticationError extends AuthError {
  /**
   * Creates a new AuthenticationError instance
   * @param message - The error message (defaults to 'Authentication failed')
   */
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthenticationError);
    }
  }
}

/**
 * Error thrown when a session is invalid or has expired
 * @extends AuthError
 */
export class SessionExpiredError extends AuthError {
  /**
   * Creates a new SessionExpiredError instance
   * @param message - The error message (defaults to 'Session has expired')
   */
  constructor(message: string = 'Session has expired') {
    super(message);
    this.name = 'SessionExpiredError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SessionExpiredError);
    }
  }
}

/**
 * Error thrown when credentials fail validation (e.g., malformed email, weak password)
 * @extends AuthError
 */
export class ValidationError extends AuthError {
  /**
   * Creates a new ValidationError instance
   * @param message - The error message (defaults to 'Invalid credentials')
   */
  constructor(message: string = 'Invalid credentials') {
    super(message);
    this.name = 'ValidationError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}
