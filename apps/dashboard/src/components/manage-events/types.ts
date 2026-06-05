import type { EventDepartmentValue, EventTypeValue } from "./constants";

export type EventStatus =
	| "draft"
	| "submitted"
	| "pending"
	| "needs_review"
	| "approved"
	| "declined"
	| "published";

export interface InvoiceItem {
	description: string;
	quantity: number;
	unitPrice: number;
	total: number;
}

export interface Invoice {
	_id: string;
	vendor: string;
	items: InvoiceItem[];
	tax: number;
	tip: number;
	invoiceFile?: string;
	additionalFiles: string[];
	subtotal: number;
	total: number;
	// Convenience fields for simple display
	amount: number;
	description: string;
	fileUrl?: string;
}

export interface EventFile {
	_id: string;
	name: string;
	url: string;
	isPublic: boolean;
	uploadedAt: number;
	uploadedBy: string;
}

export interface EventRequest {
	_id: string;
	_creationTime: number;
	eventName: string;
	eventDescription: string;
	eventType: EventTypeValue;
	department?: EventDepartmentValue;
	location: string;
	startDate: number;
	endDate: number;
	eventCode: string;
	hasFood: boolean;
	needsFlyers: boolean;
	needsGraphics: boolean;
	needsASFunding: boolean;
	estimatedAttendance: number;
	status: EventStatus;
	files: string[];
	invoices: Invoice[];
	createdBy: string;
	requestedUser?: string;
	_updatedAt?: number;
	attendeeCount?: number;
	attendees?: Array<{
		userId: string;
		name: string;
		email?: string;
		timeCheckedIn: number;
		food?: string;
		pointsEarned: number;
	}>;
	// Additional Convex fields for full edit support
	willOrHaveRoomBooking?: boolean;
	roomBookingFiles?: string[];
	foodDrinksBeingServed?: boolean;
	asFundingRequired?: boolean;
	flyerType?: string[];
	otherFlyerType?: string;
	flyerAdvertisingStartDate?: number;
	flyerAdditionalRequests?: string;
	photographyNeeded?: boolean;
	requiredLogos?: string[];
	otherLogos?: string[];
	advertisingFormat?: string;
	additionalSpecifications?: string;
	flyersCompleted?: boolean;
	graphicsUploadNote?: string;
	publicGoogleEventId?: string | null;
	publicGoogleEventUrl?: string | null;
	publicGoogleCalendarId?: string | null;
	publicGoogleCalendarSubscribeUrl?: string | null;
	publicGoogleCalendarIcsUrl?: string | null;
	privateGoogleEventId?: string | null;
	privateGoogleEventUrl?: string | null;
	privateGoogleCalendarId?: string | null;
	privateGoogleCalendarSubscribeUrl?: string | null;
	privateGoogleCalendarIcsUrl?: string | null;
}

export interface EventStats {
	totalEvents: number;
	publishedEvents: number;
	totalAttendees: number;
}

export interface EventFilters {
	search: string;
	statuses?: EventStatus[];
	teamPreset?: "for_events" | "for_internal" | "for_operations";
}

export interface SortConfig {
	field: string;
	direction: "asc" | "desc";
}

export interface WizardStep {
	id: number;
	title: string;
	description: string;
}

export interface EventFormData {
	eventName: string;
	eventDescription: string;
	eventType: EventTypeValue | "";
	department?: EventDepartmentValue;
	location: string;
	startDate: number;
	endDate: number;
	eventCode: string;
	hasFood: boolean;
	needsFlyers: boolean;
	needsGraphics: boolean;
	needsASFunding: boolean;
	estimatedAttendance: number;
	files: string[];
	invoices: Invoice[];
	// Additional Convex fields
	willOrHaveRoomBooking: boolean;
	roomBookingFiles: string[];
	foodDrinksBeingServed: boolean;
	asFundingRequired: boolean;
	flyerType: string[];
	otherFlyerType: string;
	flyerAdvertisingStartDate: number;
	flyerAdditionalRequests: string;
	photographyNeeded: boolean;
	requiredLogos: string[];
	otherLogos: string[];
	advertisingFormat: string;
	additionalSpecifications: string;
	flyersCompleted: boolean;
	graphicsUploadNote: string;
}

export interface CalendarEvent {
	_id: string;
	eventName: string;
	startDate: number;
	endDate: number;
	status: EventStatus;
}
