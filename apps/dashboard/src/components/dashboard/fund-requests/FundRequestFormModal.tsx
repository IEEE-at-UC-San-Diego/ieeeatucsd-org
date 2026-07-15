import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
	Check,
	DollarSign,
	FileText,
	Landmark,
	Link as LinkIcon,
	ListChecks,
	Loader2,
	Plus,
	Tags,
	Trash2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { sendNotification } from "@/lib/send-notification";
import {
	CATEGORY_LABELS,
	DEPARTMENT_LABELS,
	type FundRequestCategory,
	type FundRequestDepartment,
	formatCurrency,
} from "@/types/fund-requests";

interface VendorLink {
	id: string;
	url: string;
	itemName?: string;
	quantity?: number;
}

interface FundRequestFormData {
	title: string;
	purpose: string;
	category: FundRequestCategory;
	department: FundRequestDepartment;
	amount: string;
	vendorLinks: VendorLink[];
}

interface FundRequestFormModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: () => void;
	initialData?: Partial<FundRequestFormData> & {
		amount?: string | number;
		_id?: string;
	};
	isEditMode?: boolean;
	showHeader?: boolean;
	renderMode?: "modal" | "page";
	logtoId?: string;
	editRequestId?: string;
	className?: string; // Add className prop
}

const STEPS = [
	{ id: 1, title: "Basic Info" },
	{ id: 2, title: "Budget" },
	{ id: 3, title: "Review" },
];

export function FundRequestFormModal({
	isOpen,
	onClose,
	onSuccess,
	initialData,
	isEditMode = false,
	showHeader = true,
	renderMode = "modal",
	logtoId,
	editRequestId,
	className,
}: FundRequestFormModalProps) {
	const { user: authUser, getAuthHeaders } = useAuth();
	const createFundRequest = useAuthedMutation(api.fundRequests.create);
	const updateFundRequest = useAuthedMutation(api.fundRequests.update);
	const [currentStep, setCurrentStep] = useState(1);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const stepTrackInset = `${100 / (STEPS.length * 2)}%`;
	const stepTrackProgress =
		STEPS.length > 1 ? ((currentStep - 1) / (STEPS.length - 1)) * 100 : 100;

	const titleId = useId();
	const purposeId = useId();
	const departmentId = useId();
	const categoryId = useId();
	const amountId = useId();

	// Form state
	const [title, setTitle] = useState("");
	const [purpose, setPurpose] = useState("");
	const [category, setCategory] = useState<FundRequestCategory>("event");
	const [department, setDepartment] = useState<FundRequestDepartment>("events");
	const [amount, setAmount] = useState("");
	const [vendorLinks, setVendorLinks] = useState<VendorLink[]>([]);

	// Validation state
	const [errors, setErrors] = useState<Record<string, string>>({});

	const resetForm = useCallback(() => {
		setTitle("");
		setPurpose("");
		setCategory("event");
		setDepartment("events");
		setAmount("");
		setVendorLinks([
			{ id: crypto.randomUUID(), url: "", itemName: "", quantity: 1 },
		]);
		setErrors({});
		setCurrentStep(1);
	}, []);

	// Initialize form with existing data
	useEffect(() => {
		if (isOpen) {
			if (initialData) {
				setTitle(initialData.title || "");
				setPurpose(initialData.purpose || "");
				setCategory(initialData.category || "event");
				setDepartment(initialData.department || "events");
				setAmount(initialData.amount ? String(initialData.amount) : "");
				setVendorLinks(initialData.vendorLinks || []);
			} else {
				resetForm();
			}
			setCurrentStep(1);
		}
	}, [isOpen, initialData, resetForm]);

	const validateStep = (step: number): boolean => {
		const newErrors: Record<string, string> = {};

		switch (step) {
			case 1:
				if (!title.trim()) newErrors.title = "Title is required";
				if (!purpose.trim())
					newErrors.purpose = "Purpose/justification is required";
				break;
			case 2:
				if (!amount || parseFloat(amount) <= 0) {
					newErrors.amount = "Valid budget amount is required";
				}
				break;
		}

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleNextStep = () => {
		if (validateStep(currentStep)) {
			setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
		}
	};

	const handlePrevStep = () => {
		setCurrentStep((prev) => Math.max(prev - 1, 1));
	};

	// Initialize with one empty row if list is empty
	useEffect(() => {
		if (isOpen && vendorLinks.length === 0) {
			setVendorLinks([
				{ id: crypto.randomUUID(), url: "", itemName: "", quantity: 1 },
			]);
		}
	}, [isOpen, vendorLinks.length]);

	const addEmptyLink = () => {
		setVendorLinks((prev) => [
			...prev,
			{ id: crypto.randomUUID(), url: "", itemName: "", quantity: 1 },
		]);
	};

	const handleLinkChange = (
		id: string,
		field: "itemName" | "url" | "quantity",
		value: unknown,
	) => {
		setVendorLinks((prev) => {
			const index = prev.findIndex((l) => l.id === id);
			if (index === -1) return prev;

			const updated = [...prev];
			updated[index] = {
				...updated[index],
				[field]:
					field === "quantity" ? Number(value as number) : (value as string),
			};

			return updated;
		});

		if (errors.link || errors[`link_${id}`]) {
			setErrors((prev) => {
				const { link, [`link_${id}`]: _removed, ...rest } = prev;
				void link;
				return rest;
			});
		}
	};

	const handleLinkBlur = (id: string) => {
		setVendorLinks((prev) => {
			const link = prev.find((l) => l.id === id);
			if (!link) return prev;

			if (link.url?.trim() && !isValidUrl(link.url)) {
				setErrors((e) => ({
					...e,
					[`link_${id}`]: "Please enter a valid URL",
				}));
			}
			return prev;
		});
	};

	const handleRemoveLink = (id: string) => {
		setVendorLinks((prev) => {
			if (prev.length <= 1) {
				return [
					{ id: crypto.randomUUID(), url: "", itemName: "", quantity: 1 },
				];
			}
			return prev.filter((link) => link.id !== id);
		});
		setErrors((prev) => {
			const { [`link_${id}`]: removedError, ...rest } = prev;
			void removedError;
			return rest;
		});
	};

	const isValidUrl = (string: string): boolean => {
		try {
			new URL(string);
			return true;
		} catch {
			return false;
		}
	};

	const handleSubmit = async () => {
		if (!validateStep(1) || !validateStep(2)) {
			return;
		}

		if (!logtoId) {
			console.error("Cannot submit: no logtoId");
			return;
		}

		setIsSubmitting(true);

		try {
			const cleanedVendorLinks = vendorLinks.filter(
				(link) => link.url?.trim() || link.itemName?.trim(),
			);

			const parsedAmount = parseFloat(amount) || 0;

			if (isEditMode && editRequestId) {
				await updateFundRequest({
					logtoId,
					id: editRequestId as Id<"fundRequests">,
					title,
					purpose,
					category,
					department,
					amount: parsedAmount,
					vendorLinks:
						cleanedVendorLinks.length > 0 ? cleanedVendorLinks : undefined,
				});
			} else {
				const newId = await createFundRequest({
					logtoId,
					title,
					purpose,
					category,
					department,
					amount: parsedAmount,
					vendorLinks:
						cleanedVendorLinks.length > 0 ? cleanedVendorLinks : undefined,
				});

				// Fire-and-forget email notification
				if (logtoId) {
					sendNotification(getAuthHeaders(), "fund_request_submitted", {
						requestId: newId,
						title,
						amount: parsedAmount,
						category,
						department,
						purpose,
						vendorLinksCount: cleanedVendorLinks.length || undefined,
						submitterName: authUser?.name || "Unknown",
						submitterEmail: authUser?.email || "",
					});
				}
			}

			onSuccess();
			resetForm();
		} catch (error) {
			console.error("Error saving fund request:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const renderStepContent = () => {
		switch (currentStep) {
			case 1:
				return (
					<div className="space-y-4">
						<div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
							<Card className="border-border/60 shadow-sm">
								<CardContent className="space-y-4 p-5">
									<div className="flex items-center gap-2">
										<FileText className="h-4 w-4 text-primary" />
										<h3 className="text-sm font-semibold tracking-wide">
											Request Details
										</h3>
									</div>

									<div className="space-y-2">
										<Label htmlFor={titleId}>
											Title <span className="text-destructive">*</span>
										</Label>
										<Input
											id={titleId}
											placeholder="Enter a descriptive title for your request"
											value={title}
											onChange={(e) => setTitle(e.target.value)}
											maxLength={100}
										/>
										<div className="flex items-center justify-between text-xs text-muted-foreground">
											<span>Use a short, clear request title.</span>
											<span>{title.length}/100</span>
										</div>
										{errors.title && (
											<p className="text-sm text-destructive">{errors.title}</p>
										)}
									</div>

									<div className="space-y-2">
										<Label htmlFor={purposeId}>
											Purpose / Justification{" "}
											<span className="text-destructive">*</span>
										</Label>
										<Textarea
											id={purposeId}
											placeholder="Explain why you need this funding and how it will be used..."
											value={purpose}
											onChange={(e) => setPurpose(e.target.value)}
											rows={7}
										/>
										{errors.purpose && (
											<p className="text-sm text-destructive">
												{errors.purpose}
											</p>
										)}
									</div>
								</CardContent>
							</Card>

							<Card className="border-border/60 shadow-sm">
								<CardContent className="space-y-4 p-5">
									<div className="flex items-center gap-2">
										<Tags className="h-4 w-4 text-primary" />
										<h3 className="text-sm font-semibold tracking-wide">
											Classification
										</h3>
									</div>

									<div className="space-y-2">
										<Label htmlFor={departmentId}>
											Department <span className="text-destructive">*</span>
										</Label>
										<Select
											value={department}
											onValueChange={(v) =>
												setDepartment(v as FundRequestDepartment)
											}
										>
											<SelectTrigger id={departmentId}>
												<SelectValue placeholder="Select Department" />
											</SelectTrigger>
											<SelectContent>
												{Object.entries(DEPARTMENT_LABELS).map(
													([key, label]) => (
														<SelectItem key={key} value={key}>
															{label}
														</SelectItem>
													),
												)}
											</SelectContent>
										</Select>
									</div>

									<div className="space-y-2">
										<Label htmlFor={categoryId}>
											Category <span className="text-destructive">*</span>
										</Label>
										<Select
											value={category}
											onValueChange={(v) =>
												setCategory(v as FundRequestCategory)
											}
										>
											<SelectTrigger id={categoryId}>
												<SelectValue placeholder="Select Category" />
											</SelectTrigger>
											<SelectContent>
												{Object.entries(CATEGORY_LABELS).map(([key, label]) => (
													<SelectItem key={key} value={key}>
														{label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									<div className="rounded-lg border border-dashed bg-muted/20 p-3">
										<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
											Current selection
										</p>
										<div className="flex flex-wrap gap-2">
											<Badge variant="secondary">
												{DEPARTMENT_LABELS[department]}
											</Badge>
											<Badge variant="secondary">
												{CATEGORY_LABELS[category]}
											</Badge>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				);

			case 2:
				return (
					<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
						{/* Left Column: Line Items */}
						<div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
							<Card className="border-border/60 shadow-sm flex-1 flex flex-col overflow-hidden">
								<CardContent className="p-0 flex-1 flex flex-col relative bg-muted/10">
									<div className="px-5 py-4 border-b bg-background flex items-center justify-between sticky top-0 z-10">
										<div className="space-y-1">
											<div className="flex items-center gap-2">
												<ListChecks className="h-4 w-4 text-primary" />
												<h3 className="text-sm font-semibold tracking-wide">
													Purchase Links & Items
												</h3>
											</div>
											<p className="text-xs text-muted-foreground hidden sm:block">
												Add items you intend to purchase.
											</p>
										</div>
										<Button
											size="sm"
											onClick={addEmptyLink}
											variant="secondary"
											className="h-8 shadow-sm"
										>
											<Plus className="w-3.5 h-3.5 mr-1.5" />
											Add Item
										</Button>
									</div>

									<ScrollArea className="flex-1 bg-muted/10">
										<div className="p-4 space-y-3">
											{vendorLinks.map((link) => (
												<div
													key={link.id}
												className="group relative bg-background border border-border/60 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-primary/20 transition-[border-color,box-shadow] duration-150 ease-[ease]"
												>
													<div className="flex flex-col gap-3">
														<div className="flex gap-3 items-start">
															<div className="flex-1 space-y-1.5 min-w-0">
																<Label
																	className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
																	htmlFor={`item-${link.id}`}
																>
																	Item Name
																</Label>
																<Input
																	id={`item-${link.id}`}
																	placeholder="e.g. 500x Arduino Uno Rev3"
																	value={link.itemName || ""}
																	onChange={(e) =>
																		handleLinkChange(
																			link.id,
																			"itemName",
																			e.target.value,
																		)
																	}
																	className="h-9 font-medium bg-transparent border-border/60 focus:bg-background"
																/>
															</div>

															<div className="w-24 space-y-1.5 flex-shrink-0">
																<Label
																	className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
																	htmlFor={`qty-${link.id}`}
																>
																	Qty
																</Label>
																<Input
																	id={`qty-${link.id}`}
																	type="number"
																	min={1}
																	placeholder="1"
																	value={link.quantity ?? 1}
																	onChange={(e) => {
																		const num =
																			parseInt(e.target.value, 10) || 1;
																		handleLinkChange(
																			link.id,
																			"quantity",
																			Math.max(1, num),
																		);
																	}}
																	className="h-9 text-center bg-transparent border-border/60 focus:bg-background"
																/>
															</div>

															<Button
																variant="ghost"
																size="icon"
																onClick={() => handleRemoveLink(link.id)}
																className="h-9 w-9 mt-[22px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
																title="Remove item"
															>
																<Trash2 className="w-4 h-4" />
															</Button>
														</div>

														<div className="space-y-1.5">
															<Label
																className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"
																htmlFor={`url-${link.id}`}
															>
																<LinkIcon className="w-3 h-3" />
																URL / Source
															</Label>
															<Input
																id={`url-${link.id}`}
																placeholder="https://..."
																value={link.url || ""}
																onChange={(e) =>
																	handleLinkChange(
																		link.id,
																		"url",
																		e.target.value,
																	)
																}
																onBlur={() => handleLinkBlur(link.id)}
																className="h-8 text-sm bg-muted/20 border-transparent focus:bg-background focus:border-input focus:shadow-sm"
															/>
															{errors[`link_${link.id}`] && (
																<p className="text-xs text-destructive mt-1">
																	{errors[`link_${link.id}`]}
																</p>
															)}
														</div>
													</div>
												</div>
											))}

											{vendorLinks.length === 0 && (
												<div className="flex flex-col items-center justify-center py-10 text-muted-foreground bg-background/50 border border-dashed rounded-xl">
													<p className="text-sm">No items added yet</p>
													<Button
														variant="link"
														size="sm"
														onClick={addEmptyLink}
														className="text-primary"
													>
														Add your first item
													</Button>
												</div>
											)}
										</div>
									</ScrollArea>
								</CardContent>
							</Card>
						</div>

						{/* Right Column: Budget & Snapshot */}
						<div className="flex flex-col gap-4 min-h-0">
							<Card className="border-border/60 shadow-sm">
								<CardContent className="space-y-5 p-5">
									<div className="flex items-center gap-2">
										<DollarSign className="h-4 w-4 text-primary" />
										<h3 className="text-sm font-semibold tracking-wide">
											Total Budget
										</h3>
									</div>

									<div className="space-y-2">
										<div className="relative">
											<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
												$
											</span>
											<Input
												id={amountId}
												type="text"
												inputMode="decimal"
												placeholder="0.00"
												value={amount}
												onChange={(e) => {
													const sanitized = e.target.value.replace(
														/[^0-9.]/g,
														"",
													);
													const parts = sanitized.split(".");
													if (parts.length > 2) return;
													if (parts[1] && parts[1].length > 2) return;
													setAmount(sanitized);
												}}
												onBlur={() => {
													if (amount) {
														const num = parseFloat(
															amount.replace(/[^0-9.]/g, ""),
														);
														setAmount(num ? num.toFixed(2) : "");
													}
												}}
												className="pl-7 text-lg font-bold h-12"
											/>
										</div>
										{errors.amount && (
											<p className="text-sm text-destructive font-medium">
												{errors.amount}
											</p>
										)}
										<p className="text-xs text-muted-foreground">
											Total requested amount in USD
										</p>
									</div>
								</CardContent>
							</Card>

							<Card className="border-border/60 shadow-sm flex-1">
								<CardContent className="space-y-4 p-5">
									<div className="flex items-center gap-2">
										<Landmark className="h-4 w-4 text-primary" />
										<h3 className="text-sm font-semibold tracking-wide">
											Overview
										</h3>
									</div>
									<div className="space-y-3 text-sm">
										<div className="flex items-center justify-between py-2 border-b border-border/40">
											<span className="text-muted-foreground">Department</span>
											<Badge variant="outline" className="font-normal">
												{DEPARTMENT_LABELS[department]}
											</Badge>
										</div>
										<div className="flex items-center justify-between py-2 border-b border-border/40">
											<span className="text-muted-foreground">Category</span>
											<Badge variant="outline" className="font-normal">
												{CATEGORY_LABELS[category]}
											</Badge>
										</div>
										<div className="flex items-center justify-between py-2">
											<span className="text-muted-foreground">Line Items</span>
											<span className="font-mono font-medium">
												{
													vendorLinks.filter(
														(l) => l.url?.trim() || l.itemName?.trim(),
													).length
												}
											</span>
										</div>
									</div>

									<div className="pt-2">
										<div className="rounded-lg bg-primary/5 p-3 border border-primary/10">
											<p className="text-xs text-primary/80 font-medium mb-1">
												Estimated Total
											</p>
											<p className="text-xl font-bold text-primary">
												{formatCurrency(parseFloat(amount) || 0)}
											</p>
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				);

			case 3: {
				const cleanedLinks = vendorLinks.filter(
					(l) => l.url?.trim() || l.itemName?.trim(),
				);

				return (
					<div className="space-y-4">
						<Card className="border-border/60 shadow-sm">
							<CardContent className="p-5 space-y-4">
								<div className="flex flex-wrap items-start justify-between gap-4">
									<div className="space-y-1">
										<h4 className="text-xl font-semibold">
											{title || "Untitled request"}
										</h4>
										<div className="flex flex-wrap gap-2">
											<Badge variant="secondary">
												{DEPARTMENT_LABELS[department]}
											</Badge>
											<Badge variant="secondary">
												{CATEGORY_LABELS[category]}
											</Badge>
										</div>
									</div>
									<p className="text-2xl font-bold text-green-600">
										{formatCurrency(parseFloat(amount) || 0)}
									</p>
								</div>

								<div className="border-t pt-4 space-y-2">
									<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
										Purpose
									</span>
									<p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
										{purpose}
									</p>
								</div>

								<div className="rounded-lg border bg-muted/20 p-3">
									<div className="flex items-center gap-2 mb-2">
										<LinkIcon className="w-4 h-4 text-primary" />
										<span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
											Items / Links ({cleanedLinks.length})
										</span>
									</div>
									{cleanedLinks.length === 0 ? (
										<p className="text-sm text-muted-foreground">
											No line items added.
										</p>
									) : (
										<div className="space-y-2">
											{cleanedLinks.map((link) => (
												<div
													key={link.id}
													className="flex items-start justify-between gap-3 rounded-md bg-background p-2"
												>
													<div className="min-w-0">
														<p className="text-sm font-medium truncate">
															{link.itemName || "Untitled item"}
														</p>
														<p className="text-xs text-muted-foreground truncate">
															{link.url || "No URL provided"}
														</p>
													</div>
													<Badge variant="outline">
														Qty {link.quantity || 1}
													</Badge>
												</div>
											))}
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</div>
				);
			}

			default:
				return null;
		}
	};

	if (!isOpen) return null;

	const formContent = (
		<Card
			className={`border-0 shadow-none overflow-hidden flex flex-col h-full w-full bg-transparent ${className || ""}`}
		>
			{showHeader && (
				<div className="border-b bg-muted/10 px-4 py-3 flex-shrink-0 flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold tracking-tight">
							{isEditMode ? "Edit Fund Request" : "New Fund Request"}
						</h2>
						<p className="text-xs text-muted-foreground">
							Complete each step to submit a clear, review-ready request.
						</p>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
					>
						<X className="w-4 h-4" />
					</Button>
				</div>
			)}

			{/* Stepper */}
			<div className="px-4 pt-3 pb-1 bg-background/50 backdrop-blur-sm z-10 w-full max-w-3xl mx-auto">
				<div className="relative">
					<div
						className="absolute top-4 h-0.5 bg-muted"
						style={{ left: stepTrackInset, right: stepTrackInset }}
					/>
					<div
						className="absolute top-4 h-0.5 overflow-hidden"
						style={{
							left: stepTrackInset,
							right: stepTrackInset,
						}}
					>
						<div
							className="h-full w-full origin-left bg-primary transition-transform duration-200 ease-[var(--ease-in-out)] motion-instant-reduce"
							style={{ transform: `scaleX(${stepTrackProgress / 100})` }}
						/>
					</div>

					<div
						className="relative grid gap-3"
						style={{
							gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))`,
						}}
					>
						{STEPS.map((step) => {
							const isCompleted = currentStep > step.id;
							const isCurrent = currentStep === step.id;

							return (
								<div key={step.id} className="flex flex-col items-center">
									<div
										className={`
	                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 ease-[ease] border-2 relative z-10
                      ${isCompleted || isCurrent ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-muted bg-background text-muted-foreground"}
                    `}
									>
										{isCompleted ? <Check className="w-4 h-4" /> : step.id}
									</div>
									<span
										className={`hidden sm:block text-xs font-semibold mt-2 ${isCurrent ? "text-primary" : "text-muted-foreground"}`}
									>
										{step.title}
									</span>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			<ScrollArea className="flex-1 min-h-0 bg-muted/5">
				<div className="py-4 px-4 h-full max-w-[1800px] mx-auto w-full">
					{renderStepContent()}
				</div>
			</ScrollArea>

			<div className="flex-col sm:flex-row sm:justify-between sm:items-center gap-3 px-4 py-3 border-t bg-background flex flex-shrink-0 z-20 shadow-[0_-5px_10px_rgba(0,0,0,0.02)]">
				<Button
					type="button"
					variant="ghost"
					onClick={onClose}
					disabled={isSubmitting}
					className="w-full sm:w-auto text-muted-foreground hover:bg-muted"
				>
					Cancel
				</Button>

				<div className="flex gap-2 w-full sm:w-auto">
					{currentStep > 1 && (
						<Button
							type="button"
							variant="outline"
							onClick={handlePrevStep}
							disabled={isSubmitting}
							className="flex-1 sm:flex-none"
						>
							Back
						</Button>
					)}

					{currentStep < STEPS.length ? (
						<Button
							type="button"
							onClick={handleNextStep}
							className="flex-1 sm:flex-none"
						>
							Next Step
						</Button>
					) : (
						<Button
							type="button"
							onClick={handleSubmit}
							disabled={isSubmitting}
							className="flex-1 sm:flex-none"
						>
							{isSubmitting && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							{isEditMode ? "Update Request" : "Submit Request"}
						</Button>
					)}
				</div>
			</div>
		</Card>
	);

	if (renderMode === "page") {
		return formContent;
	}

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				if (!open && !isSubmitting) {
					onClose();
				}
			}}
		>
			<DialogContent
				showCloseButton={false}
				className="max-w-6xl h-[min(92vh,960px)] overflow-hidden p-0 gap-0"
			>
				{formContent}
			</DialogContent>
		</Dialog>
	);
}
