import { api } from "@convex/_generated/api";
import { CheckCircle, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { MobileTaskStepper, ResponsiveOverlay } from "@/components/mobile";
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
import { Progress } from "@/components/ui/progress";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthedMutation } from "@/hooks/useAuthedConvex";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { EventRequestMapping } from "../EventRequestMapping";
import { uploadOwnedStorageFile } from "../graphicsUpload";
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
	onSave?: (data: EventFormData) => void | Promise<void>;
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

const defaultFormData = EventRequestMapping.defaultFormData;

export function EventRequestWizardModal({
	isOpen,
	onClose,
	onSubmit,
	onSave,
	initialData,
	aiEnabled = true,
}: EventRequestWizardModalProps) {
	const formId = useId();
	const isEditing = !!initialData;
	const isConvertingDraft = initialData?.status === "draft";
	const isMobile = useIsMobile();
	const generateUploadUrl = useAuthedMutation(api.events.generateUploadUrl);
	const beginStorageUpload = useAuthedMutation(api.events.beginStorageUpload);
	const claimStorageUpload = useAuthedMutation(api.events.claimStorageUpload);
	const uploadStorageFile = (file: File) =>
		uploadOwnedStorageFile(file, {
			beginStorageUpload,
			generateUploadUrl: () => generateUploadUrl({}),
			claimStorageUpload,
		});
	const [currentStep, setCurrentStep] = useState(isEditing ? 2 : 1);
	const [disclaimerAccepted, setDisclaimerAccepted] = useState(isEditing);
	const [formData, setFormData] = useState<EventFormData>(
		EventRequestMapping.toFormData(initialData),
	);
	const [showDiscardDialog, setShowDiscardDialog] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [submissionSucceeded, setSubmissionSucceeded] = useState(false);
	const initialSnapshotRef = useRef(JSON.stringify(formData));

	// Sync form data when initialData changes (e.g., opening edit for a different event)
	useEffect(() => {
		if (isOpen) {
			const nextFormData = EventRequestMapping.toFormData(initialData);
			setFormData(nextFormData);
			initialSnapshotRef.current = JSON.stringify(nextFormData);
			setCurrentStep(initialData ? 2 : 1);
			setDisclaimerAccepted(!!initialData);
			setIsSubmitting(false);
			setIsSaving(false);
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

	const canSave = () =>
		!!formData.eventName.trim() &&
		!!formData.eventDescription.trim() &&
		!!formData.eventType &&
		!!formData.location.trim() &&
		formData.endDate > formData.startDate;

	const handleNext = () => {
		if (currentStep < steps.length) {
			setCurrentStep((prev) => prev + 1);
		}
	};

	const handleBack = () => {
		if (currentStep > 1) {
			setCurrentStep((prev) => prev - 1);
		}
	};

	const resetAndClose = () => {
		onClose();
		setCurrentStep(1);
		setDisclaimerAccepted(false);
		setFormData({ ...defaultFormData });
		setShowDiscardDialog(false);
	};

	const isDirty =
		JSON.stringify(formData) !== initialSnapshotRef.current ||
		(!isEditing && disclaimerAccepted);

	useUnsavedChangesGuard(isOpen && isDirty && !submissionSucceeded);

	const requestClose = () => {
		if (isSubmitting || isSaving) return;
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
					: "The request couldn’t be submitted. Check your connection and try again.",
			);
			setIsSubmitting(false);
		}
	};

	const handleSave = async () => {
		if (!onSave) return;
		setIsSaving(true);
		setSubmitError(null);
		try {
			await onSave(formData);
			initialSnapshotRef.current = JSON.stringify(formData);
		} catch (error) {
			setSubmitError(
				error instanceof Error
					? error.message
					: "The request couldn’t be saved. Check your connection and try again.",
			);
		} finally {
			setIsSaving(false);
		}
	};

	const blockedMessage = (() => {
		if (currentStep === 1 && !disclaimerAccepted)
			return "Accept the requirements to continue.";
		if (currentStep === 2 && !canProceed())
			return "Add the event name, description, and type to continue.";
		if (currentStep === 3 && !canProceed())
			return "Add a location, valid time range, and event code to continue.";
		if (onSave && currentStep >= 2 && !canSave())
			return "Add the event name, description, type, location, and valid time range to save.";
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
							pointsToReward: formData.pointsToReward,
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
									urls.push(await uploadStorageFile(file));
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
						uploadStorageFile={uploadStorageFile}
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

	const footer = submissionSucceeded ? undefined : (
		<div className="flex w-full items-center justify-between gap-2">
			<div>
				{currentStep > 1 && (
					<Button
						type="button"
						variant="outline"
						className="h-11 sm:h-9"
						onClick={handleBack}
					>
						Back
					</Button>
				)}
			</div>
			<div className="flex flex-1 flex-wrap items-center justify-end gap-2">
				{(blockedMessage || submitError) && (
					<p
						className={`mr-auto text-xs ${submitError ? "block text-destructive" : "hidden text-muted-foreground sm:block"}`}
						role={submitError ? "alert" : "status"}
						aria-live="polite"
					>
						{submitError || blockedMessage}
					</p>
				)}
				<Button
					type="button"
					variant="outline"
					className="h-11 sm:h-9"
					onClick={requestClose}
					disabled={isSubmitting || isSaving}
				>
					Cancel
				</Button>
				{onSave && currentStep >= 2 && (
					<Button
						type="button"
						variant="outline"
						className="h-11 sm:h-9"
						onClick={handleSave}
						disabled={isSubmitting || isSaving || !canSave()}
					>
						{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
						{isSaving ? "Saving…" : "Save"}
					</Button>
				)}
				{currentStep < steps.length ? (
					<Button
						type="button"
						className="h-11 sm:h-9"
						onClick={handleNext}
						disabled={!canProceed() || isSaving}
					>
						Next
					</Button>
				) : (
					<Button
						type="button"
						className="h-11 sm:h-9"
						onClick={handleSubmit}
						disabled={isSubmitting || isSaving}
					>
						{isSubmitting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<CheckCircle className="h-4 w-4" />
						)}
						{isSubmitting
							? "Submitting…"
							: isConvertingDraft
								? "Submit Request"
								: isEditing
									? "Update Request"
									: "Submit Request"}
					</Button>
				)}
			</div>
		</div>
	);

	return (
		<>
			<ResponsiveOverlay
				open={isOpen}
				onOpenChange={(open) => !open && requestClose()}
				title={
					isConvertingDraft
						? "Convert Draft to Event Request"
						: isEditing
							? "Edit Event Request"
							: "Create Event Request"
				}
				description={
					isMobile
						? undefined
						: `Step ${currentStep} of ${steps.length}: ${steps[currentStep - 1].title}`
				}
				variant="fullscreen"
				className="sm:h-[min(720px,calc(100vh-48px))] sm:w-[min(960px,calc(100vw-48px))] sm:max-w-none"
				footer={footer}
			>
				<form
					onSubmit={(e) => e.preventDefault()}
					className="mx-auto max-w-3xl"
				>
					{isMobile ? (
						<MobileTaskStepper
							currentStep={currentStep}
							totalSteps={steps.length}
							stepTitle={steps[currentStep - 1].title}
							className="mb-4"
						/>
					) : (
						<div className="mb-4">
							<Progress value={progress} className="h-1" />
							<ol
								className="mt-3 grid grid-cols-6 gap-2"
								aria-label="Event request steps"
							>
								{steps.map((step) => (
									<li
										key={step.id}
										aria-current={step.id === currentStep ? "step" : undefined}
									>
										<span
											className={`block text-xs font-medium ${step.id === currentStep ? "text-foreground" : step.id < currentStep ? "text-tone-success" : "text-muted-foreground"}`}
										>
											{step.title}
										</span>
									</li>
								))}
							</ol>
						</div>
					)}

					{submissionSucceeded ? (
						<output className="flex min-h-80 flex-col items-center justify-center text-center success-reveal">
							<CheckCircle className="size-10 text-tone-success" />
							<h2 className="mt-3 text-lg font-semibold text-balance">
								Request Saved
							</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								Your event request was submitted successfully.
							</p>
						</output>
					) : (
						<div className="min-h-[300px]">{renderStepContent()}</div>
					)}

					{currentStep === 1 && !submissionSucceeded && (
						<div className="mt-4 border-t pt-4">
							<label
								htmlFor={`${formId}-event-requirements`}
								className="flex cursor-pointer items-start gap-3 text-sm leading-5"
							>
								<Checkbox
									id={`${formId}-event-requirements`}
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
				</form>
			</ResponsiveOverlay>
			<AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
				<AlertDialogContent className="sm:max-w-md">
					<AlertDialogHeader>
						<AlertDialogTitle>Discard This Event Request?</AlertDialogTitle>
						<AlertDialogDescription>
							Your changes haven’t been saved. This can’t be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="gap-2 sm:gap-2">
						<AlertDialogCancel className="h-11 sm:h-9">
							Keep Editing
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							className="h-11 sm:h-9"
							onClick={resetAndClose}
						>
							Discard Changes
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
