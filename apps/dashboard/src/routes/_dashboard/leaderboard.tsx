import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import { SummaryStrip } from "@/components/dashboard/SummaryStrip";
import { UserAvatarFallback } from "@/components/dashboard/UserAvatarFallback";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useAuthedQuery } from "@/hooks/useAuthedConvex";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dashboard/leaderboard")({
	loader: (ctx) =>
		prefetchAuthedQuery(api.users.getLeaderboard, undefined, ctx),
	component: LeaderboardPage,
});

const ITEMS_PER_PAGE = 10;

function ordinal(n: number) {
	const mod100 = n % 100;
	if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
	switch (n % 10) {
		case 1:
			return `${n}st`;
		case 2:
			return `${n}nd`;
		case 3:
			return `${n}rd`;
		default:
			return `${n}th`;
	}
}

type PodiumMember = {
	_id: string;
	name: string;
	points: number;
	major?: string;
	avatar?: string;
};

/**
 * Visual treatment per place (index = rank - 1). The pedestals share one
 * brand-blue family, lightest to deepest, so the winner reads by depth rather
 * than by a medal color.
 */
const PODIUM_STYLES = [
	{
		pedestal:
			"h-44 bg-gradient-to-b from-ds-blue-700 to-ds-blue-800 text-on-accent sm:h-60",
		points: "text-on-accent",
		unit: "text-on-accent/70",
		numeral: "text-white/[0.14] text-[140px] sm:text-[200px]",
		ring: "ring-ds-blue-700",
		avatar: "size-20 sm:size-24",
	},
	{
		pedestal:
			"h-32 bg-gradient-to-b from-ds-blue-400 to-ds-blue-500 text-ds-blue-1000 sm:h-48",
		points: "text-ds-blue-1000",
		unit: "text-ds-blue-1000/65",
		numeral: "text-ds-blue-1000/[0.10] text-[96px] sm:text-[140px]",
		ring: "ring-ds-blue-500",
		avatar: "size-16 sm:size-20",
	},
	{
		pedestal:
			"h-28 bg-gradient-to-b from-ds-blue-200 to-ds-blue-300 text-ds-blue-1000 sm:h-36",
		points: "text-ds-blue-1000",
		unit: "text-ds-blue-1000/65",
		numeral: "text-ds-blue-1000/[0.08] text-[56px] sm:text-[80px]",
		ring: "ring-ds-blue-400",
		avatar: "size-16 sm:size-20",
	},
] as const;

function PodiumColumn({
	member,
	rank,
	isYou,
}: {
	member: PodiumMember;
	rank: 0 | 1 | 2;
	isYou: boolean;
}) {
	const style = PODIUM_STYLES[rank];
	return (
		<li className="flex min-w-0 flex-1 basis-0 flex-col items-center">
			<Avatar
				className={cn(
					"shadow-[0_6px_16px_-6px_rgba(0,0,0,0.28)] ring-2 ring-offset-2 ring-offset-card",
					style.avatar,
					style.ring,
				)}
			>
				<AvatarImage src={member.avatar} alt="" />
				<AvatarFallback>
					<UserAvatarFallback
						name={member.name}
						className="size-full text-base sm:text-lg"
					/>
				</AvatarFallback>
			</Avatar>
			<p className="mt-3 w-full truncate px-1 text-center text-sm font-semibold text-foreground">
				{member.name}
				{isYou && (
					<span className="ml-1.5 text-xs font-normal text-muted-foreground">
						You
					</span>
				)}
			</p>
			<p className="w-full truncate px-1 text-center text-xs text-muted-foreground">
				{member.major || "Member"}
			</p>
			<div
				className={cn(
					"relative mt-4 w-full overflow-hidden rounded-t-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_-8px_24px_-12px_rgba(0,0,0,0.25)]",
					style.pedestal,
				)}
			>
				{/* Oversized numeral, cropped by the pedestal like a stamped face. */}
				<span
					aria-hidden
					className={cn(
						"pointer-events-none absolute -bottom-[0.2em] left-1/2 -translate-x-1/2 select-none font-semibold leading-none tracking-[-0.04em] tabular-nums",
						style.numeral,
					)}
				>
					{rank + 1}
				</span>
				<div className="relative flex flex-col items-center pt-4">
					<span className="sr-only">Rank {rank + 1}.</span>
					<span
						className={cn(
							"text-xl font-semibold leading-none tabular-nums sm:text-2xl",
							style.points,
						)}
					>
						{member.points.toLocaleString()}
					</span>
					<span className={cn("mt-1 text-xs", style.unit)}>points</span>
				</div>
			</div>
		</li>
	);
}

function LeaderboardPage() {
	const { user, logtoId } = useAuth();
	const leaderboard = useAuthedQuery(
		api.users.getLeaderboard,
		logtoId ? { logtoId } : "skip",
	);
	const [searchTerm, setSearchTerm] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const loading = leaderboard === undefined;

	const filteredData = leaderboard?.filter((userData) => {
		const searchLower = searchTerm.toLowerCase();
		return (
			userData.name.toLowerCase().includes(searchLower) ||
			(userData.major && userData.major.toLowerCase().includes(searchLower))
		);
	});

	const totalItems = filteredData?.length || 0;
	const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
	const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
	const endIndex = startIndex + ITEMS_PER_PAGE;
	const paginatedData = filteredData?.slice(startIndex, endIndex);

	const topThree = leaderboard?.slice(0, 3) ?? [];
	const showPodium = !loading && topThree.length >= 3 && !searchTerm;

	const currentUserRank = user?._id
		? (leaderboard?.findIndex((u) => u._id === user._id) ?? -1)
		: -1;
	const currentUserPoints =
		currentUserRank >= 0 ? leaderboard?.[currentUserRank]?.points : undefined;

	const totalPoints = leaderboard?.reduce((sum, u) => sum + u.points, 0) ?? 0;
	const memberCount = leaderboard?.length ?? 0;
	const avgPoints = memberCount > 0 ? Math.round(totalPoints / memberCount) : 0;

	const description =
		currentUserRank >= 0 && currentUserPoints !== undefined
			? `You're ${ordinal(currentUserRank + 1)} of ${memberCount} with ${currentUserPoints.toLocaleString()} points.`
			: "Community rankings based on event participation and engagement.";

	const headCell = "px-4 py-2.5 text-xs font-medium text-muted-foreground";

	return (
		<DashboardPage variant="list">
			<PageHeader
				hideTitleOnMobile
				title="Leaderboard"
				description={description}
				actions={
					<div className="relative w-full md:w-[280px]">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							type="search"
							placeholder="Search members or majors"
							aria-label="Search members or majors"
							value={searchTerm}
							onChange={(e) => {
								setSearchTerm(e.target.value);
								setCurrentPage(1);
							}}
							className="pl-9"
						/>
					</div>
				}
			/>

			<SummaryStrip
				loading={loading}
				items={[
					{ label: "members", value: memberCount },
					{ label: "points earned", value: totalPoints.toLocaleString() },
					{ label: "average per member", value: avgPoints },
				]}
			/>

			{showPodium && (
				<section
					aria-label="Top three members"
					className="relative overflow-hidden rounded-md border bg-card px-4 pt-10 sm:px-12"
				>
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_90%_at_50%_0%,var(--ds-blue-200),transparent_75%)] opacity-70"
					/>
					<ol className="relative mx-auto flex max-w-2xl items-end gap-2 sm:gap-3">
						<PodiumColumn
							member={topThree[1]}
							rank={1}
							isYou={user?._id === topThree[1]._id}
						/>
						<PodiumColumn
							member={topThree[0]}
							rank={0}
							isYou={user?._id === topThree[0]._id}
						/>
						<PodiumColumn
							member={topThree[2]}
							rank={2}
							isYou={user?._id === topThree[2]._id}
						/>
					</ol>
				</section>
			)}

			<section className="overflow-hidden rounded-md border">
				{loading ? (
					<div className="divide-y">
						{[...Array(8)].map((_, i) => (
							<div key={i} className="flex items-center gap-4 px-4 py-3">
								<Skeleton className="h-4 w-6 rounded-[4px]" />
								<Skeleton className="size-8 rounded-full" />
								<Skeleton className="h-4 w-40 rounded-[4px]" />
								<Skeleton className="ml-auto h-4 w-16 rounded-[4px]" />
							</div>
						))}
					</div>
				) : paginatedData && paginatedData.length > 0 ? (
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b">
									<th className={cn(headCell, "w-16 text-left")}>Rank</th>
									<th className={cn(headCell, "text-left")}>Member</th>
									<th
										className={cn(
											headCell,
											"hidden w-24 text-center lg:table-cell",
										)}
									>
										Class
									</th>
									<th
										className={cn(
											headCell,
											"hidden w-24 text-right sm:table-cell",
										)}
									>
										Events
									</th>
									<th className={cn(headCell, "w-28 text-right")}>Points</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{paginatedData.map((member) => {
									const rank =
										leaderboard?.findIndex((u) => u._id === member._id) ?? -1;
									const isYou = user?._id === member._id;
									return (
										<tr
											key={member._id}
											aria-current={isYou ? "true" : undefined}
											className={cn(
												"transition-colors",
												isYou ? "bg-ds-blue-100/50" : "hover:bg-muted/50",
											)}
										>
											<td className="whitespace-nowrap px-4 py-3">
												<span
													className={cn(
														"text-sm tabular-nums",
														rank < 3
															? "font-semibold text-foreground"
															: "text-muted-foreground",
													)}
												>
													{rank + 1}
												</span>
											</td>
											<td className="px-4 py-3">
												<div className="flex items-center gap-3">
													<Avatar>
														<AvatarImage src={member.avatar} alt="" />
														<AvatarFallback>
															<UserAvatarFallback
																name={member.name}
																className="size-8 text-xs"
															/>
														</AvatarFallback>
													</Avatar>
													<div className="min-w-0">
														<p className="truncate text-sm font-medium text-foreground">
															{member.name}
															{isYou && (
																<span className="ml-2 text-xs font-normal text-muted-foreground">
																	You
																</span>
															)}
														</p>
														<p
															className="truncate text-xs text-muted-foreground"
															title={member.major || undefined}
														>
															{member.major || "Member"}
														</p>
													</div>
												</div>
											</td>
											<td className="hidden px-4 py-3 text-center text-sm tabular-nums text-muted-foreground lg:table-cell">
												{member.graduationYear || "–"}
											</td>
											<td className="hidden px-4 py-3 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
												{member.eventsAttended || 0}
											</td>
											<td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-foreground">
												{member.points.toLocaleString()}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				) : (
					<div className="px-6 py-14 text-center">
						<p className="text-sm font-semibold text-foreground">No results</p>
						<p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
							No members match "{searchTerm}".
						</p>
					</div>
				)}

				{totalPages > 1 && (
					<div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 sm:flex-row">
						<p className="text-xs tabular-nums text-muted-foreground">
							{startIndex + 1}–{Math.min(endIndex, totalItems)} of {totalItems}
						</p>
						<Pagination
							currentPage={currentPage}
							totalPages={totalPages}
							onPageChange={setCurrentPage}
						/>
					</div>
				)}
			</section>
		</DashboardPage>
	);
}
