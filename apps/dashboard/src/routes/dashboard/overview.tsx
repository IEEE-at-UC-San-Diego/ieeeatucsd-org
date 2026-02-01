import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@/integrations/convex/api";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useLogto } from "@logto/react";
import { useUserRoles } from "@/lib/user/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Users,
  Trophy,
  Clock,
  TrendingUp,
} from "lucide-react";
import { api as apiFunctions } from "@/convex/_generated/api";

export const Route = createFileRoute("/dashboard/overview")({
  component: OverviewPage,
  beforeLoad: () => {
    const { isAuthenticated } = useLogto();
    if (!isAuthenticated) {
      throw redirect({ to: "/signin" });
    }
  },
});

function OverviewPage() {
  const { isAuthenticated } = useLogto();
  const { userId, name, roles } = useUserRoles();

  const { data: attendedEvents } = useQuery(
    apiFunctions.events.getUserAttendedEvents,
    userId && isAuthenticated ? { userId, onlyPublished: true } : "skip"
  );

  const { data: userRank } = useQuery(
    apiFunctions.public_profiles.getUserRank,
    userId && isAuthenticated ? { userId } : "skip"
  );

  const { data: eventStats } = useQuery(apiFunctions.events.getStats);

  // Calculate academic year boundaries (September 1 - August 31)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const academicYearStart =
    currentMonth >= 8
      ? new Date(currentYear, 8, 1, 0, 0, 0, 0)
      : new Date(currentYear - 1, 8, 1, 0, 0, 0, 0);

  const academicYearEnd =
    currentMonth >= 8
      ? new Date(currentYear + 1, 7, 31, 23, 59, 59, 999)
      : new Date(currentYear, 7, 31, 23, 59, 59, 999);

  // Filter events for academic year
  const thisYearEvents = attendedEvents?.filter((event) => {
    const eventStart = event.startDate;
    return eventStart >= academicYearStart.getTime() && eventStart <= academicYearEnd.getTime();
  });

  const totalPoints = thisYearEvents?.reduce((sum, event) => sum + (event.pointsEarned || 0), 0) || 0;

  const quickActions = [
    {
      title: "Events",
      icon: Calendar,
      href: "/dashboard/events",
      color: "bg-blue-100 text-blue-600",
    },
    {
      title: "Leaderboard",
      icon: Trophy,
      href: "/dashboard/leaderboard",
      color: "bg-yellow-100 text-yellow-600",
    },
    {
      title: "Profile",
      icon: Users,
      href: "/dashboard/settings",
      color: "bg-purple-100 text-purple-600",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-2 bg-gradient-to-br from-blue-600 to-blue-800 text-white border-none shadow-md">
            <CardContent className="p-6 flex flex-row items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold mb-2">
                  Welcome, {name?.split(" ")[0] || "Member"}!
                </h1>
                <p className="text-blue-100 text-sm md:text-base">
                  You've earned <span className="font-bold text-white">{totalPoints} points</span> and attended{" "}
                  <span className="font-bold text-white">{thisYearEvents?.length || 0} events</span> this
                  year.
                </p>
              </div>
              <div className="hidden sm:block">
                <div className="w-16 h-16 bg-white/20 text-white rounded-full flex items-center justify-center">
                  <Trophy className="w-8 h-8" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-gray-100 shadow-sm">
            <CardContent className="p-6 flex flex-col justify-center items-center text-center">
              <p className="text-gray-500 text-sm font-medium uppercase tracking-wide">Current Rank</p>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-4xl font-bold text-gray-900">
                  #{userRank?.rank || "-"}
                </span>
                <span className="text-gray-400 text-sm">/ {userRank?.totalMembers || 0}</span>
              </div>
              {userRank && userRank.totalMembers > 0 && (
                <div className="mt-3">
                  <Badge variant="secondary" className="text-xs">
                    Top {Math.ceil((userRank.rank / userRank.totalMembers) * 100)}%
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <Button
                key={index}
                variant="outline"
                asChild
                className="bg-white hover:bg-gray-50 border border-gray-200 h-auto py-3 px-4 justify-start gap-3 shadow-sm"
              >
                <a href={action.href}>
                  <div className={`p-2 rounded-lg ${action.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-gray-700">{action.title}</span>
                </a>
              </Button>
            );
          })}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-none shadow-sm bg-gradient-to-br from-green-50/50 to-white hover:shadow-md transition-all duration-300">
            <CardContent className="p-5">
              <div className="flex flex-col gap-2">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Total Points</p>
                <h4 className="text-3xl font-black text-green-600">{totalPoints}</h4>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-gradient-to-br from-purple-50/50 to-white hover:shadow-md transition-all duration-300">
            <CardContent className="p-5">
              <div className="flex flex-col gap-2">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Events Attended</p>
                <h4 className="text-3xl font-black text-purple-600">{thisYearEvents?.length || 0}</h4>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-gradient-to-br from-orange-50/50 to-white hover:shadow-md transition-all duration-300">
            <CardContent className="p-5">
              <div className="flex flex-col gap-2">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Upcoming Events</p>
                <h4 className="text-3xl font-black text-orange-600">{eventStats?.totalUpcoming || 0}</h4>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-gradient-to-br from-blue-50/50 to-white hover:shadow-md transition-all duration-300">
            <CardContent className="p-5">
              <div className="flex flex-col gap-2">
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Your Role</p>
                <h4 className="text-lg font-bold text-blue-600 truncate">
                  {roles[0]?.replace("_", " ") || "member"}
                </h4>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recently Attended Events */}
        <Card className="w-full border border-gray-200" shadow="none">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Recently Attended Events</h2>
            </div>
            {!attendedEvents || attendedEvents.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                No attended events yet — check in at your next meetup!
              </div>
            ) : (
              <div className="space-y-2">
                {attendedEvents.slice(0, 3).map((event) => {
                  const eventDate = new Date(event.startDate);
                  return (
                    <div
                      key={event._id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-12 text-center bg-blue-50 rounded-md p-1">
                        <div className="text-xs text-blue-600 font-bold uppercase">
                          {eventDate.toLocaleDateString(undefined, { month: "short" })}
                        </div>
                        <div className="text-lg font-bold text-gray-900 leading-none">
                          {eventDate.getDate()}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{event.eventName}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {eventDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </div>
                      </div>
                      {event.pointsEarned > 0 && (
                        <Badge variant="secondary" className="h-6 text-xs">
                          +{event.pointsEarned}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
