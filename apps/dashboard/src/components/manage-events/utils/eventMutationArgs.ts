import { normalizeDepartment, normalizeEventType } from "../constants";
import type { EventFormData, EventRequest, Invoice } from "../types";

export type ConvexInvoiceArgs = {
	id: string;
	vendor: string;
	items: Array<{
		description: string;
		quantity: number;
		unitPrice: number;
		total: number;
	}>;
	tax: number;
	tip: number;
	subtotal: number;
	total: number;
	additionalFiles: string[];
	invoiceFile?: string;
};

export function hasPersistedEventId(
	id: string | null | undefined,
): id is string {
	return typeof id === "string" && id.trim().length > 0;
}

export function resolvePersistedEventId(
	...candidates: Array<string | null | undefined>
): string | undefined {
	return candidates.find(hasPersistedEventId);
}

export function mapInvoicesForConvex(
	invoices: Invoice[],
	createId: () => string = () => crypto.randomUUID(),
): ConvexInvoiceArgs[] {
	return invoices.map((inv) => ({
		id: hasPersistedEventId(inv._id) ? inv._id : createId(),
		vendor: inv.vendor,
		items:
			inv.items.length > 0
				? inv.items
				: [
						{
							description: inv.description,
							quantity: 1,
							unitPrice: inv.amount,
							total: inv.amount,
						},
					],
		tax: inv.tax || 0,
		tip: inv.tip || 0,
		subtotal: inv.subtotal || inv.amount,
		total: inv.total || inv.amount,
		additionalFiles: inv.additionalFiles || [],
		invoiceFile: inv.invoiceFile,
	}));
}

function buildSharedEventFormFields(data: EventFormData) {
	return {
		eventName: data.eventName,
		location: data.location,
		startDate: data.startDate,
		endDate: data.endDate,
		eventDescription: data.eventDescription,
		eventType: normalizeEventType(data.eventType),
		department: data.department,
		expectedAttendance: data.estimatedAttendance,
		flyersNeeded: data.needsFlyers,
		needsGraphics: data.needsGraphics,
		needsAsFunding: data.needsASFunding,
		hasFood: data.hasFood,
		eventCode: data.eventCode,
		invoices: mapInvoicesForConvex(data.invoices),
		flyerType: data.flyerType,
		otherFlyerType: data.otherFlyerType,
		flyerAdvertisingStartDate: data.flyerAdvertisingStartDate,
		flyerAdditionalRequests: data.flyerAdditionalRequests,
		photographyNeeded: data.photographyNeeded,
		requiredLogos: data.requiredLogos,
		otherLogos: data.otherLogos,
		advertisingFormat: data.advertisingFormat,
		willOrHaveRoomBooking: data.willOrHaveRoomBooking,
		roomBookingFiles: data.roomBookingFiles,
		asFundingRequired: data.asFundingRequired,
		foodDrinksBeingServed: data.foodDrinksBeingServed,
		additionalSpecifications: data.additionalSpecifications,
		flyersCompleted: data.flyersCompleted,
		graphicsUploadNote: data.graphicsUploadNote || undefined,
	};
}

export function buildCreateEventArgs(logtoId: string, data: EventFormData) {
	return {
		logtoId,
		...buildSharedEventFormFields(data),
		isDraft: false,
	};
}

export function buildUpdateEventArgs(
	logtoId: string,
	eventId: string | null | undefined,
	data: EventFormData,
) {
	const id = resolvePersistedEventId(eventId);
	if (!id) {
		throw new Error(
			"Cannot update an event without a persisted id. Submit it as a new event request instead.",
		);
	}

	return {
		logtoId,
		id,
		...buildSharedEventFormFields(data),
	};
}

export function buildEditingRequestFromConvertedDraft({
	draftData,
	persistedId,
	createdBy,
	creationTime,
}: {
	draftData: Partial<EventRequest>;
	persistedId?: string | null;
	createdBy?: string;
	creationTime?: number;
}): EventRequest {
	const id = resolvePersistedEventId(persistedId, draftData._id);
	return {
		...draftData,
		...(id ? { _id: id } : {}),
		_creationTime: creationTime || draftData._creationTime || Date.now(),
		status: "draft",
		createdBy: createdBy || draftData.createdBy || "Unknown",
	} as EventRequest;
}
