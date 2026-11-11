import type { EventRequest } from "@/components/manage-events/types";

export type WizardTarget =
	| { type: "new"; prefill?: Partial<EventRequest> }
	| { type: "existing"; request: EventRequest };

export type ManageEventsSurface =
	| { kind: "none" }
	| { kind: "createSheet" }
	| { kind: "weekSettings" }
	| { kind: "wizard"; target: WizardTarget }
	| { kind: "view"; request: EventRequest }
	| { kind: "draftView"; draft: EventRequest }
	| { kind: "draftCreate"; date: Date | null }
	| { kind: "draftEdit"; draft: EventRequest };

export type ManageEventsSurfaceKind = ManageEventsSurface["kind"];

export type ManageEventsSurfaceEvent =
	| { type: "openCreateSheet" }
	| { type: "openWeekSettings" }
	| { type: "newRequest"; prefill?: Partial<EventRequest> }
	| { type: "newDraft"; date: Date | null }
	| { type: "view"; event: EventRequest }
	| { type: "edit"; event: EventRequest }
	| { type: "convertToRequest"; request: EventRequest }
	| { type: "close"; kind: ManageEventsSurfaceKind }
	| { type: "patchEvent"; eventId: string; patch: Partial<EventRequest> }
	| { type: "eventDismissed"; eventId: string };

export const noSurface: ManageEventsSurface = { kind: "none" };

function surfaceEvent(surface: ManageEventsSurface): EventRequest | null {
	switch (surface.kind) {
		case "view":
			return surface.request;
		case "draftView":
			return surface.draft;
		case "none":
		case "createSheet":
		case "weekSettings":
		case "wizard":
		case "draftCreate":
		case "draftEdit":
			return null;
		default: {
			const exhaustive: never = surface;
			return exhaustive;
		}
	}
}

export function transitionSurface(
	surface: ManageEventsSurface,
	event: ManageEventsSurfaceEvent,
): ManageEventsSurface {
	switch (event.type) {
		case "openCreateSheet":
			return { kind: "createSheet" };
		case "openWeekSettings":
			return { kind: "weekSettings" };
		case "newRequest":
			return {
				kind: "wizard",
				target: { type: "new", prefill: event.prefill },
			};
		case "newDraft":
			return { kind: "draftCreate", date: event.date };
		case "view":
			return event.event.status === "draft"
				? { kind: "draftView", draft: event.event }
				: { kind: "view", request: event.event };
		case "edit":
			return event.event.status === "draft"
				? { kind: "draftEdit", draft: event.event }
				: {
						kind: "wizard",
						target: { type: "existing", request: event.event },
					};
		case "convertToRequest":
			return {
				kind: "wizard",
				target: { type: "existing", request: event.request },
			};
		case "close":
			return surface.kind === event.kind ? noSurface : surface;
		case "patchEvent": {
			const shown = surfaceEvent(surface);
			if (!shown || shown._id !== event.eventId) return surface;
			const patched = { ...shown, ...event.patch };
			return surface.kind === "view"
				? { kind: "view", request: patched }
				: { kind: "draftView", draft: patched };
		}
		case "eventDismissed":
			return surfaceEvent(surface)?._id === event.eventId ? noSurface : surface;
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
}

export function isImmersiveSurface(surface: ManageEventsSurface): boolean {
	switch (surface.kind) {
		case "wizard":
		case "view":
		case "draftView":
		case "draftCreate":
		case "draftEdit":
			return true;
		case "none":
		case "createSheet":
		case "weekSettings":
			return false;
		default: {
			const exhaustive: never = surface;
			return exhaustive;
		}
	}
}

export type PendingAction =
	| "createRequest"
	| "saveRequest"
	| "updateRequest"
	| "delete"
	| "convertToDraft"
	| "statusChange"
	| "togglePublish"
	| "updateGraphics"
	| "createDraft"
	| "updateDraft";

export type DeclineDialog =
	| { status: "closed" }
	| { status: "open"; event: EventRequest; reason: string; error?: string }
	| { status: "submitting"; event: EventRequest; reason: string };

export type DeclineDialogEvent =
	| { type: "open"; event: EventRequest }
	| { type: "editReason"; reason: string }
	| { type: "submit" }
	| { type: "succeeded" }
	| { type: "failed" }
	| { type: "close" };

export const declineDialogClosed: DeclineDialog = { status: "closed" };

export const missingDeclineReasonError =
	"Enter a reason so the requester knows what to change.";

export function transitionDeclineDialog(
	dialog: DeclineDialog,
	event: DeclineDialogEvent,
): DeclineDialog {
	switch (event.type) {
		case "open":
			return dialog.status === "submitting"
				? dialog
				: { status: "open", event: event.event, reason: "" };
		case "editReason":
			return dialog.status === "open"
				? { status: "open", event: dialog.event, reason: event.reason }
				: dialog;
		case "submit":
			if (dialog.status !== "open") return dialog;
			if (!dialog.reason) {
				return { ...dialog, error: missingDeclineReasonError };
			}
			return {
				status: "submitting",
				event: dialog.event,
				reason: dialog.reason,
			};
		case "succeeded":
			return dialog.status === "submitting" ? declineDialogClosed : dialog;
		case "failed":
			return dialog.status === "submitting"
				? { status: "open", event: dialog.event, reason: dialog.reason }
				: dialog;
		case "close":
			return dialog.status === "open" ? declineDialogClosed : dialog;
		default: {
			const exhaustive: never = event;
			return exhaustive;
		}
	}
}
