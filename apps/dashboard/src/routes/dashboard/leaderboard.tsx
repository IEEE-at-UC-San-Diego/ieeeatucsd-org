import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@/integrations/convex/api";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useLogto } from "@logto/react";
import { useUserRoles } from "@/lib/user/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Trophy, Stars, Users } from "lucide-react";
import { api as apiFunctions } from "@/convex/_generated/api";

export const Route = createFileRoute("/dashboard/leaderboard")({
  component: LeaderboardPage,
  beforeLoad: () => {
    const { isAuthenticated } = useLogto();
    if (!isAuthenticated) {
      throw redirect({ to: "/signin" });
    }
  },
});

function LeaderboardPage() {
  const { isAuthenticated } = useLogto();
  const { userId } = useUserRoles();
  const { data: leaderboardData } = useQuery(apiFunctions.public_profiles.list, { limit: 50, sort: "points" });

  const { data: userRank } = useQuery(
    apiFunctions.public_profiles.getUserRank,
    userId && isAuthenticated ? { userId } : "skip"
  );

  const [searchTerm, setSearchTerm] = React.useState("");

  // Filter leaderboard
  const filteredData = leaderboardData?.filter((member) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      member.name.toLowerCase().includes(searchLower) ||
      (member.major && member.major.toLowerCase().includes(searchLower))
    );
  });

  // Calculate stats
  const stats = React.useMemo(() => {
    if (!filteredData) return { totalUsers: 0, totalPoints: 0, avgPoints: 0, topPerformer: null };
    const totalUsers = filteredData.length;
    const totalPoints = filteredData.reduce((sum, user) => sum + user.points, 0);
    const avgPoints = totalUsers > 0 ? Math.round(totalPoints / totalUsers) : 0;
    const topPerformer = filteredData[0];
    return { totalUsers, totalPoints, avgPoints, topPerformer };
  }, [filteredData]);

  // Get top 3 for podium
  const topThree = filteredData?.slice(0, 3) || [];
  const restOfLeaderboard = filteredData?.slice(3) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Community Leaderboard</h1>
            <p className="text-gray-500 text-sm max-w-2xl">
              Celebrating our most active members. Earn points by attending events, workshops, and being an active part of the community.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              placeholder="Find a member..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Card className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 group hover:shadow-md transition-all duration-300">
            <CardContent className="p-5">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Members</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 group hover:shadow-md transition-all duration-300">
            <CardContent className="p-5">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Points</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalPoints.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 group hover:shadow-md transition-all duration-300">
            <CardContent className="p-5">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Average Score</p>
                <p className="text-3xl font-bold text-gray-900">{stats.avgPoints}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl shadow-sm text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity"></div>
            <CardContent className="p-5 relative z-10">
              <div>
                <p className="text-xs font-bold text-indigo-100 uppercase tracking-wider mb-1">Your Rank</p>
                <p className="text-3xl font-black">
                  {userRank?.rank ? `#${userRank.rank}` : "-"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Podium Section */}
        {topThree.length >= 3 && (
          <div className="pt-4 pb-8">
            <div className="flex justify-center items-end gap-3 sm:gap-6 lg:gap-8">
              {/* Second Place */}
              {topThree[1] && (
                <div className="flex flex-col items-center group relative top-4">
                  <div className="relative mb-3 transition-transform duration-300 group-hover:-translate-y-1">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white shadow-lg overflow-hidden relative z-10 bg-gray-100 flex items-center justify-center">
                      <span className="text-xl font-black text-gray-400">
                        {topThree[1].name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md z-20 border-2 border-white">
                      2nd
                    </div>
                  </div>
                  <div className="text-center mb-2">
                    <p className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-1 max-w-[80px]">
                      {topThree[1].name.split(" ")[0]}
                    </p>
                    <p className="text-[10px] font-bold text-gray-500">{topThree[1].points} pts</p>
                  </div>
                  <div className="w-16 sm:w-24 h-24 bg-gradient-to-t from-gray-200 to-gray-50 rounded-t-xl relative">
                    <div className="absolute inset-0 bg-white/50"></div>
                  </div>
                </div>
              )}

              {/* First Place */}
              {topThree[0] && (
                <div className="flex flex-col items-center group z-10">
                  <div className="relative mb-4 transition-transform duration-300 group-hover:-translate-y-1">
                    <style>{`
                      @keyframes gentle-float {
                        0%, 100% { transform: translateX(-50%) translateY(0px) rotate(0deg); }
                        50% { transform: translateX(-50%) translateY(-6px) rotate(0deg); }
                      }
                      .animate-gentle-float {
                        animation: gentle-float 2.5s ease-in-out infinite;
                      }
                    `}</style>
                    <div className="absolute -top-8 left-1/2 z-0 animate-gentle-float">
                      <Trophy className="w-10 h-10 text-yellow-500 fill-yellow-400/80 drop-shadow-sm" />
                    </div>
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white shadow-xl overflow-hidden relative z-10 bg-gradient-to-br from-yellow-50 to-yellow-100 flex items-center justify-center ring-4 ring-yellow-400/20">
                      <span className="text-2xl font-black text-yellow-700">
                        {topThree[0].name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg z-20 border-2 border-white flex items-center gap-1">
                      1st
                    </div>
                  </div>
                  <div className="text-center mb-3">
                    <p className="font-bold text-gray-900 text-sm sm:text-base">{topThree[0].name}</p>
                    <p className="text-xs font-bold text-yellow-600">{topThree[0].points} points</p>
                  </div>
                  <div className="w-20 sm:w-28 h-32 bg-gradient-to-t from-yellow-200/50 to-yellow-50/50 rounded-t-xl relative shadow-md ring-1 ring-yellow-400/10">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/20"></div>
                  </div>
                </div>
              )}

              {/* Third Place */}
              {topThree[2] && (
                <div className="flex flex-col items-center group relative top-6">
                  <div className="relative mb-3 transition-transform duration-300 group-hover:-translate-y-1">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-white shadow-lg overflow-hidden relative z-10 bg-orange-50 flex items-center justify-center">
                      <span className="text-xl font-black text-orange-800/60">
                        {topThree[2].name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-orange-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md z-20 border-2 border-white">
                      3rd
                    </div>
                  </div>
                  <div className="text-center mb-2">
                    <p className="font-bold text-gray-900 text-xs sm:text-sm line-clamp-1 max-w-[80px]">
                      {topThree[2].name.split(" ")[0]}
                    </p>
                    <p className="text-[10px] font-bold text-orange-800/60">{topThree[2].points} pts</p>
                  </div>
                  <div className="w-16 sm:w-24 h-20 bg-gradient-to-t from-orange-200 to-orange-50 rounded-t-xl relative">
                    <div className="absolute inset-0 bg-white/50"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        <Card className="bg-white rounded-3xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] ring-1 ring-gray-200/75 overflow-hidden">
          <CardContent className="px-6 py-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">All Members</h2>
                <p className="text-xs text-gray-500">
                  Showing top {restOfLeaderboard.length + topThree.length} members
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 border-b border-gray-100/50">
                    <TableHead className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider w-20 text-center">
                      Rank
                    </TableHead>
                    <TableHead className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left">
                      Member
                    </TableHead>
                    <TableHead className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">
                      Points
                    </TableHead>
                    <TableHead className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-left hidden md:table-cell">
                      Major
                    </TableHead>
                    <TableHead className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center hidden sm:table-cell">
                      Events
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-50">
                  {restOfLeaderboard.map((member) => (
                    <TableRow
                      key={member._id}
                      className={`group transition-all duration-200 ${
                        member.userId === userId
                          ? "bg-blue-50/30 hover:bg-blue-50/60"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm mx-auto ${
                            member.rank === 1
                              ? "bg-gradient-to-br from-yellow-100 to-amber-100 text-amber-800 shadow-sm"
                              : member.rank === 2
                                ? "bg-gradient-to-br from-gray-100 to-slate-200 text-slate-700 shadow-sm"
                                : member.rank === 3
                                  ? "bg-gradient-to-br from-orange-100 to-orange-200 text-orange-800 shadow-sm"
                                  : "text-gray-500 bg-gray-100/50"
                          }`}
                        >
                          {member.rank}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ring-2 ring-white ${
                              member.rank === 1
                                ? "bg-yellow-100 text-yellow-700"
                                : member.rank === 2
                                  ? "bg-gray-100 text-gray-700"
                                  : member.rank === 3
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-blue-50 text-blue-600"
                            }`}
                          >
                            {member.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                {member.name}
                              </div>
                              {member.userId === userId && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-green-50 text-green-700 border border-green-100/50">
                          <Stars className="w-3 h-3 fill-current" />
                          {member.points.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <div className="text-sm text-gray-600 font-medium">{member.major || "—"}</div>
                      </TableCell>
                      <TableCell className="px-6 py-4 whitespace-nowrap hidden sm:table-cell text-center">
                        <div className="text-sm font-bold text-gray-900">{member.totalEventsAttended || 0}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {restOfLeaderboard.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="px-6 py-16 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Search className="w-6 h-6 text-gray-300" />
                          </div>
                          <p className="text-lg font-bold text-gray-900">No members found</p>
                          {searchTerm && (
                            <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                              We couldn't find any members matching "{searchTerm}". Try adjusting your search.
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
