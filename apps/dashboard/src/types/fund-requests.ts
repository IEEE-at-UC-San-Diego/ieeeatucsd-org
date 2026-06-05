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
export type FundRequestDepartment = "events" | "projects" | "internal" | "other";

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
  draft: "bg-gray-100 text-gray-800",
  submitted: "bg-blue-100 text-blue-800",
  needs_info: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
  completed: "bg-purple-100 text-purple-800",
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
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
