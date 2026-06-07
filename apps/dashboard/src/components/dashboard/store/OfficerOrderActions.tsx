import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";

type OrderItem = {
	_id: Id<"merchOrderItems">;
	productName: string;
	variantLabel: string;
	quantity: number;
	status: string;
};

type OfficerOrder = {
	_id: Id<"merchOrders">;
	items: OrderItem[];
};

export function OfficerOrderActions({ order }: { order: OfficerOrder }) {
	const [reason, setReason] = useState("");
	const [refundQuantities, setRefundQuantities] = useState<
		Record<string, string>
	>({});
	const [busy, setBusy] = useState(false);

	const [subItemId, setSubItemId] = useState<Id<"merchOrderItems"> | "">("");
	const [releaseChoice, setReleaseChoice] = useState("");

	const issues = useAuthedQuery(api.merch.pickupIssues.listForOrder, {
		orderId: order._id,
	});
	const releases = useAuthedQuery(api.merch.products.listActiveReleases);
	const selectedRelease = useMemo(
		() => releases?.find((r) => r.releaseId === releaseChoice),
		[releases, releaseChoice],
	);
	const productDetail = useAuthedQuery(
		api.merch.products.getProductDetail,
		selectedRelease ? { productId: selectedRelease.productId } : "skip",
	);

	const refundOrderItems = useAuthedMutation(
		api.merch.refunds.refundOrderItems,
	);
	const refundFullOrder = useAuthedMutation(api.merch.refunds.refundFullOrder);
	const proposeSubstitution = useAuthedMutation(
		api.merch.substitutions.propose,
	);
	const resolveIssue = useAuthedMutation(api.merch.pickupIssues.officerResolve);

	const requireReason = () => {
		if (!reason.trim()) {
			toast.error("Enter a reason first");
			return false;
		}
		return true;
	};

	const handleRefundFull = async () => {
		if (!requireReason()) return;
		setBusy(true);
		try {
			await refundFullOrder({
				orderId: order._id,
				idempotencyKey: `refund-full:${order._id}:${crypto.randomUUID()}`,
				reason: reason.trim(),
			});
			toast.success("Full order refunded");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setBusy(false);
		}
	};

	const handleRefundItems = async () => {
		if (!requireReason()) return;
		const items = order.items
			.map((item) => ({
				orderItemId: item._id,
				quantity: Number(refundQuantities[item._id] ?? "0"),
			}))
			.filter((item) => item.quantity > 0);
		if (items.length === 0) {
			toast.error("Enter quantities to refund");
			return;
		}
		setBusy(true);
		try {
			await refundOrderItems({
				orderId: order._id,
				items,
				idempotencyKey: `refund-items:${order._id}:${crypto.randomUUID()}`,
				reason: reason.trim(),
			});
			toast.success("Items refunded");
			setRefundQuantities({});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setBusy(false);
		}
	};

	const handleProposeSubstitution = async (
		replacementVariantId: Id<"merchVariants">,
	) => {
		if (!subItemId) {
			toast.error("Select an item to substitute");
			return;
		}
		setBusy(true);
		try {
			await proposeSubstitution({
				orderItemId: subItemId,
				replacementVariantId,
				idempotencyKey: `sub:${subItemId}:${crypto.randomUUID()}`,
			});
			toast.success("Substitution proposed");
			setSubItemId("");
			setReleaseChoice("");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setBusy(false);
		}
	};

	const handleResolveIssue = async (
		issueId: Id<"merchPickupIssues">,
		status: "investigating" | "resolved" | "no_action",
	) => {
		setBusy(true);
		try {
			await resolveIssue({
				issueId,
				status,
				resolutionNote: reason.trim() || undefined,
			});
			toast.success("Issue updated");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setBusy(false);
		}
	};

	const activeVariants =
		productDetail?.releases
			.find((r) => r._id === selectedRelease?.releaseId)
			?.variants.filter((variant) => variant.enabled) ?? [];

	const openIssues = (issues ?? []).filter((issue) => issue.status === "open");

	return (
		<div className="mt-3 rounded-lg border bg-gray-50 p-4 space-y-4 text-sm">
			<div className="space-y-2">
				<Label className="text-xs">Reason (required for refunds)</Label>
				<Input
					value={reason}
					onChange={(e) => setReason(e.target.value)}
					placeholder="Reason for this action"
				/>
			</div>

			<div className="space-y-2">
				<p className="font-medium">Refund items</p>
				{order.items.map((item) => (
					<div
						key={item._id}
						className="flex items-center justify-between gap-3"
					>
						<span className="text-muted-foreground">
							{item.productName} ({item.variantLabel}) · {item.quantity} ·{" "}
							{item.status.replace(/_/g, " ")}
						</span>
						<Input
							type="number"
							min={0}
							max={item.quantity}
							className="w-20"
							value={refundQuantities[item._id] ?? ""}
							onChange={(e) =>
								setRefundQuantities((prev) => ({
									...prev,
									[item._id]: e.target.value,
								}))
							}
						/>
					</div>
				))}
				<div className="flex gap-2">
					<Button size="sm" disabled={busy} onClick={handleRefundItems}>
						Refund selected
					</Button>
					<Button
						size="sm"
						variant="outline"
						disabled={busy}
						onClick={handleRefundFull}
					>
						Refund full order
					</Button>
				</div>
			</div>

			<div className="space-y-2 border-t pt-3">
				<p className="font-medium">Propose substitution</p>
				<select
					className="w-full rounded-md border px-3 py-2 text-sm bg-white"
					value={subItemId}
					onChange={(e) =>
						setSubItemId(e.target.value as Id<"merchOrderItems"> | "")
					}
				>
					<option value="">Select item…</option>
					{order.items
						.filter(
							(item) =>
								item.status === "confirmed" ||
								item.status === "action_required",
						)
						.map((item) => (
							<option key={item._id} value={item._id}>
								{item.productName} ({item.variantLabel})
							</option>
						))}
				</select>
				{subItemId && (
					<>
						<select
							className="w-full rounded-md border px-3 py-2 text-sm bg-white"
							value={releaseChoice}
							onChange={(e) => setReleaseChoice(e.target.value)}
						>
							<option value="">Replacement product…</option>
							{(releases ?? []).map((release) => (
								<option key={release.releaseId} value={release.releaseId}>
									{release.productName}
								</option>
							))}
						</select>
						{selectedRelease && (
							<div className="flex flex-wrap gap-2">
								{activeVariants.map((variant) => {
									const available = Math.max(
										0,
										variant.onHand - variant.reserved,
									);
									return (
										<Button
											key={variant._id}
											size="sm"
											variant="outline"
											disabled={busy || available <= 0}
											onClick={() => handleProposeSubstitution(variant._id)}
										>
											{variant.label} ({available})
										</Button>
									);
								})}
							</div>
						)}
					</>
				)}
			</div>

			{openIssues.length > 0 && (
				<div className="space-y-2 border-t pt-3">
					<p className="font-medium">Open pickup issues</p>
					{openIssues.map((issue) => (
						<div
							key={issue._id}
							className="flex items-center justify-between gap-3"
						>
							<span className="text-muted-foreground">
								{issue.issueType.replace(/_/g, " ")}: {issue.description}
							</span>
							<div className="flex gap-1 shrink-0">
								<Button
									size="sm"
									variant="outline"
									disabled={busy}
									onClick={() => handleResolveIssue(issue._id, "resolved")}
								>
									Resolve
								</Button>
								<Button
									size="sm"
									variant="ghost"
									disabled={busy}
									onClick={() => handleResolveIssue(issue._id, "no_action")}
								>
									No action
								</Button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
