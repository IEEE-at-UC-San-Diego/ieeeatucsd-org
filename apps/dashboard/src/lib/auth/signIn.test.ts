import { describe, expect, it } from "vitest";
import { buildLogtoSignInOptions, resolveDirectSignInTarget } from "./signIn";

describe("resolveDirectSignInTarget", () => {
	it("defaults to google when unset", () => {
		expect(resolveDirectSignInTarget(undefined)).toBe("google");
		expect(resolveDirectSignInTarget("")).toBe("google");
	});

	it("allows explicit override", () => {
		expect(resolveDirectSignInTarget("google-workspace")).toBe(
			"google-workspace",
		);
	});

	it("supports disabling direct sign-in via env", () => {
		expect(resolveDirectSignInTarget("off")).toBeNull();
		expect(resolveDirectSignInTarget("false")).toBeNull();
		expect(resolveDirectSignInTarget("none")).toBeNull();
	});
});

describe("buildLogtoSignInOptions", () => {
	it("includes direct sign-in by default", () => {
		expect(
			buildLogtoSignInOptions(
				"https://dashboard.ieeeatucsd.org/callback",
				undefined,
			),
		).toEqual({
			redirectUri: "https://dashboard.ieeeatucsd.org/callback",
			directSignIn: {
				method: "social",
				target: "google",
			},
		});
	});

	it("omits direct sign-in when disabled", () => {
		expect(
			buildLogtoSignInOptions(
				"https://dashboard.ieeeatucsd.org/callback",
				"off",
			),
		).toEqual({
			redirectUri: "https://dashboard.ieeeatucsd.org/callback",
		});
	});
});
