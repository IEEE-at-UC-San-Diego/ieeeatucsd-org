/**
 * Resolve the Logto OIDC issuer URL used by Convex auth.config.
 *
 * App env vars use the Logto base URL (e.g. https://auth.example.com) for
 * `/oidc/me` and `/oidc/token` calls. Convex OIDC provider `domain` must match
 * the ID token `iss` claim exactly, which for Logto is `{base}/oidc`.
 */
export function resolveLogtoOidcIssuer(endpoint: string): string {
	const normalized = endpoint.trim().replace(/\/+$/, "");
	if (!normalized) {
		throw new Error("Logto endpoint is empty");
	}

	return normalized.endsWith("/oidc") ? normalized : `${normalized}/oidc`;
}
