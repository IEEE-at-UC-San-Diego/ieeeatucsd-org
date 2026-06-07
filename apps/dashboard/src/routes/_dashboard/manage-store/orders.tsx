import { api } from "@convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { NAVIGATION_PATHS } from "@/config/navigation";
import { useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_dashboard/manage-store/orders")({
	component: ManageStoreOrdersPage,
});

function formatDateTime(ms: number) {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Los_Angeles",
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(ms));
}

function statusVariant(status: string) {
	if (status === "fulfilled") return "default" as const;
	if (status === "canceled") return "secondary" as const;
	if (status === "action_required" || status === "pickup_missed") {
		return "destructive" as const;
	}
	return "outline" as const;
}

function ManageStoreOrdersPage() {
	const { hasOfficerAccess, logtoId } = usePermissions();
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");

	const orders = useAuthedQuery(
		api.merch.fulfillment.listOrdersForOfficer,
		logtoId
			? {
					logtoId,
					search: search.trim() || undefined,
					status: statusFilter || undefined,
				}
			: "skip",
	);

	if (!hasOfficerAccess) {
		return (
			<div className="p-8 text-muted-foreground">Officer access required.</div>
		);
	}

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-5xl mx-auto px-5 py-10 space-y-6">
				<div>
					<h1 className="text-[34px] font-bold tracking-[-0.5px]">Orders</h1>
					<p className="text-muted-foreground mt-1">
						Fulfillment queue for merchandise orders.
					</p>
				</div>

				<div className="flex flex-col sm:flex-row gap-3">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							className="pl-9"
							placeholder="Search by order #, pickup code, name, or email"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
					<select
						className="rounded-md border px-3 py-2 text-sm bg-white"
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value)}
					>
						<option value="">All active statuses</option>
						<option value="confirmed">Confirmed</option>
						<option value="action_required">Action required</option>
						<option value="pickup_missed">Pickup missed</option>
						<option value="partially_fulfilled">Partially fulfilled</option>
						<option value="mixed">Mixed</option>
					</select>
				</div>

				{orders === undefined ? (
					<Skeleton className="h-64 w-full" />
				) : orders.length === 0 ? (
					<p className="text-muted-foreground text-sm">No orders found.</p>
				) : (
					<ul className="divide-y rounded-xl border bg-white">
						{orders.map((order) => (
							<li key={order._id} className="px-5 py-4 space-y-2">
								<div className="flex items-start justify-between gap-4">
									<div>
										<p className="font-semibold">{order.displayNumber}</p>
										<p className="text-sm text-muted-foreground">
											{order.member?.name ?? "Unknown member"} ·{" "}
											{order.member?.email}
										</p>
										<p className="text-xs text-muted-foreground mt-1">
											{order.pickupLabel} · Pickup code {order.pickupCode}
										</p>
										<p className="text-xs text-muted-foreground">
											{order.itemQuantityTotal} items · {order.pointTotal} pts ·
											Placed {formatDateTime(order.createdAt)}
										</p>
									</div>
									<Badge variant={statusVariant(order.status)}>
										{order.status.replaceAll("_", " ")}
									</Badge>
								</div>
								<ul className="text-sm space-y-1 pl-2 border-l-2">
									{order.items.map((item) => (
										<li key={item._id} className="text-muted-foreground">
											{item.quantity}x {item.productName} ({item.variantLabel})
											— {item.status.replaceAll("_", " ")}
											{item.remainingQuantity > 0 &&
												item.remainingQuantity < item.quantity &&
												` · ${item.remainingQuantity} remaining`}
										</li>
									))}
								</ul>
							</li>
						))}
					</ul>
				)}

				<Button variant="outline" asChild>
					<Link to={NAVIGATION_PATHS.MANAGE_STORE_PICKUPS}>
						Manage pickup windows
					</Link>
				</Button>
			</main>
		</div>
	);
}
