/**
 * React context for authentication state management
 *
 * This file provides the AuthContext for sharing authentication state
 * across the React component tree.
 */

import React from 'react';
import type { User, LoginCredentials } from './types';

/**
 * Authentication context type definition
 * @interface
 */
export interface AuthContextType {
  /** The currently authenticated user, or null if not authenticated */
  user: User | null;

  /** Whether the user is currently authenticated */
  isAuthenticated: boolean;

  /** Whether authentication state is being loaded/initialized */
  isLoading: boolean;

  /**
   * Authenticate a user with credentials
   * @param credentials - The login credentials
   * @returns Promise that resolves when login is complete
   */
  login: (credentials: LoginCredentials) => Promise<void>;

  /**
   * Logout the current user
   * @returns Promise that resolves when logout is complete
   */
  logout: () => Promise<void>;

  /**
   * Refresh the current user data
   * @returns Promise that resolves when refresh is complete
   */
  refreshUser: () => Promise<void>;
}

/**
 * Default context value for fallback scenarios
 * Provides safe default values when context is used outside provider
 */
export const defaultContextValue: AuthContextType = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => {
    console.warn('AuthContext.login called without provider');
  },
  logout: async () => {
    console.warn('AuthContext.logout called without provider');
  },
  refreshUser: async () => {
    console.warn('AuthContext.refreshUser called without provider');
  },
};

/**
 * React context for authentication state
 * Used to share auth state and methods across the component tree
 */
export const AuthContext = React.createContext<AuthContextType | undefined>(
  undefined
);

export default AuthContext;
