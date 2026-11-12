import { describe, expect, it } from "vitest";
import {
	contentTypeForUpload,
	INVOICE_UPLOAD_TYPES,
} from "./uploadContentType";

describe("contentTypeForUpload", () => {
	it("keeps a declared type", () => {
		expect(
			contentTypeForUpload(
				{ name: "invoice.pdf", type: "application/pdf" },
				INVOICE_UPLOAD_TYPES,
			),
		).toBe("application/pdf");
	});

	it("maps an unlabeled pdf by extension", () => {
		expect(
			contentTypeForUpload(
				{ name: "invoice.pdf", type: "" },
				INVOICE_UPLOAD_TYPES,
			),
		).toBe("application/pdf");
	});

	it("replaces a declared type the picker does not allow", () => {
		expect(
			contentTypeForUpload(
				{ name: "invoice.pdf", type: "text/html" },
				INVOICE_UPLOAD_TYPES,
			),
		).toBe("application/pdf");
	});

	it("drops a word type on an invoice pdf", () => {
		expect(
			contentTypeForUpload(
				{ name: "invoice.pdf", type: "application/msword" },
				INVOICE_UPLOAD_TYPES,
			),
		).toBe("application/pdf");
	});

	it("falls back when the extension is unknown", () => {
		expect(
			contentTypeForUpload(
				{ name: "notes.txt", type: "  " },
				INVOICE_UPLOAD_TYPES,
			),
		).toBe("application/octet-stream");
	});
});
