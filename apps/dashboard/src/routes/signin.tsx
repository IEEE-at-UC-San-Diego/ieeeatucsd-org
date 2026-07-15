import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
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
		<div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ds-background-200 px-4 py-12 sm:px-6 lg:px-8">
			<div className="relative z-10 w-full max-w-md">
				<div className="rounded-md border bg-card px-6 py-10 shadow-raised sm:px-10">
					<div className="mb-8 text-center">
						<div className="mb-6 flex justify-center">
							<img
								src="/logos/blue_logo_only.svg"
								alt="IEEE UCSD Logo"
								className="h-20 w-20"
							/>
						</div>
						<h1 className="mb-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
							Welcome
						</h1>
						<p className="text-sm leading-5 text-muted-foreground">
							Sign in to the{" "}
							<span className="font-medium text-foreground">
								IEEE Student Branch at UC San Diego
							</span>{" "}
							dashboard
						</p>
						{reason === "session-init" && (
							<p className="mt-3 text-sm text-ds-amber-900">
								Session initialization failed. Sign in again.
							</p>
						)}
						{reason === "stale-callback" && (
							<p className="mt-3 text-sm text-ds-amber-900">
								Your previous sign-in callback expired. Retrying sign-in now.
							</p>
						)}
					</div>

					<div>
						<Button
							onClick={handleSignIn}
							disabled={isLoading}
							className="w-full"
							size="lg"
						>
							{isLoading && isAuthenticated ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Signing In…
								</>
							) : (
								"Continue with Google"
							)}
						</Button>
					</div>

					<div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
						Need access?{" "}
						<a
							href="mailto:ieee@ucsd.edu"
							className="font-medium text-ds-blue-700 hover:underline"
						>
							Contact IEEE UCSD
						</a>
					</div>
				</div>
			</div>
		</div>
	);
}
