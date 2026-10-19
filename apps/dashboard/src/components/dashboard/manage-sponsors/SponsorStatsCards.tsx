import { SummaryStrip } from "@/components/dashboard/SummaryStrip";
import type { SponsorStats } from "./types";

interface SponsorStatsCardsProps {
	stats: SponsorStats;
	loading?: boolean;
}

export function SponsorStatsCards({
	stats,
	loading = false,
}: SponsorStatsCardsProps) {
	return (
		<SummaryStrip
			loading={loading}
			items={[
				{ label: "sponsors", value: stats.totalSponsors },
				{ label: "Gold", value: stats.goldSponsors },
				{ label: "Silver", value: stats.silverSponsors },
				{ label: "Bronze", value: stats.bronzeSponsors },
			]}
		/>
	);
}
