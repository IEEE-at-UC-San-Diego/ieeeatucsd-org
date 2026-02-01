/**
 * AuthProvider component for authentication system
 *
 * This file provides the main AuthProvider component that manages authentication
 * state using Logto as the backing implementation.
 * Updated for Logto integration per MIGRATION-PRD.md
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLogto, UserInfoResponse } from '@logto/react';
import type { User, LoginCredentials, SessionData, AuthAdapter } from './types';
import { AuthContext, defaultContextValue } from './AuthContext';
import { createStorageAdapter, StorageAdapter } from './storage';
import { AuthenticationError, SessionExpiredError } from './errors';
import { STORAGE_KEY, SESSION_TIMEOUT, REFRESH_THRESHOLD } from './constants';

/**
 * Map Logto user info to our User type
 */
function mapLogtoUser(logtoUser: UserInfoResponse | undefined): User | null {
  if (!logtoUser) return null;

  return {
    id: logtoUser.sub,
    email: logtoUser.email ?? '',
    name: logtoUser.name ?? logtoUser.username ?? '',
    role: 'member', // Default role, will be enhanced with Convex role data
  };
}

/**
 * Props for the AuthProvider component
 * @interface
 */
export interface AuthProviderProps {
  /** Child components to be wrapped by the provider */
  children: React.ReactNode;

  /** Optional custom authentication adapter (not used with Logto) */
  authAdapter?: AuthAdapter;
}

/**
 * AuthProvider component that manages authentication state using Logto
 * and provides auth context to child components
 * @param props - The component props
 * @returns React component wrapping children with auth context
 */
export function AuthProvider({
  children,
}: AuthProviderProps): React.ReactElement {
  const { isAuthenticated, isLoading: logtoLoading, signOut, fetchUserInfo } = useLogto();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Create storage adapter based on environment (local for client, memory for SSR)
  const storage: StorageAdapter = createStorageAdapter(
    typeof window !== 'undefined' ? 'local' : 'memory'
  );

  /**
   * Fetch user info when authenticated state changes
   */
  useEffect(() => {
    const initializeAuth = async (): Promise<void> => {
      try {
        if (isAuthenticated && !logtoLoading) {
          const userInfo = await fetchUserInfo();
          const mappedUser = mapLogtoUser(userInfo);
          setUser(mappedUser);

          // Store basic session info for compatibility
          const session: SessionData = {
            sessionId: `logto_${userInfo?.sub}_${Date.now()}`,
            expiresAt: Date.now() + SESSION_TIMEOUT,
            userId: userInfo?.sub ?? '',
          };
          storage.set(STORAGE_KEY, session);
        } else if (!isAuthenticated) {
          setUser(null);
          storage.remove(STORAGE_KEY);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to initialize auth')
        );
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [isAuthenticated, logtoLoading, fetchUserInfo, storage]);

  /**
   * Authenticate a user with credentials
   * @param credentials - The login credentials
   * @deprecated Use Logto's signIn() directly - Logto uses OAuth redirect flow
   */
  const login = useCallback(
    async (_credentials: LoginCredentials): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        // Logto uses OAuth redirect, not credentials-based login
        // This is a compatibility shim that provides a clear error message
        throw new Error(
          'Direct login with credentials is not supported with Logto. ' +
            'Use the signIn button from useLogto() hook instead.'
        );
      } catch (err) {
        const error =
          err instanceof Error ? err : new AuthenticationError('Login failed');
        setError(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Logout the current user
   */
  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);

    try {
      const redirectUri = typeof window !== 'undefined' ? window.location.origin : '/';
      await signOut(redirectUri);

      // Clear storage and state
      storage.remove(STORAGE_KEY);
      setUser(null);
      setError(null);
    } catch (err) {
      // Even if logout fails on server, clear local state
      storage.remove(STORAGE_KEY);
      setUser(null);

      const error =
        err instanceof Error ? err : new Error('Logout failed');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [signOut, storage]);

  /**
   * Refresh the current user data and validate session
   */
  const refreshUser = useCallback(async (): Promise<void> => {
    const session = storage.get<SessionData>(STORAGE_KEY);

    if (!session) {
      setUser(null);
      throw new SessionExpiredError('No active session');
    }

    try {
      const userInfo = await fetchUserInfo();
      const mappedUser = mapLogtoUser(userInfo);
      setUser(mappedUser);

      // Update session expiry
      const updatedSession: SessionData = {
        ...session,
        expiresAt: Date.now() + SESSION_TIMEOUT,
      };
      storage.set(STORAGE_KEY, updatedSession);
    } catch (err) {
      storage.remove(STORAGE_KEY);
      setUser(null);
      throw err instanceof Error ? err : new SessionExpiredError();
    }
  }, [fetchUserInfo, storage]);

  const contextValue = {
    user,
    isAuthenticated,
    isLoading: isLoading || logtoLoading,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
