import type { EventFormData } from "../types";

export interface EventRequestWizardInput {
	formData: EventFormData;
	disclaimerAccepted: boolean;
}

export function canProceedFromStep(
	step: number,
	{ formData, disclaimerAccepted }: EventRequestWizardInput,
): boolean {
	switch (step) {
		case 1:
			return disclaimerAccepted;
		case 2:
			return Boolean(
				formData.eventName.trim() &&
					formData.eventDescription.trim() &&
					formData.eventType,
			);
		case 3:
			return Boolean(
				formData.location.trim() &&
					formData.startDate &&
					formData.endDate &&
					formData.endDate > formData.startDate &&
					formData.eventCode.trim(),
			);
		default:
			return true;
	}
}

export function canSaveEventRequest(formData: EventFormData): boolean {
	return (
		!!formData.eventName.trim() &&
		!!formData.eventDescription.trim() &&
		!!formData.eventType &&
		!!formData.location.trim() &&
		formData.endDate > formData.startDate
	);
}

export function getBlockedMessage(
	step: number,
	input: EventRequestWizardInput,
	canSaveDraft: boolean,
): string | null {
	const canProceed = canProceedFromStep(step, input);
	if (step === 1 && !canProceed) return "Accept the requirements to continue.";
	if (step === 2 && !canProceed)
		return "Add the event name, description, and type to continue.";
	if (step === 3 && !canProceed)
		return "Add a location, valid time range, and event code to continue.";
	if (canSaveDraft && step >= 2 && !canSaveEventRequest(input.formData))
		return "Add the event name, description, type, location, and valid time range to save.";
	return null;
}
