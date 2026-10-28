import type {
	CalendarDate,
	QuarterStartSettings,
} from "@/lib/vco/VcoDeadlines";
import { VcoDeadlines, type VcoPipelineStatus } from "@/lib/vco/VcoDeadlines";
import type { EventFilters, EventRequest, SortConfig } from "../types";

export function matchesListFilters(
	event: EventRequest,
	filters: EventFilters,
	options?: { includePipelineSearch?: boolean },
): boolean {
	const query = filters.search.trim().toLowerCase();
	const searchMatch =
		!query ||
		event.eventName.toLowerCase().includes(query) ||
		event.eventDescription.toLowerCase().includes(query) ||
		event.location.toLowerCase().includes(query) ||
		Boolean(
			options?.includePipelineSearch &&
				((event.finId || "").toLowerCase().includes(query) ||
					event.createdBy.toLowerCase().includes(query)),
		);

	const statusMatch =
		!filters.statuses || filters.statuses.length === 0
			? true
			: filters.statuses.includes(event.status);

	let teamPresetMatch = true;
	if (filters.teamPreset === "for_internal") {
		const hasMarketingNeed = Boolean(
			event.needsGraphics || event.needsFlyers || event.photographyNeeded,
		);
		teamPresetMatch =
			(event.status === "approved" || event.status === "published") &&
			hasMarketingNeed;
	} else if (filters.teamPreset === "for_operations") {
		teamPresetMatch = ["submitted", "pending", "needs_review"].includes(
			event.status,
		);
	}

	return searchMatch && statusMatch && teamPresetMatch;
}

export function matchesVcoExtraFilters(
	status: VcoPipelineStatus,
	filters: Pick<EventFilters, "flaggedOnly" | "thisQuarter" | "needsDate">,
	today: CalendarDate,
	settings?: QuarterStartSettings,
): boolean {
	if (filters.needsDate && !status.needsDate) return false;
	if (filters.flaggedOnly && status.flags.length === 0) return false;
	if (
		filters.thisQuarter &&
		!status.needsDate &&
		status.eventDate &&
		!VcoDeadlines.isInCurrentQuarter(status.eventDate, today, settings)
	) {
		return false;
	}
	return true;
}

export function sortEvents(
	events: EventRequest[],
	sortConfig: SortConfig,
	pipelineById?: Record<string, VcoPipelineStatus>,
): EventRequest[] {
	if (sortConfig.field === "nextDeadline" && pipelineById) {
		const rows = events.map((event) => ({
			event,
			status: pipelineById[event._id],
		}));
		const sorted = VcoDeadlines.sortByNextDeadline(rows);
		if (sortConfig.direction === "desc") {
			const dated = sorted.filter(
				(row) => !row.status.needsDate && row.status.nextDeadline,
			);
			const undated = sorted.filter(
				(row) => row.status.needsDate || !row.status.nextDeadline,
			);
			return [...dated.reverse(), ...undated].map((row) => row.event);
		}
		return sorted.map((row) => row.event);
	}

	return [...events].sort((a, b) => {
		const aValue = a[sortConfig.field as keyof EventRequest];
		const bValue = b[sortConfig.field as keyof EventRequest];

		if (
			aValue === undefined ||
			aValue === null ||
			bValue === undefined ||
			bValue === null
		) {
			return 0;
		}

		const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
		return sortConfig.direction === "asc" ? comparison : -comparison;
	});
}
