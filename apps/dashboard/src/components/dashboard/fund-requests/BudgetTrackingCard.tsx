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
				"flex h-full w-full flex-col items-stretch justify-start gap-0 whitespace-normal rounded-md border bg-card p-4 text-left transition-colors",
				isConfigured
					? "hover:bg-muted/40"
					: "cursor-not-allowed bg-muted/40 opacity-75",
			)}
			aria-label={`${DEPARTMENT_LABELS[department]} budget details`}
		>
			<div className="flex w-full items-center justify-between gap-3">
				<span className="truncate text-sm font-medium text-muted-foreground">
					{DEPARTMENT_LABELS[department]}
				</span>
				{!isConfigured && (
					<span className="shrink-0 text-xs text-muted-foreground">
						Not configured
					</span>
				)}
			</div>

			{isConfigured ? (
				<>
					<p className="mt-2 text-2xl font-semibold leading-none tracking-[-0.02em] tabular-nums">
						{formatCurrency(remainingBudget)}
					</p>
					<p className="mt-1 text-xs text-muted-foreground tabular-nums">
						remaining of {formatCurrency(totalBudget)}
						{pendingBudget > 0 && (
							<> · {formatCurrency(pendingBudget)} pending</>
						)}
					</p>
					<Progress
						value={Math.min(percentUsed, 100)}
						className="mt-4 h-1"
						aria-label={`${Math.round(percentUsed)}% of budget used`}
					/>
				</>
			) : (
				<p className="mt-2 text-xs text-muted-foreground">
					Budget not configured.
				</p>
			)}
		</Button>
	);
}
