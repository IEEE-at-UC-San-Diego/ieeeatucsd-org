import { api } from "@convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
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

export const Route = createFileRoute("/_dashboard/manage-store/settings")({
	component: ManageStoreSettingsPage,
});

function ManageStoreSettingsPage() {
	const { hasOfficerAccess, hasAdminAccess, logtoId } = usePermissions();
	const settings = useAuthedQuery(
		api.merch.settings.getSettings,
		logtoId ? { logtoId } : "skip",
	);
	const announcements = useAuthedQuery(
		api.merch.announcements.list,
		logtoId ? { logtoId } : "skip",
	);

	const setStoreEnabled = useAuthedMutation(api.merch.settings.setStoreEnabled);
	const upsertAnnouncement = useAuthedMutation(api.merch.announcements.upsert);

	const [toggleReason, setToggleReason] = useState("");
	const [toggling, setToggling] = useState(false);
	const [bannerMessage, setBannerMessage] = useState("");
	const [bannerLink, setBannerLink] = useState("");
	const [bannerSaving, setBannerSaving] = useState(false);

	if (!hasOfficerAccess) {
		return (
			<div className="p-8 text-muted-foreground">Officer access required.</div>
		);
	}

	const handleToggle = async (enabled: boolean) => {
		if (!toggleReason.trim()) {
			toast.error("Reason is required to toggle the store.");
			return;
		}
		setToggling(true);
		try {
			await setStoreEnabled({ enabled, reason: toggleReason.trim() });
			toast.success(enabled ? "Store enabled." : "Store disabled.");
			setToggleReason("");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setToggling(false);
		}
	};

	const handleSaveBanner = async () => {
		if (!bannerMessage.trim()) {
			toast.error("Banner message is required.");
			return;
		}
		setBannerSaving(true);
		try {
			await upsertAnnouncement({
				message: bannerMessage.trim(),
				linkUrl: bannerLink.trim() || undefined,
				active: true,
			});
			toast.success("Storefront banner saved.");
			setBannerMessage("");
			setBannerLink("");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed");
		} finally {
			setBannerSaving(false);
		}
	};

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-3xl mx-auto px-5 py-10 space-y-10">
				<div>
					<h1 className="text-[34px] font-bold tracking-[-0.5px]">
						Store settings
					</h1>
					<p className="text-muted-foreground mt-1">
						Feature flag, launch readiness, and storefront announcements.
					</p>
				</div>

				{settings === undefined ? (
					<Skeleton className="h-48 w-full" />
				) : (
					<section className="rounded-xl border bg-white p-6 space-y-4">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-semibold">Store feature flag</h2>
							<Badge variant={settings.storeEnabled ? "default" : "secondary"}>
								{settings.storeEnabled ? "Enabled" : "Disabled"}
							</Badge>
						</div>
						{settings.lastToggleReason && (
							<p className="text-sm text-muted-foreground">
								Last change: {settings.lastToggleReason}
							</p>
						)}

						<div className="space-y-2">
							<h3 className="font-medium text-sm">Readiness checks</h3>
							{settings.readiness.ready ? (
								<p className="text-sm text-green-700">
									All readiness checks passed.
								</p>
							) : (
								<ul className="text-sm text-destructive list-disc pl-5 space-y-1">
									{settings.readiness.issues.map((issue) => (
										<li key={issue.code}>{issue.message}</li>
									))}
								</ul>
							)}
						</div>

						{hasAdminAccess && (
							<div className="space-y-3 pt-2 border-t">
								<Label>Toggle reason</Label>
								<Textarea
									value={toggleReason}
									onChange={(e) => setToggleReason(e.target.value)}
									placeholder="Required audit reason for enabling or disabling the store"
								/>
								<div className="flex gap-2">
									<Button
										disabled={toggling || settings.storeEnabled}
										onClick={() => handleToggle(true)}
									>
										{toggling ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											"Enable store"
										)}
									</Button>
									<Button
										variant="outline"
										disabled={toggling || !settings.storeEnabled}
										onClick={() => handleToggle(false)}
									>
										Disable store
									</Button>
								</div>
							</div>
						)}

						{!hasAdminAccess && (
							<p className="text-sm text-muted-foreground">
								Only Executive Officers and Administrators can toggle the store.
							</p>
						)}
					</section>
				)}

				<section className="rounded-xl border bg-white p-6 space-y-4">
					<h2 className="text-lg font-semibold">Storefront banner</h2>
					<div className="space-y-2">
						<Label>Message</Label>
						<Input
							value={bannerMessage}
							onChange={(e) => setBannerMessage(e.target.value)}
							placeholder="Short announcement shown on the storefront"
						/>
					</div>
					<div className="space-y-2">
						<Label>Link URL (optional)</Label>
						<Input
							value={bannerLink}
							onChange={(e) => setBannerLink(e.target.value)}
							placeholder="https://..."
						/>
					</div>
					<Button onClick={handleSaveBanner} disabled={bannerSaving}>
						{bannerSaving ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							"Save banner"
						)}
					</Button>

					{announcements && announcements.length > 0 && (
						<ul className="divide-y text-sm pt-4">
							{announcements.slice(0, 5).map((item) => (
								<li key={item._id} className="py-2 flex justify-between gap-4">
									<span>{item.message}</span>
									<Badge variant={item.active ? "default" : "secondary"}>
										{item.active ? "Active" : "Inactive"}
									</Badge>
								</li>
							))}
						</ul>
					)}
				</section>

				<Button variant="outline" asChild>
					<Link to={NAVIGATION_PATHS.MANAGE_STORE_POLICIES}>
						Manage policies
					</Link>
				</Button>
			</main>
		</div>
	);
}
