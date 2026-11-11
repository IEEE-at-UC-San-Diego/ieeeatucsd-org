import { describe, expect, it } from "vitest";
import {
	canGoBack,
	canGoNext,
	canStartSave,
	canStartSubmit,
	createWizardState,
	isEditablePhase,
	isPendingPhase,
	type WizardAction,
	type WizardPhase,
	type WizardState,
	wizardReducer,
} from "./wizardState";

const run = (state: WizardState, ...actions: WizardAction[]) =>
	actions.reduce(wizardReducer, state);

const withPhase = (state: WizardState, phase: WizardPhase): WizardState => ({
	...state,
	phase,
});

describe("createWizardState", () => {
	it("starts editing on step 1 by default", () => {
		expect(createWizardState(3)).toEqual({
			step: 1,
			stepCount: 3,
			phase: { kind: "editing" },
		});
	});

	it("clamps the initial step into range", () => {
		expect(createWizardState(3, 0).step).toBe(1);
		expect(createWizardState(3, 9).step).toBe(3);
		expect(createWizardState(6, 2).step).toBe(2);
	});
});

describe("phase predicates", () => {
	const cases: Array<[WizardPhase, boolean, boolean]> = [
		[{ kind: "editing" }, true, false],
		[{ kind: "failed", message: "x" }, true, false],
		[{ kind: "saving" }, false, true],
		[{ kind: "submitting" }, false, true],
		[{ kind: "succeeded" }, false, false],
	];

	it.each(cases)("%o editable=%s pending=%s", (phase, editable, pending) => {
		expect(isEditablePhase(phase)).toBe(editable);
		expect(isPendingPhase(phase)).toBe(pending);
	});
});

describe("navigation", () => {
	it("moves forward and back within bounds", () => {
		const state = createWizardState(3);

		expect(run(state, { type: "next" }).step).toBe(2);
		expect(run(state, { type: "next" }, { type: "next" }).step).toBe(3);
		expect(
			run(state, { type: "next" }, { type: "next" }, { type: "next" }).step,
		).toBe(3);
		expect(run(state, { type: "back" })).toBe(state);
		expect(run(state, { type: "next" }, { type: "back" }).step).toBe(1);
	});

	it("keeps a failed message while navigating", () => {
		const failed = withPhase(createWizardState(3, 2), {
			kind: "failed",
			message: "Save failed",
		});

		const next = run(failed, { type: "next" });

		expect(next.step).toBe(3);
		expect(next.phase).toEqual({ kind: "failed", message: "Save failed" });
	});

	it.each<WizardPhase>([
		{ kind: "saving" },
		{ kind: "submitting" },
		{ kind: "succeeded" },
	])("is locked while %o", (phase) => {
		const state = withPhase(createWizardState(3, 2), phase);

		expect(canGoNext(state)).toBe(false);
		expect(canGoBack(state)).toBe(false);
		expect(run(state, { type: "next" })).toBe(state);
		expect(run(state, { type: "back" })).toBe(state);
	});
});

describe("save", () => {
	it("goes editing → saving → editing", () => {
		const saving = run(createWizardState(3, 2), { type: "saveStarted" });
		expect(saving.phase).toEqual({ kind: "saving" });

		const saved = run(saving, { type: "saveSucceeded" });
		expect(saved.phase).toEqual({ kind: "editing" });
		expect(saved.step).toBe(2);
	});

	it("records the failure message and allows a retry", () => {
		const failed = run(
			createWizardState(3),
			{ type: "saveStarted" },
			{ type: "saveFailed", message: "Offline" },
		);
		expect(failed.phase).toEqual({ kind: "failed", message: "Offline" });
		expect(canStartSave(failed)).toBe(true);
		expect(run(failed, { type: "saveStarted" }).phase).toEqual({
			kind: "saving",
		});
	});

	it("cannot overlap with submit", () => {
		const submitting = run(createWizardState(3, 3), { type: "submitStarted" });

		expect(canStartSave(submitting)).toBe(false);
		expect(run(submitting, { type: "saveStarted" })).toBe(submitting);
	});

	it("ignores stray save results", () => {
		const state = createWizardState(3);

		expect(run(state, { type: "saveSucceeded" })).toBe(state);
		expect(run(state, { type: "saveFailed", message: "x" })).toBe(state);
	});
});

describe("submit", () => {
	it("only starts from the last step", () => {
		const middle = createWizardState(3, 2);

		expect(canStartSubmit(middle)).toBe(false);
		expect(run(middle, { type: "submitStarted" })).toBe(middle);
		expect(canStartSubmit(createWizardState(3, 3))).toBe(true);
	});

	it("goes submitting → succeeded and stays terminal", () => {
		const succeeded = run(
			createWizardState(3, 3),
			{ type: "submitStarted" },
			{ type: "submitSucceeded" },
		);
		expect(succeeded.phase).toEqual({ kind: "succeeded" });

		expect(run(succeeded, { type: "submitStarted" })).toBe(succeeded);
		expect(run(succeeded, { type: "saveStarted" })).toBe(succeeded);
		expect(run(succeeded, { type: "back" })).toBe(succeeded);
		expect(run(succeeded, { type: "dismissError" })).toBe(succeeded);
	});

	it("cannot overlap with save", () => {
		const saving = run(createWizardState(3, 3), { type: "saveStarted" });

		expect(canStartSubmit(saving)).toBe(false);
		expect(run(saving, { type: "submitStarted" })).toBe(saving);
	});

	it("rejects a second submit while one is in flight", () => {
		const submitting = run(createWizardState(3, 3), { type: "submitStarted" });

		expect(canStartSubmit(submitting)).toBe(false);
		expect(run(submitting, { type: "submitStarted" })).toBe(submitting);
	});

	it("records failure and can be retried or dismissed", () => {
		const failed = run(
			createWizardState(3, 3),
			{ type: "submitStarted" },
			{ type: "submitFailed", message: "Server error" },
		);
		expect(failed.phase).toEqual({ kind: "failed", message: "Server error" });
		expect(run(failed, { type: "dismissError" }).phase).toEqual({
			kind: "editing",
		});
		expect(run(failed, { type: "submitStarted" }).phase).toEqual({
			kind: "submitting",
		});
	});

	it("ignores stray submit results", () => {
		const state = createWizardState(3, 3);

		expect(run(state, { type: "submitSucceeded" })).toBe(state);
		expect(run(state, { type: "submitFailed", message: "x" })).toBe(state);
	});
});

describe("reset", () => {
	it("returns to editing on the requested step after success or failure", () => {
		const succeeded = run(
			createWizardState(6, 6),
			{ type: "submitStarted" },
			{ type: "submitSucceeded" },
		);
		const failed = withPhase(createWizardState(3, 3), {
			kind: "failed",
			message: "x",
		});

		expect(run(succeeded, { type: "reset", step: 2 })).toEqual({
			step: 2,
			stepCount: 6,
			phase: { kind: "editing" },
		});
		expect(run(failed, { type: "reset", step: 1 })).toEqual(
			createWizardState(3),
		);
	});

	it.each<WizardPhase>([{ kind: "saving" }, { kind: "submitting" }])(
		"is ignored while %o so the request can settle",
		(phase) => {
			const pending = withPhase(createWizardState(3, 3), phase);

			expect(run(pending, { type: "reset", step: 1 })).toBe(pending);
		},
	);
});
