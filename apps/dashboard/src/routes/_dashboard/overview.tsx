import { api } from "@convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertCircle,
	Calendar,
	CreditCard,
	DollarSign,
	Loader2,
} from "lucide-react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import { NetworkErrorState } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useAuthedQuery } from "@/hooks/useAuthedConvex";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePermissions } from "@/hooks/usePermissions";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/overview")({
	loader: (ctx) =>
		prefetchAuthedQuery(api.users.getOverviewData, undefined, ctx),
	component: OverviewPage,
});

/* ─── Active Dot ─── */
function ActiveDot(props: Record<string, unknown>) {
	const { cx, cy, fill } = props as { cx: number; cy: number; fill: string };

	return (
		<g style={{ transform: `translate(${cx}px, ${cy}px)` }}>
			{/* Subtle outer ring */}
			<circle cx={0} cy={0} r={10} fill={fill} fillOpacity={0.12} />
			{/* Main dot */}
			<circle
				cx={0}
				cy={0}
				r={4.5}
				fill={fill}
				stroke="var(--card)"
				strokeWidth={2}
			/>
		</g>
	);
}

/* ─── Custom Tooltip ─── */
function ChartTooltip({ active, payload, label }: Record<string, unknown>) {
	if (!active || !(payload as Array<Record<string, unknown>>)?.length)
		return null;
	const data = (payload as Array<Record<string, unknown>>)[0];
	return (
		<div
			style={{
				background: "var(--popover)",
				border: "1px solid var(--border)",
				borderRadius: "12px",
				padding: "12px 16px",
				boxShadow: "var(--shadow-popover)",
				zIndex: 50,
				pointerEvents: "none" as const,
			}}
		>
			<p
				style={{
					fontSize: "12px",
					fontWeight: 500,
					color: "var(--muted-foreground)",
					marginBottom: "4px",
				}}
			>
				{label as string}
			</p>
			<p
				style={{
					fontSize: "18px",
					fontWeight: 600,
					color: "var(--popover-foreground)",
					margin: 0,
					fontVariantNumeric: "tabular-nums",
				}}
			>
				{(data.value as number)?.toLocaleString()}{" "}
				<span
					style={{
						fontSize: "13px",
						fontWeight: 500,
						color: "var(--ds-blue-700)",
					}}
				>
					pts
				</span>
			</p>
		</div>
	);
}

/* ─── Activity Icon Map ─── */
const activityConfig: Record<
	string,
	{ icon: React.ComponentType<{ className?: string }>; color: string }
> = {
	event: { icon: Calendar, color: "text-ds-blue-700" },
	reimbursement: { icon: CreditCard, color: "text-ds-green-700" },
	fund_deposit: { icon: DollarSign, color: "text-ds-blue-700" },
};

/* ─── Main Page ─── */
function OverviewPage() {
	const { user, isLoading, signOut } = useAuth();
	const { logtoId } = usePermissions();
	const isOnline = useOnlineStatus();
	const overviewData = useAuthedQuery(
		api.users.getOverviewData,
		logtoId ? { logtoId } : "skip",
	);

	if (isLoading) {
		if (!isOnline) {
			return (
				<DashboardPage>
					<NetworkErrorState
						title="Can't finish signing in"
						description="You're offline. Reconnect, then retry to load your account."
						onRetry={() => window.location.reload()}
					/>
				</DashboardPage>
			);
		}
		return (
			<DashboardPage>
				<div className="space-y-2 py-2">
					<Skeleton className="h-9 w-72 mb-3" />
					<Skeleton className="h-4 w-48" />
				</div>
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-20 w-full rounded-lg" />
					))}
				</div>
				<Skeleton className="h-72 w-full rounded-md" />
			</DashboardPage>
		);
	}

	if (!user) {
		return (
			<DashboardPage>
				<div className="rounded-md border border-ds-amber-100/60 bg-ds-amber-100/50 p-6 md:p-8">
					<div className="flex items-start gap-3">
						<AlertCircle className="h-5 w-5 text-ds-amber-900 mt-0.5" />
						<div className="space-y-3">
							<h2 className="text-lg font-semibold text-ds-amber-900">
								{isOnline
									? "Finalizing account setup..."
									: "Can't finish account setup"}
							</h2>
							<p className="text-sm text-ds-amber-900/80">
								{isOnline
									? "We are syncing your dashboard profile. This should only take a moment."
									: "You're offline. Reconnect, then retry so we can sync your profile."}
							</p>
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									size="sm"
									className="h-11"
									onClick={() => window.location.reload()}
								>
									<Loader2 className="h-4 w-4 mr-2" />
									Retry
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="h-11"
									onClick={() => signOut()}
								>
									Sign out
								</Button>
							</div>
						</div>
					</div>
				</div>
			</DashboardPage>
		);
	}

	if (!isOnline && overviewData === undefined) {
		return (
			<DashboardPage>
				<PageHeader
					hideTitleOnMobile
					title={`Welcome back`}
					description="Overview"
				/>
				<NetworkErrorState
					description="Overview metrics need a connection. Reconnect and retry."
					onRetry={() => window.location.reload()}
				/>
			</DashboardPage>
		);
	}

	const pointsByDate = new Map<string, number>();
	for (const point of overviewData?.pointsHistory || []) {
		const date = new Date(point.date).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		});
		pointsByDate.set(date, point.cumulative);
	}
	const chartData = [...pointsByDate].map(([date, points]) => ({
		date,
		points,
	}));
	const hasMeaningfulChart =
		chartData.length >= 2 &&
		new Set(chartData.map((point) => point.points)).size >= 2;

	const firstName = user.name?.split(" ")[0] || "Member";
	const currentHour = new Date().getHours();
	const greeting =
		currentHour < 12
			? "Good morning"
			: currentHour < 17
				? "Good afternoon"
				: "Good evening";

	return (
		<DashboardPage variant="list">
			{/* ─── Welcome Section ─── */}
			<PageHeader
				hideTitleOnMobile
				title={`${greeting}, ${firstName}`}
				description={`Your activity and progress${user.joinDate ? ` · Member since ${new Date(user.joinDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : ""}`}
			/>

			{/* ─── Compact Stats Row — balanced 2×2 on mobile ─── */}
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<div className="rounded-md border bg-card px-4 py-3.5 shadow-sm lg:col-span-2 lg:px-5 lg:py-4">
					<p className="text-xs font-medium text-muted-foreground">Points</p>
					<p className="mt-1 text-2xl font-semibold tracking-[-0.03em] tabular-nums lg:text-3xl">
						{user.points || 0}
					</p>
				</div>
				<div className="rounded-md border bg-card px-4 py-3.5">
					<p className="text-xs font-medium text-muted-foreground">Rank</p>
					<p className="mt-1 text-xl font-bold tabular-nums">
						{overviewData?.rank ? `#${overviewData.rank}` : "--"}
						{overviewData?.totalMembers && (
							<span className="ml-1 text-xs font-normal text-muted-foreground">
								/ {overviewData.totalMembers}
							</span>
						)}
					</p>
				</div>
				<div className="rounded-md border bg-card px-4 py-3.5 lg:col-span-1">
					<p className="text-xs font-medium text-muted-foreground">
						Events attended
					</p>
					<p className="mt-1 text-xl font-bold tabular-nums">
						{user.eventsAttended || 0}
					</p>
				</div>
			</div>

			{/* ─── Main Content Grid ─── */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Points Chart */}
				<div className="lg:col-span-2 rounded-md border bg-card p-5 shadow-sm">
					<div className="flex items-center justify-between mb-5">
						<div>
							<p className="font-semibold text-sm">Points over time</p>
							<p className="text-xs text-muted-foreground mt-0.5">
								Cumulative points earned
							</p>
						</div>
						{chartData.length >= 2 && (
							<span className="text-xs font-medium text-muted-foreground tabular-nums">
								{chartData.length} data points
							</span>
						)}
					</div>
					{hasMeaningfulChart ? (
						<div className="h-56">
							<ResponsiveContainer
								width="100%"
								height="100%"
								minWidth={0}
								minHeight={0}
							>
								<AreaChart
									data={chartData}
									margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
								>
									<defs>
										<linearGradient id="pointsFill" x1="0" y1="0" x2="0" y2="1">
											<stop
												offset="0%"
												stopColor="var(--ds-blue-700)"
												stopOpacity={0.2}
											/>
											<stop
												offset="100%"
												stopColor="var(--ds-blue-700)"
												stopOpacity={0}
											/>
										</linearGradient>
									</defs>
									<CartesianGrid
										strokeDasharray="3 3"
										vertical={false}
										className="stroke-border"
										strokeOpacity={0.5}
									/>
									<XAxis
										dataKey="date"
										axisLine={false}
										tickLine={false}
										tick={{
											fontSize: 10,
											fill: "var(--muted-foreground)",
										}}
										dy={8}
									/>
									<YAxis
										axisLine={false}
										tickLine={false}
										tick={{
											fontSize: 10,
											fill: "var(--muted-foreground)",
										}}
										width={40}
									/>
									<Tooltip
										content={<ChartTooltip />}
										cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
									/>
									<Area
										type="monotone"
										dataKey="points"
										stroke="var(--ds-blue-700)"
										fill="url(#pointsFill)"
										strokeWidth={2}
										dot={{
											r: 3,
											fill: "var(--ds-blue-700)",
											stroke: "var(--card)",
											strokeWidth: 2,
										}}
										activeDot={<ActiveDot fill="var(--ds-blue-700)" />}
										animationDuration={180}
										animationEasing="ease-out"
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>
					) : (
						<div className="h-56 flex flex-col items-center justify-center text-muted-foreground/60 space-y-2">
							<p className="text-sm">Attend events to see your growth chart</p>
						</div>
					)}
				</div>

				{/* Recent Activity */}
				<div className="rounded-md border bg-card p-5 shadow-sm flex flex-col">
					<div className="mb-4">
						<p className="font-semibold text-sm">Recent Activity</p>
						<p className="text-xs text-muted-foreground mt-0.5">
							Your latest updates
						</p>
					</div>
					<div className="flex-1 overflow-hidden">
						{overviewData?.recentActivity &&
						overviewData.recentActivity.length > 0 ? (
							<div className="space-y-0 divide-y divide-border max-h-72 overflow-y-auto">
								{overviewData.recentActivity.map((activity, idx) => {
									const config =
										activityConfig[activity.type] || activityConfig.event;
									const ActivityIcon = config.icon;
									return (
										<div
											key={idx}
											className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
										>
											<div className={`mt-0.5 ${config.color}`}>
												<ActivityIcon className="h-4 w-4" />
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center justify-between gap-2">
													<p className="text-sm font-medium truncate">
														{activity.title}
													</p>
													{typeof activity.points === "number" &&
													activity.points > 0 ? (
														<span className="shrink-0 text-xs font-bold text-primary tabular-nums">
															+{activity.points}
														</span>
													) : null}
												</div>
												<div className="flex items-center justify-between mt-0.5">
													<p className="text-xs text-muted-foreground truncate">
														{activity.description}
													</p>
													<p className="ml-2 shrink-0 text-xs text-muted-foreground/60 tabular-nums">
														{new Date(activity.date).toLocaleDateString(
															undefined,
															{ month: "short", day: "numeric" },
														)}
													</p>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						) : (
							<div className="h-full flex items-center justify-center text-muted-foreground/60 py-12">
								<p className="text-sm">No recent activity</p>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* ─── Profile CTA ─── */}
			{!user.signedUp && (
				<div className="rounded-md border border-ds-amber-100/50 bg-ds-amber-100/50 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div className="space-y-0.5">
						<h3 className="text-sm font-semibold text-ds-amber-900">
							Complete Your Profile
						</h3>
						<p className="text-xs text-ds-amber-900/80 max-w-2xl">
							Finish setting up your account to access all features and start
							earning points.
						</p>
					</div>
					<Link
						to="/get-started"
						className="inline-flex items-center justify-center px-4 py-2 bg-ds-amber-700 text-white rounded-lg hover:bg-ds-amber-800 transition-colors text-xs font-semibold shadow-sm shrink-0"
					>
						Finish Setup
					</Link>
				</div>
			)}
		</DashboardPage>
	);
}
