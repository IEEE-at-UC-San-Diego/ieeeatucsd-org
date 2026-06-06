import { describe, expect, it } from "vitest";
import {
	createAiDisabledResponse,
	isAiEnabledForUser,
	requireApiAuth,
} from "./auth";

describe("isAiEnabledForUser", () => {
	it("returns true when user is undefined", () => {
		expect(isAiEnabledForUser(undefined)).toBe(true);
	});

	it("returns true when user has no aiFeaturesEnabled flag", () => {
		expect(isAiEnabledForUser({})).toBe(true);
	});

	it("returns true when aiFeaturesEnabled is true", () => {
		expect(isAiEnabledForUser({ aiFeaturesEnabled: true })).toBe(true);
	});

	it("returns false when aiFeaturesEnabled is false", () => {
		expect(isAiEnabledForUser({ aiFeaturesEnabled: false })).toBe(false);
	});
});

describe("createAiDisabledResponse", () => {
	it("returns a 403 with the expected API contract", async () => {
		const response = createAiDisabledResponse();
		const body = await response.json();

		expect(response.status).toBe(403);
		expect(body).toEqual({
			error: "AI features are disabled for this account",
			code: "AI_DISABLED_BY_USER",
		});
	});
});

describe("requireApiAuth", () => {
	it("returns 401 when bearer token is missing", async () => {
		const request = new Request("http://localhost/api/test", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		const result = await requireApiAuth(request);
		expect(result).toBeInstanceOf(Response);
		const response = result as Response;
		expect(response.status).toBe(401);
	});

	it("returns 401 when bearer token is invalid", async () => {
		const request = new Request("http://localhost/api/test", {
			method: "POST",
			headers: {
				Authorization: "Bearer invalid-token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({}),
		});

		const result = await requireApiAuth(request, {
			validateAccessToken: async () => null,
		});
		expect(result).toBeInstanceOf(Response);
		const response = result as Response;
		expect(response.status).toBe(401);
	});

	it("returns auth context when bearer token is valid", async () => {
		const request = new Request("http://localhost/api/test", {
			method: "POST",
			headers: {
				Authorization: "Bearer valid-token",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ some: "value" }),
		});

		const result = await requireApiAuth(request, {
			validateAccessToken: async () => ({ sub: "logto|abc123" }),
			validateProvisionedUser: async () => ({
				role: "Administrator",
				aiFeaturesEnabled: true,
			}),
		});

		expect(result).not.toBeInstanceOf(Response);
		if (result instanceof Response) {
			throw new Error("Expected auth result, received response");
		}
		expect(result.logtoId).toBe("logto|abc123");
		expect(result.claims.sub).toBe("logto|abc123");
		expect(result.user.role).toBe("Administrator");
	});
});
