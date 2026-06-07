import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, PackageCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_dashboard/manage-store/returns")({
	component: ManageStoreReturnsPage,
});

function ManageStoreReturnsPage() {
	const { hasOfficerAccess, logtoId } = usePermissions();
	const pending = useAuthedQuery(
		api.merch.returns.listPending,
		logtoId ? { logtoId } : "skip",
	);
	const awaitingInspection = useAuthedQuery(
		api.merch.returns.listAwaitingInspection,
		logtoId ? { logtoId } : "skip",
	);
	const receiveReturn = useAuthedMutation(api.merch.returns.receiveReturn);
	const inspectReturn = useAuthedMutation(api.merch.returns.inspectReturn);

	const [busyId, setBusyId] = useState<Id<"merchReturns"> | null>(null);
	const [conditionNotes, setConditionNotes] = useState<Record<string, string>>(
		{},
	);

	if (!hasOfficerAccess) {
		return (
			<div className="p-8 text-muted-foreground">Officer access required.</div>
		);
	}

	const handleReceive = async (returnId: Id<"merchReturns">) => {
		setBusyId(returnId);
		try {
			await receiveReturn({
				returnId,
				idempotencyKey: `receive:${returnId}:${crypto.randomUUID()}`,
			});
			toast.success("Return marked received");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setBusyId(null);
		}
	};

	const handleInspect = async (
		returnId: Id<"merchReturns">,
		disposition: "restocked" | "written_off",
	) => {
		const note = conditionNotes[returnId]?.trim();
		if (!note) {
			toast.error("Enter a condition note");
			return;
		}
		setBusyId(returnId);
		try {
			await inspectReturn({
				returnId,
				disposition,
				conditionNote: note,
				idempotencyKey: `inspect:${returnId}:${crypto.randomUUID()}`,
			});
			toast.success(
				disposition === "restocked" ? "Restocked & refunded" : "Written off",
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setBusyId(null);
		}
	};

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-4xl mx-auto px-5 py-10 space-y-10">
				<div>
					<h1 className="text-[34px] font-bold tracking-[-0.5px]">Returns</h1>
					<p className="text-muted-foreground mt-1">
						Receive and inspect returned merchandise before refunding.
					</p>
				</div>

				<section className="space-y-3">
					<h2 className="text-lg font-semibold">Awaiting receipt</h2>
					{pending === undefined ? (
						<Skeleton className="h-32 w-full" />
					) : pending.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No returns awaiting receipt.
						</p>
					) : (
						<ul className="divide-y rounded-xl border bg-white">
							{pending.map((ret) => (
								<li
									key={ret._id}
									className="px-5 py-4 flex items-center justify-between gap-4"
								>
									<div className="text-sm">
										<p className="font-medium">
											{ret.productName} · {ret.variantLabel}
										</p>
										<p className="text-muted-foreground">
											{ret.displayNumber} · {ret.quantity} unit
											{ret.quantity === 1 ? "" : "s"} · {ret.refundAmount} pts
										</p>
									</div>
									<Button
										size="sm"
										disabled={busyId === ret._id}
										onClick={() => handleReceive(ret._id)}
									>
										{busyId === ret._id ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<>
												<PackageCheck className="h-4 w-4 mr-1.5" />
												Mark received
											</>
										)}
									</Button>
								</li>
							))}
						</ul>
					)}
				</section>

				<section className="space-y-3">
					<h2 className="text-lg font-semibold">Awaiting inspection</h2>
					{awaitingInspection === undefined ? (
						<Skeleton className="h-32 w-full" />
					) : awaitingInspection.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No returns awaiting inspection.
						</p>
					) : (
						<ul className="divide-y rounded-xl border bg-white">
							{awaitingInspection.map((ret) => (
								<li key={ret._id} className="px-5 py-4 space-y-3">
									<div className="flex items-center justify-between gap-4">
										<div className="text-sm">
											<p className="font-medium">
												{ret.productName} · {ret.variantLabel}
											</p>
											<p className="text-muted-foreground">
												{ret.displayNumber} · {ret.quantity} unit
												{ret.quantity === 1 ? "" : "s"} · {ret.refundAmount} pts
											</p>
										</div>
										<Badge variant="outline">Received</Badge>
									</div>
									<div className="space-y-2">
										<Label className="text-xs">Condition note</Label>
										<Textarea
											value={conditionNotes[ret._id] ?? ""}
											onChange={(e) =>
												setConditionNotes((prev) => ({
													...prev,
													[ret._id]: e.target.value,
												}))
											}
											placeholder="Describe the condition of the returned item"
										/>
									</div>
									<div className="flex gap-2">
										<Button
											size="sm"
											disabled={busyId === ret._id}
											onClick={() => handleInspect(ret._id, "restocked")}
										>
											Restock & refund
										</Button>
										<Button
											size="sm"
											variant="outline"
											disabled={busyId === ret._id}
											onClick={() => handleInspect(ret._id, "written_off")}
										>
											Write off & refund
										</Button>
									</div>
								</li>
							))}
						</ul>
					)}
				</section>
			</main>
		</div>
	);
}
