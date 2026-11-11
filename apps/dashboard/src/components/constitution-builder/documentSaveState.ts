import type { ConstitutionDocumentSaveResult, SaveStatus } from "./types";

type InFlightSave =
	| { kind: "saving"; dirtyDuringSave: boolean }
	| {
			kind: "savingVersion";
			phase: "flushing" | "snapshotting";
			dirtyDuringSave: boolean;
	  };

export type DocumentSaveState =
	| { kind: "clean" }
	| { kind: "dirty" }
	| InFlightSave
	| { kind: "saved"; message: string }
	| { kind: "failed"; message: string };

export type DocumentSaveEvent =
	| { type: "edited" }
	| { type: "discarded" }
	| { type: "saveStarted" }
	| { type: "saveSucceeded"; result: ConstitutionDocumentSaveResult }
	| { type: "saveFailed" }
	| { type: "versionStarted" }
	| { type: "versionSucceeded"; label: string }
	| { type: "versionFailed" };

export type DocumentSaveFeedback = {
	tone: "success" | "danger";
	message: string;
};

export const CLEAN_DOCUMENT: DocumentSaveState = { kind: "clean" };

export const DOCUMENT_SAVE_FAILED_MESSAGE =
	"Failed to save changes. Check your connection and try again.";

export function describeSaveResult(
	result: ConstitutionDocumentSaveResult,
): string {
	const changedCount =
		result.created + result.updated + result.deleted + result.reordered;
	if (changedCount === 0) return "No changes detected";
	return `Saved ${changedCount} change${changedCount > 1 ? "s" : ""} (${result.created} created, ${result.updated} updated, ${result.deleted} deleted, ${result.reordered} reordered)`;
}

/** True while there are edits the server hasn't confirmed; drives the navigation guard. */
export function hasUnsavedChanges(state: DocumentSaveState): boolean {
	switch (state.kind) {
		case "dirty":
		case "failed":
		case "saving":
			return true;
		case "savingVersion":
			return state.phase === "flushing" || state.dirtyDuringSave;
		case "clean":
		case "saved":
			return false;
		default: {
			const unhandled: never = state;
			return unhandled;
		}
	}
}

export function canStartSave(state: DocumentSaveState): boolean {
	return state.kind === "dirty" || state.kind === "failed";
}

export function isSaveInFlight(
	state: DocumentSaveState,
): state is InFlightSave {
	return state.kind === "saving" || state.kind === "savingVersion";
}

/** True while the document itself (not a version snapshot) is being written. */
export function isWritingDocument(state: DocumentSaveState): boolean {
	return (
		state.kind === "saving" ||
		(state.kind === "savingVersion" && state.phase === "flushing")
	);
}

/** Server content may replace the editor only when that can't clobber local edits or race a write. */
export function canSyncFromServer(state: DocumentSaveState): boolean {
	return !hasUnsavedChanges(state) && !isWritingDocument(state);
}

export function toSaveStatus(state: DocumentSaveState): SaveStatus {
	switch (state.kind) {
		case "clean":
		case "dirty":
			return "idle";
		case "saving":
		case "savingVersion":
			return "saving";
		case "saved":
			return "saved";
		case "failed":
			return "error";
		default: {
			const unhandled: never = state;
			return unhandled;
		}
	}
}

export function getSaveFeedback(
	state: DocumentSaveState,
): DocumentSaveFeedback | null {
	switch (state.kind) {
		case "saved":
			return { tone: "success", message: state.message };
		case "failed":
			return { tone: "danger", message: state.message };
		case "clean":
		case "dirty":
		case "saving":
		case "savingVersion":
			return null;
		default: {
			const unhandled: never = state;
			return unhandled;
		}
	}
}

function settle(
	dirtyDuringSave: boolean,
	settled: DocumentSaveState,
): DocumentSaveState {
	return dirtyDuringSave ? { kind: "dirty" } : settled;
}

export function documentSaveReducer(
	state: DocumentSaveState,
	event: DocumentSaveEvent,
): DocumentSaveState {
	switch (event.type) {
		case "edited":
			if (isSaveInFlight(state)) {
				return state.dirtyDuringSave
					? state
					: { ...state, dirtyDuringSave: true };
			}
			return state.kind === "dirty" ? state : { kind: "dirty" };
		case "discarded":
			if (isSaveInFlight(state)) {
				return state.dirtyDuringSave
					? { ...state, dirtyDuringSave: false }
					: state;
			}
			return state.kind === "dirty" || state.kind === "failed"
				? CLEAN_DOCUMENT
				: state;
		case "saveStarted":
			return canStartSave(state)
				? { kind: "saving", dirtyDuringSave: false }
				: state;
		case "saveSucceeded":
			if (state.kind === "saving") {
				return settle(state.dirtyDuringSave, {
					kind: "saved",
					message: describeSaveResult(event.result),
				});
			}
			if (state.kind === "savingVersion" && state.phase === "flushing") {
				return { ...state, phase: "snapshotting" };
			}
			return state;
		case "saveFailed":
			return isWritingDocument(state)
				? { kind: "failed", message: DOCUMENT_SAVE_FAILED_MESSAGE }
				: state;
		case "versionStarted":
			if (isSaveInFlight(state)) return state;
			return {
				kind: "savingVersion",
				phase: canStartSave(state) ? "flushing" : "snapshotting",
				dirtyDuringSave: false,
			};
		case "versionSucceeded":
			return state.kind === "savingVersion" && state.phase === "snapshotting"
				? settle(state.dirtyDuringSave, {
						kind: "saved",
						message: `Saved version ${event.label}`,
					})
				: state;
		case "versionFailed":
			return state.kind === "savingVersion" && state.phase === "snapshotting"
				? settle(state.dirtyDuringSave, CLEAN_DOCUMENT)
				: state;
		default: {
			const unhandled: never = event;
			return unhandled;
		}
	}
}
