import { SummaryStrip } from "@/components/dashboard/SummaryStrip";
import { formatNumber } from "@/lib/formatters";
import type { EventStats } from "../types";

interface EventStatsCardsProps {
	stats: EventStats;
	loading?: boolean;
}

export function EventStatsCards({
	stats,
	loading = false,
}: EventStatsCardsProps) {
	return (
		<SummaryStrip
			loading={loading}
			items={[
				{ label: "events", value: formatNumber(stats.totalEvents) },
				{ label: "published", value: formatNumber(stats.publishedEvents) },
				{ label: "attendees", value: formatNumber(stats.totalAttendees) },
			]}
		/>
	);
}
