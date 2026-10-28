import { VcoDeadlines } from "@/lib/vco/VcoDeadlines";

export function formatManageEventDate(
	startDate: number,
	options?: { dateTbd?: boolean },
): string {
	if (options?.dateTbd) return "Needs date";
	return VcoDeadlines.formatEventDate(startDate);
}
