import { describe, expect, it } from "vitest";
import { invoiceScanFailureMessage } from "./invoice-scan-error";

describe("invoiceScanFailureMessage", () => {
	it("keeps a server message that already says what to do", () => {
		expect(
			invoiceScanFailureMessage(
				"Invoice scanning is not configured. Enter the vendor and line items below.",
			),
		).toBe(
			"Invoice scanning is not configured. Enter the vendor and line items below.",
		);
	});

	it("adds the next step when the server message does not", () => {
		expect(invoiceScanFailureMessage("AI parsing failed")).toBe(
			"AI parsing failed. Enter the vendor and line items below, or upload a PDF, JPG, or PNG under 10MB.",
		);
	});

	it("replaces a raw provider dump with an actionable fallback", () => {
		expect(invoiceScanFailureMessage(`{"error":${"x".repeat(300)}}`)).toContain(
			"Enter the vendor and line items below",
		);
	});
});
