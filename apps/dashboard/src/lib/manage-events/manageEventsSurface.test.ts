import { describe, expect, it } from "vitest";
import { EventRequestMapping } from "@/components/manage-events/EventRequestMapping";
import type { EventRequest } from "@/components/manage-events/types";
import {
	type DeclineDialog,
	declineDialogClosed,
	isImmersiveSurface,
	type ManageEventsSurface,
	missingDeclineReasonError,
	noSurface,
	transitionDeclineDialog,
	transitionSurface,
} from "./manageEventsSurface";

function sampleRequest(overrides: Partial<EventRequest> = {}): EventRequest {
	return {
		...EventRequestMapping.fromDocument({
			_id: "events:solder",
			_creationTime: 1_760_000_000_000,
			eventName: "Soldering Night",
			eventDescription: "Learn to solder",
			eventType: "technical",
			location: "CSE 1202",
			eventCode: "SOLDER-26",
			startDate: 1_762_000_000_000,
			endDate: 1_762_003_600_000,
			status: "submitted",
		}),
		...overrides,
	};
}

describe("transitionSurface", () => {
	it("opens drafts in the draft viewer and everything else in the event viewer", () => {
		const draft = sampleRequest({ status: "draft" });
		const request = sampleRequest();

		expect(
			transitionSurface(noSurface, { type: "view", event: draft }),
		).toEqual({ kind: "draftView", draft });
		expect(
			transitionSurface(noSurface, { type: "view", event: request }),
		).toEqual({ kind: "view", request });
	});

	it("edits drafts in the draft form and requests in the wizard", () => {
		const draft = sampleRequest({ status: "draft" });
		const request = sampleRequest();
		const viewing: ManageEventsSurface = { kind: "view", request };

		expect(transitionSurface(viewing, { type: "edit", event: draft })).toEqual({
			kind: "draftEdit",
			draft,
		});
		expect(
			transitionSurface(viewing, { type: "edit", event: request }),
		).toEqual({ kind: "wizard", target: { type: "existing", request } });
	});

	it("converts a saved draft by editing it and an unsaved draft as a new request", () => {
		const saved = sampleRequest({ status: "draft" });
		expect(
			transitionSurface(noSurface, {
				type: "convertToRequest",
				request: saved,
			}),
		).toEqual({ kind: "wizard", target: { type: "existing", request: saved } });

		const prefill = { eventName: "Quick draft", status: "draft" as const };
		expect(
			transitionSurface(
				{ kind: "draftCreate", date: null },
				{
					type: "newRequest",
					prefill,
				},
			),
		).toEqual({ kind: "wizard", target: { type: "new", prefill } });
	});

	it("replaces the current surface instead of stacking", () => {
		const sheet = transitionSurface(noSurface, { type: "openCreateSheet" });
		expect(transitionSurface(sheet, { type: "newRequest" })).toEqual({
			kind: "wizard",
			target: { type: "new", prefill: undefined },
		});
		const date = new Date(2026, 10, 8);
		expect(transitionSurface(sheet, { type: "newDraft", date })).toEqual({
			kind: "draftCreate",
			date,
		});
	});

	it("only closes the surface it names", () => {
		const wizard: ManageEventsSurface = {
			kind: "wizard",
			target: { type: "new" },
		};

		expect(transitionSurface(wizard, { type: "close", kind: "wizard" })).toBe(
			noSurface,
		);
		expect(
			transitionSurface(wizard, { type: "close", kind: "draftCreate" }),
		).toBe(wizard);
	});

	it("patches the event shown in a viewer when ids match", () => {
		const request = sampleRequest();
		const viewing: ManageEventsSurface = { kind: "view", request };

		expect(
			transitionSurface(viewing, {
				type: "patchEvent",
				eventId: request._id,
				patch: { status: "published" },
			}),
		).toEqual({ kind: "view", request: { ...request, status: "published" } });
		expect(
			transitionSurface(viewing, {
				type: "patchEvent",
				eventId: "events:other",
				patch: { status: "published" },
			}),
		).toBe(viewing);
	});

	it("dismisses a viewer only for the event it shows", () => {
		const draft = sampleRequest({ status: "draft" });
		const viewing: ManageEventsSurface = { kind: "draftView", draft };
		const editing: ManageEventsSurface = { kind: "draftEdit", draft };

		expect(
			transitionSurface(viewing, {
				type: "eventDismissed",
				eventId: draft._id,
			}),
		).toBe(noSurface);
		expect(
			transitionSurface(viewing, {
				type: "eventDismissed",
				eventId: "events:other",
			}),
		).toBe(viewing);
		expect(
			transitionSurface(editing, {
				type: "eventDismissed",
				eventId: draft._id,
			}),
		).toBe(editing);
	});

	it("hides the tab bar only for full-screen surfaces", () => {
		expect(
			isImmersiveSurface({ kind: "wizard", target: { type: "new" } }),
		).toBe(true);
		expect(isImmersiveSurface({ kind: "draftCreate", date: null })).toBe(true);
		expect(isImmersiveSurface({ kind: "createSheet" })).toBe(false);
		expect(isImmersiveSurface({ kind: "weekSettings" })).toBe(false);
		expect(isImmersiveSurface(noSurface)).toBe(false);
	});
});

describe("transitionDeclineDialog", () => {
	const event = sampleRequest();
	const open = transitionDeclineDialog(declineDialogClosed, {
		type: "open",
		event,
	});

	it("opens with an empty reason", () => {
		expect(open).toEqual({ status: "open", event, reason: "" });
	});

	it("rejects an empty reason and clears the error once the reason is edited", () => {
		const invalid = transitionDeclineDialog(open, { type: "submit" });
		expect(invalid).toEqual({
			status: "open",
			event,
			reason: "",
			error: missingDeclineReasonError,
		});
		expect(
			transitionDeclineDialog(invalid, { type: "editReason", reason: "Late" }),
		).toEqual({ status: "open", event, reason: "Late" });
	});

	it("submits, then closes on success or reopens with the reason on failure", () => {
		const filled = transitionDeclineDialog(open, {
			type: "editReason",
			reason: "Room conflict",
		});
		const submitting = transitionDeclineDialog(filled, { type: "submit" });
		expect(submitting).toEqual({
			status: "submitting",
			event,
			reason: "Room conflict",
		});
		expect(transitionDeclineDialog(submitting, { type: "succeeded" })).toBe(
			declineDialogClosed,
		);
		expect(transitionDeclineDialog(submitting, { type: "failed" })).toEqual({
			status: "open",
			event,
			reason: "Room conflict",
		});
	});

	it("ignores close, edits, and reopen while submitting", () => {
		const submitting: DeclineDialog = {
			status: "submitting",
			event,
			reason: "Room conflict",
		};

		expect(transitionDeclineDialog(submitting, { type: "close" })).toBe(
			submitting,
		);
		expect(
			transitionDeclineDialog(submitting, { type: "editReason", reason: "x" }),
		).toBe(submitting);
		expect(
			transitionDeclineDialog(submitting, {
				type: "open",
				event: sampleRequest({ _id: "events:other" }),
			}),
		).toBe(submitting);
	});

	it("closes from open", () => {
		expect(transitionDeclineDialog(open, { type: "close" })).toBe(
			declineDialogClosed,
		);
	});
});
