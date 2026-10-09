import { describe, expect, it } from "vitest";
import type { EventFormData, EventRequest, Invoice } from "../types";
import {
	buildCreateEventArgs,
	buildEditingRequestFromConvertedDraft,
	buildUpdateEventArgs,
	hasPersistedEventId,
	mapInvoicesForConvex,
	resolvePersistedEventId,
} from "./eventMutationArgs";

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

describe("hasPersistedEventId", () => {
	it("accepts non-empty strings", () => {
		expect(hasPersistedEventId("jd7eventid")).toBe(true);
	});

	it("rejects missing or blank ids", () => {
		expect(hasPersistedEventId(undefined)).toBe(false);
		expect(hasPersistedEventId(null)).toBe(false);
		expect(hasPersistedEventId("")).toBe(false);
		expect(hasPersistedEventId("   ")).toBe(false);
	});
});

describe("resolvePersistedEventId", () => {
	it("returns the first persisted candidate", () => {
		expect(resolvePersistedEventId(undefined, "", "kept-id", "later")).toBe(
			"kept-id",
		);
	});

	it("returns undefined when every candidate is missing", () => {
		expect(resolvePersistedEventId(undefined, null, "")).toBeUndefined();
	});
});

describe("mapInvoicesForConvex", () => {
	it("maps invoice _id onto the Convex id field", () => {
		expect(mapInvoicesForConvex([makeInvoice()])).toEqual([
			expect.objectContaining({
				id: "inv-1",
				vendor: "Campus Rec",
				total: 150,
			}),
		]);
	});

	it("generates an invoice id when _id is missing so events:update validation passes", () => {
		const invoices = mapInvoicesForConvex(
			[makeInvoice({ _id: "" })],
			() => "generated-invoice-id",
		);
		expect(invoices[0]?.id).toBe("generated-invoice-id");
	});
});

describe("buildUpdateEventArgs", () => {
	it("includes the required top-level id for convert-draft Step 6 submit", () => {
		const args = buildUpdateEventArgs(
			"logto-user",
			"jd7saved-draft",
			makeFormData(),
		);

		expect(args).toEqual(
			expect.objectContaining({
				logtoId: "logto-user",
				id: "jd7saved-draft",
				eventName: "Muir Beach Courts volleyball with IEEE",
				location: "Muir Court",
				eventCode: "EVENT-1791571319974",
				asFundingRequired: false,
				needsAsFunding: false,
			}),
		);
		expect(args).toHaveProperty("id");
		expect(typeof args.id).toBe("string");
		expect(args.id.length).toBeGreaterThan(0);
	});

	it("reproduces the DAN-24 failure when convert-draft drops the event id", () => {
		expect(() =>
			buildUpdateEventArgs("logto-user", undefined, makeFormData()),
		).toThrow(/persisted id/i);
		expect(() =>
			buildUpdateEventArgs("logto-user", "", makeFormData()),
		).toThrow(/persisted id/i);
	});

	it("keeps invoice id populated even when the wizard invoice lacks _id", () => {
		const args = buildUpdateEventArgs(
			"logto-user",
			"jd7saved-draft",
			makeFormData({
				invoices: [makeInvoice({ _id: undefined as unknown as string })],
			}),
		);

		expect(args.invoices).toHaveLength(1);
		expect(args.invoices[0]?.id).toEqual(expect.any(String));
		expect(args.invoices[0]?.id.length).toBeGreaterThan(0);
	});
});

describe("buildCreateEventArgs", () => {
	it("omits id so unsaved convert-draft submissions create instead of update", () => {
		const args = buildCreateEventArgs("logto-user", makeFormData());
		expect(args).not.toHaveProperty("id");
		expect(args.isDraft).toBe(false);
	});
});

describe("buildEditingRequestFromConvertedDraft", () => {
	it("preserves the draft _id when converting a saved draft", () => {
		const draft: Partial<EventRequest> = {
			_id: "jd7saved-draft",
			eventName: "Volleyball",
			eventCode: "EVENT-1791571319974",
			status: "draft",
		};

		const editingRequest = buildEditingRequestFromConvertedDraft({
			draftData: { ...draft, eventCode: "EVENT-1791571319974" },
			persistedId: "jd7saved-draft",
			createdBy: "Nishant",
			creationTime: 1_791_571_319_974,
		});

		expect(editingRequest._id).toBe("jd7saved-draft");
		expect(editingRequest.status).toBe("draft");
	});

	it("keeps formData._id when the parent editingDraft pointer was already cleared", () => {
		const editingRequest = buildEditingRequestFromConvertedDraft({
			draftData: {
				_id: "jd7from-form",
				eventName: "Volleyball",
			},
			persistedId: undefined,
		});

		expect(editingRequest._id).toBe("jd7from-form");
	});

	it("does not invent an id for an unsaved calendar draft convert", () => {
		const editingRequest = buildEditingRequestFromConvertedDraft({
			draftData: {
				eventName: "Volleyball",
				eventCode: "EVENT-1791571319974",
			},
			persistedId: undefined,
		});

		expect(hasPersistedEventId(editingRequest._id)).toBe(false);
	});
});
