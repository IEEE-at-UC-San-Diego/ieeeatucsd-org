import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/store/cart")({
	loader: (ctx) => prefetchAuthedQuery(api.merch.cart.getCart, undefined, ctx),
	component: StoreCartPage,
});

function StoreCartPage() {
	const cart = useAuthedQuery(api.merch.cart.getCart);
	const updateQuantity = useAuthedMutation(api.merch.cart.updateQuantity);
	const removeItem = useAuthedMutation(api.merch.cart.removeItem);
	const [updatingVariantId, setUpdatingVariantId] =
		useState<Id<"merchVariants"> | null>(null);

	if (cart === undefined) {
		return (
			<div className="p-8 space-y-4 max-w-4xl mx-auto">
				<Skeleton className="h-10 w-48" />
				<Skeleton className="h-48 w-full" />
			</div>
		);
	}

	const handleQuantityChange = async (
		variantId: Id<"merchVariants">,
		quantity: number,
	) => {
		setUpdatingVariantId(variantId);
		try {
			await updateQuantity({ variantId, quantity });
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to update quantity",
			);
		} finally {
			setUpdatingVariantId(null);
		}
	};

	const handleRemove = async (variantId: Id<"merchVariants">) => {
		setUpdatingVariantId(variantId);
		try {
			await removeItem({ variantId });
			toast.success("Item removed");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to remove item",
			);
		} finally {
			setUpdatingVariantId(null);
		}
	};

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-4xl mx-auto px-5 py-10 space-y-8">
				<div className="flex items-center justify-between gap-4">
					<div>
						<h1 className="text-[34px] font-bold tracking-[-0.5px] text-gray-900">
							Cart
						</h1>
						<p className="text-muted-foreground mt-1">
							Review items before checkout. Prices and inventory are confirmed
							at checkout.
						</p>
					</div>
					<Link to="/store">
						<Button variant="outline">Continue shopping</Button>
					</Link>
				</div>

				{cart.items.length === 0 ? (
					<div className="rounded-xl border bg-white p-12 text-center">
						<ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
						<p className="text-muted-foreground">Your cart is empty.</p>
						<Link to="/store" className="inline-block mt-4">
							<Button>Browse store</Button>
						</Link>
					</div>
				) : (
					<>
						<div className="rounded-xl border bg-white shadow-sm divide-y">
							{cart.items.map((item) => (
								<div
									key={item.variantId}
									className="p-5 flex flex-col sm:flex-row gap-4 sm:items-center"
								>
									<div className="flex-1 min-w-0">
										<p className="font-semibold">{item.productName}</p>
										<p className="text-sm text-muted-foreground">
											{item.variantLabel} · {item.sku}
										</p>
										<p className="text-sm font-medium tabular-nums mt-1">
											{item.pointPrice} pts each
										</p>
										{item.issue && (
											<p className="text-sm text-red-600 mt-2">
												{item.issue.message}
											</p>
										)}
									</div>
									<div className="flex items-center gap-3">
										<Button
											variant="outline"
											size="icon"
											disabled={updatingVariantId === item.variantId}
											onClick={() =>
												handleQuantityChange(
													item.variantId,
													Math.max(0, item.quantity - 1),
												)
											}
										>
											<Minus className="h-4 w-4" />
										</Button>
										<span className="w-8 text-center tabular-nums font-medium">
											{item.quantity}
										</span>
										<Button
											variant="outline"
											size="icon"
											disabled={updatingVariantId === item.variantId}
											onClick={() =>
												handleQuantityChange(item.variantId, item.quantity + 1)
											}
										>
											<Plus className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											disabled={updatingVariantId === item.variantId}
											onClick={() => handleRemove(item.variantId)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
									<div className="text-right font-bold tabular-nums sm:w-24">
										{item.lineTotal} pts
									</div>
								</div>
							))}
						</div>

						<div className="rounded-xl border bg-white p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
							<div>
								<p className="text-sm text-muted-foreground">
									{cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}
								</p>
								<p className="text-2xl font-bold tabular-nums">
									{cart.pointTotal} pts
								</p>
							</div>
							<Link to="/store/checkout">
								<Button size="lg" disabled={!cart.canPurchase}>
									Proceed to checkout
								</Button>
							</Link>
						</div>
					</>
				)}
			</main>
		</div>
	);
}
