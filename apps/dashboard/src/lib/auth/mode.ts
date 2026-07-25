export type AuthBridgeMode = "legacy" | "native";

/**
 * How the dashboard authenticates to Convex:
 * - bridge: app-minted HMAC session tokens (works with any Logto signing alg)
 * - jwt: Convex OIDC/JWT via auth.config.ts (requires Logto RS256/ES256)
 *
 * Logto Cloud defaults to ES384, which Convex cannot verify. Keep jwt opt-in
 * until Logto private keys are rotated to RSA and JWKS serves RS256.
 */
export type ConvexAuthStrategy = "bridge" | "jwt";

/**
 * Native mode is the default: Logto refresh tokens stay in localStorage so
 * users remain signed in until they sign out (Gmail/Amazon-style).
 * Set AUTH_BRIDGE_MODE=legacy to roll back the client recovery behavior.
 */
const DEFAULT_AUTH_BRIDGE_MODE: AuthBridgeMode = "native";
const DEFAULT_CONVEX_AUTH_STRATEGY: ConvexAuthStrategy = "bridge";

function parseAuthBridgeMode(
	value: string | undefined,
): AuthBridgeMode | undefined {
	if (value === "native" || value === "legacy") {
		return value;
	}
	return undefined;
}

function parseConvexAuthStrategy(
	value: string | undefined,
): ConvexAuthStrategy | undefined {
	if (value === "bridge" || value === "jwt") {
		return value;
	}
	return undefined;
}

export function resolveAuthBridgeMode(input: {
	serverMode?: string;
	viteMode?: string;
	isBrowser: boolean;
}): AuthBridgeMode {
	const viteMode = parseAuthBridgeMode(input.viteMode);
	if (input.isBrowser) {
		return viteMode ?? DEFAULT_AUTH_BRIDGE_MODE;
	}

	const serverMode = parseAuthBridgeMode(input.serverMode);
	return serverMode ?? viteMode ?? DEFAULT_AUTH_BRIDGE_MODE;
}

export function resolveConvexAuthStrategy(input: {
	serverStrategy?: string;
	viteStrategy?: string;
	isBrowser: boolean;
}): ConvexAuthStrategy {
	const viteStrategy = parseConvexAuthStrategy(input.viteStrategy);
	if (input.isBrowser) {
		return viteStrategy ?? DEFAULT_CONVEX_AUTH_STRATEGY;
	}

	const serverStrategy = parseConvexAuthStrategy(input.serverStrategy);
	return serverStrategy ?? viteStrategy ?? DEFAULT_CONVEX_AUTH_STRATEGY;
}

export function getAuthBridgeMode(): AuthBridgeMode {
	const viteMode = (
		import.meta as ImportMeta & { env?: Record<string, string | undefined> }
	).env?.VITE_AUTH_BRIDGE_MODE;

	return resolveAuthBridgeMode({
		serverMode: process.env.AUTH_BRIDGE_MODE,
		viteMode,
		isBrowser: typeof window !== "undefined",
	});
}

export function getConvexAuthStrategy(): ConvexAuthStrategy {
	const viteStrategy = (
		import.meta as ImportMeta & { env?: Record<string, string | undefined> }
	).env?.VITE_CONVEX_AUTH_STRATEGY;

	return resolveConvexAuthStrategy({
		serverStrategy: process.env.CONVEX_AUTH_STRATEGY,
		viteStrategy,
		isBrowser: typeof window !== "undefined",
	});
}

export function isNativeAuthBridgeMode() {
	return getAuthBridgeMode() === "native";
}

/** True only when Convex should validate Logto ID tokens via auth.config.ts. */
export function isConvexJwtAuthEnabled() {
	return (
		isNativeAuthBridgeMode() && getConvexAuthStrategy() === "jwt"
	);
}
