import { afterEach, describe, expect, it } from "vitest";
import {
	AUTH_REBOOTSTRAP_LATCH_KEY,
	clearAuthRecoveryLatches,
	resolveNativeAuthRecoveryAction,
} from "./recovery";

describe("resolveNativeAuthRecoveryAction", () => {
	it("soft-recovers when the Logto refresh token still works", () => {
		expect(resolveNativeAuthRecoveryAction(true)).toBe("soft_rebootstrap");
	});

	it("hard-clears when Logto refresh is dead", () => {
		expect(resolveNativeAuthRecoveryAction(false)).toBe("hard_clear");
	});
});

describe("clearAuthRecoveryLatches", () => {
	afterEach(() => {
		window.sessionStorage.clear();
	});

	it("clears the soft-rebootstrap latch so later recoveries can retry", () => {
		window.sessionStorage.setItem(AUTH_REBOOTSTRAP_LATCH_KEY, "1");
		window.sessionStorage.setItem("auth-retry:session-init", "1");
		window.sessionStorage.setItem("auth-retry:stale-callback", "1");

		clearAuthRecoveryLatches();

		expect(window.sessionStorage.getItem(AUTH_REBOOTSTRAP_LATCH_KEY)).toBeNull();
		expect(window.sessionStorage.getItem("auth-retry:session-init")).toBeNull();
		expect(window.sessionStorage.getItem("auth-retry:stale-callback")).toBeNull();
	});
});
