import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertTriangle,
	ArrowLeft,
	ArrowRight,
	Calendar,
	Camera,
	Car,
	CheckCircle,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	ExternalLink,
	Eye,
	FileText,
	Loader2,
	Plus,
	Receipt,
	Search,
	Trash2,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useConfirm } from "@/components/dashboard/ConfirmDialog";
import {
	DashboardPage,
	EmptyState,
	PageHeader,
} from "@/components/dashboard/DashboardPage";
import { SummaryStrip } from "@/components/dashboard/SummaryStrip";
import {
	MobileTaskStepper,
	NetworkErrorState,
	ResponsiveOverlay,
	useMobileShell,
} from "@/components/mobile";
import { AddressAutocompleteInput } from "@/components/reimbursement/AddressAutocompleteInput";
import ReceiptViewer from "@/components/reimbursement/ReceiptViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { useGoogleMapsPlacesLoader } from "@/hooks/useGoogleMapsPlacesLoader";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
	formatCurrencyUSD,
	formatDate,
	formatDateDisplay,
	formatDateTime,
	formatDateTimeDisplay,
	formatNumber,
	formatRelativeTime,
} from "@/lib/formatters";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";
import {
	computeMileageTotal,
	formatMileageRoute,
	MILEAGE_RATE_PER_MILE,
	metersToRoundedMiles,
} from "@/lib/reimbursement-mileage";
import { sendNotification } from "@/lib/send-notification";
import { cn } from "@/lib/utils";

function formatAuditAction(action: string): {
	label: string;
	description: string;
	color: string;
	iconName:
		| "FileText"
		| "CheckCircle"
		| "AlertTriangle"
		| "Calendar"
		| "Receipt";
} {
	const map: Record<
		string,
		{
			label: string;
			description: string;
			color: string;
			iconName:
				| "FileText"
				| "CheckCircle"
				| "AlertTriangle"
				| "Calendar"
				| "Receipt";
		}
	> = {
		submitted: {
			label: "Submitted",
			description: "Reimbursement request was submitted for review",
			color: "bg-ds-blue-700",
			iconName: "FileText",
		},
		status_changed_to_approved: {
			label: "Approved",
			description: "Request was reviewed and approved",
			color: "bg-ds-green-700",
			iconName: "CheckCircle",
		},
		status_changed_to_declined: {
			label: "Declined",
			description: "Request was reviewed and declined",
			color: "bg-ds-red-800",
			iconName: "AlertTriangle",
		},
		status_changed_to_paid: {
			label: "Marked as Paid",
			description: "Payment has been processed",
			color: "bg-ds-green-700",
			iconName: "Receipt",
		},
		payment_details_added: {
			label: "Payment Confirmed",
			description: "Payment confirmation details were recorded",
			color: "bg-ds-green-700",
			iconName: "Receipt",
		},
		status_changed_to_submitted: {
			label: "Re-submitted",
			description: "Request was re-submitted for review",
			color: "bg-ds-blue-700",
			iconName: "FileText",
		},
	};
	return (
		map[action] || {
			label: action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
			description: "",
			color: "bg-ds-gray-600",
			iconName: "Calendar",
		}
	);
}

const AUDIT_ICONS = {
	FileText,
	CheckCircle,
	AlertTriangle,
	Calendar,
	Receipt,
};

const searchSchema = z.object({
	view: z.enum(["list", "create", "detail"]).catch("list"),
	id: z.string().optional().catch(undefined),
	q: z.string().catch(""),
	status: z
		.enum(["all", "submitted", "approved", "paid", "declined"])
		.catch("all"),
});

type ReimbursementSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_dashboard/reimbursement")({
	validateSearch: searchSchema,
	loader: (ctx) =>
		prefetchAuthedQuery(api.reimbursements.listMine, undefined, ctx),
	component: ReimbursementPage,
});

const statusColors: Record<string, string> = {
	submitted: "bg-ds-blue-100 text-tone-info",
	approved: "bg-ds-green-100 text-tone-success",
	declined: "bg-ds-red-100 text-tone-danger",
	paid: "bg-ds-purple-100 text-tone-purple",
};

const STEPS = [
	{ id: 1, name: "AI Warning", description: "Before you start" },
	{ id: 2, name: "Basic Information", description: "Report Details" },
	{ id: 3, name: "Expenses", description: "Receipts & mileage" },
	{ id: 4, name: "Review", description: "Review Request" },
];

interface PaymentDetails {
	confirmationNumber: string;
	paymentDate: number;
	amountPaid: number;
	proofFileUrl?: string;
	memo?: string;
}

interface AuditLogEntry {
	action: string;
	timestamp: number;
	userId?: string;
	userName?: string;
	details?: string;
}

interface ReimbursementData {
	_id: string;
	_creationTime: number;
	title: string;
	totalAmount: number;
	status: string;
	department: string;
	paymentMethod: string;
	additionalInfo?: string;
	businessPurpose?: string;
	dateOfPurchase?: number;
	receipts: ReceiptEntry[];
	paymentDetails?: PaymentDetails;
	auditLog?: AuditLogEntry[];
}

interface LineItem {
	id: string;
	description: string;
	category: string;
	amount: number;
}

interface ReceiptEntry {
	id: string;
	vendorName: string;
	location: string;
	dateOfPurchase: number;
	receiptFile?: string;
	receiptFileType?: string;
	lineItems: LineItem[];
	notes?: string;
	subtotal: number;
	tax?: number;
	tip?: number;
	shipping?: number;
	total: number;
	expenseType?: "receipt" | "mileage";
	miles?: number;
	mileageRatePerMile?: number;
	mileageFrom?: string;
	mileageTo?: string;
	mileageStops?: string[];
}

interface ReceiptParseResult {
	success: boolean;
	message: string;
}

type MileageCalculationState = {
	receiptId: string | null;
	routeKey: string;
	status: "idle" | "waiting" | "calculating" | "calculated" | "error";
	message: string;
};

type RoutesLibraryLike = {
	Route?: {
		computeRoutes: (
			request: RoutesComputeRequestLike,
		) => Promise<RoutesComputeResponseLike>;
	};
};

type RoutesComputeRequestLike = {
	origin: string;
	destination: string;
	intermediates?: Array<{ location: string }>;
	travelMode: "DRIVING";
	optimizeWaypointOrder: boolean;
	fields: string[];
};

type RoutesComputeResponseLike = {
	routes?: RouteLike[];
};

type RouteLike = {
	distanceMeters?: number;
	legs?: Array<{ distanceMeters?: number }>;
};

function getRouteCalculationErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "object" && error !== null) {
		const candidate = error as {
			message?: unknown;
			code?: unknown;
			status?: unknown;
		};
		const details = [candidate.code, candidate.status, candidate.message]
			.filter((value) => typeof value === "string" && value.trim())
			.join(": ");
		if (details) return details;
	}

	return "Google route calculation is unavailable.";
}

const CATEGORIES = [
	"Food & Beverages",
	"Supplies",
	"Equipment",
	"Printing",
	"Transportation",
	"Venue",
	"Software",
	"Other",
];

// Accept HEIC/HEIF explicitly since some mobile browsers omit them from image/*
const RECEIPT_FILE_ACCEPT = "image/*,.heic,.heif,application/pdf";

export function isAiFeatureEnabled(aiFeaturesEnabled?: boolean) {
	return aiFeaturesEnabled !== false;
}

export function shouldAutoParseReceipt(aiEnabled: boolean) {
	return aiEnabled;
}

function emptyLineItem(): LineItem {
	return {
		id: crypto.randomUUID(),
		description: "",
		category: "Other",
		amount: 0,
	};
}

function emptyReceipt(): ReceiptEntry {
	return {
		id: crypto.randomUUID(),
		vendorName: "",
		location: "",
		dateOfPurchase: Date.now(),
		lineItems: [emptyLineItem()],
		notes: "",
		subtotal: 0,
		tax: 0,
		tip: 0,
		shipping: 0,
		total: 0,
		expenseType: "receipt",
	};
}

function recalcReceipt(r: ReceiptEntry): ReceiptEntry {
	if (r.expenseType === "mileage") {
		const miles = r.miles ?? 0;
		const total = computeMileageTotal(miles);
		const subtotal = total;
		const firstId = r.lineItems[0]?.id ?? crypto.randomUUID();
		return {
			...r,
			mileageRatePerMile: MILEAGE_RATE_PER_MILE,
			subtotal,
			total,
			tax: 0,
			tip: 0,
			shipping: 0,
			lineItems: [
				{
					id: firstId,
					description:
						miles > 0
							? `Mileage (${miles} mi × ${formatCurrencyUSD(MILEAGE_RATE_PER_MILE)}/mi)`
							: "Mileage",
					category: "Transportation",
					amount: total,
				},
			],
		};
	}
	const subtotal = r.lineItems.reduce((sum, li) => sum + (li.amount || 0), 0);
	const total = subtotal + (r.tax || 0) + (r.tip || 0) + (r.shipping || 0);
	return { ...r, subtotal, total };
}

async function calculateDrivingMiles({
	from,
	to,
	stops,
}: {
	from: string;
	to: string;
	stops: string[];
}): Promise<number> {
	const importLibrary = window.google?.maps?.importLibrary as
		| ((lib: string) => Promise<unknown>)
		| undefined;
	if (!importLibrary) {
		throw new Error("Google route calculation is unavailable.");
	}

	const { Route } = (await importLibrary("routes")) as RoutesLibraryLike;
	if (!Route?.computeRoutes) {
		throw new Error("Google route calculation is unavailable.");
	}

	const request: RoutesComputeRequestLike = {
		origin: from,
		destination: to,
		travelMode: "DRIVING",
		optimizeWaypointOrder: false,
		fields: ["distanceMeters", "legs"],
	};

	if (stops.length > 0) {
		request.intermediates = stops.map((location) => ({ location }));
	}

	const { routes } = await Route.computeRoutes(request);

	const route = routes?.[0];

	const meters =
		route?.distanceMeters ??
		route?.legs?.reduce((sum, leg) => sum + (leg.distanceMeters ?? 0), 0) ??
		0;

	if (meters <= 0) {
		throw new Error("No driving distance was returned for this route.");
	}

	return metersToRoundedMiles(meters);
}

// Step Progress Indicator Component
function StepIndicator({
	currentStep,
	maxVisitedStep,
	onStepClick,
}: {
	currentStep: number;
	maxVisitedStep: number;
	onStepClick: (step: number) => void;
}) {
	const current = STEPS.find((s) => s.id === currentStep);
	const isMobile = useIsMobile();

	if (isMobile) {
		return (
			<MobileTaskStepper
				currentStep={currentStep}
				totalSteps={STEPS.length}
				stepTitle={current?.name ?? `Step ${currentStep}`}
				maxVisitedStep={maxVisitedStep}
				onStepClick={onStepClick}
				className="mb-6"
			/>
		);
	}

	return (
		<div className="mb-8 flex justify-center px-2">
			<div className="w-full max-w-4xl overflow-x-auto scrollbar-quiet">
				<div className="mx-auto flex w-max max-w-full items-center justify-center">
					{STEPS.map((step, index) => {
						const isActive = step.id === currentStep;
						const isCompleted = step.id < currentStep;
						const isClickable = step.id <= maxVisitedStep;
						const isLast = index === STEPS.length - 1;

						return (
							<div key={step.id} className="flex shrink-0 items-center">
								<Button
									variant="ghost"
									onClick={() => isClickable && onStepClick(step.id)}
									disabled={!isClickable}
									className={cn(
										"flex items-center gap-2 group",
										isClickable ? "cursor-pointer" : "cursor-default",
									)}
								>
									<div
										className={cn(
											"w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
											isActive &&
												"bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2",
											isCompleted && "bg-primary text-primary-foreground",
											!isActive &&
												!isCompleted &&
												isClickable &&
												"bg-muted text-muted-foreground hover:bg-muted/80",
											!isActive &&
												!isCompleted &&
												!isClickable &&
												"bg-muted/50 text-muted-foreground/50",
										)}
									>
										{isCompleted ? (
											<CheckCircle className="w-4 h-4" />
										) : (
											step.id
										)}
									</div>
									<div className="hidden sm:block text-left">
										<p
											className={cn(
												"text-xs font-semibold transition-colors",
												isActive && "text-primary",
												isCompleted && "text-primary",
												!isActive &&
													!isCompleted &&
													isClickable &&
													"text-muted-foreground group-hover:text-foreground",
												!isActive &&
													!isCompleted &&
													!isClickable &&
													"text-muted-foreground/50",
											)}
										>
											{step.name}
										</p>
									</div>
								</Button>
								{!isLast && (
									<div
										aria-hidden="true"
										className={cn(
											"h-1 mx-2 sm:mx-3 transition-colors rounded-full w-8 sm:w-16",
											step.id < currentStep ? "bg-primary" : "bg-muted",
										)}
									/>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

// Navigation Buttons Component
function StepNavigation({
	currentStep,
	onBack,
	onNext,
	canGoNext,
	isSubmitting,
	nextLabel,
}: {
	currentStep: number;
	onBack: () => void;
	onNext: () => void;
	canGoNext: boolean;
	isSubmitting?: boolean;
	nextLabel?: string;
}) {
	const isFirstStep = currentStep === 1;
	const isLastStep = currentStep === STEPS.length;

	return (
		<div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-col gap-3 border-t bg-background/95 px-4 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-6 sm:backdrop-blur-none">
			<Button
				variant="outline"
				onClick={onBack}
				disabled={isFirstStep}
				className={cn(
					"h-11 w-full order-2 sm:order-1 sm:h-9 sm:w-auto",
					isFirstStep && "invisible",
				)}
			>
				<ChevronLeft className="w-4 h-4 mr-1" />
				Back
			</Button>
			<Button
				onClick={onNext}
				disabled={!canGoNext || isSubmitting}
				className="h-11 w-full min-w-[140px] order-1 sm:order-2 sm:h-9 sm:w-auto"
			>
				{isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
				{nextLabel || (isLastStep ? "Submit" : "Next")}
				{!isSubmitting && !isLastStep && (
					<ArrowRight className="w-4 h-4 ml-1" />
				)}
			</Button>
		</div>
	);
}

// Detail View Component
function ReimbursementDetailView({
	reimbursement,
	onBack,
	userName,
}: {
	reimbursement: ReimbursementData;
	onBack: () => void;
	userName?: string;
}) {
	const isMobile = useIsMobile();
	const [activeReceiptIndex, setActiveReceiptIndex] = useState(0);
	const [receiptOverlayOpen, setReceiptOverlayOpen] = useState(false);

	const receipts = reimbursement.receipts || [];
	const currentReceipt = receipts[activeReceiptIndex] || {};
	const hasReceipts = receipts.length > 0;
	const currentLineItems = currentReceipt.lineItems || [];

	const receiptFileUrl = currentReceipt.receiptFile;
	const currentIsMileage = currentReceipt.expenseType === "mileage";

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
						aria-label="Back to Reimbursements"
					>
						<ArrowLeft className="w-5 h-5" />
					</Button>
					<div className="min-w-0">
						<div className="flex items-center gap-3">
							<h2
								className="text-lg font-bold truncate"
								title={reimbursement.title}
							>
								{reimbursement.title}
							</h2>
							<Badge
								className={cn(
									"shrink-0",
									statusColors[reimbursement.status] || "",
								)}
								variant="secondary"
							>
								{reimbursement.status}
							</Badge>
						</div>
						<div className="flex flex-wrap items-center gap-x-2 mt-0.5 text-sm text-muted-foreground">
							{userName && (
								<>
									<span className="font-medium text-foreground">
										{userName}
									</span>
									<span aria-hidden="true" className="text-muted-foreground/40">
										·
									</span>
								</>
							)}
							<span className="capitalize">{reimbursement.department}</span>
							<span aria-hidden="true" className="text-muted-foreground/40">
								·
							</span>
							<span>{reimbursement.paymentMethod}</span>
							<span aria-hidden="true" className="text-muted-foreground/40">
								·
							</span>
							<span>{formatDateTimeDisplay(reimbursement._creationTime)}</span>
						</div>
					</div>
				</div>
				<div className="text-right shrink-0 ml-4">
					<p className="text-xs text-muted-foreground font-medium">
						Total Amount
					</p>
					<p className="text-xl font-bold tabular-nums">
						{formatCurrencyUSD(reimbursement.totalAmount ?? 0)}
					</p>
				</div>
			</div>

			{/* Content - Split Pane */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1 min-h-0 overflow-hidden">
				{/* Left Panel: Info (5/12) */}
				<div className="lg:col-span-5 border-r border-border overflow-y-auto">
					{/* Receipt Navigation */}
					{hasReceipts && (
						<div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/50">
							<span className="text-xs font-medium text-muted-foreground tabular-nums">
								Expense {activeReceiptIndex + 1} of {receipts.length}
							</span>
							<div className="flex gap-1">
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7"
									disabled={activeReceiptIndex === 0}
									onClick={() => setActiveReceiptIndex((prev) => prev - 1)}
									aria-label="Previous Expense"
								>
									<ChevronLeft className="w-4 h-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7"
									disabled={activeReceiptIndex === receipts.length - 1}
									onClick={() => setActiveReceiptIndex((prev) => prev + 1)}
									aria-label="Next Expense"
								>
									<ChevronRight className="w-4 h-4" />
								</Button>
							</div>
						</div>
					)}

					<div className="p-5 space-y-5">
						{/* Payment Details Section */}
						{reimbursement.status === "paid" &&
							reimbursement.paymentDetails && (
								<section className="bg-ds-green-100 border border-ds-green-100 rounded-md p-5 space-y-4">
									<div className="flex items-center gap-2 border-b border-ds-green-100 pb-2 mb-2">
										<CheckCircle className="w-5 h-5 text-tone-success" />
										<h3 className="text-sm font-medium text-tone-success">
											Payment Confirmation
										</h3>
									</div>
									<div className="grid grid-cols-2 gap-y-4 gap-x-4">
										<div>
											<p className="text-xs font-medium text-tone-success mb-1">
												Confirmation Number
											</p>
											<p className="text-sm font-mono font-medium bg-background/50 px-2 py-1 rounded border border-ds-green-100 inline-block break-all">
												{reimbursement.paymentDetails.confirmationNumber}
											</p>
										</div>
										<div>
											<p className="text-xs font-medium text-tone-success mb-1">
												Payment Date
											</p>
											<div className="flex items-center gap-1.5 text-sm">
												<Calendar className="w-4 h-4 text-tone-success" />
												<span>
													{formatDateDisplay(
														reimbursement.paymentDetails.paymentDate,
													)}
												</span>
											</div>
										</div>
										<div>
											<p className="text-xs font-medium text-tone-success mb-1">
												Amount Paid
											</p>
											<p className="text-lg font-bold tabular-nums">
												{formatCurrencyUSD(
													reimbursement.paymentDetails.amountPaid ?? 0,
												)}
											</p>
										</div>
										<div>
											<p className="text-xs font-medium text-tone-success mb-1">
												Payment Proof
											</p>
											{reimbursement.paymentDetails.proofFileUrl ? (
												<a
													href={reimbursement.paymentDetails.proofFileUrl}
													target="_blank"
													rel="noopener noreferrer"
													className="flex items-center gap-2 text-sm text-tone-info hover:text-tone-info hover:underline font-medium"
												>
													<FileText className="w-4 h-4" />
													View Proof
													<ExternalLink className="w-3 h-3" />
												</a>
											) : (
												<span className="text-sm text-muted-foreground italic">
													No proof attached
												</span>
											)}
										</div>
										{reimbursement.paymentDetails.memo && (
											<div className="col-span-2 mt-1">
												<p className="text-xs font-medium text-tone-success mb-1">
													Memo
												</p>
												<p className="text-sm bg-background/50 p-2 rounded border border-ds-green-100 break-words">
													{reimbursement.paymentDetails.memo}
												</p>
											</div>
										)}
									</div>
								</section>
							)}

						{/* Expense details */}
						<section className="space-y-3">
							<h3 className="text-xs font-medium border-b pb-2 text-muted-foreground">
								{currentIsMileage ? "Mileage Details" : "Receipt Details"}
							</h3>
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-0.5">
									<p className="text-xs font-medium text-muted-foreground">
										{currentIsMileage ? "Trip or purpose" : "Vendor"}
									</p>
									<p className="text-sm break-words">
										{currentReceipt.vendorName || "N/A"}
									</p>
								</div>
								<div className="space-y-0.5">
									<p className="text-xs font-medium text-muted-foreground">
										{currentIsMileage ? "Date of trip" : "Date of purchase"}
									</p>
									<p className="text-sm">
										{formatDateDisplay(currentReceipt.dateOfPurchase)}
									</p>
								</div>
								{currentIsMileage ? (
									<>
										<div className="space-y-0.5">
											<p className="text-xs font-medium text-muted-foreground">
												Miles
											</p>
											<p className="text-sm tabular-nums">
												{formatNumber(currentReceipt.miles ?? 0)} mi @{" "}
												{formatCurrencyUSD(MILEAGE_RATE_PER_MILE)}/mi
											</p>
										</div>
										<div className="space-y-0.5">
											<p className="text-xs font-medium text-muted-foreground">
												Rate
											</p>
											<p className="text-sm tabular-nums">
												{formatCurrencyUSD(
													currentReceipt.mileageRatePerMile ??
														MILEAGE_RATE_PER_MILE,
												)}
												/mi
											</p>
										</div>
										<div className="col-span-2 space-y-0.5">
											<p className="text-xs font-medium text-muted-foreground">
												From
											</p>
											<p className="text-sm break-words">
												{currentReceipt.mileageFrom?.trim() || "—"}
											</p>
										</div>
										<div className="col-span-2 space-y-0.5">
											<p className="text-xs font-medium text-muted-foreground">
												To
											</p>
											<p className="text-sm break-words">
												{currentReceipt.mileageTo?.trim() || "—"}
											</p>
										</div>
										{currentReceipt.mileageStops &&
										currentReceipt.mileageStops.length > 0 ? (
											<div className="col-span-2 space-y-0.5">
												<p className="text-xs font-medium text-muted-foreground">
													Stops
												</p>
												<ol className="list-decimal list-inside text-sm space-y-0.5 break-words">
													{currentReceipt.mileageStops.map(
														(s: string, idx: number) => (
															<li key={idx}>{s}</li>
														),
													)}
												</ol>
											</div>
										) : null}
										{!currentReceipt.mileageFrom?.trim() &&
											!currentReceipt.mileageTo?.trim() &&
											!(
												currentReceipt.mileageStops &&
												currentReceipt.mileageStops.length
											) &&
											currentReceipt.location?.trim() && (
												<div className="col-span-2 space-y-0.5">
													<p className="text-xs font-medium text-muted-foreground">
														Route
													</p>
													<p className="text-sm break-words">
														{currentReceipt.location}
													</p>
												</div>
											)}
									</>
								) : (
									<div className="col-span-2 space-y-0.5">
										<p className="text-xs font-medium text-muted-foreground">
											Location
										</p>
										<p className="text-sm break-words">
											{currentReceipt.location || "N/A"}
										</p>
									</div>
								)}
							</div>
						</section>

						{/* Report Details */}
						<section className="space-y-3">
							<h3 className="text-xs font-medium border-b pb-2 text-muted-foreground">
								Report Details
							</h3>
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-0.5">
									<p className="text-xs font-medium text-muted-foreground">
										Payment Method
									</p>
									<p className="text-sm">{reimbursement.paymentMethod}</p>
								</div>
								<div className="space-y-0.5">
									<p className="text-xs font-medium text-muted-foreground">
										Submitted On
									</p>
									<p className="text-sm">
										{formatDateTimeDisplay(reimbursement._creationTime)}
									</p>
								</div>
								{reimbursement.businessPurpose && (
									<div className="space-y-0.5 col-span-2">
										<p className="text-xs font-medium text-muted-foreground">
											Business Purpose
										</p>
										<p className="text-sm break-words">
											{reimbursement.businessPurpose}
										</p>
									</div>
								)}
								{reimbursement.additionalInfo && (
									<div className="space-y-0.5 col-span-2">
										<p className="text-xs font-medium text-muted-foreground">
											Additional Info
										</p>
										<p className="text-sm break-words">
											{reimbursement.additionalInfo}
										</p>
									</div>
								)}
							</div>
						</section>

						{/* Financials */}
						<section className="space-y-3">
							<h3 className="text-xs font-medium border-b pb-2 text-muted-foreground">
								Financials
							</h3>
							<div className="grid grid-cols-3 gap-3">
								<div className="space-y-0.5">
									<p className="text-xs font-medium text-muted-foreground">
										Subtotal
									</p>
									<p className="text-sm tabular-nums">
										{formatCurrencyUSD(currentReceipt.subtotal || 0)}
									</p>
								</div>
								<div className="space-y-0.5">
									<p className="text-xs font-medium text-muted-foreground">
										Tax
									</p>
									<p className="text-sm tabular-nums">
										{formatCurrencyUSD(currentReceipt.tax || 0)}
									</p>
								</div>
								<div className="space-y-0.5">
									<p className="text-xs font-medium text-muted-foreground">
										Tip
									</p>
									<p className="text-sm tabular-nums">
										{formatCurrencyUSD(currentReceipt.tip || 0)}
									</p>
								</div>
								<div className="space-y-0.5">
									<p className="text-xs font-medium text-muted-foreground">
										Shipping
									</p>
									<p className="text-sm tabular-nums">
										{formatCurrencyUSD(currentReceipt.shipping || 0)}
									</p>
								</div>
								<div className="space-y-0.5">
									<p className="text-xs font-medium text-tone-success">Total</p>
									<p className="text-base font-bold tabular-nums text-tone-success">
										{formatCurrencyUSD(currentReceipt.total || 0)}
									</p>
								</div>
							</div>
						</section>

						{/* Line Items */}
						<section className="space-y-3">
							<h3 className="text-xs font-medium border-b pb-2 text-muted-foreground flex justify-between items-center">
								<span>Line Items</span>
								<span className="text-[10px] font-normal text-muted-foreground/70 normal-case tabular-nums">
									{currentLineItems.length} items
								</span>
							</h3>
							{currentLineItems.length > 0 ? (
								<div className="border rounded-lg overflow-hidden">
									<table className="w-full text-sm">
										<thead className="bg-muted text-muted-foreground text-xs font-medium">
											<tr>
												<th className="px-3 py-2 text-left">Item</th>
												<th className="px-3 py-2 text-center">Qty</th>
												<th className="px-3 py-2 text-right">Price</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-border">
											{currentLineItems.map((item: LineItem, idx: number) => (
												<tr key={idx} className="bg-background">
													<td className="px-3 py-2">
														<div className="font-medium break-words">
															{item.description}
														</div>
														<div className="text-xs text-muted-foreground">
															{item.category}
														</div>
													</td>
													<td className="px-3 py-2 text-center text-muted-foreground tabular-nums">
														{1}
													</td>
													<td className="px-3 py-2 text-right font-medium tabular-nums">
														{formatCurrencyUSD(item.amount || 0)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							) : (
								<p className="text-sm text-muted-foreground italic">
									No line items detailed.
								</p>
							)}
						</section>

						{/* Audit Log */}
						{reimbursement.auditLog && reimbursement.auditLog.length > 0 && (
							<section className="space-y-4">
								<h3 className="text-xs font-medium border-b pb-2 text-muted-foreground">
									Audit History
								</h3>
								<div className="space-y-0 relative ml-3">
									{[...reimbursement.auditLog]
										.reverse()
										.map((entry, idx, arr) => {
											const info = formatAuditAction(entry.action);
											const Icon = AUDIT_ICONS[info.iconName];
											const isLast = idx === arr.length - 1;
											return (
												<div
													key={idx}
													className="relative flex gap-3 pb-5 last:pb-0"
												>
													{!isLast && (
														<div
															aria-hidden="true"
															className="absolute left-[11px] top-7 bottom-0 w-px bg-border"
														/>
													)}
													<div
														className={`relative z-10 flex-shrink-0 w-[23px] h-[23px] rounded-full ${info.color} flex items-center justify-center ring-4 ring-background`}
													>
														<Icon className="w-3 h-3 text-on-accent" />
													</div>
													<div className="flex-1 min-w-0 pt-0.5">
														<div className="flex items-baseline justify-between gap-2">
															<span className="text-sm font-semibold">
																{info.label}
															</span>
															<span className="text-[11px] text-muted-foreground whitespace-nowrap">
																{formatRelativeTime(entry.timestamp)}
															</span>
														</div>
														{info.description && (
															<p className="text-xs text-muted-foreground mt-0.5">
																{info.description}
															</p>
														)}
														<p className="text-[11px] text-muted-foreground/60 mt-1">
															{formatDateTime(entry.timestamp)}
															{entry.userName && (
																<span className="ml-1.5 inline-flex items-center bg-muted text-muted-foreground px-1.5 py-0.5 rounded text-[10px]">
																	{entry.userName}
																</span>
															)}
														</p>
														{entry.details && (
															<p className="text-xs text-muted-foreground mt-1 break-words">
																{entry.details}
															</p>
														)}
													</div>
												</div>
											);
										})}
								</div>
							</section>
						)}
					</div>
				</div>

				{/* Right Panel: receipt file or mileage summary */}
				<div className="lg:col-span-7 bg-muted min-h-[500px] lg:min-h-0 overflow-hidden flex flex-col p-4">
					{currentIsMileage ? (
						<div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-md border border-dashed border-border/80 bg-card p-8">
							<div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
								<Car className="h-7 w-7 text-primary" />
							</div>
							<p className="text-xs font-medium text-muted-foreground">
								Mileage Reimbursement
							</p>
							<p className="mt-2 max-w-md text-center text-sm leading-snug text-muted-foreground break-words">
								{formatMileageRoute(
									currentReceipt.mileageFrom,
									currentReceipt.mileageTo,
									currentReceipt.mileageStops,
								) ||
									currentReceipt.location?.trim() ||
									"No route entered"}
							</p>
							<p className="mt-3 text-center text-sm text-muted-foreground tabular-nums">
								{formatNumber(currentReceipt.miles ?? 0)} mi ×{" "}
								{formatCurrencyUSD(
									currentReceipt.mileageRatePerMile ?? MILEAGE_RATE_PER_MILE,
								)}
								/mi
							</p>
							<p className="mt-4 font-mono text-3xl font-bold tabular-nums text-foreground">
								{formatCurrencyUSD(currentReceipt.total ?? 0)}
							</p>
						</div>
					) : isMobile ? (
						<>
							<button
								type="button"
								onClick={() => setReceiptOverlayOpen(true)}
								className="motion-press flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border/80 bg-card p-8 text-center"
							>
								<div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
									<Receipt className="h-7 w-7 text-primary" />
								</div>
								<p className="text-sm font-semibold text-foreground">
									Receipt {activeReceiptIndex + 1}
								</p>
								<span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
									<Eye className="h-4 w-4" />
									View Receipt
								</span>
							</button>
							<ResponsiveOverlay
								open={receiptOverlayOpen}
								onOpenChange={setReceiptOverlayOpen}
								variant="fullscreen"
								title={`Receipt ${activeReceiptIndex + 1}`}
								footer={
									<Button
										className="h-11 w-full"
										onClick={() => setReceiptOverlayOpen(false)}
									>
										Close Receipt
									</Button>
								}
							>
								<ReceiptViewer
									receiptUrl={receiptFileUrl || ""}
									receiptName={`Receipt ${activeReceiptIndex + 1}`}
									className="h-full"
								/>
							</ResponsiveOverlay>
						</>
					) : (
						<ReceiptViewer
							receiptUrl={receiptFileUrl || ""}
							receiptName={`Receipt ${activeReceiptIndex + 1}`}
							className="h-full"
						/>
					)}
				</div>
			</div>
		</div>
	);
}

// Step 1: AI Warning
function AIWarningStep({
	onNext,
	aiEnabled,
}: {
	onNext: () => void;
	aiEnabled: boolean;
}) {
	return (
		<div className="flex flex-col items-center justify-center flex-1 p-6">
			<div className="bg-card border rounded-md p-8 text-center space-y-6 max-w-lg w-full">
				<div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
					<AlertTriangle className="w-10 h-10 text-primary" />
				</div>
				<div>
					<h2 className="text-2xl font-bold mb-2 text-balance">
						Before You Start
					</h2>
					<p className="text-muted-foreground leading-relaxed">
						{aiEnabled
							? "Our system uses AI to automatically parse details from your receipts. Please review all extracted information carefully before submitting."
							: "AI features are disabled for your account. Upload receipts and enter details manually before submitting."}
					</p>
				</div>
				<Button onClick={onNext} size="lg" className="w-full font-semibold">
					{aiEnabled ? "I Understand, Continue" : "Continue in Manual Mode"}
					<ArrowRight className="w-4 h-4 ml-2" />
				</Button>
			</div>
		</div>
	);
}

// Step 2: Basic Information
function BasicInfoStep({
	formData,
	setFormData,
	onBack,
	onNext,
}: {
	formData: {
		title: string;
		department: string;
		paymentMethod: string;
		additionalInfo: string;
		businessPurpose: string;
	};
	setFormData: React.Dispatch<
		React.SetStateAction<{
			title: string;
			department: string;
			paymentMethod: string;
			additionalInfo: string;
			businessPurpose: string;
		}>
	>;
	onBack: () => void;
	onNext: () => void;
}) {
	const formId = useId();
	const canProceed =
		formData.title && formData.department && formData.paymentMethod;

	return (
		<div className="flex flex-col items-center justify-center flex-1 p-6">
			<Card className="w-full max-w-2xl">
				<CardContent className="gap-8 p-8">
					<div className="border-b pb-4">
						<h2 className="text-xl font-bold text-balance">Report Details</h2>
						<p className="text-sm text-muted-foreground">
							Enter the high-level details for this reimbursement request.
						</p>
					</div>

					<div className="space-y-6 pt-4">
						<div className="space-y-2">
							<Label htmlFor={`${formId}-title`}>Report Title *</Label>
							<Input
								id={`${formId}-title`}
								name="title"
								autoComplete="off"
								placeholder="e.g. Flight to conference"
								value={formData.title}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, title: e.target.value }))
								}
							/>
						</div>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div className="space-y-2">
								<Label htmlFor={`${formId}-department`}>Department *</Label>
								<Select
									value={formData.department}
									onValueChange={(val) =>
										setFormData((prev) => ({ ...prev, department: val }))
									}
								>
									<SelectTrigger id={`${formId}-department`}>
										<SelectValue placeholder="Select Department" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="internal">Internal</SelectItem>
										<SelectItem value="external">External</SelectItem>
										<SelectItem value="projects">Projects</SelectItem>
										<SelectItem value="events">Events</SelectItem>
										<SelectItem value="other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor={`${formId}-paymentMethod`}>
									Payment Method *
								</Label>
								<Select
									value={formData.paymentMethod}
									onValueChange={(val) =>
										setFormData((prev) => ({ ...prev, paymentMethod: val }))
									}
								>
									<SelectTrigger id={`${formId}-paymentMethod`}>
										<SelectValue placeholder="Select Method" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="Zelle">Zelle</SelectItem>
										<SelectItem value="Venmo">Venmo</SelectItem>
										<SelectItem value="Check">Check</SelectItem>
										<SelectItem value="Cash">Cash</SelectItem>
										<SelectItem value="Other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="space-y-2">
							<Label htmlFor={`${formId}-businessPurpose`}>
								Business Purpose *
							</Label>
							<Textarea
								id={`${formId}-businessPurpose`}
								name="businessPurpose"
								autoComplete="off"
								placeholder="Explain the business reason…"
								value={formData.businessPurpose}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										businessPurpose: e.target.value,
									}))
								}
								rows={3}
							/>
						</div>
					</div>

					<StepNavigation
						currentStep={2}
						onBack={onBack}
						onNext={onNext}
						canGoNext={!!canProceed}
						nextLabel="Next: Expenses"
					/>
				</CardContent>
			</Card>
		</div>
	);
}

// Step 3: Receipts
function ReceiptsStep({
	receipts,
	setReceipts,
	generateUploadUrl,
	getStorageUrl,
	onBack,
	onNext,
	aiEnabled,
}: {
	receipts: ReceiptEntry[];
	setReceipts: React.Dispatch<React.SetStateAction<ReceiptEntry[]>>;
	generateUploadUrl: (args: Record<string, never>) => Promise<string>;
	getStorageUrl: (args: {
		storageId: Id<"_storage">;
	}) => Promise<string | null>;
	onBack: () => void;
	onNext: () => void;
	aiEnabled: boolean;
}) {
	const { getAuthHeaders } = useAuth();
	const isMobile = useIsMobile();
	const confirm = useConfirm();
	const [activeReceiptId, setActiveReceiptId] = useState<string | null>(
		receipts[0]?.id ?? null,
	);
	const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
	const [parsingReceipts, setParsingReceipts] = useState<Set<string>>(
		new Set(),
	);
	const [parseResults, setParseResults] = useState<
		Record<string, ReceiptParseResult>
	>({});
	const mileageRequestIdRef = useRef(0);
	const [mileageCalculation, setMileageCalculation] =
		useState<MileageCalculationState>({
			receiptId: null,
			routeKey: "",
			status: "idle",
			message: "",
		});
	const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as
		| string
		| undefined;
	const maps = useGoogleMapsPlacesLoader(googleMapsApiKey);

	useEffect(() => {
		if (receipts.length === 0) return;
		const hasActive =
			activeReceiptId && receipts.some((r) => r.id === activeReceiptId);
		if (!hasActive) {
			setActiveReceiptId(receipts[0].id);
		}
	}, [receipts, activeReceiptId]);

	const activeReceipt =
		receipts.find((r) => r.id === activeReceiptId) ?? receipts[0];
	const activeMileageReceiptId = activeReceipt?.id ?? null;
	const activeMileageExpenseType = activeReceipt?.expenseType;
	const activeMileageFrom = activeReceipt?.mileageFrom ?? "";
	const activeMileageTo = activeReceipt?.mileageTo ?? "";
	const activeMileageStopsKey = JSON.stringify(
		activeReceipt?.mileageStops ?? [],
	);

	const setReceiptMileageMiles = useCallback(
		(receiptId: string, miles: number) => {
			setReceipts((prev) =>
				prev.map((r) => {
					if (r.id !== receiptId || r.expenseType !== "mileage") return r;
					if ((r.miles ?? 0) === miles) return r;
					return recalcReceipt({ ...r, miles });
				}),
			);
		},
		[setReceipts],
	);

	useEffect(() => {
		if (!activeMileageReceiptId || activeMileageExpenseType !== "mileage") {
			setMileageCalculation({
				receiptId: null,
				routeKey: "",
				status: "idle",
				message: "",
			});
			return;
		}

		const from = activeMileageFrom.trim();
		const to = activeMileageTo.trim();
		const rawStops = JSON.parse(activeMileageStopsKey) as string[];
		const hasEmptyStops = rawStops.some((stop) => stop.trim().length === 0);
		const stops = rawStops.map((stop) => stop.trim()).filter(Boolean);
		const routeKey = [from, ...stops, to].join("\u001f");
		const requestId = mileageRequestIdRef.current + 1;
		mileageRequestIdRef.current = requestId;

		if (!from || !to) {
			setReceiptMileageMiles(activeMileageReceiptId, 0);
			setMileageCalculation({
				receiptId: activeMileageReceiptId,
				routeKey,
				status: "waiting",
				message: "Enter From and To addresses to calculate mileage.",
			});
			return;
		}

		if (hasEmptyStops) {
			setReceiptMileageMiles(activeMileageReceiptId, 0);
			setMileageCalculation({
				receiptId: activeMileageReceiptId,
				routeKey,
				status: "waiting",
				message: "Fill every stop address to calculate the full route.",
			});
			return;
		}

		if (!googleMapsApiKey?.trim()) {
			setReceiptMileageMiles(activeMileageReceiptId, 0);
			setMileageCalculation({
				receiptId: activeMileageReceiptId,
				routeKey,
				status: "error",
				message:
					"Automatic mileage calculation needs VITE_GOOGLE_MAPS_API_KEY.",
			});
			return;
		}

		if (maps.error) {
			setReceiptMileageMiles(activeMileageReceiptId, 0);
			setMileageCalculation({
				receiptId: activeMileageReceiptId,
				routeKey,
				status: "error",
				message: maps.error,
			});
			return;
		}

		if (maps.loading || !maps.ready) {
			setMileageCalculation({
				receiptId: activeMileageReceiptId,
				routeKey,
				status: "calculating",
				message: "Loading route calculation…",
			});
			return;
		}

		setMileageCalculation({
			receiptId: activeMileageReceiptId,
			routeKey,
			status: "calculating",
			message: "Calculating driving distance…",
		});

		const timeout = window.setTimeout(() => {
			calculateDrivingMiles({ from, to, stops })
				.then((miles) => {
					if (mileageRequestIdRef.current !== requestId) return;
					setReceiptMileageMiles(activeMileageReceiptId, miles);
					setMileageCalculation({
						receiptId: activeMileageReceiptId,
						routeKey,
						status: "calculated",
						message:
							stops.length > 0
								? "Calculated from From through every stop to To."
								: "Calculated from From to To.",
					});
				})
				.catch((error) => {
					if (mileageRequestIdRef.current !== requestId) return;
					setReceiptMileageMiles(activeMileageReceiptId, 0);
					setMileageCalculation({
						receiptId: activeMileageReceiptId,
						routeKey,
						status: "error",
						message: getRouteCalculationErrorMessage(error),
					});
				});
		}, 450);

		return () => window.clearTimeout(timeout);
	}, [
		activeMileageExpenseType,
		activeMileageFrom,
		activeMileageReceiptId,
		activeMileageStopsKey,
		activeMileageTo,
		maps.error,
		maps.loading,
		maps.ready,
		setReceiptMileageMiles,
	]);

	const updateReceipt = (id: string, updates: Partial<ReceiptEntry>) => {
		setReceipts((prev) =>
			prev.map((r) => {
				if (r.id !== id) return r;
				const updated = { ...r, ...updates };
				return recalcReceipt(updated);
			}),
		);
	};

	const updateMileageAddresses = (
		id: string,
		patch: Partial<
			Pick<ReceiptEntry, "mileageFrom" | "mileageTo" | "mileageStops">
		>,
	) => {
		setReceipts((prev) =>
			prev.map((r) => {
				if (r.id !== id) return r;
				const merged = { ...r, ...patch };
				const loc = formatMileageRoute(
					merged.mileageFrom,
					merged.mileageTo,
					merged.mileageStops ?? [],
				);
				return recalcReceipt({ ...merged, location: loc, miles: 0 });
			}),
		);
	};

	const moveMileageStop = (id: string, index: number, delta: -1 | 1) => {
		setReceipts((prev) =>
			prev.map((r) => {
				if (r.id !== id) return r;
				const stops = [...(r.mileageStops ?? [])];
				const j = index + delta;
				if (j < 0 || j >= stops.length) return r;
				[stops[index], stops[j]] = [stops[j], stops[index]];
				const loc = formatMileageRoute(r.mileageFrom, r.mileageTo, stops);
				return recalcReceipt({
					...r,
					mileageStops: stops,
					location: loc,
					miles: 0,
				});
			}),
		);
	};

	const addMileageStop = (id: string) => {
		setReceipts((prev) =>
			prev.map((r) => {
				if (r.id !== id) return r;
				const stops = [...(r.mileageStops ?? []), ""];
				const loc = formatMileageRoute(r.mileageFrom, r.mileageTo, stops);
				return recalcReceipt({
					...r,
					mileageStops: stops,
					location: loc,
					miles: 0,
				});
			}),
		);
	};

	const removeMileageStop = async (id: string, index: number) => {
		const stop = receipts.find((r) => r.id === id)?.mileageStops?.[index] ?? "";
		if (
			stop.trim() &&
			!(await confirm({
				title: `Remove Stop ${index + 1}?`,
				description: "The stop address will be removed from this route.",
				confirmLabel: "Remove Stop",
				destructive: true,
			}))
		)
			return;
		setReceipts((prev) =>
			prev.map((r) => {
				if (r.id !== id) return r;
				const stops = (r.mileageStops ?? []).filter((_, i) => i !== index);
				const loc = formatMileageRoute(r.mileageFrom, r.mileageTo, stops);
				return recalcReceipt({
					...r,
					mileageStops: stops,
					location: loc,
					miles: 0,
				});
			}),
		);
	};

	const updateLineItem = (
		receiptId: string,
		lineItemId: string,
		updates: Partial<LineItem>,
	) => {
		setReceipts((prev) =>
			prev.map((r) => {
				if (r.id !== receiptId) return r;
				const updated = {
					...r,
					lineItems: r.lineItems.map((li) =>
						li.id === lineItemId ? { ...li, ...updates } : li,
					),
				};
				return recalcReceipt(updated);
			}),
		);
	};

	const addLineItem = (receiptId: string) => {
		setReceipts((prev) =>
			prev.map((r) =>
				r.id === receiptId
					? { ...r, lineItems: [...r.lineItems, emptyLineItem()] }
					: r,
			),
		);
	};

	const removeLineItem = async (receiptId: string, lineItem: LineItem) => {
		if (
			(lineItem.description.trim() || lineItem.amount) &&
			!(await confirm({
				title: "Remove Line Item?",
				description: `“${lineItem.description.trim() || "Untitled item"}” will be removed from this receipt.`,
				confirmLabel: "Remove Line Item",
				destructive: true,
			}))
		)
			return;
		setReceipts((prev) =>
			prev.map((r) => {
				if (r.id !== receiptId) return r;
				const updated = {
					...r,
					lineItems: r.lineItems.filter((li) => li.id !== lineItem.id),
				};
				return recalcReceipt(updated);
			}),
		);
	};

	const setReceiptUploading = (receiptId: string, uploading: boolean) => {
		setUploadingFiles((prev) => {
			const next = new Set(prev);
			if (uploading) {
				next.add(receiptId);
			} else {
				next.delete(receiptId);
			}
			return next;
		});
	};

	const setReceiptParsing = (receiptId: string, parsing: boolean) => {
		setParsingReceipts((prev) => {
			const next = new Set(prev);
			if (parsing) {
				next.add(receiptId);
			} else {
				next.delete(receiptId);
			}
			return next;
		});
	};

	const parseReceipt = async (receiptId: string, receiptUrl: string) => {
		setReceiptParsing(receiptId, true);
		setParseResults((prev) => {
			const next = { ...prev };
			delete next[receiptId];
			return next;
		});

		try {
			const response = await fetch("/api/parse-receipt", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...getAuthHeaders() },
				body: JSON.stringify({ imageUrl: receiptUrl }),
			});
			const result = await response.json();
			if (!response.ok || !result.success || !result.data) {
				throw new Error(result.error || "Failed to parse receipt");
			}

			const parsed = result.data as {
				vendorName?: string;
				location?: string;
				dateOfPurchase?: string;
				lineItems?: Array<{
					description?: string;
					category?: string;
					amount?: number;
				}>;
				subtotal?: number;
				tax?: number;
				tip?: number;
				shipping?: number;
				total?: number;
			};

			const parsedDate = parsed.dateOfPurchase
				? new Date(parsed.dateOfPurchase)
				: null;
			const hasValidParsedDate =
				parsedDate && !Number.isNaN(parsedDate.getTime());

			const parsedLineItems = Array.isArray(parsed.lineItems)
				? parsed.lineItems.map((item, index) => ({
						id: crypto.randomUUID(),
						description: item.description || `Item ${index + 1}`,
						category: CATEGORIES.includes(item.category || "")
							? item.category!
							: "Other",
						amount: Number(item.amount) || 0,
					}))
				: [];

			const fallbackTotal = Number(parsed.total) || 0;
			const finalLineItems =
				parsedLineItems.length > 0
					? parsedLineItems
					: fallbackTotal > 0
						? [
								{
									id: crypto.randomUUID(),
									description: "Receipt Total",
									category: "Other",
									amount: fallbackTotal,
								},
							]
						: [];

			updateReceipt(receiptId, {
				vendorName: parsed.vendorName || "",
				location: parsed.location || "",
				dateOfPurchase: hasValidParsedDate ? parsedDate.getTime() : Date.now(),
				lineItems: finalLineItems,
				subtotal: Number(parsed.subtotal) || 0,
				tax: Number(parsed.tax) || 0,
				tip: Number(parsed.tip) || 0,
				shipping: Number(parsed.shipping) || 0,
				total: Number(parsed.total) || 0,
			});

			setParseResults((prev) => ({
				...prev,
				[receiptId]: {
					success: true,
					message: "Receipt parsed successfully. Please verify all fields.",
				},
			}));
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			setParseResults((prev) => ({
				...prev,
				[receiptId]: {
					success: false,
					message: `AI parsing failed: ${message}. Enter details manually or try again.`,
				},
			}));
		} finally {
			setReceiptParsing(receiptId, false);
		}
	};

	const handleFileUpload = async (receiptId: string, file: File) => {
		if (!file) {
			return;
		}
		const maxSize = 10 * 1024 * 1024;
		if (file.size > maxSize) {
			toast.error("File too large. Choose a file under 10\u00a0MB.");
			return;
		}

		setReceiptUploading(receiptId, true);
		setParseResults((prev) => {
			const next = { ...prev };
			delete next[receiptId];
			return next;
		});

		try {
			const uploadUrl = await generateUploadUrl({});

			const uploadResponse = await fetch(uploadUrl, {
				method: "POST",
				headers: { "Content-Type": file.type || "application/octet-stream" },
				body: file,
			});

			if (!uploadResponse.ok) {
				throw new Error("Failed to upload receipt file");
			}

			const uploadPayload = await uploadResponse.json();

			const fileUrl = await getStorageUrl({
				storageId: uploadPayload.storageId,
			});

			if (!fileUrl) {
				throw new Error("Failed to resolve receipt file URL");
			}

			updateReceipt(receiptId, {
				receiptFile: fileUrl,
				receiptFileType: file.type,
			});
			if (shouldAutoParseReceipt(aiEnabled)) {
				await parseReceipt(receiptId, fileUrl);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			setParseResults((prev) => ({
				...prev,
				[receiptId]: {
					success: false,
					message: `Upload failed: ${message}. Try again or choose a different file.`,
				},
			}));
		} finally {
			setReceiptUploading(receiptId, false);
		}
	};

	const handleExpenseTypeChange = (
		receiptId: string,
		next: "receipt" | "mileage",
	) => {
		setParseResults((prev) => {
			const n = { ...prev };
			delete n[receiptId];
			return n;
		});
		setReceipts((prev) =>
			prev.map((r) => {
				if (r.id !== receiptId) return r;
				if (next === "mileage") {
					return recalcReceipt({
						...r,
						expenseType: "mileage",
						receiptFile: undefined,
						receiptFileType: undefined,
						miles: r.miles ?? 0,
						mileageFrom: r.mileageFrom ?? "",
						mileageTo: r.mileageTo ?? "",
						mileageStops: r.mileageStops ?? [],
					});
				}
				return recalcReceipt({
					...r,
					expenseType: "receipt",
					miles: undefined,
					mileageRatePerMile: undefined,
					mileageFrom: undefined,
					mileageTo: undefined,
					mileageStops: undefined,
					lineItems: [emptyLineItem()],
					subtotal: 0,
					tax: 0,
					tip: 0,
					shipping: 0,
					total: 0,
				});
			}),
		);
	};

	const expenseRowValid = (r: ReceiptEntry) => {
		const nameOk = (r.vendorName ?? "").trim().length > 0;
		if (r.expenseType === "mileage") {
			return (r.miles ?? 0) > 0 && r.total > 0 && nameOk;
		}
		return !!r.receiptFile && r.total > 0 && nameOk;
	};

	const canProceed = receipts.length > 0 && receipts.every(expenseRowValid);

	const activeReceiptIndex = receipts.findIndex(
		(r) => r.id === activeReceipt?.id,
	);
	const isActiveUploading = activeReceipt
		? uploadingFiles.has(activeReceipt.id)
		: false;
	const isActiveParsing = activeReceipt
		? parsingReceipts.has(activeReceipt.id)
		: false;

	const addReceipt = () => {
		const nextReceipt = emptyReceipt();
		setReceipts((prev) => [...prev, nextReceipt]);
		setActiveReceiptId(nextReceipt.id);
	};

	const removeReceipt = async (receiptId: string, index: number) => {
		if (receipts.length <= 1) return;
		if (
			!(await confirm({
				title: `Remove Expense ${index + 1}?`,
				description:
					"This expense and its details will be removed from the request.",
				confirmLabel: "Remove Expense",
				destructive: true,
			}))
		)
			return;
		const indexToRemove = receipts.findIndex((r) => r.id === receiptId);
		const nextReceipts = receipts.filter((r) => r.id !== receiptId);
		setReceipts(nextReceipts);

		if (activeReceiptId === receiptId) {
			const fallbackIndex = Math.max(
				0,
				Math.min(indexToRemove, nextReceipts.length - 1),
			);
			setActiveReceiptId(nextReceipts[fallbackIndex]?.id ?? null);
		}
	};

	if (!activeReceipt) return null;

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h2 className="text-xl font-bold text-balance">Expenses</h2>
					<p className="text-xs text-muted-foreground">
						{aiEnabled
							? "Add receipt uploads or mileage; verify AI-filled details for receipts"
							: "Add receipt uploads or mileage routes"}
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={addReceipt}>
					<Plus className="w-4 h-4 mr-1" />
					Add Expense
				</Button>
			</div>

			<div className="mb-4 overflow-x-auto">
				<div className="flex gap-2 min-w-max">
					{receipts.map((receipt, index) => {
						const isActive = receipt.id === activeReceipt.id;
						return (
							<div key={receipt.id} className="relative">
								<Button
									variant="outline"
									type="button"
									onClick={() => setActiveReceiptId(receipt.id)}
									className={cn(
										"group rounded-lg border px-3 py-2 text-left transition-colors",
										isActive
											? "border-primary bg-primary/5"
											: "border-border bg-card hover:bg-muted/50",
									)}
								>
									<div className="flex items-center gap-2">
										{receipt.expenseType === "mileage" ? (
											<Car className="h-3.5 w-3.5 text-muted-foreground" />
										) : (
											<Receipt className="h-3.5 w-3.5 text-muted-foreground" />
										)}
										<span className="text-xs font-medium tabular-nums">
											Expense {index + 1}
										</span>
									</div>
									<div className="mt-1 text-[11px] text-muted-foreground max-w-44 truncate">
										{(receipt.vendorName ?? "").trim()
											? receipt.vendorName
											: receipt.expenseType === "mileage"
												? "Mileage"
												: "Awaiting Upload"}
									</div>
									<div className="mt-0.5 text-[11px] font-mono tabular-nums">
										{formatCurrencyUSD(receipt.total)}
									</div>
								</Button>
								{receipts.length > 1 && (
									<Button
										type="button"
										variant="ghost"
										size="icon"
										aria-label={`Remove Expense ${index + 1}`}
										onClick={() => void removeReceipt(receipt.id, index)}
										className="absolute right-1 top-1 h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
									>
										<Trash2 className="h-3.5 w-3.5" />
									</Button>
								)}
							</div>
						);
					})}
				</div>
			</div>

			<div className="rounded-md border bg-card flex-1 min-h-[560px] overflow-hidden flex flex-col">
				<div className="shrink-0 border-b px-4 py-3 bg-muted/10">
					<p className="text-xs font-medium text-muted-foreground mb-2">
						Expense Type
					</p>
					<div
						className="flex max-w-md w-full gap-0.5 rounded-lg border bg-background p-0.5"
						role="radiogroup"
						aria-label="Expense Type"
					>
						<Button
							variant={
								activeReceipt.expenseType !== "mileage" ? "default" : "ghost"
							}
							type="button"
							role="radio"
							aria-checked={activeReceipt.expenseType !== "mileage"}
							className={cn(
								"flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
								activeReceipt.expenseType !== "mileage"
									? "bg-primary text-primary-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
							onClick={() =>
								handleExpenseTypeChange(activeReceipt.id, "receipt")
							}
						>
							Receipt
						</Button>
						<Button
							variant={
								activeReceipt.expenseType === "mileage" ? "default" : "ghost"
							}
							type="button"
							role="radio"
							aria-checked={activeReceipt.expenseType === "mileage"}
							className={cn(
								"inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
								activeReceipt.expenseType === "mileage"
									? "bg-primary text-primary-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
							onClick={() =>
								handleExpenseTypeChange(activeReceipt.id, "mileage")
							}
						>
							<Car className="h-3.5 w-3.5" />
							Mileage
						</Button>
					</div>
				</div>
				<div className="min-h-0 flex-1 overflow-hidden">
					{activeReceipt.expenseType === "mileage" ? (
						<div className="grid h-full lg:grid-cols-2">
							<div className="max-h-[min(560px,70vh)] space-y-5 overflow-y-auto border-b bg-background p-5 lg:max-h-none lg:border-b-0 lg:border-r">
								<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
									<div className="space-y-2 md:col-span-2">
										<Label htmlFor={`mileage-purpose-${activeReceipt.id}`}>
											Trip or Purpose
										</Label>
										<Input
											id={`mileage-purpose-${activeReceipt.id}`}
											name="tripPurpose"
											autoComplete="off"
											placeholder="e.g. Supply run — campus to store"
											value={activeReceipt.vendorName}
											onChange={(e) =>
												updateReceipt(activeReceipt.id, {
													vendorName: e.target.value,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<p className="text-sm font-medium leading-none">
											Calculated Miles
										</p>
										<div
											className={cn(
												"flex h-9 items-center justify-between rounded-md border bg-muted/30 px-3 text-sm",
												mileageCalculation.status === "error" &&
													mileageCalculation.receiptId === activeReceipt.id &&
													"border-destructive/50 bg-destructive/5",
											)}
										>
											<span className="font-mono tabular-nums">
												{formatNumber(activeReceipt.miles ?? 0)} mi
											</span>
											{mileageCalculation.status === "calculating" &&
											mileageCalculation.receiptId === activeReceipt.id ? (
												<Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
											) : null}
										</div>
										<output
											aria-live="polite"
											className={cn(
												"block text-[11px] leading-snug text-muted-foreground",
												mileageCalculation.status === "error" &&
													mileageCalculation.receiptId === activeReceipt.id &&
													"text-destructive",
											)}
										>
											{mileageCalculation.receiptId === activeReceipt.id
												? mileageCalculation.message
												: "Mileage calculates automatically from the route."}
										</output>
									</div>
									<div className="space-y-2">
										<Label htmlFor={`mileage-date-${activeReceipt.id}`}>
											Date of Trip
										</Label>
										<Input
											id={`mileage-date-${activeReceipt.id}`}
											name="tripDate"
											type="date"
											value={
												activeReceipt.dateOfPurchase
													? new Date(activeReceipt.dateOfPurchase)
															.toISOString()
															.split("T")[0]
													: ""
											}
											onChange={(e) =>
												updateReceipt(activeReceipt.id, {
													dateOfPurchase: new Date(e.target.value).getTime(),
												})
											}
										/>
									</div>
									<div className="md:col-span-2 space-y-4">
										<AddressAutocompleteInput
											id={`mileage-from-${activeReceipt.id}`}
											name="mileageFrom"
											label="From (Address)"
											placeholder="Starting address — search or type one line…"
											value={activeReceipt.mileageFrom ?? ""}
											onChange={(v) =>
												updateMileageAddresses(activeReceipt.id, {
													mileageFrom: v,
												})
											}
										/>
										<AddressAutocompleteInput
											id={`mileage-to-${activeReceipt.id}`}
											name="mileageTo"
											label="To (Address)"
											placeholder="Destination address…"
											showFootnote={false}
											value={activeReceipt.mileageTo ?? ""}
											onChange={(v) =>
												updateMileageAddresses(activeReceipt.id, {
													mileageTo: v,
												})
											}
										/>
										<div className="space-y-3">
											<div className="flex flex-wrap items-end justify-between gap-2">
												<p className="text-xs font-medium">Stops (Optional)</p>
												<Button
													type="button"
													variant="outline"
													size="sm"
													className="h-8"
													onClick={() => addMileageStop(activeReceipt.id)}
												>
													<Plus className="mr-1 h-3.5 w-3.5" />
													Add Stop
												</Button>
											</div>
											<p className="text-[11px] text-muted-foreground -mt-1">
												Each stop is a full address between From and To. Reorder
												with the arrows.
											</p>
											{(activeReceipt.mileageStops ?? []).length === 0 ? (
												<p className="text-xs text-muted-foreground italic">
													No stops — route goes directly from From to To.
												</p>
											) : (
												<ul className="space-y-3">
													{(activeReceipt.mileageStops ?? []).map(
														(stop, stopIndex) => (
															<li
																key={`${activeReceipt.id}-stop-${stopIndex}`}
																className="flex gap-2 rounded-lg border bg-muted/20 p-3"
															>
																<div className="flex shrink-0 flex-col gap-0.5 pt-1">
																	<Button
																		type="button"
																		variant="ghost"
																		size="icon"
																		className="h-7 w-7"
																		disabled={stopIndex === 0}
																		aria-label={`Move Stop ${stopIndex + 1} Up`}
																		onClick={() =>
																			moveMileageStop(
																				activeReceipt.id,
																				stopIndex,
																				-1,
																			)
																		}
																	>
																		<ChevronUp className="h-4 w-4" />
																	</Button>
																	<Button
																		type="button"
																		variant="ghost"
																		size="icon"
																		className="h-7 w-7"
																		disabled={
																			stopIndex >=
																			(activeReceipt.mileageStops ?? [])
																				.length -
																				1
																		}
																		aria-label={`Move Stop ${stopIndex + 1} Down`}
																		onClick={() =>
																			moveMileageStop(
																				activeReceipt.id,
																				stopIndex,
																				1,
																			)
																		}
																	>
																		<ChevronDown className="h-4 w-4" />
																	</Button>
																</div>
																<div className="min-w-0 flex-1">
																	<AddressAutocompleteInput
																		id={`mileage-stop-${activeReceipt.id}-${stopIndex}`}
																		name={`mileageStop${stopIndex + 1}`}
																		label={`Stop ${stopIndex + 1} (Address)`}
																		placeholder="Stop address…"
																		showFootnote={false}
																		value={stop}
																		onChange={(v) => {
																			const stops = [
																				...(activeReceipt.mileageStops ?? []),
																			];
																			stops[stopIndex] = v;
																			updateMileageAddresses(activeReceipt.id, {
																				mileageStops: stops,
																			});
																		}}
																	/>
																</div>
																<Button
																	type="button"
																	variant="ghost"
																	size="icon"
																	className="mt-6 h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
																	aria-label={`Remove Stop ${stopIndex + 1}`}
																	onClick={() =>
																		void removeMileageStop(
																			activeReceipt.id,
																			stopIndex,
																		)
																	}
																>
																	<Trash2 className="h-4 w-4" />
																</Button>
															</li>
														),
													)}
												</ul>
											)}
										</div>
										<div className="rounded-md border border-dashed bg-muted/30 px-3 py-2">
											<p className="text-[11px] font-medium text-muted-foreground">
												Route Preview
											</p>
											<p className="text-sm font-medium text-foreground break-words">
												{formatMileageRoute(
													activeReceipt.mileageFrom,
													activeReceipt.mileageTo,
													activeReceipt.mileageStops,
												) || "—"}
											</p>
										</div>
									</div>
								</div>
								<div className="space-y-2 rounded-lg border bg-muted/30 p-4">
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Rate</span>
										<span className="font-mono tabular-nums">
											{formatCurrencyUSD(MILEAGE_RATE_PER_MILE)} / mile
										</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Miles</span>
										<span className="font-mono tabular-nums">
											{formatNumber(activeReceipt.miles ?? 0)}
										</span>
									</div>
									<Separator />
									<div className="flex items-baseline justify-between">
										<span className="font-semibold">Reimbursement</span>
										<span className="font-mono text-xl font-bold tabular-nums">
											{formatCurrencyUSD(activeReceipt.total)}
										</span>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor={`mileage-notes-${activeReceipt.id}`}>
										Notes
									</Label>
									<Textarea
										id={`mileage-notes-${activeReceipt.id}`}
										name="notes"
										autoComplete="off"
										placeholder="Any notes about this trip…"
										value={activeReceipt.notes}
										onChange={(e) =>
											updateReceipt(activeReceipt.id, { notes: e.target.value })
										}
										rows={2}
									/>
								</div>
							</div>
							<div className="flex min-h-[280px] items-center justify-center bg-muted/20 p-6 lg:min-h-0">
								<div className="w-full max-w-sm space-y-4 rounded-md border bg-card p-6">
									<p className="text-xs font-medium text-muted-foreground">
										Summary
									</p>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Rate</span>
										<span className="font-mono tabular-nums">
											{formatCurrencyUSD(MILEAGE_RATE_PER_MILE)}/mi
										</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-muted-foreground">Distance</span>
										<span className="font-mono tabular-nums">
											{formatNumber(activeReceipt.miles ?? 0)} mi
										</span>
									</div>
									<Separator />
									<div className="flex items-baseline justify-between pt-1">
										<span className="text-base font-semibold">Total</span>
										<span className="font-mono text-2xl font-bold tabular-nums">
											{formatCurrencyUSD(activeReceipt.total)}
										</span>
									</div>
								</div>
							</div>
						</div>
					) : activeReceipt.receiptFile ? (
						<div className="grid h-full lg:grid-cols-2">
							<div className="border-b lg:border-b-0 lg:border-r bg-background overflow-y-auto p-5 space-y-5">
								<div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20">
									<div className="min-w-0">
										<p className="text-sm font-semibold leading-none">
											Receipt File
										</p>
										<a
											className="text-xs text-primary underline-offset-2 hover:underline truncate block"
											href={activeReceipt.receiptFile}
											target="_blank"
											rel="noreferrer"
										>
											{activeReceipt.receiptFile
												? "Open File"
												: "No File Uploaded"}
										</a>
									</div>
									<div className="flex items-center gap-2">
										<label>
											<Input
												type="file"
												name="receiptFile"
												aria-label="Replace Receipt File"
												className="hidden"
												accept={RECEIPT_FILE_ACCEPT}
												onChange={(e) => {
													const file = e.target.files?.[0];
													if (file)
														void handleFileUpload(activeReceipt.id, file);
													e.target.value = "";
												}}
											/>
											<Button
												variant="outline"
												size="sm"
												asChild
												disabled={isActiveUploading || isActiveParsing}
											>
												<span>
													{activeReceipt.receiptFile
														? "Replace Receipt"
														: "Upload Receipt"}
												</span>
											</Button>
										</label>
										{isMobile && (
											<label>
												<Input
													type="file"
													name="receiptPhoto"
													aria-label="Take Receipt Photo"
													className="hidden"
													accept="image/*"
													capture="environment"
													onChange={(e) => {
														const file = e.target.files?.[0];
														if (file)
															void handleFileUpload(activeReceipt.id, file);
														e.target.value = "";
													}}
												/>
												<Button
													variant="outline"
													size="sm"
													asChild
													disabled={isActiveUploading || isActiveParsing}
												>
													<span>
														<Camera className="h-3.5 w-3.5 mr-1.5" />
														Camera
													</span>
												</Button>
											</label>
										)}
										{aiEnabled && activeReceipt.receiptFile && (
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													void parseReceipt(
														activeReceipt.id,
														activeReceipt.receiptFile!,
													)
												}
												disabled={isActiveParsing}
											>
												{isActiveParsing && (
													<Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
												)}
												Re-Parse
											</Button>
										)}
									</div>
								</div>

								{isActiveUploading && (
									<output
										aria-live="polite"
										className="text-xs text-muted-foreground flex items-center gap-2"
									>
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
										Uploading receipt…
									</output>
								)}

								{parseResults[activeReceipt.id] && (
									<output
										aria-live="polite"
										className={cn(
											"block text-xs",
											parseResults[activeReceipt.id].success
												? "text-tone-success"
												: "text-tone-warning",
										)}
									>
										{parseResults[activeReceipt.id].message}
									</output>
								)}

								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<div className="space-y-2">
										<Label htmlFor={`receipt-vendor-${activeReceipt.id}`}>
											Vendor Name
										</Label>
										<Input
											id={`receipt-vendor-${activeReceipt.id}`}
											name="vendorName"
											autoComplete="off"
											placeholder="e.g. Amazon"
											value={activeReceipt.vendorName}
											onChange={(e) =>
												updateReceipt(activeReceipt.id, {
													vendorName: e.target.value,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor={`receipt-location-${activeReceipt.id}`}>
											Location
										</Label>
										<Input
											id={`receipt-location-${activeReceipt.id}`}
											name="location"
											autoComplete="off"
											placeholder="e.g. Online"
											value={activeReceipt.location}
											onChange={(e) =>
												updateReceipt(activeReceipt.id, {
													location: e.target.value,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor={`receipt-date-${activeReceipt.id}`}>
											Date of Purchase
										</Label>
										<Input
											id={`receipt-date-${activeReceipt.id}`}
											name="dateOfPurchase"
											type="date"
											value={
												activeReceipt.dateOfPurchase
													? new Date(activeReceipt.dateOfPurchase)
															.toISOString()
															.split("T")[0]
													: ""
											}
											onChange={(e) =>
												updateReceipt(activeReceipt.id, {
													dateOfPurchase: new Date(e.target.value).getTime(),
												})
											}
										/>
									</div>
								</div>

								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<p className="text-sm font-medium leading-none">
											Line Items
										</p>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => addLineItem(activeReceipt.id)}
										>
											<Plus className="h-3 w-3 mr-1" />
											Add Line Item
										</Button>
									</div>
									<div className="rounded-lg border overflow-hidden">
										<div className="max-h-[280px] overflow-y-auto">
											<table className="w-full text-sm">
												<thead className="bg-muted/50 sticky top-0 z-10">
													<tr>
														<th className="px-3 py-2 text-left font-medium">
															Description
														</th>
														<th className="px-3 py-2 text-left font-medium w-40">
															Category
														</th>
														<th className="px-3 py-2 text-left font-medium w-28">
															Amount
														</th>
														<th className="px-3 py-2 w-10">
															<span className="sr-only">Actions</span>
														</th>
													</tr>
												</thead>
												<tbody>
													{activeReceipt.lineItems.map((li, liIndex) => (
														<tr key={li.id} className="border-t">
															<td className="px-2 py-2">
																<Input
																	name={`lineItem${liIndex + 1}Description`}
																	aria-label={`Line Item ${liIndex + 1} Description`}
																	autoComplete="off"
																	placeholder="Description…"
																	value={li.description}
																	onChange={(e) =>
																		updateLineItem(activeReceipt.id, li.id, {
																			description: e.target.value,
																		})
																	}
																/>
															</td>
															<td className="px-2 py-2">
																<Select
																	value={li.category}
																	onValueChange={(val) =>
																		updateLineItem(activeReceipt.id, li.id, {
																			category: val,
																		})
																	}
																>
																	<SelectTrigger
																		aria-label={`Line Item ${liIndex + 1} Category`}
																	>
																		<SelectValue />
																	</SelectTrigger>
																	<SelectContent>
																		{CATEGORIES.map((cat) => (
																			<SelectItem key={cat} value={cat}>
																				{cat}
																			</SelectItem>
																		))}
																	</SelectContent>
																</Select>
															</td>
															<td className="px-2 py-2">
																<div className="relative">
																	<span
																		aria-hidden="true"
																		className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
																	>
																		$
																	</span>
																	<Input
																		type="number"
																		inputMode="decimal"
																		name={`lineItem${liIndex + 1}Amount`}
																		aria-label={`Line Item ${liIndex + 1} Amount`}
																		autoComplete="off"
																		step="0.01"
																		min="0"
																		className="pl-7 tabular-nums"
																		value={li.amount || ""}
																		onChange={(e) =>
																			updateLineItem(activeReceipt.id, li.id, {
																				amount: parseFloat(e.target.value) || 0,
																			})
																		}
																	/>
																</div>
															</td>
															<td className="px-2 py-2">
																{activeReceipt.lineItems.length > 1 && (
																	<Button
																		variant="ghost"
																		size="icon"
																		aria-label={`Remove Line Item ${liIndex + 1}`}
																		onClick={() =>
																			void removeLineItem(activeReceipt.id, li)
																		}
																	>
																		<Trash2 className="h-3.5 w-3.5" />
																	</Button>
																)}
															</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</div>
								</div>

								<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
									<div className="space-y-2">
										<Label htmlFor={`receipt-tax-${activeReceipt.id}`}>
											Tax
										</Label>
										<div className="relative">
											<span
												aria-hidden="true"
												className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
											>
												$
											</span>
											<Input
												id={`receipt-tax-${activeReceipt.id}`}
												name="tax"
												type="number"
												inputMode="decimal"
												autoComplete="off"
												step="0.01"
												min="0"
												className="pl-7 tabular-nums"
												value={activeReceipt.tax || ""}
												onChange={(e) =>
													updateReceipt(activeReceipt.id, {
														tax: parseFloat(e.target.value) || 0,
													})
												}
											/>
										</div>
									</div>
									<div className="space-y-2">
										<Label htmlFor={`receipt-tip-${activeReceipt.id}`}>
											Tip
										</Label>
										<div className="relative">
											<span
												aria-hidden="true"
												className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
											>
												$
											</span>
											<Input
												id={`receipt-tip-${activeReceipt.id}`}
												name="tip"
												type="number"
												inputMode="decimal"
												autoComplete="off"
												step="0.01"
												min="0"
												className="pl-7 tabular-nums"
												value={activeReceipt.tip || ""}
												onChange={(e) =>
													updateReceipt(activeReceipt.id, {
														tip: parseFloat(e.target.value) || 0,
													})
												}
											/>
										</div>
									</div>
									<div className="space-y-2">
										<Label htmlFor={`receipt-shipping-${activeReceipt.id}`}>
											Shipping
										</Label>
										<div className="relative">
											<span
												aria-hidden="true"
												className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm"
											>
												$
											</span>
											<Input
												id={`receipt-shipping-${activeReceipt.id}`}
												name="shipping"
												type="number"
												inputMode="decimal"
												autoComplete="off"
												step="0.01"
												min="0"
												className="pl-7 tabular-nums"
												value={activeReceipt.shipping || ""}
												onChange={(e) =>
													updateReceipt(activeReceipt.id, {
														shipping: parseFloat(e.target.value) || 0,
													})
												}
											/>
										</div>
									</div>
									<div className="space-y-2">
										<p className="text-sm font-medium leading-none">Subtotal</p>
										<div className="flex items-center h-9 px-3 rounded-md border bg-muted/50 font-mono text-sm tabular-nums">
											{formatCurrencyUSD(activeReceipt.subtotal)}
										</div>
									</div>
								</div>

								<div className="flex justify-end">
									<div className="text-right">
										<p className="text-sm text-muted-foreground">
											Receipt Total
										</p>
										<p className="text-xl font-bold font-mono tabular-nums">
											{formatCurrencyUSD(activeReceipt.total)}
										</p>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor={`receipt-notes-${activeReceipt.id}`}>
										Notes
									</Label>
									<Textarea
										id={`receipt-notes-${activeReceipt.id}`}
										name="notes"
										autoComplete="off"
										placeholder="Any notes about this receipt…"
										value={activeReceipt.notes}
										onChange={(e) =>
											updateReceipt(activeReceipt.id, { notes: e.target.value })
										}
										rows={2}
									/>
								</div>
							</div>

							<div className="bg-muted/20 h-full min-h-[320px] p-4 flex items-center justify-center">
								{activeReceipt.receiptFile ? (
									activeReceipt.receiptFileType === "application/pdf" ||
									activeReceipt.receiptFile.toLowerCase().endsWith(".pdf") ||
									activeReceipt.receiptFile.toLowerCase().includes(".pdf?") ? (
										<iframe
											src={activeReceipt.receiptFile}
											className="w-full h-full rounded-lg border bg-background"
											title={`Receipt ${activeReceiptIndex + 1}`}
										/>
									) : (
										<img
											src={activeReceipt.receiptFile}
											alt={`Receipt ${activeReceiptIndex + 1}`}
											width={600}
											height={800}
											className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg border bg-black/5"
											onError={(e) => {
												// If image fails to load, it might be a PDF — try rendering as iframe
												const parent = e.currentTarget.parentElement;
												if (parent && activeReceipt.receiptFile) {
													e.currentTarget.style.display = "none";
													const iframe = document.createElement("iframe");
													iframe.src = activeReceipt.receiptFile;
													iframe.className =
														"w-full h-full rounded-lg border bg-background";
													iframe.title = `Receipt ${activeReceiptIndex + 1}`;
													iframe.style.minHeight = "320px";
													parent.appendChild(iframe);
												}
											}}
										/>
									)
								) : (
									<div className="text-center text-muted-foreground">
										<Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
										<p className="text-sm">No receipt uploaded.</p>
									</div>
								)}
							</div>
						</div>
					) : (
						<div className="h-full flex items-center justify-center p-8">
							<div className="w-full max-w-md rounded-md border-2 border-dashed bg-muted/20 p-8 text-center">
								<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
									<Upload className="h-6 w-6 text-primary" />
								</div>
								<h3 className="text-base font-semibold text-balance">
									Upload Receipt Before Entering Details
								</h3>
								<p className="mt-2 text-sm text-muted-foreground">
									Fields will appear after upload. Supports PDF, PNG, JPG, JPEG,
									WEBP, HEIC.
								</p>
								<div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row">
									<label className="w-full sm:w-auto">
										<Input
											type="file"
											name="receiptFile"
											aria-label="Select Receipt File"
											className="hidden"
											accept={RECEIPT_FILE_ACCEPT}
											onChange={(e) => {
												const file = e.target.files?.[0];
												if (file) void handleFileUpload(activeReceipt.id, file);
												e.target.value = "";
											}}
										/>
										<Button asChild className="w-full sm:w-auto">
											<span>Select File</span>
										</Button>
									</label>
									{isMobile && (
										<label className="w-full sm:w-auto">
											<Input
												type="file"
												name="receiptPhoto"
												aria-label="Take Receipt Photo"
												className="hidden"
												accept="image/*"
												capture="environment"
												onChange={(e) => {
													const file = e.target.files?.[0];
													if (file)
														void handleFileUpload(activeReceipt.id, file);
													e.target.value = "";
												}}
											/>
											<Button
												variant="outline"
												asChild
												className="w-full sm:w-auto"
											>
												<span>
													<Camera className="h-4 w-4 mr-2" />
													Take Photo
												</span>
											</Button>
										</label>
									)}
								</div>
								{(isActiveUploading || isActiveParsing) && (
									<output
										aria-live="polite"
										className="mt-4 text-xs text-muted-foreground flex items-center justify-center gap-2"
									>
										<Loader2 className="h-3.5 w-3.5 animate-spin" />
										{isActiveUploading
											? "Uploading receipt…"
											: aiEnabled
												? "AI is parsing receipt…"
												: "Ready for manual entry."}
									</output>
								)}
								{parseResults[activeReceipt.id] && (
									<output
										aria-live="polite"
										className={cn(
											"block mt-3 text-xs",
											parseResults[activeReceipt.id].success
												? "text-tone-success"
												: "text-tone-warning",
										)}
									>
										{parseResults[activeReceipt.id].message}
									</output>
								)}
							</div>
						</div>
					)}
				</div>
			</div>

			<StepNavigation
				currentStep={3}
				onBack={onBack}
				onNext={onNext}
				canGoNext={canProceed}
				nextLabel="Review & Submit"
			/>
		</div>
	);
}

// Step 4: Review
function ReviewStep({
	formData,
	receipts,
	totalAmount,
	onBack,
	onSubmit,
	isSubmitting,
}: {
	formData: {
		title: string;
		department: string;
		paymentMethod: string;
		additionalInfo: string;
		businessPurpose: string;
	};
	receipts: ReceiptEntry[];
	totalAmount: number;
	onBack: () => void;
	onSubmit: () => void;
	isSubmitting: boolean;
}) {
	const departmentLabels: Record<string, string> = {
		internal: "Internal",
		external: "External",
		projects: "Projects",
		events: "Events",
		other: "Other",
	};

	return (
		<div className="flex flex-col h-full pb-20">
			<div className="mb-6 shrink-0">
				<h2 className="text-2xl font-bold text-balance">Review Request</h2>
				<p className="text-muted-foreground">
					Please review all line items and details before submitting.
				</p>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				{/* Summary Card */}
				<div className="lg:col-span-1 space-y-6">
					<Card>
						<CardContent className="p-6 space-y-6">
							<div>
								<h3 className="text-sm font-medium mb-4">Report Summary</h3>
								<div className="space-y-4">
									<div>
										<p className="text-xs text-muted-foreground mb-1">Title</p>
										<p className="font-medium break-words">{formData.title}</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground mb-1">
											Department
										</p>
										<p className="font-medium">
											{departmentLabels[formData.department] ||
												formData.department}
										</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground mb-1">
											Payment Method
										</p>
										<p className="font-medium">{formData.paymentMethod}</p>
									</div>
									{formData.additionalInfo && (
										<div>
											<p className="text-xs text-muted-foreground mb-1">
												Payment Details
											</p>
											<p className="font-medium break-words">
												{formData.additionalInfo}
											</p>
										</div>
									)}
									<Separator />
									<div className="flex justify-between items-center">
										<span className="font-bold">Total Amount</span>
										<span className="font-bold text-xl text-tone-success tabular-nums">
											{formatCurrencyUSD(totalAmount)}
										</span>
									</div>
								</div>
							</div>
						</CardContent>
					</Card>
					<div className="flex flex-col gap-3">
						<Button
							onClick={onSubmit}
							disabled={isSubmitting}
							size="lg"
							className="w-full font-bold"
						>
							{isSubmitting && (
								<Loader2 className="w-4 h-4 animate-spin mr-2" />
							)}
							{!isSubmitting && <CheckCircle className="w-5 h-5 mr-2" />}
							Submit Request
						</Button>
						<Button variant="outline" onClick={onBack}>
							Back to Edit
						</Button>
					</div>
				</div>

				{/* Detailed Breakdown */}
				<div className="lg:col-span-2 space-y-6">
					{receipts.map((r, i) => (
						<Card key={r.id}>
							<CardContent className="p-0">
								<div className="px-6 py-4 bg-muted border-b flex justify-between items-center">
									<div className="flex min-w-0 items-center gap-3">
										<div className="w-8 h-8 shrink-0 rounded-full bg-background border flex items-center justify-center font-bold text-muted-foreground text-sm tabular-nums">
											{i + 1}
										</div>
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<h4 className="font-bold break-words">
													{r.vendorName ||
														(r.expenseType === "mileage"
															? "Mileage"
															: "Unnamed Receipt")}
												</h4>
												{r.expenseType === "mileage" && (
													<Badge
														variant="secondary"
														className="text-[10px] font-normal"
													>
														Mileage
													</Badge>
												)}
											</div>
											<p className="text-xs text-muted-foreground break-words">
												{r.expenseType === "mileage" ? (
													<>
														{formatNumber(r.miles ?? 0)} mi ×{" "}
														{formatCurrencyUSD(MILEAGE_RATE_PER_MILE)}/mi •{" "}
														{formatDateDisplay(r.dateOfPurchase)}
														{formatMileageRoute(
															r.mileageFrom,
															r.mileageTo,
															r.mileageStops,
														) ? (
															<>
																{" "}
																•{" "}
																{formatMileageRoute(
																	r.mileageFrom,
																	r.mileageTo,
																	r.mileageStops,
																)}
															</>
														) : r.location?.trim() ? (
															<> • {r.location}</>
														) : null}
													</>
												) : (
													<>
														{formatDateDisplay(r.dateOfPurchase)} •{" "}
														{r.location || "No location"}
													</>
												)}
											</p>
										</div>
									</div>
									<span className="shrink-0 font-bold tabular-nums">
										{formatCurrencyUSD(r.total)}
									</span>
								</div>
								<div className="p-6">
									<div className="border rounded-lg overflow-hidden">
										<table className="w-full text-sm text-left">
											<thead className="bg-muted text-muted-foreground text-xs font-medium">
												<tr>
													<th className="px-4 py-2">Line Item</th>
													<th className="px-4 py-2 text-center">Category</th>
													<th className="px-4 py-2 text-center">Qty</th>
													<th className="px-4 py-2 text-right">Unit Price</th>
													<th className="px-4 py-2 text-right">Line Total</th>
												</tr>
											</thead>
											<tbody className="divide-y">
												{r.lineItems.map((item, idx) => {
													const lineTotal = (item.amount || 0) * 1;
													return (
														<tr key={idx} className="bg-background">
															<td className="px-4 py-2 font-medium break-words">
																{item.description || "—"}
															</td>
															<td className="px-4 py-2 text-center text-muted-foreground text-xs">
																{item.category}
															</td>
															<td className="px-4 py-2 text-center text-muted-foreground tabular-nums">
																1
															</td>
															<td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
																{formatCurrencyUSD(item.amount)}
															</td>
															<td className="px-4 py-2 text-right font-medium tabular-nums">
																{formatCurrencyUSD(lineTotal)}
															</td>
														</tr>
													);
												})}
												{/* Summary Rows */}
												{((r.tax || 0) > 0 ||
													(r.tip || 0) > 0 ||
													(r.shipping || 0) > 0) && (
													<tr className="bg-muted/50 text-xs text-muted-foreground">
														<td
															colSpan={4}
															className="px-4 py-2 text-right font-medium"
														>
															Additional (Tax/Tip/Ship)
														</td>
														<td className="px-4 py-2 text-right font-medium tabular-nums">
															{formatCurrencyUSD(
																(r.tax || 0) + (r.tip || 0) + (r.shipping || 0),
															)}
														</td>
													</tr>
												)}
											</tbody>
										</table>
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		</div>
	);
}

const REIMBURSEMENT_DRAFT_KEY = "reimbursement-draft-v1";

type ReimbursementDraftFormData = {
	title: string;
	department: string;
	paymentMethod: string;
	additionalInfo: string;
	businessPurpose: string;
};

type ReimbursementDraft = {
	formData: ReimbursementDraftFormData;
	receipts: ReceiptEntry[];
	step: number;
	maxVisitedStep: number;
	savedAt: number;
};

// Draft is JSON-only (no File objects). Uploaded receipts keep their storage URL;
// local Files that were never uploaded cannot be restored from sessionStorage.
function loadReimbursementDraft(): ReimbursementDraft | null {
	try {
		const raw = sessionStorage.getItem(REIMBURSEMENT_DRAFT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as ReimbursementDraft;
		if (!parsed || typeof parsed !== "object" || !parsed.formData) return null;
		return parsed;
	} catch {
		return null;
	}
}

function saveReimbursementDraft(draft: Omit<ReimbursementDraft, "savedAt">) {
	try {
		sessionStorage.setItem(
			REIMBURSEMENT_DRAFT_KEY,
			JSON.stringify({ ...draft, savedAt: Date.now() }),
		);
	} catch {
		// Storage unavailable (private browsing, quota, etc.) — draft persistence is best-effort.
	}
}

function clearReimbursementDraft() {
	try {
		sessionStorage.removeItem(REIMBURSEMENT_DRAFT_KEY);
	} catch {
		// ignore
	}
}

function hasMeaningfulDraftContent(draft: ReimbursementDraft): boolean {
	const { formData, receipts } = draft;
	if (
		formData.title.trim() ||
		formData.department ||
		formData.paymentMethod ||
		formData.additionalInfo.trim() ||
		formData.businessPurpose.trim()
	) {
		return true;
	}
	return receipts.some(
		(r) =>
			r.vendorName.trim() ||
			r.receiptFile ||
			r.total > 0 ||
			(r.mileageFrom ?? "").trim() ||
			(r.mileageTo ?? "").trim(),
	);
}

function ReimbursementPage() {
	const { logtoId, user, getAuthHeaders } = useAuth();
	const { setHideTabBar } = useMobileShell();
	const isMobile = useIsMobile();
	const isOnline = useOnlineStatus();
	const aiEnabled = isAiFeatureEnabled(user?.aiFeaturesEnabled);
	const reimbursements = useAuthedQuery(
		api.reimbursements.listMine,
		logtoId ? { logtoId } : "skip",
	);
	const createReimbursement = useAuthedMutation(api.reimbursements.create);
	const generateUploadUrl = useAuthedMutation(
		api.reimbursements.generateUploadUrl,
	);
	const getStorageUrl = useAuthedMutation(api.reimbursements.getStorageUrl);

	const {
		view,
		id: selectedReimbursementId,
		q: searchTerm,
		status: statusFilter,
	} = Route.useSearch();
	const navigate = Route.useNavigate();
	const setSearch = useCallback(
		(
			patch: Partial<ReimbursementSearch>,
			options?: { ignoreBlocker?: boolean },
		) =>
			navigate({
				search: (prev) => ({ ...prev, ...patch }),
				replace: true,
				...options,
			}),
		[navigate],
	);
	const setView = useCallback(
		(
			next: ReimbursementSearch["view"],
			options?: { ignoreBlocker?: boolean },
		) =>
			setSearch(
				next === "detail" ? { view: next } : { view: next, id: undefined },
				options,
			),
		[setSearch],
	);
	const [searchInput, setSearchInput] = useState(searchTerm);
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Wizard step state
	const [step, setStep] = useState(1);
	const [maxVisitedStep, setMaxVisitedStep] = useState(1);

	// Form state
	const [formData, setFormData] = useState({
		title: "",
		department: "",
		paymentMethod: "",
		additionalInfo: "",
		businessPurpose: "",
	});

	const [receipts, setReceipts] = useState<ReceiptEntry[]>([emptyReceipt()]);

	const isDirty =
		view === "create" &&
		hasMeaningfulDraftContent({
			formData,
			receipts,
			step,
			maxVisitedStep,
			savedAt: 0,
		});
	useUnsavedChangesGuard(isDirty);

	const hasRestoredDraftRef = useRef(false);

	// Resume an in-progress draft (e.g. after accidental refresh/navigate away)
	useEffect(() => {
		if (hasRestoredDraftRef.current) return;
		hasRestoredDraftRef.current = true;
		const draft = loadReimbursementDraft();
		if (draft && hasMeaningfulDraftContent(draft)) {
			setFormData(draft.formData);
			setReceipts(
				draft.receipts.length > 0 ? draft.receipts : [emptyReceipt()],
			);
			setStep(draft.step || 1);
			setMaxVisitedStep(draft.maxVisitedStep || draft.step || 1);
			setView("create");
			toast.info(
				"Restored your reimbursement draft (form fields). Re-attach any receipts that weren’t uploaded yet.",
			);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Persist the draft while actively creating (never for File objects — receiptFile is a URL by then)
	useEffect(() => {
		if (view !== "create" || !hasRestoredDraftRef.current) return;
		saveReimbursementDraft({ formData, receipts, step, maxVisitedStep });
	}, [view, formData, receipts, step, maxVisitedStep]);

	useEffect(() => {
		setHideTabBar(view === "create" || view === "detail");
		return () => setHideTabBar(false);
	}, [view, setHideTabBar]);

	const resetForm = useCallback(() => {
		setFormData({
			title: "",
			department: "",
			paymentMethod: "",
			additionalInfo: "",
			businessPurpose: "",
		});
		setReceipts([emptyReceipt()]);
		setStep(1);
		setMaxVisitedStep(1);
	}, []);

	const previousViewRef = useRef(view);
	useEffect(() => {
		if (previousViewRef.current === "create" && view !== "create") {
			resetForm();
		}
		previousViewRef.current = view;
	}, [view, resetForm]);

	const totalAmount = receipts.reduce((sum, r) => sum + r.total, 0);

	const handleBackToList = () => {
		setView("list");
	};

	const selectedReimbursement = (
		reimbursements as ReimbursementData[] | undefined
	)?.find((r) => r._id === selectedReimbursementId);

	const handleStepChange = (newStep: number) => {
		setStep(newStep);
		if (newStep > maxVisitedStep) {
			setMaxVisitedStep(newStep);
		}
	};

	const handleNext = () => {
		if (step < STEPS.length) {
			handleStepChange(step + 1);
		}
	};

	const handleBack = () => {
		if (step > 1) {
			setStep(step - 1);
		}
	};

	const handleSubmit = async () => {
		if (!logtoId) return;
		if (!isOnline) {
			toast.error("You’re offline. Reconnect to submit your reimbursement.");
			return;
		}
		if (!formData.title.trim()) {
			toast.error("Title is required. Add one in Report Details.");
			return;
		}
		if (!formData.department) {
			toast.error("Department is required. Choose one in Report Details.");
			return;
		}
		if (!formData.paymentMethod) {
			toast.error("Payment method is required. Choose one in Report Details.");
			return;
		}
		if (totalAmount <= 0) {
			toast.error(
				"Total amount must be greater than zero. Add an amount to your expenses.",
			);
			return;
		}

		setIsSubmitting(true);
		try {
			const formattedReceipts = receipts.map((r) => {
				const lineItems = r.lineItems.filter((li) => li.description.trim());
				const mileageRoute =
					r.expenseType === "mileage"
						? formatMileageRoute(r.mileageFrom, r.mileageTo, r.mileageStops)
						: r.location;
				const common = {
					id: r.id,
					vendorName: r.vendorName,
					location: mileageRoute,
					dateOfPurchase: new Date(r.dateOfPurchase).getTime(),
					lineItems,
					notes: r.notes || undefined,
					subtotal: r.subtotal,
					tax: r.tax || undefined,
					tip: r.tip || undefined,
					shipping: r.shipping || undefined,
					total: r.total,
				};
				if (r.expenseType === "mileage") {
					const stops = r.mileageStops?.filter((s) => s.trim()) ?? [];
					return {
						...common,
						expenseType: "mileage" as const,
						miles: r.miles,
						mileageRatePerMile: MILEAGE_RATE_PER_MILE,
						mileageFrom: r.mileageFrom?.trim() || undefined,
						mileageTo: r.mileageTo?.trim() || undefined,
						mileageStops: stops.length > 0 ? stops : undefined,
					};
				}
				return {
					...common,
					expenseType: "receipt" as const,
					receiptFile: r.receiptFile,
				};
			});

			const newId = await createReimbursement({
				logtoId,
				title: formData.title,
				totalAmount,
				paymentMethod: formData.paymentMethod,
				additionalInfo: formData.additionalInfo,
				department: formData.department as any,
				receipts: formattedReceipts,
				dateOfPurchase: Date.now(),
			});

			toast.success("Reimbursement request submitted!");

			// Fire-and-forget email notification
			sendNotification(getAuthHeaders(), "reimbursement_submitted", {
				reimbursementId: newId,
				title: formData.title,
				totalAmount,
				department: formData.department,
				paymentMethod: formData.paymentMethod,
				additionalInfo: formData.additionalInfo,
				submitterName: user?.name || "Unknown",
				submitterEmail: user?.email || "",
			});

			clearReimbursementDraft();
			resetForm();
			setView("list", { ignoreBlocker: true });
		} catch (error: any) {
			toast.error(
				error.message ||
					"Failed to submit reimbursement. Check your connection and try again.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	// Detail view
	if (view === "detail" && selectedReimbursement) {
		return (
			<div className="w-full h-full">
				<ReimbursementDetailView
					reimbursement={selectedReimbursement}
					onBack={handleBackToList}
					userName={user?.name}
				/>
			</div>
		);
	}

	if (view === "create") {
		return (
			<div className="mx-auto w-full min-w-0 max-w-4xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
				<div className="flex items-start gap-2 sm:items-center sm:gap-3">
					<Button
						variant="ghost"
						size="icon"
						className="size-11 shrink-0 sm:size-9"
						onClick={() => setView("list")}
						aria-label="Back to Reimbursements"
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<div className="min-w-0">
						<h1
							className={cn(
								"text-xl font-semibold tracking-tight text-balance sm:text-2xl",
								isMobile && "sr-only",
							)}
						>
							New Reimbursement Request
						</h1>
						<p className="text-sm text-muted-foreground">
							{isMobile
								? "One step at a time — your progress is saved on this device until you submit."
								: "Fill out the details below to submit a reimbursement."}
						</p>
					</div>
				</div>

				{/* Step Progress Indicator */}
				<StepIndicator
					currentStep={step}
					maxVisitedStep={maxVisitedStep}
					onStepClick={handleStepChange}
				/>

				{/* Step Content */}
				<div className="min-w-0">
					{step === 1 && (
						<AIWarningStep onNext={handleNext} aiEnabled={aiEnabled} />
					)}
					{step === 2 && (
						<BasicInfoStep
							formData={formData}
							setFormData={setFormData}
							onBack={handleBack}
							onNext={handleNext}
						/>
					)}
					{step === 3 && (
						<ReceiptsStep
							receipts={receipts}
							setReceipts={setReceipts}
							generateUploadUrl={generateUploadUrl}
							getStorageUrl={getStorageUrl}
							onBack={handleBack}
							onNext={handleNext}
							aiEnabled={aiEnabled}
						/>
					)}
					{step === 4 && (
						<ReviewStep
							formData={formData}
							receipts={receipts}
							totalAmount={totalAmount}
							onBack={handleBack}
							onSubmit={handleSubmit}
							isSubmitting={isSubmitting}
						/>
					)}
				</div>
			</div>
		);
	}

	// Compute stats
	const allReimbursements =
		(reimbursements as ReimbursementData[] | undefined) || [];
	const statsTotal = allReimbursements.reduce(
		(s, r) => s + (r.totalAmount || 0),
		0,
	);
	const statsPendingAmt = allReimbursements
		.filter((r) => r.status === "submitted")
		.reduce((s, r) => s + (r.totalAmount || 0), 0);
	const statsApprovedAmt = allReimbursements
		.filter((r) => r.status === "approved")
		.reduce((s, r) => s + (r.totalAmount || 0), 0);
	const statsPaidAmt = allReimbursements
		.filter((r) => r.status === "paid")
		.reduce((s, r) => s + (r.totalAmount || 0), 0);

	const filteredReimbursements = allReimbursements.filter((r) => {
		const matchesSearch =
			!searchTerm ||
			r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
			r.department.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesStatus = statusFilter === "all" || r.status === statusFilter;
		return matchesSearch && matchesStatus;
	});

	return (
		<DashboardPage variant="list">
			{/* Header */}
			<PageHeader
				hideTitleOnMobile
				title="Reimbursements"
				description="Submit and track your reimbursement requests."
				actions={
					<Button className="h-11 w-full sm:h-9 sm:w-auto" asChild>
						<Link
							from={Route.fullPath}
							to="/reimbursement"
							search={(prev) => ({ ...prev, view: "create", id: undefined })}
						>
							<Plus className="h-4 w-4 mr-2" />
							New Request
						</Link>
					</Button>
				}
			/>
			{allReimbursements.length > 0 && (
				<SummaryStrip
					items={[
						{
							label: `submitted · ${allReimbursements.length} requests`,
							value: formatCurrencyUSD(statsTotal),
						},
						{ label: "pending", value: formatCurrencyUSD(statsPendingAmt) },
						{ label: "approved", value: formatCurrencyUSD(statsApprovedAmt) },
						{ label: "paid", value: formatCurrencyUSD(statsPaidAmt) },
					]}
				/>
			)}

			{/* List Container */}
			<div className="rounded-md border bg-card overflow-hidden">
				{/* Search + Filter Bar */}
				{allReimbursements.length > 0 && (
					<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-5 py-3 border-b">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								type="search"
								name="q"
								aria-label="Search reimbursements"
								autoComplete="off"
								placeholder="Search by title or department…"
								value={searchInput}
								onChange={(e) => {
									setSearchInput(e.target.value);
									setSearch({ q: e.target.value });
								}}
								className="pl-9 h-9 bg-background"
							/>
						</div>
						<Select
							value={statusFilter}
							onValueChange={(value) =>
								setSearch({ status: value as ReimbursementSearch["status"] })
							}
						>
							<SelectTrigger
								aria-label="Filter by status"
								className="w-full sm:w-[150px] h-9 bg-background"
							>
								<SelectValue placeholder="All Status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Status</SelectItem>
								<SelectItem value="submitted">Submitted</SelectItem>
								<SelectItem value="approved">Approved</SelectItem>
								<SelectItem value="paid">Paid</SelectItem>
								<SelectItem value="declined">Declined</SelectItem>
							</SelectContent>
						</Select>
					</div>
				)}

				{/* List */}
				{!reimbursements ? (
					!isOnline ? (
						<div className="p-5">
							<NetworkErrorState
								description="Your reimbursements need a connection to load. Reconnect and retry."
								onRetry={() => window.location.reload()}
							/>
						</div>
					) : (
						<output className="block p-5 space-y-3" aria-live="polite">
							<span className="sr-only">Loading reimbursements…</span>
							{[1, 2, 3].map((i) => (
								<Skeleton key={i} className="h-16 w-full rounded-lg" />
							))}
						</output>
					)
				) : filteredReimbursements.length > 0 ? (
					<div>
						<div
							className="hidden items-center gap-x-4 border-b px-5 py-2 text-xs font-medium text-muted-foreground sm:grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_7.5rem_6.5rem_7rem]"
							aria-hidden
						>
							<span>Request</span>
							<span>Date</span>
							<span className="text-right">Amount</span>
							<span>Status</span>
						</div>
						<div className="divide-y divide-border">
							{filteredReimbursements.map((r) => (
								<Link
									key={r._id}
									from={Route.fullPath}
									to="/reimbursement"
									search={(prev) => ({ ...prev, view: "detail", id: r._id })}
									className="grid w-full min-h-[52px] items-center gap-x-4 px-4 py-3.5 text-left transition-colors active:bg-accent/50 sm:px-5 md:hover:bg-accent/40 grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_7.5rem_6.5rem_7rem] [content-visibility:auto] [contain-intrinsic-size:auto_68px]"
								>
									<div className="min-w-0">
										<p className="line-clamp-2 break-words text-sm font-medium leading-5">
											{r.title}
										</p>
										<p className="mt-0.5 truncate text-xs text-muted-foreground">
											{r.department} · {r.paymentMethod}
										</p>
									</div>

									<div className="flex flex-col items-end gap-1.5 sm:contents">
										<span className="hidden text-sm tabular-nums text-muted-foreground sm:block">
											{formatDate(r._creationTime)}
										</span>
										<span className="text-right text-sm font-semibold tabular-nums">
											{formatCurrencyUSD(r.totalAmount)}
										</span>
										<span
											className={cn(
												"inline-flex items-center justify-self-start whitespace-nowrap rounded-[4px] px-2 py-0.5 text-xs font-medium capitalize",
												statusColors[r.status] ||
													"bg-muted text-muted-foreground",
											)}
										>
											{r.status}
										</span>
									</div>
								</Link>
							))}
						</div>
					</div>
				) : (
					<EmptyState
						icon={<Receipt />}
						title={
							searchTerm || statusFilter !== "all"
								? "No Matching Requests"
								: "Submit Your First Reimbursement"
						}
						description={
							searchTerm || statusFilter !== "all"
								? "Try adjusting your search or status filter."
								: "Eligible business expenses can be submitted with itemized receipts and payment details. Processing time depends on review completeness."
						}
						checklist={
							!searchTerm && statusFilter === "all" ? (
								<ul className="list-disc space-y-1 pl-5">
									<li>Itemized receipt or invoice</li>
									<li>Business purpose and department</li>
									<li>Payment or mailing details</li>
								</ul>
							) : undefined
						}
						action={
							!searchTerm && statusFilter === "all" ? (
								<Button variant="outline" asChild>
									<Link
										from={Route.fullPath}
										to="/reimbursement"
										search={(prev) => ({
											...prev,
											view: "create",
											id: undefined,
										})}
									>
										Create Reimbursement
									</Link>
								</Button>
							) : undefined
						}
					/>
				)}
			</div>
		</DashboardPage>
	);
}
