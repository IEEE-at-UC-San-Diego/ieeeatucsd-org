import { describe, expect, it } from "vitest";
import { fileSha256Hex } from "./receiptChecksum";

describe("fileSha256Hex", () => {
	it("matches the base64 checksum Convex stores for an empty file", async () => {
		await expect(fileSha256Hex(new Blob([]))).resolves.toBe(
			"47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=",
		);
	});
});
