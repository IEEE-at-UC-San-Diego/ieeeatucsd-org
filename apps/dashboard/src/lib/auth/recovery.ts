export type AuthRecoveryAction = "soft_rebootstrap" | "hard_clear";

/**
 * Decide whether native-mode recovery should preserve the Logto session.
 *
 * - soft_rebootstrap: refresh token still works; keep localStorage and retry
 * - hard_clear: refresh is dead/invalid; clear tokens and force a clean login
 */
export function resolveNativeAuthRecoveryAction(refreshStillValid: boolean): AuthRecoveryAction {
	return refreshStillValid ? "soft_rebootstrap" : "hard_clear";
}
