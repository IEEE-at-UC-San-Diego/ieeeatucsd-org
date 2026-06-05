import { createFileRoute } from "@tanstack/react-router";
import { useAuthedQuery, useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
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
import { Pagination } from "@/components/ui/pagination";
import ReceiptViewer from "@/components/reimbursement/ReceiptViewer";
import {
	Search,
	ChevronUp,
	ChevronDown,
	ChevronsUpDown,
	Loader2,
	Receipt,
	Clock,
	DollarSign,
	CheckCircle,
	XCircle,
	CreditCard,
	Eye,
	AlertCircle,
	ArrowLeft,
	Sparkles,
	UploadCloud,
	FileText,
	Car,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { sendNotification } from "@/lib/send-notification";
import { format, formatDistanceToNow } from "date-fns";
import {
	MILEAGE_RATE_PER_MILE,
	computeMileageTotal,
	formatMileageRoute,
} from "@/lib/reimbursement-mileage";

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
			color: "bg-blue-500",
			icon: FileText,
		},
		status_changed_to_approved: {
			label: "Approved",
			description: "Request was reviewed and approved",
			color: "bg-green-500",
			icon: CheckCircle,
		},
		status_changed_to_declined: {
			label: "Declined",
			description: "Request was reviewed and declined",
			color: "bg-red-500",
			icon: XCircle,
		},
		status_changed_to_paid: {
			label: "Marked as Paid",
			description: "Payment has been processed",
			color: "bg-emerald-500",
			icon: DollarSign,
		},
		payment_details_added: {
			label: "Payment Confirmed",
			description: "Payment confirmation details were recorded",
			color: "bg-emerald-600",
			icon: CreditCard,
		},
		status_changed_to_submitted: {
			label: "Re-submitted",
			description: "Request was re-submitted for review",
			color: "bg-blue-500",
			icon: FileText,
		},
	};
	return (
		map[action] || {
			label: action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
			description: "",
			color: "bg-gray-400",
			icon: Clock,
		}
	);
}

export const Route = createFileRoute("/_dashboard/manage-reimbursements")({
	component: ManageReimbursementsPage,
});

const ITEMS_PER_PAGE = 10;

type ReimbursementStatus = "submitted" | "approved" | "declined" | "paid";
type SortField =
	| "title"
	| "totalAmount"
	| "_creationTime"
	| "status"
	| "department"
	| "submittedBy";
type SortDirection = "asc" | "desc";

interface SortConfig {
	field: SortField;
	direction: SortDirection;
}

const statusColors: Record<ReimbursementStatus, string> = {
	submitted: "bg-amber-100 text-amber-800",
	approved: "bg-green-100 text-green-800",
	declined: "bg-red-100 text-red-800",
	paid: "bg-purple-100 text-purple-800",
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
	const { hasAdminAccess, logtoId, user, getAuthHeaders, isLoading } =
		usePermissions();
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
	const getStorageUrl = useAuthedMutation(api.reimbursements.getStorageUrl);

	// Table state
	type Reimbursement = typeof reimbursements extends infer R
		? R extends Array<infer T>
			? T
			: never
		: never;
	const [selectedReimbursement, setSelectedReimbursement] =
		useState<Reimbursement | null>(null);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<Set<ReimbursementStatus>>(
		new Set(["submitted", "approved"]),
	);
	const [page, setPage] = useState(1);
	const [sortConfig, setSortConfig] = useState<SortConfig>({
		field: "_creationTime",
		direction: "desc",
	});
	const [hoveredRow, setHoveredRow] = useState<string | null>(null);
	const [viewMode, setViewMode] = useState<"list" | "detail">("list");
	const [processingId, setProcessingId] = useState<string | null>(null);

	// Paid confirmation modal state
	const [isPaidModalOpen, setIsPaidModalOpen] = useState(false);
	const [paidConfirmationNumber, setPaidConfirmationNumber] = useState("");
	const [paidProofFile, setPaidProofFile] = useState<File | null>(null);
	const [paymentReviewData, setPaymentReviewData] = useState<any>(null);
	const [paymentDate, setPaymentDate] = useState("");
	const [paymentAmount, setPaymentAmount] = useState("");
	const [paymentMemo, setPaymentMemo] = useState("");
	const [uploadedProofUrl, setUploadedProofUrl] = useState("");
	const [aiProcessing, setAiProcessing] = useState(false);

	// Receipt viewer state
	const [activeReceiptIndex, setActiveReceiptIndex] = useState(0);

	// Handle paste for file upload
	useEffect(() => {
		const handlePaste = (e: ClipboardEvent) => {
			if (!isPaidModalOpen || paymentReviewData) return;

			const items = e.clipboardData?.items;
			if (!items) return;

			for (let i = 0; i < items.length; i++) {
				if (items[i].type.indexOf("image") !== -1) {
					const file = items[i].getAsFile();
					if (file) {
						setPaidProofFile(file);
						toast.success("Image pasted successfully");
						e.preventDefault();
						break;
					}
				}
			}
		};

		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [isPaidModalOpen, paymentReviewData]);

	const handleSort = useCallback((field: SortField) => {
		setSortConfig((prev) => ({
			field,
			direction:
				prev.field === field
					? prev.direction === "asc"
						? "desc"
						: "asc"
					: "asc",
		}));
	}, []);

	const getSortIcon = (field: SortField) => {
		if (sortConfig.field === field) {
			return sortConfig.direction === "asc" ? (
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
					(r.submittedByName && r.submittedByName.toLowerCase().includes(search.toLowerCase())) ||
					r.submittedBy.toLowerCase().includes(search.toLowerCase()) ||
					(r.submittedByZelle && r.submittedByZelle.toLowerCase().includes(search.toLowerCase()));
				const matchesStatus =
					statusFilter.size === 0 || statusFilter.has(r.status);
				return matchesSearch && matchesStatus;
			})
			.sort((a, b) => {
				let aValue: any;
				let bValue: any;

				switch (sortConfig.field) {
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

				if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
				if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
				return 0;
			});
	}, [reimbursements, search, statusFilter, sortConfig]);

	const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
	const paginated = filtered.slice(
		(page - 1) * ITEMS_PER_PAGE,
		page * ITEMS_PER_PAGE,
	);

	// Action handlers
	const handleStatusChange = async (
		id: string,
		status: ReimbursementStatus,
		reason?: string,
	) => {
		const trimmedReason = reason?.trim();
		if (status === "declined" && !trimmedReason) {
			toast.error("Decline reason is required");
			return;
		}

		setProcessingId(id);
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

			if (selectedReimbursement && selectedReimbursement._id === id) {
				setViewMode("list");
				setSelectedReimbursement(null);
			}
		} catch {
			toast.error("Failed to update status");
		} finally {
			setProcessingId(null);
		}
	};

	const handleDecline = async (id: string) => {
		const reasonInput = window.prompt(
			"Please provide a reason for declining this reimbursement:",
		);
		if (reasonInput === null) return;

		const reason = reasonInput.trim();
		if (!reason) {
			toast.error("Decline reason is required");
			return;
		}

		await handleStatusChange(id, "declined", reason);
	};

	const handleApproveFull = async () => {
		if (!selectedReimbursement) return;
		setProcessingId(selectedReimbursement._id);
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
			toast.error("Failed to approve reimbursement");
		} finally {
			setProcessingId(null);
		}
	};

	const handlePaidSubmit = async () => {
		if (!selectedReimbursement) return;

		// Step 2: Final Confirmation
		if (paymentReviewData) {
			if (!paidConfirmationNumber.trim()) {
				toast.error("Missing Information", {
					description: "Please provide a confirmation number.",
				});
				return;
			}

			setProcessingId(selectedReimbursement._id);
			try {
				await updatePaymentDetails({
					logtoId: logtoId!,
					id: selectedReimbursement._id,
					paymentDetails: {
						confirmationNumber: paidConfirmationNumber.trim(),
						paymentDate: new Date(paymentDate || Date.now()).getTime(),
						amountPaid:
							parseFloat(paymentAmount) ||
							calculateTotalAmount(selectedReimbursement),
						proofFileUrl: uploadedProofUrl || undefined,
						memo: paymentMemo || undefined,
					},
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
							confirmationNumber: paidConfirmationNumber.trim(),
							paymentDate: new Date(paymentDate || Date.now()).getTime(),
							amountPaid:
								parseFloat(paymentAmount) ||
								calculateTotalAmount(selectedReimbursement),
						},
					});
				}
				setIsPaidModalOpen(false);
				resetPaidModal();
				setViewMode("list");
				setSelectedReimbursement(null);
			} catch {
				toast.error("Failed to mark as paid");
			} finally {
				setProcessingId(null);
			}
			return;
		}

		// Step 1: Initial Processing (Upload & AI)
		if (!paidProofFile) {
			toast.error("Missing File", {
				description: "Please upload a proof of payment.",
			});
			return;
		}

		setProcessingId(selectedReimbursement._id);
		setAiProcessing(true);
		try {
			const uploadUrl = await generateUploadUrl({});
			const uploadResponse = await fetch(uploadUrl, {
				method: "POST",
				headers: {
					"Content-Type": paidProofFile.type || "application/octet-stream",
				},
				body: paidProofFile,
			});

			if (!uploadResponse.ok) {
				throw new Error("Failed to upload proof file");
			}

			const { storageId } = await uploadResponse.json();
			const proofUrl = await getStorageUrl({ storageId });
			if (!proofUrl) {
				throw new Error("Could not resolve uploaded proof file URL");
			}
			setUploadedProofUrl(proofUrl);

			if (!aiEnabled) {
				setPaymentReviewData({ manual: true });
				setPaymentDate(new Date().toISOString().split("T")[0]);
				setPaymentAmount(
					calculateTotalAmount(selectedReimbursement).toFixed(2),
				);
				toast.success("Proof uploaded", {
					description: "AI is disabled. Please enter payment details manually.",
				});
				return;
			}

			const response = await fetch("/api/extract-payment-details", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...getAuthHeaders() },
				body: JSON.stringify({ imageUrl: proofUrl }),
			});

			if (!response.ok) {
				throw new Error("AI extraction failed");
			}

			const result = await response.json();
			if (result.success && result.data) {
				const data = result.data;
				setPaymentReviewData(data);
				if (data.confirmationNumber) {
					setPaidConfirmationNumber(data.confirmationNumber);
				}
				if (data.paymentDate) {
					setPaymentDate(data.paymentDate);
				} else {
					setPaymentDate(new Date().toISOString().split("T")[0]);
				}
				if (typeof data.amountPaid === "number" && data.amountPaid > 0) {
					setPaymentAmount(data.amountPaid.toString());
				} else {
					setPaymentAmount(
						calculateTotalAmount(selectedReimbursement).toFixed(2),
					);
				}
				if (data.memo) {
					setPaymentMemo(data.memo);
				}

				toast.success("Details extracted", {
					description: "Please review the payment details.",
				});
			} else {
				throw new Error(result.error || "No data returned");
			}
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Could not process payment proof.";
			toast.error("AI Extraction Failed", {
				description: `${message} Please enter details manually.`,
			});
			setPaymentReviewData({ manual: true });
			setPaymentDate(new Date().toISOString().split("T")[0]);
			setPaymentAmount(calculateTotalAmount(selectedReimbursement).toFixed(2));
		} finally {
			setAiProcessing(false);
			setProcessingId(null);
		}
	};

	const resetPaidModal = () => {
		setPaidConfirmationNumber("");
		setPaidProofFile(null);
		setPaymentReviewData(null);
		setPaymentDate("");
		setPaymentAmount("");
		setPaymentMemo("");
		setUploadedProofUrl("");
		setAiProcessing(false);
	};

	const handleViewDetails = (reimbursement: any) => {
		setSelectedReimbursement(reimbursement);
		setActiveReceiptIndex(0);
		setViewMode("detail");
	};

	const handleBackToList = () => {
		setViewMode("list");
		setSelectedReimbursement(null);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[60vh]">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!hasAdminAccess) {
		return (
			<div className="p-6 text-center text-muted-foreground">
				You don't have permission to access this page.
			</div>
		);
	}

	const currentReceipt =
		selectedReimbursement?.receipts?.[activeReceiptIndex] || null;
	const currentIsMileage = currentReceipt?.expenseType === "mileage";

	// Detail View - Split Pane Layout
	if (viewMode === "detail" && selectedReimbursement) {
		return (
			<div className="flex flex-col h-full bg-muted/50 absolute inset-0 z-10 overflow-hidden">
				{/* Header */}
				<div className="bg-white border-b px-6 py-4 flex items-center justify-between shrink-0 h-16 box-border">
					<div className="flex items-center gap-4 min-w-0">
						<Button
							variant="ghost"
							size="icon"
							onClick={handleBackToList}
							className="-ml-2 shrink-0"
						>
							<ArrowLeft className="h-5 w-5" />
						</Button>
						<div className="min-w-0">
							<div className="flex items-center gap-3">
								<h2
									className="text-lg font-bold truncate"
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
								<span>{selectedReimbursement.submittedByName || selectedReimbursement.submittedBy}</span>
								<span className="text-muted-foreground/40">·</span>
								<span className="capitalize">
									{selectedReimbursement.department}
								</span>
								<span className="text-muted-foreground/40">·</span>
								<span>{selectedReimbursement.paymentMethod}</span>
								<span className="text-muted-foreground/40">·</span>
								<span>
									{format(selectedReimbursement._creationTime, "MMM d, yyyy")}
								</span>
							</div>
						</div>
					</div>
					<div className="text-right shrink-0 ml-4">
						<p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
							Total Amount
						</p>
						<p className="text-xl font-bold tabular-nums">
							${calculateTotalAmount(selectedReimbursement).toFixed(2)}
						</p>
					</div>
				</div>

				{/* Split Pane Content */}
				<div className="flex-1 flex overflow-hidden">
					{/* Left Panel (5/12) */}
					<div className="w-5/12 flex flex-col border-r border-gray-200 bg-white overflow-y-auto">
						<div className="p-6 space-y-8">
							{/* Actions Section */}
							{(selectedReimbursement.status === "submitted" ||
								selectedReimbursement.status === "approved") && (
								<section className="border-b border-gray-100 pb-6 space-y-3">
									<h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
										Actions
									</h3>
									<div className="flex flex-wrap gap-2">
										{selectedReimbursement.status === "submitted" && (
											<>
												<Button
													size="sm"
													onClick={handleApproveFull}
													disabled={processingId === selectedReimbursement._id}
													className="bg-green-600 hover:bg-green-700"
												>
													{processingId === selectedReimbursement._id ? (
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
													disabled={processingId === selectedReimbursement._id}
												>
													<XCircle className="h-4 w-4 mr-1" />
													Decline
												</Button>
											</>
										)}
										{selectedReimbursement.status === "approved" &&
											!selectedReimbursement.paymentDetails && (
												<Button
													size="sm"
													onClick={() => setIsPaidModalOpen(true)}
													className="bg-purple-600 hover:bg-purple-700"
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
								<h3 className="text-sm font-bold text-gray-900">
									Request Details
								</h3>
								<div className="space-y-4 text-sm">
									<div className="grid grid-cols-3 gap-2">
										<span className="text-gray-500 font-medium">
											Department
										</span>
										<span className="col-span-2 text-gray-900 capitalize">
											{selectedReimbursement.department}
										</span>
									</div>
									<div className="grid grid-cols-3 gap-2">
										<span className="text-gray-500 font-medium">
											Payment Method
										</span>
										<span className="col-span-2 text-gray-900">
											{selectedReimbursement.paymentMethod}
										</span>
									</div>
									<div className="grid grid-cols-3 gap-2">
										<span className="text-gray-500 font-medium">
											Total Amount
										</span>
										<span className="col-span-2 text-gray-900 tabular-nums font-medium">
											${calculateTotalAmount(selectedReimbursement).toFixed(2)}
										</span>
									</div>
									<div className="grid grid-cols-3 gap-2">
										<span className="text-gray-500 font-medium">
											Submitted By
										</span>
										<span className="col-span-2 text-gray-900">
											{selectedReimbursement.submittedByName || selectedReimbursement.submittedBy}
										</span>
									</div>
									{selectedReimbursement.submittedByZelle && (
										<div className="grid grid-cols-3 gap-2">
											<span className="text-gray-500 font-medium">
												Zelle Info
											</span>
											<span className="col-span-2 text-gray-900 font-medium bg-green-50 px-2 py-0.5 rounded text-green-800">
												{selectedReimbursement.submittedByZelle}
											</span>
										</div>
									)}
									{selectedReimbursement.additionalInfo && (
										<div className="grid grid-cols-3 gap-2">
											<span className="text-gray-500 font-medium">
												Payment Info
											</span>
											<span className="col-span-2 text-gray-900 font-medium bg-blue-50 px-2 py-0.5 rounded text-blue-800">
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
										<h3 className="text-sm font-bold text-gray-900 flex justify-between">
											<span>Expenses</span>
											<span className="text-gray-500 font-medium text-xs">
												{selectedReimbursement.receipts.length} items
											</span>
										</h3>
										<div className="space-y-3">
											{selectedReimbursement.receipts.map(
												(receipt: any, idx: number) => (
													<div
														key={idx}
														onClick={() => setActiveReceiptIndex(idx)}
														className={`p-3 rounded-xl border cursor-pointer transition-all ${
															activeReceiptIndex === idx
																? "border-blue-500 bg-blue-50 ring-1 ring-blue-500/20"
																: "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
														}`}
													>
														<div className="flex justify-between items-start mb-1 gap-2">
															<div className="min-w-0 flex flex-wrap items-center gap-1.5">
																<span className="font-semibold text-gray-900">
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
															<span className="font-bold text-gray-900 tabular-nums shrink-0">
																${(receipt.total || 0).toFixed(2)}
															</span>
														</div>
														<div className="text-xs text-gray-500 flex justify-between gap-2">
															<span className="min-w-0 flex flex-col gap-0.5">
																{receipt.expenseType === "mileage" ? (
																	<>
																		<span className="truncate">
																			{receipt.dateOfPurchase
																				? format(
																						receipt.dateOfPurchase,
																						"MMM d, yyyy",
																					)
																				: "No date"}{" "}
																			·{" "}
																			{(receipt.miles ?? 0).toLocaleString(
																				undefined,
																				{ maximumFractionDigits: 2 },
																			)}{" "}
																			mi × ${MILEAGE_RATE_PER_MILE.toFixed(2)}
																			/mi
																		</span>
																		{(formatMileageRoute(
																			receipt.mileageFrom,
																			receipt.mileageTo,
																			receipt.mileageStops,
																		) ||
																			receipt.location?.trim()) && (
																			<span className="truncate text-gray-600">
																				{formatMileageRoute(
																					receipt.mileageFrom,
																					receipt.mileageTo,
																					receipt.mileageStops,
																				) || receipt.location}
																			</span>
																		)}
																	</>
																) : receipt.dateOfPurchase ? (
																	format(
																		receipt.dateOfPurchase,
																		"MMM d, yyyy",
																	)
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
													</div>
												),
											)}
										</div>
									</section>
								)}

							{/* Audit History */}
							{selectedReimbursement.auditLogs &&
								selectedReimbursement.auditLogs.length > 0 && (
									<section className="border-t border-gray-100 pt-6 space-y-4">
										<h3 className="text-sm font-bold text-gray-900">
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
																<div className="absolute left-[11px] top-7 bottom-0 w-px bg-gray-200" />
															)}
															<div
																className={`relative z-10 flex-shrink-0 w-[23px] h-[23px] rounded-full ${info.color} flex items-center justify-center ring-4 ring-white`}
															>
																<Icon className="w-3 h-3 text-white" />
															</div>
															<div className="flex-1 min-w-0 pt-0.5">
																<div className="flex items-baseline justify-between gap-2">
																	<span className="text-sm font-semibold text-gray-900">
																		{info.label}
																	</span>
																	<span className="text-[11px] text-gray-400 whitespace-nowrap">
																		{formatDistanceToNow(log.timestamp, {
																			addSuffix: true,
																		})}
																	</span>
																</div>
																{info.description && (
																	<p className="text-xs text-gray-500 mt-0.5">
																		{info.description}
																	</p>
																)}
																<p className="text-[11px] text-gray-400 mt-1">
																	{format(
																		log.timestamp,
																		"MMM d, yyyy 'at' h:mm a",
																	)}
																	{log.createdBy && (
																		<span className="ml-1.5 inline-flex items-center gap-1 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px] font-mono">
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
								<section className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
									<div className="flex items-center gap-2 border-b border-green-100 pb-2">
										<CheckCircle className="w-4 h-4 text-green-600" />
										<h3 className="text-xs font-bold text-green-900 uppercase tracking-wide">
											Payment Confirmed
										</h3>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div className="space-y-0.5">
											<p className="text-[11px] font-medium text-green-700 uppercase">
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
											<p className="text-[11px] font-medium text-green-700 uppercase">
												Amount Paid
											</p>
											<p className="text-sm tabular-nums font-medium">
												$
												{selectedReimbursement.paymentDetails.amountPaid.toFixed(
													2,
												)}
											</p>
										</div>
										{selectedReimbursement.paymentDetails.paymentDate && (
											<div className="space-y-0.5">
												<p className="text-[11px] font-medium text-green-700 uppercase">
													Payment Date
												</p>
												<p className="text-sm">
													{format(
														selectedReimbursement.paymentDetails.paymentDate,
														"MMM d, yyyy",
													)}
												</p>
											</div>
										)}
										{selectedReimbursement.paymentDetails.memo && (
											<div className="space-y-0.5 col-span-2">
												<p className="text-[11px] font-medium text-green-700 uppercase">
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
					<div className="w-7/12 bg-gray-100 flex flex-col border-l border-gray-200 overflow-hidden">
						{currentReceipt ? (
							currentIsMileage ? (
								<div className="flex flex-1 flex-col overflow-auto p-6">
									<div className="mx-auto flex w-full max-w-lg flex-col items-center rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
										<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
											<Car className="h-7 w-7 text-primary" />
										</div>
										<Badge variant="secondary" className="mb-2">
											Mileage
										</Badge>
										<h3 className="text-base font-semibold text-gray-900">
											{currentReceipt.vendorName || "Mileage"}
										</h3>
										<p className="mt-1 text-sm text-gray-500">
											{currentReceipt.dateOfPurchase
												? format(
														currentReceipt.dateOfPurchase,
														"MMM d, yyyy",
													)
												: "No date"}
										</p>
										<p className="mt-3 text-sm text-gray-600">
											{(currentReceipt.miles ?? 0).toLocaleString(undefined, {
												maximumFractionDigits: 2,
											})}{" "}
											mi × $
											{(
												currentReceipt.mileageRatePerMile ??
												MILEAGE_RATE_PER_MILE
											).toFixed(2)}
											/mi
										</p>
										<p className="mt-4 font-mono text-3xl font-bold tabular-nums text-gray-900">
											$
											{calculateReceiptTotal(currentReceipt).toFixed(2)}
										</p>
										<p className="mt-4 max-w-md text-sm leading-snug text-gray-700">
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
											<div className="mt-4 w-full max-w-md space-y-2 border-t border-gray-100 pt-4 text-left text-xs text-gray-600">
												<div>
													<span className="font-semibold text-gray-500">
														From
													</span>
													<p className="mt-0.5">
														{currentReceipt.mileageFrom?.trim() || "—"}
													</p>
												</div>
												<div>
													<span className="font-semibold text-gray-500">To</span>
													<p className="mt-0.5">
														{currentReceipt.mileageTo?.trim() || "—"}
													</p>
												</div>
												{currentReceipt.mileageStops &&
													currentReceipt.mileageStops.length > 0 && (
														<div>
															<span className="font-semibold text-gray-500">
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
										<div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col h-full">
											{/* Header */}
											<div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
												<div className="flex justify-between items-center">
													<div>
														<h3 className="text-base font-semibold text-gray-900">
															{currentReceipt.vendorName || "Unknown Vendor"}
														</h3>
														<p className="text-sm text-gray-500 mt-0.5">
															{currentReceipt.dateOfPurchase
																? format(
																		currentReceipt.dateOfPurchase,
																		"MMM d, yyyy",
																	)
																: "No date"}
														</p>
													</div>
													<Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-indigo-200">
														AI Extracted
													</Badge>
												</div>
											</div>

											{/* Line Items */}
											<div className="flex-1 overflow-auto">
												<table className="w-full">
													<thead className="sticky top-0 bg-slate-50 border-b border-gray-200 z-10">
														<tr>
															<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
																Description
															</th>
															<th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
																Category
															</th>
															<th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
																Qty
															</th>
															<th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider w-28">
																Amount
															</th>
														</tr>
													</thead>
													<tbody className="divide-y divide-gray-100">
														{currentReceipt.lineItems?.map(
															(item: any, i: number) => (
																<tr
																	key={i}
																	className="hover:bg-slate-50/50 transition-colors group"
																>
																	<td className="px-4 py-3">
																		<span
																			className="block text-sm font-medium text-gray-900 truncate max-w-[220px]"
																			title={item.description}
																		>
																			{item.description}
																		</span>
																	</td>
																	<td className="px-4 py-3">
																		<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
																			{item.category}
																		</span>
																	</td>
																	<td className="px-4 py-3 text-right text-sm text-gray-500 tabular-nums">
																		{item.quantity || 1}
																	</td>
																	<td className="px-4 py-3 text-right text-sm font-mono font-medium text-gray-900 tabular-nums">
																		${(item.amount || 0).toFixed(2)}
																	</td>
																</tr>
															),
														)}
														{(!currentReceipt.lineItems ||
															currentReceipt.lineItems.length === 0) && (
															<tr>
																<td
																	colSpan={4}
																	className="px-4 py-12 text-center text-gray-400"
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
											<div className="border-t border-gray-200 bg-slate-50/50">
												<div className="px-5 py-4 space-y-2">
													<div className="flex justify-between text-sm">
														<span className="text-gray-500">Subtotal</span>
														<span className="font-mono tabular-nums text-gray-700">
															${(currentReceipt.subtotal || 0).toFixed(2)}
														</span>
													</div>
													{currentReceipt.tax && currentReceipt.tax > 0 && (
														<div className="flex justify-between text-sm">
															<span className="text-gray-500">Tax</span>
															<span className="font-mono tabular-nums text-gray-700">
																${currentReceipt.tax.toFixed(2)}
															</span>
														</div>
													)}
													{currentReceipt.tip && currentReceipt.tip > 0 && (
														<div className="flex justify-between text-sm">
															<span className="text-gray-500">Tip</span>
															<span className="font-mono tabular-nums text-gray-700">
																${currentReceipt.tip.toFixed(2)}
															</span>
														</div>
													)}
													{currentReceipt.shipping &&
														currentReceipt.shipping > 0 && (
															<div className="flex justify-between text-sm">
																<span className="text-gray-500">Shipping</span>
																<span className="font-mono tabular-nums text-gray-700">
																	${currentReceipt.shipping.toFixed(2)}
																</span>
															</div>
														)}
													<div className="pt-3 mt-2 border-t border-gray-200">
														<div className="flex justify-between">
															<span className="text-sm font-semibold text-gray-900">
																Total
															</span>
															<span className="text-base font-bold font-mono tabular-nums text-gray-900">
																$
																{calculateReceiptTotal(currentReceipt).toFixed(
																	2,
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
				<Dialog
					open={isPaidModalOpen}
					onOpenChange={(open) => {
						if (!open) {
							setTimeout(resetPaidModal, 300);
						}
						setIsPaidModalOpen(open);
					}}
				>
					<DialogContent className={paymentReviewData ? "max-w-4xl" : ""}>
						<DialogHeader>
							<DialogTitle>
								{paymentReviewData
									? "Review Payment Details"
									: "Process Payment"}
							</DialogTitle>
						</DialogHeader>
						<div className="py-4">
							{paymentReviewData ? (
								<div className="flex gap-6">
									{/* Left: Inputs */}
									<div className="flex-1 space-y-4">
										<div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-3">
											<Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
											<div className="text-sm text-blue-800">
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

										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-2">
												<Label>Payment Date</Label>
												<Input
													type="date"
													value={paymentDate}
													onChange={(e) => setPaymentDate(e.target.value)}
												/>
											</div>
											<div className="space-y-2">
												<Label>Amount Paid</Label>
												<div className="relative">
													<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
														$
													</span>
													<Input
														type="number"
														step="0.01"
														value={paymentAmount}
														onChange={(e) => setPaymentAmount(e.target.value)}
														className="pl-7"
													/>
												</div>
											</div>
										</div>

										<div className="space-y-2">
											<Label>Confirmation Number</Label>
											<Input
												placeholder="Transaction ID"
												value={paidConfirmationNumber}
												onChange={(e) =>
													setPaidConfirmationNumber(e.target.value)
												}
											/>
										</div>

										<div className="space-y-2">
											<Label>Memo / Notes</Label>
											<Textarea
												placeholder="Any additional notes"
												value={paymentMemo}
												onChange={(e) => setPaymentMemo(e.target.value)}
												rows={2}
											/>
										</div>
									</div>

									{/* Right: Preview */}
									<div className="w-1/3 shrink-0">
										<p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
											Proof Preview
										</p>
										<div className="border rounded-lg overflow-hidden h-64 bg-muted flex items-center justify-center relative group">
											{uploadedProofUrl ? (
												<img
													src={uploadedProofUrl}
													className="w-full h-full object-contain"
													alt="Proof"
												/>
											) : (
												<FileText className="text-muted-foreground w-12 h-12" />
											)}
											{uploadedProofUrl && (
												<a
													href={uploadedProofUrl}
													target="_blank"
													rel="noreferrer"
													className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium"
												>
													View Full
												</a>
											)}
										</div>
									</div>
								</div>
							) : (
								<div className="py-6">
									<div
										className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
											paidProofFile
												? "border-blue-500 bg-blue-50"
												: "border-gray-300 hover:border-gray-400 bg-gray-50"
										}`}
									>
										<input
											type="file"
											id="payment-proof-upload"
											accept="image/*,application/pdf"
											onChange={(e) =>
												setPaidProofFile(
													e.target.files ? e.target.files[0] : null,
												)
											}
											className="hidden"
										/>

										<label
											htmlFor="payment-proof-upload"
											className="cursor-pointer space-y-3 block"
										>
											{paidProofFile ? (
												<>
													<CheckCircle className="w-12 h-12 text-blue-500 mx-auto" />
													<div>
														<p className="font-bold">{paidProofFile.name}</p>
														<p className="text-sm text-muted-foreground">
															Ready to process
														</p>
													</div>
													<Button
														size="sm"
														variant="outline"
														onClick={(e) => {
															e.preventDefault();
															setPaidProofFile(null);
														}}
													>
														Remove
													</Button>
												</>
											) : (
												<>
													<div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
														<UploadCloud className="w-6 h-6" />
													</div>
													<div>
														<p className="font-bold text-lg">
															Upload Proof of Payment
														</p>
														<p className="text-sm text-muted-foreground">
															Click to browse or paste screenshot (Ctrl+V)
														</p>
													</div>
													<Badge variant="secondary" className="mt-4">
														Use "Paste" for quick screenshots
													</Badge>
												</>
											)}
										</label>
									</div>

									{/* Info about AI */}
									<div className="mt-6 flex gap-3 p-3 bg-muted/50 rounded-lg border items-start">
										<Sparkles className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
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
						</div>
						<DialogFooter>
							<Button
								variant="outline"
								onClick={() => {
									setIsPaidModalOpen(false);
									setTimeout(resetPaidModal, 300);
								}}
							>
								Cancel
							</Button>
							<Button
								onClick={handlePaidSubmit}
								disabled={
									processingId === selectedReimbursement?._id || aiProcessing
								}
								className={aiProcessing ? "bg-purple-600" : ""}
							>
								{processingId === selectedReimbursement?._id || aiProcessing ? (
									<Loader2 className="h-4 w-4 animate-spin mr-1" />
								) : null}
								{paymentReviewData
									? "Confirm Payment"
									: aiEnabled
										? "Process & Analyze"
										: "Process & Continue"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
		);
	}

	// List View
	return (
		<div className="p-6 space-y-6 w-full">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">
					Manage Reimbursements
				</h1>
				<p className="text-muted-foreground">
					Review and process reimbursement requests.
				</p>
			</div>

			{/* Search & Filter */}
			<div className="flex flex-col sm:flex-row gap-4">
				<div className="relative flex-1 max-w-sm">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search title, business purpose, submitter name, Zelle info..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
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
								onClick={() => {
									const newFilter = new Set(statusFilter);
									if (newFilter.has(status)) {
										newFilter.delete(status);
									} else {
										newFilter.add(status);
									}
									setStatusFilter(newFilter);
									setPage(1);
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

			{/* Reimbursements Table */}
			{!reimbursements ? (
				<div className="space-y-3">
					{[1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-16 w-full rounded-xl" />
					))}
				</div>
			) : paginated.length > 0 ? (
				<div className="rounded-xl border bg-card overflow-hidden">
					<div className="overflow-x-auto">
						<Table>
							<TableHeader>
								<TableRow className="bg-muted/50 hover:bg-muted/50">
									<TableHead
										className="cursor-pointer hover:bg-muted transition-colors"
										onClick={() => handleSort("title")}
									>
										<span className="flex items-center gap-1 group">
											Title {getSortIcon("title")}
										</span>
									</TableHead>
									<TableHead
										className="cursor-pointer hover:bg-muted transition-colors"
										onClick={() => handleSort("totalAmount")}
									>
										<span className="flex items-center gap-1 group">
											Amount {getSortIcon("totalAmount")}
										</span>
									</TableHead>
									<TableHead
										className="cursor-pointer hover:bg-muted transition-colors"
										onClick={() => handleSort("_creationTime")}
									>
										<span className="flex items-center gap-1 group">
											Date {getSortIcon("_creationTime")}
										</span>
									</TableHead>
									<TableHead
										className="cursor-pointer hover:bg-muted transition-colors"
										onClick={() => handleSort("status")}
									>
										<span className="flex items-center gap-1 group">
											Status {getSortIcon("status")}
										</span>
									</TableHead>
									<TableHead
										className="cursor-pointer hover:bg-muted transition-colors"
										onClick={() => handleSort("department")}
									>
										<span className="flex items-center gap-1 group">
											Department {getSortIcon("department")}
										</span>
									</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{paginated.map((r) => {
									const isHovered = hoveredRow === r._id;
									const totalAmt = calculateTotalAmount(r);

									return (
										<TableRow
											key={r._id}
											className="group cursor-pointer"
											onMouseEnter={() => setHoveredRow(r._id)}
											onMouseLeave={() => setHoveredRow(null)}
											onClick={() => handleViewDetails(r)}
										>
											<TableCell className="min-w-[200px]">
												<div className="font-medium text-gray-900 truncate max-w-[250px]">
													{r.title}
												</div>
												<div className="text-xs text-muted-foreground">
													{r.submittedByName || r.submittedBy}
												</div>
												{r.submittedByZelle && (
													<div className="text-xs text-blue-600 mt-0.5">
														Zelle: {r.submittedByZelle}
													</div>
												)}
											</TableCell>
											<TableCell>
												<span className="font-mono font-semibold">
													${totalAmt.toFixed(2)}
												</span>
											</TableCell>
											<TableCell>
												<div className="text-sm">
													{format(r._creationTime, "MMM d, yyyy")}
												</div>
												<div className="text-xs text-muted-foreground">
													{format(r._creationTime, "h:mm a")}
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
												<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
													{r.department}
												</span>
											</TableCell>
											<TableCell className="text-right">
												<div
													className={`flex items-center justify-end gap-1 transition-opacity duration-200 ${
														isHovered ? "opacity-100" : "opacity-0"
													}`}
													onClick={(e) => e.stopPropagation()}
												>
													{r.status === "submitted" && (
														<>
															<Button
																variant="ghost"
																size="sm"
																className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
																onClick={() =>
																	handleStatusChange(r._id, "approved")
																}
																disabled={processingId === r._id}
																title="Approve"
															>
																{processingId === r._id ? (
																	<Loader2 className="h-4 w-4 animate-spin" />
																) : (
																	<CheckCircle className="h-4 w-4" />
																)}
															</Button>
															<Button
																variant="ghost"
																size="sm"
																className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
																onClick={() => handleDecline(r._id)}
																disabled={processingId === r._id}
																title="Decline"
															>
																<XCircle className="h-4 w-4" />
															</Button>
														</>
													)}
													{r.status === "approved" && (
														<Button
															variant="ghost"
															size="sm"
															className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
															onClick={() => handleViewDetails(r)}
															title="Mark as Paid"
														>
															<DollarSign className="h-4 w-4" />
														</Button>
													)}
													<Button
														variant="ghost"
														size="sm"
														className="h-8 w-8 p-0"
														onClick={() => handleViewDetails(r)}
														title="View Details"
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
			) : (
				<div className="text-center py-12 text-muted-foreground">
					<CreditCard className="mx-auto h-12 w-12 mb-4 opacity-50" />
					<p className="text-lg font-medium">No reimbursement requests</p>
					<p className="text-sm">
						{search || statusFilter.size > 0
							? "Try adjusting your filters."
							: "Reimbursement requests will appear here."}
					</p>
				</div>
			)}
		</div>
	);
}
