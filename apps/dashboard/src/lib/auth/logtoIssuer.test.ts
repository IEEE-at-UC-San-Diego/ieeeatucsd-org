import { describe, expect, it } from "vitest";
import { resolveLogtoOidcIssuer } from "./logtoIssuer";

describe("resolveLogtoOidcIssuer", () => {
	it("appends /oidc to a Logto base URL", () => {
		expect(resolveLogtoOidcIssuer("https://auth.example.com")).toBe(
			"https://auth.example.com/oidc",
		);
	});

	it("keeps an issuer that already ends with /oidc", () => {
		expect(resolveLogtoOidcIssuer("https://auth.example.com/oidc")).toBe(
			"https://auth.example.com/oidc",
		);
	});

	it("strips trailing slashes before normalizing", () => {
		expect(resolveLogtoOidcIssuer("https://auth.example.com/")).toBe(
			"https://auth.example.com/oidc",
		);
		expect(resolveLogtoOidcIssuer("https://auth.example.com/oidc/")).toBe(
			"https://auth.example.com/oidc",
		);
	});

	it("rejects empty endpoints", () => {
		expect(() => resolveLogtoOidcIssuer("   ")).toThrow(
			"Logto endpoint is empty",
		);
	});
});
