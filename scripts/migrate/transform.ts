#!/usr/bin/env node
/**
 * Firestore to Convex Data Transformation Script
 *
 * This script transforms exported Firebase Firestore JSON data to Convex-compatible format.
 * It reads from the `exported/` directory and outputs to `transformed/` directory.
 *
 * Usage:
 *   - Transform all collections: npm run migrate:transform
 *   - Transform specific collection: npm run migrate:transform -- --collection users
 *   - Dry run: npm run migrate:transform -- --dry-run
 *   - Verbose: npm run migrate:transform -- --verbose
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type {
  TransformationOptions,
  TransformationResult,
  TransformationReport,
  TransformedDocument,
} from './transformed-types';
import type {
  ExportedDocument,
  ExportedSubcollectionDocument,
  Timestamp,
  User,
  PublicProfile,
  Event,
  EventAttendee,
  EventRequest,
  Reimbursement,
  FundDeposit,
  OfficerInvitation,
  DirectOnboarding,
  Invite,
  SponsorDomain,
  Link,
  Constitution,
  ConstitutionSectionExport,
  ConstitutionAuditEntryExport,
  Notification,
  GoogleGroupAssignment,
  OrganizationSetting,
} from './types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_INPUT_DIR = path.join(__dirname, 'exported');
const DEFAULT_OUTPUT_DIR = path.join(__dirname, 'transformed');

const COLLECTIONS = [
  'users',
  'public_profiles',
  'events',
  'events__attendees',
  'event_requests',
  'reimbursements',
  'fundDeposits',
  'officerInvitations',
  'directOnboardings',
  'invites',
  'sponsorDomains',
  'links',
  'constitutions',
  'constitutions__sections',
  'constitutions__auditLog',
  'notifications',
  'googleGroupAssignments',
  'organizationSettings',
] as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Logger utility with support for verbosity levels
 */
class Logger {
  verbose = false;
  dryRun = false;

  constructor(verbose = false, dryRun = false) {
    this.verbose = verbose;
    this.dryRun = dryRun;
  }

  info(message: string): void {
    console.log(`ℹ️  ${message}`);
  }

  success(message: string): void {
    console.log(`✅ ${message}`);
  }

  warn(message: string): void {
    console.warn(`⚠️  ${message}`);
  }

  error(message: string): void {
    console.error(`❌ ${message}`);
  }

  verboseLog(message: string): void {
    if (this.verbose) {
      console.log(`🔍 ${message}`);
    }
  }

  dryRunLog(message: string): void {
    if (this.dryRun) {
      console.log(`🔒 [DRY RUN] ${message}`);
    }
  }

  progress(current: number, total: number, message: string): void {
    const percentage = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.floor(percentage / 2)).padEnd(50, ' ');
    process.stdout.write(`\r[${bar}] ${percentage}% - ${message}`);
    if (current === total) {
      process.stdout.write('\n');
    }
  }
}

/**
 * Generate a unique Convex document ID
 */
function generateId(): string {
  return crypto.randomBytes(12).toString('hex');
}

/**
 * Transform Firestore Timestamp to milliseconds since epoch
 */
function transformTimestamp(timestamp: Timestamp | string | number | undefined | null): number | undefined {
  if (timestamp === undefined || timestamp === null) {
    return undefined;
  }

  // If already a number (milliseconds), return as-is
  if (typeof timestamp === 'number') {
    return timestamp;
  }

  // If a string (ISO format), convert to milliseconds
  if (typeof timestamp === 'string') {
    const parsed = new Date(timestamp);
    if (!isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
    return undefined;
  }

  // If Firestore Timestamp object
  if (typeof timestamp === 'object' && '_seconds' in timestamp && '_nanoseconds' in timestamp) {
    const ts = timestamp as Timestamp;
    return ts._seconds * 1000 + Math.floor(ts._nanoseconds / 1000000);
  }

  return undefined;
}

/**
 * Extract document ID from Firestore reference path
 * Handles formats like:
 * - "users/abc123"
 * - "projects/def/databases/abc/messages/xyz"
 * - "/users/abc123"
 */
function extractIdFromReference(
  reference: string | undefined | null,
  collectionHint?: string
): string | undefined {
  if (typeof reference !== 'string' || !reference.trim()) {
    return undefined;
  }

  // Remove leading slash if present
  const ref = reference.startsWith('/') ? reference.slice(1) : reference;

  // Split by '/' and get the last segment
  const parts = ref.split('/');
  const lastPart = parts[parts.length - 1];

  // Validate the ID looks like a Firebase/Convex ID
  if (lastPart && lastPart.length > 0 && !lastPart.includes('/')) {
    return lastPart;
  }

  return undefined;
}

/**
 * Transform string reference to Convex ID
 */
function transformReference(
  reference: string | undefined | null,
  collectionHint?: string
): string | undefined {
  return extractIdFromReference(reference, collectionHint);
}

/**
 * Transform array of string references to array of Convex IDs
 */
function transformReferenceArray(
  references: string[] | undefined | null,
  collectionHint?: string
): string[] | undefined {
  if (!Array.isArray(references)) {
    return undefined;
  }

  const result: string[] = [];
  for (const ref of references) {
    const id = extractIdFromReference(ref, collectionHint);
    if (id) {
      result.push(id);
    }
  }

  return result.length > 0 ? result : undefined;
}

/**
 * Transform user role from Firebase to Convex format
 */
function transformUserRole(role: string | undefined): 'member' | 'general_officer' | 'executive_officer' | 'member_at_large' | 'past_officer' | 'sponsor' | 'administrator' | undefined {
  if (!role) return undefined;

  const roleMap: Record<string, 'member' | 'general_officer' | 'executive_officer' | 'member_at_large' | 'past_officer' | 'sponsor' | 'administrator'> = {
    'Member': 'member',
    'General Officer': 'general_officer',
    'Executive Officer': 'executive_officer',
    'Member at Large': 'member_at_large',
    'Past Officer': 'past_officer',
    'Sponsor': 'sponsor',
    'Administrator': 'administrator',
    'member': 'member',
    'general_officer': 'general_officer',
    'executive_officer': 'executive_officer',
    'member_at_large': 'member_at_large',
    'past_officer': 'past_officer',
    'sponsor': 'sponsor',
    'administrator': 'administrator',
  };

  return roleMap[role];
}

/**
 * Validate required fields in transformed document
 */
function validateRequired<T extends Record<string, unknown>>(
  doc: T,
  requiredFields: (keyof T)[],
  logger: Logger,
  docId: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of requiredFields) {
    if (doc[field] === undefined || doc[field] === null) {
      errors.push(`Missing required field '${String(field)}'`);
    }
  }

  if (errors.length > 0) {
    logger.warn(`Document ${docId} validation failed: ${errors.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// COLLECTION TRANSFORMATIONS
// ============================================================================

/**
 * Transform users collection
 */
function transformUser(doc: User, logger: Logger): TransformedDocument | null {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Generate logtoSub if not present (for migration)
  const logtoSub = doc.email; // Use email as placeholder - will need to be updated with actual Logto sub

  // Transform timestamps
  const lastLogin = transformTimestamp(doc.lastLogin);
  const joinDate = transformTimestamp(doc.joinDate);
  const inviteAccepted = transformTimestamp(doc.inviteAccepted);
  const lastUpdated = transformTimestamp(doc.lastUpdated);
  const ieeeEmailCreatedAt = transformTimestamp(doc.ieeeEmailCreatedAt);

  // Transform references
  const invitedBy = transformReference(doc.invitedBy, 'users');
  const lastUpdatedBy = transformReference(doc.lastUpdatedBy, 'users');

  // Generate timestamps for new fields
  const now = Date.now();
  const createdAt = doc._id ? now : now;
  const updatedAt = lastUpdated || now;

  // Transform enum values
  let team: 'Internal' | 'Events' | 'Projects' | undefined = undefined;
  if (doc.team && ['Internal', 'Events', 'Projects'].includes(doc.team)) {
    team = doc.team;
  }

  // Build transformed document
  const transformed = {
    _id: doc._id || generateId(),
    logtoSub,
    email: doc.email,
    name: doc.name,
    avatarUrl: doc.avatar,
    createdAt,
    updatedAt,
    emailVisibility: doc.emailVisibility,
    verified: doc.verified,
    username: doc.username,
    pid: doc.pid,
    memberId: doc.memberId,
    graduationYear: doc.graduationYear,
    major: doc.major,
    zelleInformation: doc.zelleInformation,
    lastLogin,
    notificationPreferences: doc.notificationPreferences,
    displayPreferences: doc.displayPreferences,
    accessibilitySettings: doc.accessibilitySettings,
    navigationLayout: doc.navigationLayout,
    resume: doc.resume,
    signedUp: doc.signedUp,
    requestedEmail: doc.requestedEmail,
    position: doc.position,
    status: doc.status,
    joinDate,
    eventsAttended: doc.eventsAttended,
    points: doc.points,
    team,
    invitedBy,
    inviteAccepted,
    lastUpdated,
    lastUpdatedBy,
    signInMethod: doc.signInMethod,
    hasIEEEEmail: doc.hasIEEEEmail,
    ieeeEmail: doc.ieeeEmail,
    ieeeEmailCreatedAt,
    sponsorTier: doc.sponsorTier,
    sponsorOrganization: doc.sponsorOrganization,
    autoAssignedSponsor: doc.autoAssignedSponsor,
  };

  // Validate required fields
  const validationResult = validateRequired(transformed, ['logtoSub', 'email', 'createdAt', 'updatedAt'], logger, doc._id);
  errors.push(...validationResult.errors);

  // Log warnings
  if (warnings.length > 0) {
    logger.verboseLog(`User ${doc._id}: ${warnings.join(', ')}`);
  }

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform public_profiles collection
 */
function transformPublicProfile(doc: PublicProfile, logger: Logger): TransformedDocument | null {
  const now = Date.now();

  const transformed = {
    _id: doc._id || generateId(),
    // Note: userId needs to be mapped from email to user ID - this will require post-processing
    userId: doc._id, // Placeholder - will be updated via mapping
    name: doc.name,
    major: doc.major,
    points: doc.points,
    totalEventsAttended: doc.totalEventsAttended,
    createdAt: now,
    updatedAt: now,
  };

  const validationResult = validateRequired(
    transformed,
    ['userId', 'name', 'major', 'points', 'totalEventsAttended'],
    logger,
    doc._id
  );

  return validationResult.valid ? transformed : null;
}

/**
 * Transform events collection
 */
function transformEvent(doc: Event, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // Transform timestamps
  const startDate = transformTimestamp(doc.startDate);
  const endDate = transformTimestamp(doc.endDate);

  if (!startDate || !endDate) {
    errors.push(`Invalid timestamps for event ${doc._id}`);
    return null;
  }

  // Transform reference
  const createdFrom = transformReference(doc.createdFrom, 'event_requests');

  const now = Date.now();
  const createdAt = doc._id ? now : now;

  const transformed = {
    _id: doc._id || generateId(),
    eventName: doc.eventName,
    eventDescription: doc.eventDescription,
    eventCode: doc.eventCode,
    location: doc.location,
    files: doc.files,
    pointsToReward: doc.pointsToReward,
    startDate,
    endDate,
    published: doc.published,
    eventType: doc.eventType,
    hasFood: doc.hasFood,
    createdFrom,
    createdAt,
    createdBy: undefined, // No createdBy in Firebase
  };

  const validationResult = validateRequired(
    transformed,
    [
      'eventName',
      'eventDescription',
      'eventCode',
      'location',
      'files',
      'pointsToReward',
      'startDate',
      'endDate',
      'published',
      'eventType',
      'hasFood',
      'createdAt',
    ],
    logger,
    doc._id
  );
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform event_attendees collection (subcollection)
 */
function transformEventAttendee(doc: EventAttendee, logger: Logger): TransformedDocument | null {
  // eventId comes from _parentId in subcollection export
  const eventId = doc._parentId;
  if (!eventId) {
    logger.error(`EventAttendee ${doc._id} missing _parentId`);
    return null;
  }

  // Transform timestamps
  const timeCheckedIn = transformTimestamp(doc.timeCheckedIn);
  if (!timeCheckedIn) {
    logger.error(`EventAttendee ${doc._id} has invalid timeCheckedIn`);
    return null;
  }

  // Transform reference
  const userId = transformReference(doc.userId, 'users');
  if (!userId) {
    logger.error(`EventAttendee ${doc._id} has invalid userId`);
    return null;
  }

  const now = Date.now();

  const transformed = {
    _id: doc._id || generateId(),
    eventId,
    userId,
    timeCheckedIn,
    food: doc.food,
    pointsEarned: doc.pointsEarned,
    checkedInAt: now,
  };

  const validationResult = validateRequired(transformed, ['eventId', 'userId', 'timeCheckedIn', 'food', 'pointsEarned'], logger, doc._id);

  return validationResult.valid ? transformed : null;
}

/**
 * Transform event_requests collection
 */
function transformEventRequest(doc: EventRequest, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // Transform timestamps
  const startDateTime = transformTimestamp(doc.startDateTime);
  const endDateTime = transformTimestamp(doc.endDateTime);
  const flyerAdvertisingStartDate = transformTimestamp(doc.flyerAdvertisingStartDate);

  if (!startDateTime || !endDateTime) {
    errors.push(`Invalid timestamps for eventRequest ${doc._id}`);
    return null;
  }

  // Transform references
  const requestedUser = transformReference(doc.requestedUser, 'users');
  if (!requestedUser) {
    errors.push(`Invalid requestedUser for eventRequest ${doc._id}`);
  }

  // Transform audit logs timestamps
  const auditLogs = doc.auditLogs?.map((log) => ({
    ...log,
    timestamp: transformTimestamp(log.timestamp) || 0,
  }));

  const now = Date.now();

  const transformed = {
    _id: doc._id || generateId(),
    name: doc.name,
    location: doc.location,
    startDateTime,
    endDateTime,
    eventDescription: doc.eventDescription,
    flyersNeeded: doc.flyersNeeded,
    flyerType: doc.flyerType,
    otherFlyerType: doc.otherFlyerType,
    flyerAdvertisingStartDate,
    flyerAdditionalRequests: doc.flyerAdditionalRequests,
    flyersCompleted: doc.flyersCompleted,
    photographyNeeded: doc.photographyNeeded,
    requiredLogos: doc.requiredLogos,
    otherLogos: doc.otherLogos,
    advertisingFormat: doc.advertisingFormat,
    willOrHaveRoomBooking: doc.willOrHaveRoomBooking,
    expectedAttendance: doc.expectedAttendance,
    roomBookingFiles: doc.roomBookingFiles,
    asFundingRequired: doc.asFundingRequired,
    foodDrinksBeingServed: doc.foodDrinksBeingServed,
    invoices: doc.invoices,
    needsGraphics: doc.needsGraphics || false,
    needsAsFunding: doc.needsAsFunding,
    status: doc.status,
    declinedReason: doc.declinedReason,
    reviewFeedback: doc.reviewFeedback,
    requestedUser: requestedUser!,
    auditLogs,
    isDraft: doc.isDraft,
    department: doc.department,
    graphicsCompleted: doc.graphicsCompleted,
    graphicsFiles: doc.graphicsFiles,
    published: doc.published,
    createdAt: now,
    lastModified: now,
    lastModifiedBy: undefined,
  };

  const validationResult = validateRequired(transformed, ['name', 'requestedUser', 'status', 'createdAt'], logger, doc._id);
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform reimbursements collection
 */
function transformReimbursement(doc: Reimbursement, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // Transform references
  const submittedBy = transformReference(doc.submittedBy, 'users');
  if (!submittedBy) {
    errors.push(`Invalid submittedBy for reimbursement ${doc._id}`);
  }

  // Transform audit logs timestamps
  const auditLogs = doc.auditLogs?.map((log) => ({
    ...log,
    timestamp: transformTimestamp(log.timestamp) || 0,
  }));

  const auditNotes = doc.auditNotes?.map((note) => ({
    ...note,
    timestamp: transformTimestamp(note.timestamp) || 0,
  }));

  // Transform receipts timestamps
  const receipts = doc.receipts?.map((receipt) => ({
    ...receipt,
    dateOfPurchase: transformTimestamp(receipt.dateOfPurchase) || 0,
  }));

  const dateOfPurchase = transformTimestamp(doc.dateOfPurchase);

  const now = Date.now();

  const transformed = {
    _id: doc._id || generateId(),
    title: doc.title,
    totalAmount: doc.totalAmount,
    paymentMethod: doc.paymentMethod,
    status: doc.status,
    submittedBy: submittedBy!,
    additionalInfo: doc.additionalInfo,
    department: doc.department,
    auditNotes,
    auditLogs,
    auditRequests: doc.auditRequests,
    requiresExecutiveOverride: doc.requiresExecutiveOverride,
    receipts,
    dateOfPurchase,
    expenses: doc.expenses,
    createdAt: now,
    lastModified: now,
  };

  const validationResult = validateRequired(transformed, ['submittedBy', 'status'], logger, doc._id);
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform fundDeposits collection
 */
function transformFundDeposit(doc: FundDeposit, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // Transform references
  const depositedBy = transformReference(doc.depositedBy, 'users');
  if (!depositedBy) {
    errors.push(`Invalid depositedBy for fundDeposit ${doc._id}`);
  }

  const approvedBy = transformReference(doc.approvedBy, 'users');

  // Transform timestamps
  const submittedAt = transformTimestamp(doc.submittedAt);
  const approvedAt = transformTimestamp(doc.approvedAt);

  const auditLogs = doc.auditLogs?.map((log) => ({
    ...log,
    timestamp: transformTimestamp(log.timestamp) || 0,
  }));

  const now = Date.now();

  const transformed = {
    _id: doc._id || generateId(),
    amount: doc.amount,
    depositedBy: depositedBy!,
    submittedAt: submittedAt || now,
    status: doc.status,
    notes: doc.notes,
    receiptFile: doc.receiptFile,
    approvedAt,
    approvedBy,
    auditLogs,
    createdAt: now,
    lastModified: now,
  };

  const validationResult = validateRequired(transformed, ['depositedBy', 'status'], logger, doc._id);
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform officerInvitations collection
 */
function transformOfficerInvitation(doc: OfficerInvitation, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // Transform references
  const invitedBy = transformReference(doc.invitedBy, 'users');
  if (!invitedBy) {
    errors.push(`Invalid invitedBy for officerInvitation ${doc._id}`);
  }

  // Transform timestamps
  const invitedAt = transformTimestamp(doc.invitedAt);
  const acceptedAt = transformTimestamp(doc.acceptedAt);
  const declinedAt = transformTimestamp(doc.declinedAt);
  const expiresAt = transformTimestamp(doc.expiresAt);
  const resentAt = transformTimestamp(doc.resentAt);
  const lastSentAt = transformTimestamp(doc.lastSentAt);
  const roleGrantedAt = transformTimestamp(doc.roleGrantedAt);

  if (!expiresAt) {
    errors.push(`Invalid expiresAt for officerInvitation ${doc._id}`);
  }

  // Transform role
  const role = transformUserRole(doc.role);
  if (!role) {
    errors.push(`Invalid role for officerInvitation ${doc._id}: ${doc.role}`);
  }

  const transformed = {
    _id: doc._id || generateId(),
    name: doc.name,
    email: doc.email,
    role: role!,
    position: doc.position,
    status: doc.status,
    invitedBy: invitedBy!,
    invitedAt: invitedAt || Date.now(),
    acceptedAt,
    declinedAt,
    expiresAt: expiresAt!,
    message: doc.message,
    acceptanceDeadline: doc.acceptanceDeadline,
    leaderName: doc.leaderName,
    googleGroupAssigned: doc.googleGroupAssigned,
    googleGroup: doc.googleGroup,
    permissionsGranted: doc.permissionsGranted,
    onboardingEmailSent: doc.onboardingEmailSent,
    resentAt,
    lastSentAt,
    roleGranted: doc.roleGranted,
    roleGrantedAt,
    userCreatedOrUpdated: doc.userCreatedOrUpdated,
  };

  const validationResult = validateRequired(transformed, ['email', 'role', 'invitedBy', 'expiresAt'], logger, doc._id);
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform directOnboardings collection
 */
function transformDirectOnboarding(doc: DirectOnboarding, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // Transform references
  const createdBy = transformReference(doc.createdBy, 'users');
  if (!createdBy) {
    errors.push(`Invalid createdBy for directOnboarding ${doc._id}`);
  }

  const userCreated = transformReference(doc.userCreated, 'users');

  // Transform timestamps
  const createdAt = transformTimestamp(doc.createdAt);
  const completedAt = transformTimestamp(doc.completedAt);

  // Transform role
  const role = transformUserRole(doc.role);
  if (!role) {
    errors.push(`Invalid role for directOnboarding ${doc._id}: ${doc.role}`);
  }

  // Validate team
  const validTeams = ['Internal', 'Events', 'Projects'];
  const team = doc.team && validTeams.includes(doc.team) ? doc.team : undefined;

  const transformed = {
    _id: doc._id || generateId(),
    name: doc.name,
    email: doc.email,
    role: role!,
    position: doc.position,
    team,
    status: doc.status,
    createdBy: createdBy!,
    createdAt: createdAt || Date.now(),
    completedAt,
    userCreated,
    googleGroupAssigned: doc.googleGroupAssigned,
    googleGroup: doc.googleGroup,
    permissionsGranted: doc.permissionsGranted,
    onboardingEmailSent: doc.onboardingEmailSent,
    notes: doc.notes,
  };

  const validationResult = validateRequired(transformed, ['email', 'role', 'createdBy'], logger, doc._id);
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform invites collection
 */
function transformInvite(doc: Invite, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // Transform references
  const invitedBy = transformReference(doc.invitedBy, 'users');
  if (!invitedBy) {
    errors.push(`Invalid invitedBy for invite ${doc._id}`);
  }

  // Transform timestamps
  const invitedAt = transformTimestamp(doc.invitedAt);
  const acceptedAt = transformTimestamp(doc.acceptedAt);
  const expiresAt = transformTimestamp(doc.expiresAt);

  // Transform role
  const role = transformUserRole(doc.role);
  if (!role) {
    errors.push(`Invalid role for invite ${doc._id}: ${doc.role}`);
  }

  const transformed = {
    _id: doc._id || generateId(),
    email: doc.email,
    name: doc.name,
    role: role!,
    status: doc.status,
    invitedBy: invitedBy!,
    invitedAt: invitedAt || Date.now(),
    acceptedAt,
    expiresAt: expiresAt || Date.now(),
    message: doc.message,
    userId: undefined, // Will be linked when invite is accepted
  };

  const validationResult = validateRequired(transformed, ['email', 'role', 'invitedBy'], logger, doc._id);
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform sponsorDomains collection
 */
function transformSponsorDomain(doc: SponsorDomain, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // Transform references
  const createdBy = transformReference(doc.createdBy, 'users');
  if (!createdBy) {
    errors.push(`Invalid createdBy for sponsorDomain ${doc._id}`);
  }

  const lastModifiedBy = transformReference(doc.lastModifiedBy, 'users');

  // Transform timestamps
  const createdAt = transformTimestamp(doc.createdAt);
  const lastModified = transformTimestamp(doc.lastModified);

  // Validate sponsorTier
  const validTiers = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
  if (!validTiers.includes(doc.sponsorTier)) {
    errors.push(`Invalid sponsorTier for sponsorDomain ${doc._id}: ${doc.sponsorTier}`);
  }

  const transformed = {
    _id: doc._id || generateId(),
    domain: doc.domain,
    organizationName: doc.organizationName,
    sponsorTier: doc.sponsorTier,
    createdAt: createdAt || Date.now(),
    createdBy: createdBy!,
    lastModified,
    lastModifiedBy,
  };

  const validationResult = validateRequired(
    transformed,
    ['domain', 'organizationName', 'sponsorTier', 'createdBy'],
    logger,
    doc._id
  );
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform links collection
 */
function transformLink(doc: Link, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // Transform references
  const createdBy = transformReference(doc.createdBy, 'users');
  if (!createdBy) {
    errors.push(`Invalid createdBy for link ${doc._id}`);
  }

  const lastModifiedBy = transformReference(doc.lastModifiedBy, 'users');

  // Transform timestamps
  const publishDate = transformTimestamp(doc.publishDate);
  const expireDate = transformTimestamp(doc.expireDate);
  const createdAt = transformTimestamp(doc.createdAt);
  const lastModified = transformTimestamp(doc.lastModified);

  const transformed = {
    _id: doc._id || generateId(),
    url: doc.url,
    title: doc.title,
    category: doc.category,
    description: doc.description,
    iconUrl: doc.iconUrl,
    shortUrl: doc.shortUrl,
    publishDate,
    expireDate,
    createdAt: createdAt || Date.now(),
    createdBy: createdBy!,
    lastModified,
    lastModifiedBy,
    order: doc.order,
  };

  const validationResult = validateRequired(transformed, ['url', 'title', 'category', 'createdBy'], logger, doc._id);
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform constitutions collection
 */
function transformConstitution(doc: Constitution, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // Transform references
  const lastModifiedBy = transformReference(doc.lastModifiedBy, 'users');
  if (!lastModifiedBy) {
    errors.push(`Invalid lastModifiedBy for constitution ${doc._id}`);
  }

  const collaborators = transformReferenceArray(doc.collaborators, 'users');

  // Transform timestamps
  const createdAt = transformTimestamp(doc.createdAt);
  const lastModified = transformTimestamp(doc.lastModified);

  // Validate status
  const validStatuses = ['draft', 'published', 'archived'];
  if (!validStatuses.includes(doc.status)) {
    errors.push(`Invalid status for constitution ${doc._id}: ${doc.status}`);
  }

  const transformed = {
    _id: doc._id || generateId(),
    title: doc.title,
    organizationName: doc.organizationName,
    version: doc.version,
    status: doc.status,
    createdAt: createdAt || Date.now(),
    lastModified: lastModified || Date.now(),
    lastModifiedBy: lastModifiedBy!,
    collaborators: collaborators || [],
    isTemplate: doc.isTemplate,
  };

  const validationResult = validateRequired(
    transformed,
    ['title', 'organizationName', 'version', 'status', 'lastModifiedBy'],
    logger,
    doc._id
  );
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform constitution_sections collection (subcollection)
 */
function transformConstitutionSection(doc: ConstitutionSectionExport, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // constitutionId comes from _parentId in subcollection export
  const constitutionId = doc._parentId;
  if (!constitutionId) {
    logger.error(`ConstitutionSection ${doc._id} missing _parentId`);
    return null;
  }

  // Transform references
  const lastModifiedBy = transformReference(doc.lastModifiedBy, 'users');
  if (!lastModifiedBy) {
    errors.push(`Invalid lastModifiedBy for constitutionSection ${doc._id}`);
  }

  // parentId is a self-reference to constitution_sections
  const parentId = doc.parentId; // Already an ID, not a reference path

  // Transform timestamps
  const createdAt = transformTimestamp(doc.createdAt);
  const lastModified = transformTimestamp(doc.lastModified);

  // Validate type
  const validTypes = ['preamble', 'article', 'section', 'subsection', 'amendment'];
  if (!validTypes.includes(doc.type)) {
    errors.push(`Invalid type for constitutionSection ${doc._id}: ${doc.type}`);
  }

  const transformed = {
    _id: doc._id || generateId(),
    constitutionId,
    type: doc.type,
    title: doc.title,
    content: doc.content,
    order: doc.order,
    parentId,
    articleNumber: doc.articleNumber,
    sectionNumber: doc.sectionNumber,
    subsectionLetter: doc.subsectionLetter,
    amendmentNumber: doc.amendmentNumber,
    createdAt: createdAt || Date.now(),
    lastModified: lastModified || Date.now(),
    lastModifiedBy: lastModifiedBy!,
  };

  const validationResult = validateRequired(transformed, ['constitutionId', 'type', 'title', 'content', 'order', 'lastModifiedBy'], logger, doc._id);
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform constitution_audit_log collection (subcollection)
 */
function transformConstitutionAuditEntry(doc: ConstitutionAuditEntryExport, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // constitutionId comes from _parentId in subcollection export
  const constitutionId = doc._parentId;
  if (!constitutionId) {
    logger.error(`ConstitutionAuditEntry ${doc._id} missing _parentId`);
    return null;
  }

  // Transform references
  const userId = transformReference(doc.userId, 'users');
  if (!userId) {
    errors.push(`Invalid userId for constitutionAuditEntry ${doc._id}`);
  }

  // sectionId is a self-reference to constitution_sections
  const sectionId = doc.sectionId; // Already an ID, not a reference path

  // Transform timestamps
  const timestamp = transformTimestamp(doc.timestamp);
  if (!timestamp) {
    errors.push(`Invalid timestamp for constitutionAuditEntry ${doc._id}`);
  }

  // Validate changeType
  const validChangeTypes = ['create', 'update', 'delete', 'reorder'];
  if (!validChangeTypes.includes(doc.changeType)) {
    errors.push(`Invalid changeType for constitutionAuditEntry ${doc._id}: ${doc.changeType}`);
  }

  const transformed = {
    _id: doc._id || generateId(),
    constitutionId,
    sectionId,
    changeType: doc.changeType,
    changeDescription: doc.changeDescription,
    beforeValue: doc.beforeValue,
    afterValue: doc.afterValue,
    userId: userId!,
    userName: doc.userName,
    timestamp: timestamp!,
    ipAddress: doc.ipAddress,
    userAgent: doc.userAgent,
  };

  const validationResult = validateRequired(transformed, ['constitutionId', 'changeType', 'changeDescription', 'userId', 'timestamp'], logger, doc._id);
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform notifications collection
 */
function transformNotification(doc: Notification, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // Transform references
  const userId = transformReference(doc.userId, 'users');
  if (!userId) {
    errors.push(`Invalid userId for notification ${doc._id}`);
  }

  // Transform timestamps
  const createdAt = transformTimestamp(doc.createdAt);
  const expiresAt = transformTimestamp(doc.expiresAt);

  const transformed = {
    _id: doc._id || generateId(),
    userId: userId!,
    type: doc.type,
    title: doc.title,
    message: doc.message,
    data: doc.data,
    read: doc.read,
    createdAt: createdAt || Date.now(),
    expiresAt,
  };

  const validationResult = validateRequired(transformed, ['userId', 'type', 'title', 'message', 'read'], logger, doc._id);
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform googleGroupAssignments collection
 */
function transformGoogleGroupAssignment(doc: GoogleGroupAssignment, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // Transform references
  const userId = transformReference(doc.userId, 'users');
  const assignedBy = transformReference(doc.assignedBy, 'users');
  const removedBy = transformReference(doc.removedBy, 'users');

  if (!userId) {
    errors.push(`Invalid userId for googleGroupAssignment ${doc._id}`);
  }
  if (!assignedBy) {
    errors.push(`Invalid assignedBy for googleGroupAssignment ${doc._id}`);
  }

  // Transform timestamps
  const assignedAt = transformTimestamp(doc.assignedAt);
  const removedAt = transformTimestamp(doc.removedAt);

  // Validate googleGroup
  const validGroups = ['executive-officers@ieeeatucsd.org', 'general-officers@ieeeatucsd.org', 'past-officers@ieeeatucsd.org'];
  if (!validGroups.includes(doc.googleGroup)) {
    errors.push(`Invalid googleGroup for googleGroupAssignment ${doc._id}: ${doc.googleGroup}`);
  }

  // Validate status
  const validStatuses = ['active', 'removed', 'pending'];
  if (!validStatuses.includes(doc.status)) {
    errors.push(`Invalid status for googleGroupAssignment ${doc._id}: ${doc.status}`);
  }

  const transformed = {
    _id: doc._id || generateId(),
    userId: userId!,
    googleGroup: doc.googleGroup,
    assignedAt: assignedAt || Date.now(),
    assignedBy: assignedBy!,
    status: doc.status,
    removedAt,
    removedBy,
    reason: doc.reason,
  };

  const validationResult = validateRequired(transformed, ['userId', 'googleGroup', 'assignedBy', 'status'], logger, doc._id);
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

/**
 * Transform organizationSettings collection
 */
function transformOrganizationSetting(doc: OrganizationSetting, logger: Logger): TransformedDocument | null {
  const errors: string[] = [];

  // Transform references
  const lastModifiedBy = transformReference(doc.lastModifiedBy, 'users');

  // Transform timestamps
  const createdAt = transformTimestamp(doc.createdAt);
  const lastModified = transformTimestamp(doc.lastModified);

  const now = Date.now();

  const transformed = {
    _id: doc._id || generateId(),
    key: doc.key,
    value: doc.value,
    description: doc.description,
    category: doc.category,
    isPublic: doc.isPublic,
    createdAt: createdAt || now,
    lastModified: lastModified || now,
    lastModifiedBy,
  };

  const validationResult = validateRequired(transformed, ['key', 'value'], logger, doc._id);
  errors.push(...validationResult.errors);

  return errors.length === 0 ? transformed : null;
}

// ============================================================================
// COLLECTION TRANSFORMATION MAP
// ============================================================================

const COLLECTION_TRANSFORMERS: Record<string, (doc: ExportedDocument, logger: Logger) => TransformedDocument | null> = {
  users: transformUser,
  public_profiles: transformPublicProfile,
  events: transformEvent,
  events__attendees: transformEventAttendee,
  event_requests: transformEventRequest,
  reimbursements: transformReimbursement,
  fundDeposits: transformFundDeposit,
  officerInvitations: transformOfficerInvitation,
  directOnboardings: transformDirectOnboarding,
  invites: transformInvite,
  sponsorDomains: transformSponsorDomain,
  links: transformLink,
  constitutions: transformConstitution,
  constitutions__sections: transformConstitutionSection,
  constitutions__auditLog: transformConstitutionAuditEntry,
  notifications: transformNotification,
  googleGroupAssignments: transformGoogleGroupAssignment,
  organizationSettings: transformOrganizationSetting,
};

// ============================================================================
// FILE I/O FUNCTIONS
// ============================================================================

/**
 * Read exported JSON file
 */
async function readExportedJson<T extends ExportedDocument>(filePath: string): Promise<T[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(content) as Record<string, T>;
  return Object.values(data);
}

/**
 * Write transformed JSON file
 */
async function writeTransformedJson<T extends TransformedDocument>(filePath: string, documents: T[]): Promise<void> {
  // Convert array to object with _id as key
  const data: Record<string, T> = {};
  for (const doc of documents) {
    data[doc._id as string] = doc;
  }
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Ensure output directory exists
 */
async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// ============================================================================
// MAIN TRANSFORMATION LOGIC
// ============================================================================

/**
 * Transform a single collection
 */
async function transformCollection(
  collectionName: string,
  inputDir: string,
  outputDir: string,
  logger: Logger,
  dryRun: boolean
): Promise<TransformationResult> {
  const startTime = Date.now();
  const warnings: string[] = [];
  const errors: string[] = [];
  let successCount = 0;
  let failureCount = 0;

  logger.info(`Transforming collection: ${collectionName}`);

  // Determine input file path
  const inputFile = path.join(inputDir, `${collectionName}.json`);

  try {
    // Check if input file exists
    await fs.access(inputFile);
  } catch {
    const error = `Input file not found: ${inputFile}`;
    logger.error(error);
    errors.push(error);
    return {
      collection: collectionName,
      success: false,
      documentCount: 0,
      successCount: 0,
      failureCount: 0,
      warnings,
      errors,
      duration: Date.now() - startTime,
    };
  }

  // Read exported documents
  const exportedDocs = await readExportedJson<ExportedDocument>(inputFile);
  const documentCount = exportedDocs.length;

  logger.verboseLog(`Found ${documentCount} documents in ${collectionName}`);

  if (documentCount === 0) {
    logger.warn(`No documents to transform in ${collectionName}`);
    return {
      collection: collectionName,
      success: true,
      documentCount: 0,
      successCount: 0,
      failureCount: 0,
      warnings,
      errors,
      duration: Date.now() - startTime,
    };
  }

  // Get transformer for this collection
  const transformer = COLLECTION_TRANSFORMERS[collectionName];
  if (!transformer) {
    const error = `No transformer found for collection: ${collectionName}`;
    logger.error(error);
    errors.push(error);
    return {
      collection: collectionName,
      success: false,
      documentCount,
      successCount: 0,
      failureCount: documentCount,
      warnings,
      errors,
      duration: Date.now() - startTime,
    };
  }

  // Transform documents
  const transformedDocs: TransformedDocument[] = [];

  for (let i = 0; i < exportedDocs.length; i++) {
    const doc = exportedDocs[i];

    if (i % 10 === 0 || i === exportedDocs.length - 1) {
      logger.progress(i + 1, exportedDocs.length, `Processing ${collectionName}`);
    }

    try {
      const transformed = transformer(doc, logger);
      if (transformed) {
        transformedDocs.push(transformed);
        successCount++;
      } else {
        failureCount++;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Document ${doc._id}: ${errorMsg}`);
      failureCount++;
      logger.verboseLog(`Error transforming document ${doc._id}: ${errorMsg}`);
    }
  }

  // Write transformed documents
  if (!dryRun && transformedDocs.length > 0) {
    const outputFile = path.join(outputDir, `${collectionName}.json`);
    await ensureDirectory(outputDir);
    await writeTransformedJson(outputFile, transformedDocs);
    logger.dryRunLog(`Would write ${transformedDocs.length} documents to ${outputFile}`);
  }

  const duration = Date.now() - startTime;

  if (failureCount > 0) {
    logger.warn(
      `${collectionName}: ${successCount} succeeded, ${failureCount} failed (${duration}ms)`
    );
  } else {
    logger.success(`${collectionName}: ${successCount} documents transformed successfully (${duration}ms)`);
  }

  // Collect warnings and errors from transformation
  if (errors.length > 0 && logger.verbose) {
    logger.verboseLog(`Errors in ${collectionName}:`);
    for (const error of errors.slice(0, 10)) {
      logger.verboseLog(`  - ${error}`);
    }
    if (errors.length > 10) {
      logger.verboseLog(`  ... and ${errors.length - 10} more errors`);
    }
  }

  return {
    collection: collectionName,
    success: failureCount === 0,
    documentCount,
    successCount,
    failureCount,
    warnings,
    errors,
    duration,
  };
}

/**
 * Transform all collections
 */
async function transformAll(
  options: TransformationOptions = {}
): Promise<TransformationReport> {
  const logger = new Logger(options.verbose, options.dryRun);

  const inputDir = options.inputDir || DEFAULT_INPUT_DIR;
  const outputDir = options.outputDir || DEFAULT_OUTPUT_DIR;
  const selectedCollections = options.selectedCollections || [...COLLECTIONS];

  const startTime = Date.now();
  const reportStart = new Date().toISOString();

  logger.info('=' .repeat(60));
  logger.info('Firestore to Convex Data Transformation');
  logger.info('=' .repeat(60));
  logger.info(`Input directory: ${inputDir}`);
  logger.info(`Output directory: ${outputDir}`);
  logger.info(`Dry run: ${options.dryRun ? 'YES' : 'NO'}`);
  logger.info(`Collections to transform: ${selectedCollections.length}`);
  if (options.verbose) {
    logger.info(`Collections: ${selectedCollections.join(', ')}`);
  }
  logger.info('');

  // Transform each collection
  const results: TransformationResult[] = [];

  for (const collectionName of selectedCollections) {
    const result = await transformCollection(
      collectionName,
      inputDir,
      outputDir,
      logger,
      options.dryRun || false
    );
    results.push(result);
    logger.info('');
  }

  const endTime = Date.now();
  const reportEnd = new Date().toISOString();

  // Calculate summary
  const totalDocuments = results.reduce((sum, r) => sum + r.documentCount, 0);
  const totalSuccesses = results.reduce((sum, r) => sum + r.successCount, 0);
  const totalFailures = results.reduce((sum, r) => sum + r.failureCount, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  const successfulTransformations = results.filter(r => r.success).length;
  const failedTransformations = results.filter(r => !r.success).length;

  const report: TransformationReport = {
    totalCollections: selectedCollections.length,
    successfulTransformations,
    failedTransformations,
    totalDocuments,
    totalSuccesses,
    totalFailures,
    totalWarnings,
    results,
    duration: endTime - startTime,
    startTime: reportStart,
    endTime: reportEnd,
  };

  // Print summary
  logger.info('=' .repeat(60));
  logger.info('Transformation Summary');
  logger.info('=' .repeat(60));
  logger.info(`Total collections: ${report.totalCollections}`);
  logger.info(`Successful: ${report.successfulTransformations}`);
  logger.info(`Failed: ${report.failedTransformations}`);
  logger.info(`Total documents: ${report.totalDocuments}`);
  logger.info(`Successes: ${report.totalSuccesses}`);
  logger.info(`Failures: ${report.totalFailures}`);
  if (report.totalWarnings > 0) {
    logger.info(`Warnings: ${report.totalWarnings}`);
  }
  logger.info(`Duration: ${(report.duration / 1000).toFixed(2)}s`);
  logger.info(`Started: ${report.startTime}`);
  logger.info(`Ended: ${report.endTime}`);
  logger.info('=' .repeat(60));

  if (failedTransformations > 0) {
    logger.error('Some transformations failed. Please review the errors above.');
  } else if (totalFailures > 0) {
    logger.warn(`All collections transformed, but ${totalFailures} documents had errors.`);
  } else {
    logger.success('All transformations completed successfully!');
  }

  // Save report to file
  if (!options.dryRun) {
    const reportPath = path.join(outputDir, 'transformation-report.json');
    await ensureDirectory(outputDir);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    logger.info(`Report saved to: ${reportPath}`);
  }

  return report;
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

/**
 * Parse command line arguments
 */
function parseArgs(): TransformationOptions {
  const args = process.argv.slice(2);
  const options: TransformationOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--dry-run':
      case '-d':
        options.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--collection':
      case '-c':
        options.selectedCollections = [args[++i]];
        break;
      case '--output-dir':
      case '-o':
        options.outputDir = args[++i];
        break;
      case '--input-dir':
      case '-i':
        options.inputDir = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Firestore to Convex Data Transformation

Usage:
  npm run migrate:transform [options]

Options:
  --dry-run, -d          Run without writing output files
  --verbose, -v          Enable verbose logging
  --collection, -c       Transform specific collection only
  --output-dir, -o       Output directory (default: scripts/migrate/transformed)
  --input-dir, -i        Input directory (default: scripts/migrate/exported)
  --help, -h             Show this help message

Examples:
  npm run migrate:transform
  npm run migrate:transform -- --dry-run
  npm run migrate:transform -- --collection users --verbose
  npm run migrate:transform -- -c events -v -d

Collections:
  ${COLLECTIONS.join('\n  ')}
        `);
        process.exit(0);
    }
  }

  return options;
}

// Run transformation if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('/transform.ts')) {
  const options = parseArgs();
  transformAll(options)
    .then((report) => {
      process.exit(report.failedTransformations > 0 || report.totalFailures > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

// Export for programmatic use
export {
  transformAll,
  transformCollection,
  transformTimestamp,
  transformReference,
  transformReferenceArray,
  transformUserRole,
  generateId,
  Logger,
  COLLECTIONS,
  COLLECTION_TRANSFORMERS,
};
