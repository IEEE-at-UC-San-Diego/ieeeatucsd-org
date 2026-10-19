import { SummaryStrip } from "@/components/dashboard/SummaryStrip";

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
				{ label: "points", value: totalPoints.toLocaleString() },
				{ label: "events attended", value: eventsAttended },
				...(latestEvent
					? [
							{
								label: `latest event · ${new Date(
									latestEvent.eventDate,
								).toLocaleDateString(undefined, {
									month: "short",
									day: "numeric",
								})}`,
								value: latestEvent.eventName,
							},
						]
					: []),
			]}
		/>
	);
}
