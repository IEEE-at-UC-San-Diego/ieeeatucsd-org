import { describe, expect, it } from "vitest";
import type { EventFormData, EventRequest, Invoice } from "../types";
import {
	buildCreateEventArgs,
	buildEditingRequestFromConvertedDraft,
	buildUpdateEventArgs,
	hasPersistedEventId,
} from "../utils/eventMutationArgs";
import {
	canShowConvertToEventRequest,
	getDraftEventModalPresentation,
	isEditingPersistedDraft,
} from "./draftEventModalState";

function calendarDateStub(startDate = 1_791_571_319_974): Partial<EventRequest> {
	return {
		startDate,
		endDate: startDate + 3_600_000,
	};
}

function makeFormData(overrides: Partial<EventFormData> = {}): EventFormData {
	return {
		eventName: "Muir Beach Courts volleyball with IEEE",
		eventDescription: "Casual volleyball at Muir Beach Courts with IEEE",
		eventType: "social",
		department: "events",
		location: "Muir Court",
		startDate: 1_791_571_319_974,
		endDate: 1_791_574_919_974,
		eventCode: "EVENT-1791571319974",
		hasFood: false,
		needsFlyers: true,
		needsGraphics: true,
		needsASFunding: false,
		estimatedAttendance: 15,
		files: [],
		invoices: [],
		willOrHaveRoomBooking: false,
		roomBookingFiles: [],
		foodDrinksBeingServed: false,
		asFundingRequired: false,
		flyerType: ["Digital flyer"],
		otherFlyerType: "",
		flyerAdvertisingStartDate: 0,
		flyerAdditionalRequests: "",
		photographyNeeded: false,
		requiredLogos: ["IEEE logo"],
		otherLogos: [],
		advertisingFormat: "Digital flyer",
		additionalSpecifications: "",
		flyersCompleted: false,
		graphicsUploadNote: "",
		...overrides,
	};
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
	return {
		_id: "inv-1",
		vendor: "Campus Rec",
		items: [
			{
				description: "Court reservation",
				quantity: 1,
				unitPrice: 150,
				total: 150,
			},
		],
		tax: 0,
		tip: 0,
		additionalFiles: [],
		subtotal: 150,
		total: 150,
		amount: 150,
		description: "Court reservation",
		...overrides,
	};
}

describe("draft event modal presentation", () => {
	it("shows Convert to Event Request for a calendar-date stub without _id", () => {
		const chrome = getDraftEventModalPresentation(calendarDateStub(), true);

		expect(canShowConvertToEventRequest(calendarDateStub(), true)).toBe(true);
		expect(chrome.showConvertToRequest).toBe(true);
		expect(chrome.isEditing).toBe(false);
		expect(chrome.title).toBe("Create Quick Draft");
		expect(chrome.submitLabel).toBe("Create Draft");
	});

	it("treats a persisted draft as editing and still shows convert", () => {
		const chrome = getDraftEventModalPresentation(
			{ _id: "jd7saved-draft", eventName: "Volleyball" },
			true,
		);

		expect(isEditingPersistedDraft({ _id: "jd7saved-draft" })).toBe(true);
		expect(chrome.showConvertToRequest).toBe(true);
		expect(chrome.isEditing).toBe(true);
		expect(chrome.title).toBe("Edit Draft Event");
		expect(chrome.submitLabel).toBe("Save Draft");
	});

	it("hides convert on a blank create and when no convert handler is passed", () => {
		expect(
			getDraftEventModalPresentation(undefined, true).showConvertToRequest,
		).toBe(false);
		expect(
			getDraftEventModalPresentation(calendarDateStub(), false)
				.showConvertToRequest,
		).toBe(false);
	});
});

describe("calendar-date convert still uses create, saved drafts use update", () => {
	it("routes an unsaved calendar convert through create without inventing an id", () => {
		const editingRequest = buildEditingRequestFromConvertedDraft({
			draftData: {
				...calendarDateStub(),
				eventName: "Volleyball",
				eventCode: "EVENT-1791571319974",
			},
			persistedId: undefined,
		});

		expect(hasPersistedEventId(editingRequest._id)).toBe(false);
		expect(buildCreateEventArgs("logto-user", makeFormData())).not.toHaveProperty(
			"id",
		);
		expect(() =>
			buildUpdateEventArgs("logto-user", editingRequest._id, makeFormData()),
		).toThrow(/persisted id/i);
	});

	it("keeps a saved-draft convert on update and always sends invoice id", () => {
		const editingRequest = buildEditingRequestFromConvertedDraft({
			draftData: {
				_id: "jd7saved-draft",
				eventName: "Volleyball",
				eventCode: "EVENT-1791571319974",
			},
			persistedId: "jd7saved-draft",
		});

		expect(editingRequest._id).toBe("jd7saved-draft");
		const args = buildUpdateEventArgs(
			"logto-user",
			editingRequest._id,
			makeFormData({ invoices: [makeInvoice({ _id: "" })] }),
		);
		expect(args.id).toBe("jd7saved-draft");
		expect(args.invoices[0]?.id).toEqual(expect.any(String));
		expect(args.invoices[0]?.id.length).toBeGreaterThan(0);
	});
});
