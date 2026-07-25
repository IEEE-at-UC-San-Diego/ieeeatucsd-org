import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the real overview layout so nothing shifts when data arrives. */
export function OverviewSkeleton() {
	return (
		<>
			<div className="space-y-2">
				<Skeleton className="h-7 w-56" />
				<Skeleton className="h-4 w-72" />
			</div>

			<div className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border bg-border shadow-raised lg:grid-cols-4">
				{[
					{ key: "points", span: true },
					{ key: "rank", span: false },
					{ key: "events", span: false },
				].map((cell) => (
					<div
						key={cell.key}
						className={`flex flex-col justify-between gap-5 bg-card px-4 py-4 sm:px-5 sm:py-5 ${
							cell.span ? "col-span-2" : ""
						}`}
					>
						<Skeleton className="h-3 w-16" />
						<div className="space-y-2">
							<Skeleton className={cell.span ? "h-9 w-28" : "h-6 w-20"} />
							<Skeleton className="h-3 w-24" />
						</div>
					</div>
				))}
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader className="space-y-2">
						<Skeleton className="h-5 w-36" />
						<Skeleton className="h-4 w-44" />
					</CardHeader>
					<CardContent>
						<Skeleton className="h-56 w-full lg:h-64" />
					</CardContent>
				</Card>
				<Card>
					<CardHeader className="space-y-2">
						<Skeleton className="h-5 w-32" />
						<Skeleton className="h-4 w-48" />
					</CardHeader>
					<CardContent className="space-y-4">
						{[0, 1, 2, 3].map((row) => (
							<div key={row} className="flex items-start gap-3">
								<Skeleton className="size-7 shrink-0 rounded-[4px]" />
								<div className="flex-1 space-y-2">
									<Skeleton className="h-4 w-3/4" />
									<Skeleton className="h-3 w-1/2" />
								</div>
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		</>
	);
}
