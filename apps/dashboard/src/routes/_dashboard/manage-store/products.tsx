import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/manage-store/products")({
	loader: (ctx) =>
		prefetchAuthedQuery(api.merch.products.listProducts, undefined, ctx),
	component: ManageStoreProductsPage,
});

function ManageStoreProductsPage() {
	const { hasOfficerAccess, hasAdminAccess, logtoId } = usePermissions();
	const products = useAuthedQuery(
		api.merch.products.listProducts,
		logtoId ? { logtoId } : "skip",
	);
	const categories = useAuthedQuery(
		api.merch.categories.list,
		logtoId ? { logtoId } : "skip",
	);
	const createProduct = useAuthedMutation(api.merch.products.createProduct);
	const pauseRelease = useAuthedMutation(api.merch.products.pauseRelease);

	const [showForm, setShowForm] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [categoryId, setCategoryId] = useState("");
	const [price, setPrice] = useState("");
	const [saving, setSaving] = useState(false);

	if (!hasOfficerAccess) {
		return (
			<div className="p-8 text-muted-foreground">Officer access required.</div>
		);
	}

	const handleCreate = async () => {
		if (!name || !description || !categoryId || !price) {
			toast.error("Fill in all required fields.");
			return;
		}
		setSaving(true);
		try {
			await createProduct({
				name,
				shortDescription: description,
				categoryId: categoryId as Id<"merchCategories">,
				primaryImageAlt: name,
				defaultPointPrice: Number(price),
			});
			toast.success("Product created.");
			setShowForm(false);
			setName("");
			setDescription("");
			setPrice("");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to create");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-5xl mx-auto px-5 py-10 space-y-8">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-[34px] font-bold tracking-[-0.5px]">
							Products
						</h1>
						<p className="text-muted-foreground mt-1">
							Manage catalog, releases, and pricing.
						</p>
					</div>
					{hasAdminAccess && (
						<Button onClick={() => setShowForm(!showForm)}>
							<Plus className="h-4 w-4 mr-2" />
							New product
						</Button>
					)}
				</div>

				{showForm && hasAdminAccess && (
					<div className="rounded-xl border bg-white p-5 space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label>Name</Label>
								<Input value={name} onChange={(e) => setName(e.target.value)} />
							</div>
							<div className="space-y-2">
								<Label>Category</Label>
								<Select value={categoryId} onValueChange={setCategoryId}>
									<SelectTrigger>
										<SelectValue placeholder="Select category" />
									</SelectTrigger>
									<SelectContent>
										{categories?.map((c) => (
											<SelectItem key={c._id} value={c._id}>
												{c.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2 sm:col-span-2">
								<Label>Short description</Label>
								<Input
									value={description}
									onChange={(e) => setDescription(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label>Point price</Label>
								<Input
									type="number"
									value={price}
									onChange={(e) => setPrice(e.target.value)}
								/>
							</div>
						</div>
						<Button onClick={handleCreate} disabled={saving}>
							{saving ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Create product"
							)}
						</Button>
					</div>
				)}

				{products === undefined ? (
					<Skeleton className="h-64 w-full" />
				) : products.length === 0 ? (
					<p className="text-muted-foreground">No products yet.</p>
				) : (
					<ul className="divide-y rounded-xl border bg-white">
						{products.map((product) => (
							<li
								key={product._id}
								className="px-5 py-4 flex items-center justify-between gap-4"
							>
								<div>
									<p className="font-medium">{product.name}</p>
									<p className="text-sm text-muted-foreground">
										{product.shortDescription}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Badge
										variant={
											product.status === "active" ? "default" : "secondary"
										}
									>
										{product.status}
									</Badge>
									{product.featured && (
										<Badge variant="outline">Featured</Badge>
									)}
								</div>
							</li>
						))}
					</ul>
				)}
			</main>
		</div>
	);
}
