import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NetworkErrorStateProps = {
	onRetry?: () => void;
	title?: string;
	description?: string;
	className?: string;
};

/**
 * Shown when a query never resolves because the device is offline
 * (or the network dropped) — replaces indefinite skeletons.
 */
export function NetworkErrorState({
	onRetry,
	title = "You're offline",
	description = "Check your connection and try again. Your work is still on this device when possible.",
	className,
}: NetworkErrorStateProps) {
	return (
		<div
			role="alert"
			className={cn(
				"rounded-md border border-ds-amber-100/80 bg-ds-amber-100/40 p-6 text-center",
				className,
			)}
		>
			<div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ds-amber-100">
				<WifiOff className="h-6 w-6 text-tone-warning" aria-hidden />
			</div>
			<h2 className="text-base font-semibold text-tone-warning">{title}</h2>
			<p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
				{description}
			</p>
			{onRetry && (
				<Button
					type="button"
					variant="outline"
					className="mt-4 h-11 min-w-[44px] border-ds-amber-100 bg-background"
					onClick={onRetry}
				>
					<RefreshCw className="mr-2 h-4 w-4" />
					Retry
				</Button>
			)}
		</div>
	);
}
