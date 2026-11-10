import { describe, expect, it, vi } from "vitest";
import {
	bridgeFreshness,
	isPersistentSessionGone,
	joinOpenTabRefresh,
	planNullUserRetry,
	readBridgeCredentials,
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

	it("retries after joining an in-flight refresh that fails transiently", async () => {
		let settle: (value: null) => void = () => {};
		const inFlight = new Promise<null>((resolve) => {
			settle = resolve;
		});
		const start = vi.fn(async () => null);
		const scheduleRetry = vi.fn();

		const joined = joinOpenTabRefresh({
			cancelled: () => false,
			plan: "hold-and-refresh",
			inFlight,
			start,
			stillNeedsRefresh: () => true,
			scheduleRetry,
		});

		expect(start).not.toHaveBeenCalled();
		settle(null);
		await joined;
		expect(scheduleRetry).toHaveBeenCalledOnce();
	});

	it("returns the current bridge token with its own expiry", () => {
		const now = 500_000;
		const captured = {
			logtoId: "logto|daniel",
			authToken: "expired-token",
			expiresAt: 1_000,
		};
		const current = {
			logtoId: "logto|daniel",
			authToken: "fresh-token",
			expiresAt: now + FIVE_MINUTES_MS,
		};

		expect(readBridgeCredentials(current, now)).toEqual({
			status: "current",
			logtoId: "logto|daniel",
			authToken: "fresh-token",
		});
		expect(readBridgeCredentials(captured, now)).toEqual({
			status: "refresh",
			plan: "hold-and-refresh",
		});
	});

	it("retries a later null after getMe returns a user", () => {
		const firstNull = planNullUserRetry({
			convexUser: null,
			latched: false,
			hasPreviousUser: true,
			hasSessionToken: true,
		});
		expect(firstNull).toEqual({ latched: true, refresh: true });

		const stillMissing = planNullUserRetry({
			convexUser: null,
			latched: firstNull.latched,
			hasPreviousUser: true,
			hasSessionToken: true,
		});
		expect(stillMissing).toEqual({ latched: true, refresh: false });

		const signedIn = planNullUserRetry({
			convexUser: { name: "Daniel" },
			latched: stillMissing.latched,
			hasPreviousUser: true,
			hasSessionToken: true,
		});
		expect(signedIn).toEqual({ latched: false, refresh: false });

		const laterNull = planNullUserRetry({
			convexUser: null,
			latched: signedIn.latched,
			hasPreviousUser: true,
			hasSessionToken: true,
		});
		expect(laterNull).toEqual({ latched: true, refresh: true });
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
