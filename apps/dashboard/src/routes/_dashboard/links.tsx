import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
	ExternalLink,
	Link as LinkIcon,
	Loader2,
	MoreHorizontal,
	Pencil,
	Plus,
	Tag,
	Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
	DashboardPage,
	EmptyState,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import {
	MobileDataList,
	MobileDataListItem,
	MobileFilters,
	ResponsiveOverlay,
} from "@/components/mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dashboard/links")({
	loader: (ctx) => prefetchAuthedQuery(api.links.list, undefined, ctx),
	component: LinksPage,
});

const ITEMS_PER_PAGE = 12;

const categoryColors: Record<string, string> = {
	General: "bg-ds-blue-100 text-ds-blue-700",
	"Social Media": "bg-ds-blue-100 text-ds-pink-700",
	Resources: "bg-ds-green-100 text-ds-green-900",
	Events: "bg-ds-blue-100 text-ds-purple-700",
	Projects: "bg-ds-amber-100 text-ds-amber-900",
};

function getCategoryColor(category: string) {
	return categoryColors[category] || "bg-muted text-foreground";
}

function getLinkDomain(url: string) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

function LinksPage() {
	const isMobile = useIsMobile();
	const { hasOfficerAccess, logtoId } = usePermissions();
	const links = useAuthedQuery(api.links.list, logtoId ? { logtoId } : "skip");
	const createLink = useAuthedMutation(api.links.create);
	const updateLink = useAuthedMutation(api.links.update);
	const removeLink = useAuthedMutation(api.links.remove);

	const [search, setSearch] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [page, setPage] = useState(1);
	const [modalOpen, setModalOpen] = useState(false);
	const [manageLink, setManageLink] = useState<
		NonNullable<typeof links>[number] | null
	>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [deletingId, setDeletingId] = useState<string | null>(null);

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
		setManageLink(null);
		setModalOpen(true);
	};

	const openEditModal = (link: NonNullable<typeof links>[number]) => {
		setEditingId(link._id);
		setFormTitle(link.title);
		setFormUrl(link.url);
		setFormCategory(link.category);
		setFormDescription(link.description || "");
		setFormShortUrl(link.shortUrl || "");
		setManageLink(null);
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
					id: editingId as never,
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
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : "Failed to save link";
			toast.error(message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async (id: string) => {
		if (!logtoId) return;
		setDeletingId(id);
		try {
			await removeLink({ logtoId, id: id as never });
			toast.success("Link deleted");
			setManageLink(null);
		} catch {
			toast.error("Failed to delete link");
		} finally {
			setDeletingId(null);
		}
	};

	const openLink = (url: string, title: string) => {
		window.open(url, "_blank", "noopener,noreferrer");
		toast.success(`Opened ${title}`);
	};

	const categories = useMemo(() => {
		if (!links) return [];
		const cats = [...new Set(links.map((l) => l.category))];
		return cats.sort();
	}, [links]);

	const filtered = useMemo(() => {
		if (!links) return [];
		return links
			.filter((l) => {
				const matchesSearch =
					!search ||
					l.title.toLowerCase().includes(search.toLowerCase()) ||
					l.category.toLowerCase().includes(search.toLowerCase()) ||
					(l.description &&
						l.description.toLowerCase().includes(search.toLowerCase()));
				const matchesCategory =
					categoryFilter === "all" || l.category === categoryFilter;
				return matchesSearch && matchesCategory;
			})
			.sort((a, b) => b._creationTime - a._creationTime);
	}, [links, search, categoryFilter]);

	const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
	const paginated = filtered.slice(
		(page - 1) * ITEMS_PER_PAGE,
		page * ITEMS_PER_PAGE,
	);

	const activeChips =
		categoryFilter !== "all"
			? [
					{
						id: "category",
						label: categoryFilter,
						onClear: () => {
							setCategoryFilter("all");
							setPage(1);
						},
					},
				]
			: [];

	const formFields = (
		<div className="space-y-4">
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="link-title">Title *</Label>
					<Input
						id="link-title"
						placeholder="e.g. IEEE UCSD Website"
						value={formTitle}
						onChange={(e) => setFormTitle(e.target.value)}
						className="h-11 text-base md:h-9 md:text-sm"
						autoComplete="off"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="link-url">URL *</Label>
					<Input
						id="link-url"
						placeholder="https://..."
						value={formUrl}
						onChange={(e) => setFormUrl(e.target.value)}
						className="h-11 text-base md:h-9 md:text-sm"
						inputMode="url"
						autoComplete="url"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="link-category">Category *</Label>
					<Input
						id="link-category"
						placeholder="e.g. General, Social Media"
						value={formCategory}
						onChange={(e) => setFormCategory(e.target.value)}
						className="h-11 text-base md:h-9 md:text-sm"
						autoComplete="off"
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="link-short">Short URL</Label>
					<Input
						id="link-short"
						placeholder="e.g. ieee-ucsd"
						value={formShortUrl}
						onChange={(e) => setFormShortUrl(e.target.value)}
						className="h-11 text-base md:h-9 md:text-sm"
						autoComplete="off"
					/>
				</div>
			</div>
			<div className="space-y-2">
				<Label htmlFor="link-description">Description</Label>
				<Textarea
					id="link-description"
					placeholder="Brief description..."
					value={formDescription}
					onChange={(e) => setFormDescription(e.target.value)}
					rows={2}
					className="text-base md:text-sm"
				/>
			</div>
		</div>
	);

	return (
		<DashboardPage width="wide" variant="list">
			<PageHeader
				title="Links"
				description="Quick access to important IEEE UCSD resources."
				hideTitleOnMobile
				actions={
					hasOfficerAccess ? (
						<Button
							onClick={openCreateModal}
							className="h-11 w-full sm:h-9 sm:w-auto"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Link
						</Button>
					) : undefined
				}
			/>

			{isMobile ? (
				<MobileFilters
					searchValue={search}
					onSearchChange={(value) => {
						setSearch(value);
						setPage(1);
					}}
					searchPlaceholder="Search links..."
					activeChips={activeChips}
					activeFilterCount={categoryFilter !== "all" ? 1 : 0}
					onClearAll={() => {
						setCategoryFilter("all");
						setPage(1);
					}}
					onReset={() => {
						setCategoryFilter("all");
						setPage(1);
					}}
					sheetTitle="Category"
					sheetContent={
						<div className="space-y-2">
							<Button
								variant={categoryFilter === "all" ? "default" : "outline"}
								className="h-11 w-full justify-start"
								onClick={() => setCategoryFilter("all")}
							>
								<Tag className="mr-2 h-4 w-4" />
								All categories
							</Button>
							{categories.map((cat) => (
								<Button
									key={cat}
									variant={categoryFilter === cat ? "default" : "outline"}
									className="h-11 w-full justify-start"
									onClick={() => setCategoryFilter(cat)}
								>
									{cat}
								</Button>
							))}
						</div>
					}
				/>
			) : (
				<div className="space-y-3">
					<div className="relative max-w-sm">
						<Input
							placeholder="Search links..."
							value={search}
							onChange={(e) => {
								setSearch(e.target.value);
								setPage(1);
							}}
							className="pl-3"
							type="search"
						/>
					</div>
					{categories.length > 0 && (
						<div className="flex flex-wrap gap-2">
							<Button
								variant={categoryFilter === "all" ? "default" : "outline"}
								size="sm"
								onClick={() => {
									setCategoryFilter("all");
									setPage(1);
								}}
							>
								<Tag className="mr-1 h-3 w-3" />
								All
							</Button>
							{categories.map((cat) => (
								<Button
									key={cat}
									variant={categoryFilter === cat ? "default" : "outline"}
									size="sm"
									onClick={() => {
										setCategoryFilter(cat);
										setPage(1);
									}}
								>
									{cat}
								</Button>
							))}
						</div>
					)}
				</div>
			)}

			{!links ? (
				isMobile ? (
					<div className="space-y-2">
						{[1, 2, 3, 4].map((i) => (
							<Skeleton key={i} className="h-14 w-full rounded-none" />
						))}
					</div>
				) : (
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
						{[1, 2, 3, 4, 5, 6].map((i) => (
							<Skeleton key={i} className="h-24 w-full rounded-md" />
						))}
					</div>
				)
			) : paginated.length > 0 ? (
				<>
					{isMobile ? (
						<MobileDataList>
							{paginated.map((link) => (
								<MobileDataListItem
									key={link._id}
									leading={
										<div className="flex size-10 items-center justify-center rounded-lg bg-ds-blue-100">
											<LinkIcon className="size-4 text-ds-blue-700" />
										</div>
									}
									title={link.title}
									subtitle={getLinkDomain(link.url)}
									status={
										<Badge
											className={cn(
												"text-[10px]",
												getCategoryColor(link.category),
											)}
										>
											{link.category}
										</Badge>
									}
									trailing={
										<ExternalLink
											className="size-4 text-muted-foreground"
											aria-hidden
										/>
									}
									showChevron={false}
									onClick={() => openLink(link.url, link.title)}
									actions={
										hasOfficerAccess ? (
											<Button
												variant="ghost"
												size="icon"
												className="size-11"
												aria-label={`Manage ${link.title}`}
												onClick={() => setManageLink(link)}
											>
												<MoreHorizontal className="size-4" />
											</Button>
										) : undefined
									}
								/>
							))}
						</MobileDataList>
					) : (
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
							{paginated.map((link) => (
								<div
									key={link._id}
									className="group relative flex items-start gap-3 rounded-md border bg-card p-4 transition-colors hover:bg-accent/50"
								>
									<a
										href={link.url}
										target="_blank"
										rel="noopener noreferrer"
										className="flex min-w-0 flex-1 items-start gap-3"
									>
										<div className="shrink-0 rounded-lg bg-ds-blue-100 p-2">
											<LinkIcon className="h-4 w-4 text-ds-blue-700" />
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<p className="truncate font-medium">{link.title}</p>
												<ExternalLink
													className="h-3 w-3 shrink-0 text-muted-foreground"
													aria-hidden
												/>
											</div>
											{link.description && (
												<p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
													{link.description}
												</p>
											)}
											<Badge
												className={`mt-2 text-xs ${getCategoryColor(link.category)}`}
											>
												{link.category}
											</Badge>
										</div>
									</a>
									{hasOfficerAccess && (
										<div className="flex shrink-0 gap-1">
											<Button
												variant="ghost"
												size="sm"
												className="h-9 w-9 p-0"
												onClick={(e) => {
													e.preventDefault();
													openEditModal(link);
												}}
												aria-label={`Edit ${link.title}`}
											>
												<Pencil className="h-3.5 w-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="sm"
												className="h-9 w-9 p-0"
												disabled={deletingId === link._id}
												onClick={(e) => {
													e.preventDefault();
													handleDelete(link._id);
												}}
												aria-label={`Delete ${link.title}`}
											>
												{deletingId === link._id ? (
													<Loader2 className="h-3.5 w-3.5 animate-spin" />
												) : (
													<Trash2 className="h-3.5 w-3.5 text-destructive" />
												)}
											</Button>
										</div>
									)}
								</div>
							))}
						</div>
					)}
					<Pagination
						currentPage={page}
						totalPages={totalPages}
						onPageChange={setPage}
					/>
				</>
			) : (
				<EmptyState
					icon={<LinkIcon className="size-10 opacity-50" />}
					title="No links found"
					description={
						search || categoryFilter !== "all"
							? "Try adjusting your search or filters."
							: "Links will appear here when added."
					}
				/>
			)}

			<ResponsiveOverlay
				open={modalOpen}
				onOpenChange={(open) => {
					if (!open) {
						setModalOpen(false);
						setEditingId(null);
						resetForm();
					}
				}}
				title={editingId ? "Edit Link" : "Add New Link"}
				variant="large-sheet"
				footer={
					<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
						<Button
							variant="outline"
							className="h-11 sm:h-9"
							onClick={() => {
								setModalOpen(false);
								setEditingId(null);
								resetForm();
							}}
						>
							Cancel
						</Button>
						<Button
							className="h-11 sm:h-9"
							onClick={handleSubmit}
							disabled={isSubmitting}
						>
							{isSubmitting && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							{editingId ? "Update Link" : "Create Link"}
						</Button>
					</div>
				}
			>
				{formFields}
			</ResponsiveOverlay>

			{hasOfficerAccess && (
				<ResponsiveOverlay
					open={Boolean(manageLink)}
					onOpenChange={(open) => {
						if (!open) setManageLink(null);
					}}
					title={manageLink?.title ?? "Manage link"}
					description={manageLink ? getLinkDomain(manageLink.url) : undefined}
					variant="sheet"
				>
					<div className="space-y-2 pb-2">
						<Button
							variant="outline"
							className="h-12 w-full justify-start gap-3"
							onClick={() => {
								if (manageLink) openLink(manageLink.url, manageLink.title);
							}}
						>
							<ExternalLink className="size-4" />
							Open link
						</Button>
						<Button
							variant="outline"
							className="h-12 w-full justify-start gap-3"
							onClick={() => {
								if (manageLink) openEditModal(manageLink);
							}}
						>
							<Pencil className="size-4" />
							Edit
						</Button>
						<Button
							variant="outline"
							className="h-12 w-full justify-start gap-3 text-destructive hover:text-destructive"
							disabled={deletingId === manageLink?._id}
							onClick={() => {
								if (manageLink) handleDelete(manageLink._id);
							}}
						>
							{deletingId === manageLink?._id ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Trash2 className="size-4" />
							)}
							Delete
						</Button>
					</div>
				</ResponsiveOverlay>
			)}
		</DashboardPage>
	);
}
