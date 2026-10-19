import { describe, expect, it } from "vitest";
import { resolveLogtoRedirectUri } from "./redirectUri";

const PROD = "https://dashboard.ieeeatucsd.org/callback";

describe("resolveLogtoRedirectUri", () => {
	it("returns to localhost when the env points at production", () => {
		expect(resolveLogtoRedirectUri(PROD, "http://localhost:3000")).toBe(
			"http://localhost:3000/callback",
		);
	});

	it("treats 127.0.0.1 as local too", () => {
		expect(resolveLogtoRedirectUri(PROD, "http://127.0.0.1:3000")).toBe(
			"http://127.0.0.1:3000/callback",
		);
	});

	it("keeps a configured URI on the same origin", () => {
		expect(
			resolveLogtoRedirectUri(
				"http://localhost:3000/auth/return",
				"http://localhost:3000",
			),
		).toBe("http://localhost:3000/auth/return");
	});

	it("ignores a configured localhost URI on a deployed origin", () => {
		expect(
			resolveLogtoRedirectUri(
				"http://localhost:3000/callback",
				"https://dashboard.ieeeatucsd.org",
			),
		).toBe("https://dashboard.ieeeatucsd.org/callback");
	});

	it("falls back to origin/callback when nothing is configured", () => {
		expect(resolveLogtoRedirectUri(undefined, "https://example.org")).toBe(
			"https://example.org/callback",
		);
		expect(resolveLogtoRedirectUri("  ", "http://localhost:3000")).toBe(
			"http://localhost:3000/callback",
		);
	});

	it("keeps an explicit cross-origin URI between two deployed hosts", () => {
		expect(
			resolveLogtoRedirectUri(PROD, "https://preview.ieeeatucsd.org"),
		).toBe(PROD);
	});
});
