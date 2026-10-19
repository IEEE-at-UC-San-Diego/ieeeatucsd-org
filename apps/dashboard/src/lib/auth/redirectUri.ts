const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function isLoopbackHostname(hostname: string): boolean {
	return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith(".localhost");
}

/**
 * Picks the OAuth redirect URI for the current page.
 *
 * Logto must send the browser back to the origin that started the sign-in, or
 * the PKCE session stored for that origin is lost. A shared `.env` often points
 * `VITE_LOGTO_REDIRECT_URI` at production, so on a loopback origin we ignore a
 * configured URI that lives elsewhere. The reverse also applies: a configured
 * localhost URI is ignored on any non-loopback origin.
 */
export function resolveLogtoRedirectUri(
	configuredRedirectUri: string | undefined,
	origin: string,
): string {
	const fallback = `${origin}/callback`;
	const trimmed = configuredRedirectUri?.trim();
	if (!trimmed) return fallback;

	try {
		const configured = new URL(trimmed, origin);
		if (configured.origin === origin) return configured.toString();

		const currentIsLoopback = isLoopbackHostname(new URL(origin).hostname);
		const configuredIsLoopback = isLoopbackHostname(configured.hostname);

		if (currentIsLoopback !== configuredIsLoopback) return fallback;
		if (currentIsLoopback) return fallback;

		return configured.toString();
	} catch {
		return fallback;
	}
}
