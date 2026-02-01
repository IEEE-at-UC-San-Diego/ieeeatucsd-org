/**
 * Firestore Export Types
 *
 * Type definitions for Firebase Firestore data exports.
 * These types represent the original Firebase structure that will be
 * exported to JSON and later transformed for Convex import.
 */

import type { DocumentData } from 'firebase-admin/firestore';

// ============================================================================
// BASE TYPE DEFINITIONS
// ============================================================================

export type Timestamp = {
  _seconds: number;
  _nanoseconds: number;
};

export type DocumentReference = string; // Firestore reference as path string

/**
 * Base export interface with document ID
 */
export interface ExportedDocument {
  _id: string;
  [key: string]: unknown;
}

/**
 * Base interface for subcollection export with parent reference
 */
export interface ExportedSubcollectionDocument extends ExportedDocument {
  _parentId: string; // Parent document ID
  _parentCollection: string; // Parent collection name
}

// ============================================================================
// USER & AUTH TYPES
// ============================================================================

export type UserRole =
  | 'Member'
  | 'General Officer'
  | 'Executive Officer'
  | 'Member at Large'
  | 'Past Officer'
  | 'Sponsor'
  | 'Administrator';

export type SponsorTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export type OfficerTeam = 'Internal' | 'Events' | 'Projects';

export type GoogleGroup =
  | 'executive-officers@ieeeatucsd.org'
  | 'general-officers@ieeeatucsd.org'
  | 'past-officers@ieeeatucsd.org';

export type SignInMethod =
  | 'email'
  | 'google'
  | 'microsoft'
  | 'github'
  | 'facebook'
  | 'twitter'
  | 'apple'
  | 'other';

export interface User extends ExportedDocument {
  email: string;
  emailVisibility?: boolean;
  verified?: boolean;
  name: string;
  username?: string;
  avatar?: string;
  pid?: string;
  memberId?: string;
  graduationYear?: number;
  major?: string;
  zelleInformation?: string;
  lastLogin?: Timestamp;
  notificationPreferences?: Record<string, unknown>;
  displayPreferences?: Record<string, unknown>;
  accessibilitySettings?: Record<string, unknown>;
  navigationLayout?: 'horizontal' | 'sidebar';
  resume?: string;
  signedUp?: boolean;
  requestedEmail?: boolean;
  role?: UserRole;
  position?: string;
  status?: 'active' | 'inactive' | 'suspended';
  joinDate?: Timestamp;
  eventsAttended?: number;
  points?: number;
  team?: OfficerTeam;
  invitedBy?: DocumentReference;
  inviteAccepted?: Timestamp;
  lastUpdated?: Timestamp;
  lastUpdatedBy?: DocumentReference;
  signInMethod?: SignInMethod;
  hasIEEEEmail?: boolean;
  ieeeEmail?: string;
  ieeeEmailCreatedAt?: Timestamp;
  sponsorTier?: SponsorTier;
  sponsorOrganization?: string;
  autoAssignedSponsor?: boolean;
}

export interface PublicProfile extends ExportedDocument {
  name: string;
  major: string;
  points: number;
  totalEventsAttended: number;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type EventType = 'social' | 'technical' | 'outreach' | 'professional' | 'projects' | 'other';

export interface Event extends ExportedDocument {
  eventName: string;
  eventDescription: string;
  eventCode: string;
  location: string;
  files: string[];
  pointsToReward: number;
  startDate: Timestamp;
  endDate: Timestamp;
  published: boolean;
  eventType: EventType;
  hasFood: boolean;
  createdFrom?: DocumentReference;
}

export interface EventAttendee extends ExportedSubcollectionDocument {
  userId: string;
  timeCheckedIn: Timestamp;
  food: string;
  pointsEarned: number;
}

export type EventRequestStatus =
  | 'draft'
  | 'submitted'
  | 'pending'
  | 'completed'
  | 'approved'
  | 'declined'
  | 'needs_review';

export interface Invoice {
  readonly id: string;
  readonly amount: number;
  readonly vendor: string;
  readonly description: string;
  readonly date: string;
  readonly fileUrl?: string;
}

export interface EventAuditLog {
  action: string;
  createdBy: string;
  timestamp: Timestamp;
}

export interface EventRequest extends ExportedDocument {
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
  invoices?: Invoice[];
  needsGraphics?: boolean;
  needsAsFunding: boolean;
  status: EventRequestStatus;
  declinedReason?: string;
  reviewFeedback?: string;
  requestedUser: DocumentReference;
  auditLogs?: EventAuditLog[];
  isDraft?: boolean;
  department?: string;
  graphicsCompleted?: boolean;
  graphicsFiles?: string[];
  published?: boolean;
}

// ============================================================================
// FINANCIAL TYPES
// ============================================================================

export type ReimbursementStatus = 'submitted' | 'declined' | 'approved' | 'paid';
export type ReimbursementDepartment = 'internal' | 'external' | 'projects' | 'events' | 'other';

export interface Receipt {
  id: string;
  fileUrl: string;
  description?: string;
  amount: number;
  dateOfPurchase: Timestamp;
}

export interface LegacyExpense {
  category: string;
  amount: number;
  description: string;
}

export interface AuditNote {
  note: string;
  createdBy: string;
  timestamp: Timestamp;
}

export interface AuditLog {
  action: string;
  createdBy: string;
  timestamp: Timestamp;
}

export interface AuditRequest {
  auditorId: string;
  requestedBy: string;
  requestedAt: Timestamp;
  status: 'pending' | 'completed' | 'declined';
  auditResult?: 'approved' | 'needs_changes';
  auditNotes?: string;
  completedAt?: Timestamp;
}

export interface Reimbursement extends ExportedDocument {
  title: string;
  totalAmount: number;
  paymentMethod: string;
  status: ReimbursementStatus;
  submittedBy: DocumentReference;
  additionalInfo: string;
  department: ReimbursementDepartment;
  auditNotes?: AuditNote[];
  auditLogs?: AuditLog[];
  auditRequests?: AuditRequest[];
  requiresExecutiveOverride?: boolean;
  receipts?: Receipt[];
  dateOfPurchase?: Timestamp;
  expenses?: LegacyExpense[];
}

export type FundDepositStatus = 'pending' | 'approved' | 'declined';

export interface FundDeposit extends ExportedDocument {
  id: string;
  amount: number;
  depositedBy: DocumentReference;
  submittedAt: Timestamp;
  status: FundDepositStatus;
  notes?: string;
  receiptFile?: string;
  approvedAt?: Timestamp;
  approvedBy?: DocumentReference;
  auditLogs?: AuditLog[];
}

// ============================================================================
// INVITATION & ONBOARDING TYPES
// ============================================================================

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type OnboardingStatus = 'pending' | 'completed' | 'failed';

export interface OfficerInvitation extends ExportedDocument {
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  position: string;
  status: InvitationStatus;
  invitedBy: DocumentReference;
  invitedAt: Timestamp;
  acceptedAt?: Timestamp;
  declinedAt?: Timestamp;
  expiresAt: Timestamp;
  message?: string;
  acceptanceDeadline?: string;
  leaderName?: string;
  googleGroupAssigned?: boolean;
  googleGroup?: GoogleGroup;
  permissionsGranted?: boolean;
  onboardingEmailSent?: boolean;
  resentAt?: Timestamp;
  lastSentAt?: Timestamp;
  roleGranted?: boolean;
  roleGrantedAt?: Timestamp;
  userCreatedOrUpdated?: boolean;
}

export interface DirectOnboarding extends ExportedDocument {
  name: string;
  email: string;
  role: UserRole;
  position: string;
  team?: OfficerTeam;
  status: OnboardingStatus;
  createdBy: DocumentReference;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  userCreated?: DocumentReference;
  googleGroupAssigned?: boolean;
  googleGroup?: GoogleGroup;
  permissionsGranted?: boolean;
  onboardingEmailSent?: boolean;
  notes?: string;
}

export interface Invite extends ExportedDocument {
  email: string;
  name: string;
  role: UserRole;
  status: InvitationStatus;
  invitedBy: DocumentReference;
  invitedAt: Timestamp;
  acceptedAt?: Timestamp;
  expiresAt: Timestamp;
  message?: string;
}

// ============================================================================
// SPONSORSHIP & LINK TYPES
// ============================================================================

export interface SponsorDomain extends ExportedDocument {
  domain: string;
  organizationName: string;
  sponsorTier: SponsorTier;
  createdAt: Timestamp;
  createdBy: DocumentReference;
  lastModified?: Timestamp;
  lastModifiedBy?: DocumentReference;
}

export interface Link extends ExportedDocument {
  id: string;
  url: string;
  title: string;
  category: string;
  description?: string;
  iconUrl?: string;
  shortUrl?: string;
  publishDate?: Timestamp;
  expireDate?: Timestamp;
  createdAt: Timestamp;
  createdBy: DocumentReference;
  lastModified?: Timestamp;
  lastModifiedBy?: DocumentReference;
  order?: number;
}

// ============================================================================
// CONSTITUTION TYPES
// ============================================================================

export type ConstitutionStatus = 'draft' | 'published' | 'archived';
export type SectionType = 'preamble' | 'article' | 'section' | 'subsection' | 'amendment';
export type ChangeType = 'create' | 'update' | 'delete' | 'reorder';

export interface Constitution extends ExportedDocument {
  id: string;
  title: string;
  organizationName: string;
  sections: ConstitutionSection[];
  version: number;
  status: ConstitutionStatus;
  createdAt: Timestamp;
  lastModified: Timestamp;
  lastModifiedBy: DocumentReference;
  collaborators: DocumentReference[];
  isTemplate?: boolean;
}

export interface ConstitutionSection extends ExportedDocument {
  type: SectionType;
  title: string;
  content: string;
  order: number;
  parentId?: string;
  articleNumber?: number;
  sectionNumber?: number;
  subsectionLetter?: string;
  amendmentNumber?: number;
  createdAt: Timestamp;
  lastModified: Timestamp;
  lastModifiedBy: DocumentReference;
}

export interface ConstitutionSectionExport extends ExportedSubcollectionDocument {
  type: SectionType;
  title: string;
  content: string;
  order: number;
  parentId?: string;
  articleNumber?: number;
  sectionNumber?: number;
  subsectionLetter?: string;
  amendmentNumber?: number;
  createdAt: Timestamp;
  lastModified: Timestamp;
  lastModifiedBy: DocumentReference;
}

export interface ConstitutionBeforeValue {
  title?: string;
  content?: string;
  type?: SectionType;
  order?: number;
  parentId?: string;
  articleNumber?: number;
  sectionNumber?: number;
  subsectionLetter?: string;
  amendmentNumber?: number;
}

export interface ConstitutionAfterValue extends ConstitutionBeforeValue {}

export interface ConstitutionAuditEntry extends ExportedDocument {
  constitutionId: string;
  sectionId?: string;
  changeType: ChangeType;
  changeDescription: string;
  beforeValue?: ConstitutionBeforeValue;
  afterValue?: ConstitutionAfterValue;
  userId: DocumentReference;
  userName: string;
  timestamp: Timestamp;
  ipAddress?: string;
  userAgent?: string;
}

export interface ConstitutionAuditEntryExport extends ExportedSubcollectionDocument {
  constitutionId: string;
  sectionId?: string;
  changeType: ChangeType;
  changeDescription: string;
  beforeValue?: ConstitutionBeforeValue;
  afterValue?: ConstitutionAfterValue;
  userId: DocumentReference;
  userName: string;
  timestamp: Timestamp;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export interface Notification extends ExportedDocument {
  userId: DocumentReference;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
}

// ============================================================================
// GOOGLE GROUP TYPES
// ============================================================================

export type AssignmentStatus = 'active' | 'removed' | 'pending';

export interface GoogleGroupAssignment extends ExportedDocument {
  userId: DocumentReference;
  googleGroup: GoogleGroup;
  assignedAt: Timestamp;
  assignedBy: DocumentReference;
  status: AssignmentStatus;
  removedAt?: Timestamp;
  removedBy?: DocumentReference;
  reason?: string;
}

// ============================================================================
// ORGANIZATION SETTINGS TYPES
// ============================================================================

export interface OrganizationSetting extends ExportedDocument {
  key: string;
  value: unknown;
  description?: string;
  category?: string;
  isPublic?: boolean;
  createdAt?: Timestamp;
  lastModified?: Timestamp;
  lastModifiedBy?: DocumentReference;
}

// ============================================================================
// EXPORT CONFIGURATION TYPES
// ============================================================================

export interface CollectionConfig {
  name: string;
  filePath: string;
  hasSubcollections: boolean;
  subcollections?: SubcollectionConfig[];
}

export interface SubcollectionConfig {
  name: string;
  filePath: string;
}

export interface ExportResult {
  collection: string;
  success: boolean;
  documentCount: number;
  subcollectionCounts?: Record<string, number>;
  error?: string;
  duration: number;
}

export interface ExportReport {
  totalCollections: number;
  successfulExports: number;
  failedExports: number;
  totalDocuments: number;
  results: ExportResult[];
  duration: number;
  startTime: string;
  endTime: string;
}

// ============================================================================
// FIRESTORE QUERY TYPES
// ============================================================================

export interface QueryOptions {
  limit?: number;
  batchSize?: number;
}

export interface ExportOptions {
  dryRun?: boolean;
  verbose?: boolean;
  selectedCollections?: string[];
  outputDir?: string;
}
