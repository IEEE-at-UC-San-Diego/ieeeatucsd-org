/**
 * OAuth Callback Route
 *
 * Handles the OAuth redirect from Logto after authentication.
 * This route processes the authentication response and redirects
 * the user to the appropriate destination.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';
import { useLogto } from '@logto/react';
import { useEffect } from 'react';

export const Route = createFileRoute('/callback')({
  component: CallbackHandler,
});

function CallbackHandler() {
  const { isLoading, isAuthenticated, error } = useLogto();

  useEffect(() => {
    // Handle the callback - Logto SDK automatically processes the URL
    // The useLogto hook will handle the authentication state
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-900 dark:border-neutral-800 dark:border-t-neutral-100" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Completing sign in...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-md p-6 space-y-4">
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold leading-none tracking-tight text-red-600 dark:text-red-400">
              Authentication Error
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              There was a problem signing you in. Please try again.
            </p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">
              {error.message}
            </p>
          </div>
          <a
            href="/"
            className="inline-flex items-center justify-center w-full h-9 px-4 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200 transition-colors rounded-md"
          >
            Return to Home
          </a>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    // Check if there's a stored redirect path
    const storedRedirect = sessionStorage.getItem('auth_redirect_after_login');
    if (storedRedirect) {
      sessionStorage.removeItem('auth_redirect_after_login');
      window.location.href = storedRedirect;
      return null;
    }

    // Default redirect to home
    window.location.href = '/';
    return null;
  }

  // If not authenticated and no error, something went wrong
  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-md p-6 space-y-4">
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold leading-none tracking-tight">
            Sign In Incomplete
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            The sign in process was not completed. Please try again.
          </p>
        </div>
        <a
          href="/"
          className="inline-flex items-center justify-center w-full h-9 px-4 text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200 transition-colors rounded-md"
        >
          Return to Home
        </a>
      </div>
    </div>
  );
}
