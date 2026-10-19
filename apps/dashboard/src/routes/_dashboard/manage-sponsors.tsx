import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import { SponsorModal } from "@/components/dashboard/manage-sponsors/SponsorModal";
import { SponsorStatsCards } from "@/components/dashboard/manage-sponsors/SponsorStatsCards";
import { SponsorTable } from "@/components/dashboard/manage-sponsors/SponsorTable";
import type {
	SortConfig,
	SponsorDomain,
	SponsorFormData,
} from "@/components/dashboard/manage-sponsors/types";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/manage-sponsors")({
	loader: (ctx) => prefetchAuthedQuery(api.sponsorDomains.list, undefined, ctx),
	component: ManageSponsorsPage,
});

function ManageSponsorsPage() {
	const { hasAdminAccess, logtoId, isLoading } = usePermissions();
	const [showModal, setShowModal] = useState(false);
	const [editingSponsor, setEditingSponsor] = useState<SponsorDomain | null>(
		null,
	);
	const [searchTerm, setSearchTerm] = useState("");
	const [sortConfig, setSortConfig] = useState<SortConfig>({
		field: "organizationName",
		direction: "asc",
	});

	const domains = useAuthedQuery(
		api.sponsorDomains.list,
		logtoId ? { logtoId } : "skip",
	);
	const stats = useAuthedQuery(
		api.sponsorDomains.getStats,
		logtoId ? { logtoId } : "skip",
	);
	const createDomain = useAuthedMutation(api.sponsorDomains.create);
	const updateDomain = useAuthedMutation(api.sponsorDomains.update);
	const removeDomain = useAuthedMutation(api.sponsorDomains.remove);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!hasAdminAccess) {
		return (
			<Dialog open>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Access Denied</DialogTitle>
						<DialogDescription>
							You don't have permission to manage sponsors.
						</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>
		);
	}

	const handleAddClick = () => {
		setEditingSponsor(null);
		setShowModal(true);
	};

	const handleEditClick = (sponsor: SponsorDomain) => {
		setEditingSponsor(sponsor);
		setShowModal(true);
	};

	const handleSave = async (formData: SponsorFormData) => {
		if (!logtoId) return;

		try {
			if (editingSponsor) {
				await updateDomain({
					logtoId,
					id: editingSponsor._id,
					...formData,
				});
				toast.success("Sponsor domain updated successfully");
			} else {
				await createDomain({
					logtoId,
					...formData,
				});
				toast.success("Sponsor domain added successfully");
			}
			setShowModal(false);
			setEditingSponsor(null);
		} catch (error: any) {
			toast.error(error.message || "Failed to save sponsor domain");
		}
	};

	const handleDelete = async (sponsorId: Id<"sponsorDomains">) => {
		if (!logtoId) return;

		if (
			window.confirm(
				"Are you sure you want to delete this sponsor domain? Users with this domain will no longer be auto-assigned as sponsors.",
			)
		) {
			try {
				await removeDomain({ logtoId, id: sponsorId });
				toast.success("Sponsor domain deleted successfully");
			} catch (error: any) {
				toast.error(error.message || "Failed to delete sponsor domain");
			}
		}
	};

	const filteredAndSortedDomains = () => {
		let filtered = domains || [];

		// Search filter
		if (searchTerm) {
			const term = searchTerm.toLowerCase();
			filtered = filtered.filter(
				(d) =>
					d.domain.toLowerCase().includes(term) ||
					d.organizationName.toLowerCase().includes(term) ||
					d.sponsorTier.toLowerCase().includes(term),
			);
		}

		// Sort
		filtered = [...filtered].sort((a, b) => {
			const aValue = a[sortConfig.field as keyof SponsorDomain];
			const bValue = b[sortConfig.field as keyof SponsorDomain];

			if (typeof aValue === "string" && typeof bValue === "string") {
				return sortConfig.direction === "asc"
					? aValue.localeCompare(bValue)
					: bValue.localeCompare(aValue);
			}

			return 0;
		});

		return filtered;
	};

	const handleSort = (field: string) => {
		setSortConfig((prev) => ({
			field,
			direction:
				prev.field === field && prev.direction === "asc" ? "desc" : "asc",
		}));
	};

	const visibleDomains = filteredAndSortedDomains();

	return (
		<DashboardPage>
			<PageHeader
				hideTitleOnMobile
				title="Manage Sponsors"
				description="Configure sponsor domains for automatic sponsor assignment."
				actions={
					<Button onClick={handleAddClick} className="w-full gap-2 sm:w-auto">
						<Plus className="h-4 w-4" />
						Add Domain
					</Button>
				}
			/>

			{stats ? (
				<SponsorStatsCards stats={stats} />
			) : (
				<SponsorStatsCards
					loading
					stats={{
						totalSponsors: 0,
						goldSponsors: 0,
						silverSponsors: 0,
						bronzeSponsors: 0,
					}}
				/>
			)}

			<section className="space-y-3">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="relative w-full sm:max-w-sm">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							placeholder="Search organization, domain or tier"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							className="pl-9"
						/>
					</div>
					{domains && (
						<p className="text-xs tabular-nums text-muted-foreground">
							{visibleDomains.length} of {domains.length} domain
							{domains.length === 1 ? "" : "s"}
						</p>
					)}
				</div>

				{!domains ? (
					<SponsorTableSkeleton />
				) : (
					<SponsorTable
						sponsors={visibleDomains}
						sortConfig={sortConfig}
						onSort={handleSort}
						onRowClick={handleEditClick}
					/>
				)}
			</section>

			<SponsorModal
				isOpen={showModal}
				onClose={() => {
					setShowModal(false);
					setEditingSponsor(null);
				}}
				onSave={handleSave}
				onDelete={handleDelete}
				editingSponsor={editingSponsor}
			/>
		</DashboardPage>
	);
}

function SponsorTableSkeleton() {
	return (
		<div className="overflow-hidden rounded-md border">
			<div className="h-10 border-b" />
			<div className="divide-y">
				{[...Array(5)].map((_, i) => (
					<div key={i} className="flex items-center gap-4 px-4 py-3.5">
						<Skeleton className="h-4 w-48 rounded-[2px]" />
						<Skeleton className="ml-auto h-4 w-32 rounded-[2px]" />
					</div>
				))}
			</div>
		</div>
	);
}
