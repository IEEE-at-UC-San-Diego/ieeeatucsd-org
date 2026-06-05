import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthedQuery } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import { AlertCircle, Calendar, CreditCard, DollarSign, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useRef, useEffect } from "react";

export const Route = createFileRoute("/_dashboard/overview")({
  component: OverviewPage,
});

/* ─── Smooth Animated Active Dot ─── */
function AnimatedActiveDot(props: Record<string, unknown>) {
  const { cx, cy, fill } = props as { cx: number; cy: number; fill: string };
  const prevPos = useRef({ x: cx, y: cy });

  // On mount, snap to position; on subsequent updates, animate
  useEffect(() => {
    prevPos.current = { x: cx, y: cy };
  }, [cx, cy]);

  return (
    <g
      style={{
        transform: `translate(${cx}px, ${cy}px)`,
        transition: "transform 250ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Subtle outer ring */}
      <circle
        cx={0}
        cy={0}
        r={10}
        fill={fill}
        fillOpacity={0.12}
        style={{
          transition: "r 200ms ease, fill-opacity 200ms ease",
        }}
      />
      {/* Main dot */}
      <circle
        cx={0}
        cy={0}
        r={4.5}
        fill={fill}
        stroke="hsl(var(--card))"
        strokeWidth={2}
      />
    </g>
  );
}

/* ─── Custom Tooltip ─── */
function ChartTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !(payload as Array<Record<string, unknown>>)?.length) return null;
  const data = (payload as Array<Record<string, unknown>>)[0];
  return (
    <div
      style={{
        background: "hsl(var(--popover))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "10px",
        padding: "12px 16px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1)",
        backdropFilter: "blur(8px)",
        zIndex: 50,
        pointerEvents: "none" as const,
      }}
    >
      <p style={{ fontSize: "12px", fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: "4px", letterSpacing: "0.01em" }}>
        {label as string}
      </p>
      <p style={{ fontSize: "18px", fontWeight: 800, color: "hsl(var(--popover-foreground))", margin: 0 }}>
        {(data.value as number)?.toLocaleString()} <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e3a8a" }}>pts</span>
      </p>
    </div>
  );
}

/* ─── Activity Icon Map ─── */
const activityConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  event: { icon: Calendar, color: "text-blue-600" },
  reimbursement: { icon: CreditCard, color: "text-emerald-600" },
  fund_deposit: { icon: DollarSign, color: "text-violet-600" },
};

/* ─── Main Page ─── */
function OverviewPage() {
  const { user, isLoading, signOut } = useAuth();
  const { logtoId } = usePermissions();
  const overviewData = useAuthedQuery(
    api.users.getOverviewData,
    logtoId ? { logtoId } : "skip",
  );

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-8 w-full max-w-5xl mx-auto">
        <div className="flex flex-col items-center text-center py-8">
          <Skeleton className="h-9 w-72 mb-3" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 md:p-8 w-full max-w-3xl mx-auto">
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-6 md:p-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-700 mt-0.5" />
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-amber-900">
                Finalizing account setup...
              </h2>
              <p className="text-sm text-amber-900/80">
                We are syncing your dashboard profile. This should only take a moment.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  <Loader2 className="h-4 w-4 mr-2" />
                  Retry
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => signOut()}
                >
                  Sign out
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chartData = overviewData?.pointsHistory.map((p) => ({
    date: new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    points: p.cumulative,
  })) || [];

  const firstName = user.name?.split(" ")[0] || "Member";
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-6 md:p-8 space-y-8 w-full max-w-5xl mx-auto">
      {/* ─── Welcome Section ─── */}
      <div className="flex flex-col items-center text-center py-6">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          {greeting}, {firstName}
        </h1>
        <p className="text-muted-foreground text-sm mt-2 max-w-sm">
          Here's a snapshot of your activity and progress.
        </p>
      </div>

      {/* ─── Compact Stats Row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Points</p>
          <p className="text-xl font-bold tabular-nums mt-0.5">{user.points || 0}</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Events</p>
          <p className="text-xl font-bold tabular-nums mt-0.5">{user.eventsAttended || 0}</p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Rank</p>
          <p className="text-xl font-bold tabular-nums mt-0.5">
            {overviewData?.rank ? `#${overviewData.rank}` : "--"}
            {overviewData?.totalMembers && (
              <span className="text-xs font-normal text-muted-foreground ml-1">/ {overviewData.totalMembers}</span>
            )}
          </p>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Member Since</p>
          <p className="text-xl font-bold mt-0.5">
            {user.joinDate
              ? new Date(user.joinDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
              : "--"}
          </p>
        </div>
      </div>

      {/* ─── Main Content Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Points Chart */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="font-semibold text-sm">Points over time</p>
              <p className="text-xs text-muted-foreground mt-0.5">Cumulative points earned</p>
            </div>
            {chartData.length >= 2 && (
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {chartData.length} data points
              </span>
            )}
          </div>
          {chartData.length >= 2 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pointsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1e40af" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#1e40af" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    className="stroke-border"
                    strokeOpacity={0.5}
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    width={40}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="points"
                    stroke="#1e3a8a"
                    fill="url(#pointsFill)"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "#1e3a8a", stroke: "hsl(var(--card))", strokeWidth: 2 }}
                    activeDot={<AnimatedActiveDot fill="#1e3a8a" />}
                    animationDuration={600}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center text-muted-foreground/60 space-y-2">
              <p className="text-sm">Attend events to see your growth chart</p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border bg-card p-5 shadow-sm flex flex-col">
          <div className="mb-4">
            <p className="font-semibold text-sm">Recent Activity</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your latest updates</p>
          </div>
          <div className="flex-1 overflow-hidden">
            {overviewData?.recentActivity && overviewData.recentActivity.length > 0 ? (
              <div className="space-y-0 divide-y divide-border max-h-72 overflow-y-auto">
                {overviewData.recentActivity.map((activity, idx) => {
                  const config = activityConfig[activity.type] || activityConfig.event;
                  const ActivityIcon = config.icon;
                  return (
                    <div key={idx} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <div className={`mt-0.5 ${config.color}`}>
                        <ActivityIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{activity.title}</p>
                          {typeof activity.points === "number" && activity.points > 0 ? (
                            <span className="text-[10px] font-bold text-primary tabular-nums shrink-0">
                              +{activity.points}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                          <p className="text-[10px] text-muted-foreground/60 shrink-0 ml-2 tabular-nums">
                            {new Date(activity.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground/60 py-12">
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Profile CTA ─── */}
      {!user.signedUp && (
        <div className="rounded-xl border border-amber-200/50 bg-amber-50/50 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-amber-900">
              Complete Your Profile
            </h3>
            <p className="text-xs text-amber-800/80 max-w-2xl">
              Finish setting up your account to access all features and start earning points.
            </p>
          </div>
          <Link
            to="/get-started"
            className="inline-flex items-center justify-center px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-xs font-semibold shadow-sm shrink-0"
          >
            Finish Setup
          </Link>
        </div>
      )}
    </div>
  );
}
