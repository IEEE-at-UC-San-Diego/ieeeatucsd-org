import { Calendar, CreditCard, DollarSign, Inbox } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { InlineEmpty } from "./InlineEmpty";

export type ActivityItem = {
	type: string;
	title: string;
	description: string;
	date: number;
	points?: number;
};

const ACTIVITY_CONFIG: Record<
	string,
	{ icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
	event: { icon: Calendar, tone: "text-tone-info" },
	reimbursement: { icon: CreditCard, tone: "text-tone-success" },
	fund_deposit: { icon: DollarSign, tone: "text-tone-info" },
};

export function ActivityLedger({ items }: { items: ActivityItem[] }) {
	return (
		<Card className="flex flex-col">
			<CardHeader>
				<CardTitle>Recent activity</CardTitle>
				<CardDescription>Your latest check-ins and requests</CardDescription>
			</CardHeader>
			<CardContent className="min-h-0 flex-1 overflow-y-auto scrollbar-quiet">
				{items.length > 0 ? (
					<ul className="divide-y divide-border">
						{items.map((item) => {
							const config =
								ACTIVITY_CONFIG[item.type] ?? ACTIVITY_CONFIG.event;
							const ActivityIcon = config.icon;
							return (
								<li
									key={`${item.type}-${item.date}-${item.title}`}
									className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
								>
									<span
										className={cn(
											"mt-0.5 grid size-7 shrink-0 place-items-center rounded-[4px] border bg-ds-background-200",
											config.tone,
										)}
									>
										<ActivityIcon className="size-3.5" />
									</span>
									<div className="min-w-0 flex-1">
										<div className="flex items-baseline justify-between gap-3">
											<p className="truncate text-sm font-medium leading-5 text-foreground">
												{item.title}
											</p>
											{typeof item.points === "number" && item.points > 0 && (
												<span className="shrink-0 text-xs font-semibold tabular-nums text-tone-info">
													+{item.points}
												</span>
											)}
										</div>
										<div className="mt-0.5 flex items-baseline justify-between gap-3">
											<p className="truncate text-xs leading-4 text-muted-foreground">
												{item.description}
											</p>
											<time
												dateTime={new Date(item.date).toISOString()}
												className="shrink-0 text-xs leading-4 tabular-nums text-muted-foreground"
											>
												{new Date(item.date).toLocaleDateString(undefined, {
													month: "short",
													day: "numeric",
												})}
											</time>
										</div>
									</div>
								</li>
							);
						})}
					</ul>
				) : (
					<InlineEmpty
						className="h-full"
						icon={<Inbox />}
						title="Nothing yet"
						description="Event check-ins and reimbursement updates will show up here."
					/>
				)}
			</CardContent>
		</Card>
	);
}
