import { describe, expect, it } from "vitest";
import { shouldParseInvoiceWithAI } from "./FundingSection";

describe("funding section AI gating", () => {
	it("parses invoice with AI when enabled", () => {
		expect(shouldParseInvoiceWithAI(true)).toBe(true);
	});

	it("skips invoice AI parsing when disabled", () => {
		expect(shouldParseInvoiceWithAI(false)).toBe(false);
	});
});
