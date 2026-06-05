import { describe, expect, it } from "vitest";
import {
	isAiFeatureEnabled,
	shouldAutoParseReceipt,
} from "./routes/_dashboard/reimbursement";

describe("reimbursement AI gating", () => {
	it("treats undefined preference as enabled", () => {
		expect(isAiFeatureEnabled(undefined)).toBe(true);
	});

	it("disables AI only when preference is false", () => {
		expect(isAiFeatureEnabled(false)).toBe(false);
		expect(isAiFeatureEnabled(true)).toBe(true);
	});

	it("auto parsing follows aiEnabled gate", () => {
		expect(shouldAutoParseReceipt(true)).toBe(true);
		expect(shouldAutoParseReceipt(false)).toBe(false);
	});
});
