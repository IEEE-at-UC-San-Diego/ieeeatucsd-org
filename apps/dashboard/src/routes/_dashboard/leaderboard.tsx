import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { Crown, Search, Users } from "lucide-react";
import { useState } from "react";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useAuthedQuery } from "@/hooks/useAuthedConvex";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/leaderboard")({
	loader: (ctx) =>
		prefetchAuthedQuery(api.users.getLeaderboard, undefined, ctx),
	component: LeaderboardPage,
});

const ITEMS_PER_PAGE = 10;

function LeaderboardPage() {
	const { user, logtoId } = useAuth();
	const leaderboard = useAuthedQuery(
		api.users.getLeaderboard,
		logtoId ? { logtoId } : "skip",
	);
	const [searchTerm, setSearchTerm] = useState("");
	const [currentPage, setCurrentPage] = useState(1);
	const [loading, setLoading] = useState(true);

	// Update loading state based on data availability
	if (leaderboard !== undefined && loading) {
		setLoading(false);
	}

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

	const topThree = filteredData?.slice(0, 3) || [];

	// Find current user's rank
	const currentUserRank = user?._id
		? (leaderboard?.findIndex((u) => u._id === user._id) ?? -1)
		: -1;

	const getTotalStats = () => {
		const totalUsers = filteredData?.length || 0;
		const totalPoints =
			filteredData?.reduce((sum, u) => sum + u.points, 0) || 0;
		const avgPoints = totalUsers > 0 ? Math.round(totalPoints / totalUsers) : 0;
		const topPerformer = filteredData?.[0];

		return { totalUsers, totalPoints, avgPoints, topPerformer };
	};

	const stats = getTotalStats();

	// Utility function to truncate majors
	const truncateMajor = (major: string, maxLength: number = 25) => {
		if (!major || major.length <= maxLength) return major;
		return major.substring(0, maxLength) + "...";
	};

	return (
		<DashboardPage variant="list">
			{/* Header & Search */}
			<PageHeader
				hideTitleOnMobile
				title="Leaderboard"
				description="Community rankings based on event participation and engagement."
				actions={
					<div className="relative w-full md:w-[280px]">
						<div className="absolute inset-y-0 left-0 pl-[14px] flex items-center pointer-events-none">
							<Search className="h-4 w-4 text-muted-foreground" />
						</div>
						<Input
							type="text"
							placeholder="Search members..."
							value={searchTerm}
							onChange={(e) => {
								setSearchTerm(e.target.value);
								setCurrentPage(1);
							}}
							className="block w-full pl-[42px] pr-4 py-[11px] border border-border rounded-[9px] bg-background text-[14px] placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-border transition-[border-color,box-shadow] duration-150 ease-[ease]"
						/>
					</div>
				}
			/>

			{/* Stats Grid */}
			{!loading && stats.totalUsers <= 1 ? (
				<div className="flex flex-col gap-2 rounded-md border bg-ds-blue-100/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="font-medium">{stats.totalUsers} member enrolled</p>
						<p className="text-sm text-muted-foreground">
							Rankings begin when more members participate.
						</p>
					</div>
					<p className="text-sm font-medium tabular-nums">
						{stats.totalPoints.toLocaleString()} total points
					</p>
				</div>
			) : (
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
					{loading ? (
						<>
							<Skeleton className="h-[76px] rounded-md" />
							<Skeleton className="h-[76px] rounded-md" />
							<Skeleton className="h-[76px] rounded-md" />
							<Skeleton className="h-[76px] rounded-md" />
						</>
					) : (
						<>
							<div className="bg-background rounded-md px-5 py-4 border border-border">
								<p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-[2px]">
									Members
								</p>
								<p className="text-[26px] font-bold text-foreground leading-none tracking-tight">
									{stats.totalUsers}
								</p>
							</div>

							<div className="bg-background rounded-md px-5 py-4 border border-border">
								<p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-[2px]">
									Total Points
								</p>
								<p className="text-[26px] font-bold text-foreground leading-none tracking-tight">
									{stats.totalPoints.toLocaleString()}
								</p>
							</div>

							<div className="bg-background rounded-md px-5 py-4 border border-border">
								<p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-[2px]">
									Average
								</p>
								<p className="text-[26px] font-bold text-foreground leading-none tracking-tight">
									{stats.avgPoints}
								</p>
							</div>

							<div className="bg-ds-blue-700 rounded-md px-5 py-4">
								<p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-[2px]">
									Your Rank
								</p>
								<p className="text-[26px] font-bold text-white leading-none tracking-tight">
									{currentUserRank >= 0 ? `#${currentUserRank + 1}` : "—"}
								</p>
							</div>
						</>
					)}
				</div>
			)}

			{/* Podium Section */}
			{loading ? (
				<div className="h-64 flex items-center justify-center">
					<Skeleton className="w-full h-full rounded-md" />
				</div>
			) : topThree.length >= 3 && !searchTerm ? (
				<div className="pt-8 pb-10">
					<div className="flex justify-center items-end gap-6 sm:gap-10">
						{/* Second Place */}
						{topThree[1] && (
							<div className="flex flex-col items-center relative top-2">
								<div className="relative mb-4">
									<div className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-full border-[3px] border-white flex items-center justify-center bg-muted">
										<span className="text-[19px] font-bold text-muted-foreground tracking-tight">
											{topThree[1].name.substring(0, 2).toUpperCase()}
										</span>
									</div>
									<div className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 bg-ds-gray-800 text-white text-[10px] font-bold px-2.5 py-[3px] rounded-sm tracking-wide">
										2
									</div>
								</div>
								<div className="text-center mb-3 min-w-[90px]">
									<p className="font-semibold text-foreground text-[13px] sm:text-[14px] truncate">
										{topThree[1].name.split(" ")[0]}
									</p>
									<p className="text-[12px] font-bold text-muted-foreground mt-[2px]">
										{topThree[1].points} pts
									</p>
								</div>
								<div className="w-[72px] sm:w-[88px] h-[88px] bg-muted rounded-t-sm border-t border-x border-border" />
							</div>
						)}

						{/* First Place */}
						{topThree[0] && (
							<div className="flex flex-col items-center relative z-10">
								<div className="relative mb-5">
									<div className="absolute -top-7 left-1/2 -translate-x-1/2 z-0">
										<Crown className="w-7 h-7 text-ds-amber-900 fill-yellow-500" />
									</div>
									<div className="w-[84px] h-[84px] sm:w-[96px] sm:h-[96px] rounded-full border-[4px] border-white flex items-center justify-center bg-gradient-to-br from-yellow-50 to-ds-amber-200 shadow-sm">
										<span className="text-[23px] font-bold text-ds-amber-900 tracking-tight">
											{topThree[0].name.substring(0, 2).toUpperCase()}
										</span>
									</div>
									<div className="absolute -bottom-[10px] left-1/2 -translate-x-1/2 bg-yellow-600 text-white text-[11px] font-bold px-3 py-[3px] rounded-sm tracking-wide">
										1
									</div>
								</div>
								<div className="text-center mb-4 min-w-[110px]">
									<p className="font-semibold text-foreground text-[15px] sm:text-[16px]">
										{topThree[0].name}
									</p>
									<p className="text-[13px] font-bold text-ds-amber-900 mt-[2px]">
										{topThree[0].points} pts
									</p>
								</div>
								<div className="w-[84px] sm:w-[100px] h-[112px] bg-yellow-300 rounded-t-sm border-t border-x border-yellow-400" />
							</div>
						)}

						{/* Third Place */}
						{topThree[2] && (
							<div className="flex flex-col items-center relative top-4">
								<div className="relative mb-4">
									<div className="w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-full border-[3px] border-white flex items-center justify-center bg-ds-amber-100">
										<span className="text-[19px] font-bold text-ds-amber-900/70 tracking-tight">
											{topThree[2].name.substring(0, 2).toUpperCase()}
										</span>
									</div>
									<div className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 bg-orange-700 text-white text-[10px] font-bold px-2.5 py-[3px] rounded-sm tracking-wide">
										3
									</div>
								</div>
								<div className="text-center mb-3 min-w-[90px]">
									<p className="font-semibold text-foreground text-[13px] sm:text-[14px] truncate">
										{topThree[2].name.split(" ")[0]}
									</p>
									<p className="text-[12px] font-bold text-ds-amber-900/70 mt-[2px]">
										{topThree[2].points} pts
									</p>
								</div>
								<div className="w-[72px] sm:w-[88px] h-[72px] bg-orange-200 rounded-t-sm border-t border-x border-orange-300" />
							</div>
						)}
					</div>
				</div>
			) : null}

			{/* Main Leaderboard Table */}
			<div className="bg-background rounded-[12px] border border-border overflow-hidden">
				<div className="px-6 py-4 border-b border-border flex items-center justify-between bg-background">
					<div className="flex items-center gap-3">
						<Users className="w-4 h-4 text-muted-foreground" />
						<h2 className="text-[15px] font-semibold text-foreground">
							All Members
						</h2>
						<span className="text-[13px] text-muted-foreground">
							{startIndex + 1}-{Math.min(endIndex, totalItems)} of{" "}
							{leaderboard?.length || 0}
						</span>
					</div>
				</div>

				<div className="overflow-x-auto">
					{loading ? (
						<div className="p-6 space-y-3">
							{[...Array(10)].map((_, i) => (
								<Skeleton key={i} className="h-14 w-full rounded-lg" />
							))}
						</div>
					) : paginatedData && paginatedData.length > 0 ? (
						<table className="w-full">
							<thead>
								<tr className="bg-muted border-b border-border">
									<th className="px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-16 text-center">
										Rank
									</th>
									<th className="px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-left">
										Member
									</th>
									<th className="px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">
										Points
									</th>
									<th className="px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-left hidden md:table-cell">
										Major
									</th>
									<th className="px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center hidden lg:table-cell">
										Year
									</th>
									<th className="px-5 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center hidden sm:table-cell">
										Events
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{paginatedData.map((member) => {
									const rank =
										leaderboard?.findIndex((u) => u._id === member._id) ?? -1;
									return (
										<tr
											key={member._id}
											className={`group transition-colors duration-150 ${
												user?._id === member._id
													? "bg-ds-blue-1000/5"
													: "hover:bg-muted/80"
											}`}
										>
											<td className="px-5 py-3.5 whitespace-nowrap">
												<div
													className={`
                            w-8 h-8 flex items-center justify-center font-bold text-sm mx-auto rounded-sm
                            ${
															rank === 0
																? "bg-ds-amber-100 text-ds-amber-900"
																: rank === 1
																	? "bg-muted text-foreground"
																	: rank === 2
																		? "bg-ds-amber-100 text-ds-amber-900"
																		: "text-muted-foreground bg-muted"
														}
                          `}
												>
													{rank + 1}
												</div>
											</td>
											<td className="px-5 py-3.5 whitespace-nowrap">
												<div className="flex items-center">
													<div
														className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold
                              ${
																rank === 0
																	? "bg-ds-amber-100 text-ds-amber-900"
																	: rank === 1
																		? "bg-muted text-foreground"
																		: rank === 2
																			? "bg-ds-amber-100 text-ds-amber-900"
																			: "bg-ds-blue-100 text-ds-blue-700"
															}
                              `}
													>
														{member.name.substring(0, 2).toUpperCase()}
													</div>
													<div className="ml-3">
														<div className="flex items-center gap-2">
															<div className="text-[14px] font-semibold text-foreground group-hover:text-foreground transition-colors">
																{member.name}
															</div>
															{user?._id === member._id && (
																<span className="text-[10px] bg-foreground text-white px-2 py-0.5 rounded-sm font-medium uppercase tracking-wide">
																	You
																</span>
															)}
														</div>
													</div>
												</div>
											</td>
											<td className="px-5 py-3.5 whitespace-nowrap text-right">
												<span className="text-[14px] font-semibold text-foreground">
													{member.points.toLocaleString()}
												</span>
											</td>
											<td className="px-5 py-3.5 whitespace-nowrap hidden md:table-cell">
												<div
													className="text-[14px] text-muted-foreground font-medium"
													title={member.major || "Member"}
												>
													{truncateMajor(member.major || "—")}
												</div>
											</td>
											<td className="px-5 py-3.5 whitespace-nowrap hidden lg:table-cell text-center">
												<span className="text-[14px] text-muted-foreground font-medium">
													{member.graduationYear || "—"}
												</span>
											</td>
											<td className="px-5 py-3.5 whitespace-nowrap hidden sm:table-cell text-center">
												<span className="text-[14px] font-semibold text-foreground">
													{member.eventsAttended || 0}
												</span>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					) : (
						<div className="text-center py-16">
							<div className="flex flex-col items-center justify-center">
								<div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-4">
									<Search className="w-5 h-5 text-muted-foreground" />
								</div>
								<p className="text-[15px] font-semibold text-foreground">
									No results
								</p>
								<p className="text-[13px] text-muted-foreground mt-1 max-w-xs mx-auto">
									No members match "{searchTerm}"
								</p>
							</div>
						</div>
					)}
				</div>

				{/* Pagination Controls */}
				{totalPages > 1 && (
					<div className="bg-background px-6 py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
						<p className="text-[13px] text-muted-foreground text-center sm:text-left">
							Showing{" "}
							<span className="font-semibold text-foreground">
								{startIndex + 1}
							</span>{" "}
							to{" "}
							<span className="font-semibold text-foreground">
								{Math.min(endIndex, totalItems)}
							</span>{" "}
							of{" "}
							<span className="font-semibold text-foreground">
								{totalItems}
							</span>
						</p>
						<div className="flex justify-center">
							<Pagination
								currentPage={currentPage}
								totalPages={totalPages}
								onPageChange={setCurrentPage}
							/>
						</div>
					</div>
				)}
			</div>
		</DashboardPage>
	);
}
