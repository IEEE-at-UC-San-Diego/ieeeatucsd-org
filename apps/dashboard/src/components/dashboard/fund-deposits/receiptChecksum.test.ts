import { describe, expect, it } from "vitest";
import { fileSha256Hex } from "./receiptChecksum";

describe("fileSha256Hex", () => {
	it("matches the hex checksum Convex stores for an empty file", async () => {
		await expect(fileSha256Hex(new Blob([]))).resolves.toBe(
			"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		);
	});
});
