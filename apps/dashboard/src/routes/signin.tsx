/**
 * Signin page
 *
 * Redirects to Logto OAuth flow for authentication.
 * After successful auth, user is redirected to /callback.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useLogto } from "@logto/react";

export const Route = createFileRoute("/signin")({
  component: SigninPage,
});

function SigninPage() {
  const { signIn, isAuthenticated, isLoading } = useLogto();

  // Redirect if already authenticated
  if (!isLoading && isAuthenticated) {
    redirect({ to: "/overview" });
  }

  // Trigger sign in
  const handleSignIn = () => {
    const redirectUri = `${window.location.origin}/callback`;
    signIn(redirectUri);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex w-full max-w-md flex-col items-center space-y-4 p-8">
        <div className="flex items-center gap-3">
          <img
            src="/logos/blue_logo_only.svg"
            alt="IEEE UCSD"
            className="h-16 w-16"
          />
          <h1 className="text-3xl font-bold text-foreground">IEEE UCSD</h1>
        </div>

        <div className="w-full max-w-sm space-y-4">
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold">Sign in to your account</h2>
            <p className="text-sm text-muted-foreground">
              Enter your email to sign in to the dashboard
            </p>
          </div>

          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Sign in with Logto"}
          </button>
        </div>
      </div>
    </div>
  );
}
