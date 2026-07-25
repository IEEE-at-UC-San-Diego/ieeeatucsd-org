import { describe, expect, it } from "vitest";
import { resolveAuthBridgeMode } from "./mode";

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
