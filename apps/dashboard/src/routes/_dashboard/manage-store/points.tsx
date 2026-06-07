import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/manage-store/points")({
	loader: (ctx) => prefetchAuthedQuery(api.users.list, undefined, ctx),
	component: ManageStorePointsPage,
});

function ManageStorePointsPage() {
	const { hasAdminAccess, logtoId } = usePermissions();
	const users = useAuthedQuery(api.users.list, logtoId ? { logtoId } : "skip");
	const adjustMutation = useAuthedMutation(api.pointLedger.adjustUserPoints);

	const [search, setSearch] = useState("");
	const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | "">("");
	const [amount, setAmount] = useState("");
	const [affectsLifetime, setAffectsLifetime] = useState("true");
	const [reason, setReason] = useState("");
	const [saving, setSaving] = useState(false);

	const selectedLedger = useAuthedQuery(
		api.pointLedger.getUserLedgerForOfficer,
		selectedUserId ? { userId: selectedUserId as Id<"users"> } : "skip",
	);

	if (!hasAdminAccess) {
		return (
			<div className="p-8">
				<p className="text-muted-foreground">
					Executive Officer or Administrator access required.
				</p>
			</div>
		);
	}

	const filteredUsers =
		users?.filter(
			(u) =>
				u.name.toLowerCase().includes(search.toLowerCase()) ||
				u.email.toLowerCase().includes(search.toLowerCase()),
		) ?? [];

	const handleAdjust = async () => {
		if (!selectedUserId || !amount || !reason.trim()) {
			toast.error("Select a user, amount, and reason.");
			return;
		}

		setSaving(true);
		try {
			await adjustMutation({
				userId: selectedUserId as Id<"users">,
				amount: Number(amount),
				affectsLifetime: affectsLifetime === "true",
				reason: reason.trim(),
				idempotencyKey: `adjust:${selectedUserId}:${Date.now()}`,
			});
			toast.success("Points adjusted.");
			setAmount("");
			setReason("");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to adjust points",
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-5xl mx-auto px-5 py-10 space-y-8">
				<div>
					<h1 className="text-[34px] font-bold tracking-[-0.5px] text-gray-900">
						Manage Points
					</h1>
					<p className="text-muted-foreground mt-1">
						View member ledgers and apply audited point adjustments.
					</p>
				</div>

				<div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							className="pl-9"
							placeholder="Search members..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label>Member</Label>
							<Select
								value={selectedUserId}
								onValueChange={(v) => setSelectedUserId(v as Id<"users">)}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select member" />
								</SelectTrigger>
								<SelectContent>
									{filteredUsers.map((u) => (
										<SelectItem key={u._id} value={u._id}>
											{u.name} ({u.email})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label>Amount (+ award, − deduction)</Label>
							<Input
								type="number"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								placeholder="e.g. 10 or -5"
							/>
						</div>
						<div className="space-y-2">
							<Label>Affects lifetime earned</Label>
							<Select
								value={affectsLifetime}
								onValueChange={setAffectsLifetime}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="true">Yes</SelectItem>
									<SelectItem value="false">No (spendable only)</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2 sm:col-span-2">
							<Label>Reason (required)</Label>
							<Textarea
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								placeholder="Explain this adjustment..."
							/>
						</div>
					</div>
					<Button onClick={handleAdjust} disabled={saving}>
						{saving ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
								Adjusting...
							</>
						) : (
							"Apply adjustment"
						)}
					</Button>
				</div>

				{selectedUserId && selectedLedger === undefined && (
					<Skeleton className="h-64 w-full" />
				)}

				{selectedLedger && (
					<div className="rounded-xl border bg-white shadow-sm overflow-hidden">
						<div className="px-5 py-4 border-b">
							<h2 className="font-semibold">
								{selectedLedger.user.name}&apos;s ledger
							</h2>
							<p className="text-sm text-muted-foreground">
								Lifetime: {selectedLedger.totals.lifetimePointsEarned} ·
								Spendable: {selectedLedger.totals.spendablePoints} · Pending:{" "}
								{selectedLedger.totals.pendingPointCorrection}
							</p>
						</div>
						<ul className="divide-y max-h-96 overflow-auto">
							{selectedLedger.entries.map((entry) => (
								<li key={entry._id} className="px-5 py-3 text-sm">
									<div className="flex justify-between gap-4">
										<span>{entry.publicDescription}</span>
										<span className="tabular-nums font-medium">
											{entry.spendableAmount >= 0 ? "+" : ""}
											{entry.spendableAmount}
										</span>
									</div>
									{entry.privateNote && (
										<p className="text-xs text-muted-foreground mt-1">
											Note: {entry.privateNote}
										</p>
									)}
								</li>
							))}
						</ul>
					</div>
				)}
			</main>
		</div>
	);
}
