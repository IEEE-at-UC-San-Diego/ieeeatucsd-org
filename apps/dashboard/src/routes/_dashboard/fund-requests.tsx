import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowLeft,
	Briefcase,
	CheckCircle,
	Clock,
	Download,
	Edit,
	ExternalLink,
	Eye,
	FileText,
	History,
	Plus,
	Search,
	Tag,
	Trash2,
	TrendingUp,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BudgetLogModal } from "@/components/dashboard/fund-requests/BudgetLogModal";
import { BudgetTrackingCard } from "@/components/dashboard/fund-requests/BudgetTrackingCard";
import { FundRequestFormModal } from "@/components/dashboard/fund-requests/FundRequestFormModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import {
	CATEGORY_LABELS,
	DEPARTMENT_LABELS,
	type FundRequestCategory,
	type FundRequestDepartment,
	type FundRequestStatus,
	formatCurrency,
	formatDate,
	STATUS_COLORS,
	STATUS_LABELS,
} from "@/types/fund-requests";

export const Route = createFileRoute("/_dashboard/fund-requests")({
	component: FundRequestsPage,
});

const ITEMS_PER_PAGE = 6;

const statusColors: Record<string, string> = {
	draft: "bg-gray-100 text-gray-800",
	submitted: "bg-blue-100 text-blue-800",
	needs_info: "bg-yellow-100 text-yellow-800",
	approved: "bg-green-100 text-green-800",
	denied: "bg-red-100 text-red-800",
	completed: "bg-purple-100 text-purple-800",
};

const statusIconColors: Record<string, string> = {
	draft: "bg-muted text-muted-foreground",
	submitted: "bg-blue-500/10 text-blue-700",
	needs_info: "bg-yellow-500/10 text-yellow-700",
	approved: "bg-green-500/10 text-green-700",
	denied: "bg-red-500/10 text-red-700",
	completed: "bg-purple-500/10 text-purple-700",
};

const getStatusIcon = (status: FundRequestStatus) => {
	switch (status) {
		case "draft":
			return <FileText className="w-3.5 h-3.5" />;
		case "submitted":
			return <Clock className="w-3.5 h-3.5" />;
		case "needs_info":
			return <AlertCircle className="w-3.5 h-3.5" />;
		case "approved":
			return <CheckCircle className="w-3.5 h-3.5" />;
		case "denied":
			return <XCircle className="w-3.5 h-3.5" />;
		case "completed":
			return <CheckCircle className="w-3.5 h-3.5" />;
		default:
			return <FileText className="w-3.5 h-3.5" />;
	}
};

type FilterTab = "all" | FundRequestStatus;
type FundRequestRecord = Doc<"fundRequests">;
type PageView = "list" | "form" | "detail";

function FundRequestDetailPage({
	request,
	onBack,
	onEdit,
}: {
	request: FundRequestRecord;
	onBack: () => void;
	onEdit?: () => void;
}) {
	const canEdit = request.status === "draft" || request.status === "needs_info";
	const vendorLinks = request.vendorLinks || [];
	const attachments = request.attachments || [];
	const auditLogs = request.auditLogs || [];

	return (
		<div className="w-full max-w-[1600px] mx-auto space-y-6 p-4 sm:p-6">
			<div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-start lg:justify-between">
				<div className="flex items-start gap-3 min-w-0">
					<Button
						variant="ghost"
						size="sm"
						onClick={onBack}
						className="mt-0.5 h-9 shrink-0"
					>
						<ArrowLeft className="h-4 w-4 mr-1" />
						Back
					</Button>
					<div className="min-w-0 space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<h1
								className="min-w-0 text-2xl font-bold tracking-tight sm:text-3xl"
								title={request.title}
							>
								{request.title}
							</h1>
							<Badge
								className={`${STATUS_COLORS[request.status]} px-2 py-0.5`}
								variant="secondary"
							>
								<span className="flex items-center gap-1.5 text-xs font-medium">
									{getStatusIcon(request.status as FundRequestStatus)}
									{STATUS_LABELS[request.status]}
								</span>
							</Badge>
						</div>
						<p className="text-sm text-muted-foreground">
							Created on {formatDate(request.createdAt)}
						</p>
					</div>
				</div>
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
					<div className="rounded-lg border bg-card px-4 py-2 sm:text-right">
						<p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
							Amount
						</p>
						<p className="text-xl font-bold text-green-600">
							{formatCurrency(request.amount)}
						</p>
					</div>
					{canEdit && onEdit && (
						<Button onClick={onEdit} className="h-10">
							<Edit className="w-4 h-4 mr-2" />
							{request.status === "needs_info"
								? "Respond & Resubmit"
								: "Edit Request"}
						</Button>
					)}
				</div>
			</div>

			{request.status === "needs_info" && request.infoRequestNotes && (
				<div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 flex gap-3">
					<AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
					<div>
						<h2 className="font-semibold text-yellow-800 text-sm mb-0.5">
							Information Requested
						</h2>
						<p className="text-xs text-yellow-700 leading-relaxed">
							{request.infoRequestNotes}
						</p>
					</div>
				</div>
			)}

			{request.status === "denied" && request.reviewNotes && (
				<div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
					<XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
					<div>
						<h2 className="font-semibold text-red-800 text-sm mb-1">
							Request Denied
						</h2>
						<p className="text-sm text-red-700 leading-relaxed">
							{request.reviewNotes}
						</p>
					</div>
				</div>
			)}

			{request.status === "approved" && (
				<div className="rounded-xl border border-green-200 bg-green-50 p-4 flex gap-3">
					<CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
					<div>
						<h2 className="font-semibold text-green-800 text-sm mb-1">
							Request Approved
						</h2>
						{request.reviewNotes && (
							<p className="text-sm text-green-700 leading-relaxed">
								{request.reviewNotes}
							</p>
						)}
					</div>
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
				<div className="space-y-6">
					<Card className="border-border/60 shadow-sm">
						<CardContent className="p-5 space-y-3">
							<h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
								<FileText className="w-3.5 h-3.5" /> Purpose
							</h2>
							<p className="text-sm leading-relaxed whitespace-pre-wrap">
								{request.purpose}
							</p>
						</CardContent>
					</Card>

					{request.infoResponseNotes && (
						<Card className="border-yellow-200/70 bg-yellow-50/50 shadow-sm">
							<CardContent className="p-5 space-y-2">
								<h2 className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">
									Response to Info Request
								</h2>
								<p className="text-sm leading-relaxed whitespace-pre-wrap">
									{request.infoResponseNotes}
								</p>
							</CardContent>
						</Card>
					)}

					<Card className="border-border/60 shadow-sm">
						<CardContent className="p-5 space-y-3">
							<h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
								<ExternalLink className="w-3.5 h-3.5" /> Links
							</h2>
							{vendorLinks.length > 0 ? (
								<div className="divide-y rounded-md border">
									{vendorLinks.map((link) => (
										<div
											key={link.id}
											className="flex items-center justify-between gap-3 p-3"
										>
											<div className="min-w-0">
												<p className="text-sm font-medium truncate">
													{link.itemName || "Untitled item"}
												</p>
												<p className="text-xs text-muted-foreground truncate">
													Qty {link.quantity || 1}
													{link.url ? ` · ${link.url}` : ""}
												</p>
											</div>
											{link.url && (
												<Button
													variant="ghost"
													size="icon"
													className="h-9 w-9 shrink-0"
													aria-label={`Open ${link.itemName || "vendor link"}`}
													asChild
												>
													<a
														href={link.url}
														target="_blank"
														rel="noopener noreferrer"
													>
														<ExternalLink className="w-4 h-4" />
													</a>
												</Button>
											)}
										</div>
									))}
								</div>
							) : (
								<p className="text-sm text-muted-foreground italic">
									No links provided.
								</p>
							)}
						</CardContent>
					</Card>

					{auditLogs.length > 0 && (
						<Card className="border-border/60 shadow-sm">
							<CardContent className="p-5">
								<h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-4">
									<History className="w-3.5 h-3.5" /> Activity History
								</h2>
								<div className="space-y-0 pl-2">
									{auditLogs.map((log) => (
										<div
											key={log.id}
											className="relative pl-5 pb-5 last:pb-0 border-l border-border/60 last:border-l-0"
										>
											<div className="absolute top-0.5 left-0 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-background bg-muted-foreground/30 z-10 box-content" />
											<p className="text-xs font-medium">
												<span className="capitalize">
													{log.action.replace(/_/g, " ")}
												</span>
												{log.performedByName && (
													<span className="text-muted-foreground font-normal">
														{" "}
														by {log.performedByName}
													</span>
												)}
											</p>
											<p className="text-[10px] text-muted-foreground">
												{formatDate(log.timestamp)}
											</p>
											{log.notes && (
												<p className="text-xs bg-muted/40 px-2 py-1 rounded inline-block mt-1">
													{log.notes}
												</p>
											)}
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					)}
				</div>

				<div className="space-y-6">
					<Card className="border-border/60 shadow-sm">
						<CardContent className="p-5 space-y-3">
							<h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
								Details
							</h2>
							<div className="space-y-3 text-sm">
								<div className="flex items-center justify-between gap-3">
									<span className="text-muted-foreground flex items-center gap-1.5">
										<Briefcase className="w-3.5 h-3.5" />
										Department
									</span>
									<span className="font-medium text-right">
										{request.department
											? DEPARTMENT_LABELS[
													request.department as keyof typeof DEPARTMENT_LABELS
												]
											: "N/A"}
									</span>
								</div>
								<div className="flex items-center justify-between gap-3">
									<span className="text-muted-foreground flex items-center gap-1.5">
										<Tag className="w-3.5 h-3.5" />
										Category
									</span>
									<span className="font-medium text-right">
										{CATEGORY_LABELS[
											request.category as keyof typeof CATEGORY_LABELS
										] || request.category}
									</span>
								</div>
								<div className="flex items-center justify-between gap-3">
									<span className="text-muted-foreground flex items-center gap-1.5">
										<Clock className="w-3.5 h-3.5" />
										Created
									</span>
									<span className="font-medium text-right">
										{formatDate(request.createdAt)}
									</span>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="border-border/60 shadow-sm">
						<CardContent className="p-5 space-y-3">
							<h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
								<Download className="w-3.5 h-3.5" /> Attachments
							</h2>
							{attachments.length > 0 ? (
								<div className="space-y-2">
									{attachments.map((attachment) => (
										<div
											key={attachment.id}
											className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2"
										>
											<div className="min-w-0">
												<p className="text-xs font-medium truncate">
													{attachment.name}
												</p>
												<p className="text-[10px] text-muted-foreground">
													{(attachment.size / 1024).toFixed(1)} KB
												</p>
											</div>
											<div className="flex gap-1">
												<Button
													variant="ghost"
													size="icon"
													className="h-9 w-9"
													aria-label={`View ${attachment.name}`}
													asChild
												>
													<a
														href={attachment.url}
														target="_blank"
														rel="noopener noreferrer"
													>
														<Eye className="w-3.5 h-3.5" />
													</a>
												</Button>
												<Button
													variant="ghost"
													size="icon"
													className="h-9 w-9"
													aria-label={`Download ${attachment.name}`}
													asChild
												>
													<a href={attachment.url} download={attachment.name}>
														<Download className="w-3.5 h-3.5" />
													</a>
												</Button>
											</div>
										</div>
									))}
								</div>
							) : (
								<p className="text-sm text-muted-foreground italic">
									No attachments.
								</p>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

function FundRequestsPage() {
	const { logtoId } = useAuth();
	const { hasOfficerAccess } = usePermissions();
	const requests = useAuthedQuery(
		api.fundRequests.listMine,
		logtoId ? { logtoId } : "skip",
	);
	const deleteFundRequest = useAuthedMutation(api.fundRequests.deleteRequest);

	const [view, setView] = useState<PageView>("list");
	const [isBudgetLogOpen, setIsBudgetLogOpen] = useState(false);
	const [selectedRequest, setSelectedRequest] =
		useState<FundRequestRecord | null>(null);
	const [isEditMode, setIsEditMode] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedTab, setSelectedTab] = useState<FilterTab>("all");
	const [page, setPage] = useState(1);
	const [isDeleting, setIsDeleting] = useState(false);

	// Budget stats queries
	const budgetStatsEvents = useAuthedQuery(
		api.fundRequests.getBudgetStats,
		hasOfficerAccess && logtoId ? { logtoId, department: "events" } : "skip",
	);
	const budgetStatsProjects = useAuthedQuery(
		api.fundRequests.getBudgetStats,
		hasOfficerAccess && logtoId ? { logtoId, department: "projects" } : "skip",
	);
	const budgetStatsInternal = useAuthedQuery(
		api.fundRequests.getBudgetStats,
		hasOfficerAccess && logtoId ? { logtoId, department: "internal" } : "skip",
	);

	// Budget adjustments queries
	const adjustmentsEvents = useAuthedQuery(
		api.fundRequests.getBudgetAdjustments,
		hasOfficerAccess && logtoId ? { logtoId, department: "events" } : "skip",
	);
	const adjustmentsProjects = useAuthedQuery(
		api.fundRequests.getBudgetAdjustments,
		hasOfficerAccess && logtoId ? { logtoId, department: "projects" } : "skip",
	);
	const adjustmentsInternal = useAuthedQuery(
		api.fundRequests.getBudgetAdjustments,
		hasOfficerAccess && logtoId ? { logtoId, department: "internal" } : "skip",
	);

	// Fund requests by department for budget log
	const requestsEvents = useAuthedQuery(
		api.fundRequests.listByDepartment,
		hasOfficerAccess && logtoId && budgetStatsEvents?.startDate
			? {
					logtoId,
					department: "events",
					startDate: budgetStatsEvents.startDate,
				}
			: "skip",
	);
	const requestsProjects = useAuthedQuery(
		api.fundRequests.listByDepartment,
		hasOfficerAccess && logtoId && budgetStatsProjects?.startDate
			? {
					logtoId,
					department: "projects",
					startDate: budgetStatsProjects.startDate,
				}
			: "skip",
	);
	const requestsInternal = useAuthedQuery(
		api.fundRequests.listByDepartment,
		hasOfficerAccess && logtoId && budgetStatsInternal?.startDate
			? {
					logtoId,
					department: "internal",
					startDate: budgetStatsInternal.startDate,
				}
			: "skip",
	);

	// Budget log modal data
	const [selectedBudgetDepartment, setSelectedBudgetDepartment] =
		useState<FundRequestDepartment>("events");

	const getSelectedRequestFormData = () => {
		if (!selectedRequest) return undefined;

		return {
			title: selectedRequest.title,
			purpose: selectedRequest.purpose,
			category: selectedRequest.category as FundRequestCategory,
			department: selectedRequest.department as FundRequestDepartment,
			amount: String(selectedRequest.amount),
			vendorLinks: selectedRequest.vendorLinks?.map((link) => ({
				id: link.id,
				url: link.url,
				itemName: link.itemName,
				quantity: link.quantity,
			})),
			_id: selectedRequest._id,
		};
	};

	const getFilteredRequests = () => {
		if (!requests) return [];

		let filtered = requests;

		// Filter by status tab
		if (selectedTab !== "all") {
			filtered = filtered.filter((r) => r.status === selectedTab);
		}

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(r) =>
					r.title.toLowerCase().includes(query) ||
					r.purpose.toLowerCase().includes(query) ||
					CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS]
						?.toLowerCase()
						.includes(query),
			);
		}

		return filtered;
	};

	const filteredRequests = getFilteredRequests();
	const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
	const paginatedRequests = filteredRequests.slice(
		(page - 1) * ITEMS_PER_PAGE,
		page * ITEMS_PER_PAGE,
	);

	const getStats = () => {
		if (!requests)
			return {
				total: 0,
				draft: 0,
				submitted: 0,
				needsInfo: 0,
				approved: 0,
				denied: 0,
				completed: 0,
				totalAmount: 0,
			};
		return {
			total: requests.length,
			draft: requests.filter((r) => r.status === "draft").length,
			submitted: requests.filter((r) => r.status === "submitted").length,
			needsInfo: requests.filter((r) => r.status === "needs_info").length,
			approved: requests.filter((r) => r.status === "approved").length,
			denied: requests.filter((r) => r.status === "denied").length,
			completed: requests.filter((r) => r.status === "completed").length,
			totalAmount: requests
				.filter((r) => r.status === "approved" || r.status === "completed")
				.reduce((sum, r) => sum + r.amount, 0),
		};
	};

	const stats = getStats();

	const handleNewRequest = () => {
		setSelectedRequest(null);
		setIsEditMode(false);
		setView("form");
	};

	const handleEditRequest = (request: FundRequestRecord) => {
		setSelectedRequest(request);
		setIsEditMode(true);
		setView("form");
	};

	const handleViewRequest = (request: FundRequestRecord) => {
		setSelectedRequest(request);
		setView("detail");
	};

	const handleDeleteRequest = async (request: FundRequestRecord) => {
		if (!logtoId) return;
		setIsDeleting(true);
		try {
			await deleteFundRequest({ logtoId, id: request._id });
			toast.success("Fund request deleted successfully");
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to delete fund request";
			toast.error(message);
		} finally {
			setIsDeleting(false);
		}
	};

	const handleFormClose = () => {
		setView("list");
		setSelectedRequest(null);
		setIsEditMode(false);
	};

	const handleFormSuccess = () => {
		handleFormClose();
		toast.success(
			isEditMode
				? "Fund request updated successfully"
				: "Fund request created successfully",
		);
	};

	const getBudgetRequestsForLog = (dept: FundRequestDepartment) => {
		switch (dept) {
			case "events":
				return requestsEvents || [];
			case "projects":
				return requestsProjects || [];
			case "internal":
				return requestsInternal || [];
			default:
				return [];
		}
	};

	const getBudgetAdjustmentsForLog = (dept: FundRequestDepartment) => {
		switch (dept) {
			case "events":
				return adjustmentsEvents || [];
			case "projects":
				return adjustmentsProjects || [];
			case "internal":
				return adjustmentsInternal || [];
			default:
				return [];
		}
	};

	if (view === "form") {
		return (
			<div className="h-[calc(100vh-3rem)] flex flex-col overflow-hidden">
				<div className="border-b px-4 py-4 sm:px-6 flex items-start gap-3 shrink-0">
					<Button
						variant="ghost"
						size="sm"
						onClick={handleFormClose}
						className="h-9 shrink-0"
					>
						<ArrowLeft className="h-4 w-4 mr-1" />
						Back
					</Button>
					<div className="min-w-0">
						<h1 className="text-xl font-bold tracking-tight sm:text-2xl">
							{isEditMode ? "Edit Fund Request" : "New Fund Request"}
						</h1>
						<p className="text-sm text-muted-foreground">
							Complete each step to submit a clear, review-ready request.
						</p>
					</div>
				</div>
				<div className="flex-1 min-h-0">
					<FundRequestFormModal
						isOpen
						onClose={handleFormClose}
						onSuccess={handleFormSuccess}
						initialData={getSelectedRequestFormData()}
						isEditMode={isEditMode}
						showHeader={false}
						renderMode="page"
						logtoId={logtoId ?? undefined}
						editRequestId={selectedRequest?._id}
					/>
				</div>
			</div>
		);
	}

	if (view === "detail" && selectedRequest) {
		return (
			<FundRequestDetailPage
				request={selectedRequest}
				onBack={() => {
					setSelectedRequest(null);
					setIsEditMode(false);
					setView("list");
				}}
				onEdit={
					selectedRequest.status === "draft" ||
					selectedRequest.status === "needs_info"
						? () => handleEditRequest(selectedRequest)
						: undefined
				}
			/>
		);
	}

	return (
		<>
			<div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
				{/* Header */}
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
					<div className="min-w-0">
						<h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
							Fund Requests
						</h1>
						<p className="text-sm sm:text-base text-muted-foreground mt-1 max-w-2xl">
							Request funding, track review status, and keep department budgets
							organized.
						</p>
					</div>
					<Button
						onClick={handleNewRequest}
						size="lg"
						className="w-full font-medium shadow-sm sm:w-auto"
					>
						<Plus className="h-5 w-5 mr-2" />
						New Request
					</Button>
				</div>

				{/* Budget Tracking Section */}
				{hasOfficerAccess && (
					<div className="space-y-4">
						<div className="flex items-center gap-2">
							<TrendingUp className="w-5 h-5 text-primary" />
							<h2 className="text-lg font-semibold text-foreground">
								Department Budgets
							</h2>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
							{(
								["events", "projects", "internal"] as FundRequestDepartment[]
							).map((dept) => {
								const budgetStats =
									dept === "events"
										? budgetStatsEvents
										: dept === "projects"
											? budgetStatsProjects
											: budgetStatsInternal;

								return (
									<BudgetTrackingCard
										key={dept}
										department={dept}
										totalBudget={budgetStats?.totalBudget || 0}
										remainingBudget={budgetStats?.remainingBudget || 0}
										pendingBudget={budgetStats?.pendingBudget || 0}
										percentUsed={budgetStats?.percentUsed || 0}
										isConfigured={budgetStats?.isConfigured || false}
										onClick={() => {
											setSelectedBudgetDepartment(dept);
											setIsBudgetLogOpen(true);
										}}
									/>
								);
							})}
						</div>
					</div>
				)}

				{/* Filters and Search */}
				<div className="sticky top-0 z-20 -mx-4 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
					<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
						<Tabs
							value={selectedTab}
							onValueChange={(v) => {
								setSelectedTab(v as FilterTab);
								setPage(1);
							}}
							className="w-full min-w-0 lg:w-auto"
						>
							<div className="-mx-1 overflow-x-auto px-1 pb-1">
								<TabsList className="w-max">
									<TabsTrigger value="all" className="gap-2">
										<span>All Requests</span>
										<Badge variant="secondary">{stats.total}</Badge>
									</TabsTrigger>
									<TabsTrigger value="draft" className="gap-2">
										<span>Draft</span>
										{stats.draft > 0 && (
											<Badge variant="secondary">{stats.draft}</Badge>
										)}
									</TabsTrigger>
									<TabsTrigger value="submitted" className="gap-2">
										<span>Submitted</span>
										{stats.submitted > 0 && (
											<Badge
												variant="secondary"
												className="bg-blue-500/10 text-blue-700"
											>
												{stats.submitted}
											</Badge>
										)}
									</TabsTrigger>
									<TabsTrigger value="needs_info" className="gap-2">
										<span>Needs Info</span>
										{stats.needsInfo > 0 && (
											<Badge
												variant="secondary"
												className="bg-yellow-500/10 text-yellow-700"
											>
												{stats.needsInfo}
											</Badge>
										)}
									</TabsTrigger>
									<TabsTrigger value="approved" className="gap-2">
										<span>Approved</span>
										{stats.approved > 0 && (
											<Badge
												variant="secondary"
												className="bg-green-500/10 text-green-700"
											>
												{stats.approved}
											</Badge>
										)}
									</TabsTrigger>
									<TabsTrigger value="denied" className="gap-2">
										<span>Denied</span>
										{stats.denied > 0 && (
											<Badge
												variant="secondary"
												className="bg-red-500/10 text-red-700"
											>
												{stats.denied}
											</Badge>
										)}
									</TabsTrigger>
									<TabsTrigger value="completed" className="gap-2">
										<span>Completed</span>
										{stats.completed > 0 && (
											<Badge
												variant="secondary"
												className="bg-purple-500/10 text-purple-700"
											>
												{stats.completed}
											</Badge>
										)}
									</TabsTrigger>
								</TabsList>
							</div>
						</Tabs>
						<div className="relative w-full lg:max-w-sm">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
							<Input
								placeholder="Search requests..."
								value={searchQuery}
								onChange={(e) => {
									setSearchQuery(e.target.value);
									setPage(1);
								}}
								className="pl-10"
							/>
						</div>
					</div>
				</div>

				{/* Request List - Card Grid */}
				{!requests ? (
					<div className="grid grid-cols-1 gap-4">
						{[1, 2, 3, 4, 5, 6].map((i) => (
							<Skeleton key={i} className="h-32 w-full rounded-xl" />
						))}
					</div>
				) : filteredRequests.length === 0 ? (
					<Card className="border-dashed border-2 border-border/50 bg-muted/30">
						<CardContent className="py-12 text-center">
							<div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 text-muted-foreground">
								<FileText className="w-8 h-8" />
							</div>
							<h3 className="text-xl font-semibold text-foreground mb-2">
								{requests.length === 0
									? "No fund requests yet"
									: "No matching requests found"}
							</h3>
							<p className="text-muted-foreground max-w-sm mx-auto mb-6">
								{requests.length === 0
									? "Create your first fund request to get started with your project funding."
									: "Try adjusting your filters or search query to find what you are looking for."}
							</p>
							{requests.length === 0 && (
								<Button onClick={handleNewRequest}>
									<Plus className="h-4 w-4 mr-2" />
									New Fund Request
								</Button>
							)}
						</CardContent>
					</Card>
				) : (
					<div className="grid grid-cols-1 gap-4">
						{paginatedRequests.map((r) => (
							<Card
								key={r._id}
								className="group w-full cursor-pointer border-border/60 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40 focus-within:border-primary/40"
								onClick={() => handleViewRequest(r)}
							>
								<CardContent className="p-4">
									<div className="flex flex-col gap-3 md:flex-row md:items-center">
										{/* Main Content */}
										<div className="flex-1 min-w-0 space-y-1 w-full">
											<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
												<div
													className={cn(
														"flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
														statusIconColors[r.status] ||
															"bg-muted text-muted-foreground",
													)}
												>
													{getStatusIcon(r.status as FundRequestStatus)}
												</div>
												<h3
													className="min-w-0 max-w-full truncate text-base font-semibold text-foreground"
													title={r.title}
												>
													{r.title}
												</h3>
												<Badge
													className={`${statusColors[r.status] || ""} h-5 px-2 py-0.5 text-[10px]`}
													variant="secondary"
												>
													<span className="flex items-center gap-1.5">
														<span className="font-medium">
															{STATUS_LABELS[
																r.status as keyof typeof STATUS_LABELS
															] || r.status}
														</span>
													</span>
												</Badge>
											</div>

											<p className="text-sm text-muted-foreground line-clamp-2 md:line-clamp-1">
												{r.purpose}
											</p>

											<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
												<div className="flex items-center gap-1.5 bg-muted px-2 py-0.5 rounded">
													<span className="font-semibold text-foreground text-xs">
														{formatCurrency(r.amount)}
													</span>
												</div>
												<div className="flex items-center gap-1.5">
													<div className="w-1 h-1 rounded-full bg-muted-foreground" />
													<span className="text-xs">
														{CATEGORY_LABELS[
															r.category as keyof typeof CATEGORY_LABELS
														] || r.category}
													</span>
												</div>
												<div className="flex items-center gap-1.5">
													<Clock className="w-3.5 h-3.5" />
													<span className="text-xs">
														{formatDate(r.createdAt)}
													</span>
												</div>
											</div>

											{r.status === "needs_info" && r.infoRequestNotes && (
												<div className="mt-2 p-2 bg-yellow-50/50 rounded border border-yellow-200/50 flex items-start gap-2">
													<AlertCircle className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
													<div>
														<span className="text-xs font-semibold text-yellow-700 block mb-0.5">
															Action Required
														</span>
														<p className="text-xs text-yellow-800 line-clamp-1">
															{r.infoRequestNotes}
														</p>
													</div>
												</div>
											)}
										</div>

										{/* Actions */}
										<div className="flex items-center gap-1 self-end md:self-center flex-shrink-0 border-t md:border-t-0 border-border pt-2 md:pt-0 w-full md:w-auto justify-end">
											{(r.status === "draft" || r.status === "needs_info") && (
												<Button
													variant="ghost"
													size="icon"
													onClick={(e) => {
														e.stopPropagation();
														handleEditRequest(r);
													}}
													className="h-9 w-9 bg-primary/10 text-primary hover:bg-primary/20"
													aria-label={`Edit ${r.title}`}
												>
													<Edit className="w-3.5 h-3.5" />
												</Button>
											)}
											{r.status === "draft" && (
												<Button
													variant="ghost"
													size="icon"
													onClick={(e) => {
														e.stopPropagation();
														handleDeleteRequest(r);
													}}
													disabled={isDeleting}
													className="h-9 w-9 bg-destructive/10 text-destructive hover:bg-destructive/20"
													aria-label={`Delete ${r.title}`}
												>
													<Trash2 className="w-3.5 h-3.5" />
												</Button>
											)}
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				)}

				{/* Pagination */}
				{filteredRequests.length > ITEMS_PER_PAGE && (
					<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
						<p className="text-sm text-muted-foreground">
							Showing {(page - 1) * ITEMS_PER_PAGE + 1} to{" "}
							{Math.min(page * ITEMS_PER_PAGE, filteredRequests.length)} of{" "}
							{filteredRequests.length} requests
						</p>
						<Pagination
							currentPage={page}
							totalPages={totalPages}
							onPageChange={setPage}
						/>
					</div>
				)}
			</div>

			{/* Budget Log Modal (Officer Only) */}
			{hasOfficerAccess && (
				<BudgetLogModal
					isOpen={isBudgetLogOpen}
					onClose={() => setIsBudgetLogOpen(false)}
					department={selectedBudgetDepartment}
					requests={getBudgetRequestsForLog(selectedBudgetDepartment)}
					adjustments={getBudgetAdjustmentsForLog(selectedBudgetDepartment)}
					budgetStartDate={
						selectedBudgetDepartment === "events"
							? budgetStatsEvents?.startDate
								? new Date(budgetStatsEvents.startDate)
								: undefined
							: selectedBudgetDepartment === "projects"
								? budgetStatsProjects?.startDate
									? new Date(budgetStatsProjects.startDate)
									: undefined
								: budgetStatsInternal?.startDate
									? new Date(budgetStatsInternal.startDate)
									: undefined
					}
				/>
			)}
		</>
	);
}
