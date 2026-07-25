import type * as React from "react";
import { cn } from "@/lib/utils";

type InlineEmptyProps = {
	icon: React.ReactNode;
	title: string;
	description: string;
	action?: React.ReactNode;
	className?: string;
};

/**
 * Compact empty state sized to sit inside a card, where the page-level
 * `EmptyState` (min-h-60) would overwhelm the surface.
 */
export function InlineEmpty({
	icon,
	title,
	description,
	action,
	className,
}: InlineEmptyProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-3 px-4 py-10 text-center",
				className,
			)}
		>
			<span className="grid size-9 place-items-center rounded-[6px] border bg-ds-background-200 text-muted-foreground [&_svg]:size-4">
				{icon}
			</span>
			<div className="space-y-1">
				<p className="text-sm font-medium text-foreground">{title}</p>
				<p className="mx-auto max-w-[30ch] text-xs leading-5 text-pretty text-muted-foreground">
					{description}
				</p>
			</div>
			{action}
		</div>
	);
}
