import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { logAuthEvent } from "@/lib/auth/logging";

export const Route = createFileRoute("/signin")({
  component: SignInPage,
});

function SignInPage() {
  const { signIn, isAuthenticated, isLoading, authFailureReason } = useAuth();
  const navigate = useNavigate();
  const reason = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("reason");
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !authFailureReason) {
      navigate({ to: "/overview", replace: true });
    }
  }, [authFailureReason, isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (reason !== "stale-callback" && reason !== "session-init") return;

    const storageKey = `auth-retry:${reason}`;
    if (window.sessionStorage.getItem(storageKey)) return;

    window.sessionStorage.setItem(storageKey, "1");
    logAuthEvent("signin_retry_triggered", { reason });
    signIn();
  }, [reason, signIn]);

  const handleSignIn = () => {
    signIn();
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8 overflow-hidden bg-gray-50">
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/90 backdrop-blur-sm py-10 px-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-gray-900/5 sm:rounded-2xl sm:px-10">
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-6">
              <img
                src="/logos/blue_logo_only.svg"
                alt="IEEE UCSD Logo"
                className="w-24 h-24"
              />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
              Welcome
            </h2>
            <p className="text-sm text-gray-600">
              Sign in to the{" "}
              <span className="font-semibold text-gray-800">
                IEEE Student Branch at UC San Diego
              </span>{" "}
              dashboard
            </p>
            {reason === "session-init" && (
              <p className="mt-3 text-sm text-amber-700">
                Session initialization failed. Please sign in again.
              </p>
            )}
            {reason === "stale-callback" && (
              <p className="mt-3 text-sm text-amber-700">
                Your previous sign-in callback expired. Retrying sign-in now.
              </p>
            )}
          </div>

          <div>
            <Button
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full py-3.5 text-sm font-medium rounded-xl shadow-md"
              size="lg"
            >
              {isLoading && isAuthenticated ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Finishing sign in...
                </>
              ) : (
                "Continue with Google"
              )}
            </Button>
          </div>

          <div className="mt-8 border-t border-gray-100 pt-6">
            <div className="relative flex justify-center text-sm">
              <span className="bg-white/50 px-2 text-gray-500">
                Need access?{" "}
                <a
                  href="mailto:ieee@ucsd.edu"
                  className="font-semibold text-blue-600 hover:text-blue-500"
                >
                  Contact IEEE UCSD
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
