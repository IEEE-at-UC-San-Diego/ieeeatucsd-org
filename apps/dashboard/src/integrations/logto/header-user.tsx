/**
 * Logto Header User Component
 *
 * Displays user authentication state and sign in/out buttons in the header.
 * Replaces the Better Auth header component.
 */

import { useLogto } from '@logto/react';
import { Link } from '@tanstack/react-router';
import { getRedirectUri } from '@/lib/logto';

export default function LogtoHeader() {
  const { isAuthenticated, isLoading, signIn, signOut, fetchUserInfo } = useLogto();

  if (isLoading) {
    return (
      <div className="h-8 w-8 bg-neutral-100 dark:bg-neutral-800 animate-pulse rounded-full" />
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => signOut(window.location.origin)}
          className="flex-1 h-9 px-4 text-sm font-medium bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors rounded-md"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn(getRedirectUri())}
      className="h-9 px-4 text-sm font-medium bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors inline-flex items-center rounded-md"
    >
      Sign in
    </button>
  );
}
