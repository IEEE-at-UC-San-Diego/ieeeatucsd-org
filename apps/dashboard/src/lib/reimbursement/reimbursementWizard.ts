export const WIZARD_STEPS = [1, 2, 3, 4] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

export const FIRST_WIZARD_STEP: WizardStep = 1;
export const LAST_WIZARD_STEP: WizardStep = 4;

export type ReportDetailsForm = {
	title: string;
	department: string;
	paymentMethod: string;
	additionalInfo: string;
	businessPurpose: string;
};

export type ValidatableExpense = {
	vendorName: string;
	expenseType?: "receipt" | "mileage";
	miles?: number;
	receiptFile?: string;
	total: number;
};

export type WizardSubmitPhase = "idle" | "submitting";

export type WizardState = {
	step: WizardStep;
	maxVisitedStep: WizardStep;
	submitPhase: WizardSubmitPhase;
};

/**
 * `reachableStep` is the furthest step the current form data allows (see
 * `findReachableStep`); forward moves past it are ignored.
 */
export type WizardAction =
	| { type: "next"; reachableStep: WizardStep }
	| { type: "back" }
	| { type: "jump"; step: WizardStep; reachableStep: WizardStep }
	| { type: "restore"; step: unknown; maxVisitedStep: unknown }
	| { type: "reset" }
	| { type: "submitStarted" }
	| { type: "submitSettled" };

export const initialWizardState: WizardState = {
	step: FIRST_WIZARD_STEP,
	maxVisitedStep: FIRST_WIZARD_STEP,
	submitPhase: "idle",
};

export function parseWizardStep(value: unknown): WizardStep | null {
	return WIZARD_STEPS.find((step) => step === value) ?? null;
}

export function validateReportDetails(form: ReportDetailsForm): string | null {
	if (!form.title.trim()) {
		return "Title is required. Add one in Report Details.";
	}
	if (!form.department) {
		return "Department is required. Choose one in Report Details.";
	}
	if (!form.paymentMethod) {
		return "Payment method is required. Choose one in Report Details.";
	}
	if (!form.businessPurpose.trim()) {
		return "Business purpose is required. Add one in Report Details.";
	}
	return null;
}

function validateExpense(
	expense: ValidatableExpense,
	label: string,
): string | null {
	const hasName = (expense.vendorName ?? "").trim().length > 0;
	if (expense.expenseType === "mileage") {
		if (!hasName) return `${label} needs a trip or purpose.`;
		if ((expense.miles ?? 0) <= 0) {
			return `${label} needs calculated miles. Enter a full route in Expenses.`;
		}
	} else {
		if (!expense.receiptFile) {
			return `${label} needs a receipt file. Upload one in Expenses.`;
		}
		if (!hasName) return `${label} needs a vendor name.`;
	}
	if (expense.total <= 0) {
		return `${label} needs an amount greater than zero.`;
	}
	return null;
}

export function validateExpenses(
	expenses: readonly ValidatableExpense[],
): string | null {
	if (expenses.length === 0) {
		return "Add at least one expense.";
	}
	for (const [index, expense] of expenses.entries()) {
		const error = validateExpense(expense, `Expense ${index + 1}`);
		if (error) return error;
	}
	return null;
}

export function validateStep(
	step: WizardStep,
	form: ReportDetailsForm,
	expenses: readonly ValidatableExpense[],
): string | null {
	switch (step) {
		case 1:
		case 4:
			return null;
		case 2:
			return validateReportDetails(form);
		case 3:
			return validateExpenses(expenses);
		default: {
			const unreachable: never = step;
			return unreachable;
		}
	}
}

export function findFirstInvalidStep(
	form: ReportDetailsForm,
	expenses: readonly ValidatableExpense[],
): { step: WizardStep; message: string } | null {
	for (const step of WIZARD_STEPS) {
		const message = validateStep(step, form, expenses);
		if (message) return { step, message };
	}
	return null;
}

/** A step is reachable when every step before it validates. */
export function findReachableStep(
	form: ReportDetailsForm,
	expenses: readonly ValidatableExpense[],
): WizardStep {
	return findFirstInvalidStep(form, expenses)?.step ?? LAST_WIZARD_STEP;
}

/** Highest step the indicator may jump to: any earlier step, or a visited one that is still reachable. */
export function maxJumpableStep(
	state: WizardState,
	reachableStep: WizardStep,
): WizardStep {
	const visitedAndReachable =
		state.maxVisitedStep < reachableStep ? state.maxVisitedStep : reachableStep;
	return visitedAndReachable > state.step ? visitedAndReachable : state.step;
}

function moveTo(state: WizardState, step: WizardStep): WizardState {
	if (step === state.step) return state;
	return {
		...state,
		step,
		maxVisitedStep: step > state.maxVisitedStep ? step : state.maxVisitedStep,
	};
}

export function wizardReducer(
	state: WizardState,
	action: WizardAction,
): WizardState {
	switch (action.type) {
		case "next": {
			const target = parseWizardStep(state.step + 1);
			if (target === null || target > action.reachableStep) return state;
			return moveTo(state, target);
		}
		case "back": {
			const target = parseWizardStep(state.step - 1);
			return target === null ? state : moveTo(state, target);
		}
		case "jump":
			if (action.step > maxJumpableStep(state, action.reachableStep)) {
				return state;
			}
			return moveTo(state, action.step);
		case "restore": {
			const step = parseWizardStep(action.step) ?? FIRST_WIZARD_STEP;
			const maxVisitedStep = parseWizardStep(action.maxVisitedStep) ?? step;
			return {
				...state,
				step,
				maxVisitedStep: maxVisitedStep > step ? maxVisitedStep : step,
			};
		}
		case "reset":
			return { ...initialWizardState, submitPhase: state.submitPhase };
		case "submitStarted":
			return state.submitPhase === "submitting"
				? state
				: { ...state, submitPhase: "submitting" };
		case "submitSettled":
			return state.submitPhase === "idle"
				? state
				: { ...state, submitPhase: "idle" };
		default: {
			const unreachable: never = action;
			return unreachable;
		}
	}
}
