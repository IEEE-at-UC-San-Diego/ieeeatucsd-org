import { api } from "@convex/_generated/api";
import {
	ArrowRight,
	CheckCircle,
	ChevronLeft,
	DollarSign,
	FileText,
	Loader2,
	Sparkles,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { ResponsiveOverlay, useMobileShell } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useAuthedMutation } from "@/hooks/useAuthedConvex";
import { useGlobalImagePaste } from "@/hooks/useGlobalImagePaste";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useWizard } from "@/hooks/useWizard";
import { formatCurrencyUSD } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { MultiFileUpload } from "./MultiFileUpload";
import { fileSha256Base64 } from "./receiptChecksum";
import {
	createRequestGate,
	mergeParsedReceipt,
	type ParsedReceipt,
	type ReceiptParseState,
} from "./receiptParse";
import type { DepositMethod, IeeeDepositSource } from "./types";

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

export function FundDepositWizard({
	isOpen,
	onClose,
	logtoId,
}: FundDepositWizardProps) {
	const formId = useId();
	const { setHideTabBar } = useMobileShell();
	const { user, getAuthHeaders } = useAuth();
	const aiEnabled = user?.aiFeaturesEnabled !== false;
	const createDeposit = useAuthedMutation(api.fundDeposits.create);
	const generateUploadUrl = useAuthedMutation(
		api.fundDeposits.generateUploadUrl,
	);
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
	const [parseState, setParseState] = useState<ReceiptParseState>({
		status: "idle",
	});
	const [parseGate] = useState(createRequestGate);
	const isAiParsing = parseState.status === "parsing";

	const validateStep1 = () => {
		const errors: Record<string, string> = {};
		if (!formData.title.trim()) errors.title = "Title is required";
		if (!formData.amount) {
			errors.amount = "Amount is required";
		} else if (
			isNaN(parseFloat(formData.amount)) ||
			parseFloat(formData.amount) <= 0
		) {
			errors.amount = "Amount must be positive";
		}
		if (
			formData.depositMethod === "other" &&
			!formData.otherDepositMethod.trim()
		) {
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

	const wizard = useWizard({
		stepCount: DEPOSIT_STEPS.length,
		canAdvance: (step) => {
			if (step === 1) return validateStep1();
			if (step === 2) return validateStep2();
			return true;
		},
	});
	const { step } = wizard;

	const isDirty =
		isOpen &&
		wizard.isEditable &&
		(Boolean(
			formData.title ||
				formData.amount ||
				formData.purpose ||
				formData.otherDepositMethod ||
				formData.description ||
				formData.referenceNumber,
		) ||
			receiptFiles.length > 0);
	const confirmDiscard = useUnsavedChangesGuard(isDirty);

	useEffect(() => {
		setHideTabBar(isOpen);
		return () => setHideTabBar(false);
	}, [isOpen, setHideTabBar]);

	const fileToDataUrl = async (file: File): Promise<string> =>
		await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = () => reject(new Error("Failed to read file"));
			reader.readAsDataURL(file);
		});

	const parseReceiptWithAI = async (file: File) => {
		if (!wizard.isEditable) return;
		const token = parseGate.begin();
		setParseState({ status: "parsing" });
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

			if (!parseGate.isCurrent(token)) return;
			const parsed = result.data as ParsedReceipt;
			const todayDate = new Date().toISOString().split("T")[0];
			setFormData((prev) => mergeParsedReceipt(prev, parsed, todayDate));
			setParseState({
				status: "done",
				message:
					"AI extracted details from the latest receipt. Review before submitting.",
			});
		} catch (error) {
			if (!parseGate.isCurrent(token)) return;
			const message = error instanceof Error ? error.message : "Unknown error";
			setParseState({
				status: "done",
				message: `AI parse failed: ${message}. You can continue with manual entry.`,
			});
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
		enabled: isOpen && step === 3 && wizard.isEditable,
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
		parseGate.invalidate();
		setParseState({ status: "idle" });
		wizard.reset();
	};

	const handleClose = () => {
		parseGate.invalidate();
		onClose();
		setTimeout(resetForm, 300); // Reset after animation
	};

	const handleCancel = async () => {
		if (wizard.isPending || !(await confirmDiscard())) return;
		handleClose();
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
				const sha256 = await fileSha256Base64(file);
				const fileUrl = await getStorageUrl({ storageId, sha256 });
				if (!fileUrl) {
					throw new Error(
						`Failed to resolve uploaded file URL for ${file.name}`,
					);
				}
				return fileUrl;
			}),
		);
	};

	const handleSubmit = async () => {
		if (isAiParsing || !wizard.startSubmit()) return;
		parseGate.invalidate();
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
			wizard.submitSucceeded();
			handleClose();
		} catch (error: unknown) {
			const errorMessage =
				error instanceof Error
					? error.message
					: "Failed to submit deposit. Please try again.";
			toast.error(errorMessage);
			wizard.submitFailed(errorMessage);
		}
	};

	return (
		<ResponsiveOverlay
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) void handleCancel();
			}}
			title="New Fund Deposit"
			description={`Step ${step} of ${wizard.stepCount}: ${DEPOSIT_STEPS[step - 1].name}`}
			variant="fullscreen"
			className="sm:max-w-[600px]"
			footer={
				<div className="flex w-full items-center justify-between gap-2">
					<Button
						variant="ghost"
						onClick={wizard.back}
						disabled={wizard.isFirstStep || !wizard.isEditable}
						className={cn("h-11 sm:h-9", wizard.isFirstStep ? "invisible" : "")}
					>
						<ChevronLeft className="h-4 w-4 mr-2" /> Back
					</Button>

					<div className="flex flex-1 justify-end gap-2 sm:flex-none">
						<Button
							variant="outline"
							onClick={() => void handleCancel()}
							disabled={wizard.isPending}
							className="h-11 flex-1 sm:h-9 sm:flex-none"
						>
							Cancel
						</Button>

						{!wizard.isLastStep ? (
							<Button
								onClick={() => wizard.next()}
								className="h-11 flex-1 sm:h-9 sm:flex-none"
							>
								Next <ArrowRight className="h-4 w-4 ml-2" />
							</Button>
						) : (
							<Button
								onClick={handleSubmit}
								disabled={!wizard.isEditable || isAiParsing}
								className="h-11 flex-1 sm:h-9 sm:flex-none"
							>
								{wizard.phase.kind === "submitting" && (
									<Loader2 className="h-4 w-4 animate-spin mr-2" />
								)}
								Submit Deposit
							</Button>
						)}
					</div>
				</div>
			}
		>
			{/* Progress Bar */}
			<div className="mb-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
				<div
					className="h-full w-full origin-left bg-primary transition-transform duration-200 ease-[var(--ease-in-out)] motion-instant-reduce"
					style={{ transform: `scaleX(${step / wizard.stepCount})` }}
				/>
			</div>

			<div className="pb-2">
				{step === 1 && (
					<div className="space-y-4">
						{/* Amount and Title Group */}
						<div className="grid gap-4">
							<div>
								<Label htmlFor={`${formId}-title`}>
									Deposit Title <span className="text-destructive">*</span>
								</Label>
								<Input
									id={`${formId}-title`}
									name="title"
									autoComplete="off"
									value={formData.title}
									onChange={(e) =>
										setFormData({ ...formData, title: e.target.value })
									}
									placeholder="e.g. Spring BBQ Food Sales"
									className={cn(
										"h-11 text-base sm:h-9 sm:text-sm",
										formErrors.title ? "border-destructive" : "",
									)}
								/>
								{formErrors.title && (
									<p className="text-xs text-destructive mt-1">
										{formErrors.title}
									</p>
								)}
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label htmlFor={`${formId}-amount`}>
										Amount <span className="text-destructive">*</span>
									</Label>
									<div className="relative">
										<DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
										<Input
											id={`${formId}-amount`}
											name="amount"
											type="number"
											inputMode="decimal"
											step="0.01"
											autoComplete="off"
											value={formData.amount}
											onChange={(e) =>
												setFormData({ ...formData, amount: e.target.value })
											}
											placeholder="0.00"
											className={cn(
												"h-11 pl-9 text-base tabular-nums sm:h-9 sm:text-sm",
												formErrors.amount ? "border-destructive" : "",
											)}
										/>
									</div>
									{formErrors.amount && (
										<p className="text-xs text-destructive mt-1">
											{formErrors.amount}
										</p>
									)}
								</div>
								<div>
									<Label htmlFor={`${formId}-depositDate`}>
										Date <span className="text-destructive">*</span>
									</Label>
									<Input
										id={`${formId}-depositDate`}
										name="depositDate"
										type="date"
										value={formData.depositDate}
										onChange={(e) =>
											setFormData({
												...formData,
												depositDate: e.target.value,
											})
										}
										className="h-11 text-base sm:h-9 sm:text-sm"
									/>
								</div>
							</div>
						</div>

						{/* Method Group */}
						<div className="space-y-3 pt-2">
							<Label id={`${formId}-deposit-method-label`}>
								Deposit Method <span className="text-destructive">*</span>
							</Label>
							<fieldset
								className="grid min-w-0 grid-cols-2 gap-2"
								aria-labelledby={`${formId}-deposit-method-label`}
							>
								{(
									["cash", "check", "bank_transfer", "other"] as DepositMethod[]
								).map((method) => (
									<button
										type="button"
										key={method}
										aria-pressed={formData.depositMethod === method}
										onClick={() =>
											setFormData({ ...formData, depositMethod: method })
										}
										className={cn(
											"w-full text-left cursor-pointer rounded-lg border p-3 min-h-11 flex items-center justify-between transition-[background-color,border-color,box-shadow,opacity] duration-150 ease-[ease] active:bg-muted/50 sm:hover:bg-muted/50",
											formData.depositMethod === method
												? "border-primary bg-primary/5 ring-1 ring-primary"
												: "border-input",
										)}
									>
										<span className="text-sm font-medium capitalize">
											{method.replace("_", " ")}
										</span>
										{formData.depositMethod === method && (
											<CheckCircle className="h-4 w-4 text-primary" />
										)}
									</button>
								))}
							</fieldset>

							{formData.depositMethod === "other" && (
								<div className="animate-in fade-in duration-150 motion-instant-reduce">
									<Label
										htmlFor={`${formId}-otherDepositMethod`}
										className="sr-only"
									>
										Other Deposit Method
									</Label>
									<Input
										id={`${formId}-otherDepositMethod`}
										name="otherDepositMethod"
										autoComplete="off"
										placeholder="Specify method…"
										value={formData.otherDepositMethod}
										onChange={(e) =>
											setFormData({
												...formData,
												otherDepositMethod: e.target.value,
											})
										}
										className={cn(
											"h-11 text-base sm:h-9 sm:text-sm",
											formErrors.otherDepositMethod ? "border-destructive" : "",
										)}
									/>
									{formErrors.otherDepositMethod && (
										<p className="text-xs text-destructive mt-1">
											{formErrors.otherDepositMethod}
										</p>
									)}
								</div>
							)}
						</div>

						{/* IEEE Source checkbox */}
						<div className="flex items-center space-x-2 pt-2 min-h-11">
							<Checkbox
								id={`${formId}-isIeee`}
								checked={formData.isIeeeDeposit}
								onCheckedChange={(c) =>
									setFormData({ ...formData, isIeeeDeposit: c === true })
								}
							/>
							<Label htmlFor={`${formId}-isIeee`} className="cursor-pointer">
								This is an IEEE Deposit (Concur)
							</Label>
						</div>

						{formData.isIeeeDeposit && (
							<div className="pl-6 border-l-2 py-1 animate-in fade-in duration-150 motion-instant-reduce">
								<Label htmlFor={`${formId}-ieeeDepositSource`}>
									IEEE Source
								</Label>
								<Select
									value={formData.ieeeDepositSource}
									onValueChange={(v: IeeeDepositSource) =>
										setFormData({ ...formData, ieeeDepositSource: v })
									}
								>
									<SelectTrigger
										id={`${formId}-ieeeDepositSource`}
										className="mt-1 h-11 sm:h-9"
									>
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
					<div className="space-y-4">
						<div>
							<Label htmlFor={`${formId}-purpose`}>
								Purpose <span className="text-destructive">*</span>
							</Label>
							<Input
								id={`${formId}-purpose`}
								name="purpose"
								autoComplete="off"
								value={formData.purpose}
								onChange={(e) =>
									setFormData({ ...formData, purpose: e.target.value })
								}
								placeholder="e.g. Event Revenue, Membership Dues"
								className={cn(
									"h-11 text-base sm:h-9 sm:text-sm",
									formErrors.purpose ? "border-destructive" : "",
								)}
							/>
							{formErrors.purpose && (
								<p className="text-xs text-destructive mt-1">
									{formErrors.purpose}
								</p>
							)}
						</div>

						<div>
							<Label htmlFor={`${formId}-reference`}>
								Reference Number (Optional)
							</Label>
							<Input
								id={`${formId}-reference`}
								name="referenceNumber"
								autoComplete="off"
								spellCheck={false}
								value={formData.referenceNumber}
								onChange={(e) =>
									setFormData({
										...formData,
										referenceNumber: e.target.value,
									})
								}
								placeholder="Check #, Transaction ID"
								className="h-11 text-base sm:h-9 sm:text-sm"
							/>
						</div>

						<div>
							<Label htmlFor={`${formId}-description`}>
								Additional Notes (Optional)
							</Label>
							<Textarea
								id={`${formId}-description`}
								name="description"
								value={formData.description}
								onChange={(e) =>
									setFormData({ ...formData, description: e.target.value })
								}
								placeholder="Any extra details…"
								className="h-32 resize-none text-base sm:text-sm"
							/>
						</div>
					</div>
				)}

				{step === 3 && (
					<div className="space-y-4">
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
									className="h-11 sm:h-9"
									disabled={
										!aiEnabled ||
										isAiParsing ||
										!wizard.isEditable ||
										receiptFiles.length === 0
									}
									onClick={() => {
										if (receiptFiles.length > 0) {
											void parseReceiptWithAI(
												receiptFiles[receiptFiles.length - 1],
											);
										}
									}}
								>
									{isAiParsing && (
										<Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
									)}
									Re-Analyze Latest
								</Button>
							</div>
							<p className="text-xs text-muted-foreground mt-1">
								{aiEnabled
									? "The latest uploaded receipt will auto-fill amount/title when possible."
									: "AI is disabled for this account. Enter details manually after uploading receipts."}
							</p>
							<output aria-live="polite" className="block">
								{isAiParsing && (
									<p className="text-xs mt-2 text-muted-foreground">
										Analyzing receipt…
									</p>
								)}
								{parseState.status === "done" && (
									<p className="text-xs mt-2 text-muted-foreground">
										{parseState.message}
									</p>
								)}
							</output>
						</div>

						<div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2 border">
							<h4 className="font-semibold flex items-center gap-2">
								<FileText className="h-4 w-4" /> Summary
							</h4>
							<div className="grid grid-cols-2 gap-2 text-muted-foreground">
								<span>Amount:</span>
								<span className="font-medium text-foreground text-right tabular-nums">
									{formData.amount
										? formatCurrencyUSD(parseFloat(formData.amount) || 0)
										: "—"}
								</span>

								<span>Method:</span>
								<span className="font-medium text-foreground text-right capitalize">
									{formData.depositMethod === "other"
										? formData.otherDepositMethod
										: formData.depositMethod.replace("_", " ")}
								</span>

								<span>Receipts:</span>
								<span className="font-medium text-foreground text-right tabular-nums">
									{receiptFiles.length} file(s)
								</span>
							</div>
						</div>
					</div>
				)}
			</div>
		</ResponsiveOverlay>
	);
}
