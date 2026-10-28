import type { EventRequest } from "@/components/manage-events/types";
import {
	type VcoDeadlineConfig,
	VcoDeadlines,
	type VcoEventInput,
	type VcoPipelineStatus,
} from "./VcoDeadlines";

export function toVcoEventInput(event: EventRequest): VcoEventInput {
	return {
		eventName: event.eventName,
		startDate: event.startDate,
		dateTbd: event.dateTbd,
		createdAt: event.createdAt ?? event._creationTime,
		location: event.location,
		expectedAttendance: event.estimatedAttendance,
		invoices: event.invoices.map((invoice) => ({
			total: invoice.total,
			vendor: invoice.vendor,
			invoiceFile: invoice.invoiceFile,
			description: invoice.description,
			items: invoice.items,
		})),
		hasFood: event.hasFood,
		foodDrinksBeingServed: event.foodDrinksBeingServed,
		needsAsFunding: event.needsASFunding,
		asFundingRequired: event.asFundingRequired,
		funded: event.funded,
		tresOwner: event.tresOwner,
	};
}

export function computeEventPipelineStatus(
	event: EventRequest,
	config: VcoDeadlineConfig = {},
): VcoPipelineStatus {
	return VcoDeadlines.compute(toVcoEventInput(event), config);
}
