import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowLeft,
	Car,
	CheckCircle,
	ChevronDown,
	ChevronsUpDown,
	ChevronUp,
	Clock,
	CreditCard,
	DollarSign,
	Eye,
	FileText,
	Loader2,
	Receipt,
	Search,
	Sparkles,
	UploadCloud,
	XCircle,
} from "lucide-react";
import {
	type ChangeEvent,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { z } from "zod";
import {
	DashboardPage,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import {
	MobileDataList,
	MobileDataListItem,
	ResponsiveOverlay,
	useMobileShell,
} from "@/components/mobile";
import ReceiptViewer from "@/components/reimbursement/ReceiptViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDropTarget } from "@/components/ui/file-drop-target";
import { filesForPicker } from "@/components/ui/filesForPicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
	formatCurrencyUSD,
	formatDate,
	formatDateTime,
	formatNumber,
	formatRelativeTime,
	formatTime,
} from "@/lib/formatters";
import {
	buildPaymentReviewForm,
	hasUnsavedPaymentProgress,
	initialPaidModalState,
	isPaidModalOpenFor,
	type PaymentReviewForm,
	paidModalReducer,
	toPaymentDetails,
} from "@/lib/manage-reimbursements/paidModal";
import {
	getReviewStep,
	type PendingReviewAction,
	type PendingReviewActions,
	withoutPendingAction,
	withPendingAction,
} from "@/lib/manage-reimbursements/reviewActions";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";
import {
	computeMileageTotal,
	formatMileageRoute,
	MILEAGE_RATE_PER_MILE,
} from "@/lib/reimbursement-mileage";
import { sendNotification } from "@/lib/send-notification";
import { cn } from "@/lib/utils";

function formatAuditAction(action: string): {
	label: string;
	description: string;
	color: string;
	icon: typeof CheckCircle;
} {
	const map: Record<
		string,
		{
			label: string;
			description: string;
			color: string;
			icon: typeof CheckCircle;
		}
	> = {
		submitted: {
			label: "Submitted",
			description: "Reimbursement request was submitted for review",
			color: "bg-ds-blue-700",
			icon: FileText,
		},
		status_changed_to_approved: {
			label: "Approved",
			description: "Request was reviewed and approved",
			color: "bg-ds-green-700",
			icon: CheckCircle,
		},
		status_changed_to_declined: {
			label: "Declined",
			description: "Request was reviewed and declined",
			color: "bg-ds-red-800",
			icon: XCircle,
		},
		status_changed_to_paid: {
			label: "Marked as Paid",
			description: "Payment has been processed",
			color: "bg-ds-green-700",
			icon: DollarSign,
		},
		payment_details_added: {
			label: "Payment Confirmed",
			description: "Payment confirmation details were recorded",
			color: "bg-ds-green-700",
			icon: CreditCard,
		},
		status_changed_to_submitted: {
			label: "Re-submitted",
			description: "Request was re-submitted for review",
			color: "bg-ds-blue-700",
			icon: FileText,
		},
	};
	return (
		map[action] || {
			label: action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
			description: "",
			color: "bg-ds-gray-600",
			icon: Clock,
		}
	);
}

const REIMBURSEMENT_STATUSES = [
	"submitted",
	"approved",
	"declined",
	"paid",
] as const;
const SORT_FIELDS = [
	"title",
	"totalAmount",
	"_creationTime",
	"status",
	"department",
	"submittedBy",
] as const;

const searchSchema = z.object({
	q: z.string().catch(""),
	status: z
		.array(z.enum(REIMBURSEMENT_STATUSES))
		.catch(["submitted", "approved"]),
	sort: z.enum(SORT_FIELDS).catch("_creationTime"),
	dir: z.enum(["asc", "desc"]).catch("desc"),
	page: z.number().int().min(1).catch(1),
	id: z.string().optional().catch(undefined),
});

type ManageReimbursementsSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_dashboard/manage-reimbursements")({
	validateSearch: searchSchema,
	loader: (ctx) =>
		prefetchAuthedQuery(api.reimbursements.listAll, undefined, ctx),
	component: ManageReimbursementsPage,
});

const ITEMS_PER_PAGE = 10;

type ReimbursementStatus = (typeof REIMBURSEMENT_STATUSES)[number];
type SortField = (typeof SORT_FIELDS)[number];

type DeclineDialogState =
	| { status: "closed" }
	| { status: "open"; targetId: string; reason: string };

const statusColors: Record<ReimbursementStatus, string> = {
	submitted: "bg-ds-amber-100 text-tone-warning",
	approved: "bg-ds-green-100 text-tone-success",
	declined: "bg-ds-red-100 text-tone-danger",
	paid: "bg-ds-purple-100 text-tone-purple",
};

const statusLabels: Record<ReimbursementStatus, string> = {
	submitted: "Pending Review",
	approved: "Approved (Not Paid)",
	paid: "Approved (Paid)",
	declined: "Declined",
};

const getStatusIcon = (status: ReimbursementStatus) => {
	switch (status) {
		case "submitted":
			return <AlertCircle className="w-4 h-4" />;
		case "approved":
			return <CheckCircle className="w-4 h-4" />;
		case "paid":
			return <CreditCard className="w-4 h-4" />;
		case "declined":
			return <XCircle className="w-4 h-4" />;
		default:
			return <AlertCircle className="w-4 h-4" />;
	}
};

function ManageReimbursementsPage() {
	const formId = useId();
	const { hasAdminAccess, logtoId, user, getAuthHeaders, isLoading } =
		usePermissions();
	const isMobile = useIsMobile();
	const { setHideTabBar } = useMobileShell();
	const aiEnabled = user?.aiFeaturesEnabled !== false;
	const reimbursements = useAuthedQuery(
		api.reimbursements.listAll,
		logtoId ? { logtoId } : "skip",
	);
	const updateStatus = useAuthedMutation(api.reimbursements.updateStatus);
	const updatePaymentDetails = useAuthedMutation(
		api.reimbursements.updatePaymentDetails,
	);
	const generateUploadUrl = useAuthedMutation(
		api.reimbursements.generateUploadUrl,
	);
	const registerPendingUpload = useAuthedMutation(
		api.reimbursements.registerPendingUpload,
	);
	const getStorageUrl = useAuthedMutation(api.reimbursements.getStorageUrl);

	// Table state
	const {
		q: search,
		status: statusParam,
		sort: sortField,
		dir: sortDirection,
		page,
		id: selectedId,
	} = Route.useSearch();
	const navigate = Route.useNavigate();
	const setSearchParams = useCallback(
		(patch: Partial<ManageReimbursementsSearch>) =>
			navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true }),
		[navigate],
	);
	const statusFilter = useMemo(
		() => new Set<ReimbursementStatus>(statusParam),
		[statusParam],
	);
	const setPage = (nextPage: number) => setSearchParams({ page: nextPage });
	const selectedReimbursement = useMemo(
		() =>
			selectedId
				? (reimbursements?.find((r) => r._id === selectedId) ?? null)
				: null,
		[reimbursements, selectedId],
	);
	const viewMode = selectedReimbursement ? "detail" : "list";
	const [hoveredRow, setHoveredRow] = useState<string | null>(null);
	const [pendingActions, setPendingActions] = useState<PendingReviewActions>(
		{},
	);
	const [declineDialog, setDeclineDialog] = useState<DeclineDialogState>({
		status: "closed",
	});

	// Paid confirmation modal state
	const [paidModal, dispatchPaidModal] = useReducer(
		paidModalReducer,
		initialPaidModalState,
	);
	const [proofPickerMessage, setProofPickerMessage] = useState<string | null>(
		null,
	);
	const extractionAttemptRef = useRef(0);
	const extractionAbortRef = useRef<AbortController | null>(null);
	const isPaidModalOpen = isPaidModalOpenFor(
		paidModal,
		selectedReimbursement?._id,
	);
	const isSelectingProof =
		isPaidModalOpen && paidModal.status === "selectingProof";
	const confirmDiscardPayment = useUnsavedChangesGuard(
		isPaidModalOpen && hasUnsavedPaymentProgress(paidModal),
	);

	// Receipt viewer state
	const [activeReceiptIndex, setActiveReceiptIndex] = useState(0);

	useEffect(() => {
		setHideTabBar(viewMode === "detail" || isPaidModalOpen);
		return () => setHideTabBar(false);
	}, [viewMode, isPaidModalOpen, setHideTabBar]);

	useEffect(() => () => extractionAbortRef.current?.abort(), []);

	// Handle paste for file upload
	useEffect(() => {
		if (!isSelectingProof) return;

		const handlePaste = (e: ClipboardEvent) => {
			const items = e.clipboardData?.items;
			if (!items) return;

			for (let i = 0; i < items.length; i++) {
				if (items[i].type.indexOf("image") !== -1) {
					const file = items[i].getAsFile();
					if (file) {
						dispatchPaidModal({ type: "proofSelected", file });
						toast.success("Image pasted successfully");
						e.preventDefault();
						break;
					}
				}
			}
		};

		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [isSelectingProof]);

	const handleSort = (field: SortField) => {
		setSearchParams({
			sort: field,
			dir:
				sortField === field
					? sortDirection === "asc"
						? "desc"
						: "asc"
					: "asc",
		});
	};

	const getSortIcon = (field: SortField) => {
		if (sortField === field) {
			return sortDirection === "asc" ? (
				<ChevronUp className="w-3.5 h-3.5" />
			) : (
				<ChevronDown className="w-3.5 h-3.5" />
			);
		}
		return (
			<ChevronsUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50 transition-opacity" />
		);
	};

	// Calculate receipt total
	const calculateReceiptTotal = (receipt: any) => {
		if (receipt.expenseType === "mileage") {
			if (receipt.total && receipt.total > 0) return receipt.total;
			return computeMileageTotal(receipt.miles ?? 0);
		}
		if (receipt.total && receipt.total > 0) {
			return receipt.total;
		}
		let subtotal = receipt.subtotal || 0;
		if (subtotal === 0 && receipt.lineItems && receipt.lineItems.length > 0) {
			subtotal = receipt.lineItems.reduce(
				(sum: number, item: any) => sum + (item.amount || 0),
				0,
			);
		}
		return (
			subtotal +
			(receipt.tax || 0) +
			(receipt.tip || 0) +
			(receipt.shipping || 0)
		);
	};

	// Calculate total amount for a reimbursement
	const calculateTotalAmount = (reimbursement: any) => {
		if (reimbursement.approvedAmount) return reimbursement.approvedAmount;
		if (reimbursement.receipts && reimbursement.receipts.length > 0) {
			return reimbursement.receipts.reduce(
				(sum: number, receipt: any) => sum + calculateReceiptTotal(receipt),
				0,
			);
		}
		return reimbursement.totalAmount || 0;
	};

	// Filter and sort reimbursements
	const filtered = useMemo(() => {
		if (!reimbursements) return [];

		return reimbursements
			.filter((r) => {
				const matchesSearch =
					!search ||
					r.title.toLowerCase().includes(search.toLowerCase()) ||
					r.department.toLowerCase().includes(search.toLowerCase()) ||
					r.additionalInfo.toLowerCase().includes(search.toLowerCase()) ||
					(r.submittedByName &&
						r.submittedByName.toLowerCase().includes(search.toLowerCase())) ||
					r.submittedBy.toLowerCase().includes(search.toLowerCase()) ||
					(r.submittedByZelle &&
						r.submittedByZelle.toLowerCase().includes(search.toLowerCase()));
				const matchesStatus =
					statusFilter.size === 0 || statusFilter.has(r.status);
				return matchesSearch && matchesStatus;
			})
			.sort((a, b) => {
				let aValue: any;
				let bValue: any;

				switch (sortField) {
					case "title":
						aValue = a.title.toLowerCase();
						bValue = b.title.toLowerCase();
						break;
					case "totalAmount":
						aValue = calculateTotalAmount(a);
						bValue = calculateTotalAmount(b);
						break;
					case "_creationTime":
						aValue = a._creationTime;
						bValue = b._creationTime;
						break;
					case "status":
						aValue = a.status;
						bValue = b.status;
						break;
					case "department":
						aValue = a.department.toLowerCase();
						bValue = b.department.toLowerCase();
						break;
					case "submittedBy":
						aValue = (a.submittedByName || a.submittedBy).toLowerCase();
						bValue = (b.submittedByName || b.submittedBy).toLowerCase();
						break;
					default:
						return 0;
				}

				if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
				if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
				return 0;
			});
	}, [reimbursements, search, statusFilter, sortField, sortDirection]);

	const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
	const paginated = filtered.slice(
		(page - 1) * ITEMS_PER_PAGE,
		page * ITEMS_PER_PAGE,
	);

	// Action handlers
	const startPendingAction = (id: string, action: PendingReviewAction) =>
		setPendingActions((pending) => withPendingAction(pending, id, action));
	const settlePendingAction = (id: string) =>
		setPendingActions((pending) => withoutPendingAction(pending, id));

	const handleStatusChange = async (
		id: string,
		status: "approved" | "declined",
		reason?: string,
	) => {
		const trimmedReason = reason?.trim();
		if (status === "declined" && !trimmedReason) {
			toast.error("Enter a reason to decline this reimbursement.");
			return;
		}

		startPendingAction(id, status === "declined" ? "decline" : "approve");
		try {
			await updateStatus({
				logtoId: logtoId!,
				id: id as any,
				status,
				reason: status === "declined" ? trimmedReason : undefined,
			});
			toast.success(`Reimbursement ${status}`);

			// Find the reimbursement to get details for the email
			const reimbursement = reimbursements?.find((r: any) => r._id === id);
			if (reimbursement && logtoId) {
				sendNotification(getAuthHeaders(), "reimbursement_status_changed", {
					reimbursementId: id,
					title: reimbursement.title,
					totalAmount: reimbursement.totalAmount,
					department: reimbursement.department,
					newStatus: status,
					previousStatus: reimbursement.status,
					changedByName: user?.name || "Admin",
					submittedBy: reimbursement.submittedBy,
					...(status === "declined" && trimmedReason
						? { rejectionReason: trimmedReason }
						: {}),
				});
			}

			if (selectedId === id) {
				handleBackToList();
			}
		} catch {
			toast.error(
				"Failed to update status. Check your connection and try again.",
			);
		} finally {
			settlePendingAction(id);
		}
	};

	const handleDecline = (id: string) => {
		setDeclineDialog({ status: "open", targetId: id, reason: "" });
	};

	const closeDeclineDialog = () => setDeclineDialog({ status: "closed" });

	const handleConfirmDecline = async () => {
		if (declineDialog.status !== "open") return;
		const { targetId, reason } = declineDialog;
		if (!reason.trim()) {
			toast.error("Enter a reason to decline this reimbursement.");
			return;
		}
		await handleStatusChange(targetId, "declined", reason);
		setDeclineDialog((dialog) =>
			dialog.status === "open" && dialog.targetId === targetId
				? { status: "closed" }
				: dialog,
		);
	};

	const handleApproveFull = async () => {
		if (!selectedReimbursement) return;
		const id = selectedReimbursement._id;
		startPendingAction(id, "approve");
		try {
			await updateStatus({
				logtoId: logtoId!,
				id: selectedReimbursement._id,
				status: "approved",
			});
			toast.success("Reimbursement approved");

			if (logtoId) {
				sendNotification(getAuthHeaders(), "reimbursement_status_changed", {
					reimbursementId: selectedReimbursement._id,
					title: selectedReimbursement.title,
					totalAmount: selectedReimbursement.totalAmount,
					department: selectedReimbursement.department,
					newStatus: "approved",
					previousStatus: selectedReimbursement.status,
					changedByName: user?.name || "Admin",
					submittedBy: selectedReimbursement.submittedBy,
				});
			}
		} catch {
			toast.error(
				"Failed to approve reimbursement. Check your connection and try again.",
			);
		} finally {
			settlePendingAction(id);
		}
	};

	const handleProcessProof = async () => {
		if (
			paidModal.status !== "selectingProof" ||
			!selectedReimbursement ||
			extractionAbortRef.current
		) {
			return;
		}
		const { file } = paidModal;
		if (!file) {
			toast.error("Missing File", {
				description: "Please upload a proof of payment.",
			});
			return;
		}

		const controller = new AbortController();
		extractionAbortRef.current = controller;
		const { signal } = controller;
		extractionAttemptRef.current += 1;
		const attempt = extractionAttemptRef.current;
		dispatchPaidModal({ type: "extractionStarted", attempt });

		const reviewDefaults = {
			today: new Date().toISOString().split("T")[0],
			fallbackAmount: calculateTotalAmount(selectedReimbursement).toFixed(2),
		};
		let proofUrl: string | null = null;
		try {
			const uploadUrl = await generateUploadUrl({});
			const uploadResponse = await fetch(uploadUrl, {
				method: "POST",
				headers: {
					"Content-Type": file.type || "application/octet-stream",
				},
				body: file,
				signal,
			});

			if (!uploadResponse.ok) {
				throw new Error("Failed to upload proof file");
			}

			const { storageId } = await uploadResponse.json();
			await registerPendingUpload({ storageId });
			proofUrl = await getStorageUrl({ storageId });
			if (signal.aborted) return;
			if (!proofUrl) {
				throw new Error("Could not resolve uploaded proof file URL");
			}

			if (!aiEnabled) {
				dispatchPaidModal({
					type: "extractionFinished",
					attempt,
					proofUrl,
					form: buildPaymentReviewForm(null, reviewDefaults),
				});
				toast.success("Proof uploaded", {
					description: "AI is disabled. Please enter payment details manually.",
				});
				return;
			}

			const response = await fetch("/api/extract-payment-details", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...getAuthHeaders() },
				body: JSON.stringify({ imageUrl: proofUrl }),
				signal,
			});

			if (!response.ok) {
				throw new Error("AI extraction failed");
			}

			const result = await response.json();
			if (!result.success || !result.data) {
				throw new Error(result.error || "No data returned");
			}
			if (signal.aborted) return;
			dispatchPaidModal({
				type: "extractionFinished",
				attempt,
				proofUrl,
				form: buildPaymentReviewForm(result.data, reviewDefaults),
			});
			toast.success("Details extracted", {
				description: "Please review the payment details.",
			});
		} catch (error) {
			if (signal.aborted) return;
			const message =
				error instanceof Error
					? error.message
					: "Could not process payment proof.";
			toast.error("AI Extraction Failed", {
				description: `${message} Please enter details manually.`,
			});
			dispatchPaidModal({
				type: "extractionFinished",
				attempt,
				proofUrl,
				form: buildPaymentReviewForm(null, reviewDefaults),
			});
		} finally {
			if (extractionAbortRef.current === controller) {
				extractionAbortRef.current = null;
			}
		}
	};

	const handleConfirmPayment = async () => {
		if (paidModal.status !== "reviewing" || !selectedReimbursement) return;
		const { form, proofUrl } = paidModal;
		if (!form.confirmationNumber.trim()) {
			toast.error("Missing Information", {
				description: "Please provide a confirmation number.",
			});
			return;
		}

		const paymentDetails = toPaymentDetails(form, {
			proofUrl,
			fallbackAmount: calculateTotalAmount(selectedReimbursement),
			now: Date.now(),
		});
		dispatchPaidModal({ type: "submitStarted" });
		try {
			await updatePaymentDetails({
				logtoId: logtoId!,
				id: selectedReimbursement._id,
				paymentDetails,
			});
			toast.success("Reimbursement marked as paid");

			if (logtoId) {
				sendNotification(getAuthHeaders(), "reimbursement_status_changed", {
					reimbursementId: selectedReimbursement._id,
					title: selectedReimbursement.title,
					totalAmount: selectedReimbursement.totalAmount,
					department: selectedReimbursement.department,
					newStatus: "paid",
					previousStatus: selectedReimbursement.status,
					changedByName: user?.name || "Admin",
					submittedBy: selectedReimbursement.submittedBy,
					paymentDetails: {
						confirmationNumber: paymentDetails.confirmationNumber,
						paymentDate: paymentDetails.paymentDate,
						amountPaid: paymentDetails.amountPaid,
					},
				});
			}
			flushSync(() => dispatchPaidModal({ type: "close" }));
			handleBackToList();
		} catch {
			toast.error(
				"Failed to mark as paid. Check your connection and try again.",
			);
			dispatchPaidModal({ type: "submitFailed" });
		}
	};

	const setPaymentReviewField =
		(field: keyof PaymentReviewForm) =>
		(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
			dispatchPaidModal({ type: "fieldChanged", field, value: e.target.value });

	const handleViewDetails = (reimbursement: any) => {
		setActiveReceiptIndex(0);
		navigate({ search: (prev) => ({ ...prev, id: reimbursement._id }) });
	};

	const handleBackToList = () => {
		navigate({ search: (prev) => ({ ...prev, id: undefined }) });
	};

	const openPaidModal = (reimbursementId: string) =>
		dispatchPaidModal({ type: "open", reimbursementId });

	const closePaidModal = async () => {
		if (!(await confirmDiscardPayment())) return;
		extractionAbortRef.current?.abort();
		extractionAbortRef.current = null;
		dispatchPaidModal({ type: "close" });
	};

	const renderSortableHead = (field: SortField, label: string) => (
		<TableHead
			aria-sort={
				sortField === field
					? sortDirection === "asc"
						? "ascending"
						: "descending"
					: "none"
			}
			className="p-0 hover:bg-muted transition-colors"
		>
			<button
				type="button"
				onClick={() => handleSort(field)}
				className="group flex h-full w-full items-center gap-1 px-3 text-left"
			>
				{label} {getSortIcon(field)}
			</button>
		</TableHead>
	);

	const declineTargetId =
		declineDialog.status === "open" ? declineDialog.targetId : null;
	const declineTargetPendingAction =
		declineTargetId !== null ? pendingActions[declineTargetId] : undefined;

	const declineOverlay = (
		<ResponsiveOverlay
			open={declineDialog.status === "open"}
			onOpenChange={(open) => {
				if (!open) closeDeclineDialog();
			}}
			title="Decline Reimbursement?"
			description="Provide a reason. It’s included in the notification sent to the submitter."
			footer={
				<div className="flex w-full gap-2">
					<Button
						variant="outline"
						className="h-11 flex-1 sm:h-9 sm:flex-none"
						onClick={closeDeclineDialog}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						className="h-11 flex-1 sm:h-9 sm:flex-none"
						onClick={handleConfirmDecline}
						disabled={declineTargetPendingAction !== undefined}
					>
						{declineTargetPendingAction === "decline" ? (
							<Loader2 className="h-4 w-4 animate-spin mr-1" />
						) : null}
						Decline Reimbursement
					</Button>
				</div>
			}
		>
			<div className="space-y-2">
				<Label htmlFor={`${formId}-decline-reason`}>Reason for Declining</Label>
				<Textarea
					id={`${formId}-decline-reason`}
					name="declineReason"
					autoComplete="off"
					placeholder="Explain why this request is being declined…"
					value={declineDialog.status === "open" ? declineDialog.reason : ""}
					onChange={(e) => {
						const reason = e.target.value;
						setDeclineDialog((dialog) =>
							dialog.status === "open" ? { ...dialog, reason } : dialog,
						);
					}}
					rows={3}
					className="text-base sm:text-sm"
				/>
			</div>
		</ResponsiveOverlay>
	);

	if (isLoading) {
		return (
			<output className="flex items-center justify-center min-h-[60vh]">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				<span className="sr-only">Loading…</span>
			</output>
		);
	}

	if (!hasAdminAccess) {
		return (
			<div className="p-6 text-center text-muted-foreground">
				You don’t have permission to access this page.
			</div>
		);
	}

	const currentReceipt =
		selectedReimbursement?.receipts?.[activeReceiptIndex] || null;
	const currentIsMileage = currentReceipt?.expenseType === "mileage";

	// Detail View - Split Pane Layout
	if (selectedReimbursement) {
		const reviewStep = getReviewStep(selectedReimbursement);
		const pendingAction = pendingActions[selectedReimbursement._id];
		const paidModalView =
			paidModal.status === "closed" ? paidModal.previous : paidModal;
		const isPaidModalBusy =
			paidModalView?.status === "extracting" ||
			paidModalView?.status === "submitting";
		const paymentReview =
			paidModalView?.status === "reviewing" ||
			paidModalView?.status === "submitting"
				? paidModalView
				: null;
		const isReviewingPayment = paymentReview !== null;
		const proofFile =
			paidModalView?.status === "selectingProof" ||
			paidModalView?.status === "extracting"
				? paidModalView.file
				: null;
		const onProofFiles = (list: FileList | null) => {
			if (isPaidModalBusy) return;
			const decision = filesForPicker(list, {
				accept: "image/*,application/pdf",
				multiple: false,
			});
			if (decision.message || decision.files.length !== 1) {
				setProofPickerMessage(decision.message);
				return;
			}
			const file = decision.files[0];
			if (!file) return;
			setProofPickerMessage(null);
			dispatchPaidModal({ type: "proofSelected", file });
		};

		return (
			<div className="flex flex-col h-full bg-muted/50 absolute inset-0 z-10 overflow-hidden">
				{/* Header */}
				<div className="bg-background border-b px-6 py-4 flex items-center justify-between shrink-0 h-16 box-border">
					<div className="flex items-center gap-4 min-w-0">
						<Button
							variant="ghost"
							size="icon"
							onClick={handleBackToList}
							className="-ml-2 shrink-0"
							aria-label="Back to Reimbursements"
						>
							<ArrowLeft className="h-5 w-5" />
						</Button>
						<div className="min-w-0">
							<div className="flex items-center gap-3">
								<h2
									className="text-lg font-bold truncate text-balance"
									title={selectedReimbursement.title}
								>
									{selectedReimbursement.title}
								</h2>
								<Badge
									className={`shrink-0 ${statusColors[selectedReimbursement.status as ReimbursementStatus]}`}
									variant="secondary"
								>
									{
										statusLabels[
											selectedReimbursement.status as ReimbursementStatus
										]
									}
								</Badge>
							</div>
							<div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
								<span>
									{selectedReimbursement.submittedByName ||
										selectedReimbursement.submittedBy}
								</span>
								<span className="text-muted-foreground/40">·</span>
								<span className="capitalize">
									{selectedReimbursement.department}
								</span>
								<span className="text-muted-foreground/40">·</span>
								<span>{selectedReimbursement.paymentMethod}</span>
								<span className="text-muted-foreground/40">·</span>
								<span>{formatDate(selectedReimbursement._creationTime)}</span>
							</div>
						</div>
					</div>
					<div className="text-right shrink-0 ml-4">
						<p className="text-xs text-muted-foreground font-medium">
							Total Amount
						</p>
						<p className="text-xl font-bold tabular-nums">
							{formatCurrencyUSD(calculateTotalAmount(selectedReimbursement))}
						</p>
					</div>
				</div>

				{/* Split Pane Content */}
				<div className="flex-1 flex overflow-hidden">
					{/* Left Panel (5/12) */}
					<div className="w-5/12 flex flex-col border-r border-border bg-background overflow-y-auto">
						<div className="p-6 space-y-8">
							{/* Actions Section */}
							{reviewStep !== "none" && (
								<section className="border-b border-border pb-6 space-y-3">
									<h3 className="text-xs font-medium text-muted-foreground">
										Actions
									</h3>
									<div className="flex flex-wrap gap-2">
										{reviewStep === "approveOrDecline" && (
											<>
												<Button
													size="sm"
													onClick={handleApproveFull}
													disabled={pendingAction !== undefined}
													className="bg-ds-green-700 hover:bg-ds-green-800"
												>
													{pendingAction === "approve" ? (
														<Loader2 className="h-4 w-4 animate-spin mr-1" />
													) : (
														<CheckCircle className="h-4 w-4 mr-1" />
													)}
													Approve Full
												</Button>
												<Button
													size="sm"
													variant="destructive"
													onClick={() =>
														handleDecline(selectedReimbursement._id)
													}
													disabled={pendingAction !== undefined}
												>
													<XCircle className="h-4 w-4 mr-1" />
													Decline
												</Button>
											</>
										)}
										{reviewStep === "markPaid" && (
											<Button
												size="sm"
												onClick={() => openPaidModal(selectedReimbursement._id)}
												className="bg-ds-purple-700 hover:bg-ds-purple-800"
											>
												<DollarSign className="h-4 w-4 mr-1" />
												Mark as Paid
											</Button>
										)}
									</div>
								</section>
							)}

							{/* Request Details */}
							<section className="space-y-4">
								<h3 className="text-sm font-bold text-foreground">
									Request Details
								</h3>
								<div className="space-y-4 text-sm">
									<div className="grid grid-cols-3 gap-2">
										<span className="text-muted-foreground font-medium">
											Department
										</span>
										<span className="col-span-2 text-foreground capitalize">
											{selectedReimbursement.department}
										</span>
									</div>
									<div className="grid grid-cols-3 gap-2">
										<span className="text-muted-foreground font-medium">
											Payment Method
										</span>
										<span className="col-span-2 text-foreground">
											{selectedReimbursement.paymentMethod}
										</span>
									</div>
									<div className="grid grid-cols-3 gap-2">
										<span className="text-muted-foreground font-medium">
											Total Amount
										</span>
										<span className="col-span-2 text-foreground tabular-nums font-medium">
											{formatCurrencyUSD(
												calculateTotalAmount(selectedReimbursement),
											)}
										</span>
									</div>
									<div className="grid grid-cols-3 gap-2">
										<span className="text-muted-foreground font-medium">
											Submitted By
										</span>
										<span className="col-span-2 text-foreground">
											{selectedReimbursement.submittedByName ||
												selectedReimbursement.submittedBy}
										</span>
									</div>
									{selectedReimbursement.submittedByZelle && (
										<div className="grid grid-cols-3 gap-2">
											<span className="text-muted-foreground font-medium">
												Zelle Info
											</span>
											<span className="col-span-2 text-foreground font-medium bg-ds-green-100 px-2 py-0.5 rounded text-tone-success">
												{selectedReimbursement.submittedByZelle}
											</span>
										</div>
									)}
									{selectedReimbursement.additionalInfo && (
										<div className="grid grid-cols-3 gap-2">
											<span className="text-muted-foreground font-medium">
												Payment Info
											</span>
											<span className="col-span-2 text-foreground font-medium bg-ds-blue-100 px-2 py-0.5 rounded text-tone-info">
												{selectedReimbursement.additionalInfo}
											</span>
										</div>
									)}
								</div>
							</section>

							{/* Receipts List */}
							{selectedReimbursement.receipts &&
								selectedReimbursement.receipts.length > 0 && (
									<section className="space-y-4">
										<h3 className="text-sm font-bold text-foreground flex justify-between">
											<span>Expenses</span>
											<span className="text-muted-foreground font-medium text-xs">
												{selectedReimbursement.receipts.length} items
											</span>
										</h3>
										<div className="space-y-3">
											{selectedReimbursement.receipts.map(
												(receipt: any, idx: number) => (
													<button
														type="button"
														key={idx}
														onClick={() => setActiveReceiptIndex(idx)}
														aria-pressed={activeReceiptIndex === idx}
														className={`block w-full text-left p-3 rounded-md border cursor-pointer transition-[background-color,border-color,box-shadow,opacity] duration-150 ease-[ease] ${
															activeReceiptIndex === idx
																? "border-ds-blue-700 bg-ds-blue-100 ring-1 ring-ds-blue-700/20"
																: "border-border hover:border-border hover:bg-muted"
														}`}
													>
														<div className="flex justify-between items-start mb-1 gap-2">
															<div className="min-w-0 flex flex-wrap items-center gap-1.5">
																<span className="font-semibold text-foreground break-words">
																	{receipt.vendorName ||
																		(receipt.expenseType === "mileage"
																			? "Mileage"
																			: "Unknown Vendor")}
																</span>
																{receipt.expenseType === "mileage" && (
																	<Badge
																		variant="secondary"
																		className="text-[10px] font-normal shrink-0"
																	>
																		Mileage
																	</Badge>
																)}
															</div>
															<span className="font-bold text-foreground tabular-nums shrink-0">
																{formatCurrencyUSD(receipt.total || 0)}
															</span>
														</div>
														<div className="text-xs text-muted-foreground flex justify-between gap-2">
															<span className="min-w-0 flex flex-col gap-0.5">
																{receipt.expenseType === "mileage" ? (
																	<>
																		<span className="truncate">
																			{receipt.dateOfPurchase
																				? formatDate(receipt.dateOfPurchase)
																				: "No date"}{" "}
																			·{" "}
																			<span className="tabular-nums">
																				{formatNumber(receipt.miles ?? 0)} mi ×{" "}
																				{formatCurrencyUSD(
																					MILEAGE_RATE_PER_MILE,
																				)}
																				/mi
																			</span>
																		</span>
																		{(formatMileageRoute(
																			receipt.mileageFrom,
																			receipt.mileageTo,
																			receipt.mileageStops,
																		) ||
																			receipt.location?.trim()) && (
																			<span className="truncate text-muted-foreground">
																				{formatMileageRoute(
																					receipt.mileageFrom,
																					receipt.mileageTo,
																					receipt.mileageStops,
																				) || receipt.location}
																			</span>
																		)}
																	</>
																) : receipt.dateOfPurchase ? (
																	formatDate(receipt.dateOfPurchase)
																) : (
																	"No date"
																)}
															</span>
															<span className="shrink-0">
																{receipt.expenseType === "mileage"
																	? "—"
																	: receipt.receiptFile
																		? "View File"
																		: "No File"}
															</span>
														</div>
													</button>
												),
											)}
										</div>
									</section>
								)}

							{/* Audit History */}
							{selectedReimbursement.auditLogs &&
								selectedReimbursement.auditLogs.length > 0 && (
									<section className="border-t border-border pt-6 space-y-4">
										<h3 className="text-sm font-bold text-foreground">
											Audit History
										</h3>
										<div className="space-y-0 relative ml-3">
											{[...selectedReimbursement.auditLogs]
												.reverse()
												.map((log: any, i: number, arr: any[]) => {
													const info = formatAuditAction(log.action);
													const Icon = info.icon;
													const isLast = i === arr.length - 1;
													return (
														<div
															key={i}
															className="relative flex gap-3 pb-6 last:pb-0"
														>
															{!isLast && (
																<div
																	className="absolute left-[11px] top-7 bottom-0 w-px bg-muted"
																	aria-hidden="true"
																/>
															)}
															<div
																className={`relative z-10 flex-shrink-0 w-[23px] h-[23px] rounded-full ${info.color} flex items-center justify-center ring-4 ring-background`}
															>
																<Icon className="w-3 h-3 text-on-accent" />
															</div>
															<div className="flex-1 min-w-0 pt-0.5">
																<div className="flex items-baseline justify-between gap-2">
																	<span className="text-sm font-semibold text-foreground">
																		{info.label}
																	</span>
																	<span className="text-[11px] text-muted-foreground whitespace-nowrap">
																		{formatRelativeTime(log.timestamp)}
																	</span>
																</div>
																{info.description && (
																	<p className="text-xs text-muted-foreground mt-0.5">
																		{info.description}
																	</p>
																)}
																<p className="text-[11px] text-muted-foreground mt-1">
																	{formatDateTime(log.timestamp)}
																	{log.createdBy && (
																		<span className="ml-1.5 inline-flex items-center gap-1 bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[10px] font-mono">
																			{log.createdBy}
																		</span>
																	)}
																</p>
															</div>
														</div>
													);
												})}
										</div>
									</section>
								)}

							{/* Payment Details */}
							{selectedReimbursement.paymentDetails && (
								<section className="bg-ds-green-100 border border-ds-green-100 rounded-md p-4 space-y-3">
									<div className="flex items-center gap-2 border-b border-ds-green-100 pb-2">
										<CheckCircle className="w-4 h-4 text-tone-success" />
										<h3 className="text-xs font-medium text-tone-success">
											Payment Confirmed
										</h3>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div className="space-y-0.5">
											<p className="text-xs font-medium text-tone-success">
												Confirmation #
											</p>
											<p className="text-sm font-mono font-medium">
												{
													selectedReimbursement.paymentDetails
														.confirmationNumber
												}
											</p>
										</div>
										<div className="space-y-0.5">
											<p className="text-xs font-medium text-tone-success">
												Amount Paid
											</p>
											<p className="text-sm tabular-nums font-medium">
												{formatCurrencyUSD(
													selectedReimbursement.paymentDetails.amountPaid,
												)}
											</p>
										</div>
										{selectedReimbursement.paymentDetails.paymentDate && (
											<div className="space-y-0.5">
												<p className="text-xs font-medium text-tone-success">
													Payment Date
												</p>
												<p className="text-sm">
													{formatDate(
														selectedReimbursement.paymentDetails.paymentDate,
													)}
												</p>
											</div>
										)}
										{selectedReimbursement.paymentDetails.memo && (
											<div className="space-y-0.5 col-span-2">
												<p className="text-xs font-medium text-tone-success">
													Memo
												</p>
												<p className="text-sm">
													{selectedReimbursement.paymentDetails.memo}
												</p>
											</div>
										)}
									</div>
								</section>
							)}
						</div>
					</div>

					{/* Right Panel (7/12) - Receipt file or mileage */}
					<div className="w-7/12 bg-muted flex flex-col border-l border-border overflow-hidden">
						{currentReceipt ? (
							currentIsMileage ? (
								<div className="flex flex-1 flex-col overflow-auto p-6">
									<div className="mx-auto flex w-full max-w-lg flex-col items-center rounded-md border border-dashed border-border bg-background p-8 text-center">
										<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
											<Car className="h-7 w-7 text-primary" />
										</div>
										<Badge variant="secondary" className="mb-2">
											Mileage
										</Badge>
										<h3 className="text-base font-semibold text-foreground">
											{currentReceipt.vendorName || "Mileage"}
										</h3>
										<p className="mt-1 text-sm text-muted-foreground">
											{currentReceipt.dateOfPurchase
												? formatDate(currentReceipt.dateOfPurchase)
												: "No date"}
										</p>
										<p className="mt-3 text-sm tabular-nums text-muted-foreground">
											{formatNumber(currentReceipt.miles ?? 0)} mi ×{" "}
											{formatCurrencyUSD(
												currentReceipt.mileageRatePerMile ??
													MILEAGE_RATE_PER_MILE,
											)}
											/mi
										</p>
										<p className="mt-4 font-mono text-3xl font-bold tabular-nums text-foreground">
											{formatCurrencyUSD(calculateReceiptTotal(currentReceipt))}
										</p>
										<p className="mt-4 max-w-md text-sm leading-snug text-foreground">
											{formatMileageRoute(
												currentReceipt.mileageFrom,
												currentReceipt.mileageTo,
												currentReceipt.mileageStops,
											) ||
												currentReceipt.location?.trim() ||
												""}
										</p>
										{(currentReceipt.mileageFrom?.trim() ||
											currentReceipt.mileageTo?.trim() ||
											(currentReceipt.mileageStops &&
												currentReceipt.mileageStops.length > 0)) && (
											<div className="mt-4 w-full max-w-md space-y-2 border-t border-border pt-4 text-left text-xs text-muted-foreground">
												<div>
													<span className="font-semibold text-muted-foreground">
														From
													</span>
													<p className="mt-0.5">
														{currentReceipt.mileageFrom?.trim() || "—"}
													</p>
												</div>
												<div>
													<span className="font-semibold text-muted-foreground">
														To
													</span>
													<p className="mt-0.5">
														{currentReceipt.mileageTo?.trim() || "—"}
													</p>
												</div>
												{currentReceipt.mileageStops &&
													currentReceipt.mileageStops.length > 0 && (
														<div>
															<span className="font-semibold text-muted-foreground">
																Stops
															</span>
															<ol className="mt-0.5 list-decimal list-inside space-y-0.5">
																{currentReceipt.mileageStops.map(
																	(s: string, i: number) => (
																		<li key={i}>{s}</li>
																	),
																)}
															</ol>
														</div>
													)}
											</div>
										)}
									</div>
								</div>
							) : (
								<Tabs defaultValue="image" className="h-full flex flex-col">
									<TabsList className="mx-4 mt-4 justify-start shrink-0">
										<TabsTrigger value="image">Receipt Image</TabsTrigger>
										<TabsTrigger value="invoice">Itemized Invoice</TabsTrigger>
									</TabsList>
									<TabsContent
										value="image"
										className="flex-1 p-4 m-0 overflow-hidden"
									>
										<ReceiptViewer
											receiptUrl={currentReceipt.receiptFile || ""}
											receiptName={`Receipt ${activeReceiptIndex + 1}`}
											className="h-full"
										/>
									</TabsContent>
									<TabsContent
										value="invoice"
										className="flex-1 p-4 m-0 overflow-auto"
									>
										<div className="h-full flex flex-col">
											<div className="bg-background border border-border rounded-lg overflow-hidden flex flex-col h-full">
												{/* Header */}
												<div className="px-5 py-4 border-b border-border ">
													<div className="flex justify-between items-center">
														<div>
															<h3 className="text-base font-semibold text-foreground">
																{currentReceipt.vendorName || "Unknown Vendor"}
															</h3>
															<p className="text-sm text-muted-foreground mt-0.5">
																{currentReceipt.dateOfPurchase
																	? formatDate(currentReceipt.dateOfPurchase)
																	: "No date"}
															</p>
														</div>
														<Badge className="bg-ds-purple-100 text-tone-purple hover:bg-ds-purple-100 border-ds-purple-100">
															AI Extracted
														</Badge>
													</div>
												</div>

												{/* Line Items */}
												<div className="flex-1 overflow-auto">
													<table className="w-full">
														<thead className="sticky top-0 bg-muted border-b border-border z-10">
															<tr>
																<th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
																	Description
																</th>
																<th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-32">
																	Category
																</th>
																<th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground w-16">
																	Qty
																</th>
																<th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground w-28">
																	Amount
																</th>
															</tr>
														</thead>
														<tbody className="divide-y divide-border">
															{currentReceipt.lineItems?.map(
																(item: any, i: number) => (
																	<tr
																		key={i}
																		className="hover:bg-muted/50 transition-colors group"
																	>
																		<td className="px-4 py-3">
																			<span
																				className="block text-sm font-medium text-foreground truncate max-w-[220px]"
																				title={item.description}
																			>
																				{item.description}
																			</span>
																		</td>
																		<td className="px-4 py-3">
																			<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground border border-border">
																				{item.category}
																			</span>
																		</td>
																		<td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
																			{item.quantity || 1}
																		</td>
																		<td className="px-4 py-3 text-right text-sm font-mono font-medium text-foreground tabular-nums">
																			{formatCurrencyUSD(item.amount || 0)}
																		</td>
																	</tr>
																),
															)}
															{(!currentReceipt.lineItems ||
																currentReceipt.lineItems.length === 0) && (
																<tr>
																	<td
																		colSpan={4}
																		className="px-4 py-12 text-center text-muted-foreground"
																	>
																		<div className="flex flex-col items-center gap-2">
																			<Receipt className="w-8 h-8 opacity-50" />
																			<span className="text-sm">
																				No line items found
																			</span>
																		</div>
																	</td>
																</tr>
															)}
														</tbody>
													</table>
												</div>

												{/* Totals */}
												<div className="border-t border-border bg-muted/50">
													<div className="px-5 py-4 space-y-2">
														<div className="flex justify-between text-sm">
															<span className="text-muted-foreground">
																Subtotal
															</span>
															<span className="font-mono tabular-nums text-foreground">
																{formatCurrencyUSD(
																	currentReceipt.subtotal || 0,
																)}
															</span>
														</div>
														{currentReceipt.tax && currentReceipt.tax > 0 && (
															<div className="flex justify-between text-sm">
																<span className="text-muted-foreground">
																	Tax
																</span>
																<span className="font-mono tabular-nums text-foreground">
																	{formatCurrencyUSD(currentReceipt.tax)}
																</span>
															</div>
														)}
														{currentReceipt.tip && currentReceipt.tip > 0 && (
															<div className="flex justify-between text-sm">
																<span className="text-muted-foreground">
																	Tip
																</span>
																<span className="font-mono tabular-nums text-foreground">
																	{formatCurrencyUSD(currentReceipt.tip)}
																</span>
															</div>
														)}
														{currentReceipt.shipping &&
															currentReceipt.shipping > 0 && (
																<div className="flex justify-between text-sm">
																	<span className="text-muted-foreground">
																		Shipping
																	</span>
																	<span className="font-mono tabular-nums text-foreground">
																		{formatCurrencyUSD(currentReceipt.shipping)}
																	</span>
																</div>
															)}
														<div className="pt-3 mt-2 border-t border-border">
															<div className="flex justify-between">
																<span className="text-sm font-semibold text-foreground">
																	Total
																</span>
																<span className="text-base font-bold font-mono tabular-nums text-foreground">
																	{formatCurrencyUSD(
																		calculateReceiptTotal(currentReceipt),
																	)}
																</span>
															</div>
														</div>
													</div>
												</div>
											</div>
										</div>
									</TabsContent>
								</Tabs>
							)
						) : (
							<div className="flex items-center justify-center h-full text-muted-foreground">
								<div className="text-center">
									<Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
									<p className="text-sm">No receipt selected</p>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Paid Confirmation Modal */}
				<ResponsiveOverlay
					open={isPaidModalOpen}
					onOpenChange={(open) => {
						if (!open) void closePaidModal();
					}}
					title={
						isReviewingPayment ? "Review Payment Details" : "Process Payment"
					}
					variant={isReviewingPayment ? "fullscreen" : "large-sheet"}
					className={isReviewingPayment ? "sm:max-w-4xl" : undefined}
					footer={
						<div className="flex w-full gap-2">
							<Button
								variant="outline"
								className="h-11 flex-1 sm:h-9 sm:flex-none"
								onClick={() => void closePaidModal()}
							>
								Cancel
							</Button>
							<Button
								onClick={
									isReviewingPayment ? handleConfirmPayment : handleProcessProof
								}
								disabled={isPaidModalBusy}
								className={cn(
									"h-11 flex-1 sm:h-9 sm:flex-none",
									paidModalView?.status === "extracting"
										? "bg-ds-purple-700"
										: "",
								)}
							>
								{isPaidModalBusy ? (
									<Loader2 className="h-4 w-4 animate-spin mr-1" />
								) : null}
								{isReviewingPayment
									? "Confirm Payment"
									: aiEnabled
										? "Process & Analyze"
										: "Process & Continue"}
							</Button>
						</div>
					}
				>
					{paymentReview ? (
						<div className="flex flex-col gap-6 md:flex-row">
							{/* Left: Inputs */}
							<div className="flex-1 space-y-4">
								<div className="bg-ds-blue-100 border border-ds-blue-100 p-3 rounded-lg flex items-start gap-3">
									<Sparkles className="w-5 h-5 text-tone-info mt-0.5" />
									<div className="text-sm text-tone-info">
										<p className="font-semibold">
											{aiEnabled
												? "AI Extraction Complete"
												: "Manual Entry Mode"}
										</p>
										<p className="opacity-80">
											{aiEnabled
												? "Please verify the details below match the proof."
												: "AI is disabled for this account. Enter and verify payment details manually."}
										</p>
									</div>
								</div>

								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor={`${formId}-payment-date`}>
											Payment Date
										</Label>
										<Input
											id={`${formId}-payment-date`}
											name="paymentDate"
											autoComplete="off"
											type="date"
											value={paymentReview.form.paymentDate}
											onChange={setPaymentReviewField("paymentDate")}
											disabled={paymentReview.status === "submitting"}
											className="h-11 text-base sm:h-9 sm:text-sm"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor={`${formId}-payment-amount`}>
											Amount Paid
										</Label>
										<div className="relative">
											<span
												className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
												aria-hidden="true"
											>
												$
											</span>
											<Input
												id={`${formId}-payment-amount`}
												name="paymentAmount"
												autoComplete="off"
												type="number"
												inputMode="decimal"
												step="0.01"
												value={paymentReview.form.amount}
												onChange={setPaymentReviewField("amount")}
												disabled={paymentReview.status === "submitting"}
												className="h-11 pl-7 text-base tabular-nums sm:h-9 sm:text-sm"
											/>
										</div>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor={`${formId}-payment-confirmation`}>
										Confirmation Number
									</Label>
									<Input
										id={`${formId}-payment-confirmation`}
										name="confirmationNumber"
										autoComplete="off"
										spellCheck={false}
										placeholder="Transaction ID…"
										value={paymentReview.form.confirmationNumber}
										onChange={setPaymentReviewField("confirmationNumber")}
										disabled={paymentReview.status === "submitting"}
										className="h-11 text-base sm:h-9 sm:text-sm"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor={`${formId}-payment-memo`}>Memo / Notes</Label>
									<Textarea
										id={`${formId}-payment-memo`}
										name="paymentMemo"
										autoComplete="off"
										placeholder="Any additional notes…"
										value={paymentReview.form.memo}
										onChange={setPaymentReviewField("memo")}
										disabled={paymentReview.status === "submitting"}
										rows={2}
										className="text-base sm:text-sm"
									/>
								</div>
							</div>

							{/* Right: Preview */}
							<div className="w-full shrink-0 md:w-1/3">
								<p className="text-xs font-medium text-muted-foreground mb-2">
									Proof Preview
								</p>
								<div className="border rounded-lg overflow-hidden h-64 bg-muted flex items-center justify-center relative">
									{paymentReview.proofUrl ? (
										<img
											src={paymentReview.proofUrl}
											width={320}
											height={256}
											className="w-full h-full object-contain"
											alt="Uploaded proof of payment"
										/>
									) : (
										<FileText className="text-muted-foreground w-12 h-12" />
									)}
									{paymentReview.proofUrl && (
										<a
											href={paymentReview.proofUrl}
											target="_blank"
											rel="noreferrer"
											className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-medium opacity-100 md:opacity-0 md:hover:opacity-100 transition-opacity"
										>
											View Full Image
										</a>
									)}
								</div>
							</div>
						</div>
					) : (
						<div className="py-2">
							<FileDropTarget
								disabled={isPaidModalBusy}
								onFiles={onProofFiles}
								className={`border-2 border-dashed rounded-md p-8 text-center ${
									proofFile
										? "border-ds-blue-700 bg-ds-blue-100"
										: "border-border active:border-ds-gray-500 sm:hover:border-ds-gray-500 bg-muted"
								}`}
							>
								<input
									type="file"
									id={`${formId}-payment-proof-upload`}
									name="paymentProof"
									aria-label="Upload proof of payment"
									accept="image/*,application/pdf"
									onChange={(e) => {
										onProofFiles(e.target.files);
										e.target.value = "";
									}}
									disabled={isPaidModalBusy}
									className="sr-only"
								/>

								<label
									htmlFor={`${formId}-payment-proof-upload`}
									className="cursor-pointer space-y-3 block min-h-11"
								>
									{proofFile ? (
										<>
											<CheckCircle className="w-12 h-12 text-tone-info mx-auto" />
											<output className="block">
												<p className="font-bold break-words">
													{proofFile.name}
												</p>
												<p className="text-sm text-muted-foreground">
													Ready to process
												</p>
											</output>
										</>
									) : (
										<>
											<div className="w-12 h-12 bg-ds-blue-100 text-tone-info rounded-full flex items-center justify-center mx-auto mb-2">
												<UploadCloud className="w-6 h-6" />
											</div>
											<div>
												<p className="font-bold text-lg">
													Upload Proof of Payment
												</p>
												<p className="text-sm text-muted-foreground">
													Click to browse, drop a file, or paste a screenshot
												</p>
											</div>
											<Badge variant="secondary" className="mt-4">
												Use “Paste” for quick screenshots
											</Badge>
										</>
									)}
								</label>
								{proofFile && (
									<Button
										className="mt-3 h-11 sm:h-9"
										variant="outline"
										onClick={() => {
											setProofPickerMessage(null);
											dispatchPaidModal({ type: "proofSelected", file: null });
										}}
										disabled={isPaidModalBusy}
									>
										Remove File
									</Button>
								)}
								{proofPickerMessage && (
									<output
										aria-live="polite"
										className="mt-3 block text-sm text-tone-warning"
									>
										{proofPickerMessage}
									</output>
								)}
							</FileDropTarget>

							{/* Info about AI */}
							<div className="mt-6 flex gap-3 p-3 bg-muted/50 rounded-lg border items-start">
								<Sparkles className="w-5 h-5 text-tone-purple shrink-0 mt-0.5" />
								<div className="text-xs text-muted-foreground">
									<p className="font-semibold text-foreground">
										{aiEnabled ? "AI-Powered Extraction" : "Manual Mode"}
									</p>
									<p>
										{aiEnabled
											? "Upload a screenshot and our AI will automatically extract the confirmation number, date, and amount for you to review."
											: "Upload a screenshot, then fill payment details manually after upload."}
									</p>
								</div>
							</div>
						</div>
					)}
				</ResponsiveOverlay>
				{declineOverlay}
			</div>
		);
	}

	// List View
	return (
		<DashboardPage>
			<PageHeader
				title="Manage Reimbursements"
				description="Review and process reimbursement requests."
			/>

			{/* Search & Filter */}
			<div className="flex flex-col sm:flex-row gap-4">
				<div className="relative flex-1 max-w-sm">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						type="search"
						name="q"
						aria-label="Search reimbursements"
						autoComplete="off"
						placeholder="Search title, business purpose, submitter name, Zelle info…"
						value={search}
						onChange={(e) => setSearchParams({ q: e.target.value, page: 1 })}
						className="pl-9"
					/>
				</div>
				<div className="flex flex-wrap gap-2">
					{(["submitted", "approved", "paid", "declined"] as const).map(
						(status) => (
							<Button
								key={status}
								variant={statusFilter.has(status) ? "default" : "outline"}
								size="sm"
								aria-pressed={statusFilter.has(status)}
								onClick={() => {
									const newFilter = new Set(statusFilter);
									if (newFilter.has(status)) {
										newFilter.delete(status);
									} else {
										newFilter.add(status);
									}
									setSearchParams({
										status: REIMBURSEMENT_STATUSES.filter((s) =>
											newFilter.has(s),
										),
										page: 1,
									});
								}}
								className="gap-1.5"
							>
								{getStatusIcon(status)}
								{status.charAt(0).toUpperCase() + status.slice(1)}
								{statusFilter.has(status) && (
									<CheckCircle className="w-3 h-3 ml-1" />
								)}
							</Button>
						),
					)}
				</div>
			</div>

			{/* Reimbursements Table / Mobile queue */}
			{!reimbursements ? (
				<output className="block space-y-3" aria-busy="true">
					<span className="sr-only">Loading reimbursements…</span>
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-16 w-full rounded-md" />
					))}
				</output>
			) : paginated.length > 0 ? (
				isMobile ? (
					<div className="space-y-3">
						<MobileDataList>
							{paginated.map((r) => {
								const totalAmt = calculateTotalAmount(r);
								const age = formatRelativeTime(r._creationTime);
								return (
									<MobileDataListItem
										key={r._id}
										title={r.title}
										subtitle={r.submittedByName || r.submittedBy}
										meta={`${r.department} · ${age}`}
										trailing={formatCurrencyUSD(totalAmt)}
										status={
											<Badge
												className={statusColors[r.status]}
												variant="secondary"
											>
												<span className="flex items-center gap-1">
													{getStatusIcon(r.status)}
													{statusLabels[r.status]}
												</span>
											</Badge>
										}
										onClick={() => handleViewDetails(r)}
									/>
								);
							})}
						</MobileDataList>
						{totalPages > 1 && (
							<div className="flex items-center justify-between gap-3 px-1">
								<Button
									variant="outline"
									className="h-11 flex-1"
									disabled={page <= 1}
									onClick={() => setPage(page - 1)}
								>
									Previous
								</Button>
								<span className="shrink-0 text-xs tabular-nums text-muted-foreground">
									Page {page} of {totalPages}
								</span>
								<Button
									variant="outline"
									className="h-11 flex-1"
									disabled={page >= totalPages}
									onClick={() => setPage(page + 1)}
								>
									Next
								</Button>
							</div>
						)}
					</div>
				) : (
					<div className="rounded-md border bg-card overflow-hidden">
						<div className="overflow-x-auto">
							<Table>
								<TableHeader>
									<TableRow className="bg-muted/50 hover:bg-muted/50">
										{renderSortableHead("title", "Title")}
										{renderSortableHead("totalAmount", "Amount")}
										{renderSortableHead("_creationTime", "Date")}
										{renderSortableHead("status", "Status")}
										{renderSortableHead("department", "Department")}
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{paginated.map((r) => {
										const isHovered = hoveredRow === r._id;
										const totalAmt = calculateTotalAmount(r);
										const reviewStep = getReviewStep(r);
										const pendingAction = pendingActions[r._id];

										return (
											<TableRow
												key={r._id}
												className="group cursor-pointer"
												onMouseEnter={() => setHoveredRow(r._id)}
												onMouseLeave={() => setHoveredRow(null)}
												onClick={() => handleViewDetails(r)}
											>
												<TableCell className="min-w-[200px]">
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															handleViewDetails(r);
														}}
														className="block font-medium text-foreground text-left truncate max-w-[250px] hover:underline"
													>
														{r.title}
													</button>
													<div className="text-xs text-muted-foreground">
														{r.submittedByName || r.submittedBy}
													</div>
													{r.submittedByZelle && (
														<div className="text-xs text-tone-info mt-0.5 truncate max-w-[250px]">
															Zelle: {r.submittedByZelle}
														</div>
													)}
												</TableCell>
												<TableCell>
													<span className="font-mono font-semibold tabular-nums">
														{formatCurrencyUSD(totalAmt)}
													</span>
												</TableCell>
												<TableCell>
													<div className="text-sm">
														{formatDate(r._creationTime)}
													</div>
													<div className="text-xs text-muted-foreground">
														{formatTime(r._creationTime)}
													</div>
												</TableCell>
												<TableCell>
													<Badge
														className={statusColors[r.status]}
														variant="secondary"
													>
														<span className="flex items-center gap-1">
															{getStatusIcon(r.status)}
															{statusLabels[r.status]}
														</span>
													</Badge>
												</TableCell>
												<TableCell>
													<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">
														{r.department}
													</span>
												</TableCell>
												<TableCell className="text-right">
													<div
														className={`flex items-center justify-end gap-1 transition-opacity duration-200 focus-within:opacity-100 ${
															isHovered ? "opacity-100" : "opacity-0"
														}`}
													>
														{reviewStep === "approveOrDecline" && (
															<>
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-8 w-8 p-0 text-tone-success hover:text-tone-success hover:bg-ds-green-100"
																	onClick={(e) => {
																		e.stopPropagation();
																		handleStatusChange(r._id, "approved");
																	}}
																	disabled={pendingAction !== undefined}
																	title="Approve"
																	aria-label={`Approve ${r.title}`}
																>
																	{pendingAction === "approve" ? (
																		<Loader2 className="h-4 w-4 animate-spin" />
																	) : (
																		<CheckCircle className="h-4 w-4" />
																	)}
																</Button>
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-8 w-8 p-0 text-tone-danger hover:text-tone-danger hover:bg-ds-red-100"
																	onClick={(e) => {
																		e.stopPropagation();
																		handleDecline(r._id);
																	}}
																	disabled={pendingAction !== undefined}
																	title="Decline"
																	aria-label={`Decline ${r.title}`}
																>
																	<XCircle className="h-4 w-4" />
																</Button>
															</>
														)}
														{reviewStep === "markPaid" && (
															<Button
																variant="ghost"
																size="sm"
																className="h-8 w-8 p-0 text-tone-purple hover:text-tone-info hover:bg-ds-purple-100"
																onClick={(e) => {
																	e.stopPropagation();
																	handleViewDetails(r);
																	openPaidModal(r._id);
																}}
																title="Mark as Paid"
																aria-label={`Mark ${r.title} as paid`}
															>
																<DollarSign className="h-4 w-4" />
															</Button>
														)}
														<Button
															variant="ghost"
															size="sm"
															className="h-8 w-8 p-0"
															onClick={(e) => {
																e.stopPropagation();
																handleViewDetails(r);
															}}
															title="View Details"
															aria-label={`View details for ${r.title}`}
														>
															<Eye className="h-4 w-4" />
														</Button>
													</div>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
						<div className="p-4 border-t">
							<Pagination
								currentPage={page}
								totalPages={totalPages}
								onPageChange={setPage}
							/>
						</div>
					</div>
				)
			) : (
				<div className="text-center py-12 text-muted-foreground">
					<CreditCard className="mx-auto h-12 w-12 mb-4 opacity-50" />
					<p className="text-lg font-medium">No Reimbursement Requests</p>
					<p className="text-sm">
						{search || statusFilter.size > 0
							? "Try adjusting your filters."
							: "Reimbursement requests will appear here."}
					</p>
				</div>
			)}
			{declineOverlay}
		</DashboardPage>
	);
}
