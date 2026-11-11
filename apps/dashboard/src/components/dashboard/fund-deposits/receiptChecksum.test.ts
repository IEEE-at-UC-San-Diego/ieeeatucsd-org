import { describe, expect, it } from "vitest";
import { fileSha256Base64 } from "./receiptChecksum";

describe("fileSha256Base64", () => {
	it("matches the base64 checksum Convex stores for an empty file", async () => {
		await expect(fileSha256Base64(new Blob([]))).resolves.toBe(
			"47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=",
		);
	});
});
