export type AuthRecoveryAction = "soft_rebootstrap" | "hard_clear";

export const AUTH_REBOOTSTRAP_LATCH_KEY = "auth-retry:session-init-rebootstrap";

/**
 * Decide whether native-mode recovery should preserve the Logto session.
 *
 * - soft_rebootstrap: refresh token still works; keep localStorage and retry
 * - hard_clear: refresh is dead/invalid; clear tokens and force a clean login
 */
export function resolveNativeAuthRecoveryAction(
	refreshStillValid: boolean,
): AuthRecoveryAction {
	return refreshStillValid ? "soft_rebootstrap" : "hard_clear";
}

/**
 * Clear sessionStorage recovery latches after a successful bootstrap so a later
 * independent soft-recovery in the same tab can rebootstrap once again.
 */
export function clearAuthRecoveryLatches() {
	if (typeof window === "undefined") return;
	window.sessionStorage.removeItem(AUTH_REBOOTSTRAP_LATCH_KEY);
	window.sessionStorage.removeItem("auth-retry:session-init");
	window.sessionStorage.removeItem("auth-retry:stale-callback");
}
