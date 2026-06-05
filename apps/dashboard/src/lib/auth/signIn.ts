export type SignInOptions = {
	redirectUri: string;
	directSignIn?: {
		method: "social";
		target: string;
	};
};

const DEFAULT_DIRECT_SIGN_IN_TARGET = "google";
const DISABLED_DIRECT_SIGN_IN_TARGETS = new Set(["off", "false", "none"]);

export function resolveDirectSignInTarget(
	rawTarget: string | undefined,
): string | null {
	const trimmedTarget = rawTarget?.trim();

	if (!trimmedTarget) {
		return DEFAULT_DIRECT_SIGN_IN_TARGET;
	}

	if (DISABLED_DIRECT_SIGN_IN_TARGETS.has(trimmedTarget.toLowerCase())) {
		return null;
	}

	return trimmedTarget;
}

export function buildLogtoSignInOptions(
	redirectUri: string,
	rawDirectSignInTarget: string | undefined,
): SignInOptions {
	const directSignInTarget = resolveDirectSignInTarget(rawDirectSignInTarget);

	if (!directSignInTarget) {
		return { redirectUri };
	}

	return {
		redirectUri,
		directSignIn: {
			method: "social",
			target: directSignInTarget,
		},
	};
}
