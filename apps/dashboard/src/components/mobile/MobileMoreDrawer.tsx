import { Link } from "@tanstack/react-router";
import { LogOut, Settings, Sparkles } from "lucide-react";
import { OfficerAiChat } from "@/components/dashboard/shared/OfficerAiChat";
import { UserAvatarFallback } from "@/components/dashboard/UserAvatarFallback";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import {
	NAVIGATION_PATHS,
	type NavigationCategory,
	navigationCategories,
} from "@/config/navigation";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type MobileMoreDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentPath: string;
};

export function MobileMoreDrawer({
	open,
	onOpenChange,
	currentPath,
}: MobileMoreDrawerProps) {
	const { user, userRole, signOut } = useAuth();

	const canAccessCategory = (category: NavigationCategory) => {
		if (!category.requiresRole || !userRole) return true;
		return category.requiresRole.includes(userRole);
	};

	const filterBySponsorTier = (items: NavigationCategory["items"]) =>
		items.filter((item) => {
			if (
				item.href === NAVIGATION_PATHS.RESUME_DATABASE &&
				userRole === "Sponsor" &&
				user?.sponsorTier === "Bronze"
			) {
				return false;
			}
			return true;
		});

	const filteredCategories = userRole
		? navigationCategories.filter(canAccessCategory)
		: [];

	const isOfficer = [
		"General Officer",
		"Executive Officer",
		"Administrator",
	].includes(userRole || "");

	const close = () => onOpenChange(false);

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent className="flex max-h-[92dvh] flex-col data-[vaul-drawer-direction=bottom]:mt-8 data-[vaul-drawer-direction=bottom]:max-h-[92dvh]">
				<DrawerHeader className="shrink-0 border-b pb-4 text-left">
					<div className="flex items-center gap-3">
						<Avatar className="size-12">
							<AvatarImage src={user?.avatar} alt={user?.name || "User"} />
							<AvatarFallback>
								<UserAvatarFallback
									name={user?.name || "User"}
									size="md"
									className="h-12 w-12 text-sm"
								/>
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0 flex-1">
							<DrawerTitle className="truncate text-base">
								{user?.name || "Account"}
							</DrawerTitle>
							<DrawerDescription className="truncate">
								{user?.email || userRole || "Member"}
							</DrawerDescription>
						</div>
					</div>
				</DrawerHeader>

				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 pt-3">
					{filteredCategories.map((category) => (
						<section key={category.title} className="mb-4">
							<h3 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								{category.title}
							</h3>
							<ul className="overflow-hidden rounded-xl bg-muted/40">
								{filterBySponsorTier(category.items).map((item) => {
									const Icon = item.icon;
									const active = currentPath === item.href;
									return (
										<li key={item.href}>
											<DrawerClose asChild>
												<Link
													to={item.href}
													onClick={close}
													className={cn(
														"flex min-h-[52px] items-center gap-3 px-3.5 py-2.5 transition-colors active:bg-muted",
														active && "bg-ds-blue-100/70 text-ieee-blue",
													)}
													aria-current={active ? "page" : undefined}
												>
													<span
														className={cn(
															"flex size-9 items-center justify-center rounded-lg",
															active ? "bg-ieee-blue/10" : "bg-background",
														)}
													>
														<Icon
															className={cn(
																"size-5",
																active
																	? "text-ieee-blue"
																	: "text-muted-foreground",
															)}
														/>
													</span>
													<span className="flex-1 text-[15px] font-medium">
														{item.label}
													</span>
													{active && (
														<span
															className="h-5 w-0.5 rounded-full bg-ieee-blue"
															aria-hidden
														/>
													)}
												</Link>
											</DrawerClose>
										</li>
									);
								})}
							</ul>
						</section>
					))}

					<section className="mb-2">
						<h3 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Account
						</h3>
						<ul className="overflow-hidden rounded-xl bg-muted/40">
							<li>
								<DrawerClose asChild>
									<Link
										to="/settings"
										onClick={close}
										className="flex min-h-[52px] items-center gap-3 px-3.5 py-2.5 active:bg-muted"
									>
										<span className="flex size-9 items-center justify-center rounded-lg bg-background">
											<Settings className="size-5 text-muted-foreground" />
										</span>
										<span className="text-[15px] font-medium">Settings</span>
									</Link>
								</DrawerClose>
							</li>
							{isOfficer && user?.aiFeaturesEnabled !== false && (
								<li className="flex min-h-[52px] items-center gap-3 px-3.5 py-2.5">
									<span className="flex size-9 items-center justify-center rounded-lg bg-background">
										<Sparkles className="size-5 text-muted-foreground" />
									</span>
									<span className="flex-1 text-[15px] font-medium">
										AI Assistant
									</span>
									<OfficerAiChat />
								</li>
							)}
							<li>
								<button
									type="button"
									onClick={() => {
										close();
										void signOut();
									}}
									className="flex w-full min-h-[52px] items-center gap-3 px-3.5 py-2.5 text-destructive active:bg-muted"
								>
									<span className="flex size-9 items-center justify-center rounded-lg bg-background">
										<LogOut className="size-5" />
									</span>
									<span className="text-[15px] font-medium">Sign Out</span>
								</button>
							</li>
						</ul>
					</section>
				</div>

				<div className="shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
					<DrawerClose asChild>
						<Button variant="outline" className="h-11 w-full">
							Close
						</Button>
					</DrawerClose>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
