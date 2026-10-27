import { api } from "@convex/_generated/api";
import { useHandleSignInCallback, useLogto } from "@logto/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AuthFlow } from "@/lib/auth/AuthFlow";
import { AuthSession } from "@/lib/auth/AuthSession";
import {
	createAuthRequestId,
	errorMessage,
	logAuthEvent,
} from "@/lib/auth/logging";

export const Route = createFileRoute("/callback")({
	component: CallbackPage,
});

const isServer = typeof window === "undefined";

function CallbackPage() {
	// During SSR, Logto hooks are unavailable. Show a loading spinner
	// and let the client handle the actual callback processing.
	if (isServer) {
		return <CallbackLoading />;
	}

	return <CallbackClient />;
}

function CallbackLoading({ label = "Signing you in..." }: { label?: string }) {
	return (
		<div className="flex min-h-dvh items-center justify-center bg-background px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
			<div className="text-center">
				<Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
				<p className="text-muted-foreground">{label}</p>
			</div>
		</div>
	);
}

function CallbackClient() {
	const { getIdTokenClaims, getAccessToken, clearAllTokens } = useLogto();
	const upsertUser = useMutation(api.users.upsertFromAuth);
	const navigate = useNavigate();
	const upsertStarted = useRef(false);
	const [finalizeInProgress, setFinalizeInProgress] = useState(false);

	// Note: useHandleSignInCallback's callback is NOT async-aware (type is () => void).
	// useHandleSignInCallback's isLoading becomes false before our async finalize + navigate
	// finish — track finalizeInProgress so we never render an empty screen during that gap.
	const { isLoading } = useHandleSignInCallback(() => {
		if (upsertStarted.current) return;
		upsertStarted.current = true;
		setFinalizeInProgress(true);
		const requestId = createAuthRequestId("callback");
		logAuthEvent("callback_finalize_started", { requestId });

		void AuthFlow.finalizeSignIn({
			getIdTokenClaims: getIdTokenClaims as any,
			getAccessToken: getAccessToken as any,
			createSession: async (accessToken: string) =>
				AuthSession.mintBridgeToken(accessToken, "callback"),
			upsertUser,
		})
			.then(async (targetRoute) => {
				logAuthEvent("callback_finalize_succeeded", { requestId, targetRoute });
				await navigate({ to: targetRoute });
			})
			.catch((err: unknown) => {
				logAuthEvent("callback_finalize_failed", {
					requestId,
					error: errorMessage(err),
				});
				return navigate({ to: "/signin" });
			})
			.finally(() => {
				setFinalizeInProgress(false);
			});
	});

	// Logto finished without invoking the handler (bad state / direct /callback hit)
	useEffect(() => {
		if (isLoading || finalizeInProgress) return;
		if (upsertStarted.current) return;
		const id = window.setTimeout(() => {
			if (!upsertStarted.current) {
				logAuthEvent("callback_stale_detected");
				void (async () => {
					try {
						await clearAllTokens?.();
					} catch (error) {
						logAuthEvent("callback_stale_clear_tokens_failed", {
							error: errorMessage(error),
						});
					} finally {
						window.location.replace("/signin?reason=stale-callback");
					}
				})();
			}
		}, 4000);
		return () => window.clearTimeout(id);
	}, [clearAllTokens, finalizeInProgress, isLoading, navigate]);

	const label =
		isLoading && !upsertStarted.current
			? "Signing you in..."
			: "Finishing sign in...";

	// Keep a visible shell until navigation unmounts us; never return null.
	if (isLoading || finalizeInProgress || upsertStarted.current) {
		return <CallbackLoading label={label} />;
	}

	return <CallbackLoading label="Finishing sign in..." />;
}
