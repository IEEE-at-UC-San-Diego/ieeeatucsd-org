import { api } from "@convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import { ActivityLedger } from "@/components/dashboard/overview/ActivityLedger";
import { CompleteProfileNotice } from "@/components/dashboard/overview/CompleteProfileNotice";
import { OverviewSkeleton } from "@/components/dashboard/overview/OverviewSkeleton";
import type { PointsTrendPoint } from "@/components/dashboard/overview/PointsTrendCard";
import { PointsTrendCard } from "@/components/dashboard/overview/PointsTrendCard";
import { StandingPanel } from "@/components/dashboard/overview/StandingPanel";
import { NetworkErrorState } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useAuthedQuery } from "@/hooks/useAuthedConvex";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePermissions } from "@/hooks/usePermissions";
import { formatMonthYear, formatShortDate } from "@/lib/formatters";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/overview")({
	loader: (ctx) =>
		prefetchAuthedQuery(api.users.getOverviewData, undefined, ctx),
	component: OverviewPage,
});

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type PointsHistoryEntry = { date: number; points: number; cumulative: number };

function buildTrend(history: PointsHistoryEntry[]): PointsTrendPoint[] {
	// Collapse same-day check-ins to the day's final cumulative total.
	const byDay = new Map<string, number>();
	for (const entry of history) {
		const label = formatShortDate(entry.date);
		byDay.set(label, entry.cumulative);
	}
	return [...byDay].map(([date, points]) => ({ date, points }));
}

function buildRangeLabel(history: PointsHistoryEntry[]): string | null {
	if (history.length < 2) return null;
	const first = formatMonthYear(history[0].date);
	const last = formatMonthYear(history[history.length - 1].date);
	return first === last ? first : `${first} – ${last}`;
}

function greetingForHour(hour: number) {
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

function AccountSetupNotice({
	isOnline,
	onRetry,
	onSignOut,
}: {
	isOnline: boolean;
	onRetry: () => void;
	onSignOut: () => void;
}) {
	return (
		<section className="rounded-[6px] border border-ds-amber-400 bg-ds-amber-100 p-5 sm:p-6">
			<div className="flex items-start gap-3">
				<AlertCircle className="mt-0.5 size-4 shrink-0 text-tone-warning" />
				<div className="space-y-3">
					<div className="space-y-1">
						<h2 className="text-base font-semibold leading-6 text-balance text-foreground">
							{isOnline
								? "Finalizing Your Account"
								: "Can’t Finish Account Setup"}
						</h2>
						<output
							aria-live="polite"
							className="block max-w-prose text-sm leading-5 text-pretty text-muted-foreground"
						>
							{isOnline
								? "We’re syncing your dashboard profile. This should only take a moment."
								: "You’re offline. Reconnect, then retry so we can sync your profile."}
						</output>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button type="button" size="sm" className="px-3" onClick={onRetry}>
							<Loader2 className="size-4" />
							Retry
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="px-3"
							onClick={onSignOut}
						>
							Sign Out
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}

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
				<DashboardPage variant="list">
					<NetworkErrorState
						title="Can’t Finish Signing In"
						description="You’re offline. Reconnect, then retry to load your account."
						onRetry={() => window.location.reload()}
					/>
				</DashboardPage>
			);
		}
		return (
			<DashboardPage variant="list">
				<OverviewSkeleton />
			</DashboardPage>
		);
	}

	if (!user) {
		return (
			<DashboardPage variant="list">
				<AccountSetupNotice
					isOnline={isOnline}
					onRetry={() => window.location.reload()}
					onSignOut={() => signOut()}
				/>
			</DashboardPage>
		);
	}

	const firstName = user.name?.split(" ")[0] || "Member";
	const memberSince = user.joinDate ? formatMonthYear(user.joinDate) : null;

	const header = (
		<PageHeader
			hideTitleOnMobile
			title={`${greetingForHour(new Date().getHours())}, ${firstName}`}
			description={
				memberSince
					? `Your standing at IEEE at UC San Diego · Member since ${memberSince}`
					: "Your standing at IEEE at UC San Diego"
			}
			actions={
				<Button
					asChild
					variant="secondary"
					size="sm"
					className="hidden px-3 sm:inline-flex"
				>
					<Link to="/leaderboard">View Leaderboard</Link>
				</Button>
			}
		/>
	);

	if (!isOnline && overviewData === undefined) {
		return (
			<DashboardPage variant="list">
				{header}
				<NetworkErrorState
					description="Overview metrics need a connection. Reconnect and retry."
					onRetry={() => window.location.reload()}
				/>
			</DashboardPage>
		);
	}

	const pointsHistory = overviewData?.pointsHistory ?? [];
	const now = Date.now();
	const pointsLast30Days = pointsHistory
		.filter((entry) => now - entry.date <= THIRTY_DAYS_MS)
		.reduce((total, entry) => total + entry.points, 0);
	const lastEventAt = pointsHistory.length
		? Math.max(...pointsHistory.map((entry) => entry.date))
		: null;

	return (
		<DashboardPage variant="list">
			{header}

			{!user.signedUp && <CompleteProfileNotice />}

			<StandingPanel
				points={user.points || 0}
				pointsLast30Days={pointsLast30Days}
				rank={overviewData?.rank ?? null}
				totalMembers={overviewData?.totalMembers ?? null}
				eventsAttended={user.eventsAttended || 0}
				lastEventAt={lastEventAt}
			/>

			<div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-3">
				<PointsTrendCard
					data={buildTrend(pointsHistory)}
					rangeLabel={buildRangeLabel(pointsHistory)}
				/>
				<ActivityLedger items={overviewData?.recentActivity ?? []} />
			</div>
		</DashboardPage>
	);
}
