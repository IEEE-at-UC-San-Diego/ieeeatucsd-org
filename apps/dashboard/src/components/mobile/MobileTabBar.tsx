import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MobileTabItem = {
	id: string;
	label: string;
	href: string;
	icon: LucideIcon;
	isActive?: boolean;
	badge?: number | boolean;
	onSelect?: () => void;
};

type MobileTabBarProps = {
	items: MobileTabItem[];
	className?: string;
	hidden?: boolean;
};

export function MobileTabBar({ items, className, hidden }: MobileTabBarProps) {
	if (hidden) return null;

	return (
		<nav
			aria-label="Primary"
			className={cn(
				"fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl",
				"pb-[env(safe-area-inset-bottom)]",
				"supports-[backdrop-filter]:bg-background/80",
				"[@media(prefers-reduced-transparency:reduce)]:bg-background [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none",
				className,
			)}
		>
			<ul className="mx-auto flex h-14 max-w-lg items-stretch">
				{items.map((item) => {
					const Icon = item.icon;
					const active = Boolean(item.isActive);
					const content = (
						<>
							<span className="relative flex items-center justify-center">
								<span
									className={cn(
										"absolute -top-1.5 h-0.5 w-5 rounded-full bg-ieee-blue transition-opacity duration-200",
										active ? "opacity-100" : "opacity-0",
									)}
									aria-hidden
								/>
								<Icon
									className={cn(
										"size-[22px] transition-colors",
										active ? "text-tone-link" : "text-muted-foreground",
									)}
									strokeWidth={active ? 2.25 : 1.75}
								/>
								{item.badge ? (
									<span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ieee-blue px-1 text-[10px] font-semibold text-on-accent">
										{typeof item.badge === "number" && item.badge > 0
											? item.badge > 9
												? "9+"
												: item.badge
											: null}
									</span>
								) : null}
							</span>
							<span
								className={cn(
									"text-[10px] font-medium leading-none tracking-wide",
									active ? "text-tone-link" : "text-muted-foreground",
								)}
							>
								{item.label}
							</span>
						</>
					);

					const classNameItem = cn(
						"flex flex-1 flex-col items-center justify-center gap-1 px-1 transition-transform active:scale-[0.97]",
						"min-h-14",
					);

					if (item.onSelect) {
						return (
							<li key={item.id} className="flex flex-1">
								<button
									type="button"
									className={classNameItem}
									onClick={item.onSelect}
									aria-current={active ? "page" : undefined}
								>
									{content}
								</button>
							</li>
						);
					}

					return (
						<li key={item.id} className="flex flex-1">
							<Link
								to={item.href}
								className={classNameItem}
								aria-current={active ? "page" : undefined}
							>
								{content}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

/** Space reserved under main content for the tab bar + safe area. */
export const MOBILE_TAB_BAR_OFFSET =
	"pb-[calc(3.5rem+env(safe-area-inset-bottom))]";
