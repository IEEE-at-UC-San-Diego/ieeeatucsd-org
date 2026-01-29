import type { UserRole } from "../../../shared/types/firestore";

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  vendor: string;
  items: InvoiceItem[];
  tax: number;
  tip: number;
  invoiceFile?: string;
  subtotal: number;
  total: number;
}

export interface LegacyInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface EventAuditLogChange {
  field: string;
  fieldDisplayName: string;
  oldValue?: unknown;
  newValue?: unknown;
  changeType: "added" | "removed" | "updated";
}

export interface EventAuditLog {
  id?: string;
  action: string;
  performedBy: string;
  performedByName?: string;
  timestamp: any;
  oldStatus?: string;
  newStatus?: string;
  statusReason?: string;
  changes?: EventAuditLogChange[];
  fileChanges?: { action: string; fileType?: string; fileName?: string }[];
  metadata?: Record<string, unknown>;
}

export interface EventRequest {
  id: string;
  name: string;
  location: string;
  startDateTime: any;
  endDateTime: any;
  eventDescription: string;
  status: string;
  requestedUser: string;
  createdAt: any;
  eventCode?: string;
  pointsToReward?: number;
  department?: string;
  needsGraphics?: boolean;
  needsAsFunding?: boolean;
  flyersNeeded?: boolean;
  flyerType?: string[];
  otherFlyerType?: string;
  flyerAdditionalRequests?: string;
  flyersCompleted?: boolean;
  photographyNeeded?: boolean;
  requiredLogos?: string[];
  otherLogos?: string[];
  advertisingFormat?: string;
  willOrHaveRoomBooking?: boolean;
  hasRoomBooking?: boolean;
  expectedAttendance?: number;
  roomBookingFiles?: string[];
  asFundingRequired?: boolean;
  foodDrinksBeingServed?: boolean;
  servingFoodDrinks?: boolean;
  graphicsFiles?: string[];
  graphicsCompleted?: boolean;
  additionalSpecifications?: string;
  invoices?: Invoice[];
  itemizedInvoice?: LegacyInvoiceItem[];
  invoice?: string;
  invoiceFiles?: string[];
  declinedReason?: string;
  published?: boolean;
  invoiceTax?: number;
  invoiceTip?: number;
  invoiceVendor?: string;
  reviewFeedback?: string;
  auditLogs?: EventAuditLog[];
  [key: string]: any;
}

export interface AttendeeRecord {
  id?: string;
  userId?: string;
  food?: string;
  pointsEarned?: number;
  timeCheckedIn?: any;
  [key: string]: unknown;
}

export interface UserDirectoryEntry {
  name: string;
  email: string;
  pid?: string;
}

export type UserDirectory = Record<string, UserDirectoryEntry>;

export interface UserOption {
  id: string;
  name: string;
  email: string;
}

export interface EventViewModalProps {
  request: EventRequest | null;
  users: UserDirectory;
  onClose: () => void;
  onSuccess?: () => void;
}

export interface StatusControlProps {
  currentRole: UserRole | string;
  status: string;
  onStatusChange: (status: string) => void;
  declinedReason?: string;
}
