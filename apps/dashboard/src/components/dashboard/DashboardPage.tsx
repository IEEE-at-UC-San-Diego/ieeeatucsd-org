import type * as React from "react";
import { cn } from "@/lib/utils";

type DashboardPageVariant =
	| "list"
	| "form"
	| "editor"
	| "immersive"
	| "default";

type DashboardPageProps = React.ComponentProps<"div"> & {
	width?: "standard" | "wide";
	variant?: DashboardPageVariant;
};

export function DashboardPage({
	className,
	width = "standard",
	variant = "default",
	...props
}: DashboardPageProps) {
	return (
		<div
			className={cn(
				"mx-auto w-full min-w-0",
				variant === "immersive"
					? "space-y-4 px-0 py-0"
					: "space-y-6 px-4 py-5 sm:px-6 sm:py-6 lg:space-y-8 lg:py-8",
				variant === "list" && "space-y-4 md:space-y-6",
				variant === "form" && "space-y-5",
				variant === "editor" && "space-y-3 px-3 sm:px-4",
				width === "wide" ? "max-w-[1440px]" : "max-w-[1120px]",
				className,
			)}
			{...props}
		/>
	);
}

type PageHeaderProps = React.ComponentProps<"header"> & {
	title: React.ReactNode;
	description?: React.ReactNode;
	eyebrow?: React.ReactNode;
	actions?: React.ReactNode;
	/** Hide the large title on compact screens when the app bar already shows it. */
	hideTitleOnMobile?: boolean;
};

export function PageHeader({
	title,
	description,
	eyebrow,
	actions,
	hideTitleOnMobile = false,
	className,
	...props
}: PageHeaderProps) {
	return (
		<header
			className={cn(
				"flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
				className,
			)}
			{...props}
		>
			<div className="min-w-0 space-y-1">
				{eyebrow && (
					<div className="text-xs font-medium text-muted-foreground">
						{eyebrow}
					</div>
				)}
				<h1
					className={cn(
						"text-2xl font-semibold leading-[1.2] tracking-[-0.025em] text-balance text-foreground md:text-[28px] md:leading-8",
						hideTitleOnMobile && "sr-only md:not-sr-only",
					)}
				>
					{title}
				</h1>
				{description && (
					<p className="max-w-2xl text-sm leading-6 text-muted-foreground">
						{description}
					</p>
				)}
			</div>
			{actions && (
				<div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
					{actions}
				</div>
			)}
		</header>
	);
}

type EmptyStateProps = React.ComponentProps<"section"> & {
	icon?: React.ReactNode;
	title: React.ReactNode;
	description?: React.ReactNode;
	action?: React.ReactNode;
	checklist?: React.ReactNode;
};

export function EmptyState({
	icon,
	title,
	description,
	action,
	checklist,
	className,
	...props
}: EmptyStateProps) {
	return (
		<section
			className={cn(
				"flex min-h-60 flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 px-6 py-8 text-center",
				className,
			)}
			{...props}
		>
			{icon && (
				<div className="mb-3 flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-5">
					{icon}
				</div>
			)}
			<h2 className="text-base font-semibold text-foreground">{title}</h2>
			{description && (
				<p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
					{description}
				</p>
			)}
			{checklist && (
				<div className="mt-4 max-w-md text-left text-sm text-muted-foreground">
					{checklist}
				</div>
			)}
			{action && <div className="mt-5">{action}</div>}
		</section>
	);
}
