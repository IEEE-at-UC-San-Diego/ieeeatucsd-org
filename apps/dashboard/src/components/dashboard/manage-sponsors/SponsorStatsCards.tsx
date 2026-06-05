import { Building2, Crown, Shield, Users } from "lucide-react";
import type { SponsorStats } from "./types";

interface SponsorStatsCardsProps {
  stats: SponsorStats;
  loading?: boolean;
}

export function SponsorStatsCards({ stats, loading = false }: SponsorStatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-200 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-16 rounded bg-gray-200 animate-pulse" />
                <div className="h-5 w-10 rounded bg-gray-200 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Sponsors",
      value: stats.totalSponsors,
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Gold Sponsors",
      value: stats.goldSponsors,
      icon: Crown,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: "Silver Sponsors",
      value: stats.silverSponsors,
      icon: Shield,
      color: "text-gray-600",
      bgColor: "bg-gray-100",
    },
    {
      title: "Bronze Sponsors",
      value: stats.bronzeSponsors,
      icon: Users,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat) => {
        const IconComponent = stat.icon;
        return (
          <div key={stat.title} className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor} ${stat.color}`}>
                <IconComponent className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">{stat.title}</p>
                <p className="text-xl font-bold text-gray-900 leading-tight">{stat.value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
