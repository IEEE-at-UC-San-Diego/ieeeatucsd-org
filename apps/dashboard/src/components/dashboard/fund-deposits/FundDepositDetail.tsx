import { api } from "@convex/_generated/api";
import {
	AlertCircle,
	Check,
	ChevronLeft,
	ChevronRight,
	CreditCard,
	ExternalLink,
	FileText,
	RotateCw,
	Trash2,
	X,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/dashboard/ConfirmDialog";
import { ResponsiveOverlay } from "@/components/mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label"; // Assuming this exists
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea"; // Assuming this exists
import { useAuthedMutation } from "@/hooks/useAuthedConvex";
import {
	formatCurrencyUSD,
	formatDate,
	formatDateTime,
} from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { FundDeposit } from "./types";
import { STATUS_COLORS, STATUS_ICONS, STATUS_LABELS } from "./types";

interface FundDepositDetailProps {
	deposit: FundDeposit | null;
	isOpen: boolean;
	onClose: () => void;
	logtoId: string;
	userRole: "Administrator" | "Member" | undefined; // Or whatever type userRole is
}

export function FundDepositDetail({
	deposit,
	isOpen,
	onClose,
	logtoId,
	userRole,
}: FundDepositDetailProps) {
	const formId = useId();
	const updateStatus = useAuthedMutation(api.fundDeposits.updateStatus);
	const deleteDeposit = useAuthedMutation(api.fundDeposits.deleteRequest);

	const [activeImageIndex, setActiveImageIndex] = useState(0);
	const [zoomLevel, setZoomLevel] = useState(1);
	const [rotation, setRotation] = useState(0);
	const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
	const [rejectionReason, setRejectionReason] = useState("");
	const [isDeleting, setIsDeleting] = useState(false);
	const confirm = useConfirm();

	if (!deposit) return null;

	const receiptFiles = deposit.receiptFiles || [];
	const currentFile = receiptFiles[activeImageIndex];
	const isPdf = currentFile?.toLowerCase().includes(".pdf"); // Simple check

	const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
	const handleZoomOut = () =>
		setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
	const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
	const resetView = () => {
		setZoomLevel(1);
		setRotation(0);
	};

	const StatusIcon = STATUS_ICONS[deposit.status];

	const handleApprove = async () => {
		try {
			await updateStatus({
				logtoId,
				id: deposit._id,
				status: "verified",
			});
			toast.success("Deposit verified successfully");
			onClose();
		} catch (error) {
			toast.error("Failed to verify deposit. Please try again.");
		}
	};

	const handleReject = async () => {
		if (!rejectionReason.trim()) {
			toast.error("Enter a rejection reason to continue.");
			return;
		}
		try {
			await updateStatus({
				logtoId,
				id: deposit._id,
				status: "rejected",
				rejectionReason,
			});
			toast.success("Deposit rejected successfully");
			setIsRejectModalOpen(false);
			onClose();
		} catch (error) {
			toast.error("Failed to reject deposit. Please try again.");
		}
	};

	const handleDelete = async () => {
		if (
			!(await confirm({
				title: "Delete Deposit?",
				description: "This can’t be undone.",
				confirmLabel: "Delete Deposit",
				destructive: true,
			}))
		)
			return;
		setIsDeleting(true);
		try {
			await deleteDeposit({ logtoId, id: deposit._id });
			toast.success("Deposit deleted");
			onClose();
		} catch (error) {
			toast.error("Failed to delete deposit. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	};

	const canManage = userRole === "Administrator";
	const canDelete =
		canManage ||
		(deposit.depositedBy === logtoId && deposit.status === "pending");

	return (
		<>
			<Sheet open={isOpen} onOpenChange={onClose}>
				<SheetContent className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-4xl p-0 gap-0 overflow-hidden flex flex-col">
					<SheetHeader className="p-6 pb-4 border-b">
						<div className="flex items-start justify-between gap-4">
							<div>
								<SheetTitle className="text-xl font-bold">
									{deposit.title}
								</SheetTitle>
								<SheetDescription className="flex items-center gap-2 mt-2">
									<Badge
										variant="secondary"
										className={cn("gap-1", STATUS_COLORS[deposit.status])}
									>
										<StatusIcon className="w-3 h-3" />
										{STATUS_LABELS[deposit.status]}
									</Badge>
									<span className="text-xs text-muted-foreground font-medium">
										• {deposit.purpose}
									</span>
								</SheetDescription>
							</div>
							<div className="text-right">
								<div className="text-2xl font-bold tabular-nums">
									{formatCurrencyUSD(deposit.amount)}
								</div>
								<div className="text-xs text-muted-foreground">
									{formatDate(deposit.depositDate)}
								</div>
							</div>
						</div>
					</SheetHeader>

					<div className="flex-1 overflow-y-auto">
						<div className="flex flex-col lg:flex-row h-full">
							{/* Left Column: Details */}
							<div className="flex-1 p-6 space-y-6 lg:border-r lg:overflow-y-auto">
								{/* Meta Grid */}
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-1">
										<Label className="text-xs text-muted-foreground">
											Method
										</Label>
										<div className="font-medium flex items-center gap-2 capitalize">
											<CreditCard className="w-4 h-4 text-muted-foreground" />
											{deposit.depositMethod === "other"
												? deposit.otherDepositMethod
												: deposit.depositMethod?.replace("_", " ")}
										</div>
									</div>
									{deposit.referenceNumber && (
										<div className="space-y-1">
											<Label className="text-xs text-muted-foreground">
												Reference
											</Label>
											<div className="font-mono text-sm">
												{deposit.referenceNumber}
											</div>
										</div>
									)}
									<div className="space-y-1">
										<Label className="text-xs text-muted-foreground">
											Submitted By
										</Label>
										<div className="font-medium">
											{deposit.depositedByName || "Unknown"}
										</div>
									</div>
									<div className="space-y-1">
										<Label className="text-xs text-muted-foreground">
											Submitted On
										</Label>
										<div className="text-sm">
											{deposit.submittedAt
												? formatDateTime(deposit.submittedAt)
												: "-"}
										</div>
									</div>
								</div>

								<Separator />

								{/* Description */}
								{deposit.description && (
									<div className="space-y-2">
										<Label className="text-xs text-muted-foreground">
											Description
										</Label>
										<div className="text-sm bg-muted/50 p-3 rounded-md whitespace-pre-wrap">
											{deposit.description}
										</div>
									</div>
								)}

								{/* Rejection Info */}
								{deposit.status === "rejected" && deposit.rejectionReason && (
									<div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
										<Label className="text-destructive font-semibold flex items-center gap-2">
											<AlertCircle className="w-4 h-4" /> Rejection Reason
										</Label>
										<p className="text-sm text-destructive">
											{deposit.rejectionReason}
										</p>
									</div>
								)}

								{/* IEEE Info */}
								{deposit.isIeeeDeposit && (
									<div className="bg-ds-blue-100 border border-ds-blue-100 rounded-lg p-4">
										<Label className="text-tone-info font-semibold mb-1 block">
											IEEE Deposit
										</Label>
										<p className="text-sm text-tone-info">
											Source:{" "}
											<span className="uppercase">
												{deposit.ieeeDepositSource}
											</span>
										</p>
									</div>
								)}

								{/* Audit Logs could go here */}
							</div>

							{/* Right Column: Receipts */}
							{receiptFiles.length > 0 ? (
								<div className="lg:w-[45%] flex flex-col h-[500px] lg:h-auto bg-muted/30 border-t lg:border-t-0">
									<div className="p-3 border-b bg-background flex items-center justify-between">
										<div className="flex items-center gap-2">
											<FileText className="w-4 h-4 text-muted-foreground" />
											<span className="font-medium text-sm">
												Receipts ({receiptFiles.length})
											</span>
										</div>
										<div className="flex items-center gap-1">
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7"
												onClick={handleZoomOut}
												aria-label="Zoom out"
												disabled={isPdf}
											>
												<ZoomOut className="w-3.5 h-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7"
												onClick={handleZoomIn}
												aria-label="Zoom in"
												disabled={isPdf}
											>
												<ZoomIn className="w-3.5 h-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7"
												onClick={handleRotate}
												aria-label="Rotate receipt"
												disabled={isPdf}
											>
												<RotateCw className="w-3.5 h-3.5" />
											</Button>
											<Separator orientation="vertical" className="h-4 mx-1" />
											<Button
												variant="ghost"
												size="icon"
												className="h-7 w-7"
												onClick={() => window.open(currentFile, "_blank")}
												aria-label="Open receipt in new tab"
											>
												<ExternalLink className="w-3.5 h-3.5" />
											</Button>
										</div>
									</div>

									<div className="flex-1 relative overflow-hidden flex items-center justify-center bg-muted">
										{isPdf ? (
											<iframe
												src={currentFile}
												className="w-full h-full border-0"
												title="Receipt PDF"
											/>
										) : (
											<div className="overflow-auto w-full h-full flex items-center justify-center p-4">
												<img
													src={currentFile}
													alt="Receipt"
													width={800}
													height={1000}
													className="max-w-full max-h-full object-contain transition-transform duration-200"
													style={{
														transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
													}}
												/>
											</div>
										)}

										{/* Navigation Overlay */}
										{receiptFiles.length > 1 && (
											<div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
												<Button
													variant="secondary"
													size="icon"
													className="h-8 w-8 rounded-full shadow-md bg-background/80 backdrop-blur-sm"
													onClick={() =>
														setActiveImageIndex((prev) =>
															prev > 0 ? prev - 1 : prev,
														)
													}
													disabled={activeImageIndex === 0}
													aria-label="Previous receipt"
												>
													<ChevronLeft className="w-4 h-4" />
												</Button>
												<span className="bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium shadow-md tabular-nums">
													{activeImageIndex + 1} / {receiptFiles.length}
												</span>
												<Button
													variant="secondary"
													size="icon"
													className="h-8 w-8 rounded-full shadow-md bg-background/80 backdrop-blur-sm"
													onClick={() =>
														setActiveImageIndex((prev) =>
															prev < receiptFiles.length - 1 ? prev + 1 : prev,
														)
													}
													disabled={
														activeImageIndex === receiptFiles.length - 1
													}
													aria-label="Next receipt"
												>
													<ChevronRight className="w-4 h-4" />
												</Button>
											</div>
										)}
									</div>

									{/* Thumbnails */}
									{receiptFiles.length > 1 && (
										<div className="p-2 border-t bg-background overflow-x-auto whitespace-nowrap gap-2 flex">
											{receiptFiles.map((file, idx) => (
												<Button
													variant="outline"
													key={idx}
													aria-label={`View receipt ${idx + 1}`}
													onClick={() => {
														setActiveImageIndex(idx);
														resetView();
													}}
													className={cn(
														"w-12 h-12 rounded border overflow-hidden flex-shrink-0 relative",
														activeImageIndex === idx
															? "ring-2 ring-primary ring-offset-1"
															: "opacity-70 hover:opacity-100",
													)}
												>
													{file.toLowerCase().includes(".pdf") ? (
														<div className="w-full h-full flex items-center justify-center bg-muted text-[8px] text-muted-foreground uppercase font-bold">
															PDF
														</div>
													) : (
														<img
															src={file}
															className="w-full h-full object-cover"
															alt=""
															width={48}
															height={48}
															loading="lazy"
														/>
													)}
												</Button>
											))}
										</div>
									)}
								</div>
							) : (
								<div className="lg:w-[45%] flex flex-col items-center justify-center p-8 text-muted-foreground bg-muted/10 lg:border-l">
									<FileText className="w-12 h-12 mb-2 opacity-20" />
									<p className="text-sm">No receipts attached</p>
								</div>
							)}
						</div>
					</div>

					<SheetFooter className="p-4 border-t bg-muted/10 sm:justify-between gap-4">
						<div className="flex items-center gap-2">
							{canDelete && (
								<Button
									variant="ghost"
									size="sm"
									onClick={handleDelete}
									disabled={isDeleting}
									className="text-muted-foreground hover:text-tone-danger hover:bg-destructive/10"
								>
									<Trash2 className="w-4 h-4 mr-2" /> Delete
								</Button>
							)}
							<div></div> {/* Spacer */}
						</div>

						<div className="flex gap-2 w-full sm:w-auto">
							<Button
								variant="outline"
								onClick={onClose}
								className="flex-1 sm:flex-none"
							>
								Close
							</Button>

							{canManage && deposit.status === "pending" && (
								<>
									<Button
										variant="destructive"
										onClick={() => setIsRejectModalOpen(true)}
										className="flex-1 sm:flex-none"
									>
										<X className="w-4 h-4 mr-2" /> Reject
									</Button>
									<Button
										variant="default"
										onClick={handleApprove}
										className="bg-ds-green-700 hover:bg-ds-green-800 flex-1 sm:flex-none"
									>
										<Check className="w-4 h-4 mr-2" /> Verify
									</Button>
								</>
							)}
						</div>
					</SheetFooter>
				</SheetContent>
			</Sheet>

			{/* Reject Modal */}
			<ResponsiveOverlay
				open={isRejectModalOpen}
				onOpenChange={setIsRejectModalOpen}
				title="Reject Deposit"
				description="Explain why this deposit is being rejected."
				variant="sheet"
				footer={
					<div className="flex w-full gap-2">
						<Button
							variant="ghost"
							className="h-11 flex-1 sm:h-9 sm:flex-none"
							onClick={() => setIsRejectModalOpen(false)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							className="h-11 flex-1 sm:h-9 sm:flex-none"
							onClick={handleReject}
						>
							Confirm Rejection
						</Button>
					</div>
				}
			>
				<Label
					htmlFor={`${formId}-deposit-rejection-reason`}
					className="sr-only"
				>
					Rejection Reason
				</Label>
				<Textarea
					id={`${formId}-deposit-rejection-reason`}
					name="rejectionReason"
					value={rejectionReason}
					onChange={(e) => setRejectionReason(e.target.value)}
					placeholder="Reason for rejection…"
					className="min-h-24 text-base sm:text-sm"
				/>
			</ResponsiveOverlay>
		</>
	);
}
