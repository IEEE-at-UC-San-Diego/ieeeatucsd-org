import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
	Activity,
	CalendarDays,
	Gauge,
	Loader2,
	Target,
	TrendingDown,
	TrendingUp,
	Users,
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
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import { ResponsiveOverlay } from "@/components/mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/executive-analytics")({
	loader: (ctx) =>
		prefetchAuthedQuery(api.users.getExecutiveAnalytics, undefined, ctx),
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
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"var(--muted-foreground)",
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
				className="bg-muted text-muted-foreground border-border"
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
					? "border-ds-green-100 bg-ds-green-100 text-tone-success"
					: "border-ds-red-100 bg-ds-red-100 text-tone-danger"
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
	const isMobile = useIsMobile();
	const { hasAdminAccess, logtoId, isLoading } = usePermissions();
	const [fiscalYearStart, setFiscalYearStart] = useState<number | undefined>(
		undefined,
	);
	const [touchedBar, setTouchedBar] = useState<{
		month: string;
		eventsHosted: number;
		attendees: number;
	} | null>(null);
	const [fySheetOpen, setFySheetOpen] = useState(false);

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
			<DashboardPage
				width="wide"
				className="flex min-h-[60vh] items-center justify-center"
			>
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</DashboardPage>
		);
	}

	if (!hasAdminAccess) {
		return (
			<DashboardPage width="wide">
				<Card className="bg-background border-border">
					<CardHeader>
						<CardTitle className="text-foreground">Access Denied</CardTitle>
						<CardDescription className="text-muted-foreground">
							Executive analytics is available to Executive Officers and
							Administrators.
						</CardDescription>
					</CardHeader>
				</Card>
			</DashboardPage>
		);
	}

	if (!analytics) {
		return (
			<DashboardPage width="wide">
				<Skeleton className="h-28 w-full rounded-md" />
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
					{["events", "attendees", "unique", "avg", "coverage"].map((item) => (
						<Skeleton key={item} className="h-32 w-full rounded-md" />
					))}
				</div>
				<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
					<Skeleton className="h-96 xl:col-span-2 rounded-md" />
					<Skeleton className="h-96 rounded-md" />
				</div>
				<Skeleton className="h-80 rounded-md" />
			</DashboardPage>
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
	const nonZeroMetricCount = statsCards.filter((card) => card.value > 0).length;
	const comparativeMonths = analytics.monthlyTrend.filter(
		(month) => month.eventsHosted > 0 || month.attendees > 0,
	);
	const activeEventTypes = analytics.eventTypeBreakdown.filter(
		(entry) => entry.value > 0,
	);

	return (
		<DashboardPage width="wide" variant="list">
			<PageHeader
				title="Executive Officer Analytics"
				description={`Operational performance for ${analytics.selectedFiscalYearLabel}.`}
				hideTitleOnMobile
				actions={
					isMobile ? undefined : (
						<div className="w-full sm:w-64">
							<Select
								value={String(analytics.selectedFiscalYear)}
								onValueChange={(value) => setFiscalYearStart(Number(value))}
							>
								<SelectTrigger className="w-full border-border bg-background">
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
					)
				}
			/>

			{isMobile && (
				<>
					<button
						type="button"
						onClick={() => setFySheetOpen(true)}
						className="flex h-11 w-full items-center justify-between rounded-md border bg-background px-3 text-sm font-medium active:scale-[0.99]"
					>
						<span className="text-muted-foreground">Fiscal year</span>
						<span className="text-tone-link">
							{analytics.selectedFiscalYearLabel}
						</span>
					</button>
					<ResponsiveOverlay
						open={fySheetOpen}
						onOpenChange={setFySheetOpen}
						title="Fiscal year"
						variant="sheet"
					>
						<div className="space-y-2 pb-2">
							{analytics.fiscalYearOptions.map((option) => (
								<Button
									key={option.startYear}
									variant={
										option.startYear === analytics.selectedFiscalYear
											? "default"
											: "outline"
									}
									className="h-12 w-full justify-start"
									onClick={() => {
										setFiscalYearStart(option.startYear);
										setFySheetOpen(false);
									}}
								>
									{option.label}
								</Button>
							))}
						</div>
					</ResponsiveOverlay>
				</>
			)}

			{/* Metrics — stacked on mobile (one insight per block), grid on desktop */}
			<div
				className={`grid grid-cols-1 gap-4 ${
					isMobile
						? ""
						: nonZeroMetricCount <= 1
							? "sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
							: "sm:grid-cols-2 xl:grid-cols-5"
				}`}
			>
				{statsCards.map((card) => {
					const Icon = card.icon;
					if (!isMobile && nonZeroMetricCount <= 1 && card.key !== "events") {
						return null;
					}
					return (
						<Card key={card.key} className="border-border bg-background">
							<CardHeader className="space-y-2 pb-2">
								<CardDescription className="text-muted-foreground">
									{card.title}
								</CardDescription>
								<div className="flex items-center justify-between">
									<CardTitle className="text-3xl text-foreground">
										{formatNumber.format(card.value)}
										{card.valueSuffix ?? ""}
									</CardTitle>
									<Icon className="h-5 w-5 text-muted-foreground" />
								</div>
							</CardHeader>
							<CardContent className="pt-0">
								{card.change !== null ? (
									<GrowthBadge value={card.change} />
								) : (
									<p className="text-xs text-muted-foreground">
										Fiscal-year aggregate
									</p>
								)}
							</CardContent>
						</Card>
					);
				})}
				{!isMobile && nonZeroMetricCount <= 1 && (
					<div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-4 sm:grid-cols-4">
						{statsCards.slice(1).map((metric) => (
							<div key={metric.key}>
								<p className="text-xs text-muted-foreground">{metric.title}</p>
								<p className="mt-1 text-lg font-semibold tabular-nums">
									{formatNumber.format(metric.value)}
									{metric.valueSuffix ?? ""}
								</p>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Charts — no nested page scroll; fixed chart height */}
			<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
				<Card className="border-border bg-background xl:col-span-2">
					<CardHeader>
						<CardTitle className="text-foreground">Monthly Trend</CardTitle>
						<CardDescription className="text-muted-foreground">
							Event volume and attendance from July through June.
							{isMobile && " Tap a bar to inspect."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{comparativeMonths.length > 1 ? (
							<div className="space-y-3">
								{touchedBar && isMobile && (
									<div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
										<p className="font-semibold">{touchedBar.month}</p>
										<p className="text-muted-foreground">
											{touchedBar.eventsHosted} events ·{" "}
											{formatNumber.format(touchedBar.attendees)} attendees
										</p>
									</div>
								)}
								<div className={isMobile ? "h-64 touch-pan-y" : "h-80"}>
									<ResponsiveContainer width="100%" height="100%">
										<BarChart
											data={analytics.monthlyTrend}
											barGap={8}
											onClick={(state) => {
												if (!isMobile) return;
												const active = (
													state as {
														activePayload?: Array<{
															payload?: {
																month: string;
																eventsHosted: number;
																attendees: number;
															};
														}>;
													}
												).activePayload?.[0]?.payload;
												if (active) {
													setTouchedBar({
														month: active.month,
														eventsHosted: active.eventsHosted,
														attendees: active.attendees,
													});
												}
											}}
										>
											<CartesianGrid
												strokeDasharray="3 3"
												stroke="var(--border)"
												vertical={false}
											/>
											<XAxis
												dataKey="month"
												tick={{
													fill: "var(--muted-foreground)",
													fontSize: isMobile ? 10 : 12,
												}}
												interval={isMobile ? 1 : 0}
												height={isMobile ? 36 : 30}
											/>
											<YAxis
												tick={{
													fill: "var(--muted-foreground)",
													fontSize: isMobile ? 10 : 12,
												}}
												width={isMobile ? 28 : 36}
											/>
											{!isMobile && (
												<Tooltip
													cursor={{ fill: "var(--muted)" }}
													contentStyle={{
														backgroundColor: "var(--popover)",
														border: "1px solid var(--border)",
														borderRadius: "10px",
													}}
												/>
											)}
											<Bar
												dataKey="eventsHosted"
												name="Events Hosted"
												fill="var(--chart-1)"
												radius={[6, 6, 0, 0]}
											/>
											<Bar
												dataKey="attendees"
												name="Attendees"
												fill="var(--chart-2)"
												radius={[6, 6, 0, 0]}
											/>
										</BarChart>
									</ResponsiveContainer>
								</div>
								{isMobile && (
									<p className="sr-only">
										Monthly trend summary:{" "}
										{analytics.monthlyTrend
											.map(
												(m) =>
													`${m.month}: ${m.eventsHosted} events, ${m.attendees} attendees`,
											)
											.join(". ")}
									</p>
								)}
							</div>
						) : (
							<div className="flex min-h-48 items-center justify-center rounded-md bg-muted/20 p-6 text-center">
								<div>
									<p className="text-3xl font-semibold tabular-nums">
										{analytics.overview.eventsHosted}
									</p>
									<p className="mt-1 text-sm text-muted-foreground">
										event{analytics.overview.eventsHosted === 1 ? "" : "s"}{" "}
										hosted in the selected fiscal year
									</p>
									<p className="mt-3 text-xs text-muted-foreground">
										A monthly comparison will appear after activity spans
										multiple months.
									</p>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="border-border bg-background">
					<CardHeader>
						<CardTitle className="text-foreground">Event Type Mix</CardTitle>
						<CardDescription className="text-muted-foreground">
							Distribution of hosted events by category.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{activeEventTypes.length > 1 ? (
							<div className={isMobile ? "h-44" : "h-52"}>
								<ResponsiveContainer width="100%" height="100%">
									<PieChart>
										<Pie
											data={activeEventTypes}
											dataKey="value"
											nameKey="label"
											innerRadius={isMobile ? 40 : 48}
											outerRadius={isMobile ? 64 : 74}
											paddingAngle={4}
										>
											{activeEventTypes.map((entry, index) => (
												<Cell
													key={`${entry.type}-${index}`}
													fill={CHART_COLORS[index % CHART_COLORS.length]}
												/>
											))}
										</Pie>
										{!isMobile && (
											<Tooltip
												contentStyle={{
													backgroundColor: "var(--popover)",
													border: "1px solid var(--border)",
													borderRadius: "10px",
												}}
											/>
										)}
									</PieChart>
								</ResponsiveContainer>
							</div>
						) : (
							<div className="flex min-h-40 items-center justify-center rounded-md bg-muted/20 p-6 text-center">
								<div>
									<p className="text-lg font-semibold">
										{activeEventTypes[0]?.label || "No event types yet"}
									</p>
									<p className="mt-1 text-sm text-muted-foreground">
										{activeEventTypes[0]
											? `${activeEventTypes[0].value} hosted event`
											: "Category comparisons will appear as events are hosted."}
									</p>
								</div>
							</div>
						)}
						<div className="space-y-2">
							{activeEventTypes.map((entry, index) => (
								<div
									key={entry.type}
									className="flex min-h-[44px] items-center justify-between rounded-md bg-muted px-3 py-2"
								>
									<div className="flex items-center gap-2">
										<span
											className="inline-block h-2.5 w-2.5 rounded-full"
											style={{
												backgroundColor:
													CHART_COLORS[index % CHART_COLORS.length],
											}}
										/>
										<span className="text-sm text-foreground">
											{entry.label}
										</span>
									</div>
									<span className="text-sm font-semibold text-foreground">
										{entry.value}
									</span>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
				<Card className="border-border bg-background xl:col-span-2">
					<CardHeader>
						<CardTitle className="text-foreground">
							Top Events by Attendance
						</CardTitle>
						<CardDescription className="text-muted-foreground">
							Highest attendance events in the selected fiscal year.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{analytics.topEvents.length === 0 ? (
							<div className="rounded-lg border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
								No event attendance data is available for this fiscal year.
							</div>
						) : (
							<ul className="-mx-4 divide-y border-y md:mx-0 md:space-y-2 md:divide-y-0 md:border-0">
								{analytics.topEvents.map((event, index) => (
									<li
										key={event.eventId}
										className="flex min-h-[52px] flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between md:rounded-lg md:border md:bg-background md:p-4"
									>
										<div className="min-w-0 space-y-1">
											<p className="text-sm font-semibold text-foreground">
												{index + 1}. {event.name}
											</p>
											<p className="text-xs text-muted-foreground">
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
												className="bg-muted text-foreground"
											>
												{event.eventType}
											</Badge>
											<p className="text-sm font-semibold tabular-nums text-foreground">
												{formatNumber.format(event.attendees)}
											</p>
										</div>
									</li>
								))}
							</ul>
						)}
					</CardContent>
				</Card>

				<Card className="border-border bg-background">
					<CardHeader>
						<CardTitle className="text-foreground">
							Engagement Quality
						</CardTitle>
						<CardDescription className="text-muted-foreground">
							How effectively events are driving participation.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						<div className="rounded-lg bg-muted p-4">
							<p className="text-xs uppercase tracking-wide text-muted-foreground">
								Average Attendance / Event
							</p>
							<p className="mt-1 text-2xl font-semibold text-foreground">
								{formatNumber.format(analytics.overview.avgAttendeesPerEvent)}
							</p>
						</div>
						<div className="space-y-2 rounded-lg bg-muted p-4">
							<div className="flex items-center justify-between">
								<p className="text-xs uppercase tracking-wide text-muted-foreground">
									Attendee Coverage
								</p>
								<p className="text-sm font-semibold text-foreground">
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
							<p className="text-xs text-muted-foreground">
								Unique attendees as a percentage of total active users.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</DashboardPage>
	);
}
