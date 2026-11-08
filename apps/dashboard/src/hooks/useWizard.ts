import { useCallback, useReducer } from "react";
import {
	canGoNext,
	canStartSave,
	canStartSubmit,
	createWizardState,
	isEditablePhase,
	isPendingPhase,
	wizardReducer,
} from "./wizardState";

interface UseWizardOptions {
	stepCount: number;
	initialStep?: number;
	/** Called with the current step before advancing; may record validation errors. */
	canAdvance?: (step: number) => boolean;
}

/**
 * Step index plus a save/submit phase. Navigation is locked while a request is
 * in flight or after submit succeeds; `start*` return false when the
 * transition is not allowed so callers can skip the request.
 */
export function useWizard({
	stepCount,
	initialStep = 1,
	canAdvance,
}: UseWizardOptions) {
	const [state, dispatch] = useReducer(wizardReducer, undefined, () =>
		createWizardState(stepCount, initialStep),
	);

	const next = () => {
		if (!canGoNext(state)) return false;
		if (canAdvance && !canAdvance(state.step)) return false;
		dispatch({ type: "next" });
		return true;
	};

	const startSave = () => {
		if (!canStartSave(state)) return false;
		dispatch({ type: "saveStarted" });
		return true;
	};

	const startSubmit = () => {
		if (!canStartSubmit(state)) return false;
		dispatch({ type: "submitStarted" });
		return true;
	};

	const back = useCallback(() => dispatch({ type: "back" }), []);
	const reset = useCallback(
		(step = 1) => dispatch({ type: "reset", step }),
		[],
	);
	const saveSucceeded = useCallback(
		() => dispatch({ type: "saveSucceeded" }),
		[],
	);
	const saveFailed = useCallback(
		(message: string) => dispatch({ type: "saveFailed", message }),
		[],
	);
	const submitSucceeded = useCallback(
		() => dispatch({ type: "submitSucceeded" }),
		[],
	);
	const submitFailed = useCallback(
		(message: string) => dispatch({ type: "submitFailed", message }),
		[],
	);
	const dismissError = useCallback(
		() => dispatch({ type: "dismissError" }),
		[],
	);

	return {
		step: state.step,
		stepCount: state.stepCount,
		phase: state.phase,
		isFirstStep: state.step === 1,
		isLastStep: state.step === state.stepCount,
		isEditable: isEditablePhase(state.phase),
		isPending: isPendingPhase(state.phase),
		errorMessage: state.phase.kind === "failed" ? state.phase.message : null,
		next,
		back,
		reset,
		startSave,
		saveSucceeded,
		saveFailed,
		startSubmit,
		submitSucceeded,
		submitFailed,
		dismissError,
	};
}
