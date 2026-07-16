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

	return (
		<li className={cn("relative min-w-0", className)} {...props}>
			<div
				className={cn(
					"flex min-h-[52px] items-center gap-3 px-4 py-3 sm:px-6 md:px-4",
					interactive &&
						"cursor-pointer transition-colors active:bg-muted/60 active:scale-[0.995] md:hover:bg-muted/40",
				)}
				onClick={onClick}
				onKeyDown={
					interactive
						? (e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									onClick?.();
								}
							}
						: undefined
				}
				role={interactive ? "button" : undefined}
				tabIndex={interactive ? 0 : undefined}
			>
				{leading && <div className="shrink-0">{leading}</div>}
				<div className="min-w-0 flex-1 space-y-0.5">
					<div className="flex items-start justify-between gap-2">
						<p className="line-clamp-2 text-sm font-medium leading-5 text-foreground">
							{title}
						</p>
						{trailing && (
							<div className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
								{trailing}
							</div>
						)}
					</div>
					{(subtitle || meta || status) && (
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
							{status}
							{subtitle && <span className="min-w-0 truncate">{subtitle}</span>}
							{meta && <span className="min-w-0 truncate">{meta}</span>}
						</div>
					)}
				</div>
				{actions && (
					<div
						className="shrink-0"
						onClick={(e) => e.stopPropagation()}
						onKeyDown={(e) => e.stopPropagation()}
					>
						{actions}
					</div>
				)}
				{showChevron && interactive && !actions && (
					<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
				)}
			</div>
		</li>
	);
}
