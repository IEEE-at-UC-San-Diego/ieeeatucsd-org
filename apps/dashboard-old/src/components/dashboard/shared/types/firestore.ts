import type { Timestamp } from "firebase/firestore";

export type OfficerTeam = "Internal" | "Events" | "Projects";

export type UserRole =
  | "Member"
  | "General Officer"
  | "Executive Officer"
  | "Member at Large"
  | "Past Officer"
  | "Sponsor"
  | "Administrator";

export type SponsorTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export type NavigationLayout = "horizontal" | "sidebar";

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
  navigationLayout?: NavigationLayout; // User's preferred navigation layout (horizontal navbar or sidebar)
  resume?: string;
  signedUp: boolean;
  requestedEmail: boolean;
  role: UserRole;
  position?: string; // Specific position like "Webmaster", "President", etc.
  status: "active" | "inactive" | "suspended";
  joinDate: Timestamp;
  eventsAttended?: number;
  points?: number;
  team?: "Internal" | "Events" | "Projects"; // Officer team assignment (optional)
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
  sponsorTier?: SponsorTier; // sponsor tier level (for Sponsor role)
  sponsorOrganization?: string; // sponsor organization name (for Sponsor role)
  autoAssignedSponsor?: boolean; // whether the user was auto-assigned as sponsor via domain matching
  // TOS and Privacy Policy acceptance tracking
  tosAcceptedAt?: Timestamp; // When user accepted Terms of Service
  tosVersion?: string; // Version of TOS accepted (e.g., "1.0")
  privacyPolicyAcceptedAt?: Timestamp; // When user accepted Privacy Policy
  privacyPolicyVersion?: string; // Version of Privacy Policy accepted
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
  status:
  | "draft"
  | "submitted"
  | "pending"
  | "completed"
  | "approved"
  | "declined"
  | "needs_review";
  declinedReason?: string;
  reviewFeedback?: string;
  requestedUser: string;
  auditLogs?: EventAuditLog[];
  isDraft?: boolean; // Flag to indicate if this is a draft event (minimal fields)
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

  paymentDetails?: {
    confirmationNumber: string;
    paymentDate: Timestamp;
    amountPaid: number;
    proofFileUrl?: string; // URL to the uploaded image
    memo?: string;
  };

  // New multi-receipt structure
  receipts?: Receipt[];

  // Legacy fields for backward compatibility
  dateOfPurchase?: Timestamp; // Keep for legacy support
  expenses?: LegacyExpense[]; // Legacy expense structure
}

// Legacy expense structure for backward compatibility
export interface LegacyExpense {
  id: string;
  description: string;
  category: string;
  amount: number;
  receipt?: { url: string; name: string; size: number; type: string };
}

export interface LineItem {
  id: string;
  description: string;
  category: string;
  amount: number;
}

export interface Receipt {
  id: string;
  vendorName: string;
  location: string;
  dateOfPurchase: Timestamp;
  lineItems: LineItem[];
  receiptFile?: string; // Firebase Storage URL
  notes?: string;
  subtotal: number;
  tax?: number;
  tip?: number;
  shipping?: number;
  total: number;
}

// Legacy receipt structure for backward compatibility
export interface LegacyReceipt {
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

export interface SponsorDomain {
  domain: string; // Email domain (e.g., "@tsmc.com", "@qualcomm.com")
  organizationName: string; // Sponsor organization name
  sponsorTier: SponsorTier; // Sponsor tier level
  createdAt: Timestamp;
  createdBy: string; // User ID who created this domain mapping
  lastModified?: Timestamp;
  lastModifiedBy?: string; // User ID who last modified this domain mapping
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

export interface Link {
  id: string;
  url: string; // Required - the destination URL
  title: string; // Required - display name
  category: string; // Required - for organization/filtering
  description?: string; // Optional - short description
  iconUrl?: string; // Optional - Firebase Storage URL for icon/photo
  shortUrl?: string; // Optional - shortened URL slug (e.g., "meeting" for /url/meeting)
  publishDate?: Timestamp; // Optional - link becomes visible after this date
  expireDate?: Timestamp; // Optional - link becomes hidden after this date
  createdAt: Timestamp; // Required - for sorting (reverse chronological)
  createdBy: string; // User ID who created it
  lastModified?: Timestamp; // When last updated
  lastModifiedBy?: string; // User ID who last modified
  order?: number; // Optional - for manual ordering within category
}

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

// Onboarding Types
export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

export type GoogleGroup =
  | "executive-officers@ieeeatucsd.org"
  | "general-officers@ieeeatucsd.org"
  | "past-officers@ieeeatucsd.org";

export interface OfficerInvitation {
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  position: string;
  status: InvitationStatus;
  invitedBy: string; // uid of the executive who sent the invitation
  invitedAt: Timestamp;
  acceptedAt?: Timestamp;
  declinedAt?: Timestamp;
  expiresAt: Timestamp; // 7 days from invitedAt
  message?: string; // Custom message for the invitation
  acceptanceDeadline?: string; // Human-readable deadline (e.g., "end of March 15th")
  leaderName?: string; // Team Lead / Vice Chair / Mentor name
  googleGroupAssigned?: boolean; // Whether user has been added to Google Group
  googleGroup?: GoogleGroup; // Which Google Group they were added to
  permissionsGranted?: boolean; // Whether officer permissions have been granted
  onboardingEmailSent?: boolean; // Whether onboarding email was sent after acceptance
  resentAt?: Timestamp; // When the invitation was last resent
  lastSentAt?: Timestamp; // Timestamp of the most recent send (initial or resend)
  roleGranted?: boolean; // Whether Firebase Auth custom claims were set for the role
  roleGrantedAt?: Timestamp; // When the role was granted via custom claims
  userCreatedOrUpdated?: boolean; // Whether the user document was created or updated in Firestore
}

export interface OnboardingEmailData {
  name: string;
  position: string;
  role: UserRole;
  leaderName?: string; // Vice Chair or mentor name
  acceptanceDeadline?: string; // For invitation emails
  customMessage?: string; // Additional custom message
}

export interface GoogleGroupAssignment {
  userId: string;
  email: string;
  role: UserRole;
  googleGroup: GoogleGroup;
  assignedAt: Timestamp;
  assignedBy: string; // uid of the executive who assigned
  success: boolean;
  error?: string;
}

export type EmailTemplateType =
  | "onboarding-invitation"
  | "onboarding-direct"
  | "onboarding-acceptance";

export interface EmailTemplate {
  id?: string; // Document ID
  templateId: EmailTemplateType; // Template identifier
  templateName: string; // Human-readable name
  subject: string; // Email subject line
  body: string; // Email body with template variables
  variables: string[]; // Array of supported variables (e.g., ["{NAME}", "{EMAIL}"])
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string; // UID of user who last updated
  isDefault: boolean; // Whether this is the default template
}

export interface EmailTemplateChange {
  templateId: EmailTemplateType;
  changedBy: string; // UID of user who made the change
  changedAt: Timestamp;
  previousBody: string;
  newBody: string;
  previousSubject: string;
  newSubject: string;
}
