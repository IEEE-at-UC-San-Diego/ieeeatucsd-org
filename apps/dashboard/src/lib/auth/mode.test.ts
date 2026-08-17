import { describe, expect, it } from "vitest";
import { resolveAuthBridgeMode, resolveConvexAuthStrategy } from "./mode";

describe("resolveAuthBridgeMode", () => {
	it("defaults to native when unset", () => {
		expect(
			resolveAuthBridgeMode({
				isBrowser: false,
			}),
		).toBe("native");
		expect(
			resolveAuthBridgeMode({
				isBrowser: true,
			}),
		).toBe("native");
	});

	it("honors explicit legacy rollback on the server", () => {
		expect(
			resolveAuthBridgeMode({
				serverMode: "legacy",
				viteMode: "native",
				isBrowser: false,
			}),
		).toBe("legacy");
	});

	it("uses the Vite mode in the browser", () => {
		expect(
			resolveAuthBridgeMode({
				serverMode: "legacy",
				viteMode: "native",
				isBrowser: true,
			}),
		).toBe("native");
	});

	it("ignores invalid mode values", () => {
		expect(
			resolveAuthBridgeMode({
				serverMode: "nope",
				viteMode: "also-nope",
				isBrowser: false,
			}),
		).toBe("native");
	});
});

describe("resolveConvexAuthStrategy", () => {
	it("defaults to bridge so ES384 Logto tenants keep working", () => {
		expect(
			resolveConvexAuthStrategy({
				isBrowser: false,
			}),
		).toBe("bridge");
	});

	it("allows opting into Convex JWT auth after Logto RSA rotation", () => {
		expect(
			resolveConvexAuthStrategy({
				serverStrategy: "jwt",
				viteStrategy: "jwt",
				isBrowser: false,
			}),
		).toBe("jwt");
	});
});
