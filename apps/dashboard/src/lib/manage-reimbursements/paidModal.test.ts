import { describe, expect, it } from "vitest";
import {
	buildPaymentReviewForm,
	hasUnsavedPaymentProgress,
	initialPaidModalState,
	isPaidModalOpenFor,
	type PaidModalAction,
	type PaidModalState,
	type PaymentReviewForm,
	paidModalReducer,
	toPaymentDetails,
} from "./paidModal";

const proof = new File(["proof"], "proof.png", { type: "image/png" });

const form: PaymentReviewForm = {
	confirmationNumber: "ZEL-123",
	paymentDate: "2026-11-01",
	amount: "42.50",
	memo: "Thanks",
};

function run(
	actions: PaidModalAction[],
	state: PaidModalState = initialPaidModalState,
): PaidModalState {
	return actions.reduce(paidModalReducer, state);
}

const extracting: PaidModalAction[] = [
	{ type: "open", reimbursementId: "r1" },
	{ type: "proofSelected", file: proof },
	{ type: "extractionStarted", attempt: 1 },
];

const reviewing: PaidModalAction[] = [
	...extracting,
	{ type: "extractionFinished", attempt: 1, proofUrl: "https://p", form },
];

describe("paidModalReducer", () => {
	it("opens into proof selection with no file", () => {
		expect(run([{ type: "open", reimbursementId: "r1" }])).toEqual({
			status: "selectingProof",
			reimbursementId: "r1",
			file: null,
		});
	});

	it("discards leftover progress when opened again", () => {
		expect(
			run([...reviewing, { type: "open", reimbursementId: "r2" }]),
		).toEqual({ status: "selectingProof", reimbursementId: "r2", file: null });
	});

	it("does not start extraction without a proof file", () => {
		const state = run([{ type: "open", reimbursementId: "r1" }]);
		expect(
			paidModalReducer(state, { type: "extractionStarted", attempt: 1 }),
		).toBe(state);
	});

	it("moves from extraction to review with the uploaded proof", () => {
		expect(run(reviewing)).toEqual({
			status: "reviewing",
			reimbursementId: "r1",
			proofUrl: "https://p",
			form,
		});
	});

	it("ignores proof changes once extraction has started", () => {
		const state = run(extracting);
		expect(paidModalReducer(state, { type: "proofSelected", file: null })).toBe(
			state,
		);
	});

	it("drops an extraction result that arrives after closing", () => {
		const state = run([
			...extracting,
			{ type: "close" },
			{ type: "extractionFinished", attempt: 1, proofUrl: "https://p", form },
		]);
		expect(state.status).toBe("closed");
	});

	it("drops a stale extraction result after reopening", () => {
		const state = run([
			...extracting,
			{ type: "close" },
			{ type: "open", reimbursementId: "r1" },
			{ type: "proofSelected", file: proof },
			{ type: "extractionStarted", attempt: 2 },
			{ type: "extractionFinished", attempt: 1, proofUrl: "https://old", form },
		]);
		expect(state).toMatchObject({ status: "extracting", attempt: 2 });
	});

	it("edits review fields only while reviewing", () => {
		const edited = run([
			...reviewing,
			{ type: "fieldChanged", field: "memo", value: "Paid via Zelle" },
		]);
		expect(edited).toMatchObject({
			status: "reviewing",
			form: { ...form, memo: "Paid via Zelle" },
		});

		const submitting = paidModalReducer(edited, { type: "submitStarted" });
		expect(
			paidModalReducer(submitting, {
				type: "fieldChanged",
				field: "memo",
				value: "late edit",
			}),
		).toBe(submitting);
	});

	it("returns to review with the form intact when submission fails", () => {
		const state = run([
			...reviewing,
			{ type: "submitStarted" },
			{ type: "submitFailed" },
		]);
		expect(state).toEqual(run(reviewing));
	});

	it("keeps the last open phase on close for the exit animation", () => {
		const open = run(reviewing);
		expect(paidModalReducer(open, { type: "close" })).toEqual({
			status: "closed",
			previous: open,
		});
	});
});

describe("isPaidModalOpenFor", () => {
	it("is open only for the reimbursement it was opened for", () => {
		const state = run([{ type: "open", reimbursementId: "r1" }]);
		expect(isPaidModalOpenFor(state, "r1")).toBe(true);
		expect(isPaidModalOpenFor(state, "r2")).toBe(false);
		expect(isPaidModalOpenFor(state, undefined)).toBe(false);
		expect(isPaidModalOpenFor(initialPaidModalState, "r1")).toBe(false);
	});
});

describe("hasUnsavedPaymentProgress", () => {
	it("is clean when closed or before a proof is picked", () => {
		expect(hasUnsavedPaymentProgress(initialPaidModalState)).toBe(false);
		expect(
			hasUnsavedPaymentProgress(run([{ type: "open", reimbursementId: "r1" }])),
		).toBe(false);
	});

	it("is dirty once a proof is picked and through review", () => {
		expect(hasUnsavedPaymentProgress(run(extracting.slice(0, 2)))).toBe(true);
		expect(hasUnsavedPaymentProgress(run(extracting))).toBe(true);
		expect(hasUnsavedPaymentProgress(run(reviewing))).toBe(true);
	});
});

describe("buildPaymentReviewForm", () => {
	const defaults = { today: "2026-11-08", fallbackAmount: "100.00" };

	it("uses extracted values when present", () => {
		expect(
			buildPaymentReviewForm(
				{
					confirmationNumber: "ABC",
					paymentDate: "2026-10-31",
					amountPaid: 12.5,
					memo: "Lunch",
				},
				defaults,
			),
		).toEqual({
			confirmationNumber: "ABC",
			paymentDate: "2026-10-31",
			amount: "12.5",
			memo: "Lunch",
		});
	});

	it("falls back for empty or non-positive extracted values", () => {
		expect(
			buildPaymentReviewForm(
				{ confirmationNumber: "", paymentDate: "", amountPaid: 0, memo: "" },
				defaults,
			),
		).toEqual({
			confirmationNumber: "",
			paymentDate: "2026-11-08",
			amount: "100.00",
			memo: "",
		});
	});

	it("prefills only date and amount for manual entry", () => {
		expect(buildPaymentReviewForm(null, defaults)).toEqual({
			confirmationNumber: "",
			paymentDate: "2026-11-08",
			amount: "100.00",
			memo: "",
		});
	});
});

describe("toPaymentDetails", () => {
	const now = Date.UTC(2026, 10, 8);

	it("trims the confirmation number and parses the reviewed values", () => {
		expect(
			toPaymentDetails(
				{ ...form, confirmationNumber: "  ZEL-123 " },
				{ proofUrl: "https://p", fallbackAmount: 99, now },
			),
		).toEqual({
			confirmationNumber: "ZEL-123",
			paymentDate: Date.UTC(2026, 10, 1),
			amountPaid: 42.5,
			proofFileUrl: "https://p",
			memo: "Thanks",
		});
	});

	it("falls back to now, the reimbursement total, and omits empty optionals", () => {
		expect(
			toPaymentDetails(
				{ confirmationNumber: "X", paymentDate: "", amount: "", memo: "" },
				{ proofUrl: null, fallbackAmount: 99, now },
			),
		).toEqual({
			confirmationNumber: "X",
			paymentDate: now,
			amountPaid: 99,
			proofFileUrl: undefined,
			memo: undefined,
		});
	});
});
