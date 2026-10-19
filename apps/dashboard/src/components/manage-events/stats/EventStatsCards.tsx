import { SummaryStrip } from "@/components/dashboard/SummaryStrip";
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
				{ label: "events", value: stats.totalEvents.toLocaleString() },
				{ label: "published", value: stats.publishedEvents.toLocaleString() },
				{ label: "attendees", value: stats.totalAttendees.toLocaleString() },
			]}
		/>
	);
}
