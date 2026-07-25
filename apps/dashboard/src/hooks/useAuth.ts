import { useLogto } from "@logto/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
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
import {
	resolveAuthState,
	resolveStableAuthUser,
	shouldAttemptProvisioning,
} from "@/lib/auth/authState";
import {
	createAuthRequestId,
	errorMessage,
	logAuthEvent,
} from "@/lib/auth/logging";
import { isNativeAuthBridgeMode } from "@/lib/auth/mode";
import { loadNativeSession } from "@/lib/auth/nativeSession";
import { refreshSessionWithRetry } from "@/lib/auth/sessionRefresh";
import { buildLogtoSignInOptions, type SignInOptions } from "@/lib/auth/signIn";
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
const SESSION_MINT_TIMEOUT_MS = 10_000;
const AUTH_BOOTSTRAP_TIMEOUT_MS = 15_000;
const REFRESH_INTERVAL_MS = 30_000;
const TOKEN_REFRESH_GRACE_MS = 60_000;
const RECOVERY_REASON = "session-init";

type AuthContextValue = ReturnType<typeof useAuthClient>;

type AuthBootstrapResult = {
	logtoId: string;
	accessToken: string;
	sessionToken: string;
	expiresAt: number;
};

function resolveLogtoRedirectUri(
	redirectUri: string | undefined,
	origin: string,
): string {
	const trimmedRedirectUri = redirectUri?.trim();

	if (!trimmedRedirectUri) {
		return `${origin}/callback`;
	}

	try {
		const configuredUrl = new URL(trimmedRedirectUri, origin);

		if (configuredUrl.origin === origin) {
			return configuredUrl.toString();
		}

		if (
			configuredUrl.hostname.includes("localhost") &&
			!window.location.hostname.includes("localhost")
		) {
			return `${origin}/callback`;
		}

		return configuredUrl.toString();
	} catch {
		return `${origin}/callback`;
	}
}

async function fetchWithTimeout(
	input: RequestInfo | URL,
	init: RequestInit,
	timeoutMs: number,
) {
	const controller = new AbortController();
	const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await fetch(input, { ...init, signal: controller.signal });
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			throw new Error(`Request timed out after ${timeoutMs}ms`);
		}
		throw error;
	} finally {
		window.clearTimeout(timeout);
	}
}

async function retryAsync<T>(
	task: () => Promise<T>,
	maxAttempts = 3,
	baseDelayMs = 750,
) {
	let lastError: unknown;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			return await task();
		} catch (error) {
			lastError = error;
			if (attempt < maxAttempts) {
				await new Promise((resolve) =>
					window.setTimeout(resolve, baseDelayMs * attempt),
				);
			}
		}
	}

	throw lastError ?? new Error("Operation failed");
}

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
	if (isNativeAuthBridgeMode()) {
		return useNativeAuthClient();
	}

	return useLegacyAuthClient();
}

function useSharedAuthClient(options: {
	logtoLoading: boolean;
	isAuthenticated: boolean;
	signIn: (options: SignInOptions) => Promise<unknown>;
	signOut: (redirectUri?: string) => Promise<void>;
	clearAllTokens?: () => Promise<void>;
	getIdTokenClaims?: () => Promise<Record<string, any> | null | undefined>;
	getAccessToken?: () => Promise<string | null | undefined>;
	bootstrapSession: () => Promise<AuthBootstrapResult>;
	refreshSession: (current: {
		accessToken: string;
		sessionToken: string;
		expiresAt: number | null;
		logtoId: string | null;
	}) => Promise<AuthBootstrapResult>;
	mode: "legacy" | "native";
}) {
	const {
		logtoLoading,
		isAuthenticated,
		signIn,
		signOut,
		clearAllTokens,
		getIdTokenClaims,
		getAccessToken,
		bootstrapSession,
		refreshSession,
		mode,
	} = options;

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
	const upsertUser = useMutation(api.users.upsertFromAuth);

	const getIdTokenClaimsRef = useRef(getIdTokenClaims);
	const getAccessTokenRef = useRef(getAccessToken);
	const clearAllTokensRef = useRef(clearAllTokens);
	getIdTokenClaimsRef.current = getIdTokenClaims;
	getAccessTokenRef.current = getAccessToken;
	clearAllTokensRef.current = clearAllTokens;

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
			logAuthEvent("auth_marked_failed", { reason, mode });
			setAuthFailureReason(reason);
		},
		[mode],
	);

	const origin = window.location.origin;
	const resolvedRedirectUri = useMemo(
		() =>
			resolveLogtoRedirectUri(import.meta.env.VITE_LOGTO_REDIRECT_URI, origin),
		[origin],
	);

	const performSignOut = useCallback(() => {
		logAuthEvent("auth_signout_requested", { mode });
		clearLocalAuthState();
		setAuthFailureReason(null);
		recoveryTriggeredRef.current = false;
		void signOut(`${origin}/signin`);
	}, [clearLocalAuthState, mode, origin, signOut]);

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
				mode,
				error: errorMessage(error),
			});
		}
	}, [mode, resolvedRedirectUri, signIn]);

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

				setLogtoId(session.logtoId);
				setAccessToken(session.accessToken);
				setConvexSessionToken(session.sessionToken);
				setConvexSessionExpiresAt(session.expiresAt);
				setAuthFailureReason(null);
				authInitializedRef.current = true;
				recoveryTriggeredRef.current = false;
				logAuthEvent("auth_bootstrap_succeeded", {
					mode,
					logtoId: session.logtoId,
					expiresAt: session.expiresAt,
				});
			} catch (error) {
				if (cancelled) return;
				logAuthEvent("auth_bootstrap_failed", {
					mode,
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
		authFailureReason,
		bootstrapSession,
		clearLocalAuthState,
		convexSessionToken,
		isAuthenticated,
		logtoId,
		markAuthFailure,
		mode,
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
					const nextSession = await refreshSession({
						accessToken,
						sessionToken: convexSessionToken,
						expiresAt: convexSessionExpiresAt,
						logtoId,
					});

					setLogtoId(nextSession.logtoId);
					setAccessToken(nextSession.accessToken);
					setConvexSessionToken(nextSession.sessionToken);
					setConvexSessionExpiresAt(nextSession.expiresAt);
					setAuthFailureReason(null);
					logAuthEvent("auth_refresh_succeeded", {
						mode,
						logtoId: nextSession.logtoId,
						expiresAt: nextSession.expiresAt,
					});
				} catch (error) {
					const isExpired =
						!convexSessionExpiresAt || Date.now() >= convexSessionExpiresAt;
					logAuthEvent("auth_refresh_failed", {
						mode,
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
		authFailureReason,
		convexSessionExpiresAt,
		convexSessionToken,
		isAuthenticated,
		logtoId,
		mode,
		refreshSession,
	]);

	const convexUser = useQuery(
		api.users.getMe,
		isAuthenticated && logtoId && convexSessionToken
			? { logtoId, authToken: convexSessionToken }
			: "skip",
	);

	const stableAuthUser = resolveStableAuthUser({
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
			!shouldAttemptProvisioning({
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
				const token = accessToken ?? (await getAccessTokenRef.current?.());

				if (!claims?.sub || !token || !convexSessionToken) {
					throw new Error(
						"Missing claims, access token, or auth token during user provisioning",
					);
				}

				await upsertUser({
					logtoId: claims.sub,
					authToken: convexSessionToken,
					email: (claims as any).email || "",
					name: (claims as any).name || claims.sub,
					avatar: (claims as any).picture,
					signInMethod: "logto",
				});
			} catch (error) {
				logAuthEvent("auth_provision_failed", {
					mode,
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
		mode,
		upsertUser,
	]);

	useEffect(() => {
		if (!authFailureReason || recoveryTriggeredRef.current) return;

		recoveryTriggeredRef.current = true;
		void (async () => {
			logAuthEvent("auth_recovery_started", {
				mode,
				reason: authFailureReason,
			});

			// Native mode keeps the Logto refresh token in localStorage so the
			// user stays signed in across reloads (Gmail/Amazon-style). Only the
			// in-memory Convex bridge state is cleared; IdP logout is explicit.
			if (mode === "native") {
				clearLocalAuthState();
				const url = new URL(`${origin}/signin`);
				url.searchParams.set("reason", RECOVERY_REASON);
				window.location.replace(url.toString());
				return;
			}

			try {
				await clearAllTokensRef.current?.();
			} catch (error) {
				logAuthEvent("auth_recovery_clear_tokens_failed", {
					mode,
					reason: authFailureReason,
					error: errorMessage(error),
				});
			} finally {
				clearLocalAuthState();
				const url = new URL(`${origin}/signin`);
				url.searchParams.set("reason", RECOVERY_REASON);
				window.location.replace(url.toString());
			}
		})();
	}, [authFailureReason, clearLocalAuthState, mode, origin]);

	const userRole: UserRole = (stableConvexUser?.role as UserRole) ?? "Member";
	const hasProvisioningAttempt =
		!!logtoId && lastProvisioningAttemptRef.current === logtoId;
	const { isAuthResolved, isLoading } = resolveAuthState({
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

function useLegacyAuthClient() {
	const {
		isAuthenticated,
		isLoading,
		signIn,
		signOut,
		clearAllTokens,
		getIdTokenClaims,
		getAccessToken,
	} = useLogto();

	const mintConvexSession = useCallback(async (token: string) => {
		const requestId = createAuthRequestId("legacy_session");
		logAuthEvent("legacy_session_mint_started", { requestId });

		const response = await fetchWithTimeout(
			"/api/auth/convex-session",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
					"X-Auth-Request-Id": requestId,
				},
				body: JSON.stringify({}),
			},
			SESSION_MINT_TIMEOUT_MS,
		);

		if (!response.ok) {
			throw new Error(`Failed to mint Convex session (${response.status})`);
		}

		const data = (await response.json()) as {
			sessionToken: string;
			expiresAt: number;
		};
		logAuthEvent("legacy_session_mint_succeeded", {
			requestId,
			expiresAt: data.expiresAt,
		});
		return data;
	}, []);

	const bootstrapSession =
		useCallback(async (): Promise<AuthBootstrapResult> => {
			const [claims, token] = await Promise.all([
				getIdTokenClaims?.(),
				getAccessToken?.(),
			]);

			if (!claims?.sub || !token) {
				throw new Error("Missing Logto claims or access token");
			}

			const { session, accessToken } = await refreshSessionWithRetry({
				currentAccessToken: token,
				getLatestAccessToken: async () => getAccessToken?.(),
				mintSession: mintConvexSession,
				maxAttempts: 3,
				baseDelayMs: 500,
			});

			return {
				logtoId: claims.sub,
				accessToken,
				sessionToken: session.sessionToken,
				expiresAt: session.expiresAt,
			};
		}, [getAccessToken, getIdTokenClaims, mintConvexSession]);

	const refreshSession = useCallback(
		async (current: {
			accessToken: string;
			sessionToken: string;
			expiresAt: number | null;
			logtoId: string | null;
		}): Promise<AuthBootstrapResult> => {
			const claims = await getIdTokenClaims?.();
			if (!claims?.sub) {
				throw new Error("Missing Logto claims");
			}

			const { session, accessToken } = await refreshSessionWithRetry({
				currentAccessToken: current.accessToken,
				getLatestAccessToken: async () => getAccessToken?.(),
				mintSession: mintConvexSession,
				maxAttempts: 3,
				baseDelayMs: 750,
			});

			return {
				logtoId: claims.sub,
				accessToken,
				sessionToken: session.sessionToken,
				expiresAt: session.expiresAt,
			};
		},
		[getAccessToken, getIdTokenClaims, mintConvexSession],
	);

	return useSharedAuthClient({
		logtoLoading: isLoading,
		isAuthenticated: isAuthenticated ?? false,
		signIn,
		signOut,
		clearAllTokens,
		getIdTokenClaims,
		getAccessToken,
		bootstrapSession,
		refreshSession,
		mode: "legacy",
	});
}

function useNativeAuthClient() {
	const {
		isAuthenticated,
		isLoading,
		signIn,
		signOut,
		clearAllTokens,
		getIdTokenClaims,
		getIdToken,
		getAccessToken,
	} = useLogto();
	const convexAuth = useConvexAuth();

	const bootstrapSession =
		useCallback(async (): Promise<AuthBootstrapResult> => {
			return await retryAsync(
				async () =>
					loadNativeSession({
						getAccessToken: async () => getAccessToken?.(),
						getIdToken: async () => getIdToken?.(),
						getIdTokenClaims: async () => getIdTokenClaims?.(),
					}),
				3,
				500,
			);
		}, [getAccessToken, getIdToken, getIdTokenClaims]);

	const refreshSession = useCallback(async (): Promise<AuthBootstrapResult> => {
		return await retryAsync(
			async () =>
				loadNativeSession({
					getAccessToken: async () => getAccessToken?.(),
					getIdToken: async () => getIdToken?.(),
					getIdTokenClaims: async () => getIdTokenClaims?.(),
				}),
			3,
			500,
		);
	}, [getAccessToken, getIdToken, getIdTokenClaims]);

	const auth = useSharedAuthClient({
		// Logto is the source of truth for "signed in". Convex token validation
		// can lag or briefly fail during refresh; treating that as sign-out was
		// clearing local state and forcing another Google login.
		logtoLoading: isLoading || (Boolean(isAuthenticated) && convexAuth.isLoading),
		isAuthenticated: Boolean(isAuthenticated),
		signIn,
		signOut,
		clearAllTokens,
		getIdTokenClaims,
		getAccessToken,
		bootstrapSession,
		refreshSession,
		mode: "native",
	});

	return auth;
}
