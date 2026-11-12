export interface AuthStateInput {
	logtoLoading: boolean;
	isAuthenticated: boolean;
	logtoId: string | null;
	accessToken: string | null;
	convexSessionToken: string | null;
	convexUser: unknown;
	isProvisioningUser: boolean;
	hasProvisioningAttempt: boolean;
	authFailureReason: string | null;
}

interface ResolvedAuthUser<TUser> {
	logtoId: string;
	user: TUser;
}

interface ResolveStableAuthUserInput<TUser> {
	logtoId: string | null;
	convexUser: TUser | null | undefined;
	lastResolvedUser: ResolvedAuthUser<TUser> | null;
}

interface ShouldAttemptProvisioningInput {
	isAuthenticated: boolean;
	logtoId: string | null;
	convexSessionToken: string | null;
	convexUser: unknown;
	lastProvisioningAttemptLogtoId: string | null;
}

interface DashboardUser {
	signedUp?: boolean;
	role?: string;
}

interface DashboardRedirectInput {
	isAuthResolved: boolean;
	isAuthenticated: boolean;
	user: DashboardUser | null;
	pathname: string;
}

export interface CallbackUser {
	signedUp: boolean;
	role: string;
}

export interface CallbackClaims {
	sub: string;
	email?: string;
	name?: string;
	picture?: string;
}

export interface FinalizeSignInDeps {
	getIdTokenClaims?: () => Promise<CallbackClaims | null | undefined>;
	getAccessToken?: () => Promise<string | null | undefined>;
	getIdToken?: () => Promise<string | null | undefined>;
	createSession: (accessToken: string) => Promise<{ sessionToken: string }>;
	upsertUser: (args: {
		authToken: string;
		name?: string;
		avatar?: string;
		signInMethod: string;
	}) => Promise<CallbackUser>;
}

export type AuthRecoveryAction = "soft_rebootstrap" | "hard_clear";

/**
 * Decision helpers for the single dashboard auth path:
 * Logto session → HMAC Convex bridge token → Convex user/role.
 */
export class AuthFlow {
	static readonly REBOOTSTRAP_LATCH_KEY = "auth-retry:session-init-rebootstrap";
	static readonly POST_LOGIN_REDIRECT_KEY = "auth:post-login-redirect";

	static isSafePostLoginRedirect(path: string) {
		return /^\/accept-invitation\/[A-Za-z0-9_-]+$/.test(path);
	}

	static stashPostLoginRedirect(path: string) {
		if (typeof window === "undefined") return;
		if (!AuthFlow.isSafePostLoginRedirect(path)) return;
		window.sessionStorage.setItem(AuthFlow.POST_LOGIN_REDIRECT_KEY, path);
		window.localStorage.setItem(AuthFlow.POST_LOGIN_REDIRECT_KEY, path);
	}

	static consumePostLoginRedirect() {
		if (typeof window === "undefined") return null;
		const path =
			window.sessionStorage.getItem(AuthFlow.POST_LOGIN_REDIRECT_KEY) ??
			window.localStorage.getItem(AuthFlow.POST_LOGIN_REDIRECT_KEY);
		window.sessionStorage.removeItem(AuthFlow.POST_LOGIN_REDIRECT_KEY);
		window.localStorage.removeItem(AuthFlow.POST_LOGIN_REDIRECT_KEY);
		if (!path || !AuthFlow.isSafePostLoginRedirect(path)) return null;
		return path;
	}

	static resolveStableUser<TUser>({
		logtoId,
		convexUser,
		lastResolvedUser,
	}: ResolveStableAuthUserInput<TUser>) {
		if (!logtoId) {
			return {
				user: null,
				lastResolvedUser: null,
			};
		}

		if (convexUser === null) {
			return {
				user: null,
				lastResolvedUser: null,
			};
		}

		if (convexUser !== undefined) {
			return {
				user: convexUser,
				lastResolvedUser: {
					logtoId,
					user: convexUser,
				},
			};
		}

		if (lastResolvedUser?.logtoId === logtoId) {
			return {
				user: lastResolvedUser.user,
				lastResolvedUser,
			};
		}

		return {
			user: undefined,
			lastResolvedUser: null,
		};
	}

	static resolveState({
		logtoLoading,
		isAuthenticated,
		logtoId,
		accessToken,
		convexSessionToken,
		convexUser,
		isProvisioningUser,
		hasProvisioningAttempt,
		authFailureReason,
	}: AuthStateInput) {
		if (authFailureReason) {
			return {
				isAuthResolved: true,
				isLoading: false,
			};
		}

		// Logto often reports isAuthenticated=false while it is still loading the
		// session from storage (new tab, hard refresh). If we treat that as
		// "signed out and resolved", dashboard routes redirect to /signin.
		if (logtoLoading && !isAuthenticated) {
			return {
				isAuthResolved: false,
				isLoading: true,
			};
		}

		if (!isAuthenticated) {
			return {
				isAuthResolved: true,
				isLoading: false,
			};
		}

		const hasCoreSession = !!logtoId && !!accessToken && !!convexSessionToken;
		if (!hasCoreSession) {
			return {
				isAuthResolved: false,
				isLoading: true,
			};
		}

		const isAuthResolved =
			convexUser !== undefined &&
			!(convexUser === null && isProvisioningUser) &&
			!(convexUser === null && !hasProvisioningAttempt);

		return {
			isAuthResolved,
			isLoading: !isAuthResolved,
		};
	}

	static shouldAttemptProvisioning({
		isAuthenticated,
		logtoId,
		convexSessionToken,
		convexUser,
		lastProvisioningAttemptLogtoId,
	}: ShouldAttemptProvisioningInput) {
		if (!isAuthenticated || !logtoId || !convexSessionToken) return false;
		if (convexUser !== null) return false;
		return lastProvisioningAttemptLogtoId !== logtoId;
	}

	static postSignInRedirectPath(signedUp: boolean, role: string) {
		return !signedUp && role !== "Sponsor" ? "/get-started" : "/overview";
	}

	static resolveDashboardRedirect({
		isAuthResolved,
		isAuthenticated,
		user,
		pathname,
	}: DashboardRedirectInput): "/signin" | "/get-started" | "/overview" | null {
		if (!isAuthResolved) return null;
		if (!isAuthenticated) return "/signin";
		if (!user) return "/signin";
		if (
			!user.signedUp &&
			user.role !== "Sponsor" &&
			pathname !== "/get-started"
		) {
			return "/get-started";
		}
		if (user.signedUp && pathname === "/get-started") {
			return "/overview";
		}
		return null;
	}

	static resolveRecoveryAction(refreshStillValid: boolean): AuthRecoveryAction {
		return refreshStillValid ? "soft_rebootstrap" : "hard_clear";
	}

	static clearRecoveryLatches() {
		if (typeof window === "undefined") return;
		window.sessionStorage.removeItem(AuthFlow.REBOOTSTRAP_LATCH_KEY);
		window.sessionStorage.removeItem("auth-retry:session-init");
		window.sessionStorage.removeItem("auth-retry:stale-callback");
	}

	static async finalizeSignIn({
		getIdTokenClaims,
		getAccessToken,
		getIdToken,
		createSession,
		upsertUser,
	}: FinalizeSignInDeps) {
		const claims = await getIdTokenClaims?.();
		if (!claims?.sub) {
			throw new Error("Missing user claims");
		}

		const accessToken = await getAccessToken?.();
		if (!accessToken) {
			throw new Error("Missing access token");
		}

		const idToken = await getIdToken?.();
		if (!idToken) {
			throw new Error("Missing ID token");
		}

		await createSession(accessToken);
		const user = await upsertUser({
			authToken: idToken,
			name: claims.name || claims.sub,
			avatar: claims.picture,
			signInMethod: "logto",
		});

		return (
			AuthFlow.consumePostLoginRedirect() ??
			AuthFlow.postSignInRedirectPath(user.signedUp, user.role)
		);
	}
}
