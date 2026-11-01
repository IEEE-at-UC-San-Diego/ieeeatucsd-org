import { describe, expect, it } from "vitest";
import { logAuthorId } from "./logs";

describe("logAuthorId", () => {
	it("attributes the row to the authenticated logto id", () => {
		expect(
			logAuthorId({ logtoId: "logto|admin", authUserId: "auth-admin" }),
		).toBe("logto|admin");
	});

	it("uses authUserId when logtoId is absent or blank", () => {
		expect(logAuthorId({ logtoId: null, authUserId: "auth-admin" })).toBe(
			"auth-admin",
		);
		expect(logAuthorId({ logtoId: "  ", authUserId: "auth-admin" })).toBe(
			"auth-admin",
		);
	});

	it("rejects an authenticated record with no stable id", () => {
		expect(() => logAuthorId({ logtoId: "  ", authUserId: "" })).toThrow(
			"Unauthorized",
		);
	});
});
