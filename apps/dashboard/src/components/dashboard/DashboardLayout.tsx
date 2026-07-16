import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
	MOBILE_TAB_BAR_OFFSET,
	MobileAppBar,
	MobileMoreDrawer,
	MobileShellProvider,
	MobileTabBar,
	NetworkStatusBanner,
	useMobileShell,
} from "@/components/mobile";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import {
	MOBILE_TAB_ITEMS,
	PATH_LABELS,
	shouldHideMobileTabBar,
} from "@/config/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { resolveDashboardRedirect } from "@/lib/auth/dashboardRouting";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./AppSidebar";

function MobileDashboardChrome({
	title,
	pathname,
	searchStr,
}: {
	title: string;
	pathname: string;
	searchStr: string;
}) {
	const { hideTabBar: hideTabBarFromRoute } = useMobileShell();
	const [moreOpen, setMoreOpen] = useState(false);
	const [scrolled, setScrolled] = useState(false);

	useEffect(() => {
		const main = document.querySelector("[data-dashboard-scroll]");
		if (!main) return;
		const onScroll = () => {
			setScrolled((main as HTMLElement).scrollTop > 4);
		};
		main.addEventListener("scroll", onScroll, { passive: true });
		return () => main.removeEventListener("scroll", onScroll);
	}, [pathname]);

	const hideTabBar =
		hideTabBarFromRoute ||
		shouldHideMobileTabBar(
			pathname,
			new URLSearchParams(searchStr.replace(/^\?/, "")),
		);

	const tabItems = useMemo(
		() =>
			MOBILE_TAB_ITEMS.map((item) => {
				if (item.id === "more") {
					return {
						...item,
						href: "#more",
						isActive:
							moreOpen ||
							!["/overview", "/events", "/reimbursement"].includes(pathname),
						onSelect: () => setMoreOpen(true),
					};
				}
				return {
					...item,
					href: item.href,
					isActive: pathname === item.href && !moreOpen,
				};
			}),
		[pathname, moreOpen],
	);

	return (
		<div className="flex h-dvh max-w-[100vw] flex-col overflow-hidden bg-background">
			<NetworkStatusBanner />
			<MobileAppBar
				title={title}
				scrolled={scrolled}
				trailing={<NotificationBell />}
			/>
			<main
				data-dashboard-scroll
				className={cn(
					"min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain",
					!hideTabBar && MOBILE_TAB_BAR_OFFSET,
				)}
			>
				<ErrorBoundary>
					<Outlet />
				</ErrorBoundary>
			</main>
			<MobileTabBar items={tabItems} hidden={hideTabBar} />
			<MobileMoreDrawer
				open={moreOpen}
				onOpenChange={setMoreOpen}
				currentPath={pathname}
			/>
		</div>
	);
}

export function DashboardLayout() {
	const {
		isAuthenticated,
		isLoading,
		isAuthResolved,
		authFailureReason,
		user,
	} = useAuth();
	const location = useLocation();
	const navigate = useNavigate();
	const isMobile = useIsMobile();

	useEffect(() => {
		if (authFailureReason) {
			navigate({ to: "/signin", replace: true });
			return;
		}

		const redirectPath = resolveDashboardRedirect({
			isAuthResolved,
			isAuthenticated,
			user,
			pathname: location.pathname,
		});
		if (redirectPath) {
			navigate({ to: redirectPath, replace: true });
		}
	}, [
		authFailureReason,
		isAuthResolved,
		isAuthenticated,
		user,
		location.pathname,
		navigate,
	]);

	// Reset horizontal + vertical scroll on route change
	useEffect(() => {
		const main = document.querySelector("[data-dashboard-scroll]");
		if (main instanceof HTMLElement) {
			main.scrollTo({ top: 0, left: 0 });
		}
		window.scrollTo({ top: 0, left: 0 });
	}, [location.pathname]);

	const title = PATH_LABELS[location.pathname] || "Dashboard";

	if (isLoading) {
		return (
			<div className="flex h-dvh items-center justify-center bg-background">
				<div className="text-center">
					<Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
					<p className="text-muted-foreground">Loading dashboard...</p>
				</div>
			</div>
		);
	}

	if (!isAuthenticated) {
		return (
			<div className="flex h-dvh items-center justify-center bg-background">
				<div className="text-center">
					<Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
					<p className="text-muted-foreground">Redirecting to sign in...</p>
				</div>
			</div>
		);
	}

	if (isAuthResolved && !user) {
		return (
			<div className="flex h-dvh items-center justify-center bg-background">
				<div className="text-center">
					<Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
					<p className="text-muted-foreground">Redirecting to sign in...</p>
				</div>
			</div>
		);
	}

	if (isMobile) {
		return (
			<MobileShellProvider>
				<MobileDashboardChrome
					title={title}
					pathname={location.pathname}
					searchStr={location.searchStr}
				/>
			</MobileShellProvider>
		);
	}

	return (
		<SidebarProvider>
			<AppSidebar currentPath={location.pathname} />
			<SidebarInset className="max-w-full overflow-hidden">
				<NetworkStatusBanner />
				<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
					<SidebarTrigger className="-ml-1" />
					<Separator orientation="vertical" className="mr-2 h-4" />
					<nav className="flex flex-1 items-center gap-1 text-sm">
						<span className="font-medium text-foreground">{title}</span>
					</nav>
					<NotificationBell />
				</header>
				<main
					data-dashboard-scroll
					className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
				>
					<ErrorBoundary>
						<Outlet />
					</ErrorBoundary>
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
