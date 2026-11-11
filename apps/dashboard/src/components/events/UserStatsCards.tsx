import { SummaryStrip } from "@/components/dashboard/SummaryStrip";
import { formatNumber, formatShortDate } from "@/lib/formatters";

interface UserStatsCardsProps {
	latestEvent?: {
		eventName: string;
		eventDate: number;
	};
	totalPoints: number;
	eventsAttended: number;
	loading?: boolean;
}

export function UserStatsCards({
	latestEvent,
	totalPoints,
	eventsAttended,
	loading = false,
}: UserStatsCardsProps) {
	return (
		<SummaryStrip
			loading={loading}
			items={[
				{ label: "points", value: formatNumber(totalPoints) },
				{ label: "events attended", value: eventsAttended },
				...(latestEvent
					? [
							{
								label: `latest event · ${formatShortDate(latestEvent.eventDate)}`,
								value: latestEvent.eventName,
							},
						]
					: []),
			]}
		/>
	);
}
