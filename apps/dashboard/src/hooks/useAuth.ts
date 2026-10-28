import { useLogto } from "@logto/react";
import { useAction, useQuery } from "convex/react";
import {
	createContext,
	createElement,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { AuthFlow } from "@/lib/auth/AuthFlow";
import { type AuthBootstrapResult, AuthSession } from "@/lib/auth/AuthSession";
import { errorMessage, logAuthEvent } from "@/lib/auth/logging";
import { resolveLogtoRedirectUri } from "@/lib/auth/redirectUri";
import { buildLogtoSignInOptions } from "@/lib/auth/signIn";
import { setAuthTokens } from "@/lib/prefetch/authTokens";
import type { UserRole } from "@/types/roles";
import { api } from "../../convex/_generated/api";

export type { UserRole };
export type AuthFailureReason =
	| "session_mint_failed"
	| "claims_failed"
	| "user_query_timeout"
	| null;

const isServer = typeof window === "undefined";
const AUTH_BOOTSTRAP_TIMEOUT_MS = 15_000;
const REFRESH_INTERVAL_MS = 30_000;
const TOKEN_REFRESH_GRACE_MS = 60_000;
const RECOVERY_REASON = "session-init";

type AuthContextValue = ReturnType<typeof useAuthClient>;

const ssrDefaults = {
	isAuthenticated: false as const,
	isLoading: true as const,
	isAuthResolved: false as const,
	isProvisioningUser: false as const,
	authFailureReason: null as AuthFailureReason,
	user: null,
	userRole: "Member" as UserRole,
	logtoId: null as string | null,
	accessToken: null as string | null,
	convexSessionToken: null as string | null,
	getAuthHeaders: (): Record<string, string> => ({}),
	signIn: () => {},
	signOut: () => {},
};

const AuthContext = createContext<AuthContextValue>(ssrDefaults);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const value = useAuthClient();

	return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
	if (isServer) {
		return ssrDefaults;
	}

	return useContext(AuthContext);
}

function useAuthClient() {
	const {
		isAuthenticated: logtoAuthenticated,
		isLoading: logtoLoading,
		signIn,
		signOut,
		clearAllTokens,
		getIdTokenClaims,
		getAccessToken,
		getIdToken,
	} = useLogto();

	const isAuthenticated = Boolean(logtoAuthenticated);
	const [logtoId, setLogtoId] = useState<string | null>(null);
	const [accessToken, setAccessToken] = useState<string | null>(null);
	const [convexSessionToken, setConvexSessionToken] = useState<string | null>(
		null,
	);
	const [convexSessionExpiresAt, setConvexSessionExpiresAt] = useState<
		number | null
	>(null);
	const [isProvisioningUser, setIsProvisioningUser] = useState(false);
	const [authFailureReason, setAuthFailureReason] =
		useState<AuthFailureReason>(null);
	const lastProvisioningAttemptRef = useRef<string | null>(null);
	const refreshInFlightRef = useRef(false);
	const authInitializedRef = useRef(false);
	const recoveryTriggeredRef = useRef(false);
	const lastResolvedUserRef = useRef<{ logtoId: string; user: unknown } | null>(
		null,
	);
	const upsertUser = useAction(api.users.upsertFromAuth);

	const getIdTokenClaimsRef = useRef(getIdTokenClaims);
	const getAccessTokenRef = useRef(getAccessToken);
	const getIdTokenRef = useRef(getIdToken);
	const clearAllTokensRef = useRef(clearAllTokens);
	getIdTokenClaimsRef.current = getIdTokenClaims;
	getAccessTokenRef.current = getAccessToken;
	getIdTokenRef.current = getIdToken;
	clearAllTokensRef.current = clearAllTokens;

	const applySession = useCallback((session: AuthBootstrapResult) => {
		setLogtoId(session.logtoId);
		setAccessToken(session.accessToken);
		setConvexSessionToken(session.sessionToken);
		setConvexSessionExpiresAt(session.expiresAt);
		setAuthFailureReason(null);
	}, []);

	const getAuthHeaders = useCallback((): Record<string, string> => {
		if (!accessToken) return {};
		return { Authorization: `Bearer ${accessToken}` };
	}, [accessToken]);

	const clearLocalAuthState = useCallback(() => {
		setLogtoId(null);
		setAccessToken(null);
		setConvexSessionToken(null);
		setConvexSessionExpiresAt(null);
		setIsProvisioningUser(false);
		lastProvisioningAttemptRef.current = null;
		refreshInFlightRef.current = false;
		authInitializedRef.current = false;
		lastResolvedUserRef.current = null;
		setAuthTokens(null);
	}, []);

	useEffect(() => {
		if (logtoId && convexSessionToken) {
			setAuthTokens({ logtoId, convexSessionToken });
			return;
		}

		setAuthTokens(null);
	}, [logtoId, convexSessionToken]);

	const markAuthFailure = useCallback(
		(reason: Exclude<AuthFailureReason, null>) => {
			logAuthEvent("auth_marked_failed", { reason });
			setAuthFailureReason(reason);
		},
		[],
	);

	const origin = window.location.origin;
	const resolvedRedirectUri = useMemo(
		() =>
			resolveLogtoRedirectUri(import.meta.env.VITE_LOGTO_REDIRECT_URI, origin),
		[origin],
	);

	const performSignOut = useCallback(() => {
		logAuthEvent("auth_signout_requested");
		clearLocalAuthState();
		setAuthFailureReason(null);
		recoveryTriggeredRef.current = false;
		void signOut(`${origin}/signin`);
	}, [clearLocalAuthState, origin, signOut]);

	const triggerSignIn = useCallback(async () => {
		try {
			await signIn(
				buildLogtoSignInOptions(
					resolvedRedirectUri,
					import.meta.env.VITE_LOGTO_DIRECT_SIGN_IN_TARGET,
				),
			);
		} catch (error) {
			logAuthEvent("auth_signin_failed", {
				error: errorMessage(error),
			});
		}
	}, [resolvedRedirectUri, signIn]);

	const bootstrapSession = useCallback(async () => {
		const [claims, token] = await Promise.all([
			getIdTokenClaims?.(),
			getAccessToken?.(),
		]);
		if (!claims?.sub || !token) {
			throw new Error("Missing Logto claims or access token");
		}

		return AuthSession.load({
			getIdTokenClaims: async () => claims,
			getAccessToken: async () => getAccessToken?.(),
			currentAccessToken: token,
			maxAttempts: 3,
			baseDelayMs: 500,
		});
	}, [getAccessToken, getIdTokenClaims]);

	const refreshSession = useCallback(async () => {
		return AuthSession.load({
			getIdTokenClaims: async () => getIdTokenClaims?.(),
			getAccessToken: async () => getAccessToken?.(),
			maxAttempts: 3,
			baseDelayMs: 750,
		});
	}, [getAccessToken, getIdTokenClaims]);

	useEffect(() => {
		if (!isAuthenticated) {
			clearLocalAuthState();
			setAuthFailureReason(null);
			recoveryTriggeredRef.current = false;
			return;
		}

		if (
			authInitializedRef.current &&
			logtoId &&
			accessToken &&
			convexSessionToken
		) {
			return;
		}

		let cancelled = false;
		void (async () => {
			try {
				const session = await bootstrapSession();
				if (cancelled) return;

				applySession(session);
				authInitializedRef.current = true;
				recoveryTriggeredRef.current = false;
				AuthFlow.clearRecoveryLatches();
				logAuthEvent("auth_bootstrap_succeeded", {
					logtoId: session.logtoId,
					expiresAt: session.expiresAt,
				});
			} catch (error) {
				if (cancelled) return;
				logAuthEvent("auth_bootstrap_failed", {
					error: errorMessage(error),
				});
				markAuthFailure("session_mint_failed");
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [
		accessToken,
		applySession,
		bootstrapSession,
		clearLocalAuthState,
		convexSessionToken,
		isAuthenticated,
		logtoId,
		markAuthFailure,
	]);

	useEffect(() => {
		if (!isAuthenticated || authFailureReason) return;
		const hasCoreSession = !!logtoId && !!accessToken && !!convexSessionToken;
		if (hasCoreSession) return;

		const timeout = window.setTimeout(() => {
			markAuthFailure("session_mint_failed");
		}, AUTH_BOOTSTRAP_TIMEOUT_MS);

		return () => window.clearTimeout(timeout);
	}, [
		isAuthenticated,
		authFailureReason,
		logtoId,
		accessToken,
		convexSessionToken,
		markAuthFailure,
	]);

	useEffect(() => {
		if (
			!isAuthenticated ||
			!accessToken ||
			!convexSessionToken ||
			authFailureReason
		)
			return;

		const timer = window.setInterval(() => {
			const shouldRefresh =
				!convexSessionExpiresAt ||
				Date.now() + TOKEN_REFRESH_GRACE_MS >= convexSessionExpiresAt;
			if (!shouldRefresh || refreshInFlightRef.current) return;

			refreshInFlightRef.current = true;
			void (async () => {
				try {
					const nextSession = await refreshSession();
					applySession(nextSession);
					AuthFlow.clearRecoveryLatches();
					logAuthEvent("auth_refresh_succeeded", {
						logtoId: nextSession.logtoId,
						expiresAt: nextSession.expiresAt,
					});
				} catch (error) {
					const isExpired =
						!convexSessionExpiresAt || Date.now() >= convexSessionExpiresAt;
					logAuthEvent("auth_refresh_failed", {
						isExpired,
						error: errorMessage(error),
					});
				} finally {
					refreshInFlightRef.current = false;
				}
			})();
		}, REFRESH_INTERVAL_MS);

		return () => window.clearInterval(timer);
	}, [
		accessToken,
		applySession,
		authFailureReason,
		convexSessionExpiresAt,
		convexSessionToken,
		isAuthenticated,
		refreshSession,
	]);

	const convexUser = useQuery(
		api.users.getMe,
		isAuthenticated && logtoId && convexSessionToken
			? { logtoId, authToken: convexSessionToken }
			: "skip",
	);

	const stableAuthUser = AuthFlow.resolveStableUser({
		logtoId,
		convexUser,
		lastResolvedUser: lastResolvedUserRef.current as {
			logtoId: string;
			user: NonNullable<typeof convexUser>;
		} | null,
	});

	lastResolvedUserRef.current = stableAuthUser.lastResolvedUser;
	const stableConvexUser = stableAuthUser.user as typeof convexUser;

	useEffect(() => {
		if (!isAuthenticated || authFailureReason) return;
		if (!logtoId || !accessToken || !convexSessionToken) return;
		if (stableConvexUser !== undefined) return;

		const timeout = window.setTimeout(() => {
			markAuthFailure("user_query_timeout");
		}, 12_000);

		return () => window.clearTimeout(timeout);
	}, [
		isAuthenticated,
		authFailureReason,
		logtoId,
		accessToken,
		convexSessionToken,
		stableConvexUser,
		markAuthFailure,
	]);

	useEffect(() => {
		if (authFailureReason) {
			setIsProvisioningUser(false);
			return;
		}

		if (
			!AuthFlow.shouldAttemptProvisioning({
				isAuthenticated,
				logtoId,
				convexSessionToken,
				convexUser: stableConvexUser,
				lastProvisioningAttemptLogtoId: lastProvisioningAttemptRef.current,
			})
		) {
			setIsProvisioningUser(false);
			return;
		}

		lastProvisioningAttemptRef.current = logtoId!;
		setIsProvisioningUser(true);

		let cancelled = false;
		void (async () => {
			try {
				const claims = await getIdTokenClaimsRef.current?.();
				const idToken = await getIdTokenRef.current?.();

				if (!claims?.sub || !idToken) {
					throw new Error(
						"Missing claims or ID token during user provisioning",
					);
				}

				await upsertUser({
					authToken: idToken,
					name: (claims as { name?: string }).name || claims.sub,
					avatar: (claims as { picture?: string }).picture,
					signInMethod: "logto",
				});
			} catch (error) {
				logAuthEvent("auth_provision_failed", {
					logtoId,
					error: errorMessage(error),
				});
			} finally {
				if (!cancelled) {
					setIsProvisioningUser(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [
		accessToken,
		authFailureReason,
		convexSessionToken,
		stableConvexUser,
		isAuthenticated,
		logtoId,
		upsertUser,
	]);

	useEffect(() => {
		if (!authFailureReason || recoveryTriggeredRef.current) return;

		recoveryTriggeredRef.current = true;
		void (async () => {
			logAuthEvent("auth_recovery_started", {
				reason: authFailureReason,
			});

			// Keep Logto tokens only when the refresh token still works
			// (Convex-side failure). If Logto refresh is dead ("Grant request
			// is invalid"), clear storage so the next sign-in is clean.
			let refreshStillValid = false;
			try {
				const token = await getAccessTokenRef.current?.();
				refreshStillValid = Boolean(token);
			} catch (error) {
				logAuthEvent("auth_recovery_refresh_probe_failed", {
					reason: authFailureReason,
					error: errorMessage(error),
				});
			}

			const recoveryAction = AuthFlow.resolveRecoveryAction(refreshStillValid);
			logAuthEvent("auth_recovery_action", {
				reason: authFailureReason,
				recoveryAction,
			});

			if (recoveryAction !== "soft_rebootstrap") {
				try {
					await clearAllTokensRef.current?.();
				} catch (error) {
					logAuthEvent("auth_recovery_clear_tokens_failed", {
						reason: authFailureReason,
						error: errorMessage(error),
					});
				}
			}

			clearLocalAuthState();
			const url = new URL(`${origin}/signin`);
			url.searchParams.set("reason", RECOVERY_REASON);
			window.location.replace(url.toString());
		})();
	}, [authFailureReason, clearLocalAuthState, origin]);

	const userRole: UserRole = (stableConvexUser?.role as UserRole) ?? "Member";
	const hasProvisioningAttempt =
		!!logtoId && lastProvisioningAttemptRef.current === logtoId;
	const { isAuthResolved, isLoading } = AuthFlow.resolveState({
		logtoLoading,
		isAuthenticated,
		logtoId,
		accessToken,
		convexSessionToken,
		convexUser: stableConvexUser,
		isProvisioningUser,
		hasProvisioningAttempt,
		authFailureReason,
	});

	return useMemo(
		() => ({
			isAuthenticated,
			isLoading,
			isAuthResolved,
			isProvisioningUser,
			authFailureReason,
			user: stableConvexUser ?? null,
			userRole,
			logtoId,
			accessToken,
			convexSessionToken,
			getAuthHeaders,
			signIn: () => {
				void triggerSignIn();
			},
			signOut: () => performSignOut(),
		}),
		[
			accessToken,
			authFailureReason,
			convexSessionToken,
			stableConvexUser,
			getAuthHeaders,
			isAuthenticated,
			isAuthResolved,
			isLoading,
			isProvisioningUser,
			logtoId,
			performSignOut,
			triggerSignIn,
			userRole,
		],
	);
}
