import { api } from "@convex/_generated/api";
import { CheckCircle, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useAuthedMutation } from "@/hooks/useAuthedConvex";
import { normalizeDepartment, normalizeEventType } from "../constants";
import type { EventFormData, EventRequest } from "../types";
import { BasicInfoSection } from "../wizard/BasicInfoSection";
import { DisclaimerSection } from "../wizard/DisclaimerSection";
import { EventReviewSection } from "../wizard/EventReviewSection";
import { FundingSection } from "../wizard/FundingSection";
import { LogisticsSection } from "../wizard/LogisticsSection";
import { MarketingSection } from "../wizard/MarketingSection";

interface EventRequestWizardModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: EventFormData) => void | Promise<void>;
	initialData?: Partial<EventRequest>;
	aiEnabled?: boolean;
}

const steps = [
	{ id: 1, title: "Disclaimer", description: "Important information" },
	{ id: 2, title: "Basic Info", description: "Event details" },
	{ id: 3, title: "Logistics", description: "Location & time" },
	{ id: 4, title: "Marketing", description: "Materials & attendance" },
	{ id: 5, title: "Funding", description: "Budget & invoices" },
	{ id: 6, title: "Review", description: "Final check" },
];

const defaultFormData: EventFormData = {
	eventName: "",
	eventDescription: "",
	eventType: "",
	department: undefined,
	location: "",
	startDate: Date.now(),
	endDate: Date.now() + 3600000,
	eventCode: "",
	hasFood: false,
	needsFlyers: false,
	needsGraphics: false,
	needsASFunding: false,
	estimatedAttendance: 0,
	files: [],
	invoices: [],
	willOrHaveRoomBooking: false,
	roomBookingFiles: [],
	foodDrinksBeingServed: false,
	asFundingRequired: false,
	flyerType: [],
	otherFlyerType: "",
	flyerAdvertisingStartDate: 0,
	flyerAdditionalRequests: "",
	photographyNeeded: false,
	requiredLogos: [],
	otherLogos: [],
	advertisingFormat: "",
	additionalSpecifications: "",
	flyersCompleted: false,
	graphicsUploadNote: "",
};

function buildFormDataFromInitial(
	initialData?: Partial<EventRequest>,
): EventFormData {
	if (!initialData) return { ...defaultFormData };
	return {
		eventName: initialData.eventName || defaultFormData.eventName,
		eventDescription:
			initialData.eventDescription || defaultFormData.eventDescription,
		eventType: initialData.eventType
			? normalizeEventType(initialData.eventType)
			: defaultFormData.eventType,
		department: normalizeDepartment(initialData.department),
		location: initialData.location || defaultFormData.location,
		startDate: initialData.startDate || Date.now(),
		endDate: initialData.endDate || Date.now() + 3600000,
		eventCode: initialData.eventCode || defaultFormData.eventCode,
		hasFood:
			initialData.hasFood ??
			initialData.foodDrinksBeingServed ??
			defaultFormData.hasFood,
		needsFlyers: initialData.needsFlyers ?? defaultFormData.needsFlyers,
		needsGraphics: initialData.needsGraphics ?? defaultFormData.needsGraphics,
		needsASFunding:
			initialData.needsASFunding ?? defaultFormData.needsASFunding,
		estimatedAttendance:
			initialData.estimatedAttendance ?? defaultFormData.estimatedAttendance,
		files: initialData.files || [],
		invoices: initialData.invoices || [],
		willOrHaveRoomBooking:
			initialData.willOrHaveRoomBooking ??
			defaultFormData.willOrHaveRoomBooking,
		roomBookingFiles: initialData.roomBookingFiles || [],
		foodDrinksBeingServed:
			initialData.foodDrinksBeingServed ??
			initialData.hasFood ??
			defaultFormData.foodDrinksBeingServed,
		asFundingRequired:
			initialData.asFundingRequired ??
			initialData.needsASFunding ??
			defaultFormData.asFundingRequired,
		flyerType: initialData.flyerType || [],
		otherFlyerType: initialData.otherFlyerType || "",
		flyerAdvertisingStartDate: initialData.flyerAdvertisingStartDate || 0,
		flyerAdditionalRequests: initialData.flyerAdditionalRequests || "",
		photographyNeeded:
			initialData.photographyNeeded ?? defaultFormData.photographyNeeded,
		requiredLogos: initialData.requiredLogos || [],
		otherLogos: initialData.otherLogos || [],
		advertisingFormat: initialData.advertisingFormat || "",
		additionalSpecifications: initialData.additionalSpecifications || "",
		flyersCompleted:
			initialData.flyersCompleted ?? defaultFormData.flyersCompleted,
		graphicsUploadNote:
			initialData.graphicsUploadNote || defaultFormData.graphicsUploadNote,
	};
}

export function EventRequestWizardModal({
	isOpen,
	onClose,
	onSubmit,
	initialData,
	aiEnabled = true,
}: EventRequestWizardModalProps) {
	const isEditing = !!initialData;
	const isConvertingDraft = initialData?.status === "draft";
	const generateUploadUrl = useAuthedMutation(api.events.generateUploadUrl);
	const [currentStep, setCurrentStep] = useState(isEditing ? 2 : 1);
	const [direction, setDirection] = useState<"forward" | "back">("forward");
	const [disclaimerAccepted, setDisclaimerAccepted] = useState(isEditing);
	const [formData, setFormData] = useState<EventFormData>(
		buildFormDataFromInitial(initialData),
	);
	const [showDiscardDialog, setShowDiscardDialog] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [submissionSucceeded, setSubmissionSucceeded] = useState(false);
	const openerRef = useRef<HTMLElement | null>(null);
	const initialSnapshotRef = useRef(JSON.stringify(formData));

	// Sync form data when initialData changes (e.g., opening edit for a different event)
	useEffect(() => {
		if (isOpen) {
			const nextFormData = buildFormDataFromInitial(initialData);
			openerRef.current = document.activeElement as HTMLElement | null;
			setFormData(nextFormData);
			initialSnapshotRef.current = JSON.stringify(nextFormData);
			setCurrentStep(initialData ? 2 : 1);
			setDirection("forward");
			setDisclaimerAccepted(!!initialData);
			setIsSubmitting(false);
			setSubmitError(null);
			setSubmissionSucceeded(false);
		}
	}, [isOpen, initialData]);

	const progress = ((currentStep - 1) / (steps.length - 1)) * 100;

	const updateFormData = (data: Partial<EventFormData>) => {
		setFormData((prev) => ({ ...prev, ...data }));
	};

	const canProceed = () => {
		switch (currentStep) {
			case 1:
				return disclaimerAccepted;
			case 2:
				return (
					formData.eventName.trim() &&
					formData.eventDescription.trim() &&
					formData.eventType
				);
			case 3:
				return (
					formData.location.trim() &&
					formData.startDate &&
					formData.endDate &&
					formData.endDate > formData.startDate &&
					formData.eventCode.trim()
				);
			default:
				return true;
		}
	};

	const handleNext = () => {
		if (currentStep < steps.length) {
			setDirection("forward");
			setCurrentStep((prev) => prev + 1);
		}
	};

	const handleBack = () => {
		if (currentStep > 1) {
			setDirection("back");
			setCurrentStep((prev) => prev - 1);
		}
	};

	const resetAndClose = () => {
		onClose();
		setCurrentStep(1);
		setDirection("forward");
		setDisclaimerAccepted(false);
		setFormData({ ...defaultFormData });
		setShowDiscardDialog(false);
	};

	const isDirty =
		JSON.stringify(formData) !== initialSnapshotRef.current ||
		(!isEditing && disclaimerAccepted);

	const requestClose = () => {
		if (isSubmitting) return;
		if (isDirty && !submissionSucceeded) {
			setShowDiscardDialog(true);
			return;
		}
		resetAndClose();
	};

	const handleSubmit = async () => {
		setIsSubmitting(true);
		setSubmitError(null);
		try {
			await onSubmit(formData);
			setSubmissionSucceeded(true);
			window.setTimeout(resetAndClose, 700);
		} catch (error) {
			setSubmitError(
				error instanceof Error
					? error.message
					: "The request could not be saved. Please try again.",
			);
			setIsSubmitting(false);
		}
	};

	const blockedMessage = (() => {
		if (currentStep === 1 && !disclaimerAccepted)
			return "Accept the requirements to continue.";
		if (currentStep === 2 && !canProceed())
			return "Add the event name, description, and type to continue.";
		if (currentStep === 3 && !canProceed())
			return "Add a location, valid time range, and event code to continue.";
		return null;
	})();

	const renderStepContent = () => {
		switch (currentStep) {
			case 1:
				return <DisclaimerSection />;
			case 2:
				return (
					<BasicInfoSection
						data={{
							eventName: formData.eventName,
							eventDescription: formData.eventDescription,
							eventType: formData.eventType,
							department: formData.department,
						}}
						onChange={(data) => updateFormData(data as Partial<EventFormData>)}
					/>
				);
			case 3:
				return (
					<LogisticsSection
						data={{
							location: formData.location,
							startDate: formData.startDate,
							endDate: formData.endDate,
							eventCode: formData.eventCode,
							hasFood: formData.hasFood,
							willOrHaveRoomBooking: formData.willOrHaveRoomBooking,
							roomBookingFiles: formData.roomBookingFiles,
							foodDrinksBeingServed: formData.foodDrinksBeingServed,
						}}
						onChange={(data) => updateFormData(data)}
						onUploadRoomBooking={async (files) => {
							const urls: string[] = [];
							for (const file of files) {
								try {
									const uploadUrl = await generateUploadUrl({});
									const res = await fetch(uploadUrl, {
										method: "POST",
										headers: { "Content-Type": file.type },
										body: file,
									});
									if (res.ok) {
										const { storageId } = await res.json();
										urls.push(storageId);
									}
								} catch (err) {
									console.error("Failed to upload room booking file:", err);
								}
							}
							if (urls.length > 0) {
								updateFormData({
									roomBookingFiles: [...formData.roomBookingFiles, ...urls],
								});
							}
						}}
					/>
				);
			case 4:
				return (
					<MarketingSection
						data={{
							needsFlyers: formData.needsFlyers,
							needsGraphics: formData.needsGraphics,
							estimatedAttendance: formData.estimatedAttendance,
							flyerType: formData.flyerType,
							otherFlyerType: formData.otherFlyerType,
							flyerAdvertisingStartDate: formData.flyerAdvertisingStartDate,
							flyerAdditionalRequests: formData.flyerAdditionalRequests,
							photographyNeeded: formData.photographyNeeded,
							requiredLogos: formData.requiredLogos,
							otherLogos: formData.otherLogos,
							advertisingFormat: formData.advertisingFormat,
							additionalSpecifications: formData.additionalSpecifications,
							graphicsUploadNote: formData.graphicsUploadNote,
						}}
						onChange={(data) => updateFormData(data)}
					/>
				);
			case 5:
				return (
					<FundingSection
						data={{
							needsASFunding: formData.needsASFunding,
							asFundingRequired: formData.asFundingRequired,
							invoices: formData.invoices,
						}}
						onChange={(data) => updateFormData(data)}
						generateUploadUrl={async () => {
							return await generateUploadUrl({});
						}}
						aiEnabled={aiEnabled}
					/>
				);
			case 6:
				return (
					<EventReviewSection data={formData} originalData={initialData} />
				);
			default:
				return null;
		}
	};

	return (
		<>
			<Dialog open={isOpen} onOpenChange={(open) => !open && requestClose()}>
				<DialogContent
					className="flex h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[min(720px,calc(100vh-48px))] sm:w-[min(960px,calc(100vw-48px))] sm:max-w-none sm:rounded-md sm:border"
					showCloseButton={!isSubmitting}
					onOpenAutoFocus={() => {
						const activeElement = document.activeElement as HTMLElement | null;
						if (activeElement && !activeElement.closest('[role="dialog"]')) {
							openerRef.current = activeElement;
						}
					}}
					onCloseAutoFocus={(event) => {
						event.preventDefault();
						openerRef.current?.focus();
					}}
				>
					<form
						onSubmit={(e) => e.preventDefault()}
						className="flex min-h-0 flex-1 flex-col"
					>
						<DialogHeader className="shrink-0 border-b px-5 py-4 pr-14 sm:px-6">
							<DialogTitle>
								{isConvertingDraft
									? "Convert Draft to Event Request"
									: isEditing
										? "Edit Event Request"
										: "Create Event Request"}
							</DialogTitle>
							<p className="text-sm text-muted-foreground">
								Step {currentStep} of {steps.length}:{" "}
								{steps[currentStep - 1].title}
							</p>
						</DialogHeader>

						<div className="shrink-0 border-b bg-muted/20 px-5 py-3 sm:px-6">
							<Progress value={progress} className="h-1" />
							<ol
								className="mt-3 hidden grid-cols-6 gap-2 sm:grid"
								aria-label="Event request steps"
							>
								{steps.map((step) => (
									<li
										key={step.id}
										aria-current={step.id === currentStep ? "step" : undefined}
									>
										<span
											className={`block text-xs font-medium ${step.id === currentStep ? "text-foreground" : step.id < currentStep ? "text-ds-green-700" : "text-muted-foreground"}`}
										>
											{step.title}
										</span>
									</li>
								))}
							</ol>
							<p className="mt-2 text-xs text-muted-foreground sm:hidden">
								{currentStep < steps.length
									? `Next: ${steps[currentStep].title}`
									: "Final review"}
							</p>
						</div>

						<div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
							<div className="mx-auto max-w-3xl">
								{submissionSucceeded ? (
									<div className="flex min-h-80 flex-col items-center justify-center text-center success-reveal">
										<CheckCircle className="size-10 text-ds-green-700" />
										<h2 className="mt-3 text-lg font-semibold">
											Request saved
										</h2>
										<p className="mt-1 text-sm text-muted-foreground">
											Your event request was submitted successfully.
										</p>
									</div>
								) : (
									<div
										key={`${currentStep}-${direction}`}
										className="min-h-[300px] animate-in fade-in duration-150 ease-[var(--ease-out)] motion-instant-reduce"
									>
										{renderStepContent()}
									</div>
								)}
							</div>
						</div>

						{currentStep === 1 && !submissionSucceeded && (
							<div className="shrink-0 border-t bg-background px-5 py-3 sm:px-6">
								<label
									htmlFor="event-requirements"
									className="mx-auto flex max-w-3xl cursor-pointer items-start gap-3 text-sm leading-5"
								>
									<Checkbox
										id="event-requirements"
										checked={disclaimerAccepted}
										onCheckedChange={(value) =>
											setDisclaimerAccepted(value === true)
										}
										className="mt-0.5"
									/>
									<span>
										I have read the requirements and agree to follow the event,
										funding, and safety policies.
									</span>
								</label>
							</div>
						)}

						<DialogFooter className="flex shrink-0 items-center justify-between border-t bg-background px-5 py-3 shadow-[0_-8px_16px_-16px_rgba(0,0,0,0.35)] sm:px-6">
							<div>
								{currentStep > 1 && !submissionSucceeded && (
									<Button type="button" variant="outline" onClick={handleBack}>
										Back
									</Button>
								)}
							</div>
							<div className="flex flex-1 items-center justify-end gap-2">
								{(blockedMessage || submitError) && !submissionSucceeded && (
									<p
										className={`mr-auto hidden text-xs sm:block ${submitError ? "text-destructive" : "text-muted-foreground"}`}
										role={submitError ? "alert" : undefined}
									>
										{submitError || blockedMessage}
									</p>
								)}
								{!submissionSucceeded && (
									<Button
										type="button"
										variant="outline"
										onClick={requestClose}
										disabled={isSubmitting}
									>
										Cancel
									</Button>
								)}
								{!submissionSucceeded && currentStep < steps.length ? (
									<Button
										type="button"
										onClick={handleNext}
										disabled={!canProceed()}
									>
										Next
									</Button>
								) : !submissionSucceeded ? (
									<Button
										type="button"
										onClick={handleSubmit}
										disabled={isSubmitting}
									>
										{isSubmitting ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<CheckCircle className="h-4 w-4" />
										)}
										{isConvertingDraft
											? "Submit Request"
											: isEditing
												? "Update Request"
												: "Submit Request"}
									</Button>
								) : null}
							</div>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
			<AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard this event request?</AlertDialogTitle>
						<AlertDialogDescription>
							Your changes have not been saved. This action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep editing</AlertDialogCancel>
						<AlertDialogAction variant="destructive" onClick={resetAndClose}>
							Discard changes
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
