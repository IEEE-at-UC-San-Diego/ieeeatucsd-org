import { CalendarDays, CheckCircle2, Users } from "lucide-react";
import type { EventStats } from "../types";

interface EventStatsCardsProps {
  stats: EventStats;
  loading?: boolean;
}

export function EventStatsCards({ stats, loading = false }: EventStatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-gray-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
                <div className="h-6 w-12 rounded bg-gray-200 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Events",
      value: stats.totalEvents,
      icon: CalendarDays,
      gradient: "from-blue-500 to-blue-600",
      bgGradient: "from-blue-50 to-blue-100",
      textColor: "text-blue-600",
    },
    {
      title: "Published Events",
      value: stats.publishedEvents,
      icon: CheckCircle2,
      gradient: "from-pink-500 to-pink-600",
      bgGradient: "from-pink-50 to-pink-100",
      textColor: "text-pink-600",
    },
    {
      title: "Total Attendees",
      value: stats.totalAttendees,
      icon: Users,
      gradient: "from-purple-500 to-purple-600",
      bgGradient: "from-purple-50 to-purple-100",
      textColor: "text-purple-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {statCards.map((stat) => {
        const IconComponent = stat.icon;
        return (
          <div
            key={stat.title}
            className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${stat.bgGradient} p-6`}
          >
            <div className="relative z-10 flex items-center gap-4">
              <div
                className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} text-white shadow-lg`}
              >
                <IconComponent className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {stat.title}
                </p>
                <p
                  className={`text-2xl font-bold ${stat.textColor}`}
                >
                  {stat.value.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
