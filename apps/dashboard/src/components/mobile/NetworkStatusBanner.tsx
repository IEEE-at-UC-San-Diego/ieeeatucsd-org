import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

/**
 * Compact shell banner for offline / standalone network loss.
 * Does not block interaction — pages still render cached data when available.
 */
export function NetworkStatusBanner({ className }: { className?: string }) {
	const isOnline = useOnlineStatus();

	if (isOnline) return null;

	return (
		<div
			role="status"
			aria-live="polite"
			className={cn(
				"flex shrink-0 items-center justify-center gap-2 border-b border-ds-amber-100/80 bg-ds-amber-100/90 px-3 py-2 text-center text-xs font-medium text-ds-amber-900",
				className,
			)}
		>
			<WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
			<span>
				You're offline — reconnect to load new data or submit changes.
			</span>
		</div>
	);
}
