import { describe, expect, it } from "vitest";
import { resolveNativeAuthRecoveryAction } from "./recovery";

describe("resolveNativeAuthRecoveryAction", () => {
	it("soft-recovers when the Logto refresh token still works", () => {
		expect(resolveNativeAuthRecoveryAction(true)).toBe("soft_rebootstrap");
	});

	it("hard-clears when Logto refresh is dead", () => {
		expect(resolveNativeAuthRecoveryAction(false)).toBe("hard_clear");
	});
});
