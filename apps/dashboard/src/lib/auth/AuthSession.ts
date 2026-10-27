import { createAuthRequestId, logAuthEvent } from "@/lib/auth/logging";

export interface ConvexSessionData {
	sessionToken: string;
	expiresAt: number;
}

export interface AuthBootstrapResult {
	logtoId: string;
	accessToken: string;
	sessionToken: string;
	expiresAt: number;
}

interface RefreshSessionWithRetryInput {
	currentAccessToken: string | null;
	getLatestAccessToken: () => Promise<string | null | undefined>;
	mintSession?: (accessToken: string) => Promise<ConvexSessionData>;
	maxAttempts?: number;
	baseDelayMs?: number;
}

interface LoadSessionInput {
	getIdTokenClaims?: () => Promise<{ sub?: string } | null | undefined>;
	getAccessToken?: () => Promise<string | null | undefined>;
	currentAccessToken?: string | null;
	maxAttempts?: number;
	baseDelayMs?: number;
	requestIdPrefix?: string;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 750;

/**
 * Client-side Convex bridge session: mint HMAC tokens from a Logto access
 * token and retry through transient mint failures.
 */
export class AuthSession {
	static readonly MINT_TIMEOUT_MS = 10_000;

	static async fetchWithTimeout(
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

	static async mintBridgeToken(
		accessToken: string,
		requestIdPrefix = "session",
	): Promise<ConvexSessionData> {
		const requestId = createAuthRequestId(requestIdPrefix);
		logAuthEvent("session_mint_started", { requestId });

		const response = await AuthSession.fetchWithTimeout(
			"/api/auth/convex-session",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
					"X-Auth-Request-Id": requestId,
				},
				body: JSON.stringify({}),
			},
			AuthSession.MINT_TIMEOUT_MS,
		);

		if (!response.ok) {
			throw new Error(`Failed to mint Convex session (${response.status})`);
		}

		const data = (await response.json()) as ConvexSessionData;
		logAuthEvent("session_mint_succeeded", {
			requestId,
			expiresAt: data.expiresAt,
		});
		return data;
	}

	static async refreshWithRetry({
		currentAccessToken,
		getLatestAccessToken,
		mintSession = AuthSession.mintBridgeToken,
		maxAttempts = DEFAULT_MAX_ATTEMPTS,
		baseDelayMs = DEFAULT_BASE_DELAY_MS,
	}: RefreshSessionWithRetryInput): Promise<{
		session: ConvexSessionData;
		accessToken: string;
	}> {
		let tokenCandidate = currentAccessToken;
		let lastError: unknown;

		for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
			try {
				const latestToken = await getLatestAccessToken();
				if (latestToken) {
					tokenCandidate = latestToken;
				}
			} catch {
				// Continue with existing token if token refresh lookup fails transiently.
			}

			if (!tokenCandidate) {
				throw new Error("Missing access token for session refresh");
			}

			try {
				const session = await mintSession(tokenCandidate);
				return { session, accessToken: tokenCandidate };
			} catch (error) {
				lastError = error;
				if (attempt < maxAttempts) {
					await AuthSession.sleep(baseDelayMs * attempt);
				}
			}
		}

		throw lastError ?? new Error("Failed to refresh session");
	}

	static async load({
		getIdTokenClaims,
		getAccessToken,
		currentAccessToken = null,
		maxAttempts = DEFAULT_MAX_ATTEMPTS,
		baseDelayMs = DEFAULT_BASE_DELAY_MS,
		requestIdPrefix = "session",
	}: LoadSessionInput): Promise<AuthBootstrapResult> {
		const claims = await getIdTokenClaims?.();
		if (!claims?.sub) {
			throw new Error("Missing Logto claims");
		}

		const { session, accessToken } = await AuthSession.refreshWithRetry({
			currentAccessToken,
			getLatestAccessToken: async () => getAccessToken?.(),
			mintSession: (token) =>
				AuthSession.mintBridgeToken(token, requestIdPrefix),
			maxAttempts,
			baseDelayMs,
		});

		return {
			logtoId: claims.sub,
			accessToken,
			sessionToken: session.sessionToken,
			expiresAt: session.expiresAt,
		};
	}

	private static sleep(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
