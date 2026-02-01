/**
 * Convex Transformed Types
 *
 * Type definitions for data that has been transformed from Firebase
 * exports to Convex-compatible JSON format.
 *
 * These types match the Convex schema definitions in apps/dashboard/convex/schema.ts
 * and are used by both transformation and import scripts.
 */

import type { DocumentData } from 'firebase-admin/firestore';
import type { Value } from 'convex/values';

// ============================================================================
// ID TYPE DEFINITIONS
// ============================================================================

/**
 * Convex ID type - represents a document ID in a specific table
 * The actual string format will be: "64-character-id"
 */
export type ConvexId = string;

// ============================================================================
// USER & AUTH TYPES
// ============================================================================

export type UserRole =
  | 'member'
  | 'general_officer'
  | 'executive_officer'
  | 'member_at_large'
  | 'past_officer'
  | 'sponsor'
  | 'administrator';

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

export type UserStatus = 'active' | 'inactive' | 'suspended';

export type NavigationLayout = 'horizontal' | 'sidebar';

/**
 * Transformed User document for Convex import
 */
export interface TransformedUser {
  _id: ConvexId;
  logtoSub: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt: number;
  updatedAt: number;
  emailVisibility?: boolean;
  verified?: boolean;
  username?: string;
  pid?: string;
  memberId?: string;
  graduationYear?: number;
  major?: string;
  zelleInformation?: string;
  lastLogin?: number;
  notificationPreferences?: unknown;
  displayPreferences?: unknown;
  accessibilitySettings?: unknown;
  navigationLayout?: NavigationLayout;
  resume?: string;
  signedUp?: boolean;
  requestedEmail?: boolean;
  position?: string;
  status?: UserStatus;
  joinDate?: number;
  eventsAttended?: number;
  points?: number;
  team?: OfficerTeam;
  invitedBy?: ConvexId; // Reference to users
  inviteAccepted?: number;
  lastUpdated?: number;
  lastUpdatedBy?: ConvexId; // Reference to users
  signInMethod?: SignInMethod;
  hasIEEEEmail?: boolean;
  ieeeEmail?: string;
  ieeeEmailCreatedAt?: number;
  sponsorTier?: SponsorTier;
  sponsorOrganization?: string;
  autoAssignedSponsor?: boolean;
}

/**
 * Transformed UserRole document for Convex import
 */
export interface TransformedUserRole {
  _id?: ConvexId;
  userId: ConvexId;
  roles: UserRole[];
  source: string;
  updatedAt: number;
}

/**
 * Transformed RoleAudit document for Convex import
 */
export interface TransformedRoleAudit {
  _id?: ConvexId;
  userId: ConvexId;
  roles: string[];
  previousRoles: string[];
  action: 'granted' | 'revoked' | 'synced' | 'updated';
  source: 'logto_sync' | 'manual_update' | 'migration' | 'invitation';
  performedBy?: ConvexId;
  timestamp: number;
}

/**
 * Transformed PublicProfile document for Convex import
 */
export interface TransformedPublicProfile {
  _id?: ConvexId;
  userId: ConvexId;
  name: string;
  major: string;
  points: number;
  totalEventsAttended: number;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type EventType = 'social' | 'technical' | 'outreach' | 'professional' | 'projects' | 'other';

/**
 * Transformed Event document for Convex import
 */
export interface TransformedEvent {
  _id?: ConvexId;
  eventName: string;
  eventDescription: string;
  eventCode: string;
  location: string;
  files: string[];
  pointsToReward: number;
  startDate: number;
  endDate: number;
  published: boolean;
  eventType: EventType;
  hasFood: boolean;
  createdFrom?: ConvexId; // Reference to event_requests
  createdAt: number;
  createdBy?: ConvexId; // Reference to users
}

/**
 * Transformed EventAttendee document for Convex import
 */
export interface TransformedEventAttendee {
  _id?: ConvexId;
  eventId: ConvexId;
  userId: ConvexId;
  timeCheckedIn: number;
  food: string;
  pointsEarned: number;
  checkedInAt: number;
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
  id: string;
  amount: number;
  vendor: string;
  description: string;
  date: string;
  fileUrl?: string;
}

export interface EventAuditLog {
  action: string;
  createdBy: string;
  timestamp: number;
}

/**
 * Transformed EventRequest document for Convex import
 */
export interface TransformedEventRequest {
  _id?: ConvexId;
  name: string;
  location: string;
  startDateTime: number;
  endDateTime: number;
  eventDescription: string;
  flyersNeeded: boolean;
  flyerType: string[];
  otherFlyerType?: string;
  flyerAdvertisingStartDate?: number;
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
  invoices?: unknown;
  needsGraphics: boolean;
  needsAsFunding: boolean;
  status: EventRequestStatus;
  declinedReason?: string;
  reviewFeedback?: string;
  requestedUser: ConvexId;
  auditLogs?: EventAuditLog[];
  isDraft?: boolean;
  department?: string;
  graphicsCompleted?: boolean;
  graphicsFiles?: string[];
  published?: boolean;
  createdAt: number;
  lastModified: number;
  lastModifiedBy?: ConvexId;
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
  dateOfPurchase: number;
}

export interface LegacyExpense {
  category: string;
  amount: number;
  description: string;
}

export interface AuditNote {
  note: string;
  createdBy: string;
  timestamp: number;
}

export interface AuditLog {
  action: string;
  createdBy: string;
  timestamp: number;
}

export interface AuditRequest {
  auditorId: string;
  requestedBy: string;
  requestedAt: number;
  status: 'pending' | 'completed' | 'declined';
  auditResult?: 'approved' | 'needs_changes';
  auditNotes?: string;
  completedAt?: number;
}

/**
 * Transformed Reimbursement document for Convex import
 */
export interface TransformedReimbursement {
  _id?: ConvexId;
  title: string;
  totalAmount: number;
  paymentMethod: string;
  status: ReimbursementStatus;
  submittedBy: ConvexId;
  additionalInfo: string;
  department: ReimbursementDepartment;
  auditNotes?: AuditNote[];
  auditLogs?: AuditLog[];
  auditRequests?: AuditRequest[];
  requiresExecutiveOverride?: boolean;
  receipts?: unknown;
  dateOfPurchase?: number;
  expenses?: unknown;
  createdAt: number;
  lastModified: number;
}

export type FundDepositStatus = 'pending' | 'approved' | 'declined';

/**
 * Transformed FundDeposit document for Convex import
 */
export interface TransformedFundDeposit {
  _id?: ConvexId;
  amount: number;
  depositedBy: ConvexId;
  submittedAt: number;
  status: FundDepositStatus;
  notes?: string;
  receiptFile?: string;
  approvedAt?: number;
  approvedBy?: ConvexId;
  auditLogs?: AuditLog[];
  createdAt: number;
  lastModified: number;
}

// ============================================================================
// INVITATION & ONBOARDING TYPES
// ============================================================================

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type OnboardingStatus = 'pending' | 'completed' | 'failed';

/**
 * Transformed OfficerInvitation document for Convex import
 */
export interface TransformedOfficerInvitation {
  _id?: ConvexId;
  name: string;
  email: string;
  role: UserRole;
  position: string;
  status: InvitationStatus;
  invitedBy: ConvexId;
  invitedAt: number;
  acceptedAt?: number;
  declinedAt?: number;
  expiresAt: number;
  message?: string;
  acceptanceDeadline?: string;
  leaderName?: string;
  googleGroupAssigned?: boolean;
  googleGroup?: GoogleGroup;
  permissionsGranted?: boolean;
  onboardingEmailSent?: boolean;
  resentAt?: number;
  lastSentAt?: number;
  roleGranted?: boolean;
  roleGrantedAt?: number;
  userCreatedOrUpdated?: boolean;
}

/**
 * Transformed DirectOnboarding document for Convex import
 */
export interface TransformedDirectOnboarding {
  _id?: ConvexId;
  name: string;
  email: string;
  role: UserRole;
  position: string;
  team?: OfficerTeam;
  status: OnboardingStatus;
  createdBy: ConvexId;
  createdAt: number;
  completedAt?: number;
  userCreated?: ConvexId;
  googleGroupAssigned?: boolean;
  googleGroup?: GoogleGroup;
  permissionsGranted?: boolean;
  onboardingEmailSent?: boolean;
  notes?: string;
}

/**
 * Transformed Invite document for Convex import
 */
export interface TransformedInvite {
  _id?: ConvexId;
  email: string;
  name: string;
  role: UserRole;
  status: InvitationStatus;
  invitedBy: ConvexId;
  invitedAt: number;
  acceptedAt?: number;
  expiresAt: number;
  message?: string;
  userId?: ConvexId;
}

// ============================================================================
// SPONSORSHIP & LINK TYPES
// ============================================================================

/**
 * Transformed SponsorDomain document for Convex import
 */
export interface TransformedSponsorDomain {
  _id?: ConvexId;
  domain: string;
  organizationName: string;
  sponsorTier: SponsorTier;
  createdAt: number;
  createdBy: ConvexId;
  lastModified?: number;
  lastModifiedBy?: ConvexId;
}

/**
 * Transformed Link document for Convex import
 */
export interface TransformedLink {
  _id?: ConvexId;
  url: string;
  title: string;
  category: string;
  description?: string;
  iconUrl?: string;
  shortUrl?: string;
  publishDate?: number;
  expireDate?: number;
  createdAt: number;
  createdBy: ConvexId;
  lastModified?: number;
  lastModifiedBy?: ConvexId;
  order?: number;
}

// ============================================================================
// CONSTITUTION TYPES
// ============================================================================

export type ConstitutionStatus = 'draft' | 'published' | 'archived';
export type SectionType = 'preamble' | 'article' | 'section' | 'subsection' | 'amendment';
export type ChangeType = 'create' | 'update' | 'delete' | 'reorder';

/**
 * Transformed Constitution document for Convex import
 */
export interface TransformedConstitution {
  _id?: ConvexId;
  title: string;
  organizationName: string;
  version: number;
  status: ConstitutionStatus;
  createdAt: number;
  lastModified: number;
  lastModifiedBy: ConvexId;
  collaborators: ConvexId[];
  isTemplate?: boolean;
}

/**
 * Transformed ConstitutionSection document for Convex import
 */
export interface TransformedConstitutionSection {
  _id?: ConvexId;
  constitutionId: ConvexId;
  type: SectionType;
  title: string;
  content: string;
  order: number;
  parentId?: ConvexId;
  articleNumber?: number;
  sectionNumber?: number;
  subsectionLetter?: string;
  amendmentNumber?: number;
  createdAt: number;
  lastModified: number;
  lastModifiedBy: ConvexId;
}

interface ConstitutionBeforeValue {
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

interface ConstitutionAfterValue extends ConstitutionBeforeValue {}

/**
 * Transformed ConstitutionAuditEntry document for Convex import
 */
export interface TransformedConstitutionAuditEntry {
  _id?: ConvexId;
  constitutionId: ConvexId;
  sectionId?: ConvexId;
  changeType: ChangeType;
  changeDescription: string;
  beforeValue?: ConstitutionBeforeValue;
  afterValue?: ConstitutionAfterValue;
  userId: ConvexId;
  userName: string;
  timestamp: number;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

/**
 * Transformed Notification document for Convex import
 */
export interface TransformedNotification {
  _id?: ConvexId;
  userId: ConvexId;
  type: string;
  title: string;
  message: string;
  data?: unknown;
  read: boolean;
  createdAt: number;
  expiresAt?: number;
}

// ============================================================================
// GOOGLE GROUP TYPES
// ============================================================================

export type AssignmentStatus = 'active' | 'removed' | 'pending';

/**
 * Transformed GoogleGroupAssignment document for Convex import
 */
export interface TransformedGoogleGroupAssignment {
  _id?: ConvexId;
  userId: ConvexId;
  googleGroup: GoogleGroup;
  assignedAt: number;
  assignedBy: ConvexId;
  status: AssignmentStatus;
  removedAt?: number;
  removedBy?: ConvexId;
  reason?: string;
}

// ============================================================================
// ORGANIZATION SETTINGS TYPES
// ============================================================================

/**
 * Transformed OrganizationSetting document for Convex import
 */
export interface TransformedOrganizationSetting {
  _id?: ConvexId;
  key: string;
  value: unknown;
  description?: string;
  category?: string;
  isPublic?: boolean;
  createdAt: number;
  lastModified: number;
  lastModifiedBy?: ConvexId;
}

// ============================================================================
// TRANSFORMATION RESULT TYPES
// ============================================================================

export interface TransformationResult {
  collection: string;
  success: boolean;
  documentCount: number;
  successCount: number;
  failureCount: number;
  warnings: string[];
  errors: string[];
  duration: number;
}

export interface TransformationReport {
  totalCollections: number;
  successfulTransformations: number;
  failedTransformations: number;
  totalDocuments: number;
  totalSuccesses: number;
  totalFailures: number;
  totalWarnings: number;
  results: TransformationResult[];
  duration: number;
  startTime: string;
  endTime: string;
}

export interface TransformationOptions {
  dryRun?: boolean;
  verbose?: boolean;
  selectedCollections?: string[];
  outputDir?: string;
  inputDir?: string;
  skipValidation?: boolean;
}

// ============================================================================
// UNION TYPE FOR ALL TRANSFORMED DOCUMENTS
// ============================================================================

export type TransformedDocument =
  | TransformedUser
  | TransformedUserRole
  | TransformedRoleAudit
  | TransformedEvent
  | TransformedEventAttendee
  | TransformedEventRequest
  | TransformedReimbursement
  | TransformedFundDeposit
  | TransformedPublicProfile
  | TransformedOfficerInvitation
  | TransformedDirectOnboarding
  | TransformedInvite
  | TransformedSponsorDomain
  | TransformedLink
  | TransformedConstitution
  | TransformedConstitutionSection
  | TransformedConstitutionAuditEntry
  | TransformedNotification
  | TransformedGoogleGroupAssignment
  | TransformedOrganizationSetting;
