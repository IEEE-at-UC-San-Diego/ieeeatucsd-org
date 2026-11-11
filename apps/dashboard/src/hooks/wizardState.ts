export type WizardPhase =
	| { kind: "editing" }
	| { kind: "saving" }
	| { kind: "submitting" }
	| { kind: "succeeded" }
	| { kind: "failed"; message: string };

export interface WizardState {
	/** 1-based. */
	step: number;
	stepCount: number;
	phase: WizardPhase;
}

export type WizardAction =
	| { type: "next" }
	| { type: "back" }
	| { type: "reset"; step: number }
	| { type: "saveStarted" }
	| { type: "saveSucceeded" }
	| { type: "saveFailed"; message: string }
	| { type: "submitStarted" }
	| { type: "submitSucceeded" }
	| { type: "submitFailed"; message: string }
	| { type: "dismissError" };

const EDITING: WizardPhase = { kind: "editing" };

const clampStep = (step: number, stepCount: number) =>
	Math.min(Math.max(step, 1), stepCount);

export function createWizardState(stepCount: number, step = 1): WizardState {
	return { step: clampStep(step, stepCount), stepCount, phase: EDITING };
}

/** The form is interactive: nothing in flight and not finished. */
export function isEditablePhase(phase: WizardPhase): boolean {
	return phase.kind === "editing" || phase.kind === "failed";
}

/** A save or submit request is in flight. */
export function isPendingPhase(phase: WizardPhase): boolean {
	return phase.kind === "saving" || phase.kind === "submitting";
}

export function canGoNext(state: WizardState): boolean {
	return isEditablePhase(state.phase) && state.step < state.stepCount;
}

export function canGoBack(state: WizardState): boolean {
	return isEditablePhase(state.phase) && state.step > 1;
}

export function canStartSave(state: WizardState): boolean {
	return isEditablePhase(state.phase);
}

export function canStartSubmit(state: WizardState): boolean {
	return isEditablePhase(state.phase) && state.step === state.stepCount;
}

export function wizardReducer(
	state: WizardState,
	action: WizardAction,
): WizardState {
	switch (action.type) {
		case "next":
			return canGoNext(state) ? { ...state, step: state.step + 1 } : state;
		case "back":
			return canGoBack(state) ? { ...state, step: state.step - 1 } : state;
		case "reset":
			return isPendingPhase(state.phase)
				? state
				: createWizardState(state.stepCount, action.step);
		case "saveStarted":
			return canStartSave(state)
				? { ...state, phase: { kind: "saving" } }
				: state;
		case "saveSucceeded":
			return state.phase.kind === "saving"
				? { ...state, phase: EDITING }
				: state;
		case "saveFailed":
			return state.phase.kind === "saving"
				? { ...state, phase: { kind: "failed", message: action.message } }
				: state;
		case "submitStarted":
			return canStartSubmit(state)
				? { ...state, phase: { kind: "submitting" } }
				: state;
		case "submitSucceeded":
			return state.phase.kind === "submitting"
				? { ...state, phase: { kind: "succeeded" } }
				: state;
		case "submitFailed":
			return state.phase.kind === "submitting"
				? { ...state, phase: { kind: "failed", message: action.message } }
				: state;
		case "dismissError":
			return state.phase.kind === "failed"
				? { ...state, phase: EDITING }
				: state;
		default: {
			const exhaustive: never = action;
			return exhaustive;
		}
	}
}
