import { Calendar, Trophy, Users } from "lucide-react";

interface UserStatsCardsProps {
  latestEvent?: {
    eventName: string;
    eventDate: number;
  };
  totalPoints: number;
  eventsAttended: number;
  loading?: boolean;
}

export function UserStatsCards({
  latestEvent,
  totalPoints,
  eventsAttended,
  loading = false,
}: UserStatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card px-4 py-3 shadow-sm">
            <div className="flex flex-col gap-2">
              <div className="h-3 w-20 rounded bg-muted animate-pulse" />
              <div className="h-7 w-28 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: "Latest Event",
      value: latestEvent?.eventName || "None",
      subtext: latestEvent
        ? new Date(latestEvent.eventDate).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })
        : undefined,
      icon: Calendar,
    },
    {
      title: "Total Points",
      value: totalPoints.toLocaleString(),
      icon: Trophy,
    },
    {
      title: "Events Attended",
      value: eventsAttended.toString(),
      icon: Users,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {stats.map((stat) => {
        const IconComponent = stat.icon;
        return (
          <div
            key={stat.title}
            className="rounded-lg border bg-card px-4 py-3 shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 text-muted-foreground">
                <IconComponent className="h-4 w-4" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.title}
                </p>
                <p
                  className="text-xl font-bold truncate text-foreground tabular-nums"
                  title={stat.value}
                >
                  {stat.value}
                </p>
                {stat.subtext && (
                  <p className="text-[11px] text-muted-foreground">{stat.subtext}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
