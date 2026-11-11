import { describe, expect, it } from "vitest";
import {
	CLEAN_DOCUMENT,
	canStartSave,
	canSyncFromServer,
	DOCUMENT_SAVE_FAILED_MESSAGE,
	type DocumentSaveEvent,
	type DocumentSaveState,
	describeSaveResult,
	documentSaveReducer,
	getSaveFeedback,
	hasUnsavedChanges,
	toSaveStatus,
} from "./documentSaveState";
import type { ConstitutionDocumentSaveResult } from "./types";

const result = (
	overrides: Partial<ConstitutionDocumentSaveResult> = {},
): ConstitutionDocumentSaveResult => ({
	created: 0,
	updated: 0,
	deleted: 0,
	reordered: 0,
	total: 0,
	...overrides,
});

function run(
	events: DocumentSaveEvent[],
	start: DocumentSaveState = CLEAN_DOCUMENT,
): DocumentSaveState {
	return events.reduce(documentSaveReducer, start);
}

describe("describeSaveResult", () => {
	it("reports when nothing changed", () => {
		expect(describeSaveResult(result())).toBe("No changes detected");
	});

	it("pluralizes and breaks down the change counts", () => {
		expect(describeSaveResult(result({ created: 1, updated: 2 }))).toBe(
			"Saved 3 changes (1 created, 2 updated, 0 deleted, 0 reordered)",
		);
		expect(describeSaveResult(result({ deleted: 1 }))).toBe(
			"Saved 1 change (0 created, 0 updated, 1 deleted, 0 reordered)",
		);
	});
});

describe("documentSaveReducer: manual save", () => {
	it("marks a clean document dirty on edit", () => {
		expect(run([{ type: "edited" }])).toEqual({ kind: "dirty" });
	});

	it("keeps the same state object for repeated edits", () => {
		const dirty = run([{ type: "edited" }]);
		expect(documentSaveReducer(dirty, { type: "edited" })).toBe(dirty);
	});

	it("saves a dirty document and reports the result", () => {
		const state = run([
			{ type: "edited" },
			{ type: "saveStarted" },
			{ type: "saveSucceeded", result: result({ updated: 1 }) },
		]);

		expect(state).toEqual({
			kind: "saved",
			message: "Saved 1 change (0 created, 1 updated, 0 deleted, 0 reordered)",
		});
		expect(hasUnsavedChanges(state)).toBe(false);
	});

	it("stays dirty when edits land while a save is in flight", () => {
		const state = run([
			{ type: "edited" },
			{ type: "saveStarted" },
			{ type: "edited" },
			{ type: "saveSucceeded", result: result({ updated: 1 }) },
		]);

		expect(state).toEqual({ kind: "dirty" });
		expect(canSyncFromServer(state)).toBe(false);
	});

	it("ignores saveStarted when there is nothing to save", () => {
		expect(run([{ type: "saveStarted" }])).toBe(CLEAN_DOCUMENT);
	});

	it("does not start a second save while one is in flight", () => {
		const saving = run([
			{ type: "edited" },
			{ type: "saveStarted" },
			{ type: "edited" },
		]);
		expect(documentSaveReducer(saving, { type: "saveStarted" })).toBe(saving);
		expect(canStartSave(saving)).toBe(false);
	});

	it("fails into a dirty, retryable state", () => {
		const failed = run([
			{ type: "edited" },
			{ type: "saveStarted" },
			{ type: "saveFailed" },
		]);

		expect(failed).toEqual({
			kind: "failed",
			message: DOCUMENT_SAVE_FAILED_MESSAGE,
		});
		expect(hasUnsavedChanges(failed)).toBe(true);
		expect(canStartSave(failed)).toBe(true);
		expect(run([{ type: "saveStarted" }], failed)).toEqual({
			kind: "saving",
			dirtyDuringSave: false,
		});
	});

	it("clears the failure message once the user edits again", () => {
		const failed = run([
			{ type: "edited" },
			{ type: "saveStarted" },
			{ type: "saveFailed" },
		]);
		expect(run([{ type: "edited" }], failed)).toEqual({ kind: "dirty" });
	});

	it("ignores late results that don't match the current phase", () => {
		expect(
			run([
				{ type: "saveSucceeded", result: result() },
				{ type: "saveFailed" },
			]),
		).toBe(CLEAN_DOCUMENT);
	});
});

describe("documentSaveReducer: discarding", () => {
	it("returns dirty and failed documents to clean", () => {
		expect(run([{ type: "edited" }, { type: "discarded" }])).toBe(
			CLEAN_DOCUMENT,
		);
		expect(
			run([
				{ type: "edited" },
				{ type: "saveStarted" },
				{ type: "saveFailed" },
				{ type: "discarded" },
			]),
		).toBe(CLEAN_DOCUMENT);
	});

	it("keeps the saved confirmation when nothing is dirty", () => {
		const saved: DocumentSaveState = { kind: "saved", message: "ok" };
		expect(documentSaveReducer(saved, { type: "discarded" })).toBe(saved);
	});

	it("forgets edits made during a save without cancelling the save", () => {
		const state = run([
			{ type: "edited" },
			{ type: "saveStarted" },
			{ type: "edited" },
			{ type: "discarded" },
		]);

		expect(state).toEqual({ kind: "saving", dirtyDuringSave: false });
		expect(run([{ type: "saveSucceeded", result: result() }], state).kind).toBe(
			"saved",
		);
	});
});

describe("documentSaveReducer: version save", () => {
	it("snapshots a clean document directly", () => {
		const started = run([{ type: "versionStarted" }]);
		expect(started).toEqual({
			kind: "savingVersion",
			phase: "snapshotting",
			dirtyDuringSave: false,
		});
		expect(run([{ type: "versionSucceeded", label: "v3" }], started)).toEqual({
			kind: "saved",
			message: "Saved version v3",
		});
	});

	it("flushes a dirty document before snapshotting", () => {
		const flushing = run([{ type: "edited" }, { type: "versionStarted" }]);
		expect(flushing).toEqual({
			kind: "savingVersion",
			phase: "flushing",
			dirtyDuringSave: false,
		});

		const snapshotting = run(
			[{ type: "saveSucceeded", result: result({ updated: 1 }) }],
			flushing,
		);
		expect(snapshotting).toEqual({
			kind: "savingVersion",
			phase: "snapshotting",
			dirtyDuringSave: false,
		});
		expect(
			run([{ type: "versionSucceeded", label: "v4" }], snapshotting),
		).toEqual({ kind: "saved", message: "Saved version v4" });
	});

	it("fails the whole version save when the flush fails", () => {
		const state = run([
			{ type: "edited" },
			{ type: "versionStarted" },
			{ type: "saveFailed" },
		]);
		expect(state).toEqual({
			kind: "failed",
			message: DOCUMENT_SAVE_FAILED_MESSAGE,
		});
	});

	it("returns to clean when only the snapshot fails", () => {
		expect(run([{ type: "versionStarted" }, { type: "versionFailed" }])).toBe(
			CLEAN_DOCUMENT,
		);
	});

	it("stays dirty when edits land during any phase", () => {
		expect(
			run([
				{ type: "edited" },
				{ type: "versionStarted" },
				{ type: "edited" },
				{ type: "saveSucceeded", result: result() },
				{ type: "versionSucceeded", label: "v5" },
			]),
		).toEqual({ kind: "dirty" });
		expect(
			run([
				{ type: "versionStarted" },
				{ type: "edited" },
				{ type: "versionFailed" },
			]),
		).toEqual({ kind: "dirty" });
	});

	it("does not start while another save is in flight", () => {
		const saving = run([{ type: "edited" }, { type: "saveStarted" }]);
		expect(documentSaveReducer(saving, { type: "versionStarted" })).toBe(
			saving,
		);
	});

	it("ignores a plain saveStarted during a version save", () => {
		const flushing = run([{ type: "edited" }, { type: "versionStarted" }]);
		expect(documentSaveReducer(flushing, { type: "saveStarted" })).toBe(
			flushing,
		);
	});
});

describe("derived views", () => {
	const cases: Array<{
		state: DocumentSaveState;
		status: ReturnType<typeof toSaveStatus>;
		unsaved: boolean;
		canSync: boolean;
	}> = [
		{ state: { kind: "clean" }, status: "idle", unsaved: false, canSync: true },
		{ state: { kind: "dirty" }, status: "idle", unsaved: true, canSync: false },
		{
			state: { kind: "saving", dirtyDuringSave: false },
			status: "saving",
			unsaved: true,
			canSync: false,
		},
		{
			state: {
				kind: "savingVersion",
				phase: "flushing",
				dirtyDuringSave: false,
			},
			status: "saving",
			unsaved: true,
			canSync: false,
		},
		{
			state: {
				kind: "savingVersion",
				phase: "snapshotting",
				dirtyDuringSave: false,
			},
			status: "saving",
			unsaved: false,
			canSync: true,
		},
		{
			state: {
				kind: "savingVersion",
				phase: "snapshotting",
				dirtyDuringSave: true,
			},
			status: "saving",
			unsaved: true,
			canSync: false,
		},
		{
			state: { kind: "saved", message: "ok" },
			status: "saved",
			unsaved: false,
			canSync: true,
		},
		{
			state: { kind: "failed", message: "nope" },
			status: "error",
			unsaved: true,
			canSync: false,
		},
	];

	it.each(cases)(
		"$state.kind ($status)",
		({ state, status, unsaved, canSync }) => {
			expect(toSaveStatus(state)).toBe(status);
			expect(hasUnsavedChanges(state)).toBe(unsaved);
			expect(canSyncFromServer(state)).toBe(canSync);
		},
	);

	it("only surfaces feedback for settled saves", () => {
		expect(getSaveFeedback({ kind: "saved", message: "ok" })).toEqual({
			tone: "success",
			message: "ok",
		});
		expect(getSaveFeedback({ kind: "failed", message: "nope" })).toEqual({
			tone: "danger",
			message: "nope",
		});
		expect(getSaveFeedback({ kind: "dirty" })).toBeNull();
		expect(
			getSaveFeedback({ kind: "saving", dirtyDuringSave: false }),
		).toBeNull();
	});
});
