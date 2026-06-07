import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_dashboard/manage-store/inventory")({
	component: ManageStoreInventoryPage,
});

function ManageStoreInventoryPage() {
	const { hasOfficerAccess, logtoId } = usePermissions();
	const releases = useAuthedQuery(
		api.merch.products.listActiveReleases,
		logtoId ? { logtoId } : "skip",
	);
	const adjustStock = useAuthedMutation(api.merch.inventory.adjustStock);
	const createReconciliation = useAuthedMutation(
		api.merch.inventory.createReconciliation,
	);
	const postReconciliation = useAuthedMutation(
		api.merch.inventory.postReconciliation,
	);

	const [selectedReleaseId, setSelectedReleaseId] = useState<
		Id<"merchReleases"> | ""
	>("");
	const [adjustments, setAdjustments] = useState<
		Record<string, { delta: string; reason: string }>
	>({});
	const [saving, setSaving] = useState(false);
	const [counts, setCounts] = useState<Record<string, string>>({});
	const [reconReason, setReconReason] = useState("");
	const [reconciling, setReconciling] = useState(false);
	const [draftReconciliation, setDraftReconciliation] = useState<{
		reconciliationId: Id<"merchInventoryReconciliations">;
		blocked: boolean;
	} | null>(null);

	const variants = useAuthedQuery(
		api.merch.inventory.listByRelease,
		selectedReleaseId
			? { releaseId: selectedReleaseId as Id<"merchReleases"> }
			: "skip",
	);

	if (!hasOfficerAccess) {
		return (
			<div className="p-8 text-muted-foreground">Officer access required.</div>
		);
	}

	const handleAdjust = async (variantId: Id<"merchVariants">) => {
		const adj = adjustments[variantId];
		if (!adj?.delta || !adj.reason.trim()) {
			toast.error("Enter delta and reason.");
			return;
		}
		setSaving(true);
		try {
			await adjustStock({
				variantId,
				delta: Number(adj.delta),
				reason: adj.reason.trim(),
				idempotencyKey: `adjust:${variantId}:${Date.now()}`,
			});
			toast.success("Stock adjusted.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setSaving(false);
		}
	};

	const handleCreateReconciliation = async () => {
		if (!selectedReleaseId || !variants) return;
		if (!reconReason.trim()) {
			toast.error("Enter a reconciliation reason.");
			return;
		}
		const countEntries = variants
			.filter((variant) => counts[variant._id] !== undefined && counts[variant._id] !== "")
			.map((variant) => ({
				variantId: variant._id,
				countedQuantity: Number(counts[variant._id]),
			}));
		if (countEntries.length === 0) {
			toast.error("Enter at least one counted quantity.");
			return;
		}
		setReconciling(true);
		try {
			const result = await createReconciliation({
				releaseId: selectedReleaseId as Id<"merchReleases">,
				counts: countEntries,
				reason: reconReason.trim(),
			});
			setDraftReconciliation(result);
			toast.success(
				result.blocked
					? "Reconciliation created but blocked (counts below reserved)."
					: "Reconciliation draft created.",
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setReconciling(false);
		}
	};

	const handlePostReconciliation = async () => {
		if (!draftReconciliation) return;
		setReconciling(true);
		try {
			await postReconciliation({
				reconciliationId: draftReconciliation.reconciliationId,
			});
			toast.success("Reconciliation posted.");
			setDraftReconciliation(null);
			setCounts({});
			setReconReason("");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setReconciling(false);
		}
	};

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-5xl mx-auto px-5 py-10 space-y-8">
				<div>
					<h1 className="text-[34px] font-bold tracking-[-0.5px]">Inventory</h1>
					<p className="text-muted-foreground mt-1">
						Adjust stock levels and view availability.
					</p>
				</div>

				{releases === undefined ? (
					<Skeleton className="h-10 w-full" />
				) : (
					<div className="space-y-2">
						<Label>Select release</Label>
						<select
							className="w-full rounded-md border px-3 py-2 text-sm"
							value={selectedReleaseId}
							onChange={(e) =>
								setSelectedReleaseId(
									e.target.value as Id<"merchReleases"> | "",
								)
							}
						>
							<option value="">Choose a release...</option>
							{releases.map((r) => (
								<option key={r.releaseId} value={r.releaseId}>
									{r.productName} (R{r.releaseNumber}) — {r.defaultPointPrice}{" "}
									pts
								</option>
							))}
						</select>
					</div>
				)}

				{variants === undefined && selectedReleaseId && (
					<Skeleton className="h-48 w-full" />
				)}

				{variants && variants.length > 0 && (
					<ul className="divide-y rounded-xl border bg-white">
						{variants.map((variant) => (
							<li key={variant._id} className="px-5 py-4 space-y-3">
								<div className="flex items-center justify-between">
									<div>
										<p className="font-medium">{variant.label}</p>
										<p className="text-xs text-muted-foreground">
											SKU: {variant.sku}
										</p>
									</div>
									<div className="text-right text-sm">
										<p>
											On hand:{" "}
											<span className="font-semibold tabular-nums">
												{variant.onHand}
											</span>
										</p>
										<p className="text-muted-foreground">
											Available: {variant.available}
										</p>
										<Badge variant="outline" className="mt-1">
											{variant.stockDisplay.replace(/_/g, " ")}
										</Badge>
									</div>
								</div>
								<div className="flex gap-2 items-end">
									<div className="space-y-1 flex-1">
										<Label className="text-xs">Delta (+/−)</Label>
										<Input
											type="number"
											placeholder="e.g. 10"
											value={adjustments[variant._id]?.delta ?? ""}
											onChange={(e) =>
												setAdjustments((prev) => ({
													...prev,
													[variant._id]: {
														delta: e.target.value,
														reason: prev[variant._id]?.reason ?? "",
													},
												}))
											}
										/>
									</div>
									<div className="space-y-1 flex-[2]">
										<Label className="text-xs">Reason</Label>
										<Input
											placeholder="Restock from supplier"
											value={adjustments[variant._id]?.reason ?? ""}
											onChange={(e) =>
												setAdjustments((prev) => ({
													...prev,
													[variant._id]: {
														delta: prev[variant._id]?.delta ?? "",
														reason: e.target.value,
													},
												}))
											}
										/>
									</div>
									<Button
										size="sm"
										onClick={() => handleAdjust(variant._id)}
										disabled={saving}
									>
										{saving ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											"Adjust"
										)}
									</Button>
								</div>
							</li>
						))}
					</ul>
				)}

				{variants && variants.length > 0 && (
					<section className="rounded-xl border bg-white p-5 space-y-4">
						<div>
							<h2 className="font-semibold">Physical count reconciliation</h2>
							<p className="text-sm text-muted-foreground mt-0.5">
								Enter counted on-hand quantities to reconcile against the
								system.
							</p>
						</div>
						<ul className="divide-y">
							{variants.map((variant) => (
								<li
									key={variant._id}
									className="py-3 flex items-center justify-between gap-4"
								>
									<div className="text-sm">
										<p className="font-medium">{variant.label}</p>
										<p className="text-muted-foreground text-xs">
											System on hand: {variant.onHand}
										</p>
									</div>
									<div className="space-y-1 w-32">
										<Label className="text-xs">Counted</Label>
										<Input
											type="number"
											min={0}
											value={counts[variant._id] ?? ""}
											onChange={(e) =>
												setCounts((prev) => ({
													...prev,
													[variant._id]: e.target.value,
												}))
											}
										/>
									</div>
								</li>
							))}
						</ul>
						<div className="space-y-2">
							<Label>Reason</Label>
							<Input
								placeholder="e.g. Quarterly physical count"
								value={reconReason}
								onChange={(e) => setReconReason(e.target.value)}
							/>
						</div>
						<div className="flex items-center gap-3">
							<Button
								variant="outline"
								onClick={handleCreateReconciliation}
								disabled={reconciling}
							>
								{reconciling ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									"Create reconciliation"
								)}
							</Button>
							{draftReconciliation && (
								<Button
									onClick={handlePostReconciliation}
									disabled={reconciling || draftReconciliation.blocked}
								>
									{draftReconciliation.blocked
										? "Blocked (below reserved)"
										: "Post reconciliation"}
								</Button>
							)}
						</div>
					</section>
				)}
			</main>
		</div>
	);
}
