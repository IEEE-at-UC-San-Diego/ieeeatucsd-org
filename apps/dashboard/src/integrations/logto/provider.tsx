/**
 * Logto Provider component for authentication
 *
 * This file provides the LogtoProvider wrapper for the dashboard application.
 * Based on the MIGRATION-PRD.md specification for Logto integration.
 */

import { LogtoProvider as LogtoReactProvider } from '@logto/react';
import { logtoConfig } from '@/lib/logto';

interface LogtoProviderProps {
  children: React.ReactNode;
}

/**
 * LogtoProvider wraps the application with Logto authentication context
 * Provides authentication state and methods to all child components
 */
export function LogtoProvider({ children }: LogtoProviderProps) {
  return (
    <LogtoReactProvider config={logtoConfig}>
      {children}
    </LogtoReactProvider>
  );
}

export default LogtoProvider;
