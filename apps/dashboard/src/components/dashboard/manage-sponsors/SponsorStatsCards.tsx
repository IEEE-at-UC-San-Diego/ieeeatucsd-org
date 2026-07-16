import { Building2, Crown, Shield, Users } from "lucide-react";
import type { SponsorStats } from "./types";

interface SponsorStatsCardsProps {
	stats: SponsorStats;
	loading?: boolean;
}

export function SponsorStatsCards({
	stats,
	loading = false,
}: SponsorStatsCardsProps) {
	if (loading) {
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{[...Array(4)].map((_, i) => (
					<div key={i} className="bg-background rounded-md border p-4">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-lg bg-muted animate-pulse" />
							<div className="flex-1 space-y-2">
								<div className="h-3 w-16 rounded bg-muted animate-pulse" />
								<div className="h-5 w-10 rounded bg-muted animate-pulse" />
							</div>
						</div>
					</div>
				))}
			</div>
		);
	}

	const statCards = [
		{
			title: "Total Sponsors",
			value: stats.totalSponsors,
			icon: Building2,
			color: "text-tone-info",
			bgColor: "bg-ds-blue-100",
		},
		{
			title: "Gold Sponsors",
			value: stats.goldSponsors,
			icon: Crown,
			color: "text-tone-warning",
			bgColor: "bg-ds-amber-100",
		},
		{
			title: "Silver Sponsors",
			value: stats.silverSponsors,
			icon: Shield,
			color: "text-muted-foreground",
			bgColor: "bg-muted",
		},
		{
			title: "Bronze Sponsors",
			value: stats.bronzeSponsors,
			icon: Users,
			color: "text-tone-warning",
			bgColor: "bg-ds-amber-100",
		},
	];

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			{statCards.map((stat) => {
				const IconComponent = stat.icon;
				return (
					<div key={stat.title} className="bg-background rounded-md border p-4">
						<div className="flex items-center gap-3">
							<div className={`p-2 rounded-lg ${stat.bgColor} ${stat.color}`}>
								<IconComponent className="h-5 w-5" />
							</div>
							<div>
								<p className="text-xs font-medium text-muted-foreground">
									{stat.title}
								</p>
								<p className="text-xl font-bold text-foreground leading-tight">
									{stat.value}
								</p>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
