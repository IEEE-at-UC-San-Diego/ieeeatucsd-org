import type * as React from "react";
import { cn } from "@/lib/utils";

type StandingPanelProps = {
	points: number;
	pointsLast30Days: number;
	rank: number | null;
	totalMembers: number | null;
	eventsAttended: number;
	lastEventAt: number | null;
};

function Metric({
	label,
	className,
	children,
}: {
	label: string;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"flex flex-col justify-between gap-5 bg-card px-4 py-4 sm:px-5 sm:py-5",
				className,
			)}
		>
			<p className="text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
				{label}
			</p>
			<div className="space-y-1.5">{children}</div>
		</div>
	);
}

function Supporting({ children }: { children: React.ReactNode }) {
	return <p className="text-xs leading-4 text-muted-foreground">{children}</p>;
}

function shortDate(timestamp: number) {
	return new Date(timestamp).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

export function StandingPanel({
	points,
	pointsLast30Days,
	rank,
	totalMembers,
	eventsAttended,
	lastEventAt,
}: StandingPanelProps) {
	const hasRank = rank !== null && rank > 0 && !!totalMembers;
	// Percentile of the cohort the member sits above, e.g. rank 12 of 148 → top 8%.
	const topPercent = hasRank
		? Math.max(1, Math.round((rank / (totalMembers as number)) * 100))
		: null;

	return (
		<section
			aria-label="Your standing"
			className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border bg-border shadow-raised lg:grid-cols-4"
		>
			<Metric label="Points" className="col-span-2">
				<p className="text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground lg:text-[40px]">
					{points.toLocaleString()}
				</p>
				<Supporting>
					{pointsLast30Days > 0 ? (
						<>
							<span className="font-medium text-tone-info tabular-nums">
								+{pointsLast30Days.toLocaleString()}
							</span>{" "}
							in the last 30 days
						</>
					) : (
						"Check in at events to earn points"
					)}
				</Supporting>
			</Metric>

			<Metric label="Rank">
				<p className="text-[22px] font-semibold leading-none tabular-nums text-foreground">
					{hasRank ? `#${rank}` : "—"}
					{hasRank && (
						<span className="ml-1.5 text-xs font-normal text-muted-foreground">
							of {totalMembers?.toLocaleString()}
						</span>
					)}
				</p>
				<Supporting>
					{hasRank ? `Top ${topPercent}% of members` : "Unranked so far"}
				</Supporting>
			</Metric>

			<Metric label="Events attended">
				<p className="text-[22px] font-semibold leading-none tabular-nums text-foreground">
					{eventsAttended.toLocaleString()}
				</p>
				<Supporting>
					{lastEventAt ? `Most recent ${shortDate(lastEventAt)}` : "None yet"}
				</Supporting>
			</Metric>
		</section>
	);
}
