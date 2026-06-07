import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { Coins, TrendingUp, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthedQuery } from "@/hooks/useAuthedConvex";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/store/points")({
	loader: (ctx) =>
		prefetchAuthedQuery(api.pointLedger.getMyLedger, undefined, ctx),
	component: StorePointsPage,
});

function formatCategory(category: string) {
	return category.replace(/_/g, " ");
}

function StorePointsPage() {
	const ledger = useAuthedQuery(api.pointLedger.getMyLedger);

	if (ledger === undefined) {
		return (
			<div className="p-8 space-y-4">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-32 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	const { totals, entries } = ledger;

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-4xl mx-auto px-5 py-10 space-y-8">
				<div>
					<h1 className="text-[34px] font-bold tracking-[-0.5px] text-gray-900">
						Points
					</h1>
					<p className="text-muted-foreground mt-1">
						Your lifetime earnings, spendable balance, and transaction history.
					</p>
				</div>

				<div className="grid gap-4 sm:grid-cols-3">
					<div className="rounded-xl border bg-white p-5 shadow-sm">
						<div className="flex items-center gap-2 text-muted-foreground text-sm">
							<TrendingUp className="h-4 w-4" />
							Lifetime earned
						</div>
						<p className="text-2xl font-bold tabular-nums mt-2">
							{totals.lifetimePointsEarned}
						</p>
						<p className="text-xs text-muted-foreground mt-1">
							Used for leaderboard ranking
						</p>
					</div>
					<div className="rounded-xl border bg-white p-5 shadow-sm">
						<div className="flex items-center gap-2 text-muted-foreground text-sm">
							<Wallet className="h-4 w-4" />
							Spendable
						</div>
						<p className="text-2xl font-bold tabular-nums mt-2">
							{totals.spendablePoints}
						</p>
						<p className="text-xs text-muted-foreground mt-1">
							Available for merchandise
						</p>
					</div>
					<div className="rounded-xl border bg-white p-5 shadow-sm">
						<div className="flex items-center gap-2 text-muted-foreground text-sm">
							<Coins className="h-4 w-4" />
							Pending correction
						</div>
						<p className="text-2xl font-bold tabular-nums mt-2">
							{totals.pendingPointCorrection}
						</p>
						<p className="text-xs text-muted-foreground mt-1">
							Repaid from future earnings
						</p>
					</div>
				</div>

				<div className="rounded-xl border bg-white shadow-sm overflow-hidden">
					<div className="px-5 py-4 border-b">
						<h2 className="font-semibold">Ledger history</h2>
					</div>
					{entries.length === 0 ? (
						<p className="p-8 text-center text-muted-foreground text-sm">
							No ledger entries yet.
						</p>
					) : (
						<ul className="divide-y">
							{entries.map((entry) => (
								<li
									key={entry._id}
									className="px-5 py-4 flex items-start justify-between gap-4"
								>
									<div>
										<p className="font-medium text-sm">
											{entry.publicDescription}
										</p>
										<p className="text-xs text-muted-foreground mt-0.5 capitalize">
											{formatCategory(entry.category)}
										</p>
									</div>
									<div className="text-right shrink-0">
										<p
											className={`font-semibold tabular-nums text-sm ${
												entry.spendableAmount >= 0
													? "text-emerald-600"
													: "text-red-600"
											}`}
										>
											{entry.spendableAmount >= 0 ? "+" : ""}
											{entry.spendableAmount}
										</p>
										<p className="text-xs text-muted-foreground">
											{new Date(entry.timestamp).toLocaleDateString()}
										</p>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			</main>
		</div>
	);
}
