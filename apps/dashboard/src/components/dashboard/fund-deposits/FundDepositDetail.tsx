import { useState } from "react";
import { format } from "date-fns";
import {
    CreditCard,
    FileText,
    AlertCircle,
    ExternalLink,
    ZoomIn,
    ZoomOut,
    RotateCw,
    Check,
    X,
    Trash2,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea"; // Assuming this exists
import { Label } from "@/components/ui/label";       // Assuming this exists

import type { FundDeposit } from "./types";
import { STATUS_COLORS, STATUS_LABELS, STATUS_ICONS } from "./types";
import { toast } from "sonner";
import { useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import { cn } from "@/lib/utils";

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
    const updateStatus = useAuthedMutation(api.fundDeposits.updateStatus);
    const deleteDeposit = useAuthedMutation(api.fundDeposits.deleteRequest);

    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);

    if (!deposit) return null;

    const receiptFiles = deposit.receiptFiles || [];
    const currentFile = receiptFiles[activeImageIndex];
    const isPdf = currentFile?.toLowerCase().includes(".pdf"); // Simple check

    const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
    const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
    const resetView = () => {
        setZoomLevel(1);
        setRotation(0);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
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
            toast.error("Failed to verify deposit");
        }
    };

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            toast.error("Please provide a rejection reason");
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
            toast.error("Failed to reject deposit");
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure? This cannot be undone.")) return;
        setIsDeleting(true);
        try {
            await deleteDeposit({ logtoId, id: deposit._id });
            toast.success("Deposit deleted");
            onClose();
        } catch (error) {
            toast.error("Failed to delete deposit");
        } finally {
            setIsDeleting(false);
        }
    };

    const canManage = userRole === "Administrator";
    const canDelete = canManage || (deposit.depositedBy === logtoId && deposit.status === "pending");

    return (
        <>
            <Sheet open={isOpen} onOpenChange={onClose}>
                <SheetContent className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-4xl p-0 gap-0 overflow-hidden flex flex-col">
                    <SheetHeader className="p-6 pb-4 border-b">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <SheetTitle className="text-xl font-bold">{deposit.title}</SheetTitle>
                                <SheetDescription className="flex items-center gap-2 mt-2">
                                    <Badge variant="secondary" className={cn("gap-1", STATUS_COLORS[deposit.status])}>
                                        <StatusIcon className="w-3 h-3" />
                                        {STATUS_LABELS[deposit.status]}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                                        • {deposit.purpose}
                                    </span>
                                </SheetDescription>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold tabular-nums">
                                    {formatCurrency(deposit.amount)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {format(new Date(deposit.depositDate), "MMM d, yyyy")}
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
                                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Method</Label>
                                        <div className="font-medium flex items-center gap-2 capitalize">
                                            <CreditCard className="w-4 h-4 text-muted-foreground" />
                                            {deposit.depositMethod === "other"
                                                ? deposit.otherDepositMethod
                                                : deposit.depositMethod?.replace("_", " ")}
                                        </div>
                                    </div>
                                    {deposit.referenceNumber && (
                                        <div className="space-y-1">
                                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Reference</Label>
                                            <div className="font-mono text-sm">{deposit.referenceNumber}</div>
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Submitted By</Label>
                                        <div className="font-medium">{deposit.depositedByName || "Unknown"}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Submitted On</Label>
                                        <div className="text-sm">{deposit.submittedAt ? format(new Date(deposit.submittedAt), "MMM d, yyyy h:mm a") : "-"}</div>
                                    </div>
                                </div>

                                <Separator />

                                {/* Description */}
                                {deposit.description && (
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Description</Label>
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
                                        <p className="text-sm text-destructive">{deposit.rejectionReason}</p>
                                    </div>
                                )}

                                {/* IEEE Info */}
                                {deposit.isIeeeDeposit && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <Label className="text-blue-700 font-semibold mb-1 block">IEEE Deposit</Label>
                                        <p className="text-sm text-blue-600">
                                            Source: <span className="uppercase">{deposit.ieeeDepositSource}</span>
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
                                            <span className="font-medium text-sm">Receipts ({receiptFiles.length})</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} disabled={isPdf}><ZoomOut className="w-3.5 h-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} disabled={isPdf}><ZoomIn className="w-3.5 h-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRotate} disabled={isPdf}><RotateCw className="w-3.5 h-3.5" /></Button>
                                            <Separator orientation="vertical" className="h-4 mx-1" />
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(currentFile, "_blank")}><ExternalLink className="w-3.5 h-3.5" /></Button>
                                        </div>
                                    </div>

                                    <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-gray-100">
                                        {isPdf ? (
                                            <iframe src={currentFile} className="w-full h-full border-0" title="Receipt PDF" />
                                        ) : (
                                            <div className="overflow-auto w-full h-full flex items-center justify-center p-4">
                                                <img
                                                    src={currentFile}
                                                    alt="Receipt"
                                                    className="max-w-full max-h-full object-contain transition-transform duration-200"
                                                    style={{ transform: `scale(${zoomLevel}) rotate(${rotation}deg)` }}
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
                                                    onClick={() => setActiveImageIndex(prev => prev > 0 ? prev - 1 : prev)}
                                                    disabled={activeImageIndex === 0}
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
                                                    onClick={() => setActiveImageIndex(prev => prev < receiptFiles.length - 1 ? prev + 1 : prev)}
                                                    disabled={activeImageIndex === receiptFiles.length - 1}
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
                                                <button
                                                    key={idx}
                                                    onClick={() => {
                                                        setActiveImageIndex(idx);
                                                        resetView();
                                                    }}
                                                    className={cn(
                                                        "w-12 h-12 rounded border overflow-hidden flex-shrink-0 relative",
                                                        activeImageIndex === idx ? "ring-2 ring-primary ring-offset-1" : "opacity-70 hover:opacity-100"
                                                    )}
                                                >
                                                    {file.toLowerCase().includes(".pdf") ? (
                                                        <div className="w-full h-full flex items-center justify-center bg-muted text-[8px] text-muted-foreground uppercase font-bold">PDF</div>
                                                    ) : (
                                                        <img src={file} className="w-full h-full object-cover" alt="thumbnail" />
                                                    )}
                                                </button>
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
                                <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isDeleting} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </Button>
                            )}
                            <div></div> {/* Spacer */}
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">Close</Button>

                            {canManage && deposit.status === "pending" && (
                                <>
                                    <Button variant="destructive" onClick={() => setIsRejectModalOpen(true)} className="flex-1 sm:flex-none">
                                        <X className="w-4 h-4 mr-2" /> Reject
                                    </Button>
                                    <Button variant="default" onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700 flex-1 sm:flex-none">
                                        <Check className="w-4 h-4 mr-2" /> Verify
                                    </Button>
                                </>
                            )}
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Reject Modal */}
            <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Deposit</DialogTitle>
                        <DialogDescription>Please provide a reason for rejection.</DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Reason..."
                        className="mt-2"
                    />
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleReject}>Confirm Rejection</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
