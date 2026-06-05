import { describe, expect, it, vi } from "vitest";
import { refreshLogtoIdToken } from "./logtoToken";

describe("refreshLogtoIdToken", () => {
	it("returns the cached ID token when Convex does not request a refresh", async () => {
		const clearAccessToken = vi.fn(async () => {});
		const getAccessToken = vi.fn(async () => "access-token");
		const getIdToken = vi.fn(async () => "cached-id-token");

		await expect(
			refreshLogtoIdToken({
				forceRefreshToken: false,
				clearAccessToken,
				getAccessToken,
				getIdToken,
			}),
		).resolves.toBe("cached-id-token");

		expect(clearAccessToken).not.toHaveBeenCalled();
		expect(getAccessToken).not.toHaveBeenCalled();
	});

	it("forces a Logto token exchange before reading the refreshed ID token", async () => {
		const calls: string[] = [];
		const clearAccessToken = vi.fn(async () => {
			calls.push("clear");
		});
		const getAccessToken = vi.fn(async () => {
			calls.push("access");
			return "fresh-access-token";
		});
		const getIdToken = vi.fn(async () => {
			calls.push("id");
			return "fresh-id-token";
		});

		await expect(
			refreshLogtoIdToken({
				forceRefreshToken: true,
				clearAccessToken,
				getAccessToken,
				getIdToken,
			}),
		).resolves.toBe("fresh-id-token");

		expect(calls).toEqual(["clear", "access", "id"]);
	});
});
