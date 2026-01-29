import React, { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../../../../firebase/client";
import { doc, onSnapshot } from "firebase/firestore";
import {
  Card,
  CardBody,
  Button,
  Skeleton,
  Tabs,
  Tab,
} from "@heroui/react";
import { OfficerLeaderboardService } from "./services/officerLeaderboardService";
import LeaderboardSettings from "./components/LeaderboardSettings";
import OfficerDetailsTable from "./components/ui/OfficerDetailsTable";
import type {
  TeamLeaderboardEntry,
  OfficerTeam,
  TeamMember,
} from "./types/OfficerLeaderboardTypes";
import type { UserRole } from "../../shared/types/firestore";

// Allowed roles for viewing officer leaderboard
const ALLOWED_OFFICER_ROLES: UserRole[] = [
  "General Officer",
  "Executive Officer",
  "Administrator",
];

interface TeamMetrics {
  team: OfficerTeam;
  totalAttendees: number;
  teamSize: number;
  attendanceRate: number;
  rank: number;
  members: TeamMember[];
}

export default function OfficerLeaderboardContent() {
  const [user] = useAuthState(auth);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<TeamMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [activeTab, setActiveTab] = useState("leaderboard");
  const [selectedTeamTab, setSelectedTeamTab] = useState<string>("Projects");

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(
      doc(db, "users", user.uid),
      (userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCurrentUserRole(userData.role);
        }
      },
      (error) => console.error("Error loading user role:", error)
    );
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !currentUserRole) return;

    if (!ALLOWED_OFFICER_ROLES.includes(currentUserRole)) {
      setError("You do not have permission to view the officer leaderboard.");
      return;
    }

    let isMounted = true;
    let currentRequestId = 0;

    const settingsUnsubscribe = onSnapshot(
      doc(db, "leaderboard_settings", "settings"),
      async () => {
        if (!isMounted) return;
        const requestId = ++currentRequestId;
        try {
          setLoading(true);
          const data = await OfficerLeaderboardService.getLeaderboardData();

          if (!isMounted || requestId !== currentRequestId) return;

          const teamMetrics: TeamMetrics[] = data.map((team, index) => ({
            team: team.team,
            totalAttendees: team.totalAttendees,
            teamSize: team.teamSize,
            attendanceRate: team.attendanceRate,
            rank: index + 1,
            members: team.members,
          }));

          setLeaderboardData(teamMetrics);
          // Default to the first team in the list (usually rank 1) if available
          if (teamMetrics.length > 0 && isMounted) {
            setSelectedTeamTab(teamMetrics[0].team);
          }
          setError("");
        } catch (error) {
          if (!isMounted) return;
          console.error("Error loading leaderboard data:", error);
          setError("Failed to load leaderboard data");
        } finally {
          if (isMounted) setLoading(false);
        }
      },
      (error) => {
        if (!isMounted) return;
        console.error("Error in settings listener:", error);
        setError("Failed to load leaderboard data");
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      settingsUnsubscribe();
    };
  }, [user, currentUserRole]);

  const maxAttendanceRate = Math.max(
    ...leaderboardData.map((team) => team.attendanceRate),
    1,
  );

  const selectedTeamData = leaderboardData.find(
    (team) => team.team === selectedTeamTab
  );

  if (!user || !currentUserRole) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!ALLOWED_OFFICER_ROLES.includes(currentUserRole)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-md mx-auto p-6 bg-red-50 rounded-lg">
          <h3 className="text-red-700 font-medium mb-1">Access Denied</h3>
          <p className="text-red-600 text-sm">
            This leaderboard is only visible to officers.
          </p>
        </div>
      </div>
    );
  }

  // Get available team names for tabs, sort by rank usually, but here just use what we have or fixed list
  // Actually using leaderboardData is better since it has the correct order (rank)
  const teamTabs = leaderboardData.length > 0
    ? leaderboardData.map(t => t.team)
    : ["Projects", "Events", "Internal"];

  return (
    <div className="flex-1 overflow-auto">
      <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
              Officer Leaderboard
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Track team performance and engagement
            </p>
          </div>

          {(currentUserRole === "Executive Officer" ||
            currentUserRole === "Administrator") && (
              <Button
                size="sm"
                variant="flat"
                onPress={() => setActiveTab(activeTab === "leaderboard" ? "settings" : "leaderboard")}
                className="bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                {activeTab === "leaderboard" ? "Settings" : "View Leaderboard"}
              </Button>
            )}
        </div>

        {activeTab === "leaderboard" ? (
          <>
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                  ))}
                </div>
                <Skeleton className="h-64 rounded-xl" />
              </div>
            ) : (
              <div className="space-y-8">
                {/* Top Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {leaderboardData.slice(0, 3).map((team) => (
                    <Card
                      key={team.team}
                      isPressable
                      onPress={() => setSelectedTeamTab(team.team)}
                      className={`border shadow-sm transition-all ${selectedTeamTab === team.team
                        ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50/10"
                        : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                    >
                      <CardBody className="p-5 flex flex-row items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${team.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                              team.rank === 2 ? 'bg-gray-100 text-gray-700' :
                                'bg-orange-100 text-orange-700'
                              }`}>
                              #{team.rank}
                            </span>
                            <h3 className="font-semibold text-gray-900">{team.team}</h3>
                          </div>
                          <div className="text-xs text-gray-500 font-medium">
                            {team.teamSize} Officers · {team.totalAttendees} Attendances
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-gray-900 block">
                            {team.attendanceRate.toFixed(1)}%
                          </span>
                          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                            Rate
                          </span>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>

                {/* Attendance Note */}
                <div className="text-xs text-gray-400 text-center">
                  Attendance Rate = (Total Team Attendances ÷ Total Possible Attendances) × 100
                </div>

                {/* Tabs for Teams */}
                <div className="flex justify-center w-full">
                  <Tabs
                    selectedKey={selectedTeamTab}
                    onSelectionChange={(key) => setSelectedTeamTab(key as string)}
                    variant="underlined"
                    classNames={{
                      tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
                      cursor: "w-full bg-blue-500",
                      tab: "max-w-fit px-0 h-12",
                      tabContent: "group-data-[selected=true]:text-blue-600 font-medium text-gray-500"
                    }}
                  >
                    {teamTabs.map((teamName) => (
                      <Tab
                        key={teamName}
                        title={
                          <div className="flex items-center gap-2 px-4">
                            <span>{teamName} Team</span>
                            {leaderboardData.find(t => t.team === teamName) && (
                              <div className="bg-gray-100 text-gray-600 text-xs py-0.5 px-1.5 rounded-md font-semibold">
                                #{leaderboardData.find(t => t.team === teamName)?.rank}
                              </div>
                            )}
                          </div>
                        }
                      />
                    ))}
                  </Tabs>
                </div>

                {/* Selected Team Detail */}
                <div className="min-h-[400px]">
                  {selectedTeamData ? (
                    <OfficerDetailsTable
                      key={selectedTeamData.team}
                      team={selectedTeamData.team}
                      members={selectedTeamData.members}
                      teamAttendanceRate={selectedTeamData.attendanceRate}
                      maxAttendanceRate={maxAttendanceRate}
                      rank={selectedTeamData.rank}
                    />
                  ) : (
                    leaderboardData.length > 0 ? (
                      <div className="flex justify-center items-center h-48 border border-dashed border-gray-200 rounded-xl bg-gray-50">
                        <p className="text-gray-500 text-sm">Select a team to view details</p>
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <p className="text-gray-500 font-medium">No performance data available yet.</p>
                        <p className="text-gray-400 text-sm mt-1">
                          Wait for officers to attend events to see rankings.
                        </p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <LeaderboardSettings />
        )}
      </main>
    </div>
  );
}
