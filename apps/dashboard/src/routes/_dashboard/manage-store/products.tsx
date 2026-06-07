import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Boxes, ImageIcon, Loader2, Plus, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { usePermissions } from "@/hooks/usePermissions";
import { uploadMerchImageToStorage } from "@/lib/merchImageUpload";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/manage-store/products")({
	loader: (ctx) =>
		prefetchAuthedQuery(api.merch.products.listProducts, undefined, ctx),
	component: ManageStoreProductsPage,
});

type ProductRow = {
	_id: Id<"merchProducts">;
	name: string;
	shortDescription: string;
	status: "active" | "archived";
	featured: boolean;
	imageUrl: string | null;
};

function ProductImageUploadButton({
	label,
	disabled,
	onUpload,
}: {
	label: string;
	disabled?: boolean;
	onUpload: (file: File) => Promise<void>;
}) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);

	const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setUploading(true);
		try {
			await onUpload(file);
		} finally {
			setUploading(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	};

	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp,image/gif"
				className="hidden"
				onChange={handleChange}
			/>
			<Button
				type="button"
				variant="outline"
				size="sm"
				disabled={disabled || uploading}
				onClick={() => inputRef.current?.click()}
			>
				{uploading ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<>
						<Upload className="h-4 w-4 mr-1.5" />
						{label}
					</>
				)}
			</Button>
		</>
	);
}

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
	const createCategory = useAuthedMutation(api.merch.categories.create);
	const setProductImage = useAuthedMutation(api.merch.products.setProductImage);
	const generateUploadUrl = useAuthedMutation(
		api.merch.products.generateUploadUrl,
	);

	const [showForm, setShowForm] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [categoryId, setCategoryId] = useState("");
	const [price, setPrice] = useState("");
	const [imageAlt, setImageAlt] = useState("");
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [pendingImageStorageId, setPendingImageStorageId] =
		useState<Id<"_storage"> | null>(null);
	const [saving, setSaving] = useState(false);

	const [newCategoryName, setNewCategoryName] = useState("");
	const [creatingCategory, setCreatingCategory] = useState(false);

	if (!hasOfficerAccess) {
		return (
			<div className="p-8 text-muted-foreground">Officer access required.</div>
		);
	}

	const activeCategories = categories ?? [];

	const uploadImage = async (file: File) => {
		return uploadMerchImageToStorage(file, () => generateUploadUrl({}));
	};

	const handleCreateFormImage = async (file: File) => {
		try {
			const storageId = await uploadImage(file);
			setPendingImageStorageId(storageId);
			setImagePreview(URL.createObjectURL(file));
			if (!imageAlt) setImageAlt(name || file.name.replace(/\.[^.]+$/, ""));
			toast.success("Image uploaded.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Upload failed");
		}
	};

	const handleProductImage = async (
		productId: Id<"merchProducts">,
		productName: string,
		file: File,
	) => {
		try {
			const storageId = await uploadImage(file);
			await setProductImage({
				productId,
				primaryImageStorageId: storageId,
				primaryImageAlt: productName,
			});
			toast.success("Product image updated.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Upload failed");
		}
	};

	const resetCreateForm = () => {
		setName("");
		setDescription("");
		setPrice("");
		setCategoryId("");
		setImageAlt("");
		setPendingImageStorageId(null);
		if (imagePreview) URL.revokeObjectURL(imagePreview);
		setImagePreview(null);
	};

	const handleCreateCategory = async () => {
		const trimmed = newCategoryName.trim();
		if (!trimmed) {
			toast.error("Enter a category name.");
			return;
		}
		setCreatingCategory(true);
		try {
			const id = await createCategory({ name: trimmed });
			setCategoryId(id);
			setNewCategoryName("");
			toast.success(`Category "${trimmed}" created.`);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to create category",
			);
		} finally {
			setCreatingCategory(false);
		}
	};

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
				primaryImageAlt: imageAlt.trim() || name,
				...(pendingImageStorageId && {
					primaryImageStorageId: pendingImageStorageId,
				}),
				defaultPointPrice: Number(price),
			});
			toast.success("Product created.");
			setShowForm(false);
			resetCreateForm();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to create");
		} finally {
			setSaving(false);
		}
	};

	const productRows = (products ?? []) as ProductRow[];

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
					<div className="flex items-center gap-2">
						<Link to="/manage-store/inventory">
							<Button variant="outline">
								<Boxes className="h-4 w-4 mr-2" />
								Manage inventory
							</Button>
						</Link>
						{hasAdminAccess && (
							<Button
								onClick={() => setShowForm(!showForm)}
								disabled={activeCategories.length === 0}
							>
								<Plus className="h-4 w-4 mr-2" />
								New product
							</Button>
						)}
					</div>
				</div>

				<div className="rounded-xl border bg-white p-5 space-y-4">
					<div>
						<h2 className="font-semibold">Categories</h2>
						<p className="text-sm text-muted-foreground mt-0.5">
							Create at least one category before adding products.
						</p>
					</div>
					{categories === undefined ? (
						<Skeleton className="h-10 w-full" />
					) : activeCategories.length > 0 ? (
						<div className="flex flex-wrap gap-2">
							{activeCategories.map((c) => (
								<Badge key={c._id} variant="secondary">
									{c.name}
								</Badge>
							))}
						</div>
					) : (
						<p className="text-sm text-muted-foreground">
							No categories yet. Create one below.
						</p>
					)}
					<div className="flex gap-2 items-end">
						<div className="space-y-2 flex-1">
							<Label htmlFor="new-category">New category</Label>
							<Input
								id="new-category"
								placeholder="e.g. Apparel"
								value={newCategoryName}
								onChange={(e) => setNewCategoryName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										void handleCreateCategory();
									}
								}}
							/>
						</div>
						<Button
							variant="outline"
							onClick={handleCreateCategory}
							disabled={creatingCategory}
						>
							{creatingCategory ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								"Add category"
							)}
						</Button>
					</div>
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
								{activeCategories.length === 0 ? (
									<p className="text-sm text-muted-foreground py-2">
										Create a category above first.
									</p>
								) : (
									<Select value={categoryId} onValueChange={setCategoryId}>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="Select category" />
										</SelectTrigger>
										<SelectContent position="popper">
											{activeCategories.map((c) => (
												<SelectItem key={c._id} value={c._id}>
													{c.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
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
							<div className="space-y-2">
								<Label>Image alt text</Label>
								<Input
									placeholder="Defaults to product name"
									value={imageAlt}
									onChange={(e) => setImageAlt(e.target.value)}
								/>
							</div>
							<div className="space-y-2 sm:col-span-2">
								<Label>Product image</Label>
								<div className="flex items-start gap-4">
									<div className="h-24 w-24 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
										{imagePreview ? (
											<img
												src={imagePreview}
												alt={imageAlt || name || "Preview"}
												className="h-full w-full object-cover"
											/>
										) : (
											<ImageIcon className="h-8 w-8 text-muted-foreground" />
										)}
									</div>
									<div className="space-y-2">
										<ProductImageUploadButton
											label={
												pendingImageStorageId ? "Replace image" : "Upload image"
											}
											onUpload={handleCreateFormImage}
										/>
										<p className="text-xs text-muted-foreground">
											JPEG, PNG, WebP, or GIF up to 5MB.
										</p>
									</div>
								</div>
							</div>
						</div>
						<Button
							onClick={handleCreate}
							disabled={saving || activeCategories.length === 0}
						>
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
				) : productRows.length === 0 ? (
					<p className="text-muted-foreground">No products yet.</p>
				) : (
					<ul className="divide-y rounded-xl border bg-white">
						{productRows.map((product) => (
							<li
								key={product._id}
								className="px-5 py-4 flex items-center gap-4"
							>
								<div className="h-16 w-16 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
									{product.imageUrl ? (
										<img
											src={product.imageUrl}
											alt={product.name}
											className="h-full w-full object-cover"
										/>
									) : (
										<ImageIcon className="h-6 w-6 text-muted-foreground" />
									)}
								</div>
								<div className="flex-1 min-w-0">
									<p className="font-medium">{product.name}</p>
									<p className="text-sm text-muted-foreground line-clamp-1">
										{product.shortDescription}
									</p>
								</div>
								<div className="flex items-center gap-2 shrink-0">
									{hasAdminAccess && (
										<ProductImageUploadButton
											label={product.imageUrl ? "Change" : "Add image"}
											onUpload={(file) =>
												handleProductImage(product._id, product.name, file)
											}
										/>
									)}
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
