import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { Crown, Search } from "lucide-react";
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

/** Visual treatment per place. Index = rank - 1. */
const PODIUM_STYLES = [
	{
		place: "1st",
		pedestal: "h-40 bg-ds-amber-200 border-ds-amber-400 sm:h-52",
		numeral: "text-tone-warning",
		ring: "ring-ds-amber-700",
		avatar: "size-20 sm:size-24",
	},
	{
		place: "2nd",
		pedestal: "h-28 bg-ds-gray-100 border-ds-gray-400 sm:h-36",
		numeral: "text-ds-gray-900",
		ring: "ring-ds-gray-600",
		avatar: "size-16 sm:size-20",
	},
	{
		place: "3rd",
		pedestal: "h-20 bg-ds-amber-100 border-ds-amber-300 sm:h-28",
		numeral: "text-ds-amber-900",
		ring: "ring-ds-amber-900",
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
			<div className="relative">
				{rank === 0 && (
					<Crown
						aria-hidden
						className="absolute -top-6 left-1/2 size-5 -translate-x-1/2 text-ds-amber-700"
					/>
				)}
				<Avatar
					className={cn(
						"ring-2 ring-offset-2 ring-offset-background",
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
			</div>
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
					"mt-4 flex w-full flex-col items-center justify-start rounded-t-md border border-b-0 pt-3",
					style.pedestal,
				)}
			>
				<span
					className={cn(
						"text-4xl font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-5xl",
						style.numeral,
					)}
				>
					{rank + 1}
				</span>
				<span className="mt-2 text-sm font-semibold tabular-nums text-foreground">
					{member.points.toLocaleString()}
					<span className="ml-1 text-xs font-normal text-muted-foreground">
						pts
					</span>
				</span>
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
				<section aria-label="Top three members" className="px-2 pt-6 sm:px-8">
					<ol className="mx-auto flex max-w-2xl items-end gap-2 border-b sm:gap-3">
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
