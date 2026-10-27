import { describe, expect, it, vi } from "vitest";
import { AuthSession } from "./AuthSession";

describe("AuthSession.refreshWithRetry", () => {
	it("uses the latest access token when available", async () => {
		const getLatestAccessToken = vi.fn(async () => "fresh-access-token");
		const mintSession = vi.fn(async (accessToken: string) => ({
			sessionToken: `session-for-${accessToken}`,
			expiresAt: Date.now() + 60_000,
		}));

		const result = await AuthSession.refreshWithRetry({
			currentAccessToken: "stale-access-token",
			getLatestAccessToken,
			mintSession,
			baseDelayMs: 0,
		});

		expect(getLatestAccessToken).toHaveBeenCalled();
		expect(mintSession).toHaveBeenCalledWith("fresh-access-token");
		expect(result.accessToken).toBe("fresh-access-token");
	});

	it("retries transient mint failures and eventually succeeds", async () => {
		const getLatestAccessToken = vi.fn(async () => "stable-token");
		const mintSession = vi
			.fn<(_: string) => Promise<{ sessionToken: string; expiresAt: number }>>()
			.mockRejectedValueOnce(new Error("temporary failure 1"))
			.mockRejectedValueOnce(new Error("temporary failure 2"))
			.mockResolvedValueOnce({
				sessionToken: "session-token",
				expiresAt: Date.now() + 60_000,
			});

		const result = await AuthSession.refreshWithRetry({
			currentAccessToken: "stable-token",
			getLatestAccessToken,
			mintSession,
			maxAttempts: 3,
			baseDelayMs: 0,
		});

		expect(mintSession).toHaveBeenCalledTimes(3);
		expect(result.session.sessionToken).toBe("session-token");
	});

	it("fails after exhausting retry budget", async () => {
		const getLatestAccessToken = vi.fn(async () => "stable-token");
		const mintSession = vi.fn(async () => {
			throw new Error("persistent failure");
		});

		await expect(
			AuthSession.refreshWithRetry({
				currentAccessToken: "stable-token",
				getLatestAccessToken,
				mintSession,
				maxAttempts: 3,
				baseDelayMs: 0,
			}),
		).rejects.toThrow("persistent failure");

		expect(mintSession).toHaveBeenCalledTimes(3);
	});
});

describe("AuthSession.load", () => {
	it("mints a session from Logto claims and the latest access token", async () => {
		const mintSession = vi.spyOn(AuthSession, "mintBridgeToken").mockResolvedValue({
			sessionToken: "session-token",
			expiresAt: 1_700_000_000_000,
		});

		const result = await AuthSession.load({
			getIdTokenClaims: async () => ({ sub: "logto|member" }),
			getAccessToken: async () => "access-token",
			baseDelayMs: 0,
		});

		expect(mintSession).toHaveBeenCalledWith("access-token", "session");
		expect(result).toEqual({
			logtoId: "logto|member",
			accessToken: "access-token",
			sessionToken: "session-token",
			expiresAt: 1_700_000_000_000,
		});

		mintSession.mockRestore();
	});

	it("throws when Logto claims are missing", async () => {
		await expect(
			AuthSession.load({
				getIdTokenClaims: async () => null,
				getAccessToken: async () => "access-token",
			}),
		).rejects.toThrow("Missing Logto claims");
	});
});
