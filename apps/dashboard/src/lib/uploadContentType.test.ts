import { describe, expect, it } from "vitest";
import { contentTypeForUpload } from "./uploadContentType";

describe("contentTypeForUpload", () => {
	it("keeps a declared type", () => {
		expect(
			contentTypeForUpload({ name: "invoice.pdf", type: "application/pdf" }),
		).toBe("application/pdf");
	});

	it("maps an unlabeled pdf by extension", () => {
		expect(contentTypeForUpload({ name: "invoice.pdf", type: "" })).toBe(
			"application/pdf",
		);
	});

	it("replaces a declared type the picker does not allow", () => {
		expect(
			contentTypeForUpload({ name: "invoice.pdf", type: "text/html" }),
		).toBe("application/pdf");
	});

	it("falls back when the extension is unknown", () => {
		expect(contentTypeForUpload({ name: "notes.txt", type: "  " })).toBe(
			"application/octet-stream",
		);
	});
});
