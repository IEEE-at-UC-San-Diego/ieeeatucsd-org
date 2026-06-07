import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";

type SelectedMember = {
	_id: Id<"users">;
	name: string;
	email: string;
	spendablePoints: number;
};

type OrderLine = {
	variantId: Id<"merchVariants">;
	releaseId: Id<"merchReleases">;
	productId: Id<"merchProducts">;
	productName: string;
	variantLabel: string;
	pointPrice: number;
	quantity: number;
};

export function OfficerOrderForm({
	logtoId,
	canCreateComplimentary,
	onClose,
}: {
	logtoId: string;
	canCreateComplimentary: boolean;
	onClose: () => void;
}) {
	const [complimentary, setComplimentary] = useState(false);
	const [memberSearch, setMemberSearch] = useState("");
	const [member, setMember] = useState<SelectedMember | null>(null);
	const [pickupOptionId, setPickupOptionId] = useState("");
	const [releaseChoice, setReleaseChoice] = useState("");
	const [lines, setLines] = useState<OrderLine[]>([]);
	const [reason, setReason] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const memberResults = useAuthedQuery(
		api.merch.fulfillment.searchMembers,
		memberSearch.trim().length >= 2 ? { search: memberSearch } : "skip",
	);
	const pickupData = useAuthedQuery(api.merch.pickups.listPickupOptions, {
		logtoId,
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

	const activePickups = (pickupData?.options ?? []).filter(
		(option) => option.status === "active",
	);

	const officerAssistedOrder = useAuthedMutation(
		api.merch.fulfillment.officerAssistedOrder,
	);
	const complimentaryOrder = useAuthedMutation(
		api.merch.fulfillment.complimentaryOrder,
	);

	const pointTotal = complimentary
		? 0
		: lines.reduce((sum, line) => sum + line.pointPrice * line.quantity, 0);

	const addVariant = (variant: {
		_id: Id<"merchVariants">;
		label: string;
		pointPrice?: number;
	}) => {
		if (!selectedRelease) return;
		const releaseDoc = productDetail?.releases.find(
			(r) => r._id === selectedRelease.releaseId,
		);
		const variantDoc = releaseDoc?.variants.find((v) => v._id === variant._id);
		const pointPrice =
			variantDoc?.pointPriceOverride ?? selectedRelease.defaultPointPrice;
		setLines((prev) => {
			const existing = prev.find((line) => line.variantId === variant._id);
			if (existing) {
				return prev.map((line) =>
					line.variantId === variant._id
						? { ...line, quantity: line.quantity + 1 }
						: line,
				);
			}
			return [
				...prev,
				{
					variantId: variant._id,
					releaseId: selectedRelease.releaseId,
					productId: selectedRelease.productId,
					productName: selectedRelease.productName,
					variantLabel: variant.label,
					pointPrice,
					quantity: 1,
				},
			];
		});
	};

	const handleSubmit = async () => {
		if (!member) {
			toast.error("Select a member");
			return;
		}
		if (!pickupOptionId) {
			toast.error("Select a pickup option");
			return;
		}
		if (lines.length === 0) {
			toast.error("Add at least one item");
			return;
		}
		if (!reason.trim()) {
			toast.error("A reason is required");
			return;
		}
		setSubmitting(true);
		try {
			const items = lines.map((line) => ({
				variantId: line.variantId,
				releaseId: line.releaseId,
				productId: line.productId,
				quantity: line.quantity,
			}));
			const idempotencyKey = `officer-order:${crypto.randomUUID()}`;
			const result = complimentary
				? await complimentaryOrder({
						memberUserId: member._id,
						pickupOptionId,
						items,
						idempotencyKey,
						reason: reason.trim(),
					})
				: await officerAssistedOrder({
						memberUserId: member._id,
						pickupOptionId,
						items,
						idempotencyKey,
						reason: reason.trim(),
					});
			toast.success(`Order ${result.displayNumber} created`);
			onClose();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to create order",
			);
		} finally {
			setSubmitting(false);
		}
	};

	const activeVariants =
		productDetail?.releases
			.find((r) => r._id === selectedRelease?.releaseId)
			?.variants.filter((variant) => variant.enabled) ?? [];

	return (
		<div className="rounded-xl border bg-white p-5 space-y-5 shadow-sm">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="font-semibold text-lg">Create officer order</h2>
					<p className="text-sm text-muted-foreground">
						Place an order on behalf of a member.
					</p>
				</div>
				<Button variant="ghost" size="icon" onClick={onClose}>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{canCreateComplimentary && (
				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={complimentary}
						onChange={(e) => setComplimentary(e.target.checked)}
					/>
					Complimentary order (no points charged)
				</label>
			)}

			<div className="space-y-2">
				<Label>Member</Label>
				{member ? (
					<div className="flex items-center justify-between rounded-md border px-3 py-2">
						<div className="text-sm">
							<p className="font-medium">{member.name}</p>
							<p className="text-muted-foreground">
								{member.email} · {member.spendablePoints} pts spendable
							</p>
						</div>
						<Button variant="ghost" size="sm" onClick={() => setMember(null)}>
							Change
						</Button>
					</div>
				) : (
					<div className="space-y-2">
						<Input
							placeholder="Search by name or email"
							value={memberSearch}
							onChange={(e) => setMemberSearch(e.target.value)}
						/>
						{memberResults && memberResults.length > 0 && (
							<ul className="rounded-md border divide-y">
								{memberResults.map((result) => (
									<li key={result._id}>
										<button
											type="button"
											className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
											onClick={() => {
												setMember(result);
												setMemberSearch("");
											}}
										>
											<span className="font-medium">{result.name}</span>{" "}
											<span className="text-muted-foreground">
												· {result.email} · {result.spendablePoints} pts
											</span>
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				)}
			</div>

			<div className="space-y-2">
				<Label>Pickup option</Label>
				<select
					className="w-full rounded-md border px-3 py-2 text-sm bg-white"
					value={pickupOptionId}
					onChange={(e) => setPickupOptionId(e.target.value)}
				>
					<option value="">Select pickup…</option>
					{activePickups.map((option) => (
						<option key={option._id} value={option._id}>
							{option.label}
						</option>
					))}
				</select>
			</div>

			<div className="space-y-2">
				<Label>Add items</Label>
				<select
					className="w-full rounded-md border px-3 py-2 text-sm bg-white"
					value={releaseChoice}
					onChange={(e) => setReleaseChoice(e.target.value)}
				>
					<option value="">Select product…</option>
					{(releases ?? []).map((release) => (
						<option key={release.releaseId} value={release.releaseId}>
							{release.productName}
						</option>
					))}
				</select>
				{selectedRelease && (
					<div className="flex flex-wrap gap-2">
						{activeVariants.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No variants available.
							</p>
						) : (
							activeVariants.map((variant) => {
								const available = Math.max(
									0,
									variant.onHand - variant.reserved,
								);
								return (
									<Button
										key={variant._id}
										variant="outline"
										size="sm"
										disabled={available <= 0}
										onClick={() => addVariant(variant)}
									>
										<Plus className="h-3.5 w-3.5 mr-1" />
										{variant.label} ({available})
									</Button>
								);
							})
						)}
					</div>
				)}
			</div>

			{lines.length > 0 && (
				<div className="rounded-md border divide-y">
					{lines.map((line) => (
						<div
							key={line.variantId}
							className="flex items-center justify-between px-3 py-2 text-sm gap-3"
						>
							<div className="min-w-0">
								<p className="font-medium truncate">{line.productName}</p>
								<p className="text-muted-foreground">
									{line.variantLabel} ·{" "}
									{complimentary ? "Free" : `${line.pointPrice} pts`}
								</p>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								<Input
									type="number"
									min={1}
									className="w-16"
									value={line.quantity}
									onChange={(e) =>
										setLines((prev) =>
											prev.map((l) =>
												l.variantId === line.variantId
													? {
															...l,
															quantity: Math.max(1, Number(e.target.value) || 1),
														}
													: l,
											),
										)
									}
								/>
								<Button
									variant="ghost"
									size="icon"
									onClick={() =>
										setLines((prev) =>
											prev.filter((l) => l.variantId !== line.variantId),
										)
									}
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						</div>
					))}
				</div>
			)}

			<div className="space-y-2">
				<Label>Reason</Label>
				<Textarea
					value={reason}
					onChange={(e) => setReason(e.target.value)}
					placeholder="Why is this order being created?"
				/>
			</div>

			<div className="flex items-center justify-between">
				<Badge variant="secondary">
					Total: {complimentary ? "Free" : `${pointTotal} pts`}
				</Badge>
				<Button onClick={handleSubmit} disabled={submitting}>
					{submitting ? (
						<Loader2 className="h-4 w-4 mr-2 animate-spin" />
					) : null}
					Create order
				</Button>
			</div>
		</div>
	);
}
