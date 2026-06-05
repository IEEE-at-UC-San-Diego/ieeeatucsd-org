import { useState } from "react";
import { useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Loader2,
    CheckCircle,
    DollarSign,
    ArrowRight,
    ChevronLeft,
    Sparkles,
    FileText,
} from "lucide-react";
import { toast } from "sonner";
import { MultiFileUpload } from "./MultiFileUpload";
import type { DepositMethod, IeeeDepositSource } from "./types";
import { cn } from "@/lib/utils";
import { useGlobalImagePaste } from "@/hooks/useGlobalImagePaste";
import { useAuth } from "@/hooks/useAuth";

interface FundDepositWizardProps {
    isOpen: boolean;
    onClose: () => void;
    logtoId: string;
}

const DEPOSIT_STEPS = [
    { id: 1, name: "Transaction Details", description: "Basic Info" },
    { id: 2, name: "Purpose & Notes", description: "Details" },
    { id: 3, name: "Receipts", description: "Upload Proof" },
];

export function FundDepositWizard({ isOpen, onClose, logtoId }: FundDepositWizardProps) {
    const { user, getAuthHeaders } = useAuth();
    const aiEnabled = user?.aiFeaturesEnabled !== false;
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const createDeposit = useAuthedMutation(api.fundDeposits.create);
    const generateUploadUrl = useAuthedMutation(api.fundDeposits.generateUploadUrl);
    const getStorageUrl = useAuthedMutation(api.fundDeposits.getStorageUrl);

    const [formData, setFormData] = useState({
        title: "",
        amount: "",
        purpose: "",
        depositDate: new Date().toISOString().split("T")[0],
        depositMethod: "cash" as DepositMethod,
        otherDepositMethod: "",
        description: "",
        referenceNumber: "",
        isIeeeDeposit: false,
        ieeeDepositSource: "upp" as IeeeDepositSource,
    });
    const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [isAiParsing, setIsAiParsing] = useState(false);
    const [aiParseMessage, setAiParseMessage] = useState("");

    const fileToDataUrl = async (file: File): Promise<string> =>
        await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
        });

    const parseReceiptWithAI = async (file: File) => {
        setIsAiParsing(true);
        setAiParseMessage("");
        try {
            const imageUrl = await fileToDataUrl(file);
            const response = await fetch("/api/parse-receipt", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                body: JSON.stringify({ imageUrl }),
            });

            const result = await response.json();
            if (!response.ok || !result.success || !result.data) {
                throw new Error(result.error || "Failed to parse receipt");
            }

            const parsed = result.data as {
                vendorName?: string;
                dateOfPurchase?: string;
                total?: number;
                lineItems?: Array<{ description?: string; amount?: number }>;
            };

            const detectedAmount = parsed.total && parsed.total > 0 ? parsed.total : undefined;
            const parsedDate = parsed.dateOfPurchase ? new Date(parsed.dateOfPurchase) : null;
            const hasValidDate = parsedDate && !Number.isNaN(parsedDate.getTime());
            const todayDate = new Date().toISOString().split("T")[0];
            const aiDescription = Array.isArray(parsed.lineItems)
                ? parsed.lineItems
                    .filter((item) => item.description)
                    .slice(0, 5)
                    .map((item) => `${item.description}${item.amount ? ` ($${Number(item.amount).toFixed(2)})` : ""}`)
                    .join(", ")
                : "";

            setFormData((prev) => ({
                ...prev,
                title: prev.title.trim() || (parsed.vendorName ? `${parsed.vendorName} Deposit` : prev.title),
                amount: detectedAmount && !prev.amount ? detectedAmount.toFixed(2) : prev.amount,
                depositDate:
                    hasValidDate && prev.depositDate === todayDate
                        ? parsedDate.toISOString().split("T")[0]
                        : prev.depositDate,
                description: prev.description.trim() || aiDescription || prev.description,
            }));

            setAiParseMessage("AI extracted details from the latest receipt. Review before submitting.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            setAiParseMessage(`AI parse failed: ${message}. You can continue with manual entry.`);
        } finally {
            setIsAiParsing(false);
        }
    };

    const handleReceiptFilesChange = (nextFiles: File[]) => {
        const latestFile = nextFiles[nextFiles.length - 1];
        const prevCount = receiptFiles.length;
        setReceiptFiles(nextFiles);
        if (aiEnabled && latestFile && nextFiles.length > prevCount) {
            void parseReceiptWithAI(latestFile);
        }
    };

    // Global paste support
    useGlobalImagePaste({
        enabled: isOpen && step === 3,
        onImagePasted: (files) => {
            if (files.length > 0 && receiptFiles.length < 10) {
                const remainingSlots = 10 - receiptFiles.length;
                const filesToAdd = files.slice(0, remainingSlots);
                const updatedFiles = [...receiptFiles, ...filesToAdd];
                handleReceiptFilesChange(updatedFiles);
                toast.success(`${filesToAdd.length} image(s) pasted from clipboard`);
            }
        },
    });

    const resetForm = () => {
        setFormData({
            title: "",
            amount: "",
            purpose: "",
            depositDate: new Date().toISOString().split("T")[0],
            depositMethod: "cash",
            otherDepositMethod: "",
            description: "",
            referenceNumber: "",
            isIeeeDeposit: false,
            ieeeDepositSource: "upp",
        });
        setReceiptFiles([]);
        setFormErrors({});
        setIsAiParsing(false);
        setAiParseMessage("");
        setStep(1);
    };

    const handleClose = () => {
        onClose();
        setTimeout(resetForm, 300); // Reset after animation
    };

    const validateStep1 = () => {
        const errors: Record<string, string> = {};
        if (!formData.title.trim()) errors.title = "Title is required";
        if (!formData.amount) {
            errors.amount = "Amount is required";
        } else if (isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
            errors.amount = "Amount must be positive";
        }
        if (formData.depositMethod === "other" && !formData.otherDepositMethod.trim()) {
            errors.otherDepositMethod = "Required";
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateStep2 = () => {
        const errors: Record<string, string> = {};
        if (!formData.purpose.trim()) errors.purpose = "Purpose is required";
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleNext = () => {
        if (step === 1 && validateStep1()) setStep(2);
        if (step === 2 && validateStep2()) setStep(3);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const uploadFiles = async (files: File[]): Promise<string[]> => {
        return await Promise.all(
            files.map(async (file) => {
                const uploadUrl = await generateUploadUrl({});
                const result = await fetch(uploadUrl, {
                    method: "POST",
                    body: file,
                    headers: { "Content-Type": file.type || "application/octet-stream" },
                });

                if (!result.ok) {
                    throw new Error(`Failed to upload ${file.name}`);
                }

                const { storageId } = await result.json();
                const fileUrl = await getStorageUrl({ storageId });
                if (!fileUrl) {
                    throw new Error(`Failed to resolve uploaded file URL for ${file.name}`);
                }
                return fileUrl;
            }),
        );
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            let receiptFileUrls: string[] = [];
            if (receiptFiles.length > 0) {
                receiptFileUrls = await uploadFiles(receiptFiles);
            }

            await createDeposit({
                logtoId,
                title: formData.title,
                amount: parseFloat(formData.amount),
                purpose: formData.purpose,
                depositDate: new Date(formData.depositDate).getTime(),
                depositMethod: formData.depositMethod,
                otherDepositMethod: formData.otherDepositMethod || undefined,
                description: formData.description || undefined,
                referenceNumber: formData.referenceNumber || undefined,
                receiptFiles: receiptFileUrls,
                isIeeeDeposit: formData.isIeeeDeposit || undefined,
                ieeeDepositSource: formData.ieeeDepositSource || undefined,
            });

            toast.success("Deposit submitted successfully");
            handleClose();
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Failed to submit deposit";
            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[600px] gap-0 p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-xl">New Fund Deposit</DialogTitle>
                    <DialogDescription>
                        Step {step} of 3: {DEPOSIT_STEPS[step - 1].name}
                    </DialogDescription>

                    {/* Progress Bar */}
                    <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary transition-all duration-300 ease-out"
                            style={{ width: `${(step / 3) * 100}%` }}
                        />
                    </div>
                </DialogHeader>

                <div className="p-6 pt-2 overflow-y-auto max-h-[65vh]">
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            {/* Amount and Title Group */}
                            <div className="grid gap-4">
                                <div>
                                    <Label htmlFor="title">Deposit Title <span className="text-destructive">*</span></Label>
                                    <Input
                                        id="title"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g. Spring BBQ Food Sales"
                                        className={formErrors.title ? "border-destructive" : ""}
                                        autoFocus
                                    />
                                    {formErrors.title && <p className="text-xs text-destructive mt-1">{formErrors.title}</p>}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="amount">Amount <span className="text-destructive">*</span></Label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="amount"
                                                type="number"
                                                step="0.01"
                                                value={formData.amount}
                                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                                placeholder="0.00"
                                                className={`pl-9 ${formErrors.amount ? "border-destructive" : ""}`}
                                            />
                                        </div>
                                        {formErrors.amount && <p className="text-xs text-destructive mt-1">{formErrors.amount}</p>}
                                    </div>
                                    <div>
                                        <Label htmlFor="depositDate">Date <span className="text-destructive">*</span></Label>
                                        <Input
                                            id="depositDate"
                                            type="date"
                                            value={formData.depositDate}
                                            onChange={(e) => setFormData({ ...formData, depositDate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Method Group */}
                            <div className="space-y-3 pt-2">
                                <Label>Deposit Method <span className="text-destructive">*</span></Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(["cash", "check", "bank_transfer", "other"] as DepositMethod[]).map((method) => (
                                        <div
                                            key={method}
                                            onClick={() => setFormData({ ...formData, depositMethod: method })}
                                            className={cn(
                                                "cursor-pointer rounded-lg border p-3 flex items-center justify-between transition-all hover:bg-muted/50",
                                                formData.depositMethod === method ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-input"
                                            )}
                                        >
                                            <span className="text-sm font-medium capitalize">{method.replace("_", " ")}</span>
                                            {formData.depositMethod === method && <CheckCircle className="h-4 w-4 text-primary" />}
                                        </div>
                                    ))}
                                </div>

                                {formData.depositMethod === "other" && (
                                    <div className="animate-in fade-in slide-in-from-top-2">
                                        <Input
                                            placeholder="Specify method..."
                                            value={formData.otherDepositMethod}
                                            onChange={e => setFormData({ ...formData, otherDepositMethod: e.target.value })}
                                            className={formErrors.otherDepositMethod ? "border-destructive" : ""}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* IEEE Source checkbox */}
                            <div className="flex items-center space-x-2 pt-2">
                                <Checkbox
                                    id="isIeee"
                                    checked={formData.isIeeeDeposit}
                                    onCheckedChange={(c) => setFormData({ ...formData, isIeeeDeposit: c === true })}
                                />
                                <Label htmlFor="isIeee" className="cursor-pointer">This is an IEEE Deposit (Concur)</Label>
                            </div>

                            {formData.isIeeeDeposit && (
                                <div className="pl-6 border-l-2 py-1 animate-in fade-in slide-in-from-left-2">
                                    <Label>IEEE Source</Label>
                                    <Select
                                        value={formData.ieeeDepositSource}
                                        onValueChange={(v: IeeeDepositSource) => setFormData({ ...formData, ieeeDepositSource: v })}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="upp">IEEE UPP</SelectItem>
                                            <SelectItem value="section">IEEE Section</SelectItem>
                                            <SelectItem value="region">IEEE Region</SelectItem>
                                            <SelectItem value="global">IEEE Global</SelectItem>
                                            <SelectItem value="society">IEEE Society</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div>
                                <Label htmlFor="purpose">Purpose <span className="text-destructive">*</span></Label>
                                <Input
                                    id="purpose"
                                    value={formData.purpose}
                                    onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                    placeholder="e.g. Event Revenue, Membership Dues"
                                    className={formErrors.purpose ? "border-destructive" : ""}
                                    autoFocus
                                />
                                {formErrors.purpose && <p className="text-xs text-destructive mt-1">{formErrors.purpose}</p>}
                            </div>

                            <div>
                                <Label htmlFor="reference">Reference Number (Optional)</Label>
                                <Input
                                    id="reference"
                                    value={formData.referenceNumber}
                                    onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                                    placeholder="Check #, Transaction ID"
                                />
                            </div>

                            <div>
                                <Label htmlFor="description">Additional Notes (Optional)</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Any extra details..."
                                    className="h-32 resize-none"
                                />
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <MultiFileUpload
                                files={receiptFiles}
                                onFilesChange={handleReceiptFilesChange}
                                accept=".pdf,.jpg,.jpeg,.png"
                                maxFiles={10}
                                maxSizeInMB={10}
                                label="Upload Receipts"
                                description="Drag & drop or paste images here."
                            />

                            <div className="rounded-lg border p-3 bg-muted/30">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <Sparkles className="h-4 w-4 text-primary" />
                                        {aiEnabled ? "AI Receipt Parsing" : "Manual Receipt Entry"}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!aiEnabled || isAiParsing || receiptFiles.length === 0}
                                        onClick={() => {
                                            if (receiptFiles.length > 0) {
                                                void parseReceiptWithAI(receiptFiles[receiptFiles.length - 1]);
                                            }
                                        }}
                                    >
                                        {isAiParsing && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                                        Re-Analyze Latest
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {aiEnabled
                                        ? "The latest uploaded receipt will auto-fill amount/title when possible."
                                        : "AI is disabled for this account. Enter details manually after uploading receipts."}
                                </p>
                                {aiParseMessage && (
                                    <p className="text-xs mt-2 text-muted-foreground">{aiParseMessage}</p>
                                )}
                            </div>

                            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2 border">
                                <h4 className="font-semibold flex items-center gap-2">
                                    <FileText className="h-4 w-4" /> Summary
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                                    <span>Amount:</span>
                                    <span className="font-medium text-foreground text-right">${formData.amount}</span>

                                    <span>Method:</span>
                                    <span className="font-medium text-foreground text-right capitalize">
                                        {formData.depositMethod === "other" ? formData.otherDepositMethod : formData.depositMethod.replace("_", " ")}
                                    </span>

                                    <span>Receipts:</span>
                                    <span className="font-medium text-foreground text-right">{receiptFiles.length} file(s)</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-2 border-t bg-muted/20 flex items-center justify-between sm:justify-between">
                    <Button
                        variant="ghost"
                        onClick={handleBack}
                        disabled={step === 1 || isSubmitting}
                        className={step === 1 ? "invisible" : ""}
                    >
                        <ChevronLeft className="h-4 w-4 mr-2" /> Back
                    </Button>

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                            Cancel
                        </Button>

                        {step < 3 ? (
                            <Button onClick={handleNext}>
                                Next <ArrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        ) : (
                            <Button onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Submit Deposit
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
