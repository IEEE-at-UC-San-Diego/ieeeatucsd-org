export type AuthBridgeMode = "legacy" | "native";

/**
 * Native mode is the default: Logto refresh tokens stay in localStorage and
 * Convex validates ID tokens directly, so users remain signed in until they
 * sign out (Gmail/Amazon-style). Set AUTH_BRIDGE_MODE=legacy to roll back.
 */
const DEFAULT_AUTH_BRIDGE_MODE: AuthBridgeMode = "native";

function parseAuthBridgeMode(
	value: string | undefined,
): AuthBridgeMode | undefined {
	if (value === "native" || value === "legacy") {
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

export function isNativeAuthBridgeMode() {
	return getAuthBridgeMode() === "native";
}
