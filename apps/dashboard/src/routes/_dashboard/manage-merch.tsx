import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	AlertTriangle,
	Archive,
	Boxes,
	CalendarClock,
	ClipboardList,
	Download,
	Edit3,
	History,
	ImagePlus,
	Loader2,
	PackagePlus,
	Plus,
	RefreshCw,
	Search,
	Settings2,
	SlidersHorizontal,
	Upload,
	WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { OrderDetails } from "@/components/dashboard/merch/OrderDetails";
import {
	parsePacificLocal,
	toPacificLocalInput,
} from "@/components/dashboard/merch/timezone";
import type {
	MerchOrder,
	MerchProduct,
	MerchVariant,
	PickupOption,
} from "@/components/dashboard/merch/types";
import {
	pacificDateTime,
	points,
	variantLabel,
	variantPrice,
	variantStock,
} from "@/components/dashboard/merch/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_dashboard/manage-merch")({
	component: ManageMerchPage,
});

function ManageMerchPage() {
	const { hasAdminAccess, isLoading } = usePermissions();
	if (isLoading)
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<Loader2 className="size-8 animate-spin" />
			</div>
		);
	if (!hasAdminAccess)
		return (
			<Dialog open>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Access denied</DialogTitle>
						<DialogDescription>
							Manage Merch is available to Executive Officers and
							Administrators.
						</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>
		);
	return (
		<div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Manage Merch</h1>
				<p className="text-muted-foreground">
					Operate the catalog, orders, pickup schedule, inventory, and point
					accounts.
				</p>
			</div>
			<Tabs defaultValue="catalog">
				<TabsList className="h-auto flex-wrap">
					<TabsTrigger value="catalog">
						<Settings2 />
						Catalog
					</TabsTrigger>
					<TabsTrigger value="orders">
						<ClipboardList />
						Orders
					</TabsTrigger>
					<TabsTrigger value="pickup">
						<CalendarClock />
						Pickup
					</TabsTrigger>
					<TabsTrigger value="inventory">
						<Boxes />
						Inventory
					</TabsTrigger>
					<TabsTrigger value="points">
						<WalletCards />
						Points
					</TabsTrigger>
				</TabsList>
				<TabsContent value="catalog">
					<CatalogManager />
				</TabsContent>
				<TabsContent value="orders">
					<OrdersManager />
				</TabsContent>
				<TabsContent value="pickup">
					<PickupManager />
				</TabsContent>
				<TabsContent value="inventory">
					<InventoryManager />
				</TabsContent>
				<TabsContent value="points">
					<PointsManager />
				</TabsContent>
			</Tabs>
		</div>
	);
}

function CatalogManager() {
	const result = useAuthedQuery(api.merchCatalog.listForManager);
	const products = (result ?? []) as MerchProduct[];
	const createProduct = useAuthedMutation(api.merchCatalog.createProduct);
	const updateProduct = useAuthedMutation(api.merchCatalog.updateProduct);
	const archiveProduct = useAuthedMutation(api.merchCatalog.archiveProduct);
	const createVariant = useAuthedMutation(api.merchCatalog.createVariant);
	const updateVariant = useAuthedMutation(api.merchCatalog.updateVariant);
	const generateUploadUrl = useAuthedMutation(
		api.merchCatalog.generateImageUploadUrl,
	);
	const registerImageUpload = useAuthedMutation(
		api.merchCatalog.registerImageUpload,
	);
	const finalizeImage = useAuthedMutation(
		api.merchCatalog.finalizeProductImage,
	);
	const removeImage = useAuthedMutation(api.merchCatalog.removeProductImage);
	const [editing, setEditing] = useState<MerchProduct | null>();
	const [variantProduct, setVariantProduct] = useState<MerchProduct>();
	const [busy, setBusy] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	const saveProduct = async (data: Record<string, any>) => {
		setBusy(true);
		try {
			if (editing?._id)
				await updateProduct({
					productId: editing._id,
					expectedRevision: editing.revision ?? 0,
					name: data.name,
					description: data.description,
					status: data.status,
					purchaseLimit: data.purchaseLimit ?? null,
					availableFrom: data.availableFrom ?? null,
					availableUntil: data.availableUntil ?? null,
					displayOrder: data.displayOrder,
				});
			else
				await createProduct({
					name: data.name,
					description: data.description,
					status: "draft",
					purchaseLimit: data.purchaseLimit,
					availableFrom: data.availableFrom,
					availableUntil: data.availableUntil,
					displayOrder: data.displayOrder,
				});
			toast.success(editing?._id ? "Product updated" : "Draft product created");
			setEditing(undefined);
		} catch (error: any) {
			toast.error(error?.message ?? "Could not save product");
		} finally {
			setBusy(false);
		}
	};
	const doArchive = async (product: MerchProduct) => {
		if (
			!window.confirm(
				`Archive ${product.name}? Existing order snapshots will be retained.`,
			)
		)
			return;
		try {
			await archiveProduct({
				productId: product._id as any,
				expectedRevision: product.revision ?? 0,
			});
			toast.success("Product archived");
		} catch (error: any) {
			toast.error(error?.message ?? "Could not archive product");
		}
	};
	const uploadImage = async (product: MerchProduct, file: File) => {
		setBusy(true);
		try {
			const { uploadUrl, claimToken } = await generateUploadUrl();
			const response = await fetch(uploadUrl, {
				method: "POST",
				headers: { "Content-Type": file.type },
				body: file,
			});
			if (!response.ok) throw new Error("Image upload failed");
			const { storageId } = await response.json();
			await registerImageUpload({ claimToken, storageId });
			await finalizeImage({
				productId: product._id,
				claimToken,
				fileName: file.name,
				expectedRevision: product.revision ?? 0,
			});
			toast.success("Product image updated");
		} catch (error: any) {
			toast.error(error?.message ?? "Could not upload image");
		} finally {
			setBusy(false);
			if (fileRef.current) fileRef.current.value = "";
		}
	};
	const removeProductImage = async (product: MerchProduct) => {
		if (
			!window.confirm(
				`Remove the image from ${product.name}? Active products must be moved to draft first.`,
			)
		)
			return;
		try {
			await removeImage({
				productId: product._id,
				expectedRevision: product.revision ?? 0,
			});
			toast.success("Product image removed");
		} catch (error: any) {
			toast.error(error?.message ?? "Could not remove image");
		}
	};

	return (
		<div className="mt-5 space-y-5">
			<div className="flex justify-between gap-3">
				<div>
					<h2 className="text-xl font-semibold">Catalog</h2>
					<p className="text-sm text-muted-foreground">
						Products remain drafts until they have an image and at least one
						valid active variant.
					</p>
				</div>
				<Button onClick={() => setEditing(null)}>
					<PackagePlus />
					New product
				</Button>
			</div>
			{result === undefined ? (
				<LoadingCards />
			) : products.length ? (
				<div className="grid gap-4 md:grid-cols-2">
					{products.map((product) => (
						<Card key={product._id}>
							<CardContent className="flex gap-4 pt-6">
								{product.imageUrl ? (
									<img
										src={product.imageUrl}
										alt=""
										className="size-24 rounded-lg border object-cover"
									/>
								) : (
									<button
										type="button"
										className="flex size-24 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground"
										onClick={() => {
											setEditing(product);
											setTimeout(() => fileRef.current?.click(), 0);
										}}
									>
										<ImagePlus className="mb-1 size-6" />
										Add image
									</button>
								)}
								<div className="min-w-0 flex-1">
									<div className="flex items-start justify-between gap-2">
										<div>
											<h3 className="font-semibold">{product.name}</h3>
											<Badge
												variant={
													product.status === "active"
														? "default"
														: product.status === "archived"
															? "outline"
															: "secondary"
												}
												className="capitalize"
											>
												{product.status ?? "draft"}
											</Badge>
										</div>
										<div className="flex">
											<Button
												size="icon"
												variant="ghost"
												onClick={() => setEditing(product)}
												aria-label={`Edit ${product.name}`}
											>
												<Edit3 />
											</Button>
											{product.status !== "archived" && (
												<Button
													size="icon"
													variant="ghost"
													onClick={() => doArchive(product)}
													aria-label={`Archive ${product.name}`}
												>
													<Archive />
												</Button>
											)}
										</div>
									</div>
									<p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
										{product.description}
									</p>
									<p className="mt-2 text-sm">
										{product.variants.length} variants ·{" "}
										{product.variants.reduce(
											(sum, variant) => sum + variantStock(variant),
											0,
										)}{" "}
										units
									</p>
									<Button
										className="mt-3"
										size="sm"
										variant="outline"
										onClick={() => setVariantProduct(product)}
									>
										<SlidersHorizontal />
										Manage variants
									</Button>
									{product.imageUrl && product.status !== "active" && (
										<Button
											className="mt-3 ml-2"
											size="sm"
											variant="ghost"
											onClick={() => removeProductImage(product)}
										>
											Remove image
										</Button>
									)}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			) : (
				<Empty
					title="No products"
					detail="Create a draft product to start building the catalog."
				/>
			)}
			<input
				ref={fileRef}
				type="file"
				accept="image/png,image/jpeg,image/webp"
				hidden
				onChange={(event) => {
					if (editing?._id && event.target.files?.[0])
						uploadImage(editing, event.target.files[0]);
				}}
			/>
			<ProductDialog
				product={editing}
				open={editing !== undefined}
				busy={busy}
				onClose={() => setEditing(undefined)}
				onSave={saveProduct}
				onUpload={() => fileRef.current?.click()}
			/>
			<VariantsDialog
				product={variantProduct}
				open={Boolean(variantProduct)}
				busy={busy}
				onClose={() => setVariantProduct(undefined)}
				onSave={async (variant, data) => {
					setBusy(true);
					try {
						if (variant)
							await updateVariant({
								variantId: variant._id as any,
								sku: data.sku,
								optionValues: data.optionValues,
								pointPrice: data.pointPrice,
								active: data.active,
								expectedRevision: variant.revision ?? 0,
							});
						else
							await createVariant({
								productId: variantProduct?._id as any,
								sku: data.sku,
								optionValues: data.optionValues,
								pointPrice: data.pointPrice,
								initialStock: data.initialStock,
								active: data.active,
								requestId: crypto.randomUUID(),
								reason: data.reason,
							});
						toast.success(variant ? "Variant updated" : "Variant created");
					} catch (error: any) {
						toast.error(error?.message ?? "Could not save variant");
					} finally {
						setBusy(false);
					}
				}}
			/>
		</div>
	);
}

function ProductDialog({
	product,
	open,
	busy,
	onClose,
	onSave,
	onUpload,
}: {
	product: MerchProduct | null | undefined;
	open: boolean;
	busy: boolean;
	onClose: () => void;
	onSave: (data: Record<string, any>) => void;
	onUpload: () => void;
}) {
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [status, setStatus] = useState("draft");
	const [limit, setLimit] = useState("");
	const [availableFrom, setAvailableFrom] = useState("");
	const [availableUntil, setAvailableUntil] = useState("");
	const [displayOrder, setDisplayOrder] = useState("0");
	useEffect(() => {
		if (!open) return;
		setName(product?.name ?? "");
		setDescription(product?.description ?? "");
		setStatus(product?.status ?? "draft");
		setLimit(product?.purchaseLimit?.toString() ?? "");
		setAvailableFrom(toPacificLocalInput(product?.availableFrom));
		setAvailableUntil(toPacificLocalInput(product?.availableUntil));
		setDisplayOrder(String(product?.displayOrder ?? 0));
	}, [open, product]);
	return (
		<Dialog
			open={open}
			onOpenChange={(value) => {
				if (!value) onClose();
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{product ? `Edit ${product.name}` : "New product"}
					</DialogTitle>
					<DialogDescription>
						Catalog changes are revisioned. Activation is validated by the
						server.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<Field label="Name">
						<Input value={name} onChange={(e) => setName(e.target.value)} />
					</Field>
					<Field label="Description">
						<Textarea
							value={description}
							onChange={(e) => setDescription(e.target.value)}
						/>
					</Field>
					<div className="grid grid-cols-2 gap-3">
						<Field label="Status">
							<Select value={status} onValueChange={setStatus}>
								<SelectTrigger className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="draft">Draft</SelectItem>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="archived">Archived</SelectItem>
								</SelectContent>
							</Select>
						</Field>
						<Field label="Per-member limit">
							<Input
								type="number"
								min="1"
								value={limit}
								onChange={(e) => setLimit(e.target.value)}
								placeholder="No limit"
							/>
						</Field>
						<Field label="Available from">
							<Input
								type="datetime-local"
								value={availableFrom}
								onChange={(e) => setAvailableFrom(e.target.value)}
							/>
						</Field>
						<Field label="Available until">
							<Input
								type="datetime-local"
								value={availableUntil}
								onChange={(e) => setAvailableUntil(e.target.value)}
							/>
						</Field>
						<Field label="Display order">
							<Input
								type="number"
								min="0"
								step="1"
								value={displayOrder}
								onChange={(e) => setDisplayOrder(e.target.value)}
							/>
						</Field>
					</div>
					{product && (
						<Button type="button" variant="outline" onClick={onUpload}>
							<Upload />
							Upload image
						</Button>
					)}
					{status === "active" &&
						(!product?.imageUrl ||
							!product?.variants.some(
								(variant) =>
									variant.active !== false && variantPrice(variant) > 0,
							)) && (
							<div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
								<AlertTriangle className="size-4 shrink-0" />
								Add an image and a valid active variant before activation.
							</div>
						)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button
						disabled={
							busy ||
							!name.trim() ||
							!description.trim() ||
							!Number.isSafeInteger(Number(displayOrder))
						}
						onClick={() =>
							onSave({
								name: name.trim(),
								description: description.trim(),
								status,
								purchaseLimit: limit ? Number(limit) : undefined,
								availableFrom: availableFrom
									? parsePacificLocal(availableFrom)
									: undefined,
								availableUntil: availableUntil
									? parsePacificLocal(availableUntil)
									: undefined,
								displayOrder: Number(displayOrder),
							})
						}
					>
						{busy ? "Saving…" : "Save product"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function VariantsDialog({
	product,
	open,
	busy,
	onClose,
	onSave,
}: {
	product?: MerchProduct;
	open: boolean;
	busy: boolean;
	onClose: () => void;
	onSave: (
		variant: MerchVariant | undefined,
		data: Record<string, any>,
	) => void;
}) {
	const [editing, setEditing] = useState<MerchVariant>();
	const [sku, setSku] = useState("");
	const [name, setName] = useState("");
	const [price, setPrice] = useState("");
	const [initialStock, setInitialStock] = useState("0");
	const [reason, setReason] = useState("Initial catalog stock");
	const [active, setActive] = useState(true);
	const choose = (variant?: MerchVariant) => {
		setEditing(variant);
		setSku(variant?.sku ?? "");
		setName(variant ? variantLabel(variant) : "");
		setPrice(variant ? String(variantPrice(variant)) : "");
		setInitialStock("0");
		setReason("Initial catalog stock");
		setActive(variant?.active ?? true);
	};
	return (
		<Dialog open={open} onOpenChange={(value) => !value && onClose()}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{product?.name} variants</DialogTitle>
					<DialogDescription>
						SKU, point price, and active state are revisioned. Use Inventory for
						later stock changes.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-5 sm:grid-cols-2">
					<div className="space-y-2">
						{product?.variants.map((variant) => (
							<button
								key={variant._id}
								type="button"
								onClick={() => choose(variant)}
								className="flex w-full justify-between rounded-md border p-3 text-left hover:bg-muted"
							>
								<span>
									<span className="font-medium">{variantLabel(variant)}</span>
									<span className="block text-xs text-muted-foreground">
										{variant.sku}
									</span>
								</span>
								<span className="text-right text-sm">
									{points(variantPrice(variant))}
									<span className="block text-xs text-muted-foreground">
										{variantStock(variant)} in stock
									</span>
								</span>
							</button>
						))}
						<Button
							variant="outline"
							className="w-full"
							onClick={() => choose()}
						>
							<Plus />
							New variant
						</Button>
					</div>
					<div className="space-y-3">
						<Field label="Variant label">
							<Input
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Medium / Navy"
							/>
						</Field>
						<Field label="SKU">
							<Input
								value={sku}
								onChange={(e) => setSku(e.target.value.toUpperCase())}
							/>
						</Field>
						<Field label="Point price">
							<Input
								type="number"
								min="1"
								value={price}
								onChange={(e) => setPrice(e.target.value)}
							/>
						</Field>
						{!editing && (
							<>
								<Field label="Initial stock">
									<Input
										type="number"
										min="0"
										value={initialStock}
										onChange={(e) => setInitialStock(e.target.value)}
									/>
								</Field>
								<Field label="Initial stock reason">
									<Input
										value={reason}
										onChange={(e) => setReason(e.target.value)}
									/>
								</Field>
							</>
						)}
						<div className="flex items-center justify-between">
							<Label>Active</Label>
							<Switch checked={active} onCheckedChange={setActive} />
						</div>
						<Button
							className="w-full"
							disabled={
								busy ||
								!sku ||
								!name ||
								Number(price) < 1 ||
								(!editing &&
									(!Number.isSafeInteger(Number(initialStock)) ||
										Number(initialStock) < 0 ||
										reason.trim().length < 3))
							}
							onClick={() =>
								onSave(editing, {
									sku,
									optionValues: [{ name: "Variant", value: name }],
									pointPrice: Number(price),
									initialStock: Number(initialStock),
									reason: reason.trim(),
									active,
								})
							}
						>
							{busy ? "Saving…" : editing ? "Update variant" : "Create variant"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function OrdersManager() {
	const [status, setStatus] = useState("all");
	const [search, setSearch] = useState("");
	const [health, setHealth] = useState("all");
	const [productId, setProductId] = useState("all");
	const [sku, setSku] = useState("");
	const [pickupFilter, setPickupFilter] = useState("all");
	const [createdFrom, setCreatedFrom] = useState("");
	const [createdUntil, setCreatedUntil] = useState("");
	const [cursor, setCursor] = useState<string | null>(null);
	const [cursorHistory, setCursorHistory] = useState<Array<string | null>>([]);
	const [selectedId, setSelectedId] = useState<string>();
	const [action, setAction] = useState<"cancel" | "reschedule">();
	const [reason, setReason] = useState("");
	const [pickupId, setPickupId] = useState("");
	const [busy, setBusy] = useState(false);
	const pickupsResult = useAuthedQuery(api.merchPickup.listAvailable);
	const managerProducts = useAuthedQuery(api.merchCatalog.listForManager) ?? [];
	const pickups = normalizeManagerPickups(pickupsResult);
	const selectedPickupFilter = pickups.find(
		(pickup) => pickup._id === pickupFilter,
	);
	useEffect(() => {
		setCursor(null);
		setCursorHistory([]);
	}, [
		status,
		search,
		health,
		productId,
		sku,
		pickupFilter,
		createdFrom,
		createdUntil,
	]);
	const result = useAuthedQuery(api.merchOrders.searchPageForManager, {
		paginationOpts: { cursor, numItems: 25 },
		status:
			status === "all"
				? undefined
				: (status as "pending" | "fulfilled" | "canceled"),
		pickupHealth:
			health === "all"
				? undefined
				: (health as "scheduled" | "overdue" | "action_required"),
		search: search || undefined,
		productId: productId === "all" ? undefined : (productId as any),
		sku: sku || undefined,
		pickupEventId:
			selectedPickupFilter?.type === "event"
				? (selectedPickupFilter._id as any)
				: undefined,
		pickupSlotId:
			selectedPickupFilter?.type === "slot"
				? (selectedPickupFilter._id as any)
				: undefined,
		createdFrom: createdFrom
			? parsePacificLocal(`${createdFrom}T00:00`)
			: undefined,
		createdUntil: createdUntil
			? parsePacificLocal(`${createdUntil}T23:59`) + 60_000
			: undefined,
	});
	const detailResult = useAuthedQuery(
		api.merchOrders.getForManager,
		selectedId ? { orderId: selectedId as any } : "skip",
	);
	const exportRows = useAuthedQuery(api.merchOrders.exportForManager);
	const deadLetters =
		useAuthedQuery(api.merchNotifications.listForManager, {
			state: "dead_letter",
		}) ?? [];
	const cancel = useAuthedMutation(api.merchOrders.cancelForManager);
	const reschedule = useAuthedMutation(api.merchOrders.rescheduleForManager);
	const retryNotification = useAuthedMutation(
		api.merchNotifications.retryDeadLetter,
	);
	const orders = (result?.page ?? []).map((order) => ({
		...order,
		memberName: order.ownerName,
		memberEmail: order.ownerEmail,
	})) as MerchOrder[];
	const selectedRaw =
		detailResult ?? orders.find((order) => order._id === selectedId);
	const selected = selectedRaw
		? ({
				...selectedRaw,
				memberName: (selectedRaw as any).ownerName,
				memberEmail: (selectedRaw as any).ownerEmail,
				events: (selectedRaw as any).timeline,
			} as MerchOrder)
		: undefined;
	const audit = detailResult as
		| {
				pointEntries?: Array<{
					_id: string;
					balanceDelta: number;
					kind: string;
					reason?: string;
				}>;
				inventoryEntries?: Array<{
					_id: string;
					quantityDelta: number;
					kind: string;
					reason: string;
				}>;
		  }
		| undefined;
	const downloadOrders = () => {
		if (!exportRows) return;
		const headings = Object.keys(exportRows[0] ?? {});
		const csv = [
			headings,
			...exportRows.map((row) =>
				headings.map((key) => String(row[key as keyof typeof row] ?? "")),
			),
		]
			.map((cells) =>
				cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
			)
			.join("\n");
		const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
		const link = document.createElement("a");
		link.href = url;
		link.download = `merch-orders-${new Date().toISOString().slice(0, 10)}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	};
	const runAction = async () => {
		if (!selected || reason.trim().length < 3) return;
		setBusy(true);
		try {
			if (action === "cancel")
				await cancel({
					orderId: selected._id as any,
					reason: reason.trim(),
					requestId: crypto.randomUUID(),
				});
			else {
				const next = pickups.find((p) => p._id === pickupId);
				if (!next) return;
				await reschedule({
					orderId: selected._id as any,
					pickup:
						next.type === "event"
							? { type: "event", pickupEventId: next._id as any }
							: { type: "slot", pickupSlotId: next._id as any },
					reason: reason.trim(),
					requestId: crypto.randomUUID(),
				});
			}
			toast.success(
				action === "cancel"
					? "Order canceled and reversed"
					: "Order rescheduled",
			);
			setAction(undefined);
			setReason("");
		} catch (error: any) {
			toast.error(error?.message ?? "Order action failed");
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className="mt-5 space-y-5">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 className="text-xl font-semibold">Orders</h2>
					<p className="text-sm text-muted-foreground">
						Search receipts, resolve overdue pickups, and perform audited
						reversals.
					</p>
				</div>
				<Button
					variant="outline"
					onClick={downloadOrders}
					disabled={!exportRows}
				>
					<Download />
					Export CSV
				</Button>
			</div>
			<div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
				<div className="relative">
					<Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
					<Input
						className="pl-9"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Order, member, product, or SKU"
					/>
				</div>
				<FilterSelect
					value={status}
					onChange={setStatus}
					items={["all", "pending", "fulfilled", "canceled"]}
				/>
				<FilterSelect
					value={health}
					onChange={setHealth}
					items={["all", "scheduled", "overdue", "action_required"]}
				/>
			</div>
			<div className="grid gap-3 md:grid-cols-5">
				<Select value={productId} onValueChange={setProductId}>
					<SelectTrigger>
						<SelectValue placeholder="All products" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All products</SelectItem>
						{managerProducts.map((product) => (
							<SelectItem key={product._id} value={product._id}>
								{product.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Input
					value={sku}
					onChange={(event) => setSku(event.target.value)}
					placeholder="SKU contains…"
				/>
				<Select value={pickupFilter} onValueChange={setPickupFilter}>
					<SelectTrigger>
						<SelectValue placeholder="All pickups" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All pickups</SelectItem>
						{pickups.map((pickup) => (
							<SelectItem key={pickup._id} value={pickup._id}>
								{pickup.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Input
					aria-label="Orders created from"
					type="date"
					value={createdFrom}
					onChange={(event) => setCreatedFrom(event.target.value)}
				/>
				<Input
					aria-label="Orders created through"
					type="date"
					value={createdUntil}
					onChange={(event) => setCreatedUntil(event.target.value)}
				/>
			</div>
			{deadLetters.length > 0 && (
				<Card className="border-destructive/30">
					<CardHeader>
						<CardTitle className="text-base">
							Notification delivery issues
						</CardTitle>
						<CardDescription>
							{deadLetters.length} dead-letter notification
							{deadLetters.length === 1 ? "" : "s"} require attention.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2">
						{deadLetters.map((item) => (
							<div
								key={item._id}
								className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
							>
								<div>
									<p className="font-medium">
										{item.kind} · {item.orderNumber ?? "Order"}
									</p>
									<p className="text-muted-foreground">
										{item.lastError ?? "Delivery failed"}
									</p>
								</div>
								<Button
									size="sm"
									variant="outline"
									onClick={async () => {
										try {
											await retryNotification({ outboxId: item._id });
											toast.success("Notification queued for retry");
										} catch (error: any) {
											toast.error(error?.message ?? "Retry failed");
										}
									}}
								>
									<RefreshCw />
									Retry
								</Button>
							</div>
						))}
					</CardContent>
				</Card>
			)}
			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Order</TableHead>
							<TableHead>Member</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Pickup</TableHead>
							<TableHead className="text-right">Total</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{orders.map((order) => (
							<TableRow
								key={order._id}
								className="cursor-pointer"
								onClick={() => setSelectedId(order._id)}
							>
								<TableCell>
									<p className="font-medium">{order.orderNumber}</p>
									<p className="text-xs text-muted-foreground">
										{pacificDateTime(order.createdAt)} PT
									</p>
								</TableCell>
								<TableCell>
									{order.memberName ?? order.userName}
									<p className="text-xs text-muted-foreground">
										{order.memberEmail}
									</p>
								</TableCell>
								<TableCell>
									<Badge
										variant={
											order.status === "canceled"
												? "destructive"
												: order.status === "fulfilled"
													? "default"
													: "secondary"
										}
										className="capitalize"
									>
										{order.status}
									</Badge>
									{order.pickupHealth && order.pickupHealth !== "scheduled" && (
										<Badge variant="outline" className="ml-1 capitalize">
											{order.pickupHealth.replace("_", " ")}
										</Badge>
									)}
								</TableCell>
								<TableCell>
									{order.pickupSnapshot?.label ??
										order.pickupSnapshot?.name ??
										order.pickup?.name}
									<p className="text-xs text-muted-foreground">
										{pacificDateTime(
											(order.pickupSnapshot ?? order.pickup)?.startAt,
										)}
									</p>
								</TableCell>
								<TableCell className="text-right font-medium">
									{points(order.totalPoints ?? order.total ?? 0)}
								</TableCell>
							</TableRow>
						))}
						{!orders.length && (
							<TableRow>
								<TableCell
									colSpan={5}
									className="h-32 text-center text-muted-foreground"
								>
									No matching orders
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex items-center justify-end gap-2">
				<Button
					variant="outline"
					disabled={cursorHistory.length === 0}
					onClick={() => {
						const previous = cursorHistory.at(-1) ?? null;
						setCursorHistory((history) => history.slice(0, -1));
						setCursor(previous);
					}}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					disabled={!result || result.isDone}
					onClick={() => {
						if (!result || result.isDone) return;
						setCursorHistory((history) => [...history, cursor]);
						setCursor(result.continueCursor);
					}}
				>
					Next
				</Button>
			</div>
			<Dialog
				open={Boolean(selectedId)}
				onOpenChange={(open) => !open && setSelectedId(undefined)}
			>
				<DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
					{selected ? (
						<>
							<OrderDetails order={selected} />
							<div className="grid gap-3 sm:grid-cols-2">
								<Card>
									<CardHeader>
										<CardTitle className="text-base">
											Point ledger links
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2 text-sm">
										{audit?.pointEntries?.map((entry) => (
											<div key={entry._id} className="rounded border p-2">
												<p className="font-medium">
													{entry.kind} · {entry.balanceDelta > 0 ? "+" : ""}
													{entry.balanceDelta} pts
												</p>
												<p className="text-muted-foreground">{entry.reason}</p>
											</div>
										))}
										{!audit?.pointEntries?.length && (
											<p className="text-muted-foreground">
												No linked point entries.
											</p>
										)}
									</CardContent>
								</Card>
								<Card>
									<CardHeader>
										<CardTitle className="text-base">
											Inventory movements
										</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2 text-sm">
										{audit?.inventoryEntries?.map((entry) => (
											<div key={entry._id} className="rounded border p-2">
												<p className="font-medium">
													{entry.kind} · {entry.quantityDelta > 0 ? "+" : ""}
													{entry.quantityDelta}
												</p>
												<p className="text-muted-foreground">{entry.reason}</p>
											</div>
										))}
										{!audit?.inventoryEntries?.length && (
											<p className="text-muted-foreground">
												No linked inventory entries.
											</p>
										)}
									</CardContent>
								</Card>
							</div>
							<DialogFooter>
								{selected.status === "pending" && (
									<>
										<Button
											variant="outline"
											onClick={() => setAction("reschedule")}
										>
											Reschedule
										</Button>
										<Button
											variant="destructive"
											onClick={() => setAction("cancel")}
										>
											Cancel & refund
										</Button>
									</>
								)}
							</DialogFooter>
						</>
					) : (
						<Loader2 className="mx-auto my-24 animate-spin" />
					)}
				</DialogContent>
			</Dialog>
			<Dialog
				open={Boolean(action)}
				onOpenChange={(open) => !open && setAction(undefined)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{action === "cancel"
								? "Cancel and reverse order"
								: "Reschedule pickup"}
						</DialogTitle>
						<DialogDescription>
							{action === "cancel"
								? "This atomically refunds points, restores stock, releases capacity, and appends an audit event."
								: "Old capacity is released and new capacity is booked atomically."}
						</DialogDescription>
					</DialogHeader>
					{action === "reschedule" && (
						<Field label="New pickup">
							<Select value={pickupId} onValueChange={setPickupId}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Choose pickup" />
								</SelectTrigger>
								<SelectContent>
									{pickups.map((pickup) => (
										<SelectItem key={pickup._id} value={pickup._id}>
											{pickup.name} · {pacificDateTime(pickup.startAt)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					)}
					<Field label="Required reason">
						<Textarea
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder="Explain this operational change"
						/>
					</Field>
					<DialogFooter>
						<Button variant="outline" onClick={() => setAction(undefined)}>
							Back
						</Button>
						<Button
							variant={action === "cancel" ? "destructive" : "default"}
							disabled={
								busy ||
								reason.trim().length < 3 ||
								(action === "reschedule" && !pickupId)
							}
							onClick={runAction}
						>
							{busy ? "Saving…" : "Confirm audited action"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function PickupManager() {
	const result = useAuthedQuery(api.merchPickup.listForManager);
	const publishedEvents = useQuery(api.events.listPublished);
	const configureEvent = useAuthedMutation(api.merchPickup.configureEvent);
	const createWindow = useAuthedMutation(api.merchPickup.createWindow);
	const updateWindow = useAuthedMutation(api.merchPickup.updateWindow);
	const disableWindow = useAuthedMutation(api.merchPickup.disableWindow);
	const updateSlot = useAuthedMutation(api.merchPickup.updateSlot);
	const [search, setSearch] = useState("");
	const [windowOpen, setWindowOpen] = useState(false);
	const [editingWindowId, setEditingWindowId] = useState<string>();
	const [impact, setImpact] = useState<{
		type: "event" | "window" | "slot";
		id: string;
		eventId?: string;
		capacity?: number;
		cutoffAt?: number;
		notes?: string;
	}>();
	const [start, setStart] = useState("");
	const [end, setEnd] = useState("");
	const [duration, setDuration] = useState("15");
	const [capacity, setCapacity] = useState("10");
	const [location, setLocation] = useState("EBU1-4710");
	const [busy, setBusy] = useState(false);
	const mappings = result?.events ?? [];
	const windows = result?.windows ?? [];
	const impactRows =
		useAuthedQuery(
			api.merchPickup.listImpact,
			impact
				? impact.type === "event"
					? { pickupEventId: impact.id as any }
					: impact.type === "window"
						? { windowId: impact.id as any }
						: { pickupSlotId: impact.id as any }
				: "skip",
		) ?? [];
	const events = (publishedEvents ?? [])
		.filter((event) => event.endDate > Date.now())
		.map((event) => {
			const mapping = mappings.find((entry) => entry.eventId === event._id);
			return {
				...event,
				pickupEventId: mapping?._id,
				enabled: mapping?.enabled ?? false,
				capacity: mapping?.capacity,
				bookedCount: mapping?.bookedCount,
				cutoffAt: mapping?.bookingCutoffAt,
				notes: mapping?.managerNotes,
			};
		});
	const previewSlots = useMemo(() => {
		const values: number[] = [];
		const minutes = Number(duration);
		if (!start || !end || minutes < 5) return values;
		try {
			let cursor = parsePacificLocal(start);
			const finish = parsePacificLocal(end);
			while (cursor < finish && values.length < 96) {
				const next = cursor + minutes * 60_000;
				if (next > finish) break;
				values.push(cursor);
				cursor = next;
			}
		} catch {
			return [];
		}
		return values;
	}, [start, end, duration]);
	const saveWindow = async () => {
		setBusy(true);
		try {
			const editingWindow = windows.find(
				(window) => window._id === editingWindowId,
			);
			const payload = {
				displayName: "IEEE Project Space",
				address: location,
				timezone: "America/Los_Angeles",
				startAt: parsePacificLocal(start),
				endAt: parsePacificLocal(end),
				slotDurationMinutes: Number(duration),
				defaultCapacity: Number(capacity),
			};
			if (editingWindow)
				await updateWindow({ windowId: editingWindow._id, ...payload });
			else
				await createWindow({
					requestId: crypto.randomUUID(),
					...payload,
				});
			toast.success(
				editingWindow
					? "Pickup window updated"
					: `${previewSlots.length} pickup slots created`,
			);
			setWindowOpen(false);
			setEditingWindowId(undefined);
		} catch (error: any) {
			toast.error(error?.message ?? "Could not create pickup window");
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className="mt-5 space-y-6">
			<div className="flex justify-between">
				<div>
					<h2 className="text-xl font-semibold">Pickup</h2>
					<p className="text-sm text-muted-foreground">
						Enable published events or generate capacity-limited Project Space
						slots.
					</p>
				</div>
				<Button
					onClick={() => {
						setEditingWindowId(undefined);
						setStart("");
						setEnd("");
						setWindowOpen(true);
					}}
				>
					<Plus />
					Project Space window
				</Button>
			</div>
			<StoreSettingsCard />
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Event pickups</CardTitle>
					<CardDescription>
						Existing event details remain snapshotted on orders.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="relative">
						<Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
						<Input
							className="pl-9"
							placeholder="Search future published events"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
					{events
						.filter(
							(event) =>
								!search ||
								event.eventName.toLowerCase().includes(search.toLowerCase()),
						)
						.map((event) => (
							<div
								key={event._id}
								className="flex items-center gap-3 rounded-lg border p-3"
							>
								<div className="flex-1">
									<p className="font-medium">{event.eventName}</p>
									<p className="text-sm text-muted-foreground">
										{pacificDateTime(event.startDate)} PT · {event.location}
									</p>
									{event.bookedCount ? (
										<p className="text-xs text-amber-700">
											{event.bookedCount} existing bookings
										</p>
									) : null}
								</div>
								<Button
									size="sm"
									variant="outline"
									onClick={async () => {
										const capacityValue = globalThis.prompt(
											"Order capacity (blank for unlimited)",
											String(event.capacity ?? ""),
										);
										if (capacityValue === null) return;
										const cutoffValue = globalThis.prompt(
											"Booking cutoff in Pacific time (blank for event start)",
											toPacificLocalInput(event.cutoffAt ?? event.startDate),
										);
										if (cutoffValue === null) return;
										const notes = globalThis.prompt(
											"Manager notes (optional)",
											event.notes ?? "",
										);
										if (notes === null) return;
										try {
											await configureEvent({
												eventId: event._id,
												enabled: event.enabled,
												capacity: capacityValue
													? Number(capacityValue)
													: undefined,
												bookingCutoffAt: cutoffValue
													? parsePacificLocal(cutoffValue)
													: undefined,
												managerNotes: notes,
											});
											toast.success("Event pickup settings updated");
										} catch (error: any) {
											toast.error(
												error?.message ?? "Could not update event pickup",
											);
										}
									}}
								>
									Configure
								</Button>
								<Label className="text-sm">Pickup enabled</Label>
								<Switch
									checked={event.enabled}
									onCheckedChange={async (enabled) => {
										try {
											if (
												!enabled &&
												event.bookedCount &&
												event.pickupEventId
											) {
												setImpact({
													type: "event",
													id: event.pickupEventId,
													eventId: event._id,
													capacity: event.capacity,
													cutoffAt: event.cutoffAt,
													notes: event.notes,
												});
												return;
											}
											await configureEvent({
												eventId: event._id,
												enabled,
												capacity: event.capacity,
												bookingCutoffAt: event.cutoffAt,
												managerNotes: event.notes,
											});
											toast.success(
												enabled
													? "Event enabled for pickup"
													: "Event pickup disabled",
											);
										} catch (error: any) {
											toast.error(
												error?.message ?? "Could not update event pickup",
											);
										}
									}}
								/>
							</div>
						))}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Project Space schedule</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid gap-3 md:grid-cols-2">
						{windows.map((window) => (
							<div key={window._id} className="rounded-lg border p-3">
								<div className="flex justify-between">
									<p className="font-medium">{window.displayName}</p>
									<Badge variant={window.enabled ? "default" : "outline"}>
										{window.enabled ? "Enabled" : "Disabled"}
									</Badge>
								</div>
								<p className="text-sm text-muted-foreground">
									{pacificDateTime(window.startAt)} –{" "}
									{pacificDateTime(window.endAt)} PT
								</p>
								<p className="text-xs text-muted-foreground">
									{window.slots.length} slots · {window.address}
								</p>
								<div className="mt-2 flex flex-wrap gap-1">
									<Button
										size="sm"
										variant="outline"
										onClick={() => {
											setEditingWindowId(window._id);
											setStart(toPacificLocalInput(window.startAt));
											setEnd(toPacificLocalInput(window.endAt));
											setDuration(String(window.slotDurationMinutes));
											setCapacity(String(window.defaultCapacity ?? ""));
											setLocation(window.address);
											setWindowOpen(true);
										}}
									>
										<Edit3 />
										Edit
									</Button>
									{window.enabled && (
										<Button
											size="sm"
											variant="outline"
											onClick={() =>
												setImpact({ type: "window", id: window._id })
											}
										>
											Disable
										</Button>
									)}
								</div>
								<div className="mt-2 space-y-1">
									{window.slots.map((slot) => (
										<div
											key={slot._id}
											className="flex items-center justify-between rounded bg-muted px-2 py-1 text-xs"
										>
											<span>
												{pacificDateTime(slot.startAt)} · {slot.bookedCount}/
												{slot.capacity ?? "∞"}
											</span>
											<div>
												<Button
													size="sm"
													variant="ghost"
													onClick={async () => {
														const value = globalThis.prompt(
															"New capacity (blank for unlimited)",
															String(slot.capacity ?? ""),
														);
														if (value === null) return;
														try {
															await updateSlot({
																slotId: slot._id,
																capacity: value ? Number(value) : null,
															});
															toast.success("Slot capacity updated");
														} catch (error: any) {
															toast.error(
																error?.message ?? "Could not update slot",
															);
														}
													}}
												>
													Capacity
												</Button>
												{slot.enabled && (
													<Button
														size="sm"
														variant="ghost"
														onClick={() =>
															setImpact({ type: "slot", id: slot._id })
														}
													>
														Disable
													</Button>
												)}
											</div>
										</div>
									))}
								</div>
							</div>
						))}
						{!windows.length && (
							<p className="text-sm text-muted-foreground">
								No project-space windows configured.
							</p>
						)}
					</div>
				</CardContent>
			</Card>
			<Dialog
				open={Boolean(impact)}
				onOpenChange={(open) => !open && setImpact(undefined)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Pickup impact review</DialogTitle>
						<DialogDescription>
							{impactRows.length
								? `${impactRows.length} pending orders must be rescheduled or canceled before this pickup option can be disabled.`
								: "No pending orders are affected."}
						</DialogDescription>
					</DialogHeader>
					{impactRows.map((row) => (
						<div key={row.orderId} className="rounded-md border p-2 text-sm">
							<p className="font-medium">
								{row.orderNumber} · {row.memberName}
							</p>
							<p className="text-muted-foreground">{row.memberEmail}</p>
						</div>
					))}
					<DialogFooter>
						<Button variant="outline" onClick={() => setImpact(undefined)}>
							Close
						</Button>
						<Button
							variant="destructive"
							disabled={impactRows.length > 0}
							onClick={async () => {
								if (!impact) return;
								try {
									if (impact.type === "event") {
										if (!impact.eventId)
											throw new Error("Event reference is missing");
										await configureEvent({
											eventId: impact.eventId as any,
											enabled: false,
											capacity: impact.capacity,
											bookingCutoffAt: impact.cutoffAt,
											managerNotes: impact.notes,
										});
									} else if (impact.type === "window")
										await disableWindow({ windowId: impact.id as any });
									else
										await updateSlot({
											slotId: impact.id as any,
											enabled: false,
										});
									toast.success("Pickup option disabled");
									setImpact(undefined);
								} catch (error: any) {
									toast.error(error?.message ?? "Could not disable pickup");
								}
							}}
						>
							Disable option
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<Dialog open={windowOpen} onOpenChange={setWindowOpen}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>
							{editingWindowId ? "Edit" : "Create"} Project Space window
						</DialogTitle>
						<DialogDescription>
							Times are interpreted in America/Los_Angeles. DST gaps and
							ambiguous times are rejected.
						</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field label="Start">
							<Input
								type="datetime-local"
								value={start}
								onChange={(e) => setStart(e.target.value)}
							/>
						</Field>
						<Field label="End">
							<Input
								type="datetime-local"
								value={end}
								onChange={(e) => setEnd(e.target.value)}
							/>
						</Field>
						<Field label="Slot duration (minutes)">
							<Input
								type="number"
								min="5"
								value={duration}
								onChange={(e) => setDuration(e.target.value)}
							/>
						</Field>
						<Field label="Capacity per slot">
							<Input
								type="number"
								min="1"
								value={capacity}
								onChange={(e) => setCapacity(e.target.value)}
							/>
						</Field>
						<Field label="Location">
							<Input
								value={location}
								onChange={(e) => setLocation(e.target.value)}
							/>
						</Field>
					</div>
					<div className="max-h-40 overflow-y-auto rounded-lg bg-muted p-3">
						<p className="mb-2 text-sm font-semibold">
							Preview · {previewSlots.length} slots
						</p>
						{previewSlots.map((timestamp) => (
							<Badge key={timestamp} variant="outline" className="mr-1 mb-1">
								{pacificDateTime(timestamp)}–
								{new Intl.DateTimeFormat("en-US", {
									timeStyle: "short",
									timeZone: "America/Los_Angeles",
								}).format(timestamp + Number(duration) * 60_000)}
							</Badge>
						))}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setWindowOpen(false)}>
							Cancel
						</Button>
						<Button
							disabled={busy || !previewSlots.length || Number(capacity) < 1}
							onClick={saveWindow}
						>
							{busy ? "Creating…" : `Create ${previewSlots.length} slots`}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function StoreSettingsCard() {
	const settings = useAuthedQuery(api.merchPickup.getSettings);
	const update = useAuthedMutation(api.merchPickup.updateSettings);
	const [storeEnabled, setStoreEnabled] = useState(false);
	const [checkoutEnabled, setCheckoutEnabled] = useState(false);
	const [name, setName] = useState("IEEE Project Space");
	const [address, setAddress] = useState("EBU1-4710");
	const [timezone, setTimezone] = useState("America/Los_Angeles");
	const [cutoff, setCutoff] = useState("0");
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		if (!settings) return;
		setStoreEnabled(settings.storeEnabled);
		setCheckoutEnabled(settings.checkoutEnabled);
		setName(settings.projectSpaceName);
		setAddress(settings.projectSpaceAddress);
		setTimezone(settings.timezone);
		setCutoff(String(settings.memberCancellationCutoffMinutes));
	}, [settings]);
	const save = async () => {
		setBusy(true);
		try {
			await update({
				storeEnabled,
				checkoutEnabled,
				projectSpaceName: name,
				projectSpaceAddress: address,
				timezone,
				memberCancellationCutoffMinutes: Number(cutoff),
			});
			toast.success("Store launch settings updated");
		} catch (error: any) {
			toast.error(error?.message ?? "Could not update store settings");
		} finally {
			setBusy(false);
		}
	};
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Store & checkout settings</CardTitle>
				<CardDescription>
					Keep checkout disabled while previewing a read-only catalog.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-3 sm:grid-cols-2">
					<Label className="flex items-center justify-between rounded-lg border p-3">
						Store visible
						<Switch checked={storeEnabled} onCheckedChange={setStoreEnabled} />
					</Label>
					<Label className="flex items-center justify-between rounded-lg border p-3">
						Checkout enabled
						<Switch
							checked={checkoutEnabled}
							onCheckedChange={setCheckoutEnabled}
							disabled={!storeEnabled}
						/>
					</Label>
					<Field label="Project Space name">
						<Input value={name} onChange={(e) => setName(e.target.value)} />
					</Field>
					<Field label="Address">
						<Input
							value={address}
							onChange={(e) => setAddress(e.target.value)}
						/>
					</Field>
					<Field label="Timezone">
						<Input
							value={timezone}
							onChange={(e) => setTimezone(e.target.value)}
						/>
					</Field>
					<Field label="Member cancellation cutoff (minutes)">
						<Input
							type="number"
							min="0"
							step="1"
							value={cutoff}
							onChange={(e) => setCutoff(e.target.value)}
						/>
					</Field>
				</div>
				<Button
					onClick={save}
					disabled={
						busy ||
						!name.trim() ||
						!address.trim() ||
						!Number.isSafeInteger(Number(cutoff)) ||
						Number(cutoff) < 0
					}
				>
					{busy ? "Saving…" : "Save launch settings"}
				</Button>
			</CardContent>
		</Card>
	);
}

function InventoryManager() {
	const catalogResult = useAuthedQuery(api.merchCatalog.listForManager);
	const products = (catalogResult ?? []) as MerchProduct[];
	const variants = products.flatMap((product) =>
		product.variants.map((variant) => ({ product, variant })),
	);
	const [variantId, setVariantId] = useState("");
	const [delta, setDelta] = useState("");
	const [reason, setReason] = useState("");
	const [busy, setBusy] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);
	const historyResult = useAuthedQuery(
		api.merchCatalog.listInventoryHistory,
		variantId ? { variantId: variantId as any } : "skip",
	);
	const reconcileResult = useAuthedQuery(api.merchCatalog.reconcileInventory);
	const adjust = useAuthedMutation(api.merchCatalog.adjustInventory);
	const selected = variants.find((entry) => entry.variant._id === variantId);
	const resulting =
		(selected ? variantStock(selected.variant) : 0) + Number(delta || 0);
	const history = historyResult ?? [];
	const mismatches =
		reconcileResult?.variants.filter((entry) => !entry.reconciles).length ?? 0;
	const save = async () => {
		if (!selected) return;
		setBusy(true);
		try {
			await adjust({
				variantId: variantId as any,
				quantityDelta: Number(delta),
				reason: reason.trim(),
				requestId: crypto.randomUUID(),
			});
			toast.success("Inventory movement recorded");
			setDelta("");
			setReason("");
		} catch (error: any) {
			toast.error(error?.message ?? "Could not adjust inventory");
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className="mt-5 space-y-5">
			<div>
				<h2 className="text-xl font-semibold">Inventory</h2>
				<p className="text-sm text-muted-foreground">
					Every signed adjustment creates an immutable movement with its
					resulting stock.
				</p>
			</div>
			<div className="grid gap-5 lg:grid-cols-[1fr_320px]">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Adjust stock</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<Field label="Variant">
							<Select value={variantId} onValueChange={setVariantId}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Choose product and variant" />
								</SelectTrigger>
								<SelectContent>
									{variants.map(({ product, variant }) => (
										<SelectItem key={variant._id} value={variant._id}>
											{product.name} · {variantLabel(variant)} · {variant.sku}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						{selected && (
							<div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-center">
								<div>
									<p className="text-xs text-muted-foreground">Current</p>
									<p className="text-lg font-semibold">
										{variantStock(selected.variant)}
									</p>
								</div>
								<div>
									<p className="text-xs text-muted-foreground">Change</p>
									<p className="text-lg font-semibold">
										{Number(delta || 0) >= 0 ? "+" : ""}
										{Number(delta || 0)}
									</p>
								</div>
								<div>
									<p className="text-xs text-muted-foreground">Result</p>
									<p
										className={`text-lg font-semibold ${resulting < 0 ? "text-destructive" : ""}`}
									>
										{resulting}
									</p>
								</div>
							</div>
						)}
						<Field label="Signed quantity">
							<Input
								type="number"
								step="1"
								value={delta}
								onChange={(e) => setDelta(e.target.value)}
								placeholder="e.g. 12 or -2"
							/>
						</Field>
						<Field label="Required reason">
							<Textarea
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								placeholder="Shipment received, damaged item, recount…"
							/>
						</Field>
						{Number(delta) < 0 && (
							<div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
								<AlertTriangle className="size-4 shrink-0" />
								Negative adjustments can affect available stock. Pending orders
								remain reserved.
							</div>
						)}
						<Button
							disabled={
								busy ||
								!selected ||
								!Number.isSafeInteger(Number(delta)) ||
								Number(delta) === 0 ||
								resulting < 0 ||
								reason.trim().length < 3
							}
							onClick={save}
						>
							{busy ? "Recording…" : "Record inventory movement"}
						</Button>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Reconciliation</CardTitle>
						<CardDescription>
							Compare variant summaries to their movement ledgers.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div
							className={`rounded-lg p-4 ${mismatches ? "bg-destructive/5" : "bg-green-50"}`}
						>
							<p className="text-2xl font-bold">{mismatches}</p>
							<p className="text-sm text-muted-foreground">
								mismatches detected
							</p>
						</div>
						<Button
							variant="outline"
							className="w-full"
							disabled={!variantId}
							onClick={() => setHistoryOpen(true)}
						>
							<History />
							View variant history
						</Button>
					</CardContent>
				</Card>
			</div>
			<Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
				<DialogContent className="sm:max-w-3xl">
					<DialogHeader>
						<DialogTitle>Inventory movement history</DialogTitle>
						<DialogDescription>
							Append-only entries for the selected variant.
						</DialogDescription>
					</DialogHeader>
					<div className="max-h-[60vh] overflow-auto">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Time</TableHead>
									<TableHead>Kind</TableHead>
									<TableHead>Reason</TableHead>
									<TableHead className="text-right">Change</TableHead>
									<TableHead className="text-right">Result</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{history.map((entry: any) => (
									<TableRow key={entry._id}>
										<TableCell>{pacificDateTime(entry.createdAt)}</TableCell>
										<TableCell className="capitalize">
											{entry.kind?.replaceAll("_", " ")}
										</TableCell>
										<TableCell>{entry.reason}</TableCell>
										<TableCell className="text-right">
											{entry.quantityDelta > 0 ? "+" : ""}
											{entry.quantityDelta}
										</TableCell>
										<TableCell className="text-right">
											{entry.resultingQuantity}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function PointsManager() {
	const [search, setSearch] = useState("");
	const matches =
		useAuthedQuery(
			api.points.searchMembersForManager,
			search.trim().length >= 2 ? { query: search.trim(), limit: 20 } : "skip",
		) ?? [];
	const [userId, setUserId] =
		useState<import("@convex/_generated/dataModel").Id<"users">>();
	const [amount, setAmount] = useState("");
	const [mode, setMode] = useState<"correction" | "spendable_only">(
		"spendable_only",
	);
	const [reason, setReason] = useState("");
	const [busy, setBusy] = useState(false);
	const accountResult = useAuthedQuery(
		api.points.getAccountForManager,
		userId ? { userId } : "skip",
	);
	const reconciliation = useAuthedQuery(api.points.reconcile, {
		paginationOpts: { numItems: 100, cursor: null },
	});
	const adjust = useAuthedMutation(api.points.adjust);
	const account = accountResult;
	const delta = Number(amount || 0);
	const nextBalance = (account?.balance ?? 0) + delta;
	const nextLifetime =
		(account?.lifetimeEarned ?? 0) + (mode === "correction" ? delta : 0);
	const mismatchCount = reconciliation?.mismatchCount ?? 0;
	const save = async () => {
		if (!userId) return;
		if (
			!window.confirm(
				`Apply ${delta > 0 ? "+" : ""}${delta} points? New spendable balance: ${nextBalance}.`,
			)
		)
			return;
		setBusy(true);
		try {
			await adjust({
				userId,
				amount: delta,
				mode,
				reason: reason.trim(),
				requestId: crypto.randomUUID(),
			});
			toast.success("Point ledger adjustment recorded");
			setAmount("");
			setReason("");
		} catch (error: any) {
			toast.error(error?.message ?? "Could not adjust points");
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className="mt-5 space-y-5">
			<div>
				<h2 className="text-xl font-semibold">Points</h2>
				<p className="text-sm text-muted-foreground">
					Adjust through the ledger—never overwrite balances. Every change
					requires a reason and actor.
				</p>
			</div>
			<div className="grid gap-5 lg:grid-cols-[1fr_320px]">
				<Card>
					<CardHeader>
						<CardTitle className="text-base">
							Member balance adjustment
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="relative">
							<Label htmlFor="member-search">Member</Label>
							<div className="relative mt-2">
								<Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
								<Input
									id="member-search"
									value={search}
									onChange={(e) => {
										setSearch(e.target.value);
										setUserId(undefined);
									}}
									className="pl-9"
									placeholder="Search name or email"
								/>
							</div>
							{!userId && matches.length > 0 && (
								<div className="absolute z-10 mt-1 max-h-60 w-[min(36rem,calc(100%-4rem))] overflow-auto rounded-md border bg-popover p-1 shadow-md">
									{matches.map((user) => (
										<button
											key={user._id}
											type="button"
											onClick={() => {
												setUserId(user._id);
												setSearch(user.name);
											}}
											className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
										>
											<span className="font-medium">{user.name}</span>
											<span className="block text-xs text-muted-foreground">
												{user.email}
											</span>
										</button>
									))}
								</div>
							)}
						</div>
						{account && (
							<div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-3 text-center">
								<div>
									<p className="text-xs text-muted-foreground">Spendable</p>
									<p className="text-xl font-semibold">
										{points(account.balance)}
									</p>
								</div>
								<div>
									<p className="text-xs text-muted-foreground">
										Lifetime earned
									</p>
									<p className="text-xl font-semibold">
										{points(account.lifetimeEarned)}
									</p>
								</div>
							</div>
						)}
						<Field label="Adjustment type">
							<RadioGroup
								value={mode}
								onValueChange={(value) => setMode(value as typeof mode)}
								className="grid gap-2 sm:grid-cols-2"
							>
								<Label
									htmlFor="spendable"
									className="rounded-lg border p-3 has-[[data-state=checked]]:border-primary"
								>
									<RadioGroupItem
										id="spendable"
										value="spendable_only"
										className="mr-2"
									/>
									<span className="font-medium">Spendable only</span>
									<span className="mt-1 block text-xs font-normal text-muted-foreground">
										Purchasing credit; lifetime stays unchanged.
									</span>
								</Label>
								<Label
									htmlFor="correction"
									className="rounded-lg border p-3 has-[[data-state=checked]]:border-primary"
								>
									<RadioGroupItem
										id="correction"
										value="correction"
										className="mr-2"
									/>
									<span className="font-medium">Correction</span>
									<span className="mt-1 block text-xs font-normal text-muted-foreground">
										Corrects spendable and lifetime totals.
									</span>
								</Label>
							</RadioGroup>
						</Field>
						<Field label="Signed amount">
							<Input
								type="number"
								step="1"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								placeholder="e.g. 20 or -10"
							/>
						</Field>
						{account && delta !== 0 && (
							<div className="grid grid-cols-2 gap-2 rounded-lg border p-3 text-center">
								<div>
									<p className="text-xs text-muted-foreground">New spendable</p>
									<p
										className={`font-semibold ${nextBalance < 0 ? "text-destructive" : ""}`}
									>
										{points(nextBalance)}
									</p>
								</div>
								<div>
									<p className="text-xs text-muted-foreground">New lifetime</p>
									<p
										className={`font-semibold ${nextLifetime < 0 ? "text-destructive" : ""}`}
									>
										{points(nextLifetime)}
									</p>
								</div>
							</div>
						)}
						<Field label="Required reason">
							<Textarea
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								placeholder="Explain why this adjustment is necessary"
							/>
						</Field>
						<Button
							disabled={
								busy ||
								!userId ||
								!Number.isSafeInteger(delta) ||
								delta === 0 ||
								nextBalance < 0 ||
								nextLifetime < 0 ||
								reason.trim().length < 3
							}
							onClick={save}
						>
							{busy ? "Recording…" : "Review & confirm adjustment"}
						</Button>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Ledger reconciliation</CardTitle>
						<CardDescription>
							Compares account summaries with append-only entries.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div
							className={`rounded-lg p-4 ${mismatchCount ? "bg-destructive/5" : "bg-green-50"}`}
						>
							<p className="text-2xl font-bold">{mismatchCount}</p>
							<p className="text-sm text-muted-foreground">
								account mismatches
							</p>
						</div>
						<Button variant="outline" className="w-full">
							<RefreshCw />
							Refresh report
						</Button>
						<p className="text-xs text-muted-foreground">
							Repairs must be entered as new reasoned adjustments; history is
							never rewritten.
						</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

function normalizeManagerPickups(result: any): PickupOption[] {
	if (Array.isArray(result)) return result;
	const map = (item: any, type: "event" | "slot"): PickupOption => ({
		_id: item._id ?? item.id ?? item.pickupEventId ?? item.slotId,
		type,
		name: item.name ?? item.eventName ?? item.label ?? "Project Space pickup",
		location: item.location ?? "EBU1-4710",
		startAt: item.startAt ?? item.startDate,
		remainingCapacity: item.remainingCapacity,
	});
	return [
		...(result?.events ?? []).map((x: any) => map(x, "event")),
		...(result?.slots ?? []).map((x: any) => map(x, "slot")),
	];
}
function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<Label>{label}</Label>
			{children}
		</div>
	);
}
function FilterSelect({
	value,
	onChange,
	items,
}: {
	value: string;
	onChange: (value: string) => void;
	items: string[];
}) {
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger className="w-full capitalize">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{items.map((item) => (
					<SelectItem key={item} value={item} className="capitalize">
						{item.replace("_", " ")}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
function Empty({ title, detail }: { title: string; detail: string }) {
	return (
		<div className="rounded-lg border border-dashed p-10 text-center">
			<p className="font-semibold">{title}</p>
			<p className="text-sm text-muted-foreground">{detail}</p>
		</div>
	);
}
function LoadingCards() {
	return (
		<div className="grid gap-4 md:grid-cols-2">
			<div className="h-40 animate-pulse rounded-xl bg-muted" />
			<div className="h-40 animate-pulse rounded-xl bg-muted" />
		</div>
	);
}
