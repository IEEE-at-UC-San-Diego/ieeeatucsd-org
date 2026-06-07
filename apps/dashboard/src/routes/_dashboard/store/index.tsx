import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { Package, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthedQuery } from "@/hooks/useAuthedConvex";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/store/")({
	loader: (ctx) =>
		prefetchAuthedQuery(api.merch.products.listStorefront, undefined, ctx),
	component: StorePage,
});

function stockLabel(display: string) {
	switch (display) {
		case "in_stock":
			return "In stock";
		case "low_stock":
			return "Low stock";
		default:
			return "Sold out";
	}
}

function StorePage() {
	const storefront = useAuthedQuery(api.merch.products.listStorefront);

	if (storefront === undefined) {
		return (
			<div className="p-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{[1, 2, 3].map((i) => (
					<Skeleton key={i} className="h-64 w-full" />
				))}
			</div>
		);
	}

	if (storefront.mode === "coming_soon") {
		return (
			<div className="flex-1 flex items-center justify-center min-h-[60vh] bg-[#F8F9FB]">
				<div className="text-center space-y-3">
					<ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground" />
					<h1 className="text-2xl font-bold">Store coming soon</h1>
					<p className="text-muted-foreground max-w-md">
						The merchandise store is not available yet. Check back later!
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-6xl mx-auto px-5 py-10 space-y-8">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h1 className="text-[34px] font-bold tracking-[-0.5px] text-gray-900">
							Merch Store
						</h1>
						<p className="text-muted-foreground mt-1">
							Exchange event points for IEEE UCSD merchandise.
						</p>
					</div>
					{storefront.mode === "preview" && (
						<Badge variant="secondary">Officer preview</Badge>
					)}
				</div>

				{storefront.products.length === 0 ? (
					<div className="rounded-xl border bg-white p-12 text-center">
						<Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
						<p className="text-muted-foreground">No products available yet.</p>
					</div>
				) : (
					<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{storefront.products.map((product) => (
							<div
								key={product._id}
								className="rounded-xl border bg-white overflow-hidden shadow-sm"
							>
								<div className="aspect-square bg-gray-100 flex items-center justify-center">
									{product.imageUrl ? (
										<img
											src={product.imageUrl}
											alt={product.name}
											className="w-full h-full object-cover"
										/>
									) : (
										<Package className="h-12 w-12 text-muted-foreground" />
									)}
								</div>
								<div className="p-4 space-y-2">
									<div className="flex items-start justify-between gap-2">
										<h2 className="font-semibold">{product.name}</h2>
										{product.featured && (
											<Badge variant="outline" className="shrink-0">
												Featured
											</Badge>
										)}
									</div>
									<p className="text-sm text-muted-foreground line-clamp-2">
										{product.shortDescription}
									</p>
									<div className="flex items-center justify-between pt-1">
										<span className="font-bold tabular-nums">
											{product.pointPrice} pts
										</span>
										<span className="text-xs text-muted-foreground">
											{stockLabel(product.stockDisplay)}
										</span>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
