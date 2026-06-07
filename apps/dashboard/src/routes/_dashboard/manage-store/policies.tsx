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
import { Textarea } from "@/components/ui/textarea";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_dashboard/manage-store/policies")({
	component: ManageStorePoliciesPage,
});

function ManageStorePoliciesPage() {
	const { hasOfficerAccess, hasAdminAccess, logtoId } = usePermissions();
	const policies = useAuthedQuery(
		api.merch.policies.list,
		logtoId ? { logtoId } : "skip",
	);
	const published = useAuthedQuery(api.merch.policies.getPublished, {});

	const draftPolicy = useAuthedMutation(api.merch.policies.draft);
	const publishPolicy = useAuthedMutation(api.merch.policies.publish);

	const [version, setVersion] = useState("");
	const [content, setContent] = useState("");
	const [changeSummary, setChangeSummary] = useState("");
	const [requiresReacceptance, setRequiresReacceptance] = useState(true);
	const [saving, setSaving] = useState(false);
	const [publishingId, setPublishingId] = useState<Id<"merchPolicies"> | null>(
		null,
	);

	if (!hasOfficerAccess) {
		return (
			<div className="p-8 text-muted-foreground">Officer access required.</div>
		);
	}

	const handleDraft = async () => {
		if (!version.trim() || !content.trim()) {
			toast.error("Version and content are required.");
			return;
		}
		setSaving(true);
		try {
			await draftPolicy({
				version: version.trim(),
				content: content.trim(),
				changeSummary: changeSummary.trim() || undefined,
				requiresReacceptance,
			});
			toast.success("Policy draft saved.");
			setVersion("");
			setContent("");
			setChangeSummary("");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setSaving(false);
		}
	};

	const handlePublish = async (policyId: Id<"merchPolicies">) => {
		setPublishingId(policyId);
		try {
			await publishPolicy({
				policyId,
				effectiveAt: Date.now(),
				requiresReacceptance,
				changeSummary: changeSummary.trim() || undefined,
			});
			toast.success("Policy published.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setPublishingId(null);
		}
	};

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-3xl mx-auto px-5 py-10 space-y-10">
				<div>
					<h1 className="text-[34px] font-bold tracking-[-0.5px]">
						Merchandise policies
					</h1>
					<p className="text-muted-foreground mt-1">
						Versioned store policies members must accept before purchasing.
					</p>
				</div>

				{published && (
					<section className="rounded-xl border bg-white p-6 space-y-2">
						<div className="flex items-center gap-2">
							<h2 className="text-lg font-semibold">Currently published</h2>
							<Badge>v{published.version}</Badge>
						</div>
						<p className="text-sm text-muted-foreground whitespace-pre-wrap">
							{published.content.slice(0, 400)}
							{published.content.length > 400 ? "…" : ""}
						</p>
					</section>
				)}

				<section className="rounded-xl border bg-white p-6 space-y-4">
					<h2 className="text-lg font-semibold">Draft new policy</h2>
					<div className="space-y-2">
						<Label htmlFor="version">Version</Label>
						<Input
							id="version"
							value={version}
							onChange={(e) => setVersion(e.target.value)}
							placeholder="e.g. 1.0"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="changeSummary">Change summary</Label>
						<Input
							id="changeSummary"
							value={changeSummary}
							onChange={(e) => setChangeSummary(e.target.value)}
							placeholder="What changed in this version?"
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="content">Policy content</Label>
						<Textarea
							id="content"
							className="min-h-[200px]"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder="Full merchandise policy text"
						/>
					</div>
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={requiresReacceptance}
							onChange={(e) => setRequiresReacceptance(e.target.checked)}
						/>
						Require re-acceptance after publish
					</label>
					<Button onClick={handleDraft} disabled={saving}>
						{saving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							"Save draft"
						)}
					</Button>
				</section>

				<section className="space-y-3">
					<h2 className="text-lg font-semibold">All versions</h2>
					{policies === undefined ? (
						<Skeleton className="h-32 w-full" />
					) : policies.length === 0 ? (
						<p className="text-sm text-muted-foreground">No policies yet.</p>
					) : (
						<ul className="divide-y rounded-xl border bg-white">
							{policies.map((policy) => (
								<li key={policy._id} className="px-5 py-4 space-y-2">
									<div className="flex items-center justify-between gap-4">
										<div>
											<p className="font-medium">Version {policy.version}</p>
											{policy.changeSummary && (
												<p className="text-sm text-muted-foreground">
													{policy.changeSummary}
												</p>
											)}
										</div>
										<Badge
											variant={
												policy.status === "published" ? "default" : "secondary"
											}
										>
											{policy.status}
										</Badge>
									</div>
									{policy.status === "draft" && hasAdminAccess && (
										<Button
											size="sm"
											disabled={publishingId === policy._id}
											onClick={() => handlePublish(policy._id)}
										>
											{publishingId === policy._id ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												"Publish"
											)}
										</Button>
									)}
									{policy.status === "draft" && !hasAdminAccess && (
										<p className="text-xs text-muted-foreground">
											Executive approval required to publish.
										</p>
									)}
								</li>
							))}
						</ul>
					)}
				</section>
			</main>
		</div>
	);
}
