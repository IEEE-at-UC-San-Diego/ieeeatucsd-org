import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthFlow } from "./AuthFlow";

describe("AuthFlow.shouldAttemptProvisioning", () => {
	it("returns true for first null-user attempt", () => {
		expect(
			AuthFlow.shouldAttemptProvisioning({
				isAuthenticated: true,
				logtoId: "logto|new-user",
				convexSessionToken: "session-token",
				convexUser: null,
				lastProvisioningAttemptLogtoId: null,
			}),
		).toBe(true);
	});

	it("returns false after provisioning already attempted for same user", () => {
		expect(
			AuthFlow.shouldAttemptProvisioning({
				isAuthenticated: true,
				logtoId: "logto|new-user",
				convexSessionToken: "session-token",
				convexUser: null,
				lastProvisioningAttemptLogtoId: "logto|new-user",
			}),
		).toBe(false);
	});
});

describe("AuthFlow.resolveState", () => {
	it("defers unauthenticated resolution while Logto is still hydrating", () => {
		const state = AuthFlow.resolveState({
			logtoLoading: true,
			isAuthenticated: false,
			logtoId: null,
			accessToken: null,
			convexSessionToken: null,
			convexUser: undefined,
			isProvisioningUser: false,
			hasProvisioningAttempt: false,
			authFailureReason: null,
		});

		expect(state.isLoading).toBe(true);
		expect(state.isAuthResolved).toBe(false);
	});

	it("stays loading while provisioning is in progress", () => {
		const state = AuthFlow.resolveState({
			logtoLoading: false,
			isAuthenticated: true,
			logtoId: "logto|new-user",
			accessToken: "access-token",
			convexSessionToken: "session-token",
			convexUser: null,
			isProvisioningUser: true,
			hasProvisioningAttempt: true,
			authFailureReason: null,
		});

		expect(state.isLoading).toBe(true);
		expect(state.isAuthResolved).toBe(false);
	});

	it("resolves auth even if logto is still loading when local session is complete", () => {
		const state = AuthFlow.resolveState({
			logtoLoading: true,
			isAuthenticated: true,
			logtoId: "logto|member",
			accessToken: "access-token",
			convexSessionToken: "session-token",
			convexUser: { role: "Member" },
			isProvisioningUser: false,
			hasProvisioningAttempt: true,
			authFailureReason: null,
		});

		expect(state.isLoading).toBe(false);
		expect(state.isAuthResolved).toBe(true);
	});

	it("stays loading when authenticated but core session is incomplete", () => {
		const state = AuthFlow.resolveState({
			logtoLoading: false,
			isAuthenticated: true,
			logtoId: "logto|member",
			accessToken: "access-token",
			convexSessionToken: null,
			convexUser: undefined,
			isProvisioningUser: false,
			hasProvisioningAttempt: false,
			authFailureReason: null,
		});

		expect(state.isLoading).toBe(true);
		expect(state.isAuthResolved).toBe(false);
	});

	it("clears loading after bounded null-user provisioning attempt", () => {
		const state = AuthFlow.resolveState({
			logtoLoading: false,
			isAuthenticated: true,
			logtoId: "logto|new-user",
			accessToken: "access-token",
			convexSessionToken: "session-token",
			convexUser: null,
			isProvisioningUser: false,
			hasProvisioningAttempt: true,
			authFailureReason: null,
		});

		expect(state.isLoading).toBe(false);
		expect(state.isAuthResolved).toBe(true);
	});

	it("clears loading when auth bootstrap has a terminal failure", () => {
		const state = AuthFlow.resolveState({
			logtoLoading: false,
			isAuthenticated: true,
			logtoId: null,
			accessToken: null,
			convexSessionToken: null,
			convexUser: undefined,
			isProvisioningUser: false,
			hasProvisioningAttempt: false,
			authFailureReason: "session_mint_failed",
		});

		expect(state.isLoading).toBe(false);
		expect(state.isAuthResolved).toBe(true);
	});
});

describe("AuthFlow.resolveStableUser", () => {
	it("keeps auth resolved during a transient user refetch", () => {
		const stableUser = AuthFlow.resolveStableUser({
			logtoId: "logto|member",
			convexUser: undefined,
			lastResolvedUser: {
				logtoId: "logto|member",
				user: { role: "General Officer" },
			},
		});
		const state = AuthFlow.resolveState({
			logtoLoading: false,
			isAuthenticated: true,
			logtoId: "logto|member",
			accessToken: "access-token",
			convexSessionToken: "session-token",
			convexUser: stableUser.user,
			isProvisioningUser: false,
			hasProvisioningAttempt: true,
			authFailureReason: null,
		});

		expect(state.isLoading).toBe(false);
		expect(state.isAuthResolved).toBe(true);
	});

	it("keeps the last resolved user during a transient refetch", () => {
		const cachedUser = { role: "General Officer", name: "Resolved User" };
		const state = AuthFlow.resolveStableUser({
			logtoId: "logto|member",
			convexUser: undefined,
			lastResolvedUser: {
				logtoId: "logto|member",
				user: cachedUser,
			},
		});

		expect(state.user).toBe(cachedUser);
		expect(state.lastResolvedUser?.user).toBe(cachedUser);
	});

	it("treats a null Convex user as an explicit missing-user result", () => {
		const state = AuthFlow.resolveStableUser({
			logtoId: "logto|member",
			convexUser: null,
			lastResolvedUser: {
				logtoId: "logto|member",
				user: { role: "Administrator" },
			},
		});

		expect(state.user).toBeNull();
		expect(state.lastResolvedUser).toBeNull();
	});

	it("does not reuse a cached user for a different Logto user", () => {
		const state = AuthFlow.resolveStableUser({
			logtoId: "logto|next-user",
			convexUser: undefined,
			lastResolvedUser: {
				logtoId: "logto|previous-user",
				user: { role: "Executive Officer" },
			},
		});

		expect(state.user).toBeUndefined();
		expect(state.lastResolvedUser).toBeNull();
	});
});

describe("AuthFlow.postSignInRedirectPath", () => {
	it("returns get-started for unsigned non-sponsor user", () => {
		expect(AuthFlow.postSignInRedirectPath(false, "Member")).toBe(
			"/get-started",
		);
	});

	it("returns overview for signed-up user", () => {
		expect(AuthFlow.postSignInRedirectPath(true, "Member")).toBe("/overview");
	});

	it("returns overview for sponsor user", () => {
		expect(AuthFlow.postSignInRedirectPath(false, "Sponsor")).toBe("/overview");
	});
});

describe("AuthFlow.finalizeSignIn", () => {
	it("routes new non-sponsor users to get-started", async () => {
		const redirect = await AuthFlow.finalizeSignIn({
			getIdTokenClaims: async () => ({
				sub: "logto|new-user",
				email: "new-user@example.com",
				name: "New User",
			}),
			getAccessToken: async () => "access-token",
			getIdToken: async () => "id-token",
			createSession: async () => ({ sessionToken: "session-token" }),
			upsertUser: async () => ({
				signedUp: false,
				role: "Member",
			}),
		});

		expect(redirect).toBe("/get-started");
	});

	it("routes existing users to overview", async () => {
		const redirect = await AuthFlow.finalizeSignIn({
			getIdTokenClaims: async () => ({
				sub: "logto|existing-user",
				email: "existing-user@example.com",
				name: "Existing User",
			}),
			getAccessToken: async () => "access-token",
			getIdToken: async () => "id-token",
			createSession: async () => ({ sessionToken: "session-token" }),
			upsertUser: async () => ({
				signedUp: true,
				role: "Member",
			}),
		});

		expect(redirect).toBe("/overview");
	});

	it("passes the Logto ID token to upsert, not the HMAC session", async () => {
		const upsertUser = vi.fn(async () => ({
			signedUp: true,
			role: "Member",
		}));

		await AuthFlow.finalizeSignIn({
			getIdTokenClaims: async () => ({
				sub: "logto|member",
				email: "member@example.com",
				name: "Member",
			}),
			getAccessToken: async () => "access-token",
			getIdToken: async () => "logto-id-token",
			createSession: async () => ({ sessionToken: "hmac-session-token" }),
			upsertUser,
		});

		expect(upsertUser).toHaveBeenCalledWith({
			authToken: "logto-id-token",
			name: "Member",
			avatar: undefined,
			signInMethod: "logto",
		});
	});

	it("throws if the Logto ID token is missing", async () => {
		await expect(
			AuthFlow.finalizeSignIn({
				getIdTokenClaims: async () => ({
					sub: "logto|user",
					email: "user@example.com",
				}),
				getAccessToken: async () => "access-token",
				getIdToken: async () => null,
				createSession: async () => ({ sessionToken: "session-token" }),
				upsertUser: async () => ({
					signedUp: false,
					role: "Member",
				}),
			}),
		).rejects.toThrow("Missing ID token");
	});

	it("throws if session creation fails so caller can route to signin", async () => {
		const createSession = vi.fn(async () => {
			throw new Error("session failed");
		});

		await expect(
			AuthFlow.finalizeSignIn({
				getIdTokenClaims: async () => ({
					sub: "logto|user",
					email: "user@example.com",
				}),
				getAccessToken: async () => "access-token",
				getIdToken: async () => "id-token",
				createSession,
				upsertUser: async () => ({
					signedUp: false,
					role: "Member",
				}),
			}),
		).rejects.toThrow("session failed");
	});
});

describe("AuthFlow.resolveDashboardRedirect", () => {
	it("redirects unauthenticated users to signin", () => {
		expect(
			AuthFlow.resolveDashboardRedirect({
				isAuthResolved: true,
				isAuthenticated: false,
				user: null,
				pathname: "/overview",
			}),
		).toBe("/signin");
	});

	it("redirects to signin once auth is resolved after a bootstrap failure", () => {
		expect(
			AuthFlow.resolveDashboardRedirect({
				isAuthResolved: true,
				isAuthenticated: false,
				user: null,
				pathname: "/events",
			}),
		).toBe("/signin");
	});

	it("redirects authenticated users with no Convex user record to signin", () => {
		expect(
			AuthFlow.resolveDashboardRedirect({
				isAuthResolved: true,
				isAuthenticated: true,
				user: null,
				pathname: "/overview",
			}),
		).toBe("/signin");
	});

	it("redirects unsigned non-sponsor users to get-started", () => {
		expect(
			AuthFlow.resolveDashboardRedirect({
				isAuthResolved: true,
				isAuthenticated: true,
				user: { signedUp: false, role: "Member" },
				pathname: "/overview",
			}),
		).toBe("/get-started");
	});

	it("does not force sponsors to get-started", () => {
		expect(
			AuthFlow.resolveDashboardRedirect({
				isAuthResolved: true,
				isAuthenticated: true,
				user: { signedUp: false, role: "Sponsor" },
				pathname: "/overview",
			}),
		).toBeNull();
	});

	it("redirects signed-up users away from get-started", () => {
		expect(
			AuthFlow.resolveDashboardRedirect({
				isAuthResolved: true,
				isAuthenticated: true,
				user: { signedUp: true, role: "Member" },
				pathname: "/get-started",
			}),
		).toBe("/overview");
	});
});

describe("AuthFlow.resolveRecoveryAction", () => {
	it("soft-recovers when the Logto refresh token still works", () => {
		expect(AuthFlow.resolveRecoveryAction(true)).toBe("soft_rebootstrap");
	});

	it("hard-clears when Logto refresh is dead", () => {
		expect(AuthFlow.resolveRecoveryAction(false)).toBe("hard_clear");
	});
});

describe("AuthFlow.clearRecoveryLatches", () => {
	const storage = new Map<string, string>();

	afterEach(() => {
		storage.clear();
	});

	it("clears the soft-rebootstrap latch so later recoveries can retry", () => {
		const sessionStorageMock = {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => {
				storage.set(key, value);
			},
			removeItem: (key: string) => {
				storage.delete(key);
			},
			clear: () => {
				storage.clear();
			},
			key: () => null,
			length: 0,
		};

		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: { sessionStorage: sessionStorageMock },
		});

		sessionStorageMock.setItem(AuthFlow.REBOOTSTRAP_LATCH_KEY, "1");
		sessionStorageMock.setItem("auth-retry:session-init", "1");
		sessionStorageMock.setItem("auth-retry:stale-callback", "1");

		AuthFlow.clearRecoveryLatches();

		expect(
			sessionStorageMock.getItem(AuthFlow.REBOOTSTRAP_LATCH_KEY),
		).toBeNull();
		expect(sessionStorageMock.getItem("auth-retry:session-init")).toBeNull();
		expect(sessionStorageMock.getItem("auth-retry:stale-callback")).toBeNull();

		Reflect.deleteProperty(globalThis, "window");
	});
});

describe("AuthFlow post-login redirect", () => {
	const storage = new Map<string, string>();

	afterEach(() => {
		storage.clear();
		Reflect.deleteProperty(globalThis, "window");
	});

	function mockWindow() {
		const sessionStorageMock = {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => {
				storage.set(key, value);
			},
			removeItem: (key: string) => {
				storage.delete(key);
			},
			clear: () => {
				storage.clear();
			},
			key: () => null,
			length: 0,
		};
		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: { sessionStorage: sessionStorageMock },
		});
		return sessionStorageMock;
	}

	it("only allows accept-invitation paths", () => {
		expect(
			AuthFlow.isSafePostLoginRedirect("/accept-invitation/invite_1"),
		).toBe(true);
		expect(AuthFlow.isSafePostLoginRedirect("/overview")).toBe(false);
		expect(
			AuthFlow.isSafePostLoginRedirect("/accept-invitation/../overview"),
		).toBe(false);
		expect(AuthFlow.isSafePostLoginRedirect("https://evil.example")).toBe(
			false,
		);
	});

	it("returns a stashed accept-invitation path after sign-in", async () => {
		mockWindow();
		AuthFlow.stashPostLoginRedirect("/accept-invitation/invite_1");

		const redirect = await AuthFlow.finalizeSignIn({
			getIdTokenClaims: async () => ({
				sub: "logto|invitee",
				email: "invitee@example.com",
				name: "Invitee",
			}),
			getAccessToken: async () => "access-token",
			getIdToken: async () => "id-token",
			createSession: async () => ({ sessionToken: "session-token" }),
			upsertUser: async () => ({
				signedUp: false,
				role: "Member",
			}),
		});

		expect(redirect).toBe("/accept-invitation/invite_1");
		expect(
			window.sessionStorage.getItem(AuthFlow.POST_LOGIN_REDIRECT_KEY),
		).toBeNull();
	});

	it("ignores an unsafe stashed path", () => {
		const sessionStorageMock = mockWindow();
		sessionStorageMock.setItem(AuthFlow.POST_LOGIN_REDIRECT_KEY, "/overview");
		expect(AuthFlow.consumePostLoginRedirect()).toBeNull();
	});
});
