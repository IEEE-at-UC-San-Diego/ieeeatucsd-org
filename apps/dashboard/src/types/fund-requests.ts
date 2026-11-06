import {
	formatCurrencyUSD,
	formatDate as formatDateBase,
	formatDateTime as formatDateTimeBase,
} from "@/lib/formatters";
// Fund request status lifecycle
export type FundRequestStatus =
	| "draft"
	| "submitted"
	| "needs_info"
	| "approved"
	| "denied"
	| "completed";

// Categories for fund requests
export type FundRequestCategory =
	| "event"
	| "travel"
	| "equipment"
	| "software"
	| "other"
	| "general"
	| "projects";

// Department for fund requests
export type FundRequestDepartment =
	| "events"
	| "projects"
	| "internal"
	| "other";

// Funding sources
export type FundingSource = "department" | "ieee";

// Vendor link with URL and item name
export interface VendorLink {
	id: string;
	url: string;
	itemName?: string;
	quantity?: number;
	label?: string;
}

// Attachment file reference
export interface FundRequestAttachment {
	id: string;
	url: string;
	name: string;
	size: number;
	type: string;
	uploadedAt: number;
}

// Audit log entry for tracking changes
export interface FundRequestAuditLog {
	id: string;
	action:
		| "created"
		| "updated"
		| "submitted"
		| "approved"
		| "denied"
		| "info_requested"
		| "info_provided"
		| "completed";
	performedBy: string;
	performedByName?: string;
	timestamp: number;
	notes?: string;
	previousStatus?: FundRequestStatus;
	newStatus?: FundRequestStatus;
}

// Budget configuration for a department
export interface BudgetConfig {
	department: FundRequestDepartment;
	totalBudget: number;
	startDate: number;
	updatedAt: number;
	updatedBy: string;
	updatedByName?: string;
}

// Manual budget adjustment
export interface BudgetAdjustment {
	id: string;
	department: FundRequestDepartment;
	amount: number;
	description: string;
	createdAt: number;
	createdBy: string;
	createdByName?: string;
}

// Status display helpers
export const STATUS_LABELS: Record<FundRequestStatus, string> = {
	draft: "Draft",
	submitted: "Submitted",
	needs_info: "Needs Info",
	approved: "Approved",
	denied: "Denied",
	completed: "Completed",
};

export const STATUS_COLORS: Record<FundRequestStatus, string> = {
	draft: "bg-muted text-foreground",
	submitted: "bg-ds-blue-100 text-tone-info",
	needs_info: "bg-ds-amber-100 text-tone-warning",
	approved: "bg-ds-green-100 text-tone-success",
	denied: "bg-ds-red-100 text-tone-danger",
	completed: "bg-ds-purple-100 text-tone-purple",
};

export const CATEGORY_LABELS: Record<FundRequestCategory, string> = {
	event: "Event",
	travel: "Travel",
	equipment: "Equipment",
	software: "Software",
	other: "Other",
	general: "General",
	projects: "Projects",
};

export const DEPARTMENT_LABELS: Record<FundRequestDepartment, string> = {
	events: "Events",
	projects: "Projects",
	internal: "Internal",
	other: "Other",
};

export const FUNDING_SOURCE_LABELS: Record<FundingSource, string> = {
	department: "Department Funds",
	ieee: "IEEE Funds",
};

export const FUNDING_SOURCES: FundingSource[] = ["department", "ieee"];

// Helper functions
export const formatCurrency = formatCurrencyUSD;
export const formatDate = (timestamp: number): string =>
	formatDateBase(timestamp);
export const formatDateTime = (timestamp: number): string =>
	formatDateTimeBase(timestamp);
