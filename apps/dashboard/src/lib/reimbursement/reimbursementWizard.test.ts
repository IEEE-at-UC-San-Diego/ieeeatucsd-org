import { describe, expect, it } from "vitest";
import {
	findFirstInvalidStep,
	findReachableStep,
	initialWizardState,
	maxJumpableStep,
	parseWizardStep,
	type ReportDetailsForm,
	type ValidatableExpense,
	validateExpenses,
	validateReportDetails,
	validateStep,
	type WizardState,
	wizardReducer,
} from "./reimbursementWizard";

const completeForm: ReportDetailsForm = {
	title: "Conference travel",
	department: "events",
	paymentMethod: "Zelle",
	additionalInfo: "",
	businessPurpose: "Presenting at IEEE conference",
};

const validReceipt: ValidatableExpense = {
	vendorName: "Amazon",
	expenseType: "receipt",
	receiptFile: "https://files.example/receipt.png",
	total: 12.5,
};

const validMileage: ValidatableExpense = {
	vendorName: "Supply run",
	expenseType: "mileage",
	miles: 10,
	total: 2,
};

const emptyForm: ReportDetailsForm = {
	title: "",
	department: "",
	paymentMethod: "",
	additionalInfo: "",
	businessPurpose: "",
};

function stateAt(
	step: WizardState["step"],
	maxVisitedStep: WizardState["maxVisitedStep"] = step,
): WizardState {
	return { step, maxVisitedStep, submitPhase: "idle" };
}

describe("validateReportDetails", () => {
	it("accepts a complete form", () => {
		expect(validateReportDetails(completeForm)).toBeNull();
	});

	it("requires business purpose, matching what submit enforces", () => {
		expect(
			validateReportDetails({ ...completeForm, businessPurpose: "   " }),
		).toBe("Business purpose is required. Add one in Report Details.");
	});

	it("reports the first missing field in form order", () => {
		expect(validateReportDetails(emptyForm)).toBe(
			"Title is required. Add one in Report Details.",
		);
		expect(validateReportDetails({ ...completeForm, department: "" })).toBe(
			"Department is required. Choose one in Report Details.",
		);
		expect(validateReportDetails({ ...completeForm, paymentMethod: "" })).toBe(
			"Payment method is required. Choose one in Report Details.",
		);
	});

	it("treats whitespace-only titles as missing", () => {
		expect(validateReportDetails({ ...completeForm, title: "  " })).toBe(
			"Title is required. Add one in Report Details.",
		);
	});
});

describe("validateExpenses", () => {
	it("accepts valid receipts and mileage", () => {
		expect(validateExpenses([validReceipt, validMileage])).toBeNull();
	});

	it("requires at least one expense", () => {
		expect(validateExpenses([])).toBe("Add at least one expense.");
	});

	it("requires an uploaded file for receipts", () => {
		expect(
			validateExpenses([{ ...validReceipt, receiptFile: undefined }]),
		).toBe("Expense 1 needs a receipt file. Upload one in Expenses.");
	});

	it("requires calculated miles for mileage", () => {
		expect(
			validateExpenses([validReceipt, { ...validMileage, miles: 0 }]),
		).toBe("Expense 2 needs calculated miles. Enter a full route in Expenses.");
	});

	it("requires a name and a positive total", () => {
		expect(validateExpenses([{ ...validReceipt, vendorName: " " }])).toBe(
			"Expense 1 needs a vendor name.",
		);
		expect(validateExpenses([{ ...validMileage, vendorName: "" }])).toBe(
			"Expense 1 needs a trip or purpose.",
		);
		expect(validateExpenses([{ ...validReceipt, total: 0 }])).toBe(
			"Expense 1 needs an amount greater than zero.",
		);
	});
});

describe("validateStep / findFirstInvalidStep", () => {
	it("never blocks the warning or review steps", () => {
		expect(validateStep(1, emptyForm, [])).toBeNull();
		expect(validateStep(4, emptyForm, [])).toBeNull();
	});

	it("returns the earliest failing step with its message", () => {
		expect(findFirstInvalidStep(emptyForm, [])).toEqual({
			step: 2,
			message: "Title is required. Add one in Report Details.",
		});
		expect(findFirstInvalidStep(completeForm, [])).toEqual({
			step: 3,
			message: "Add at least one expense.",
		});
		expect(findFirstInvalidStep(completeForm, [validReceipt])).toBeNull();
	});

	it("derives the furthest reachable step", () => {
		expect(findReachableStep(emptyForm, [])).toBe(2);
		expect(findReachableStep(completeForm, [])).toBe(3);
		expect(findReachableStep(completeForm, [validReceipt])).toBe(4);
	});
});

describe("parseWizardStep", () => {
	it("accepts only known step ids", () => {
		expect(parseWizardStep(3)).toBe(3);
		expect(parseWizardStep(0)).toBeNull();
		expect(parseWizardStep(5)).toBeNull();
		expect(parseWizardStep("2")).toBeNull();
		expect(parseWizardStep(undefined)).toBeNull();
	});
});

describe("wizardReducer navigation", () => {
	it("advances and records the visited step when the next step is reachable", () => {
		expect(
			wizardReducer(stateAt(2), { type: "next", reachableStep: 3 }),
		).toEqual(stateAt(3, 3));
	});

	it("does not advance past the reachable step", () => {
		const state = stateAt(2);
		expect(wizardReducer(state, { type: "next", reachableStep: 2 })).toBe(
			state,
		);
	});

	it("does not advance past the last step", () => {
		const state = stateAt(4);
		expect(wizardReducer(state, { type: "next", reachableStep: 4 })).toBe(
			state,
		);
	});

	it("goes back without validation and keeps the visited high-water mark", () => {
		expect(wizardReducer(stateAt(4), { type: "back" })).toEqual(stateAt(3, 4));
		const first = stateAt(1);
		expect(wizardReducer(first, { type: "back" })).toBe(first);
	});

	it("jumps back to any earlier step even when earlier steps are invalid", () => {
		expect(
			wizardReducer(stateAt(4), { type: "jump", step: 1, reachableStep: 2 }),
		).toEqual(stateAt(1, 4));
	});

	it("jumps forward only to visited steps that are still reachable", () => {
		const state = stateAt(2, 4);
		expect(
			wizardReducer(state, { type: "jump", step: 4, reachableStep: 4 }),
		).toEqual(stateAt(4, 4));
		expect(
			wizardReducer(state, { type: "jump", step: 4, reachableStep: 2 }),
		).toBe(state);
		expect(
			wizardReducer(state, { type: "jump", step: 3, reachableStep: 3 }),
		).toEqual(stateAt(3, 4));
	});

	it("does not jump forward to unvisited steps", () => {
		const state = stateAt(2, 2);
		expect(
			wizardReducer(state, { type: "jump", step: 3, reachableStep: 4 }),
		).toBe(state);
	});
});

describe("maxJumpableStep", () => {
	it("caps visited steps at the reachable step but never below the current step", () => {
		expect(maxJumpableStep(stateAt(2, 4), 4)).toBe(4);
		expect(maxJumpableStep(stateAt(2, 4), 2)).toBe(2);
		expect(maxJumpableStep(stateAt(4, 4), 2)).toBe(4);
		expect(maxJumpableStep(stateAt(1, 1), 4)).toBe(1);
	});
});

describe("wizardReducer restore/reset/submit", () => {
	it("restores a saved draft position", () => {
		expect(
			wizardReducer(initialWizardState, {
				type: "restore",
				step: 3,
				maxVisitedStep: 4,
			}),
		).toEqual(stateAt(3, 4));
	});

	it("normalizes missing or invalid draft steps", () => {
		expect(
			wizardReducer(initialWizardState, {
				type: "restore",
				step: 3,
				maxVisitedStep: undefined,
			}),
		).toEqual(stateAt(3, 3));
		expect(
			wizardReducer(initialWizardState, {
				type: "restore",
				step: 9,
				maxVisitedStep: 0,
			}),
		).toEqual(stateAt(1, 1));
		expect(
			wizardReducer(initialWizardState, {
				type: "restore",
				step: 4,
				maxVisitedStep: 2,
			}),
		).toEqual(stateAt(4, 4));
	});

	it("tracks a single in-flight submission", () => {
		const submitting = wizardReducer(stateAt(4), { type: "submitStarted" });
		expect(submitting.submitPhase).toBe("submitting");
		expect(wizardReducer(submitting, { type: "submitStarted" })).toBe(
			submitting,
		);
		expect(wizardReducer(submitting, { type: "submitSettled" })).toEqual(
			stateAt(4),
		);
	});

	it("resets the position without dropping an in-flight submission", () => {
		const submitting: WizardState = {
			step: 4,
			maxVisitedStep: 4,
			submitPhase: "submitting",
		};
		expect(wizardReducer(submitting, { type: "reset" })).toEqual({
			...initialWizardState,
			submitPhase: "submitting",
		});
		expect(wizardReducer(stateAt(3, 4), { type: "reset" })).toEqual(
			initialWizardState,
		);
	});
});
