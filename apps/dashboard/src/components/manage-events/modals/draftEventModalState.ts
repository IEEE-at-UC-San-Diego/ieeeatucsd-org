import type { EventRequest } from "../types";
import { hasPersistedEventId } from "../utils/eventMutationArgs";

export function isEditingPersistedDraft(
	initialData?: Partial<EventRequest> | null,
): boolean {
	return hasPersistedEventId(initialData?._id);
}

/**
 * Calendar-date clicks pass a date stub without `_id`. That is still a convert
 * source — only the create/edit labels should require a persisted draft id.
 */
export function canShowConvertToEventRequest(
	initialData?: Partial<EventRequest> | null,
	hasConvertHandler = false,
): boolean {
	return hasConvertHandler && initialData != null;
}

export function getDraftEventModalPresentation(
	initialData?: Partial<EventRequest> | null,
	hasConvertHandler = false,
) {
	const isEditing = isEditingPersistedDraft(initialData);
	return {
		isEditing,
		showConvertToRequest: canShowConvertToEventRequest(
			initialData,
			hasConvertHandler,
		),
		title: isEditing ? "Edit Draft Event" : "Create Quick Draft",
		submitLabel: isEditing ? "Save Draft" : "Create Draft",
	};
}
