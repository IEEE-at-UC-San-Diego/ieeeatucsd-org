import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2, MapPin, Package, QrCode } from "lucide-react";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/store/orders/$orderId")({
	loader: (ctx) => {
		const { orderId } = ctx.params;
		prefetchAuthedQuery(
			api.merch.orders.getOrder,
			{ orderId: orderId as Id<"merchOrders"> },
			ctx,
		);
	},
	component: StoreOrderDetailPage,
});

function statusLabel(status: string) {
	return status.replace(/_/g, " ");
}

function StoreOrderDetailPage() {
	const { orderId } = Route.useParams();
	const orderData = useAuthedQuery(api.merch.orders.getOrder, {
		orderId: orderId as Id<"merchOrders">,
	});
	const pickupOptions = useAuthedQuery(
		api.merch.checkout.listCompatiblePickupOptions,
	);
	const cancelOrder = useAuthedMutation(api.merch.orders.cancelOrder);
	const changePickup = useAuthedMutation(api.merch.orders.changePickup);
	const substitutions = useAuthedQuery(api.merch.substitutions.listForOrder, {
		orderId: orderId as Id<"merchOrders">,
	});
	const issues = useAuthedQuery(api.merch.pickupIssues.listForOrder, {
		orderId: orderId as Id<"merchOrders">,
	});
	const acceptSubstitution = useAuthedMutation(api.merch.substitutions.accept);
	const declineSubstitution = useAuthedMutation(api.merch.substitutions.decline);
	const reportIssue = useAuthedMutation(api.merch.pickupIssues.memberReport);

	const [newPickupOptionId, setNewPickupOptionId] = useState("");
	const [canceling, setCanceling] = useState(false);
	const [changingPickup, setChangingPickup] = useState(false);
	const [respondingId, setRespondingId] =
		useState<Id<"merchSubstitutionProposals"> | null>(null);
	const [showReportForm, setShowReportForm] = useState(false);
	const [issueType, setIssueType] = useState("missing_item");
	const [issueDescription, setIssueDescription] = useState("");
	const [issueItemIds, setIssueItemIds] = useState<Id<"merchOrderItems">[]>([]);
	const [reporting, setReporting] = useState(false);

	if (orderData === undefined) {
		return (
			<div className="p-8 space-y-4 max-w-3xl mx-auto">
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-48 w-full" />
			</div>
		);
	}

	const { order, items, auditLog } = orderData;

	const pendingProposals = (substitutions ?? []).filter(
		(proposal) => proposal.status === "pending",
	);

	const handleAcceptSubstitution = async (
		proposalId: Id<"merchSubstitutionProposals">,
	) => {
		setRespondingId(proposalId);
		try {
			await acceptSubstitution({
				proposalId,
				idempotencyKey: `sub-accept:${proposalId}:${crypto.randomUUID()}`,
			});
			toast.success("Substitution accepted");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setRespondingId(null);
		}
	};

	const handleDeclineSubstitution = async (
		proposalId: Id<"merchSubstitutionProposals">,
	) => {
		setRespondingId(proposalId);
		try {
			await declineSubstitution({
				proposalId,
				idempotencyKey: `sub-decline:${proposalId}:${crypto.randomUUID()}`,
			});
			toast.success("Substitution declined");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setRespondingId(null);
		}
	};

	const handleReportIssue = async () => {
		if (issueItemIds.length === 0) {
			toast.error("Select at least one item");
			return;
		}
		if (!issueDescription.trim()) {
			toast.error("Describe the problem");
			return;
		}
		setReporting(true);
		try {
			await reportIssue({
				orderId: order._id,
				orderItemIds: issueItemIds,
				issueType: issueType as
					| "missing_item"
					| "wrong_variant"
					| "damaged_item"
					| "pickup_marked_incorrectly"
					| "other",
				description: issueDescription.trim(),
			});
			toast.success("Problem reported");
			setShowReportForm(false);
			setIssueDescription("");
			setIssueItemIds([]);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to report");
		} finally {
			setReporting(false);
		}
	};

	const handleCancel = async () => {
		setCanceling(true);
		try {
			const result = await cancelOrder({
				orderId: order._id,
				idempotencyKey: `cancel:${order._id}:${crypto.randomUUID()}`,
			});
			toast.success(
				result.refundTotal > 0
					? `Order canceled. ${result.refundTotal} pts refunded.`
					: "Order canceled.",
			);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to cancel order",
			);
		} finally {
			setCanceling(false);
		}
	};

	const handleChangePickup = async () => {
		if (!newPickupOptionId) {
			toast.error("Select a pickup option");
			return;
		}
		setChangingPickup(true);
		try {
			await changePickup({
				orderId: order._id,
				pickupOptionId: newPickupOptionId,
				idempotencyKey: `pickup:${order._id}:${crypto.randomUUID()}`,
			});
			toast.success("Pickup updated");
			setNewPickupOptionId("");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to change pickup",
			);
		} finally {
			setChangingPickup(false);
		}
	};

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-3xl mx-auto px-5 py-10 space-y-8">
				<div className="flex items-start justify-between gap-4">
					<div>
						<Link
							to="/store/orders"
							className="text-sm text-muted-foreground hover:underline"
						>
							← All orders
						</Link>
						<h1 className="text-[34px] font-bold tracking-[-0.5px] text-gray-900 mt-2">
							{order.displayNumber}
						</h1>
						<div className="flex items-center gap-2 mt-2">
							<Badge variant="secondary" className="capitalize">
								{statusLabel(order.status)}
							</Badge>
							<span className="text-sm text-muted-foreground">
								{new Date(order.createdAt).toLocaleString()}
							</span>
						</div>
					</div>
				</div>

				<div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
					<div className="flex items-center gap-2">
						<MapPin className="h-4 w-4 text-muted-foreground" />
						<h2 className="font-semibold">Pickup</h2>
					</div>
					<div className="grid gap-2 text-sm">
						<p>
							<span className="text-muted-foreground">Location:</span>{" "}
							{order.pickupLabel}
						</p>
						<p>
							<span className="text-muted-foreground">Cutoff:</span>{" "}
							{new Date(order.pickupCutoffAt).toLocaleString()}
						</p>
						<p className="font-mono text-lg tracking-widest">
							Code: {order.pickupCode}
						</p>
					</div>
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<QrCode className="h-4 w-4" />
						Show this order confirmation and pickup code at the pickup window.
					</div>

					{order.canChangePickup &&
						pickupOptions &&
						pickupOptions.length > 0 && (
							<div className="pt-4 border-t space-y-3">
								<p className="text-sm font-medium">Change pickup</p>
								<Select
									value={newPickupOptionId}
									onValueChange={setNewPickupOptionId}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select new pickup" />
									</SelectTrigger>
									<SelectContent>
										{pickupOptions
											.filter((p) => p.pickupOptionId !== order.pickupOptionId)
											.map((option) => (
												<SelectItem
													key={option.pickupOptionId}
													value={option.pickupOptionId}
												>
													{option.label}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
								<Button
									variant="outline"
									disabled={changingPickup || !newPickupOptionId}
									onClick={handleChangePickup}
								>
									{changingPickup ? (
										<>
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											Updating…
										</>
									) : (
										"Update pickup"
									)}
								</Button>
							</div>
						)}
				</div>

				<div className="rounded-xl border bg-white shadow-sm overflow-hidden">
					<div className="px-5 py-4 border-b flex items-center gap-2">
						<Package className="h-4 w-4 text-muted-foreground" />
						<h2 className="font-semibold">Items</h2>
					</div>
					<ul className="divide-y">
						{items.map((item) => (
							<li key={item._id} className="p-5 flex gap-4">
								<div className="h-16 w-16 rounded-md bg-gray-100 overflow-hidden shrink-0">
									{item.imageUrl ? (
										<img
											src={item.imageUrl}
											alt={item.productName}
											className="h-full w-full object-cover"
										/>
									) : (
										<div className="h-full w-full flex items-center justify-center">
											<Package className="h-6 w-6 text-muted-foreground" />
										</div>
									)}
								</div>
								<div className="flex-1 min-w-0">
									<p className="font-medium">{item.productName}</p>
									<p className="text-sm text-muted-foreground">
										{item.variantLabel} · {item.sku}
									</p>
									<p className="text-sm tabular-nums mt-1">
										{item.quantity} × {item.pointPrice} pts
									</p>
								</div>
								<div className="text-right shrink-0">
									<Badge variant="outline" className="capitalize mb-2">
										{statusLabel(item.status)}
									</Badge>
									<p className="font-semibold tabular-nums">
										{item.pointPrice * item.quantity} pts
									</p>
								</div>
							</li>
						))}
					</ul>
					<div className="px-5 py-4 border-t flex justify-between font-bold">
						<span>Total</span>
						<span className="tabular-nums">{order.pointTotal} pts</span>
					</div>
				</div>

				{order.canCancel && (
					<Button
						variant="destructive"
						disabled={canceling}
						onClick={handleCancel}
					>
						{canceling ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Canceling…
							</>
						) : (
							"Cancel order"
						)}
					</Button>
				)}

				{pendingProposals.length > 0 && (
					<div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3">
						<h2 className="font-semibold">Substitution proposals</h2>
						{pendingProposals.map((proposal) => (
							<div
								key={proposal._id}
								className="rounded-lg border bg-white p-4 space-y-3"
							>
								<p className="text-sm">
									An officer proposed a replacement for {proposal.quantity} unit
									{proposal.quantity === 1 ? "" : "s"}.{" "}
									{proposal.priceDifference > 0
										? `You will be charged ${proposal.priceDifference} extra pts.`
										: proposal.priceDifference < 0
											? `You will be refunded ${Math.abs(proposal.priceDifference)} pts.`
											: "No price change."}
								</p>
								<div className="flex gap-2">
									<Button
										size="sm"
										disabled={respondingId === proposal._id}
										onClick={() => handleAcceptSubstitution(proposal._id)}
									>
										Accept
									</Button>
									<Button
										size="sm"
										variant="outline"
										disabled={respondingId === proposal._id}
										onClick={() => handleDeclineSubstitution(proposal._id)}
									>
										Decline
									</Button>
								</div>
							</div>
						))}
					</div>
				)}

				<div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
					<div className="flex items-center justify-between">
						<h2 className="font-semibold flex items-center gap-2">
							<AlertTriangle className="h-4 w-4 text-muted-foreground" />
							Report a problem
						</h2>
						{!showReportForm && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowReportForm(true)}
							>
								Report
							</Button>
						)}
					</div>

					{(issues ?? []).length > 0 && (
						<ul className="text-sm space-y-1">
							{(issues ?? []).map((issue) => (
								<li key={issue._id} className="text-muted-foreground">
									{issue.issueType.replace(/_/g, " ")} —{" "}
									<span className="capitalize">{issue.status}</span>
								</li>
							))}
						</ul>
					)}

					{showReportForm && (
						<div className="space-y-3 pt-2 border-t">
							<div className="space-y-2">
								<Label>Issue type</Label>
								<Select value={issueType} onValueChange={setIssueType}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="missing_item">Missing item</SelectItem>
										<SelectItem value="wrong_variant">Wrong variant</SelectItem>
										<SelectItem value="damaged_item">Damaged item</SelectItem>
										<SelectItem value="pickup_marked_incorrectly">
											Pickup marked incorrectly
										</SelectItem>
										<SelectItem value="other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label>Affected items</Label>
								<div className="space-y-1">
									{items.map((item) => (
										<label
											key={item._id}
											className="flex items-center gap-2 text-sm"
										>
											<input
												type="checkbox"
												checked={issueItemIds.includes(item._id)}
												onChange={(e) =>
													setIssueItemIds((prev) =>
														e.target.checked
															? [...prev, item._id]
															: prev.filter((id) => id !== item._id),
													)
												}
											/>
											{item.productName} ({item.variantLabel})
										</label>
									))}
								</div>
							</div>
							<div className="space-y-2">
								<Label>Description</Label>
								<Textarea
									value={issueDescription}
									onChange={(e) => setIssueDescription(e.target.value)}
									placeholder="What went wrong?"
								/>
							</div>
							<div className="flex gap-2">
								<Button onClick={handleReportIssue} disabled={reporting}>
									{reporting ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : null}
									Submit report
								</Button>
								<Button
									variant="ghost"
									onClick={() => setShowReportForm(false)}
								>
									Cancel
								</Button>
							</div>
						</div>
					)}
				</div>

				{auditLog.length > 0 && (
					<div className="rounded-xl border bg-white p-5 shadow-sm">
						<h2 className="font-semibold mb-3">Activity</h2>
						<ul className="space-y-2 text-sm">
							{auditLog.map((entry) => (
								<li key={entry._id} className="flex justify-between gap-4">
									<span className="capitalize">
										{entry.action.replace(/_/g, " ")}
									</span>
									<span className="text-muted-foreground shrink-0">
										{new Date(entry.timestamp).toLocaleString()}
									</span>
								</li>
							))}
						</ul>
					</div>
				)}
			</main>
		</div>
	);
}
