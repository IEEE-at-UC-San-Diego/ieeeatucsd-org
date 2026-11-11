import { ChevronRight } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

type MobileDataListProps = React.ComponentProps<"ul"> & {
	empty?: React.ReactNode;
};

export function MobileDataList({
	className,
	children,
	empty,
	...props
}: MobileDataListProps) {
	const hasChildren = React.Children.count(children) > 0;

	if (!hasChildren && empty) {
		return <>{empty}</>;
	}

	return (
		<ul
			className={cn(
				"-mx-4 divide-y border-y bg-background sm:-mx-6 md:mx-0 md:rounded-md md:border",
				className,
			)}
			{...props}
		>
			{children}
		</ul>
	);
}

type MobileDataListItemProps = Omit<React.ComponentProps<"li">, "title"> & {
	title: React.ReactNode;
	subtitle?: React.ReactNode;
	meta?: React.ReactNode;
	status?: React.ReactNode;
	trailing?: React.ReactNode;
	leading?: React.ReactNode;
	onClick?: () => void;
	showChevron?: boolean;
	actions?: React.ReactNode;
};

export function MobileDataListItem({
	title,
	subtitle,
	meta,
	status,
	trailing,
	leading,
	onClick,
	showChevron = true,
	actions,
	className,
	...props
}: MobileDataListItemProps) {
	const interactive = Boolean(onClick);
	const rowPadding = "px-4 py-3 sm:px-6 md:px-4";

	const body = (
		<>
			{leading && <span className="shrink-0">{leading}</span>}
			<span className="block min-w-0 flex-1 space-y-0.5">
				<span className="flex items-start justify-between gap-2">
					<span className="line-clamp-2 text-sm font-medium leading-5 break-words text-foreground">
						{title}
					</span>
					{trailing && (
						<span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
							{trailing}
						</span>
					)}
				</span>
				{(subtitle || meta || status) && (
					<span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
						{status}
						{subtitle && <span className="min-w-0 truncate">{subtitle}</span>}
						{meta && <span className="min-w-0 truncate">{meta}</span>}
					</span>
				)}
			</span>
			{showChevron && interactive && !actions && (
				<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
			)}
		</>
	);

	return (
		<li className={cn("relative min-w-0", className)} {...props}>
			<div
				className={cn(
					"flex min-h-[52px] items-center gap-3",
					!interactive && rowPadding,
					interactive &&
						"transition-colors has-[>button:active]:bg-muted/60 md:hover:bg-muted/40",
				)}
			>
				{interactive ? (
					<button
						type="button"
						onClick={onClick}
						className={cn(
							"motion-press flex min-h-[52px] min-w-0 flex-1 cursor-pointer items-center gap-3 text-left",
							rowPadding,
							actions && "pr-0 sm:pr-0 md:pr-0",
						)}
					>
						{body}
					</button>
				) : (
					body
				)}
				{actions && (
					<div
						className={cn("shrink-0", interactive && "pr-4 sm:pr-6 md:pr-4")}
					>
						{actions}
					</div>
				)}
			</div>
		</li>
	);
}
