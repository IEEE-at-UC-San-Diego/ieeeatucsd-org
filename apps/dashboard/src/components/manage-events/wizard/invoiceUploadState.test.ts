import { describe, expect, it } from "vitest";
import {
	type InvoiceUploadAction,
	type InvoiceUploadState,
	initialInvoiceUploadState,
	interpretParseInvoiceResponse,
	invoiceFromUpload,
	invoiceUploadErrorMessage,
	invoiceUploadReducer,
	isInvoiceUploadBusy,
	validateInvoiceFile,
} from "./invoiceUploadState";

function run(...actions: InvoiceUploadAction[]): InvoiceUploadState {
	return actions.reduce(invoiceUploadReducer, initialInvoiceUploadState);
}

describe("invoiceUploadReducer", () => {
	it("walks upload → parse → parsed for one request", () => {
		expect(run({ type: "start", requestId: 1, stage: "upload" }).phase).toEqual(
			{ status: "uploading" },
		);
		expect(
			run(
				{ type: "start", requestId: 1, stage: "upload" },
				{ type: "uploaded", requestId: 1 },
			).phase,
		).toEqual({ status: "parsing" });
		expect(
			run(
				{ type: "start", requestId: 1, stage: "upload" },
				{ type: "uploaded", requestId: 1 },
				{ type: "parsed", requestId: 1 },
			),
		).toEqual({ requestId: 1, phase: { status: "parsed" } });
	});

	it("starts directly at parsing when there is no storage upload", () => {
		expect(run({ type: "start", requestId: 1, stage: "parse" }).phase).toEqual({
			status: "parsing",
		});
	});

	it("records which stage failed", () => {
		const state = run(
			{ type: "start", requestId: 1, stage: "upload" },
			{ type: "fail", requestId: 1, stage: "upload", message: "Upload broke" },
		);
		expect(state.phase).toEqual({
			status: "failed",
			stage: "upload",
			message: "Upload broke",
		});
		expect(invoiceUploadErrorMessage(state.phase)).toBe("Upload broke");
	});

	it("lets a new request fail immediately, e.g. on validation", () => {
		const state = run(
			{ type: "start", requestId: 1, stage: "parse" },
			{ type: "parsed", requestId: 1 },
			{ type: "fail", requestId: 2, stage: "validate", message: "Too big" },
		);
		expect(state).toEqual({
			requestId: 2,
			phase: { status: "failed", stage: "validate", message: "Too big" },
		});
	});

	it("clears the previous success when the next file starts", () => {
		const state = run(
			{ type: "start", requestId: 1, stage: "parse" },
			{ type: "parsed", requestId: 1 },
			{ type: "start", requestId: 2, stage: "upload" },
		);
		expect(state.phase).toEqual({ status: "uploading" });
	});

	it("ignores results from a superseded request", () => {
		const started = run(
			{ type: "start", requestId: 1, stage: "upload" },
			{ type: "start", requestId: 2, stage: "upload" },
		);
		const stale: InvoiceUploadAction[] = [
			{ type: "uploaded", requestId: 1 },
			{ type: "parsed", requestId: 1 },
			{ type: "fail", requestId: 1, stage: "parse", message: "old" },
			{ type: "start", requestId: 1, stage: "parse" },
		];
		for (const action of stale) {
			expect(invoiceUploadReducer(started, action)).toBe(started);
		}
	});

	it("ignores out-of-order transitions for the active request", () => {
		const uploading = run({ type: "start", requestId: 1, stage: "upload" });
		expect(
			invoiceUploadReducer(uploading, { type: "parsed", requestId: 1 }),
		).toBe(uploading);

		const parsed = run(
			{ type: "start", requestId: 1, stage: "parse" },
			{ type: "parsed", requestId: 1 },
		);
		expect(
			invoiceUploadReducer(parsed, {
				type: "fail",
				requestId: 1,
				stage: "parse",
				message: "late",
			}),
		).toBe(parsed);
		expect(
			invoiceUploadReducer(parsed, { type: "uploaded", requestId: 1 }),
		).toBe(parsed);
	});

	it("dismisses only a failure", () => {
		const failed = run({
			type: "fail",
			requestId: 1,
			stage: "parse",
			message: "AI is disabled",
		});
		expect(invoiceUploadReducer(failed, { type: "dismiss" })).toEqual({
			requestId: 1,
			phase: { status: "idle" },
		});

		const parsing = run({ type: "start", requestId: 1, stage: "parse" });
		expect(invoiceUploadReducer(parsing, { type: "dismiss" })).toBe(parsing);
	});
});

describe("isInvoiceUploadBusy", () => {
	it("is busy only while uploading or parsing", () => {
		expect(isInvoiceUploadBusy({ status: "idle" })).toBe(false);
		expect(isInvoiceUploadBusy({ status: "uploading" })).toBe(true);
		expect(isInvoiceUploadBusy({ status: "parsing" })).toBe(true);
		expect(isInvoiceUploadBusy({ status: "parsed" })).toBe(false);
		expect(
			isInvoiceUploadBusy({ status: "failed", stage: "upload", message: "x" }),
		).toBe(false);
	});
});

describe("validateInvoiceFile", () => {
	it("accepts supported files up to 10 MB", () => {
		expect(
			validateInvoiceFile({ name: "receipt.PDF", size: 10 * 1024 * 1024 }),
		).toBeUndefined();
	});

	it("rejects files over 10 MB", () => {
		expect(
			validateInvoiceFile({ name: "receipt.pdf", size: 10 * 1024 * 1024 + 1 }),
		).toBe("File too large. Choose a file under 10\u00a0MB.");
	});

	it("rejects unsupported extensions", () => {
		expect(validateInvoiceFile({ name: "receipt.docx", size: 1 })).toBe(
			"Unsupported file type. Use PDF, JPG, PNG, GIF, or WebP.",
		);
	});
});

describe("interpretParseInvoiceResponse", () => {
	it("normalizes parsed data with defaults", () => {
		expect(
			interpretParseInvoiceResponse(true, {
				success: true,
				data: {
					vendor: "Costco",
					items: [{ description: "Chips", unitPrice: 3, total: 6 }, {}],
					tax: 0.5,
					total: 6.5,
				},
			}),
		).toEqual({
			ok: true,
			data: {
				vendor: "Costco",
				items: [
					{ description: "Chips", quantity: 1, unitPrice: 3, total: 6 },
					{ description: "", quantity: 1, unitPrice: 0, total: 0 },
				],
				tax: 0.5,
				tip: 0,
				subtotal: 0,
				total: 6.5,
			},
		});
	});

	it("passes the server error through the scan failure copy", () => {
		expect(
			interpretParseInvoiceResponse(false, { error: "AI parsing failed" }),
		).toEqual({
			ok: false,
			message:
				"AI parsing failed. Enter the vendor and line items below, or upload a PDF, JPG, or PNG under 10MB.",
		});
	});

	it("falls back when a successful response has no data", () => {
		const outcome = interpretParseInvoiceResponse(true, { success: true });
		expect(outcome.ok).toBe(false);
		expect(!outcome.ok && outcome.message).toContain(
			"Enter the vendor and line items below",
		);
	});
});

describe("invoiceFromUpload", () => {
	it("builds a blank invoice that keeps the stored file", () => {
		expect(invoiceFromUpload("inv-1", "storage-1", undefined)).toEqual({
			_id: "inv-1",
			vendor: "",
			items: [],
			tax: 0,
			tip: 0,
			invoiceFile: "storage-1",
			additionalFiles: [],
			subtotal: 0,
			total: 0,
			amount: 0,
			description: "",
		});
	});

	it("fills the invoice from parsed data and mirrors total into amount", () => {
		const items = [
			{ description: "Chips", quantity: 2, unitPrice: 3, total: 6 },
		];
		expect(
			invoiceFromUpload("inv-2", undefined, {
				vendor: "Costco",
				items,
				tax: 0.5,
				tip: 1,
				subtotal: 6,
				total: 7.5,
			}),
		).toEqual({
			_id: "inv-2",
			vendor: "Costco",
			items,
			tax: 0.5,
			tip: 1,
			invoiceFile: undefined,
			additionalFiles: [],
			subtotal: 6,
			total: 7.5,
			amount: 7.5,
			description: "",
		});
	});
});
