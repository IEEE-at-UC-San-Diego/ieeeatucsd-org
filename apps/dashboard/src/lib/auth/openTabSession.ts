export const SESSION_REFRESH_GRACE_MS = 60_000;

export type BridgeFreshness = "fresh" | "due" | "expired" | "missing";

export type RefreshPlan = "keep" | "refresh" | "hold-and-refresh";

export type HeldBridge = {
	token: string;
	expiresAt: number;
};

export type OpenTabRecovery<T> =
	| { status: "ready"; value: T; session: HeldBridge }
	| { status: "sign-in" };

export function bridgeFreshness(
	expiresAt: number | null,
	now: number,
	graceMs = SESSION_REFRESH_GRACE_MS,
): BridgeFreshness {
	if (expiresAt == null) return "missing";
	if (now >= expiresAt) return "expired";
	if (now + graceMs >= expiresAt) return "due";
	return "fresh";
}

export function sessionRefreshDelay(
	expiresAt: number,
	now: number,
	graceMs = SESSION_REFRESH_GRACE_MS,
): number {
	return Math.max(0, expiresAt - graceMs - now);
}

export function planBridgeRefresh(freshness: BridgeFreshness): RefreshPlan {
	switch (freshness) {
		case "fresh":
			return "keep";
		case "due":
			return "refresh";
		case "expired":
		case "missing":
			return "hold-and-refresh";
		default: {
			const unreachable: never = freshness;
			return unreachable;
		}
	}
}

export function shouldSendBridgeToken(
	expiresAt: number | null,
	now: number,
	hold: boolean,
): boolean {
	if (hold) return false;
	if (expiresAt == null) return true;
	return bridgeFreshness(expiresAt, now) !== "expired";
}

export function isPersistentSessionGone(error: unknown): boolean {
	const message = error instanceof Error ? error.message : "";
	return (
		message.includes("Failed to mint Convex session (401)") ||
		message.includes("Failed to mint Convex session (403)") ||
		message.includes("Missing Logto claims") ||
		message.includes("Missing access token for session refresh")
	);
}

export async function recoverOpenTabQuery<T>(input: {
	now: number;
	session: HeldBridge;
	hasPersistentSession: boolean;
	query: (session: HeldBridge) => Promise<T | null>;
	mint: () => Promise<HeldBridge>;
	sessionGone?: (error: unknown) => boolean;
}): Promise<OpenTabRecovery<T | null>> {
	const gone = input.sessionGone ?? isPersistentSessionGone;
	const plan = planBridgeRefresh(
		bridgeFreshness(input.session.expiresAt, input.now),
	);

	let session = input.session;
	if (plan !== "keep") {
		if (!input.hasPersistentSession) return { status: "sign-in" };
		try {
			session = await input.mint();
		} catch (error) {
			if (gone(error)) return { status: "sign-in" };
			throw error;
		}
	}

	const value = await input.query(session);
	return { status: "ready", value, session };
}
