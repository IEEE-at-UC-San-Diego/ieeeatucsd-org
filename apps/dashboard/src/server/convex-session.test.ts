import { beforeEach, describe, expect, it } from "vitest";

describe("convex session token signing", () => {
	beforeEach(() => {
		process.env.CONVEX_SESSION_SECRET = "unit-test-secret";
	});

	it("accepts a valid token", async () => {
		const {
			createConvexSessionToken,
			verifyConvexSessionToken,
		} = await import("./convex-session");

		const { token, payload } = createConvexSessionToken({
			sub: "logto|valid-user",
			role: "Administrator",
		});

		const verified = verifyConvexSessionToken(token);
		expect(verified.sub).toBe(payload.sub);
		expect(verified.role).toBe(payload.role);
		expect(verified.v).toBe(1);
	});

	it("rejects an expired token", async () => {
		const {
			createConvexSessionToken,
			verifyConvexSessionToken,
			CONVEX_SESSION_TTL_SECONDS,
		} = await import("./convex-session");

		const nowMs = Date.now() - (CONVEX_SESSION_TTL_SECONDS + 30) * 1000;
		const { token } = createConvexSessionToken({
			sub: "logto|expired-user",
			nowMs,
		});

		expect(() => verifyConvexSessionToken(token)).toThrow("expired");
	});

	it("rejects a token with tampered payload", async () => {
		const {
			createConvexSessionToken,
			verifyConvexSessionToken,
		} = await import("./convex-session");

		const { token } = createConvexSessionToken({
			sub: "logto|original-user",
		});

		const [encodedPayload, signature] = token.split(".");
		const payload = JSON.parse(
			decodeURIComponent(encodedPayload),
		) as Record<string, unknown>;
		payload.sub = "logto|attacker";
		const tamperedPayload = encodeURIComponent(JSON.stringify(payload));
		const tamperedToken = `${tamperedPayload}.${signature}`;

		expect(() => verifyConvexSessionToken(tamperedToken)).toThrow("signature");
	});

	it("rejects a token with tampered signature", async () => {
		const {
			createConvexSessionToken,
			verifyConvexSessionToken,
		} = await import("./convex-session");

		const { token } = createConvexSessionToken({
			sub: "logto|valid-user",
		});

		const tamperedToken = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
		expect(() => verifyConvexSessionToken(tamperedToken)).toThrow("signature");
	});
});
