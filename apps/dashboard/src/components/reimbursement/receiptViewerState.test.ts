import { describe, expect, it } from "vitest";
import {
	HEIC_CONVERSION_FAILED_MESSAGE,
	initialReceiptViewerState,
	RECEIPT_LOAD_FAILED_MESSAGE,
	type ReceiptViewerEvent,
	type ReceiptViewerState,
	receiptViewerReducer,
} from "./receiptViewerState";

const RECEIPT_URL = "https://files.example.com/receipt";
const BLOB_URL = "blob:https://dashboard.example.com/converted";

const run = (
	events: ReceiptViewerEvent[],
	start: ReceiptViewerState = initialReceiptViewerState,
) => events.reduce(receiptViewerReducer, start);

const originalImage: ReceiptViewerState = {
	status: "ready",
	kind: "image",
	url: RECEIPT_URL,
	canFallBackToPdf: true,
};

const convertedImage: ReceiptViewerState = {
	status: "ready",
	kind: "image",
	url: BLOB_URL,
	canFallBackToPdf: false,
};

describe("receiptViewerReducer", () => {
	it("starts in the loading state", () => {
		expect(initialReceiptViewerState).toEqual({ status: "loading" });
	});

	it("shows a detected PDF", () => {
		expect(run([{ type: "detected", kind: "pdf", url: RECEIPT_URL }])).toEqual({
			status: "ready",
			kind: "pdf",
		});
	});

	it("shows a detected image from its original URL with a PDF fallback", () => {
		expect(
			run([{ type: "detected", kind: "image", url: RECEIPT_URL }]),
		).toEqual(originalImage);
	});

	it("tries an unknown file as an image first", () => {
		expect(
			run([{ type: "detected", kind: "unknown", url: RECEIPT_URL }]),
		).toEqual(originalImage);
	});

	it("shows a converted HEIC image without a PDF fallback", () => {
		const converting = run([{ type: "conversionStarted" }]);
		expect(converting).toEqual({ status: "converting" });

		expect(run([{ type: "converted", url: BLOB_URL }], converting)).toEqual(
			convertedImage,
		);
	});

	it("fails when HEIC conversion fails", () => {
		expect(
			run([{ type: "conversionStarted" }, { type: "conversionFailed" }]),
		).toEqual({ status: "failed", message: HEIC_CONVERSION_FAILED_MESSAGE });
	});

	it("falls back to PDF when the original image fails to render", () => {
		expect(
			run([{ type: "imageFailed", url: RECEIPT_URL }], originalImage),
		).toEqual({ status: "ready", kind: "pdf" });
	});

	it("fails when a converted image fails to render", () => {
		expect(
			run([{ type: "imageFailed", url: BLOB_URL }], convertedImage),
		).toEqual({ status: "failed", message: RECEIPT_LOAD_FAILED_MESSAGE });
	});

	it("ignores render errors for a URL other than the one shown", () => {
		expect(run([{ type: "imageFailed", url: BLOB_URL }], originalImage)).toBe(
			originalImage,
		);
	});

	it("ignores render errors once the image is no longer displayed", () => {
		const pdf = run([{ type: "imageFailed", url: RECEIPT_URL }], originalImage);

		expect(run([{ type: "imageFailed", url: RECEIPT_URL }], pdf)).toBe(pdf);
	});

	it("restarts from any state on load", () => {
		const failed: ReceiptViewerState = {
			status: "failed",
			message: HEIC_CONVERSION_FAILED_MESSAGE,
		};

		for (const state of [failed, originalImage, convertedImage]) {
			expect(run([{ type: "load" }], state)).toEqual({ status: "loading" });
		}
	});

	it("ignores pipeline results that arrive outside their expected state", () => {
		expect(
			run([{ type: "detected", kind: "pdf", url: RECEIPT_URL }], originalImage),
		).toBe(originalImage);
		expect(run([{ type: "converted", url: BLOB_URL }])).toBe(
			initialReceiptViewerState,
		);
		expect(run([{ type: "conversionFailed" }])).toBe(initialReceiptViewerState);
		expect(run([{ type: "conversionStarted" }], originalImage)).toBe(
			originalImage,
		);
	});
});
