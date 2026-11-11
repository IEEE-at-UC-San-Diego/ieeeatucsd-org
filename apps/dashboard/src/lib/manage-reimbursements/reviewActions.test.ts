import { describe, expect, it } from "vitest";
import {
	getReviewStep,
	withoutPendingAction,
	withPendingAction,
} from "./reviewActions";

describe("getReviewStep", () => {
	it("offers approve/decline for submitted requests", () => {
		expect(getReviewStep({ status: "submitted" })).toBe("approveOrDecline");
	});

	it("offers mark as paid only for approved requests without payment details", () => {
		expect(getReviewStep({ status: "approved" })).toBe("markPaid");
		expect(
			getReviewStep({
				status: "approved",
				paymentDetails: { confirmationNumber: "X" },
			}),
		).toBe("none");
	});

	it("offers nothing for declined or paid requests", () => {
		expect(getReviewStep({ status: "declined" })).toBe("none");
		expect(getReviewStep({ status: "paid" })).toBe("none");
	});
});

describe("pending review actions", () => {
	it("tracks actions per reimbursement independently", () => {
		const pending = withPendingAction(
			withPendingAction({}, "a", "approve"),
			"b",
			"decline",
		);
		expect(pending).toEqual({ a: "approve", b: "decline" });
		expect(withoutPendingAction(pending, "a")).toEqual({ b: "decline" });
	});

	it("returns the same object when settling an id that is not pending", () => {
		const pending = withPendingAction({}, "a", "approve");
		expect(withoutPendingAction(pending, "z")).toBe(pending);
	});
});
