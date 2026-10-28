import { describe, expect, it } from "vitest";
import { resolveConvexDeploy } from "./deploy-convex.mjs";

describe("resolveConvexDeploy", () => {
	it("skips when DEPLOY_CONVEX is unset so CI and local builds never push", () => {
		const result = resolveConvexDeploy({});
		expect(result).toEqual({
			action: "skip",
			message:
				"Skipping Convex deploy (DEPLOY_CONVEX is unset). CI and local compose do not push functions.",
		});
	});

	it("skips when DEPLOY_CONVEX is explicitly 0", () => {
		expect(
			resolveConvexDeploy({
				DEPLOY_CONVEX: "0",
				CONVEX_SELF_HOSTED_URL: "https://convex.example.com",
				CONVEX_SELF_HOSTED_ADMIN_KEY: "secret",
			}).action,
		).toBe("skip");
	});

	it("fails a production build that is missing the Convex URL", () => {
		const result = resolveConvexDeploy({
			DEPLOY_CONVEX: "1",
			CONVEX_SELF_HOSTED_ADMIN_KEY: "secret",
		});
		expect(result.action).toBe("fail");
		expect(result.message).toContain("CONVEX_SELF_HOSTED_URL");
	});

	it("fails a production build that is missing the admin key", () => {
		const result = resolveConvexDeploy({
			DEPLOY_CONVEX: "1",
			VITE_CONVEX_URL: "https://convex.example.com",
		});
		expect(result.action).toBe("fail");
		expect(result.message).toContain("CONVEX_SELF_HOSTED_ADMIN_KEY");
	});

	it("deploys once credentials are present and prefers CONVEX_SELF_HOSTED_URL", () => {
		expect(
			resolveConvexDeploy({
				DEPLOY_CONVEX: "true",
				CONVEX_SELF_HOSTED_URL: "https://convex.internal",
				VITE_CONVEX_URL: "https://convex.example.com",
				CONVEX_SELF_HOSTED_ADMIN_KEY: "secret",
			}),
		).toEqual({
			action: "deploy",
			url: "https://convex.internal",
		});
	});

	it("falls back to VITE_CONVEX_URL when CONVEX_SELF_HOSTED_URL is empty", () => {
		expect(
			resolveConvexDeploy({
				DEPLOY_CONVEX: "1",
				VITE_CONVEX_URL: "https://convex.example.com",
				CONVEX_SELF_HOSTED_ADMIN_KEY: "secret",
			}),
		).toEqual({
			action: "deploy",
			url: "https://convex.example.com",
		});
	});
});
