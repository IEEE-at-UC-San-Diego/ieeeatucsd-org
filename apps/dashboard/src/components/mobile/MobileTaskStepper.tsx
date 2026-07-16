import { cn } from "@/lib/utils";

type MobileTaskStepperProps = {
	currentStep: number;
	totalSteps: number;
	stepTitle: string;
	className?: string;
	onStepClick?: (step: number) => void;
	maxVisitedStep?: number;
};

export function MobileTaskStepper({
	currentStep,
	totalSteps,
	stepTitle,
	className,
	onStepClick,
	maxVisitedStep,
}: MobileTaskStepperProps) {
	const progress = Math.min(100, Math.max(0, (currentStep / totalSteps) * 100));
	const canJump =
		typeof onStepClick === "function" && typeof maxVisitedStep === "number";

	return (
		<div className={cn("w-full min-w-0 space-y-2", className)}>
			<div className="flex items-baseline justify-between gap-3">
				<p className="min-w-0 truncate text-sm font-semibold text-foreground">
					{stepTitle}
				</p>
				<p className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
					Step {currentStep} of {totalSteps}
				</p>
			</div>
			<div
				className="h-1 w-full overflow-hidden rounded-full bg-muted"
				role="progressbar"
				aria-valuenow={currentStep}
				aria-valuemin={1}
				aria-valuemax={totalSteps}
				aria-label={`Step ${currentStep} of ${totalSteps}`}
			>
				<div
					className="h-full w-full origin-left rounded-full bg-ieee-blue transition-transform duration-200 ease-[var(--ease-in-out)] motion-instant-reduce"
					style={{ transform: `scaleX(${progress / 100})` }}
				/>
			</div>
			{canJump && (
				<div className="flex gap-1.5 overflow-x-auto scrollbar-quiet pb-0.5">
					{Array.from({ length: totalSteps }, (_, i) => {
						const step = i + 1;
						const visited = step <= maxVisitedStep;
						const active = step === currentStep;
						return (
							<button
								key={step}
								type="button"
								disabled={!visited}
								onClick={() => visited && onStepClick(step)}
								className={cn(
									"motion-press flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold transition-colors",
									active && "bg-ieee-blue text-on-accent",
									!active &&
										visited &&
										"bg-muted text-foreground hover:bg-accent",
									!visited && "bg-muted/50 text-muted-foreground/50",
								)}
								aria-current={active ? "step" : undefined}
								aria-label={`Go to step ${step}`}
							>
								{step}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
