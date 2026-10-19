import { SummaryStrip } from "@/components/dashboard/SummaryStrip";
import type { UserStats } from "./types";

interface UserStatsCardsProps {
	stats: UserStats;
	loading?: boolean;
}

export function UserStatsCards({
	stats,
	loading = false,
}: UserStatsCardsProps) {
	return (
		<SummaryStrip
			loading={loading}
			items={[
				{ label: "members", value: stats.totalMembers },
				{ label: "active", value: stats.activeMembers },
				{ label: "officers", value: stats.officers },
				{ label: "new this month", value: stats.newThisMonth },
			]}
		/>
	);
}
