import { describe, expect, it, vi } from "vitest";
import {
	bridgeFreshness,
	isPersistentSessionGone,
	recoverOpenTabQuery,
	sessionRefreshDelay,
	shouldSendBridgeToken,
} from "./openTabSession";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

describe("open tab bridge refresh", () => {
	it("refreshes before the bridge token expires", () => {
		const expiresAt = 1_000_000 + FIVE_MINUTES_MS;
		const justBeforeGrace = expiresAt - 60_000 - 1;
		const atGrace = expiresAt - 60_000;

		expect(bridgeFreshness(expiresAt, justBeforeGrace)).toBe("fresh");
		expect(bridgeFreshness(expiresAt, atGrace)).toBe("due");
		expect(sessionRefreshDelay(expiresAt, justBeforeGrace)).toBe(1);
		expect(shouldSendBridgeToken(expiresAt, atGrace, false)).toBe(true);
	});

	it("recovers after a long idle with no reload and no error", async () => {
		const errors: unknown[] = [];
		const openedAt = 1_700_000_000_000;
		const expiresAt = openedAt + FIVE_MINUTES_MS;
		const wokeAt = openedAt + 60 * 60 * 1000;
		const query = vi.fn(async (session: { token: string }) => {
			if (session.token === "stale-token") {
				const error = new Error("Auth token expired");
				errors.push(error);
				throw error;
			}
			return { name: "Daniel" };
		});

		const result = await recoverOpenTabQuery({
			now: wokeAt,
			session: { token: "stale-token", expiresAt },
			hasPersistentSession: true,
			query,
			mint: async () => ({
				token: "fresh-token",
				expiresAt: wokeAt + FIVE_MINUTES_MS,
			}),
		});

		expect(errors).toEqual([]);
		expect(query).toHaveBeenCalledTimes(1);
		expect(query).toHaveBeenCalledWith({
			token: "fresh-token",
			expiresAt: wokeAt + FIVE_MINUTES_MS,
		});
		expect(result).toEqual({
			status: "ready",
			value: { name: "Daniel" },
			session: {
				token: "fresh-token",
				expiresAt: wokeAt + FIVE_MINUTES_MS,
			},
		});
		expect(shouldSendBridgeToken(expiresAt, wokeAt, false)).toBe(false);
	});

	it("sends the user to sign-in only when the persistent session is gone", async () => {
		const result = await recoverOpenTabQuery({
			now: 10_000,
			session: { token: "stale-token", expiresAt: 1_000 },
			hasPersistentSession: true,
			query: async () => {
				throw new Error("query should not run");
			},
			mint: async () => {
				throw new Error("Failed to mint Convex session (401)");
			},
			sessionGone: isPersistentSessionGone,
		});

		expect(result).toEqual({ status: "sign-in" });
	});

	it("keeps the session when refresh fails transiently", async () => {
		await expect(
			recoverOpenTabQuery({
				now: 10_000,
				session: { token: "stale-token", expiresAt: 1_000 },
				hasPersistentSession: true,
				query: async () => ({ name: "Daniel" }),
				mint: async () => {
					throw new Error("Failed to mint Convex session (500)");
				},
			}),
		).rejects.toThrow("500");
	});
});
