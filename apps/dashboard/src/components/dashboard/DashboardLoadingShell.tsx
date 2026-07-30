import { Skeleton } from "@/components/ui/skeleton";

interface DashboardLoadingShellProps {
	title?: string;
}

/**
 * A deliberately lightweight first paint for dashboard routes.
 *
 * Keep this independent from auth data and dashboard features so the browser can
 * paint the app's stable geometry while the session and user record resolve.
 */
export function DashboardLoadingShell({
	title = "Dashboard",
}: DashboardLoadingShellProps) {
	return (
		<div
			className="flex h-dvh max-w-[100vw] overflow-hidden bg-background"
			aria-busy="true"
			aria-label="Loading dashboard"
		>
			<aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
				<div className="flex h-16 shrink-0 items-center border-b px-4">
					<div className="flex items-center gap-2">
						<div className="h-8 w-8 rounded-md bg-primary/10" />
						<Skeleton className="h-5 w-24" />
					</div>
				</div>
				<div className="flex-1 space-y-7 p-4">
					{[0, 1, 2].map((group) => (
						<div className="space-y-3" key={group}>
							<Skeleton className="h-3 w-20" />
							<div className="space-y-2">
								<Skeleton className="h-8 w-full" />
								<Skeleton className="h-8 w-4/5" />
							</div>
						</div>
					))}
				</div>
				<div className="flex h-14 shrink-0 items-center gap-3 border-t px-4">
					<Skeleton className="h-7 w-7 rounded-full" />
					<Skeleton className="h-4 w-28" />
				</div>
			</aside>

			<section className="flex min-w-0 flex-1 flex-col">
				<header className="flex h-12 shrink-0 items-center border-b px-4">
					<div className="mr-3 h-5 w-5 rounded bg-muted md:hidden" />
					<span className="text-sm font-medium text-foreground">{title}</span>
				</header>
				<main className="min-h-0 flex-1 overflow-hidden p-4 sm:p-6">
					<div className="mx-auto w-full max-w-7xl space-y-6">
						<div className="space-y-3">
							<Skeleton className="h-7 w-48 max-w-1/2" />
							<Skeleton className="h-4 w-80 max-w-4/5" />
						</div>
						<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
							{[0, 1, 2].map((card) => (
								<div key={card} className="h-28 rounded-lg border bg-card p-4">
									<Skeleton className="mb-5 h-4 w-24" />
									<Skeleton className="h-7 w-16" />
								</div>
							))}
						</div>
						<div className="h-56 rounded-lg border bg-card p-4">
							<Skeleton className="mb-6 h-5 w-32" />
							<div className="space-y-3">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-11/12" />
								<Skeleton className="h-4 w-4/5" />
							</div>
						</div>
					</div>
				</main>
			</section>
			<span className="sr-only">Loading dashboard</span>
		</div>
	);
}
