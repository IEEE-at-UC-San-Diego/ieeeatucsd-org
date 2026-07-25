import { describe, expect, it, vi } from "vitest";
import { loadNativeSession } from "./nativeSession";

describe("loadNativeSession", () => {
	it("refreshes via access token before reading the ID token", async () => {
		const calls: string[] = [];
		const getAccessToken = vi.fn(async () => {
			calls.push("access");
			return "access-token";
		});
		const getIdToken = vi.fn(async () => {
			calls.push("id");
			return "id-token";
		});
		const getIdTokenClaims = vi.fn(async () => {
			calls.push("claims");
			return { sub: "user-1", exp: 1_700_000_000 };
		});

		await expect(
			loadNativeSession({
				getAccessToken,
				getIdToken,
				getIdTokenClaims,
				nowMs: 1_699_000_000_000,
			}),
		).resolves.toEqual({
			logtoId: "user-1",
			accessToken: "access-token",
			sessionToken: "id-token",
			expiresAt: 1_700_000_000_000,
		});

		expect(calls[0]).toBe("access");
		expect(calls.slice(1).sort()).toEqual(["claims", "id"]);
	});

	it("falls back to a one-hour expiry when claims omit exp", async () => {
		const nowMs = 1_000_000;

		await expect(
			loadNativeSession({
				getAccessToken: async () => "access-token",
				getIdToken: async () => "id-token",
				getIdTokenClaims: async () => ({ sub: "user-1" }),
				nowMs,
			}),
		).resolves.toMatchObject({
			expiresAt: nowMs + 60 * 60_000,
		});
	});

	it("fails when the access token cannot be refreshed", async () => {
		await expect(
			loadNativeSession({
				getAccessToken: async () => null,
				getIdToken: async () => "id-token",
				getIdTokenClaims: async () => ({ sub: "user-1" }),
			}),
		).rejects.toThrow("Missing Logto access token");
	});
});
