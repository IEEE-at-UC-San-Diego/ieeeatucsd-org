import type { Timestamp } from "firebase/firestore";

export type UserRole =
  | "Member"
  | "General Officer"
  | "Executive Officer"
  | "Member at Large"
  | "Past Officer"
  | "Sponsor"
  | "Administrator";

export interface User {
  email: string;
  emailVisibility: boolean;
  verified: boolean;
  name: string;
  username?: string;
  avatar?: string;
  pid?: string;
  memberId?: string;
  graduationYear?: number;
  major?: string;
  zelleInformation?: string;
  lastLogin?: Timestamp;
  notificationPreferences: Record<string, unknown>;
  displayPreferences: Record<string, unknown>;
  accessibilitySettings: Record<string, unknown>;
  resume?: string;
  signedUp: boolean;
  requestedEmail: boolean;
  role: UserRole;
  position?: string; // Specific position like "Webmaster", "President", etc.
  status: "active" | "inactive" | "suspended";
  joinDate: Timestamp;
  eventsAttended?: number;
  points?: number;
  invitedBy?: string; // uid of the user who invited them
  inviteAccepted?: Timestamp; // when they accepted the invite
  lastUpdated?: Timestamp; // when the user data was last updated
  lastUpdatedBy?: string; // uid of the user who last updated this user's data
  signInMethod?:
    | "email"
    | "google"
    | "microsoft"
    | "github"
    | "facebook"
    | "twitter"
    | "apple"
    | "other"; // how the user signed in
  hasIEEEEmail?: boolean; // whether the user has created an IEEE email
  ieeeEmail?: string; // the user's IEEE email address
  ieeeEmailCreatedAt?: Timestamp; // when the IEEE email was created
}

export interface PublicProfile {
  name: string;
  major: string;
  points: number;
  totalEventsAttended: number;
}

export interface Event {
  eventName: string;
  eventDescription: string;
  eventCode: string;
  location: string;
  files: string[];
  pointsToReward: number;
  startDate: Timestamp;
  endDate: Timestamp;
  published: boolean;
  eventType:
    | "social"
    | "technical"
    | "outreach"
    | "professional"
    | "projects"
    | "other";
  hasFood: boolean;
}

export interface Attendee {
  userId: string;
  timeCheckedIn: Timestamp;
  food: string;
  pointsEarned: number;
}

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
  additionalFiles: string[];
  subtotal: number;
  total: number;
}

export interface EventRequest {
  name: string;
  location: string;
  startDateTime: Timestamp;
  endDateTime: Timestamp;
  eventDescription: string;
  flyersNeeded: boolean;
  flyerType: string[];
  otherFlyerType?: string;
  flyerAdvertisingStartDate?: Timestamp;
  flyerAdditionalRequests?: string;
  flyersCompleted: boolean;
  photographyNeeded: boolean;
  requiredLogos: string[];
  otherLogos?: string[];
  advertisingFormat?: string;
  willOrHaveRoomBooking: boolean;
  expectedAttendance?: number;
  roomBookingFiles: string[];
  asFundingRequired: boolean;
  foodDrinksBeingServed: boolean;
  // Updated to support multiple invoices
  invoices: Invoice[];
  // Keep legacy fields for backward compatibility
  itemizedInvoice?: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  invoice?: string;
  invoiceFiles?: string[];
  needsGraphics: boolean;
  needsAsFunding: boolean;
  status: "submitted" | "pending" | "completed" | "declined" | "needs_review";
  declinedReason?: string;
  reviewFeedback?: string;
  requestedUser: string;
  auditLogs?: EventAuditLog[];
}

export interface EventAuditLog {
  id: string;
  eventRequestId: string;
  action:
    | "created"
    | "updated"
    | "status_changed"
    | "file_uploaded"
    | "file_deleted"
    | "graphics_updated"
    | "published"
    | "unpublished";
  performedBy: string;
  performedByName?: string;
  timestamp: Timestamp;
  changes?: EventFieldChange[];
  oldStatus?: string;
  newStatus?: string;
  statusReason?: string; // For declined reason or review feedback
  fileChanges?: EventFileChange[];
  metadata?: { [key: string]: any };
}

export interface EventFieldChange {
  field: string;
  fieldDisplayName: string;
  oldValue: any;
  newValue: any;
  changeType: "added" | "updated" | "removed";
}

export interface EventFileChange {
  action: "added" | "removed";
  fileName: string;
  fileUrl?: string;
  fileType: "room_booking" | "invoice" | "logo" | "graphics" | "other";
}

export interface Log {
  userId: string;
  type: "error" | "update" | "delete" | "create" | "login" | "logout";
  part: string;
  message: string;
  created: Timestamp;
}

export interface Officer {
  userId: string;
  role: string;
  type: "administrator" | "executive" | "general" | "honorary" | "past";
}

export interface Reimbursement {
  title: string;
  totalAmount: number;
  dateOfPurchase: Timestamp;
  paymentMethod: string;
  status: "submitted" | "declined" | "approved" | "paid";
  submittedBy: string;
  additionalInfo: string;
  department: "internal" | "external" | "projects" | "events" | "other";
  auditNotes?: { note: string; createdBy: string; timestamp: Timestamp }[];
  auditLogs?: { action: string; createdBy: string; timestamp: Timestamp }[];
  auditRequests?: {
    auditorId: string;
    requestedBy: string;
    requestedAt: Timestamp;
    status: "pending" | "completed" | "declined";
    auditResult?: "approved" | "needs_changes";
    auditNotes?: string;
    completedAt?: Timestamp;
  }[];
  requiresExecutiveOverride?: boolean;
}

export interface Receipt {
  file: string;
  createdBy: string;
  itemizedExpenses: { description: string; category: string; amount: number }[];
  tax: number;
  date: Timestamp;
  locationName: string;
  locationAddress: string;
  notes: string;
  auditedBy: string;
}

export interface Sponsor {
  userId: string;
  company: string;
}

export interface ConstitutionSection {
  id: string;
  type: "preamble" | "article" | "section" | "subsection" | "amendment";
  title: string;
  content: string;
  order: number;
  parentId?: string; // For nested sections
  articleNumber?: number; // For articles (auto-generated based on order)
  sectionNumber?: number; // For sections within articles (auto-generated based on order)
  subsectionLetter?: string; // For subsections (a, b, c, etc.)
  amendmentNumber?: number; // For amendments
  createdAt: Timestamp;
  lastModified: Timestamp;
  lastModifiedBy: string; // User ID
}

export interface Constitution {
  id: string;
  title: string;
  organizationName: string;
  sections: ConstitutionSection[];
  version: number;
  status: "draft" | "published" | "archived";
  createdAt: Timestamp;
  lastModified: Timestamp;
  lastModifiedBy: string;
  collaborators: string[]; // Array of user IDs who can edit
  isTemplate?: boolean;
}

// Removed collaboration session interface

export interface ConstitutionAuditEntry {
  id: string;
  constitutionId: string;
  sectionId?: string; // null for constitution-level changes
  changeType: "create" | "update" | "delete" | "reorder";
  changeDescription: string; // Human-readable description of what changed
  beforeValue?: {
    title?: string;
    content?: string;
    type?: ConstitutionSection["type"];
    order?: number;
    parentId?: string;
    articleNumber?: number;
    sectionNumber?: number;
    subsectionLetter?: string;
    amendmentNumber?: number;
  };
  afterValue?: {
    title?: string;
    content?: string;
    type?: ConstitutionSection["type"];
    order?: number;
    parentId?: string;
    articleNumber?: number;
    sectionNumber?: number;
    subsectionLetter?: string;
    amendmentNumber?: number;
  };
  userId: string;
  userName: string;
  timestamp: Timestamp;
  ipAddress?: string; // For additional security tracking
  userAgent?: string; // For additional security tracking
}

export interface ConstitutionAuditLog {
  id: string;
  constitutionId: string;
  entries: ConstitutionAuditEntry[];
  totalEntries: number;
  createdAt: Timestamp;
  lastUpdated: Timestamp;
}
