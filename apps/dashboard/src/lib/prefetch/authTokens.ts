type AuthTokens = {
	logtoId: string;
	authToken: string;
};

let authTokens: AuthTokens | null = null;

export function setAuthTokens(
	tokens: { logtoId: string; convexSessionToken: string } | null,
) {
	if (tokens === null) {
		authTokens = null;
		return;
	}

	authTokens = {
		logtoId: tokens.logtoId,
		authToken: tokens.convexSessionToken,
	};
}

export function getAuthTokens(): AuthTokens | null {
	return authTokens;
}
