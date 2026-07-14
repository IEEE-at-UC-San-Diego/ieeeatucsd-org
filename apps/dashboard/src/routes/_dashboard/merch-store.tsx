import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	CalendarClock,
	Check,
	ChevronRight,
	Loader2,
	Minus,
	Package,
	Plus,
	RefreshCw,
	ShoppingBag,
	ShoppingCart,
	WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	cartTotal,
	loadCart,
	MERCH_CART_KEY,
	mergeCartLine,
	refreshCartFromCatalog,
	updateCartQuantity,
} from "@/components/dashboard/merch/cart";
import { OrderDetails } from "@/components/dashboard/merch/OrderDetails";
import type {
	CartLine,
	MerchOrder,
	MerchProduct,
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
	CardFooter,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";

export const Route = createFileRoute("/_dashboard/merch-store")({
	component: MerchStorePage,
});

function MerchStorePage() {
	const catalogResult = useAuthedQuery(api.merchCatalog.listActive);
	const accountResult = useAuthedQuery(api.points.getMyAccount);
	const pickupResult = useAuthedQuery(api.merchPickup.listAvailable);
	const settingsResult = useAuthedQuery(api.merchPickup.getSettings);
	const [ordersCursor, setOrdersCursor] = useState<string | null>(null);
	const [ordersCursorHistory, setOrdersCursorHistory] = useState<
		Array<string | null>
	>([]);
	const ordersResult = useAuthedQuery(api.merchOrders.listMine, {
		paginationOpts: { cursor: ordersCursor, numItems: 20 },
	});
	const checkout = useAuthedMutation(api.merchOrders.checkout);
	const cancelMine = useAuthedMutation(api.merchOrders.cancelMine);
	const [cart, setCart] = useState<CartLine[]>([]);
	const [hydrated, setHydrated] = useState(false);
	const [cartOpen, setCartOpen] = useState(false);
	const [checkoutOpen, setCheckoutOpen] = useState(false);
	const [checkoutStep, setCheckoutStep] = useState<
		"pickup" | "review" | "success"
	>("pickup");
	const [pickupId, setPickupId] = useState("");
	const [placing, setPlacing] = useState(false);
	const [idempotencyKey, setIdempotencyKey] = useState(() =>
		crypto.randomUUID(),
	);
	const [completedOrder, setCompletedOrder] = useState<MerchOrder>();
	const [selectedOrderId, setSelectedOrderId] = useState<MerchOrder["_id"]>();
	const [canceling, setCanceling] = useState(false);
	const [conflict, setConflict] = useState<{
		title: string;
		message: string;
		changes?: string[];
	}>();
	const selectedOrderResult = useAuthedQuery(
		api.merchOrders.getMine,
		selectedOrderId ? { orderId: selectedOrderId } : "skip",
	);

	useEffect(() => {
		setCart(loadCart(window.localStorage));
		setHydrated(true);
	}, []);
	useEffect(() => {
		if (hydrated)
			window.localStorage.setItem(MERCH_CART_KEY, JSON.stringify(cart));
	}, [cart, hydrated]);

	const products = (catalogResult ?? []) as MerchProduct[];
	const account = accountResult;
	const balance = account?.balance ?? 0;
	const lifetime = account?.lifetimeEarned ?? 0;
	const pickups: PickupOption[] = normalizePickups(pickupResult);
	const orders = (ordersResult?.page ?? []) as MerchOrder[];
	const total = cartTotal(cart);
	const selectedPickup = pickups.find((pickup) => pickup._id === pickupId);
	const selectedOrder =
		(selectedOrderResult as MerchOrder | undefined) ??
		orders.find((order) => order._id === selectedOrderId);

	const addVariant = (
		product: MerchProduct,
		variantId: Id<"merchVariants">,
	) => {
		const variant = product.variants.find((entry) => entry._id === variantId);
		if (!variant || variantStock(variant) < 1) return;
		setCart((current) =>
			mergeCartLine(current, {
				productId: product._id,
				variantId: variant._id,
				productName: product.name,
				variantName: variantLabel(variant),
				sku: variant.sku,
				imageUrl: product.imageUrl,
				unitPrice: variantPrice(variant),
				quantity: 1,
				productRevision: product.revision ?? 0,
				variantRevision: variant.revision ?? 0,
				availableStock: variantStock(variant),
				purchaseLimit: product.purchaseLimit,
			}),
		);
		toast.success(`${product.name} added to cart`);
	};

	const openCheckout = () => {
		setCartOpen(false);
		setCheckoutStep("pickup");
		setCheckoutOpen(true);
	};

	const placeOrder = async () => {
		if (!selectedPickup || placing) return;
		setPlacing(true);
		try {
			const result = await checkout({
				lines: cart.map((line) => ({
					productId: line.productId,
					variantId: line.variantId,
					quantity: line.quantity,
					expectedProductRevision: line.productRevision,
					expectedVariantRevision: line.variantRevision,
					expectedUnitPrice: line.unitPrice,
				})),
				pickup:
					selectedPickup.type === "event"
						? {
								type: "event" as const,
								pickupEventId:
									selectedPickup._id as import("@convex/_generated/dataModel").Id<"merchPickupEvents">,
							}
						: {
								type: "slot" as const,
								pickupSlotId:
									selectedPickup._id as import("@convex/_generated/dataModel").Id<"merchPickupSlots">,
							},
				idempotencyKey,
			});
			const order = result as MerchOrder;
			setCompletedOrder(order);
			setCart([]);
			setCheckoutStep("success");
			setIdempotencyKey(crypto.randomUUID());
			toast.success(`Order ${order.orderNumber ?? "placed"} successfully`);
		} catch (error: any) {
			const data = error?.data ?? error;
			const rawMessage = String(data?.message ?? error?.message ?? "");
			const kind =
				data?.code ??
				data?.kind ??
				["STALE_CART", "OUT_OF_STOCK", "PURCHASE_LIMIT"].find((code) =>
					rawMessage.includes(code),
				);
			if (
				[
					"STALE_CART",
					"PRICE_CHANGED",
					"OUT_OF_STOCK",
					"PICKUP_FULL",
					"PURCHASE_LIMIT",
				].includes(kind)
			) {
				setConflict({
					title:
						kind === "PRICE_CHANGED" || kind === "STALE_CART"
							? "Your cart changed"
							: "Availability changed",
					message:
						data?.message ??
						"The store changed while your cart was open. Review the updates before retrying.",
					changes:
						kind === "STALE_CART"
							? [
									`${data.sku}: price ${points(data.expected?.unitPrice ?? 0)} → ${points(data.current?.unitPrice ?? 0)}`,
									`Product revision ${data.expected?.productRevision ?? "—"} → ${data.current?.productRevision ?? "—"}`,
									`Variant revision ${data.expected?.variantRevision ?? "—"} → ${data.current?.variantRevision ?? "—"}; ${data.current?.stockOnHand ?? 0} now in stock`,
								]
							: kind === "PURCHASE_LIMIT"
								? [
										`${data.productName}: limit ${data.purchaseLimit}; ${data.previouslyPurchased} previously purchased; ${data.remainingQuantity} remaining`,
									]
								: kind === "OUT_OF_STOCK"
									? [
											`${data.sku}: requested ${data.requestedQuantity}; ${data.stockOnHand} now in stock`,
										]
									: data?.changes,
				});
			} else toast.error(error?.message ?? "Could not place order");
		} finally {
			setPlacing(false);
		}
	};

	const cancelOrder = async () => {
		if (!selectedOrder) return;
		if (
			!window.confirm(
				`Cancel ${selectedOrder.orderNumber}? Its exact point cost will be refunded.`,
			)
		)
			return;
		setCanceling(true);
		try {
			await cancelMine({
				orderId: selectedOrder._id,
				requestId: crypto.randomUUID(),
			});
			toast.success("Order canceled and points refunded");
			setSelectedOrderId(undefined);
		} catch (error: any) {
			toast.error(error?.message ?? "Could not cancel order");
		} finally {
			setCanceling(false);
		}
	};

	return (
		<div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
			<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Merch Store</h1>
					<p className="text-muted-foreground">
						Turn the points you earn into IEEE at UCSD gear.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Card className="py-3">
						<CardContent className="flex items-center gap-3 px-4">
							<WalletCards className="size-5 text-primary" />
							<div>
								<p className="text-xs text-muted-foreground">Spendable</p>
								<p className="font-semibold">
									{accountResult === undefined ? "—" : points(balance)}
								</p>
							</div>
							<Separator orientation="vertical" className="h-8" />
							<div>
								<p className="text-xs text-muted-foreground">Lifetime</p>
								<p className="font-semibold">
									{accountResult === undefined ? "—" : points(lifetime)}
								</p>
							</div>
						</CardContent>
					</Card>
					<Button size="lg" onClick={() => setCartOpen(true)}>
						<ShoppingCart className="size-4" /> Cart (
						{cart.reduce((sum, line) => sum + line.quantity, 0)})
					</Button>
				</div>
			</div>
			{settingsResult &&
				(!settingsResult.storeEnabled || !settingsResult.checkoutEnabled) && (
					<div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
						<AlertTriangle className="mt-0.5 size-5 shrink-0" />
						<div>
							<p className="font-semibold">
								{settingsResult.storeEnabled
									? "Store preview mode"
									: "Merch store is currently closed"}
							</p>
							<p className="text-sm">
								{settingsResult.storeEnabled
									? "Browse the catalog now; checkout will open soon."
									: "Purchases are not currently available."}
							</p>
						</div>
					</div>
				)}

			<Tabs defaultValue="shop">
				<TabsList>
					<TabsTrigger value="shop">Shop</TabsTrigger>
					<TabsTrigger value="orders">
						My Orders{orders.length ? ` (${orders.length})` : ""}
					</TabsTrigger>
				</TabsList>
				<TabsContent value="shop" className="mt-6">
					{catalogResult === undefined ? (
						<CatalogSkeleton />
					) : products.length ? (
						<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
							{products.map((product) => (
								<ProductCard
									key={product._id}
									product={product}
									onAdd={addVariant}
								/>
							))}
						</div>
					) : (
						<EmptyState
							icon={ShoppingBag}
							title="The store is being stocked"
							detail="Check back soon for new IEEE at UCSD merchandise."
						/>
					)}
				</TabsContent>
				<TabsContent value="orders" className="mt-6">
					{ordersResult === undefined ? (
						<div className="space-y-3">
							<Skeleton className="h-28" />
							<Skeleton className="h-28" />
						</div>
					) : orders.length ? (
						<div className="space-y-3">
							{orders.map((order) => (
								<button
									key={order._id}
									type="button"
									onClick={() => setSelectedOrderId(order._id)}
									className="flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50"
								>
									<Package className="size-9 rounded-lg bg-primary/10 p-2 text-primary" />
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-semibold">{order.orderNumber}</p>
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
											{order.pickupHealth &&
												order.pickupHealth !== "scheduled" && (
													<Badge variant="outline" className="capitalize">
														{order.pickupHealth.replace("_", " ")}
													</Badge>
												)}
										</div>
										<p className="truncate text-sm text-muted-foreground">
											{order.lines
												.map((line) => `${line.quantity}× ${line.productName}`)
												.join(", ")}
										</p>
										<p className="text-xs text-muted-foreground">
											{pacificDateTime(order.createdAt)} PT
										</p>
									</div>
									<p className="font-semibold">
										{points(order.totalPoints ?? order.total ?? 0)}
									</p>
									<ChevronRight className="size-4 text-muted-foreground" />
								</button>
							))}
							<div className="flex justify-end gap-2 pt-2">
								<Button
									variant="outline"
									disabled={ordersCursorHistory.length === 0}
									onClick={() => {
										const previous = ordersCursorHistory.at(-1) ?? null;
										setOrdersCursorHistory((history) => history.slice(0, -1));
										setOrdersCursor(previous);
									}}
								>
									Previous
								</Button>
								<Button
									variant="outline"
									disabled={ordersResult.isDone}
									onClick={() => {
										if (ordersResult.isDone) return;
										setOrdersCursorHistory((history) => [
											...history,
											ordersCursor,
										]);
										setOrdersCursor(ordersResult.continueCursor);
									}}
								>
									Next
								</Button>
							</div>
						</div>
					) : (
						<EmptyState
							icon={Package}
							title="No orders yet"
							detail="Your receipts and pickup codes will appear here."
						/>
					)}
				</TabsContent>
			</Tabs>

			<CartSheet
				open={cartOpen}
				onOpenChange={setCartOpen}
				cart={cart}
				total={total}
				balance={balance}
				checkoutEnabled={Boolean(
					settingsResult?.storeEnabled && settingsResult.checkoutEnabled,
				)}
				onQuantity={(id, quantity) =>
					setCart((current) => updateCartQuantity(current, id, quantity))
				}
				onCheckout={openCheckout}
			/>
			<CheckoutDialog
				open={checkoutOpen}
				onOpenChange={setCheckoutOpen}
				step={checkoutStep}
				setStep={setCheckoutStep}
				cart={cart}
				total={total}
				balance={balance}
				pickups={pickups}
				pickupId={pickupId}
				setPickupId={setPickupId}
				selectedPickup={selectedPickup}
				onSubmit={placeOrder}
				placing={placing}
				completedOrder={completedOrder}
			/>
			<Dialog
				open={Boolean(selectedOrderId)}
				onOpenChange={(open) => !open && setSelectedOrderId(undefined)}
			>
				<DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
					{selectedOrder ? (
						<OrderDetails
							order={selectedOrder}
							onCancel={cancelOrder}
							canceling={canceling}
						/>
					) : (
						<div className="flex h-48 items-center justify-center">
							<Loader2 className="size-6 animate-spin" />
						</div>
					)}
				</DialogContent>
			</Dialog>
			<Dialog
				open={Boolean(conflict)}
				onOpenChange={(open) => !open && setConflict(undefined)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="size-5 text-amber-600" />
							{conflict?.title}
						</DialogTitle>
						<DialogDescription>{conflict?.message}</DialogDescription>
					</DialogHeader>
					{conflict?.changes?.length ? (
						<ul className="list-disc space-y-1 pl-5 text-sm">
							{conflict.changes.map((change) => (
								<li key={change}>{change}</li>
							))}
						</ul>
					) : null}
					<DialogFooter>
						<Button variant="outline" onClick={() => setConflict(undefined)}>
							Keep editing
						</Button>
						<Button
							onClick={() => {
								setCart((current) => refreshCartFromCatalog(current, products));
								setConflict(undefined);
								setCheckoutStep("pickup");
							}}
						>
							<RefreshCw className="size-4" />
							Apply current prices
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ProductCard({
	product,
	onAdd,
}: {
	product: MerchProduct;
	onAdd: (product: MerchProduct, variantId: Id<"merchVariants">) => void;
}) {
	const active = product.variants.filter((variant) => variant.active !== false);
	const [variantId, setVariantId] = useState(active[0]?._id ?? "");
	const variant = active.find((entry) => entry._id === variantId);
	const prices = active.map(variantPrice);
	const min = Math.min(...prices);
	const max = Math.max(...prices);
	return (
		<Card className="overflow-hidden pt-0">
			<div className="aspect-[4/3] bg-muted">
				{product.imageUrl ? (
					<img
						src={product.imageUrl}
						alt={product.name}
						className="size-full object-cover"
					/>
				) : (
					<div className="flex size-full items-center justify-center">
						<ShoppingBag className="size-14 text-muted-foreground/50" />
					</div>
				)}
			</div>
			<CardHeader>
				<div className="flex items-start justify-between gap-3">
					<CardTitle>{product.name}</CardTitle>
					<p className="shrink-0 font-semibold text-primary">
						{min === max ? points(min) : `${min}–${max} pts`}
					</p>
				</div>
				<p className="line-clamp-2 text-sm text-muted-foreground">
					{product.description}
				</p>
				{product.purchaseLimit ? (
					<Badge variant="outline" className="w-fit">
						Limit {product.purchaseLimit} per member
					</Badge>
				) : null}
			</CardHeader>
			<CardContent className="space-y-2">
				<Label htmlFor={`variant-${product._id}`}>Variant</Label>
				<Select
					value={variantId}
					onValueChange={(value) => setVariantId(value as Id<"merchVariants">)}
				>
					<SelectTrigger id={`variant-${product._id}`} className="w-full">
						<SelectValue placeholder="Choose a variant" />
					</SelectTrigger>
					<SelectContent>
						{active.map((entry) => (
							<SelectItem
								key={entry._id}
								value={entry._id}
								disabled={variantStock(entry) < 1}
							>
								{variantLabel(entry)} · {points(variantPrice(entry))}
								{variantStock(entry) < 1
									? " · Sold out"
									: variantStock(entry) <= 5
										? ` · ${variantStock(entry)} left`
										: ""}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</CardContent>
			<CardFooter>
				<Button
					className="w-full"
					disabled={!variant || variantStock(variant) < 1}
					onClick={() => onAdd(product, variantId)}
				>
					{variant && variantStock(variant) < 1 ? "Sold out" : "Add to cart"}
				</Button>
			</CardFooter>
		</Card>
	);
}

function CartSheet({
	open,
	onOpenChange,
	cart,
	total,
	balance,
	checkoutEnabled,
	onQuantity,
	onCheckout,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	cart: CartLine[];
	total: number;
	balance: number;
	checkoutEnabled: boolean;
	onQuantity: (id: Id<"merchVariants">, quantity: number) => void;
	onCheckout: () => void;
}) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="flex w-full flex-col sm:max-w-md">
				<SheetHeader>
					<SheetTitle>Your cart</SheetTitle>
					<SheetDescription>
						Inventory and pricing are rechecked at checkout.
					</SheetDescription>
				</SheetHeader>
				<ScrollArea className="min-h-0 flex-1 px-4">
					{cart.length ? (
						<div className="space-y-4 py-2">
							{cart.map((line) => (
								<div key={line.variantId} className="flex gap-3">
									{line.imageUrl ? (
										<img
											src={line.imageUrl}
											alt=""
											className="size-16 rounded-md border object-cover"
										/>
									) : (
										<div className="size-16 rounded-md bg-muted" />
									)}
									<div className="min-w-0 flex-1">
										<p className="font-medium">{line.productName}</p>
										<p className="text-sm text-muted-foreground">
											{line.variantName}
										</p>
										<p className="text-sm">{points(line.unitPrice)} each</p>
										<div className="mt-2 flex items-center gap-2">
											<Button
												size="icon"
												variant="outline"
												className="size-7"
												onClick={() =>
													onQuantity(line.variantId, line.quantity - 1)
												}
												aria-label={`Remove one ${line.productName}`}
											>
												<Minus />
											</Button>
											<Input
												className="h-7 w-14 text-center"
												inputMode="numeric"
												value={line.quantity}
												onChange={(event) =>
													onQuantity(line.variantId, Number(event.target.value))
												}
												aria-label={`${line.productName} quantity`}
											/>
											<Button
												size="icon"
												variant="outline"
												className="size-7"
												disabled={
													line.quantity >=
													Math.min(
														line.availableStock,
														line.purchaseLimit ?? Infinity,
													)
												}
												onClick={() =>
													onQuantity(line.variantId, line.quantity + 1)
												}
												aria-label={`Add one ${line.productName}`}
											>
												<Plus />
											</Button>
										</div>
									</div>
									<p className="font-medium">
										{points(line.unitPrice * line.quantity)}
									</p>
								</div>
							))}
						</div>
					) : (
						<EmptyState
							icon={ShoppingCart}
							title="Your cart is empty"
							detail="Add a variant from the store to get started."
						/>
					)}
				</ScrollArea>
				<div className="space-y-3 border-t p-4">
					<div className="flex justify-between">
						<span>Total</span>
						<span className="font-semibold">{points(total)}</span>
					</div>
					<div className="flex justify-between text-sm text-muted-foreground">
						<span>Balance after purchase</span>
						<span
							className={
								balance - total < 0 ? "font-semibold text-destructive" : ""
							}
						>
							{points(balance - total)}
						</span>
					</div>
					<Button
						className="w-full"
						size="lg"
						disabled={!cart.length || total > balance || !checkoutEnabled}
						onClick={onCheckout}
					>
						{!checkoutEnabled
							? "Checkout is not open"
							: total > balance
								? "Not enough points"
								: "Choose pickup"}
						<ChevronRight />
					</Button>
				</div>
			</SheetContent>
		</Sheet>
	);
}

function CheckoutDialog(props: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	step: "pickup" | "review" | "success";
	setStep: (step: "pickup" | "review" | "success") => void;
	cart: CartLine[];
	total: number;
	balance: number;
	pickups: PickupOption[];
	pickupId: string;
	setPickupId: (id: string) => void;
	selectedPickup?: PickupOption;
	onSubmit: () => void;
	placing: boolean;
	completedOrder?: MerchOrder;
}) {
	const eventPickups = props.pickups.filter(
		(pickup) => pickup.type === "event",
	);
	const slots = props.pickups.filter((pickup) => pickup.type === "slot");
	return (
		<Dialog
			open={props.open}
			onOpenChange={(open) => {
				if (!props.placing) props.onOpenChange(open);
			}}
		>
			<DialogContent
				className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"
				showCloseButton={!props.placing}
			>
				{props.step === "pickup" && (
					<>
						<DialogHeader>
							<DialogTitle>Choose pickup</DialogTitle>
							<DialogDescription>
								All times are shown in Pacific Time. Options at capacity cannot
								be selected.
							</DialogDescription>
						</DialogHeader>
						{props.pickups.length ? (
							<RadioGroup
								value={props.pickupId}
								onValueChange={props.setPickupId}
								className="space-y-5"
							>
								<PickupGroup title="Upcoming events" options={eventPickups} />
								<PickupGroup title="IEEE Project Space" options={slots} />
							</RadioGroup>
						) : (
							<div className="rounded-lg border border-dashed p-8 text-center">
								<CalendarClock className="mx-auto mb-3 size-9 text-muted-foreground" />
								<p className="font-medium">No pickup times available</p>
								<p className="text-sm text-muted-foreground">
									A store manager needs to publish a future pickup option.
								</p>
							</div>
						)}
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => props.onOpenChange(false)}
							>
								Back to cart
							</Button>
							<Button
								disabled={!props.pickupId}
								onClick={() => props.setStep("review")}
							>
								Review order
								<ChevronRight />
							</Button>
						</DialogFooter>
					</>
				)}
				{props.step === "review" && (
					<>
						<DialogHeader>
							<DialogTitle>Review your order</DialogTitle>
							<DialogDescription>
								Prices, inventory, balance, limits, and pickup capacity are
								verified when you place the order.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-3">
							{props.cart.map((line) => (
								<div
									key={line.variantId}
									className="flex justify-between text-sm"
								>
									<span>
										{line.quantity}× {line.productName} · {line.variantName}
									</span>
									<span className="font-medium">
										{points(line.quantity * line.unitPrice)}
									</span>
								</div>
							))}
							<Separator />
							<div className="flex justify-between font-semibold">
								<span>Total</span>
								<span>{points(props.total)}</span>
							</div>
							<div className="flex justify-between text-sm">
								<span>Balance after order</span>
								<span>{points(props.balance - props.total)}</span>
							</div>
							<div className="rounded-lg bg-muted p-3 text-sm">
								<p className="font-medium">{props.selectedPickup?.name}</p>
								<p>{pacificDateTime(props.selectedPickup?.startAt)} PT</p>
								<p className="text-muted-foreground">
									{props.selectedPickup?.location}
								</p>
							</div>
							<p className="text-xs text-muted-foreground">
								You may cancel while this order is pending and before its pickup
								cutoff. Cancellation returns the exact purchase cost and
								reserved inventory.
							</p>
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								disabled={props.placing}
								onClick={() => props.setStep("pickup")}
							>
								Change pickup
							</Button>
							<Button disabled={props.placing} onClick={props.onSubmit}>
								{props.placing ? (
									<>
										<Loader2 className="animate-spin" />
										Placing order…
									</>
								) : (
									<>Place order · {points(props.total)}</>
								)}
							</Button>
						</DialogFooter>
					</>
				)}
				{props.step === "success" && props.completedOrder && (
					<>
						<DialogHeader>
							<div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-green-100">
								<Check className="size-7 text-green-700" />
							</div>
							<DialogTitle className="text-center">Order placed</DialogTitle>
							<DialogDescription className="text-center">
								Your points, inventory, and pickup reservation are confirmed.
							</DialogDescription>
						</DialogHeader>
						<OrderDetails order={props.completedOrder} />
						<DialogFooter>
							<Button
								className="w-full"
								onClick={() => props.onOpenChange(false)}
							>
								Done
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

function PickupGroup({
	title,
	options,
}: {
	title: string;
	options: PickupOption[];
}) {
	if (!options.length) return null;
	return (
		<div className="space-y-2">
			<p className="text-sm font-semibold">{title}</p>
			{options.map((pickup) => {
				const full =
					(pickup.remainingCapacity ??
						(pickup.capacity ?? Infinity) - (pickup.bookedCount ?? 0)) <= 0;
				return (
					<Label
						key={pickup._id}
						htmlFor={`pickup-${pickup._id}`}
						className={`flex items-start gap-3 rounded-lg border p-3 ${full ? "opacity-50" : "cursor-pointer has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"}`}
					>
						<RadioGroupItem
							id={`pickup-${pickup._id}`}
							value={pickup._id}
							disabled={full}
							className="mt-1"
						/>
						<div className="flex-1">
							<div className="flex justify-between gap-2">
								<p className="font-medium">{pickup.name}</p>
								{full ? (
									<Badge variant="destructive">Full</Badge>
								) : pickup.remainingCapacity != null &&
									pickup.remainingCapacity <= 5 ? (
									<Badge variant="outline">
										{pickup.remainingCapacity} left
									</Badge>
								) : null}
							</div>
							<p className="font-normal">
								{pacificDateTime(pickup.startAt)} PT
							</p>
							<p className="font-normal text-muted-foreground">
								{pickup.location}
							</p>
							{pickup.cutoffAt ? (
								<p className="mt-1 text-xs font-normal text-muted-foreground">
									Book by {pacificDateTime(pickup.cutoffAt)} PT
								</p>
							) : null}
						</div>
					</Label>
				);
			})}
		</div>
	);
}

function normalizePickups(
	result:
		| {
				events: Array<{
					id: string;
					label: string;
					address: string;
					startAt: number;
					endAt: number;
					cutoffAt: number;
					capacity?: number;
					remainingCapacity?: number;
				}>;
				slots: Array<{
					id: string;
					label: string;
					address: string;
					startAt: number;
					endAt: number;
					capacity?: number;
					remainingCapacity?: number;
				}>;
		  }
		| undefined,
): PickupOption[] {
	if (!result) return [];
	return [
		...result.events.map((item) => ({
			_id: item.id as import("@convex/_generated/dataModel").Id<"merchPickupEvents">,
			type: "event" as const,
			name: item.label,
			location: item.address,
			startAt: item.startAt,
			endAt: item.endAt,
			cutoffAt: item.cutoffAt,
			capacity: item.capacity,
			remainingCapacity: item.remainingCapacity,
		})),
		...result.slots.map((item) => ({
			_id: item.id as import("@convex/_generated/dataModel").Id<"merchPickupSlots">,
			type: "slot" as const,
			name: item.label,
			location: item.address,
			startAt: item.startAt,
			endAt: item.endAt,
			capacity: item.capacity,
			remainingCapacity: item.remainingCapacity,
		})),
	];
}

function EmptyState({
	icon: Icon,
	title,
	detail,
}: {
	icon: typeof Package;
	title: string;
	detail: string;
}) {
	return (
		<div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
			<Icon className="mb-3 size-10 text-muted-foreground" />
			<p className="font-semibold">{title}</p>
			<p className="max-w-sm text-sm text-muted-foreground">{detail}</p>
		</div>
	);
}
function CatalogSkeleton() {
	return (
		<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
			{[0, 1, 2].map((key) => (
				<Card key={key} className="overflow-hidden pt-0">
					<Skeleton className="aspect-[4/3] rounded-none" />
					<CardContent className="space-y-3 p-5">
						<Skeleton className="h-5 w-2/3" />
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-9 w-full" />
						<Skeleton className="h-9 w-full" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}
