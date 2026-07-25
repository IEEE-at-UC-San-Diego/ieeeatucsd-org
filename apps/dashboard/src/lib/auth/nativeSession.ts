export interface NativeSessionClaims {
	sub: string;
	exp?: number;
	email?: string | null;
	name?: string | null;
	picture?: string | null;
}

export interface NativeSessionResult {
	logtoId: string;
	accessToken: string;
	sessionToken: string;
	expiresAt: number;
}

interface LoadNativeSessionInput {
	getAccessToken: () => Promise<string | null | undefined>;
	getIdToken: () => Promise<string | null | undefined>;
	getIdTokenClaims: () => Promise<NativeSessionClaims | null | undefined>;
	nowMs?: number;
}

const DEFAULT_ID_TOKEN_TTL_MS = 60 * 60_000;

/**
 * Load a Convex-native session from Logto.
 *
 * Important: call getAccessToken first. That path uses the refresh token and
 * rotates the ID token. Reading getIdToken in parallel can return a stale
 * expired ID token and break Convex auth after the first hour.
 */
export async function loadNativeSession({
	getAccessToken,
	getIdToken,
	getIdTokenClaims,
	nowMs = Date.now(),
}: LoadNativeSessionInput): Promise<NativeSessionResult> {
	const accessToken = await getAccessToken();
	if (!accessToken) {
		throw new Error("Missing Logto access token");
	}

	const [claims, idToken] = await Promise.all([
		getIdTokenClaims(),
		getIdToken(),
	]);

	if (!claims?.sub || !idToken) {
		throw new Error("Missing Logto claims or ID token");
	}

	return {
		logtoId: claims.sub,
		accessToken,
		sessionToken: idToken,
		expiresAt: claims.exp ? claims.exp * 1000 : nowMs + DEFAULT_ID_TOKEN_TTL_MS,
	};
}
