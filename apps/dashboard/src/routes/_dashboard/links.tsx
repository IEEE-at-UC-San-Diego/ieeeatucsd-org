import { createFileRoute } from "@tanstack/react-router";
import { useAuthedQuery, useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import {
  Link as LinkIcon,
  ExternalLink,
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Tag,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

export const Route = createFileRoute("/_dashboard/links")({
  component: LinksPage,
});

const ITEMS_PER_PAGE = 12;

const categoryColors: Record<string, string> = {
  General: "bg-blue-100 text-blue-800",
  "Social Media": "bg-pink-100 text-pink-800",
  Resources: "bg-green-100 text-green-800",
  Events: "bg-purple-100 text-purple-800",
  Projects: "bg-orange-100 text-orange-800",
};

function getCategoryColor(category: string) {
  return categoryColors[category] || "bg-gray-100 text-gray-800";
}

function LinksPage() {
  const { hasOfficerAccess, logtoId } = usePermissions();
  const links = useAuthedQuery(api.links.list, logtoId ? { logtoId } : "skip");
  const createLink = useAuthedMutation(api.links.create);
  const updateLink = useAuthedMutation(api.links.update);
  const removeLink = useAuthedMutation(api.links.remove);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formShortUrl, setFormShortUrl] = useState("");

  const resetForm = () => {
    setFormTitle("");
    setFormUrl("");
    setFormCategory("");
    setFormDescription("");
    setFormShortUrl("");
  };

  const openCreateModal = () => {
    resetForm();
    setEditingId(null);
    setModalOpen(true);
  };

  const openEditModal = (link: any) => {
    setEditingId(link._id);
    setFormTitle(link.title);
    setFormUrl(link.url);
    setFormCategory(link.category);
    setFormDescription(link.description || "");
    setFormShortUrl(link.shortUrl || "");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!logtoId) return;
    if (!formTitle.trim() || !formUrl.trim() || !formCategory.trim()) {
      toast.error("Title, URL, and category are required");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateLink({
          logtoId,
          id: editingId as any,
          title: formTitle,
          url: formUrl,
          category: formCategory,
          description: formDescription || undefined,
          shortUrl: formShortUrl || undefined,
        });
        toast.success("Link updated!");
      } else {
        await createLink({
          logtoId,
          title: formTitle,
          url: formUrl,
          category: formCategory,
          description: formDescription || undefined,
          shortUrl: formShortUrl || undefined,
        });
        toast.success("Link created!");
      }
      resetForm();
      setEditingId(null);
      setModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save link");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!logtoId) return;
    setDeletingId(id);
    try {
      await removeLink({ logtoId, id: id as any });
      toast.success("Link deleted");
    } catch {
      toast.error("Failed to delete link");
    } finally {
      setDeletingId(null);
    }
  };

  // Get unique categories
  const categories = useMemo(() => {
    if (!links) return [];
    const cats = [...new Set(links.map((l) => l.category))];
    return cats.sort();
  }, [links]);

  // Filter and sort: newest first by default
  const filtered = useMemo(() => {
    if (!links) return [];
    return links
      .filter((l) => {
        const matchesSearch =
          !search ||
          l.title.toLowerCase().includes(search.toLowerCase()) ||
          l.category.toLowerCase().includes(search.toLowerCase()) ||
          (l.description && l.description.toLowerCase().includes(search.toLowerCase()));
        const matchesCategory = categoryFilter === "all" || l.category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => b._creationTime - a._creationTime);
  }, [links, search, categoryFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="p-6 space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Links</h1>
          <p className="text-muted-foreground">
            Quick access to important IEEE UCSD resources.
          </p>
        </div>
        {hasOfficerAccess && (
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            Add Link
          </Button>
        )}
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search links..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={categoryFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => { setCategoryFilter("all"); setPage(1); }}
            >
              <Tag className="h-3 w-3 mr-1" />
              All
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                onClick={() => { setCategoryFilter(cat); setPage(1); }}
              >
                {cat}
              </Button>
            ))}
          </div>
        )}
      </div>

      {!links ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : paginated.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {paginated.map((link) => (
              <div
                key={link._id}
                className="flex items-start gap-3 rounded-xl border bg-card p-4 hover:bg-accent/50 transition-colors group relative"
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 flex-1 min-w-0"
                >
                  <div className="rounded-lg bg-blue-100 p-2 shrink-0">
                    <LinkIcon className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{link.title}</p>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    {link.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {link.description}
                      </p>
                    )}
                    <Badge className={`mt-2 text-xs ${getCategoryColor(link.category)}`}>
                      {link.category}
                    </Badge>
                  </div>
                </a>
                {hasOfficerAccess && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => { e.preventDefault(); openEditModal(link); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      disabled={deletingId === link._id}
                      onClick={(e) => { e.preventDefault(); handleDelete(link._id); }}
                    >
                      {deletingId === link._id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3 text-destructive" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <LinkIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">No links found</p>
          <p className="text-sm">
            {search || categoryFilter !== "all"
              ? "Try adjusting your search or filters."
              : "Links will appear here when added."}
          </p>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setModalOpen(false); setEditingId(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Link" : "Add New Link"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input placeholder="e.g. IEEE UCSD Website" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>URL *</Label>
                <Input placeholder="https://..." value={formUrl} onChange={(e) => setFormUrl(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Input placeholder="e.g. General, Social Media" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Short URL</Label>
                <Input placeholder="e.g. ieee-ucsd" value={formShortUrl} onChange={(e) => setFormShortUrl(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Brief description..." value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setModalOpen(false); setEditingId(null); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? "Update Link" : "Create Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
