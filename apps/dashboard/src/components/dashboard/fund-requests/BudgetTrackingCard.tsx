import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
	DEPARTMENT_LABELS,
	type FundRequestDepartment,
	formatCurrency,
} from "@/types/fund-requests";

interface BudgetTrackingCardProps {
	department: FundRequestDepartment;
	totalBudget: number;
	remainingBudget: number;
	pendingBudget: number;
	percentUsed: number;
	isConfigured: boolean;
	onClick?: () => void;
}

export function BudgetTrackingCard({
	department,
	totalBudget,
	remainingBudget,
	pendingBudget,
	percentUsed,
	isConfigured,
	onClick,
}: BudgetTrackingCardProps) {
	return (
		<Button
			variant="outline"
			type="button"
			onClick={isConfigured ? onClick : undefined}
			disabled={!isConfigured}
			className={cn(
				"h-full w-full rounded-md border bg-card p-4 text-left shadow-sm transition-colors",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				isConfigured
					? "hover:border-primary/50 hover:bg-accent/40"
					: "cursor-not-allowed bg-muted/40 opacity-75",
			)}
			aria-label={`${DEPARTMENT_LABELS[department]} budget details`}
		>
			<div className="mb-3 flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<div
						className={cn(
							"rounded-md p-1.5",
							isConfigured
								? "bg-primary/10 text-primary"
								: "bg-muted text-muted-foreground",
						)}
					>
						<Users className="w-3.5 h-3.5" />
					</div>
					<span className="font-semibold text-sm">
						{DEPARTMENT_LABELS[department]}
					</span>
				</div>
				{!isConfigured && (
					<span className="rounded-full border bg-muted px-2 py-1 text-xs text-muted-foreground">
						Not Configured
					</span>
				)}
			</div>

			{isConfigured ? (
				<>
					<div className="mb-4 flex items-end justify-between gap-3">
						<div className="min-w-0">
							<p className="text-xl font-bold leading-none">
								{formatCurrency(remainingBudget)}
							</p>
							<p className="mt-1 text-xs font-medium text-muted-foreground">
								of {formatCurrency(totalBudget)} remaining
							</p>
						</div>
						{pendingBudget > 0 && (
							<div className="text-right bg-ds-amber-100 px-1.5 py-0.5 rounded border border-ds-amber-100">
								<p className="text-xs font-semibold text-ds-amber-900">
									-{formatCurrency(pendingBudget)}
								</p>
								<p className="text-xs font-medium text-ds-amber-900">pending</p>
							</div>
						)}
					</div>

					<div className="space-y-1">
						<Progress value={Math.min(percentUsed, 100)} className="h-1.5" />
						<div className="flex justify-between text-xs font-medium text-muted-foreground">
							<span>0%</span>
							<span>50%</span>
							<span>100%</span>
						</div>
					</div>
				</>
			) : (
				<div className="py-2 text-center">
					<div className="w-full h-1 bg-muted rounded-full mb-1 opacity-50" />
					<p className="text-xs text-muted-foreground">
						Budget not configured.
					</p>
				</div>
			)}
		</Button>
	);
}
