import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Minus, Package, Plus, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";

export const Route = createFileRoute("/_dashboard/store/products/$productId")({
	component: StoreProductPage,
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

function StoreProductPage() {
	const { productId } = Route.useParams();
	const detail = useAuthedQuery(api.merch.products.getStorefrontProduct, {
		productId: productId as Id<"merchProducts">,
	});
	const ledger = useAuthedQuery(api.pointLedger.getMyLedger);
	const addItem = useAuthedMutation(api.merch.cart.addItem);

	const [selectedOptions, setSelectedOptions] = useState<
		Record<string, string>
	>({});
	const [quantity, setQuantity] = useState(1);
	const [adding, setAdding] = useState(false);

	const selectedVariant = useMemo(() => {
		if (!detail) return null;
		const optionGroups = detail.release.optionGroups;
		return (
			detail.variants.find((variant) =>
				optionGroups.every(
					(group, index) =>
						selectedOptions[group.name] === variant.optionValues[index],
				),
			) ?? null
		);
	}, [detail, selectedOptions]);

	if (detail === undefined) {
		return (
			<div className="p-8 max-w-4xl mx-auto space-y-4">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-80 w-full" />
			</div>
		);
	}

	if (detail === null) {
		return (
			<div className="flex-1 flex items-center justify-center min-h-[60vh] bg-[#F8F9FB]">
				<div className="text-center space-y-3">
					<Package className="h-12 w-12 mx-auto text-muted-foreground" />
					<h1 className="text-2xl font-bold">Product unavailable</h1>
					<p className="text-muted-foreground">
						This product is no longer available.
					</p>
					<Link to="/store" className="inline-block">
						<Button variant="outline">Back to store</Button>
					</Link>
				</div>
			</div>
		);
	}

	const { product, release, variants } = detail;
	const allOptionsSelected = release.optionGroups.every(
		(group) => selectedOptions[group.name],
	);
	const soldOut = selectedVariant ? selectedVariant.available <= 0 : false;
	const maxQuantity = selectedVariant?.available ?? 1;
	const spendable = ledger?.totals.spendablePoints;

	const handleAddToCart = async () => {
		if (!selectedVariant) {
			toast.error("Select all options first");
			return;
		}
		setAdding(true);
		try {
			await addItem({ variantId: selectedVariant._id, quantity });
			toast.success("Added to cart", {
				action: {
					label: "View cart",
					onClick: () => {
						window.location.href = "/store/cart";
					},
				},
			});
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to add to cart",
			);
		} finally {
			setAdding(false);
		}
	};

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-5xl mx-auto px-5 py-10 space-y-6">
				<div className="flex items-center justify-between gap-4">
					<Link to="/store">
						<Button variant="ghost" size="sm">
							← Back to store
						</Button>
					</Link>
					<div className="flex items-center gap-3">
						{detail.mode === "preview" && (
							<Badge variant="secondary">Officer preview</Badge>
						)}
						{spendable !== undefined && (
							<span className="text-sm text-muted-foreground">
								Spendable:{" "}
								<span className="font-semibold tabular-nums text-gray-900">
									{spendable} pts
								</span>
							</span>
						)}
					</div>
				</div>

				<div className="grid gap-8 lg:grid-cols-2">
					<div className="space-y-3">
						<div className="aspect-square rounded-xl border bg-white overflow-hidden flex items-center justify-center">
							{product.primaryImageUrl ? (
								<img
									src={product.primaryImageUrl}
									alt={product.primaryImageAlt}
									className="w-full h-full object-cover"
								/>
							) : (
								<Package className="h-16 w-16 text-muted-foreground" />
							)}
						</div>
						{product.additionalImages.length > 0 && (
							<div className="grid grid-cols-4 gap-2">
								{product.additionalImages.map((image) => (
									<div
										key={image.url}
										className="aspect-square rounded-lg border bg-white overflow-hidden"
									>
										<img
											src={image.url}
											alt={image.alt}
											className="w-full h-full object-cover"
										/>
									</div>
								))}
							</div>
						)}
					</div>

					<div className="space-y-5">
						<div>
							<h1 className="text-[30px] font-bold tracking-[-0.5px] text-gray-900">
								{product.name}
							</h1>
							<p className="text-muted-foreground mt-1">
								{product.shortDescription}
							</p>
						</div>

						<div className="flex items-center gap-3">
							<span className="text-2xl font-bold tabular-nums">
								{selectedVariant?.pointPrice ?? release.defaultPointPrice} pts
							</span>
							{selectedVariant && (
								<Badge
									variant={
										selectedVariant.stockDisplay === "sold_out"
											? "secondary"
											: "outline"
									}
								>
									{stockLabel(selectedVariant.stockDisplay)}
								</Badge>
							)}
						</div>

						{product.detailedDescription && (
							<p className="text-sm text-gray-700 whitespace-pre-line">
								{product.detailedDescription}
							</p>
						)}

						<div className="space-y-3">
							{release.optionGroups.map((group) => (
								<div key={group.name} className="space-y-2">
									<Label>{group.name}</Label>
									<Select
										value={selectedOptions[group.name] ?? ""}
										onValueChange={(value) =>
											setSelectedOptions((prev) => ({
												...prev,
												[group.name]: value,
											}))
										}
									>
										<SelectTrigger className="w-full">
											<SelectValue placeholder={`Select ${group.name}`} />
										</SelectTrigger>
										<SelectContent>
											{group.values.map((value) => (
												<SelectItem key={value} value={value}>
													{value}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							))}
							{variants.length === 0 && (
								<p className="text-sm text-muted-foreground">
									No variants are currently available.
								</p>
							)}
						</div>

						<div className="space-y-2">
							<Label>Quantity</Label>
							<div className="flex items-center gap-3">
								<Button
									variant="outline"
									size="icon"
									disabled={quantity <= 1}
									onClick={() => setQuantity((q) => Math.max(1, q - 1))}
								>
									<Minus className="h-4 w-4" />
								</Button>
								<span className="w-10 text-center tabular-nums font-medium">
									{quantity}
								</span>
								<Button
									variant="outline"
									size="icon"
									disabled={quantity >= maxQuantity}
									onClick={() =>
										setQuantity((q) => Math.min(maxQuantity, q + 1))
									}
								>
									<Plus className="h-4 w-4" />
								</Button>
							</div>
						</div>

						<Button
							size="lg"
							className="w-full sm:w-auto"
							disabled={!allOptionsSelected || soldOut || adding}
							onClick={handleAddToCart}
						>
							{adding ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : (
								<ShoppingCart className="h-4 w-4 mr-2" />
							)}
							{soldOut ? "Sold out" : "Add to cart"}
						</Button>

						{product.sizingGuide && (
							<div className="rounded-xl border bg-white p-4">
								<h2 className="font-semibold text-sm mb-1">Sizing guide</h2>
								<p className="text-sm text-muted-foreground whitespace-pre-line">
									{product.sizingGuide}
								</p>
							</div>
						)}

						{product.fulfillmentNotes && (
							<div className="rounded-xl border bg-white p-4">
								<h2 className="font-semibold text-sm mb-1">
									Fulfillment notes
								</h2>
								<p className="text-sm text-muted-foreground whitespace-pre-line">
									{product.fulfillmentNotes}
								</p>
							</div>
						)}
					</div>
				</div>
			</main>
		</div>
	);
}
