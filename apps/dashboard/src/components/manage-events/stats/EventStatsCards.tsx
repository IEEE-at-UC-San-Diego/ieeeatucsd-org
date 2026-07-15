import { CalendarDays, CheckCircle2, Users } from "lucide-react";
import type { EventStats } from "../types";

interface EventStatsCardsProps {
	stats: EventStats;
	loading?: boolean;
}

export function EventStatsCards({
	stats,
	loading = false,
}: EventStatsCardsProps) {
	if (loading) {
		return (
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
				{[...Array(3)].map((_, i) => (
					<div key={i} className="bg-background rounded-md border p-6">
						<div className="flex items-center gap-4">
							<div className="w-12 h-12 rounded-lg bg-muted animate-pulse" />
							<div className="flex-1 space-y-2">
								<div className="h-4 w-20 rounded bg-muted animate-pulse" />
								<div className="h-6 w-12 rounded bg-muted animate-pulse" />
							</div>
						</div>
					</div>
				))}
			</div>
		);
	}

	const statCards = [
		{
			title: "Total Events",
			value: stats.totalEvents,
			icon: CalendarDays,
			gradient: "from-ds-blue-1000 to-ds-blue-800",
			bgGradient: "from-ds-blue-100 to-ds-blue-200",
			textColor: "text-ds-blue-700",
		},
		{
			title: "Published Events",
			value: stats.publishedEvents,
			icon: CheckCircle2,
			gradient: "from-ds-pink-1000 to-ds-pink-800",
			bgGradient: "from-ds-pink-100 to-ds-pink-200",
			textColor: "text-ds-pink-700",
		},
		{
			title: "Total Attendees",
			value: stats.totalAttendees,
			icon: Users,
			gradient: "from-ds-purple-1000 to-ds-purple-800",
			bgGradient: "from-ds-purple-100 to-ds-purple-200",
			textColor: "text-ds-purple-700",
		},
	];

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
			{statCards.map((stat) => {
				const IconComponent = stat.icon;
				return (
					<div
						key={stat.title}
						className={`relative overflow-hidden rounded-md border bg-gradient-to-br ${stat.bgGradient} p-6`}
					>
						<div className="relative z-10 flex items-center gap-4">
							<div
								className={`p-3 rounded-md bg-gradient-to-br ${stat.gradient} text-white shadow-lg`}
							>
								<IconComponent className="h-6 w-6" />
							</div>
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									{stat.title}
								</p>
								<p className={`text-2xl font-bold ${stat.textColor}`}>
									{stat.value.toLocaleString()}
								</p>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
