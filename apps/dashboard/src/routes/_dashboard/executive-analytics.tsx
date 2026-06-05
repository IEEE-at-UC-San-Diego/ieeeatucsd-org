import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useAuthedQuery } from "@/hooks/useAuthedConvex";
import {
	Activity,
	CalendarDays,
	Gauge,
	Target,
	TrendingDown,
	TrendingUp,
	Users,
	Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_dashboard/executive-analytics")({
	component: ExecutiveAnalyticsPage,
});

type ExecutiveAnalyticsData = {
	fiscalYearOptions: Array<{ startYear: number; label: string }>;
	selectedFiscalYear: number;
	selectedFiscalYearLabel: string;
	overview: {
		eventsHosted: number;
		totalAttendees: number;
		uniqueAttendees: number;
		activeUsers: number;
		newUsers: number;
		avgAttendeesPerEvent: number;
		attendeeCoverage: number;
	};
	comparisons: {
		eventsHosted: number | null;
		totalAttendees: number | null;
		newUsers: number | null;
	};
	monthlyTrend: Array<{
		month: string;
		eventsHosted: number;
		attendees: number;
		uniqueAttendees: number;
	}>;
	eventTypeBreakdown: Array<{
		type: string;
		label: string;
		value: number;
	}>;
	topEvents: Array<{
		eventId: string;
		name: string;
		eventType: string;
		date: number;
		attendees: number;
	}>;
};

const CHART_COLORS = [
	"#1d4ed8",
	"#0f766e",
	"#ca8a04",
	"#7c3aed",
	"#db2777",
	"#475569",
];

function formatChangeLabel(value: number | null) {
	if (value === null) {
		return "No baseline";
	}
	const sign = value >= 0 ? "+" : "";
	return `${sign}${value.toFixed(1)}% vs prev FY`;
}

function GrowthBadge({ value }: { value: number | null }) {
	if (value === null) {
		return (
			<Badge
				variant="secondary"
				className="bg-slate-100 text-slate-600 border-slate-200"
			>
				No baseline
			</Badge>
		);
	}

	const isPositive = value >= 0;
	return (
		<Badge
			variant="outline"
			className={
				isPositive
					? "border-emerald-200 bg-emerald-50 text-emerald-700"
					: "border-rose-200 bg-rose-50 text-rose-700"
			}
		>
			{isPositive ? (
				<TrendingUp className="mr-1 h-3 w-3" />
			) : (
				<TrendingDown className="mr-1 h-3 w-3" />
			)}
			{formatChangeLabel(value)}
		</Badge>
	);
}

function ExecutiveAnalyticsPage() {
	const { hasAdminAccess, logtoId, isLoading } = usePermissions();
	const [fiscalYearStart, setFiscalYearStart] = useState<number | undefined>(
		undefined,
	);

	const analytics = useAuthedQuery(
		api.users.getExecutiveAnalytics,
		logtoId
			? {
					logtoId,
					...(fiscalYearStart !== undefined ? { fiscalYearStart } : {}),
				}
			: "skip",
	) as ExecutiveAnalyticsData | undefined;

	useEffect(() => {
		if (analytics && fiscalYearStart === undefined) {
			setFiscalYearStart(analytics.selectedFiscalYear);
		}
	}, [analytics, fiscalYearStart]);

	const formatNumber = useMemo(
		() => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }),
		[],
	);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!hasAdminAccess) {
		return (
			<div className="w-full bg-slate-50 min-h-screen">
				<div className="mx-auto max-w-7xl p-6">
					<Card className="bg-white border-slate-200">
						<CardHeader>
							<CardTitle className="text-slate-900">Access Denied</CardTitle>
							<CardDescription className="text-slate-600">
								Executive analytics is available to Executive Officers and
								Administrators.
							</CardDescription>
						</CardHeader>
					</Card>
				</div>
			</div>
		);
	}

	if (!analytics) {
		return (
			<div className="w-full bg-slate-50 min-h-screen">
				<div className="mx-auto max-w-7xl p-6 space-y-5">
					<Skeleton className="h-28 w-full rounded-xl" />
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
						{["events", "attendees", "unique", "avg", "coverage"].map(
							(item) => (
								<Skeleton key={item} className="h-32 w-full rounded-xl" />
							),
						)}
					</div>
					<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
						<Skeleton className="h-96 xl:col-span-2 rounded-xl" />
						<Skeleton className="h-96 rounded-xl" />
					</div>
					<Skeleton className="h-80 rounded-xl" />
				</div>
			</div>
		);
	}

	const statsCards = [
		{
			key: "events",
			title: "Events Hosted",
			value: analytics.overview.eventsHosted,
			icon: CalendarDays,
			change: analytics.comparisons.eventsHosted,
		},
		{
			key: "attendees",
			title: "Total Attendees",
			value: analytics.overview.totalAttendees,
			icon: Users,
			change: analytics.comparisons.totalAttendees,
		},
		{
			key: "unique",
			title: "Unique Attendees",
			value: analytics.overview.uniqueAttendees,
			icon: Gauge,
			change: null,
		},
		{
			key: "active",
			title: "Avg Attendees / Event",
			value: analytics.overview.avgAttendeesPerEvent,
			icon: Activity,
			change: null,
			valueSuffix: "",
		},
		{
			key: "coverage",
			title: "Attendee Coverage",
			value: analytics.overview.attendeeCoverage,
			icon: Target,
			change: null,
			valueSuffix: "%",
		},
	];

	return (
		<div className="w-full bg-slate-50 min-h-screen">
			<div className="mx-auto max-w-7xl p-4 md:p-6 space-y-5">
				<Card className="bg-white border-slate-200">
					<CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
						<div className="space-y-1">
							<CardTitle className="text-2xl text-slate-900">
								Executive Officer Analytics
							</CardTitle>
							<CardDescription className="text-slate-600">
								Operational performance for {analytics.selectedFiscalYearLabel}.
							</CardDescription>
						</div>
						<div className="w-full max-w-xs space-y-2">
							<p className="text-xs font-medium uppercase tracking-wide text-slate-500">
								Fiscal Year
							</p>
							<Select
								value={String(analytics.selectedFiscalYear)}
								onValueChange={(value) => setFiscalYearStart(Number(value))}
							>
								<SelectTrigger className="w-full bg-white border-slate-300">
									<SelectValue placeholder="Select fiscal year" />
								</SelectTrigger>
								<SelectContent>
									{analytics.fiscalYearOptions.map((option) => (
										<SelectItem
											key={option.startYear}
											value={String(option.startYear)}
										>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</CardHeader>
				</Card>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
					{statsCards.map((card) => {
						const Icon = card.icon;
						return (
							<Card key={card.key} className="bg-white border-slate-200">
								<CardHeader className="space-y-2 pb-2">
									<CardDescription className="text-slate-500">
										{card.title}
									</CardDescription>
									<div className="flex items-center justify-between">
										<CardTitle className="text-3xl text-slate-900">
											{formatNumber.format(card.value)}
											{card.valueSuffix ?? ""}
										</CardTitle>
										<Icon className="h-5 w-5 text-slate-500" />
									</div>
								</CardHeader>
								<CardContent className="pt-0">
									{card.change !== null ? (
										<GrowthBadge value={card.change} />
									) : (
										<p className="text-xs text-slate-500">
											Fiscal-year aggregate
										</p>
									)}
								</CardContent>
							</Card>
						);
					})}
				</div>

				<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
					<Card className="xl:col-span-2 bg-white border-slate-200">
						<CardHeader>
							<CardTitle className="text-slate-900">Monthly Trend</CardTitle>
							<CardDescription className="text-slate-600">
								Event volume and attendance from July through June.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="h-80">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={analytics.monthlyTrend} barGap={8}>
										<CartesianGrid
											strokeDasharray="3 3"
											stroke="#e2e8f0"
											vertical={false}
										/>
										<XAxis
											dataKey="month"
											tick={{ fill: "#64748b", fontSize: 12 }}
										/>
										<YAxis
											tick={{ fill: "#64748b", fontSize: 12 }}
											width={36}
										/>
										<Tooltip
											cursor={{ fill: "#f8fafc" }}
											contentStyle={{
												backgroundColor: "#ffffff",
												border: "1px solid #e2e8f0",
												borderRadius: "10px",
											}}
										/>
										<Bar
											dataKey="eventsHosted"
											name="Events Hosted"
											fill="#1d4ed8"
											radius={[6, 6, 0, 0]}
										/>
										<Bar
											dataKey="attendees"
											name="Attendees"
											fill="#0f766e"
											radius={[6, 6, 0, 0]}
										/>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-white border-slate-200">
						<CardHeader>
							<CardTitle className="text-slate-900">Event Type Mix</CardTitle>
							<CardDescription className="text-slate-600">
								Distribution of hosted events by category.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="h-52">
								<ResponsiveContainer width="100%" height="100%">
									<PieChart>
										<Pie
											data={analytics.eventTypeBreakdown}
											dataKey="value"
											nameKey="label"
											innerRadius={48}
											outerRadius={74}
											paddingAngle={4}
										>
											{analytics.eventTypeBreakdown.map((entry, index) => (
												<Cell
													key={`${entry.type}-${index}`}
													fill={CHART_COLORS[index % CHART_COLORS.length]}
												/>
											))}
										</Pie>
										<Tooltip
											contentStyle={{
												backgroundColor: "#ffffff",
												border: "1px solid #e2e8f0",
												borderRadius: "10px",
											}}
										/>
									</PieChart>
								</ResponsiveContainer>
							</div>
							<div className="space-y-2">
								{analytics.eventTypeBreakdown.map((entry, index) => (
									<div
										key={entry.type}
										className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
									>
										<div className="flex items-center gap-2">
											<span
												className="inline-block h-2.5 w-2.5 rounded-full"
												style={{
													backgroundColor:
														CHART_COLORS[index % CHART_COLORS.length],
												}}
											/>
											<span className="text-sm text-slate-700">
												{entry.label}
											</span>
										</div>
										<span className="text-sm font-semibold text-slate-900">
											{entry.value}
										</span>
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
					<Card className="xl:col-span-2 bg-white border-slate-200">
						<CardHeader>
							<CardTitle className="text-slate-900">
								Top Events by Attendance
							</CardTitle>
							<CardDescription className="text-slate-600">
								Highest attendance events in the selected fiscal year.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{analytics.topEvents.length === 0 ? (
								<div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
									No event attendance data is available for this fiscal year.
								</div>
							) : (
								<div className="space-y-2">
									{analytics.topEvents.map((event, index) => (
										<div
											key={event.eventId}
											className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between"
										>
											<div className="space-y-1">
												<p className="text-sm font-semibold text-slate-900">
													{index + 1}. {event.name}
												</p>
												<p className="text-xs text-slate-500">
													{new Date(event.date).toLocaleDateString("en-US", {
														month: "short",
														day: "numeric",
														year: "numeric",
													})}
												</p>
											</div>
											<div className="flex items-center gap-3">
												<Badge
													variant="secondary"
													className="bg-slate-100 text-slate-700"
												>
													{event.eventType}
												</Badge>
												<p className="text-sm font-semibold text-slate-900">
													{formatNumber.format(event.attendees)} attendees
												</p>
											</div>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>

					<Card className="bg-white border-slate-200">
						<CardHeader>
							<CardTitle className="text-slate-900">
								Engagement Quality
							</CardTitle>
							<CardDescription className="text-slate-600">
								How effectively events are driving participation.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-5">
							<div className="rounded-lg bg-slate-50 p-4">
								<p className="text-xs uppercase tracking-wide text-slate-500">
									Average Attendance / Event
								</p>
								<p className="mt-1 text-2xl font-semibold text-slate-900">
									{formatNumber.format(analytics.overview.avgAttendeesPerEvent)}
								</p>
							</div>
							<div className="rounded-lg bg-slate-50 p-4 space-y-2">
								<div className="flex items-center justify-between">
									<p className="text-xs uppercase tracking-wide text-slate-500">
										Attendee Coverage
									</p>
									<p className="text-sm font-semibold text-slate-900">
										{formatNumber.format(analytics.overview.attendeeCoverage)}%
									</p>
								</div>
								<Progress
									value={Math.min(
										Math.max(analytics.overview.attendeeCoverage, 0),
										100,
									)}
									className="h-2 bg-slate-200"
								/>
								<p className="text-xs text-slate-500">
									Unique attendees as a percentage of total active users.
								</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
