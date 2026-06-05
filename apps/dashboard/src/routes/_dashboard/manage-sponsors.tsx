import { createFileRoute } from "@tanstack/react-router";
import { useAuthedQuery, useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import { usePermissions } from "@/hooks/usePermissions";
import type { Id } from "@convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SponsorStatsCards } from "@/components/dashboard/manage-sponsors/SponsorStatsCards";
import { SponsorTable } from "@/components/dashboard/manage-sponsors/SponsorTable";
import { SponsorModal } from "@/components/dashboard/manage-sponsors/SponsorModal";
import type { SponsorDomain, SortConfig, SponsorFormData } from "@/components/dashboard/manage-sponsors/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_dashboard/manage-sponsors")({
  component: ManageSponsorsPage,
});

function ManageSponsorsPage() {
  const { hasAdminAccess, logtoId, isLoading } = usePermissions();
  const [showModal, setShowModal] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<SponsorDomain | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "organizationName",
    direction: "asc",
  });

  const domains = useAuthedQuery(api.sponsorDomains.list, logtoId ? { logtoId } : "skip");
  const stats = useAuthedQuery(api.sponsorDomains.getStats, logtoId ? { logtoId } : "skip");
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
            <DialogDescription>You don't have permission to manage sponsors.</DialogDescription>
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

    if (window.confirm("Are you sure you want to delete this sponsor domain? Users with this domain will no longer be auto-assigned as sponsors.")) {
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
      direction: prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Manage Sponsors</h1>
        <p className="text-muted-foreground">Configure sponsor domains for automatic sponsor assignment.</p>
      </div>

      {/* Stats Cards */}
      {stats ? <SponsorStatsCards stats={stats} /> : <SponsorStatsCardsSkeleton />}

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sponsors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleAddClick} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Domain
        </Button>
      </div>

      {/* Table */}
      {!domains ? (
        <SponsorTableSkeleton />
      ) : (
        <SponsorTable
          sponsors={filteredAndSortedDomains()}
          sortConfig={sortConfig}
          onSort={handleSort}
          onRowClick={handleEditClick}
        />
      )}

      {/* Modal */}
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
    </div>
  );
}

function SponsorStatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-200 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
              <div className="h-6 w-12 rounded bg-gray-200 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SponsorTableSkeleton() {
  return (
    <div className="bg-white rounded-xl border p-8">
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
