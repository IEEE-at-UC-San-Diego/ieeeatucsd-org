import { Link } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import { useId } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { InlineEmpty } from "./InlineEmpty";

export type PointsTrendPoint = {
	date: string;
	points: number;
};

type PointsTrendCardProps = {
	data: PointsTrendPoint[];
	rangeLabel: string | null;
};

function ActiveDot(props: Record<string, unknown>) {
	const { cx, cy, fill } = props as { cx: number; cy: number; fill: string };

	return (
		<g style={{ transform: `translate(${cx}px, ${cy}px)` }}>
			<circle cx={0} cy={0} r={10} fill={fill} fillOpacity={0.12} />
			<circle
				cx={0}
				cy={0}
				r={4.5}
				fill={fill}
				stroke="var(--card)"
				strokeWidth={2}
			/>
		</g>
	);
}

function ChartTooltip({ active, payload, label }: Record<string, unknown>) {
	const entries = payload as Array<Record<string, unknown>> | undefined;
	if (!active || !entries?.length) return null;
	const value = entries[0].value as number | undefined;

	return (
		<div className="pointer-events-none rounded-[6px] border bg-popover px-3 py-2 shadow-popover">
			<p className="text-[11px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
				{label as string}
			</p>
			<p className="mt-0.5 text-base font-semibold leading-5 tabular-nums text-popover-foreground">
				{value?.toLocaleString()}
				<span className="ml-1 text-xs font-normal text-muted-foreground">
					points
				</span>
			</p>
		</div>
	);
}

export function PointsTrendCard({ data, rangeLabel }: PointsTrendCardProps) {
	const prefersReducedMotion = usePrefersReducedMotion();
	// Strip the delimiters React adds; SVG `url(#id)` references can't parse them.
	const gradientId = `points-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
	const hasTrend =
		data.length >= 2 && new Set(data.map((point) => point.points)).size >= 2;

	return (
		<Card className="lg:col-span-2">
			<CardHeader>
				<CardTitle>Points over time</CardTitle>
				<CardDescription>Cumulative points earned</CardDescription>
				{hasTrend && rangeLabel && (
					<CardAction>
						<span className="text-xs tabular-nums text-muted-foreground">
							{rangeLabel}
						</span>
					</CardAction>
				)}
			</CardHeader>
			<CardContent>
				{hasTrend ? (
					<div className="h-56 lg:h-64">
						<ResponsiveContainer
							width="100%"
							height="100%"
							minWidth={0}
							minHeight={0}
						>
							<AreaChart
								data={data}
								margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
							>
								<defs>
									<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
										<stop
											offset="0%"
											stopColor="var(--ds-blue-700)"
											stopOpacity={0.16}
										/>
										<stop
											offset="100%"
											stopColor="var(--ds-blue-700)"
											stopOpacity={0}
										/>
									</linearGradient>
								</defs>
								<CartesianGrid
									strokeDasharray="3 3"
									vertical={false}
									className="stroke-border"
								/>
								<XAxis
									dataKey="date"
									axisLine={false}
									tickLine={false}
									interval="preserveStartEnd"
									minTickGap={28}
									tickMargin={10}
									tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
								/>
								<YAxis
									axisLine={false}
									tickLine={false}
									allowDecimals={false}
									width={36}
									tickMargin={4}
									tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
								/>
								<Tooltip
									content={<ChartTooltip />}
									cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
								/>
								<Area
									type="monotone"
									dataKey="points"
									stroke="var(--ds-blue-700)"
									fill={`url(#${gradientId})`}
									strokeWidth={1.75}
									strokeLinecap="round"
									dot={false}
									activeDot={<ActiveDot fill="var(--ds-blue-700)" />}
									isAnimationActive={!prefersReducedMotion}
									animationDuration={220}
									animationEasing="ease-out"
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				) : (
					<InlineEmpty
						className="h-56 py-0 lg:h-64"
						icon={<TrendingUp />}
						title="No trend yet"
						description="Check in at two or more events and your points will chart here."
						action={
							<Button asChild variant="secondary" size="sm" className="px-3">
								<Link to="/events">Browse events</Link>
							</Button>
						}
					/>
				)}
			</CardContent>
		</Card>
	);
}
