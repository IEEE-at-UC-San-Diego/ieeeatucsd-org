import { api } from "@convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthedQuery } from "@/hooks/useAuthedConvex";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/store/orders/")({
	loader: (ctx) =>
		prefetchAuthedQuery(api.merch.orders.listMyOrders, undefined, ctx),
	component: StoreOrdersPage,
});

function statusLabel(status: string) {
	return status.replace(/_/g, " ");
}

function StoreOrdersPage() {
	const orders = useAuthedQuery(api.merch.orders.listMyOrders);

	if (orders === undefined) {
		return (
			<div className="p-8 space-y-4 max-w-4xl mx-auto">
				<Skeleton className="h-10 w-48" />
				<Skeleton className="h-32 w-full" />
				<Skeleton className="h-32 w-full" />
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-4xl mx-auto px-5 py-10 space-y-8">
				<div>
					<h1 className="text-[34px] font-bold tracking-[-0.5px] text-gray-900">
						Orders
					</h1>
					<p className="text-muted-foreground mt-1">
						Your merchandise order history and pickup details.
					</p>
				</div>

				{orders.length === 0 ? (
					<div className="rounded-xl border bg-white p-12 text-center">
						<Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
						<p className="text-muted-foreground">No orders yet.</p>
						<Link to="/store" className="inline-block mt-4 text-sm underline">
							Browse the store
						</Link>
					</div>
				) : (
					<div className="rounded-xl border bg-white shadow-sm divide-y">
						{orders.map((order) => (
							<Link
								key={order._id}
								to="/store/orders/$orderId"
								params={{ orderId: order._id }}
								className="block p-5 hover:bg-gray-50 transition-colors"
							>
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
									<div>
										<p className="font-semibold">{order.displayNumber}</p>
										<p className="text-sm text-muted-foreground mt-0.5">
											{order.pickupLabel}
										</p>
										<p className="text-xs text-muted-foreground mt-1">
											Placed {new Date(order.createdAt).toLocaleDateString()}
										</p>
									</div>
									<div className="flex items-center gap-3 sm:text-right">
										<Badge variant="secondary" className="capitalize">
											{statusLabel(order.status)}
										</Badge>
										<div>
											<p className="font-bold tabular-nums">
												{order.pointTotal} pts
											</p>
											<p className="text-xs text-muted-foreground">
												{order.itemQuantityTotal} item
												{order.itemQuantityTotal === 1 ? "" : "s"}
											</p>
										</div>
									</div>
								</div>
							</Link>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
