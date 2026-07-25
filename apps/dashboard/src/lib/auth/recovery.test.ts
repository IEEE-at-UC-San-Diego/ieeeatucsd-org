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
	const storage = new Map<string, string>();

	afterEach(() => {
		storage.clear();
	});

	it("clears the soft-rebootstrap latch so later recoveries can retry", () => {
		const sessionStorageMock = {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => {
				storage.set(key, value);
			},
			removeItem: (key: string) => {
				storage.delete(key);
			},
			clear: () => {
				storage.clear();
			},
			key: () => null,
			length: 0,
		};

		Object.defineProperty(globalThis, "window", {
			configurable: true,
			value: { sessionStorage: sessionStorageMock },
		});

		sessionStorageMock.setItem(AUTH_REBOOTSTRAP_LATCH_KEY, "1");
		sessionStorageMock.setItem("auth-retry:session-init", "1");
		sessionStorageMock.setItem("auth-retry:stale-callback", "1");

		clearAuthRecoveryLatches();

		expect(sessionStorageMock.getItem(AUTH_REBOOTSTRAP_LATCH_KEY)).toBeNull();
		expect(sessionStorageMock.getItem("auth-retry:session-init")).toBeNull();
		expect(sessionStorageMock.getItem("auth-retry:stale-callback")).toBeNull();

		Reflect.deleteProperty(globalThis, "window");
	});
});
