import { ArrowLeft, MoreHorizontal } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type MobileAppBarAction = {
	label: string;
	onSelect: () => void;
	icon?: React.ReactNode;
	destructive?: boolean;
};

type MobileAppBarProps = {
	title: string;
	leading?: React.ReactNode;
	onBack?: () => void;
	trailing?: React.ReactNode;
	overflowActions?: MobileAppBarAction[];
	className?: string;
	scrolled?: boolean;
};

export function MobileAppBar({
	title,
	leading,
	onBack,
	trailing,
	overflowActions,
	className,
	scrolled = false,
}: MobileAppBarProps) {
	return (
		<header
			className={cn(
				"sticky top-0 z-40 flex h-[calc(3.25rem+env(safe-area-inset-top))] shrink-0 items-end border-b border-transparent bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75",
				"pt-[env(safe-area-inset-top)]",
				scrolled && "border-border/60",
				"motion-safe:transition-[border-color,background-color] motion-safe:duration-200",
				"[@media(prefers-reduced-transparency:reduce)]:bg-background [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
				className,
			)}
		>
			<div className="flex h-[52px] w-full min-w-0 items-center gap-1 px-2">
				<div className="flex w-12 shrink-0 items-center justify-start">
					{onBack ? (
						<Button
							variant="ghost"
							size="icon"
							className="size-11 active:scale-[0.97]"
							onClick={onBack}
							aria-label="Go back"
						>
							<ArrowLeft className="size-5" />
						</Button>
					) : (
						(leading ?? null)
					)}
				</div>

				<h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold tracking-[-0.02em] text-foreground">
					{title}
				</h1>

				<div className="flex w-12 shrink-0 items-center justify-end gap-0.5">
					{trailing}
					{overflowActions && overflowActions.length > 0 && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-11 active:scale-[0.97]"
									aria-label="More actions"
								>
									<MoreHorizontal className="size-5" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="min-w-44">
								{overflowActions.map((action) => (
									<DropdownMenuItem
										key={action.label}
										variant={action.destructive ? "destructive" : "default"}
										onSelect={action.onSelect}
									>
										{action.icon}
										{action.label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</div>
			</div>
		</header>
	);
}
