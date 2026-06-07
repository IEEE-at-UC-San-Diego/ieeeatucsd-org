import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { NAVIGATION_PATHS } from "@/config/navigation";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute(
	"/_dashboard/manage-store/pickup/$pickupId",
)({
	component: PickupModePage,
});

function formatDateTime(ms: number) {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: "America/Los_Angeles",
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(ms));
}

function PickupModePage() {
	const { pickupId } = Route.useParams();
	const { hasOfficerAccess, logtoId } = usePermissions();
	const [lookup, setLookup] = useState("");
	const [activeLookup, setActiveLookup] = useState("");
	const [lateNote, setLateNote] = useState("");
	const [codeOverrideReason, setCodeOverrideReason] = useState("");
	const [fulfilling, setFulfilling] = useState(false);
	const [selectedItems, setSelectedItems] = useState<Record<string, number>>(
		{},
	);

	const pickupData = useAuthedQuery(
		api.merch.pickups.listPickupOptions,
		logtoId ? { logtoId } : "skip",
	);

	const order = useAuthedQuery(
		api.merch.fulfillment.lookupOrderForPickup,
		logtoId && activeLookup
			? { logtoId, pickupOptionId: pickupId, lookup: activeLookup }
			: "skip",
	);

	const recordPickup = useAuthedMutation(api.merch.fulfillment.recordPickup);

	const pickupOption = useMemo(
		() => pickupData?.options.find((option) => option._id === pickupId),
		[pickupData, pickupId],
	);

	if (!hasOfficerAccess) {
		return (
			<div className="p-8 text-muted-foreground">Officer access required.</div>
		);
	}

	const handleLookup = () => {
		const trimmed = lookup.trim();
		if (!trimmed) {
			toast.error(
				"Enter a pickup code, QR token, order number, or member name.",
			);
			return;
		}
		setActiveLookup(trimmed);
		setSelectedItems({});
	};

	const toggleItem = (itemId: string, maxQty: number) => {
		setSelectedItems((prev) => {
			if (prev[itemId]) {
				const next = { ...prev };
				delete next[itemId];
				return next;
			}
			return { ...prev, [itemId]: maxQty };
		});
	};

	const handleFulfill = async (allItems: boolean) => {
		if (!order) return;
		setFulfilling(true);
		try {
			const partialItems = allItems
				? undefined
				: Object.entries(selectedItems).map(([orderItemId, quantity]) => ({
						orderItemId: orderItemId as Id<"merchOrderItems">,
						quantity,
					}));

			if (!allItems && (!partialItems || partialItems.length === 0)) {
				toast.error("Select at least one item to fulfill.");
				return;
			}

			await recordPickup({
				orderId: order._id,
				idempotencyKey: crypto.randomUUID(),
				partialItems,
				lateRecordingNote: lateNote.trim() || undefined,
				codeUnavailableReason: codeOverrideReason.trim() || undefined,
			});
			toast.success("Pickup recorded.");
			setActiveLookup("");
			setLookup("");
			setSelectedItems({});
			setLateNote("");
			setCodeOverrideReason("");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setFulfilling(false);
		}
	};

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-lg mx-auto px-4 py-6 space-y-6 pb-24">
				<div>
					<Link
						to={NAVIGATION_PATHS.MANAGE_STORE_PICKUPS}
						className="text-sm text-muted-foreground hover:underline"
					>
						← Back to pickups
					</Link>
					<h1 className="text-2xl font-bold mt-2">Pickup mode</h1>
					{pickupOption ? (
						<p className="text-sm text-muted-foreground mt-1">
							{pickupOption.label} · {formatDateTime(pickupOption.windowStart)}
						</p>
					) : (
						<p className="text-sm text-muted-foreground mt-1">
							Pickup window {pickupId}
						</p>
					)}
				</div>

				<section className="rounded-xl border bg-white p-4 space-y-3">
					<Label>Scan or enter code</Label>
					<div className="flex gap-2">
						<Input
							className="text-lg tracking-widest uppercase"
							placeholder="Pickup code or lookup"
							value={lookup}
							onChange={(e) => setLookup(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && handleLookup()}
							autoComplete="off"
						/>
						<Button type="button" onClick={handleLookup}>
							<Search className="h-4 w-4" />
						</Button>
					</div>
					<div className="space-y-2">
						<Label>Code unavailable reason (optional)</Label>
						<Input
							value={codeOverrideReason}
							onChange={(e) => setCodeOverrideReason(e.target.value)}
							placeholder="Required if fulfilling without a valid code"
						/>
					</div>
				</section>

				{activeLookup && order === undefined && (
					<Skeleton className="h-48 w-full" />
				)}

				{activeLookup && order === null && (
					<p className="text-sm text-muted-foreground text-center py-8">
						No order found for this pickup window.
					</p>
				)}

				{order && (
					<section className="rounded-xl border bg-white p-4 space-y-4">
						<div>
							<div className="flex items-center justify-between gap-2">
								<p className="font-semibold text-lg">{order.displayNumber}</p>
								<Badge>{order.status.replaceAll("_", " ")}</Badge>
							</div>
							<p className="text-sm text-muted-foreground">
								{order.member?.name} · Code {order.pickupCode}
							</p>
						</div>

						<ul className="space-y-2 divide-y">
							{order.items.map((item) => {
								const remaining = item.remainingQuantity;
								const selected = selectedItems[item._id];
								if (remaining <= 0) {
									return (
										<li key={item._id} className="py-3 opacity-60">
											<div className="flex items-center gap-2">
												<Check className="h-4 w-4 text-green-600" />
												<span className="text-sm">
													{item.productName} ({item.variantLabel}) — fulfilled
												</span>
											</div>
										</li>
									);
								}
								return (
									<li key={item._id} className="py-3">
										<button
											type="button"
											className={`w-full text-left rounded-lg border p-3 transition ${
												selected
													? "border-primary bg-primary/5"
													: "border-transparent"
											}`}
											onClick={() => toggleItem(item._id, remaining)}
										>
											<p className="font-medium text-sm">{item.productName}</p>
											<p className="text-xs text-muted-foreground">
												{item.variantLabel} · {remaining} of {item.quantity}{" "}
												remaining
											</p>
										</button>
									</li>
								);
							})}
						</ul>

						<div className="space-y-2">
							<Label>Late recording note (optional)</Label>
							<Textarea
								value={lateNote}
								onChange={(e) => setLateNote(e.target.value)}
								placeholder="Note if recording pickup after the scheduled window"
							/>
						</div>

						<div className="grid gap-2">
							<Button
								className="w-full h-12 text-base"
								disabled={fulfilling}
								onClick={() => handleFulfill(true)}
							>
								{fulfilling ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									"Fulfill all remaining items"
								)}
							</Button>
							<Button
								variant="outline"
								className="w-full h-12"
								disabled={fulfilling}
								onClick={() => handleFulfill(false)}
							>
								Fulfill selected items
							</Button>
						</div>
					</section>
				)}
			</main>
		</div>
	);
}
