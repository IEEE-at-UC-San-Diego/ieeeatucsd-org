import { useState, useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DisclaimerSection } from "../wizard/DisclaimerSection";
import { BasicInfoSection } from "../wizard/BasicInfoSection";
import { LogisticsSection } from "../wizard/LogisticsSection";
import { MarketingSection } from "../wizard/MarketingSection";
import { FundingSection } from "../wizard/FundingSection";
import { EventReviewSection } from "../wizard/EventReviewSection";
import type { EventRequest, EventFormData } from "../types";
import { normalizeDepartment, normalizeEventType } from "../constants";

interface EventRequestWizardModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: EventFormData) => void;
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
	const [disclaimerAccepted, setDisclaimerAccepted] = useState(isEditing);
	const [formData, setFormData] = useState<EventFormData>(
		buildFormDataFromInitial(initialData),
	);

	// Sync form data when initialData changes (e.g., opening edit for a different event)
	useEffect(() => {
		if (isOpen) {
			setFormData(buildFormDataFromInitial(initialData));
			setCurrentStep(initialData ? 2 : 1);
			setDisclaimerAccepted(!!initialData);
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
			setCurrentStep((prev) => prev + 1);
		}
	};

	const handleBack = () => {
		if (currentStep > 1) {
			setCurrentStep((prev) => prev - 1);
		}
	};

	const handleSubmit = () => {
		onSubmit(formData);
		onClose();
		setCurrentStep(1);
		setDisclaimerAccepted(false);
		setFormData(defaultFormData);
	};

	const renderStepContent = () => {
		switch (currentStep) {
			case 1:
				return (
					<DisclaimerSection
						checked={disclaimerAccepted}
						onCheckedChange={setDisclaimerAccepted}
					/>
				);
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
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-2xl overflow-hidden">
				<form
					onSubmit={(e) => e.preventDefault()}
					className="flex max-h-[90vh] min-h-0 flex-col"
				>
					<DialogHeader className="shrink-0">
						<DialogTitle>
							{isConvertingDraft
								? "Convert Draft to Event Request"
								: isEditing
									? "Edit Event Request"
									: "Create Event Request"}
						</DialogTitle>
					</DialogHeader>

					<div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
						<div className="space-y-6">
							<div className="space-y-2">
								<div className="flex items-center justify-between text-sm">
									<span className="font-medium text-gray-900">
										Step {currentStep} of {steps.length}
									</span>
									<span className="text-gray-500">
										{steps[currentStep - 1].title}
									</span>
								</div>
								<Progress value={progress} className="h-2" />
								<div className="flex justify-between text-xs text-gray-400">
									{steps.map((step) => (
										<span
											key={step.id}
											className={
												step.id === currentStep
													? "text-blue-600 font-medium"
													: step.id < currentStep
														? "text-green-600"
														: ""
											}
										>
											{step.id}
										</span>
									))}
								</div>
							</div>

							<div className="min-h-[300px]">{renderStepContent()}</div>
						</div>
					</div>

					<DialogFooter className="mt-6 flex shrink-0 justify-between">
						<div>
							{currentStep > 1 && (
								<Button type="button" variant="outline" onClick={handleBack}>
									Back
								</Button>
							)}
						</div>
						<div className="flex gap-2">
							<Button type="button" variant="outline" onClick={onClose}>
								Cancel
							</Button>
							{currentStep < steps.length ? (
								<Button
									type="button"
									onClick={handleNext}
									disabled={!canProceed()}
								>
									Next
								</Button>
							) : (
								<Button type="button" onClick={handleSubmit}>
									<CheckCircle className="h-4 w-4 mr-2" />
									{isConvertingDraft
										? "Submit Request"
										: isEditing
											? "Update Request"
											: "Submit Request"}
								</Button>
							)}
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
