import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowLeft,
	CheckCircle,
	ChevronDown,
	ChevronUp,
	Clock,
	ExternalLink,
	FileText,
	Loader2,
	Search,
	Settings,
	XCircle,
} from "lucide-react";
import { type ReactElement, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import { SummaryStrip } from "@/components/dashboard/SummaryStrip";
import BudgetManagementModal from "@/components/fund-requests/BudgetManagementModal";
import {
	MobileDataList,
	MobileDataListItem,
	useMobileShell,
} from "@/components/mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
	formatCurrencyUSD,
	formatDateDisplay,
	formatDateTimeDisplay,
	formatFileSize,
} from "@/lib/formatters";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";
import { sendNotification } from "@/lib/send-notification";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
	view: z.enum(["list", "detail"]).catch("list"),
	id: z.string().optional().catch(undefined),
	q: z.string().catch(""),
	status: z
		.enum(["all", "submitted", "needs_info", "approved", "denied", "completed"])
		.catch("all"),
	department: z
		.enum(["all", "events", "projects", "internal", "other"])
		.catch("all"),
	page: z.number().int().min(1).catch(1),
});

type ManageFundRequestsSearch = z.infer<typeof searchSchema>;

const STATUS_FILTERS: Array<{
	value: ManageFundRequestsSearch["status"];
	label: string;
}> = [
	{ value: "all", label: "All" },
	{ value: "submitted", label: "Submitted" },
	{ value: "needs_info", label: "Needs Info" },
	{ value: "approved", label: "Approved" },
	{ value: "denied", label: "Denied" },
	{ value: "completed", label: "Completed" },
];

const DEPARTMENT_FILTERS: Array<{
	value: ManageFundRequestsSearch["department"];
	label: string;
}> = [
	{ value: "all", label: "All Depts" },
	{ value: "events", label: "Events" },
	{ value: "projects", label: "Projects" },
	{ value: "internal", label: "Internal" },
	{ value: "other", label: "Other" },
];

export const Route = createFileRoute("/_dashboard/manage-fund-requests")({
	validateSearch: searchSchema,
	loader: (ctx) =>
		prefetchAuthedQuery(api.fundRequests.listAll, undefined, ctx),
	component: ManageFundRequestsPage,
});

const ITEMS_PER_PAGE = 10;

const STATUS_COLORS: Record<string, string> = {
	submitted: "bg-ds-blue-100 text-tone-info",
	needs_info: "bg-ds-amber-100 text-tone-warning",
	approved: "bg-ds-green-100 text-tone-success",
	denied: "bg-ds-red-100 text-tone-danger",
	completed: "bg-ds-purple-100 text-tone-purple",
};

const STATUS_LABELS: Record<string, string> = {
	submitted: "Submitted",
	needs_info: "Needs Info",
	approved: "Approved",
	denied: "Denied",
	completed: "Completed",
};

const DEPARTMENT_LABELS: Record<string, string> = {
	events: "Events",
	projects: "Projects",
	internal: "Internal",
	other: "Other",
};

const STATUS_ICONS: Record<string, ReactElement> = {
	submitted: <Clock className="w-3.5 h-3.5" />,
	needs_info: <AlertCircle className="w-3.5 h-3.5" />,
	approved: <CheckCircle className="w-3.5 h-3.5" />,
	denied: <XCircle className="w-3.5 h-3.5" />,
	completed: <CheckCircle className="w-3.5 h-3.5" />,
};

const FUND_SOURCE_LABELS: Record<string, string> = {
	ece: "ECE Department",
	ieee: "IEEE Funding",
	other: "Other",
};

interface FundRequestData {
	_id: string;
	title: string;
	purpose: string;
	amount: number;
	category: string;
	department: string;
	status: string;
	fundSource?: "ece" | "ieee" | "other";
	submittedByName?: string;
	submittedByEmail?: string;
	createdAt?: number;
	submittedAt?: number;
	vendorLinks?: Array<{ id: string; url: string; itemName?: string }>;
	attachments?: Array<{ id: string; url: string; name: string; size: number }>;
	reviewNotes?: string;
	infoRequestNotes?: string;
	auditLogs?: Array<{
		id: string;
		action: string;
		performedBy: string;
		performedByName?: string;
		timestamp: number;
		newStatus?: string;
		notes?: string;
	}>;
}

function reviewChoiceForStatus(status: string) {
	if (status === "approved") return "approve";
	if (status === "denied") return "deny";
	if (status === "needs_info") return "needs_info";
	return "unchanged";
}

function statusFromReviewChoice(choice: string, current: string) {
	if (choice === "approve") return "approved";
	if (choice === "deny") return "denied";
	if (choice === "needs_info") return "needs_info";
	return current;
}

// Detail View Component
function FundRequestDetailView({
	request,
	onBack,
	logtoId,
	authHeaders,
}: {
	request: FundRequestData;
	onBack: () => void;
	logtoId: string;
	authHeaders: Record<string, string>;
}) {
	const formId = useId();
	const updateStatus = useAuthedMutation(api.fundRequests.updateStatus);
	const updateFundSource = useAuthedMutation(api.fundRequests.updateFundSource);

	const [selectedStatus, setSelectedStatus] = useState<string>(() =>
		reviewChoiceForStatus(request.status),
	);
	const [selectedFundSource, setSelectedFundSource] = useState<string>(
		request.fundSource || "other",
	);
	const [reviewNotes, setReviewNotes] = useState(request.reviewNotes || "");
	const [isSubmitting, setIsSubmitting] = useState(false);
	useEffect(() => {
		setSelectedStatus(reviewChoiceForStatus(request.status));
	}, [request._id, request.status]);
	useUnsavedChangesGuard(
		!isSubmitting &&
			(reviewNotes !== (request.reviewNotes || "") ||
				selectedFundSource !== (request.fundSource || "other")),
	);

	const handleSave = async () => {
		if (!logtoId) return;

		setIsSubmitting(true);
		try {
			const statusToSet = statusFromReviewChoice(
				selectedStatus,
				request.status,
			);

			// Update status if changed
			const statusChanged = statusToSet !== request.status;
			const fundSourceChanged = selectedFundSource !== request.fundSource;
			const notesChanged = reviewNotes !== request.reviewNotes;

			if (!statusChanged && !fundSourceChanged && !notesChanged) {
				toast.info("No changes to save");
				return;
			}

			// Update fund source first if changed
			if (fundSourceChanged) {
				await updateFundSource({
					logtoId,
					id: request._id as any,
					fundSource: selectedFundSource as "ece" | "ieee" | "other",
				});
			}

			// Update status and notes if status changed
			if (statusChanged || notesChanged) {
				await updateStatus({
					logtoId,
					id: request._id as any,
					status: statusToSet as any,
					reviewNotes: notesChanged ? reviewNotes : undefined,
				});
			}

			// Send email notification for status changes
			if (statusChanged) {
				sendNotification(authHeaders, "fund_request_status_changed", {
					requestId: request._id,
					title: request.title,
					amount: request.amount,
					newStatus: statusToSet,
					previousStatus: request.status,
					reviewNotes: reviewNotes || undefined,
					selectedFundingSource: selectedFundSource,
					submitterName: request.submittedByName,
					submitterEmail: request.submittedByEmail,
				});
			}

			toast.success("Request updated successfully");
			onBack();
		} catch (error: any) {
			toast.error(
				error.message || "Failed to update request. Please try again.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="h-[calc(100vh-3rem)] flex flex-col overflow-hidden">
			{/* Header */}
			<div className="bg-muted/30 border-b px-6 py-4 flex items-center justify-between shrink-0">
				<div className="flex items-center gap-4 min-w-0">
					<Button
						variant="ghost"
						size="icon"
						onClick={onBack}
						className="-ml-2 shrink-0"
						aria-label="Back to fund requests"
					>
						<ArrowLeft className="w-5 h-5" />
					</Button>
					<div className="min-w-0">
						<div className="flex items-center gap-3 flex-wrap">
							<h2 className="text-lg font-bold truncate" title={request.title}>
								{request.title}
							</h2>
							<Badge
								className={cn("shrink-0", STATUS_COLORS[request.status] || "")}
								variant="secondary"
							>
								<span className="mr-1">{STATUS_ICONS[request.status]}</span>
								{STATUS_LABELS[request.status]}
							</Badge>
							{request.fundSource && (
								<Badge variant="outline" className="shrink-0">
									{FUND_SOURCE_LABELS[request.fundSource]}
								</Badge>
							)}
						</div>
						<div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground flex-wrap">
							{request.submittedByName && (
								<>
									<span className="font-medium text-foreground">
										{request.submittedByName}
									</span>
									<span className="text-muted-foreground/40">·</span>
								</>
							)}
							<span className="capitalize">
								{DEPARTMENT_LABELS[request.department] || request.department}
							</span>
							<span className="text-muted-foreground/40">·</span>
							<span>
								{formatDateTimeDisplay(request.createdAt || Date.now())}
							</span>
						</div>
					</div>
				</div>
				<div className="text-right shrink-0 ml-4">
					<p className="text-xs text-muted-foreground font-medium">
						Requested Amount
					</p>
					<p className="text-xl font-bold tabular-nums">
						{formatCurrencyUSD(request.amount)}
					</p>
				</div>
			</div>

			{/* Content - Split Pane */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1 min-h-0 overflow-hidden">
				{/* Left Panel: Details & Actions (5/12) */}
				<div className="lg:col-span-5 border-r border-border overflow-y-auto">
					<div className="p-5 space-y-5">
						{/* Officer Actions Section */}
						<section className="space-y-4">
							<h3 className="text-xs font-medium border-b pb-2 text-muted-foreground">
								Officer Actions
							</h3>

							{/* Fund Source Selection */}
							<div className="space-y-2">
								<Label htmlFor={`${formId}-fundSource`}>Fund Source</Label>
								<Select
									value={selectedFundSource}
									onValueChange={setSelectedFundSource}
								>
									<SelectTrigger id={`${formId}-fundSource`}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ece">ECE Department</SelectItem>
										<SelectItem value="ieee">IEEE Funding</SelectItem>
										<SelectItem value="other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>

							{/* Status Actions */}
							<div className="space-y-2">
								<Label id={`${formId}-statusActionLabel`}>Status Action</Label>
								<fieldset
									className="flex min-w-0 flex-col sm:flex-row gap-2"
									aria-labelledby={`${formId}-statusActionLabel`}
								>
									<Button
										variant="outline"
										className={cn(
											"flex-1 border-ds-green-100 text-tone-success hover:bg-ds-green-100",
											selectedStatus === "approve" &&
												"bg-ds-green-100 border-ds-green-400",
										)}
										aria-pressed={selectedStatus === "approve"}
										onClick={() => setSelectedStatus("approve")}
									>
										<CheckCircle className="w-4 h-4 mr-2" />
										Approve
									</Button>
									<Button
										variant="outline"
										className={cn(
											"flex-1 border-ds-amber-100 text-tone-warning hover:bg-ds-amber-100",
											selectedStatus === "needs_info" &&
												"bg-ds-amber-100 border-ds-amber-400",
										)}
										aria-pressed={selectedStatus === "needs_info"}
										onClick={() => setSelectedStatus("needs_info")}
									>
										<AlertCircle className="w-4 h-4 mr-2" />
										Needs Info
									</Button>
									<Button
										variant="outline"
										className={cn(
											"flex-1 border-ds-red-100 text-tone-danger hover:bg-ds-red-100",
											selectedStatus === "deny" &&
												"bg-ds-red-100 border-ds-red-400",
										)}
										aria-pressed={selectedStatus === "deny"}
										onClick={() => setSelectedStatus("deny")}
									>
										<XCircle className="w-4 h-4 mr-2" />
										Deny
									</Button>
								</fieldset>
							</div>

							{/* Review Notes */}
							<div className="space-y-2">
								<Label htmlFor={`${formId}-reviewNotes`}>Review Notes</Label>
								<Textarea
									id={`${formId}-reviewNotes`}
									name="reviewNotes"
									placeholder="Add comments or notes for the requester…"
									value={reviewNotes}
									onChange={(e) => setReviewNotes(e.target.value)}
									rows={4}
								/>
							</div>

							{/* Save Button */}
							<Button
								onClick={handleSave}
								disabled={isSubmitting}
								className="w-full"
								size="lg"
							>
								{isSubmitting && (
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
								)}
								Save Changes
							</Button>
						</section>

						{/* Request Details */}
						<section className="space-y-3">
							<h3 className="text-xs font-medium border-b pb-2 text-muted-foreground">
								Request Details
							</h3>
							<div className="space-y-3 text-sm">
								<div>
									<p className="text-muted-foreground text-xs">Title</p>
									<p className="font-medium break-words">{request.title}</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Purpose</p>
									<p className="text-sm whitespace-pre-wrap break-words">
										{request.purpose}
									</p>
								</div>
								<div className="grid grid-cols-2 gap-3">
									<div>
										<p className="text-muted-foreground text-xs">Category</p>
										<p className="font-medium capitalize">{request.category}</p>
									</div>
									<div>
										<p className="text-muted-foreground text-xs">Department</p>
										<p className="font-medium">
											{DEPARTMENT_LABELS[request.department] ||
												request.department}
										</p>
									</div>
									<div>
										<p className="text-muted-foreground text-xs">Amount</p>
										<p className="font-medium tabular-nums">
											{formatCurrencyUSD(request.amount)}
										</p>
									</div>
									<div>
										<p className="text-muted-foreground text-xs">
											Submitted On
										</p>
										<p className="font-medium">
											{formatDateDisplay(
												request.submittedAt || request.createdAt,
											)}
										</p>
									</div>
								</div>
							</div>
						</section>

						{/* Vendor Links */}
						{request.vendorLinks && request.vendorLinks.length > 0 && (
							<section className="space-y-3">
								<h3 className="text-xs font-medium border-b pb-2 text-muted-foreground">
									Purchase Links
								</h3>
								<div className="space-y-2">
									{request.vendorLinks.map((link) => (
										<a
											key={link.id}
											href={link.url}
											target="_blank"
											rel="noreferrer"
											className="flex items-center gap-2 text-sm text-primary hover:underline p-2 rounded hover:bg-muted/50 transition-colors"
										>
											<ExternalLink className="w-4 h-4 flex-shrink-0" />
											<span className="truncate">
												{link.itemName || link.url}
											</span>
										</a>
									))}
								</div>
							</section>
						)}

						{/* Existing Review Notes */}
						{(request.reviewNotes || request.infoRequestNotes) && (
							<section className="space-y-3">
								<h3 className="text-xs font-medium border-b pb-2 text-muted-foreground">
									Previous Review Notes
								</h3>
								<div className="text-sm bg-muted/50 p-3 rounded-lg">
									<p className="whitespace-pre-wrap break-words">
										{request.reviewNotes || request.infoRequestNotes}
									</p>
								</div>
							</section>
						)}

						{/* Audit Log */}
						{request.auditLogs && request.auditLogs.length > 0 && (
							<section className="space-y-4">
								<h3 className="text-xs font-medium border-b pb-2 text-muted-foreground">
									Audit Log
								</h3>
								<div className="space-y-2">
									{request.auditLogs.map((entry) => (
										<div
											key={entry.id}
											className="text-sm p-3 bg-muted rounded-lg"
										>
											<div className="flex items-center justify-between">
												<span className="font-medium capitalize">
													{entry.action.replace(/_/g, " ")}
												</span>
												<span className="text-xs text-muted-foreground">
													{formatDateTimeDisplay(entry.timestamp)}
												</span>
											</div>
											{entry.performedByName && (
												<p className="text-xs text-muted-foreground mt-1">
													by {entry.performedByName}
												</p>
											)}
											{entry.newStatus && (
												<p className="text-xs text-muted-foreground mt-1">
													Status:{" "}
													{STATUS_LABELS[entry.newStatus] || entry.newStatus}
												</p>
											)}
											{entry.notes && (
												<p className="text-xs text-muted-foreground mt-1">
													{entry.notes}
												</p>
											)}
										</div>
									))}
								</div>
							</section>
						)}
					</div>
				</div>

				{/* Right Panel: Attachments/Documents (7/12) */}
				<div className="lg:col-span-7 bg-muted/20 min-h-[500px] lg:min-h-0 overflow-y-auto">
					<div className="p-5">
						{/* Attachments Section */}
						<section className="space-y-3">
							<h3 className="text-xs font-medium border-b pb-2 text-muted-foreground">
								Attachments
							</h3>
							{request.attachments && request.attachments.length > 0 ? (
								<div className="space-y-2">
									{request.attachments.map((file) => (
										<a
											key={file.id}
											href={file.url}
											target="_blank"
											rel="noreferrer"
											className="flex items-center gap-3 p-3 bg-card border rounded-lg hover:bg-muted/50 transition-colors"
										>
											<FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium truncate">
													{file.name}
												</p>
												<p className="text-xs text-muted-foreground">
													{formatFileSize(file.size)}
												</p>
											</div>
											<ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
										</a>
									))}
								</div>
							) : (
								<div className="text-center py-12 text-muted-foreground">
									<FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
									<p className="text-sm">No attachments</p>
								</div>
							)}
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}

function ManageFundRequestsPage() {
	const isMobile = useIsMobile();
	const { setHideTabBar } = useMobileShell();
	const {
		hasOfficerAccess,
		hasAdminAccess,
		logtoId,
		getAuthHeaders,
		isLoading,
	} = usePermissions();
	const allRequests = useAuthedQuery(
		api.fundRequests.listAll,
		logtoId ? { logtoId } : "skip",
	);

	const {
		view,
		id: selectedRequestId,
		q,
		status: statusFilter,
		department: departmentFilter,
		page,
	} = Route.useSearch();
	const navigate = Route.useNavigate();
	const setSearchParams = (patch: Partial<ManageFundRequestsSearch>) =>
		navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });
	const [searchQuery, setSearchInput] = useState(q);
	const setSearchQuery = (value: string) => {
		setSearchInput(value);
		setSearchParams({ q: value, page: 1 });
	};
	const setPage = (nextPage: number) => setSearchParams({ page: nextPage });
	const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
	const [expandedRequestId] = useState<string | null>(null);

	const selectedRequest = (allRequests || []).find(
		(r) => r._id === selectedRequestId,
	);

	useEffect(() => {
		setHideTabBar(view === "detail");
		return () => setHideTabBar(false);
	}, [view, setHideTabBar]);

	const handleViewDetail = (request: FundRequestData) =>
		navigate({
			search: (prev) => ({ ...prev, view: "detail", id: request._id }),
		});

	const handleBackToList = () =>
		navigate({
			search: (prev) => ({ ...prev, view: "list", id: undefined }),
		});

	if (isLoading) {
		return (
			<output
				className="flex items-center justify-center min-h-[60vh]"
				aria-live="polite"
			>
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				<span className="sr-only">Loading…</span>
			</output>
		);
	}

	if (!hasOfficerAccess) {
		return (
			<div className="p-6 text-center text-muted-foreground">
				You don’t have permission to access this page.
			</div>
		);
	}

	// Detail view
	if (view === "detail" && selectedRequest && logtoId) {
		return (
			<div className="w-full h-full">
				<FundRequestDetailView
					request={selectedRequest}
					onBack={handleBackToList}
					logtoId={logtoId}
					authHeaders={getAuthHeaders()}
				/>
			</div>
		);
	}

	const filteredRequests = (allRequests || [])
		.filter((r) => r.status !== "draft")
		.filter((r) => {
			const matchesSearch =
				searchQuery.trim() === "" ||
				r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(r.submittedByName &&
					r.submittedByName
						.toLowerCase()
						.includes(searchQuery.toLowerCase())) ||
				r.amount.toString().includes(searchQuery);
			const matchesStatus = statusFilter === "all" || r.status === statusFilter;
			const matchesDepartment =
				departmentFilter === "all" || r.department === departmentFilter;
			return matchesSearch && matchesStatus && matchesDepartment;
		})
		.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

	const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
	const paginatedRequests = filteredRequests.slice(
		(page - 1) * ITEMS_PER_PAGE,
		page * ITEMS_PER_PAGE,
	);

	const getStats = () => {
		const pendingCount = filteredRequests.filter(
			(r) => r.status === "submitted",
		).length;
		const needsInfoCount = filteredRequests.filter(
			(r) => r.status === "needs_info",
		).length;
		const pendingValue = filteredRequests
			.filter((r) => r.status === "submitted")
			.reduce((sum, r) => sum + r.amount, 0);
		const approvedValue = filteredRequests
			.filter((r) => r.status === "approved" || r.status === "completed")
			.reduce((sum, r) => sum + r.amount, 0);

		return { pendingCount, needsInfoCount, pendingValue, approvedValue };
	};

	const stats = getStats();

	return (
		<DashboardPage>
			{/* Header */}
			<PageHeader
				title="Manage Fund Requests"
				description="Review and manage funding requests from all departments."
				actions={
					hasAdminAccess ? (
						<Button
							variant="outline"
							onClick={() => setIsBudgetModalOpen(true)}
						>
							<Settings className="h-4 w-4 mr-2" />
							Configure Budgets
						</Button>
					) : undefined
				}
			/>

			<SummaryStrip
				items={[
					{ label: "pending review", value: stats.pendingCount },
					{ label: "need information", value: stats.needsInfoCount },
					{
						label: "pending amount",
						value: formatCurrencyUSD(stats.pendingValue),
					},
					{
						label: "approved total",
						value: formatCurrencyUSD(stats.approvedValue),
					},
				]}
			/>

			{/* Search & Filters */}
			<div className="flex flex-col sm:flex-row gap-3">
				<div className="relative flex-1 max-w-sm">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						type="search"
						name="search"
						aria-label="Search fund requests"
						autoComplete="off"
						placeholder="Search requests…"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>
				<div className="flex gap-2 flex-wrap">
					{STATUS_FILTERS.map((filter) => (
						<Button
							key={filter.value}
							variant={statusFilter === filter.value ? "default" : "outline"}
							size="sm"
							aria-pressed={statusFilter === filter.value}
							onClick={() => setSearchParams({ status: filter.value, page: 1 })}
						>
							{filter.label}
						</Button>
					))}
				</div>
				<div className="flex gap-2 flex-wrap border-l pl-3">
					{DEPARTMENT_FILTERS.map((filter) => (
						<Button
							key={filter.value}
							variant={
								departmentFilter === filter.value ? "secondary" : "ghost"
							}
							size="sm"
							aria-pressed={departmentFilter === filter.value}
							onClick={() =>
								setSearchParams({ department: filter.value, page: 1 })
							}
						>
							{filter.label}
						</Button>
					))}
				</div>
			</div>

			{/* Queue / table */}
			<div
				className={cn(!isMobile && "rounded-md border bg-card overflow-hidden")}
			>
				{!allRequests ? (
					<output className="block p-6 space-y-4" aria-live="polite">
						<span className="sr-only">Loading fund requests…</span>
						{[1, 2, 3, 4, 5].map((i) => (
							<Skeleton key={i} className="h-16 w-full" />
						))}
					</output>
				) : paginatedRequests.length > 0 && isMobile ? (
					<MobileDataList>
						{paginatedRequests.map((request) => (
							<MobileDataListItem
								key={request._id}
								title={request.title}
								subtitle={request.submittedByName || "Unknown"}
								meta={`${DEPARTMENT_LABELS[request.department] || request.department} · ${formatDateDisplay(request.createdAt || Date.now())}`}
								trailing={
									<span className="tabular-nums">
										{formatCurrencyUSD(request.amount)}
									</span>
								}
								status={
									<Badge
										className={STATUS_COLORS[request.status] || ""}
										variant="secondary"
									>
										{STATUS_LABELS[request.status]}
									</Badge>
								}
								onClick={() => handleViewDetail(request as FundRequestData)}
							/>
						))}
					</MobileDataList>
				) : paginatedRequests.length > 0 ? (
					<div className="divide-y">
						{paginatedRequests.map((request) => {
							const isExpanded = expandedRequestId === request._id;
							return (
								<div key={request._id}>
									<div
										className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
										onClick={() => handleViewDetail(request as FundRequestData)}
									>
										<div className="grid grid-cols-12 gap-4 items-center">
											{/* Request Info */}
											<div className="col-span-12 md:col-span-4 min-w-0">
												<div className="flex flex-col">
													<button
														type="button"
														className="truncate text-left font-semibold text-sm"
														onClick={(e) => {
															e.stopPropagation();
															handleViewDetail(request as FundRequestData);
														}}
													>
														{request.title}
													</button>
													<span className="text-xs text-muted-foreground truncate">
														{request.purpose}
													</span>
												</div>
											</div>

											{/* Requester */}
											<div className="col-span-6 md:col-span-2">
												<div className="text-sm">
													<div className="font-medium text-xs">
														{request.submittedByName || "Unknown"}
													</div>
													<div className="text-xs text-muted-foreground">
														{formatDateDisplay(request.createdAt || Date.now())}
													</div>
												</div>
											</div>

											{/* Department */}
											<div className="col-span-6 md:col-span-2">
												<Badge variant="outline" className="capitalize text-xs">
													{DEPARTMENT_LABELS[request.department] ||
														request.department}
												</Badge>
											</div>

											{/* Amount */}
											<div className="col-span-4 md:col-span-1">
												<span className="font-semibold text-sm tabular-nums">
													{formatCurrencyUSD(request.amount)}
												</span>
											</div>

											{/* Status */}
											<div className="col-span-4 md:col-span-2">
												<Badge
													className={STATUS_COLORS[request.status] || ""}
													variant="secondary"
												>
													<span className="mr-1">
														{STATUS_ICONS[request.status]}
													</span>
													{STATUS_LABELS[request.status]}
												</Badge>
											</div>

											{/* Actions */}
											<div className="col-span-8 md:col-span-1 flex justify-end">
												<div className="flex gap-1">
													<Button
														size="sm"
														variant="ghost"
														onClick={(e) => {
															e.stopPropagation();
															handleViewDetail(request as FundRequestData);
														}}
														aria-label={`View ${request.title}`}
													>
														<ArrowLeft className="h-4 w-4 rotate-180" />
													</Button>
													{isExpanded ? (
														<ChevronUp className="h-4 w-4 text-muted-foreground mt-2" />
													) : (
														<ChevronDown className="h-4 w-4 text-muted-foreground mt-2" />
													)}
												</div>
											</div>
										</div>
									</div>

									{/* Expanded Details */}
									{isExpanded && (
										<div className="p-4 bg-muted/30 border-t">
											<div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
												<div>
													<p className="text-muted-foreground text-xs">
														Request ID
													</p>
													<p className="font-mono text-xs">
														{request._id.slice(0, 8)}…
													</p>
												</div>
												<div>
													<p className="text-muted-foreground text-xs">
														Requester Email
													</p>
													<p className="font-medium">
														{request.submittedByEmail || "N/A"}
													</p>
												</div>
												<div>
													<p className="text-muted-foreground text-xs">
														Category
													</p>
													<p className="font-medium capitalize">
														{request.category}
													</p>
												</div>
												<div>
													<p className="text-muted-foreground text-xs">
														Submitted
													</p>
													<p className="font-medium">
														{formatDateTimeDisplay(
															request.createdAt || Date.now(),
														)}
													</p>
												</div>
											</div>

											{request.vendorLinks &&
												request.vendorLinks.length > 0 && (
													<div className="mt-3">
														<p className="text-xs text-muted-foreground mb-1">
															Purchase Links
														</p>
														<div className="flex flex-wrap gap-2">
															{request.vendorLinks.map((link) => (
																<a
																	key={link.id}
																	href={link.url}
																	target="_blank"
																	rel="noreferrer"
																	className="text-xs text-primary hover:underline"
																>
																	{link.itemName || link.url}
																</a>
															))}
														</div>
													</div>
												)}

											{request.attachments &&
												request.attachments.length > 0 && (
													<div className="mt-3">
														<p className="text-xs text-muted-foreground mb-1">
															Attachments ({request.attachments.length})
														</p>
														<div className="flex flex-wrap gap-2">
															{request.attachments.map((file) => (
																<a
																	key={file.id}
																	href={file.url}
																	target="_blank"
																	rel="noreferrer"
																	className="text-xs text-primary hover:underline"
																>
																	{file.name}
																</a>
															))}
														</div>
													</div>
												)}

											{(request.reviewNotes || request.infoRequestNotes) && (
												<div className="mt-3">
													<p className="text-xs text-muted-foreground mb-1">
														Review Notes
													</p>
													<p className="text-sm">
														{request.reviewNotes || request.infoRequestNotes}
													</p>
												</div>
											)}
										</div>
									)}
								</div>
							);
						})}
					</div>
				) : (
					<div className="p-12 text-center text-muted-foreground">
						No requests found matching your filters.
					</div>
				)}

				{/* Pagination */}
				{totalPages > 1 && (
					<div className="p-4 border-t flex justify-center">
						<Pagination
							currentPage={page}
							totalPages={totalPages}
							onPageChange={setPage}
						/>
					</div>
				)}
			</div>

			{/* Modals */}
			{logtoId && (
				<BudgetManagementModal
					isOpen={isBudgetModalOpen}
					onClose={() => setIsBudgetModalOpen(false)}
					logtoId={logtoId}
				/>
			)}
		</DashboardPage>
	);
}
