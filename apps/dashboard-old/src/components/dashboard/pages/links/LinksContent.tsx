import React, { useState, useMemo } from "react";
import { Plus, AlertCircle, CheckCircle, Link as LinkIcon, Search } from "lucide-react";
import { useLinksManagement } from "./hooks/useLinksManagement";
import LinkCard from "./components/LinkCard";
import LinkModal from "./components/LinkModal";
import LinkFilters from "./components/LinkFilters";
import type { Link } from "../../shared/types/firestore";
import { Skeleton } from "@heroui/react";

export default function LinksContent() {
  const {
    links,
    visibleLinks,
    allLinks,
    loading,
    searchTerm,
    categoryFilter,
    canManageLinks,
    createLink,
    updateLink,
    deleteLink,
    setSearchTerm,
    setCategoryFilter,
  } = useLinksManagement();

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState<
    (Link & { id: string }) | null
  >(null);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

  // Calculate link counts by category (using visibleLinks to respect date visibility)
  const linkCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    visibleLinks.forEach((link) => {
      counts[link.category] = (counts[link.category] || 0) + 1;
    });
    return counts;
  }, [visibleLinks]);

  const handleAddLink = () => {
    setEditingLink(null);
    setShowLinkModal(true);
  };

  const handleEditLink = (link: Link & { id: string }) => {
    setEditingLink(link);
    setShowLinkModal(true);
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm("Are you sure you want to delete this link?")) {
      return;
    }

    setDeletingLinkId(linkId);
    await deleteLink(linkId);
    setDeletingLinkId(null);
  };

  const handleSaveLink = async (linkData: {
    url: string;
    title: string;
    category: string;
    description?: string;
    iconUrl?: string;
    shortUrl?: string;
    publishDate?: any;
    expireDate?: any;
  }) => {
    if (editingLink) {
      await updateLink(editingLink.id, linkData);
    } else {
      await createLink(linkData);
    }
    setShowLinkModal(false);
    setEditingLink(null);
  };

  const handleCloseModal = () => {
    setShowLinkModal(false);
    setEditingLink(null);
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50/50">
      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Quick Links
            </h1>
            <p className="text-gray-500 mt-1">
              Access important resources and external pages
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative group min-w-[300px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Search resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl leading-5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 shadow-sm"
              />
            </div>

            {canManageLinks && (
              <button
                onClick={handleAddLink}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl shadow-lg shadow-gray-900/10 hover:shadow-xl hover:shadow-gray-900/20 transition-all duration-200 font-medium"
              >
                <Plus className="w-5 h-5" />
                <span>Add Link</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="border-b border-gray-200 pb-6">
          <LinkFilters
            categoryFilter={categoryFilter}
            onCategoryChange={setCategoryFilter}
            linkCounts={linkCounts}
          />
        </div>

        {/* Links Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 h-[200px]"
              >
                <div className="flex items-start gap-4">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-3/4 rounded-lg" />
                    <Skeleton className="h-4 w-full rounded-lg" />
                    <Skeleton className="h-4 w-2/3 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="bg-gray-100 p-6 rounded-full mb-6">
              <LinkIcon className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm || categoryFilter !== "all"
                ? "No matches found"
                : "No links yet"}
            </h3>
            <p className="text-gray-500 max-w-md mb-8">
              {searchTerm || categoryFilter !== "all"
                ? "Try adjusting your search terms or selecting a different category."
                : canManageLinks
                  ? "Create your first link to get started with resource sharing."
                  : "Links will appear here once they are added by an administrator."}
            </p>
            {canManageLinks &&
              !searchTerm &&
              categoryFilter === "all" && (
                <button
                  onClick={handleAddLink}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Link
                </button>
              )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {links.map((link) => (
              <LinkCard
                key={link.id}
                link={link}
                canManage={canManageLinks}
                onEdit={handleEditLink}
                onDelete={handleDeleteLink}
              />
            ))}
          </div>
        )}

        {/* Results count */}
        {!loading && links.length > 0 && (
          <div className="text-center py-8">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              Showing {links.length} {links.length === 1 ? "link" : "links"}
              {(searchTerm || categoryFilter !== "all") && (
                <> of {allLinks.length} total</>
              )}
            </span>
          </div>
        )}
      </main>

      {/* Link Modal */}
      <LinkModal
        isOpen={showLinkModal}
        onClose={handleCloseModal}
        onSave={handleSaveLink}
        editingLink={editingLink}
        loading={loading}
        allLinks={allLinks}
      />
    </div>
  );
}
