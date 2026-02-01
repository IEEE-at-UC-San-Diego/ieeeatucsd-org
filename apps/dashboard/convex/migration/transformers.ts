/**
 * Firebase to Convex Data Transformers
 *
 * Type-safe transformers for each collection that:
 * - Convert Firebase Timestamps (ISO strings) to Unix ms numbers
 * - Handle GeoPoints → {lat, lng}
 * - Convert References → Convex ID strings
 * - Rename fields per schema mapping
 * - Add required Convex fields (createdAt, updatedAt)
 */

import type { ExportedDocument } from '../actions/firebase-export';

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Firebase Timestamp format from export (ISO 8601 string)
 */
type FirebaseTimestamp = string;

/**
 * Firebase GeoPoint format
 */
interface FirebaseGeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Firebase Document Reference
 */
interface FirebaseReference {
  id: string;
}

/**
 * Convert ISO string timestamp to Unix milliseconds
 */
function toUnixTimestamp(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    if (!isNaN(parsed)) return parsed;
  }
  return undefined;
}

/**
 * Convert Firebase GeoPoint to {lat, lng} object
 */
function toGeoPoint(value: unknown): { lat: number; lng: number } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const geo = value as FirebaseGeoPoint;
  if (typeof geo.latitude === 'number' && typeof geo.longitude === 'number') {
    return { lat: geo.latitude, lng: geo.longitude };
  }
  return undefined;
}

/**
 * Convert Firebase Reference to Convex ID string
 */
function toReferenceId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const ref = value as FirebaseReference;
  if (typeof ref.id === 'string') return ref.id;
  return value as string | undefined;
}

/**
 * Convert Firebase Reference array to Convex ID string array
 */
function toReferenceIds(value: unknown): string[] | undefined {
  if (!value || !Array.isArray(value)) return undefined;
  return value.map((v) => toReferenceId(v) || v as string).filter(Boolean);
}

/**
 * Preserve field as-is or convert to optional
 */
function preserve<T>(value: T): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

/**
 * Get current timestamp for createdAt/updatedAt
 */
function now(): number {
  return Date.now();
}

// ============================================================================
// COLLECTION 1: users
// ============================================================================

export function transformUsers(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    // Phase 1 Auth fields - these will be added during auth sync
    logtoSub: doc.logtoSub || `firebase_${doc._id}`, // Temporary marker
    email: String(doc.email || ''),
    name: preserve(doc.name),
    avatarUrl: preserve(doc.avatar || doc.avatarUrl),
    createdAt: toUnixTimestamp(doc.createdAt) || toUnixTimestamp(doc._creationTime) || now(),
    updatedAt: toUnixTimestamp(doc.lastUpdated) || now(),

    // Firebase user fields
    emailVisibility: preserve(doc.emailVisibility),
    verified: preserve(doc.verified),
    username: preserve(doc.username),
    pid: preserve(doc.pid),
    memberId: preserve(doc.memberId),
    graduationYear: preserve(doc.graduationYear),
    major: preserve(doc.major),
    zelleInformation: preserve(doc.zelleInformation),
    lastLogin: preserve(toUnixTimestamp(doc.lastLogin)),
    notificationPreferences: preserve(doc.notificationPreferences),
    displayPreferences: preserve(doc.displayPreferences),
    accessibilitySettings: preserve(doc.accessibilitySettings),
    navigationLayout: preserve(doc.navigationLayout),
    resume: preserve(doc.resume),
    signedUp: preserve(doc.signedUp),
    requestedEmail: preserve(doc.requestedEmail),
    position: preserve(doc.position),
    status: preserve(doc.status),
    joinDate: preserve(toUnixTimestamp(doc.joinDate)),
    eventsAttended: preserve(doc.eventsAttended),
    points: preserve(doc.points),
    team: preserve(doc.team),
    invitedBy: preserve(toReferenceId(doc.invitedBy)),
    inviteAccepted: preserve(toUnixTimestamp(doc.inviteAccepted)),
    lastUpdated: preserve(toUnixTimestamp(doc.lastUpdated)),
    lastUpdatedBy: preserve(toReferenceId(doc.lastUpdatedBy)),
    signInMethod: preserve(doc.signInMethod),
    hasIEEEEmail: preserve(doc.hasIEEEEmail),
    ieeeEmail: preserve(doc.ieeeEmail),
    ieeeEmailCreatedAt: preserve(toUnixTimestamp(doc.ieeeEmailCreatedAt)),
    sponsorTier: preserve(doc.sponsorTier),
    sponsorOrganization: preserve(doc.sponsorOrganization),
    autoAssignedSponsor: preserve(doc.autoAssignedSponsor),
  };
}

// ============================================================================
// COLLECTION 2: events
// ============================================================================

export function transformEvents(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    eventName: String(doc.eventName || ''),
    eventDescription: String(doc.eventDescription || ''),
    eventCode: String(doc.eventCode || ''),
    location: String(doc.location || ''),
    files: Array.isArray(doc.files) ? doc.files : [],
    pointsToReward: Number(doc.pointsToReward || 0),
    startDate: toUnixTimestamp(doc.startDate) || now(),
    endDate: toUnixTimestamp(doc.endDate) || now(),
    published: Boolean(doc.published),
    eventType: doc.eventType || 'other',
    hasFood: Boolean(doc.hasFood),
    createdFrom: preserve(toReferenceId(doc.createdFrom)),
    createdAt: toUnixTimestamp(doc.createdAt) || now(),
    createdBy: preserve(toReferenceId(doc.createdBy)),
  };
}

// ============================================================================
// COLLECTION 3: event/attendees (subcollection → event_attendees)
// ============================================================================

export function transformEventAttendees(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    eventId: preserve(toReferenceId(doc.eventId)), // Must be set by caller
    userId: preserve(toReferenceId(doc.userId)),
    timeCheckedIn: toUnixTimestamp(doc.timeCheckedIn) || now(),
    food: String(doc.food || ''),
    pointsEarned: Number(doc.pointsEarned || 0),
    checkedInAt: toUnixTimestamp(doc.checkedInAt) || toUnixTimestamp(doc.timeCheckedIn) || now(),
  };
}

// ============================================================================
// COLLECTION 4: event_requests
// ============================================================================

export function transformEventRequests(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    name: String(doc.name || ''),
    location: String(doc.location || ''),
    startDateTime: toUnixTimestamp(doc.startDateTime) || now(),
    endDateTime: toUnixTimestamp(doc.endDateTime) || now(),
    eventDescription: String(doc.eventDescription || ''),
    flyersNeeded: Boolean(doc.flyersNeeded),
    flyerType: Array.isArray(doc.flyerType) ? doc.flyerType : [],
    otherFlyerType: preserve(doc.otherFlyerType),
    flyerAdvertisingStartDate: preserve(toUnixTimestamp(doc.flyerAdvertisingStartDate)),
    flyerAdditionalRequests: preserve(doc.flyerAdditionalRequests),
    flyersCompleted: Boolean(doc.flyersCompleted),
    photographyNeeded: Boolean(doc.photographyNeeded),
    requiredLogos: Array.isArray(doc.requiredLogos) ? doc.requiredLogos : [],
    otherLogos: preserve(Array.isArray(doc.otherLogos) ? doc.otherLogos : []),
    advertisingFormat: preserve(doc.advertisingFormat),
    willOrHaveRoomBooking: Boolean(doc.willOrHaveRoomBooking),
    expectedAttendance: preserve(Number(doc.expectedAttendance)),
    roomBookingFiles: Array.isArray(doc.roomBookingFiles) ? doc.roomBookingFiles : [],
    asFundingRequired: Boolean(doc.asFundingRequired),
    foodDrinksBeingServed: Boolean(doc.foodDrinksBeingServed),
    invoices: preserve(doc.invoices),
    needsGraphics: Boolean(doc.needsGraphics),
    needsAsFunding: Boolean(doc.needsAsFunding),
    status: doc.status || 'draft',
    declinedReason: preserve(doc.declinedReason),
    reviewFeedback: preserve(doc.reviewFeedback),
    requestedUser: preserve(toReferenceId(doc.requestedUser)),
    auditLogs: preserve(doc.auditLogs),
    isDraft: preserve(doc.isDraft),
    department: preserve(doc.department),
    graphicsCompleted: preserve(doc.graphicsCompleted),
    graphicsFiles: preserve(Array.isArray(doc.graphicsFiles) ? doc.graphicsFiles : []),
    published: preserve(doc.published),
    createdAt: toUnixTimestamp(doc.createdAt) || now(),
    lastModified: toUnixTimestamp(doc.lastModified) || now(),
    lastModifiedBy: preserve(toReferenceId(doc.lastModifiedBy)),
  };
}

// ============================================================================
// COLLECTION 5: reimbursements
// ============================================================================

export function transformReimbursements(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    title: String(doc.title || ''),
    totalAmount: Number(doc.totalAmount || 0),
    paymentMethod: String(doc.paymentMethod || ''),
    status: doc.status || 'submitted',
    submittedBy: preserve(toReferenceId(doc.submittedBy)),
    additionalInfo: String(doc.additionalInfo || ''),
    department: doc.department || 'other',
    auditNotes: preserve(doc.auditNotes),
    auditLogs: preserve(doc.auditLogs),
    auditRequests: preserve(doc.auditRequests),
    requiresExecutiveOverride: preserve(doc.requiresExecutiveOverride),
    receipts: preserve(doc.receipts),
    dateOfPurchase: preserve(toUnixTimestamp(doc.dateOfPurchase)),
    expenses: preserve(doc.expenses),
    createdAt: toUnixTimestamp(doc.createdAt) || now(),
    lastModified: toUnixTimestamp(doc.lastModified) || now(),
  };
}

// ============================================================================
// COLLECTION 6: fundDeposits
// ============================================================================

export function transformFundDeposits(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    amount: Number(doc.amount || 0),
    depositedBy: preserve(toReferenceId(doc.depositedBy)),
    submittedAt: toUnixTimestamp(doc.submittedAt) || now(),
    status: doc.status || 'pending',
    notes: preserve(doc.notes),
    receiptFile: preserve(doc.receiptFile),
    approvedAt: preserve(toUnixTimestamp(doc.approvedAt)),
    approvedBy: preserve(toReferenceId(doc.approvedBy)),
    auditLogs: preserve(doc.auditLogs),
    createdAt: toUnixTimestamp(doc.createdAt) || now(),
    lastModified: toUnixTimestamp(doc.lastModified) || now(),
  };
}

// ============================================================================
// COLLECTION 7: public_profiles
// ============================================================================

export function transformPublicProfiles(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    userId: preserve(toReferenceId(doc.userId)),
    name: String(doc.name || ''),
    major: String(doc.major || ''),
    points: Number(doc.points || 0),
    totalEventsAttended: Number(doc.totalEventsAttended || 0),
    createdAt: toUnixTimestamp(doc.createdAt) || now(),
    updatedAt: toUnixTimestamp(doc.updatedAt) || now(),
  };
}

// ============================================================================
// COLLECTION 8: officerInvitations
// ============================================================================

export function transformOfficerInvitations(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    name: String(doc.name || ''),
    email: String(doc.email || ''),
    role: doc.role || 'member',
    position: String(doc.position || ''),
    status: doc.status || 'pending',
    invitedBy: preserve(toReferenceId(doc.invitedBy)),
    invitedAt: toUnixTimestamp(doc.invitedAt) || now(),
    acceptedAt: preserve(toUnixTimestamp(doc.acceptedAt)),
    declinedAt: preserve(toUnixTimestamp(doc.declinedAt)),
    expiresAt: toUnixTimestamp(doc.expiresAt) || now(),
    message: preserve(doc.message),
    acceptanceDeadline: preserve(doc.acceptanceDeadline),
    leaderName: preserve(doc.leaderName),
    googleGroupAssigned: preserve(doc.googleGroupAssigned),
    googleGroup: preserve(doc.googleGroup),
    permissionsGranted: preserve(doc.permissionsGranted),
    onboardingEmailSent: preserve(doc.onboardingEmailSent),
    resentAt: preserve(toUnixTimestamp(doc.resentAt)),
    lastSentAt: preserve(toUnixTimestamp(doc.lastSentAt)),
    roleGranted: preserve(doc.roleGranted),
    roleGrantedAt: preserve(toUnixTimestamp(doc.roleGrantedAt)),
    userCreatedOrUpdated: preserve(doc.userCreatedOrUpdated),
  };
}

// ============================================================================
// COLLECTION 9: directOnboardings
// ============================================================================

export function transformDirectOnboardings(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    name: String(doc.name || ''),
    email: String(doc.email || ''),
    role: doc.role || 'member',
    position: String(doc.position || ''),
    team: preserve(doc.team),
    status: doc.status || 'pending',
    createdBy: preserve(toReferenceId(doc.createdBy)),
    createdAt: toUnixTimestamp(doc.createdAt) || now(),
    completedAt: preserve(toUnixTimestamp(doc.completedAt)),
    userCreated: preserve(toReferenceId(doc.userCreated)),
    googleGroupAssigned: preserve(doc.googleGroupAssigned),
    googleGroup: preserve(doc.googleGroup),
    permissionsGranted: preserve(doc.permissionsGranted),
    onboardingEmailSent: preserve(doc.onboardingEmailSent),
    notes: preserve(doc.notes),
  };
}

// ============================================================================
// COLLECTION 10: invites
// ============================================================================

export function transformInvites(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    email: String(doc.email || ''),
    name: String(doc.name || ''),
    role: doc.role || 'member',
    status: doc.status || 'pending',
    invitedBy: preserve(toReferenceId(doc.invitedBy)),
    invitedAt: toUnixTimestamp(doc.invitedAt) || now(),
    acceptedAt: preserve(toUnixTimestamp(doc.acceptedAt)),
    expiresAt: toUnixTimestamp(doc.expiresAt) || now(),
    message: preserve(doc.message),
    userId: preserve(toReferenceId(doc.userId)),
  };
}

// ============================================================================
// COLLECTION 11: sponsorDomains
// ============================================================================

export function transformSponsorDomains(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    domain: String(doc.domain || ''),
    organizationName: String(doc.organizationName || ''),
    sponsorTier: doc.sponsorTier || 'Bronze',
    createdAt: toUnixTimestamp(doc.createdAt) || now(),
    createdBy: preserve(toReferenceId(doc.createdBy)),
    lastModified: preserve(toUnixTimestamp(doc.lastModified)),
    lastModifiedBy: preserve(toReferenceId(doc.lastModifiedBy)),
  };
}

// ============================================================================
// COLLECTION 12: links
// ============================================================================

export function transformLinks(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    url: String(doc.url || ''),
    title: String(doc.title || ''),
    category: String(doc.category || ''),
    description: preserve(doc.description),
    iconUrl: preserve(doc.iconUrl),
    shortUrl: preserve(doc.shortUrl),
    publishDate: preserve(toUnixTimestamp(doc.publishDate)),
    expireDate: preserve(toUnixTimestamp(doc.expireDate)),
    createdAt: toUnixTimestamp(doc.createdAt) || now(),
    createdBy: preserve(toReferenceId(doc.createdBy)),
    lastModified: preserve(toUnixTimestamp(doc.lastModified)),
    lastModifiedBy: preserve(toReferenceId(doc.lastModifiedBy)),
    order: preserve(doc.order),
  };
}

// ============================================================================
// COLLECTION 13: constitutions
// ============================================================================

export function transformConstitutions(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    title: String(doc.title || ''),
    organizationName: String(doc.organizationName || ''),
    version: Number(doc.version || 1),
    status: doc.status || 'draft',
    createdAt: toUnixTimestamp(doc.createdAt) || now(),
    lastModified: toUnixTimestamp(doc.lastModified) || now(),
    lastModifiedBy: preserve(toReferenceId(doc.lastModifiedBy)),
    collaborators: toReferenceIds(doc.collaborators) || [],
    isTemplate: preserve(doc.isTemplate),
  };
}

// ============================================================================
// COLLECTION 14: constitution/sections (subcollection → constitution_sections)
// ============================================================================

export function transformConstitutionSections(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    constitutionId: preserve(toReferenceId(doc.constitutionId)), // Must be set by caller
    type: doc.type || 'section',
    title: String(doc.title || ''),
    content: String(doc.content || ''),
    order: Number(doc.order || 0),
    parentId: preserve(toReferenceId(doc.parentId)),
    articleNumber: preserve(Number(doc.articleNumber)),
    sectionNumber: preserve(Number(doc.sectionNumber)),
    subsectionLetter: preserve(doc.subsectionLetter),
    amendmentNumber: preserve(Number(doc.amendmentNumber)),
    createdAt: toUnixTimestamp(doc.createdAt) || now(),
    lastModified: toUnixTimestamp(doc.lastModified) || now(),
    lastModifiedBy: preserve(toReferenceId(doc.lastModifiedBy)),
  };
}

// ============================================================================
// COLLECTION 15: constitution/auditLog (subcollection → constitution_audit_log)
// ============================================================================

export function transformConstitutionAuditLog(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    constitutionId: preserve(toReferenceId(doc.constitutionId)), // Must be set by caller
    sectionId: preserve(toReferenceId(doc.sectionId)),
    changeType: doc.changeType || 'update',
    changeDescription: String(doc.changeDescription || ''),
    beforeValue: preserve(doc.beforeValue),
    afterValue: preserve(doc.afterValue),
    userId: preserve(toReferenceId(doc.userId)),
    userName: String(doc.userName || ''),
    timestamp: toUnixTimestamp(doc.timestamp) || now(),
    ipAddress: preserve(doc.ipAddress),
    userAgent: preserve(doc.userAgent),
  };
}

// ============================================================================
// COLLECTION 16: notifications
// ============================================================================

export function transformNotifications(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    userId: preserve(toReferenceId(doc.userId)),
    type: String(doc.type || ''),
    title: String(doc.title || ''),
    message: String(doc.message || ''),
    data: preserve(doc.data),
    read: Boolean(doc.read),
    createdAt: toUnixTimestamp(doc.createdAt) || now(),
    expiresAt: preserve(toUnixTimestamp(doc.expiresAt)),
  };
}

// ============================================================================
// COLLECTION 17: googleGroupAssignments
// ============================================================================

export function transformGoogleGroupAssignments(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    userId: preserve(toReferenceId(doc.userId)),
    googleGroup: doc.googleGroup || 'executive-officers@ieeeatucsd.org',
    assignedAt: toUnixTimestamp(doc.assignedAt) || now(),
    assignedBy: preserve(toReferenceId(doc.assignedBy)),
    status: doc.status || 'active',
    removedAt: preserve(toUnixTimestamp(doc.removedAt)),
    removedBy: preserve(toReferenceId(doc.removedBy)),
    reason: preserve(doc.reason),
  };
}

// ============================================================================
// COLLECTION 18: organizationSettings
// ============================================================================

export function transformOrganizationSettings(doc: ExportedDocument): any {
  return {
    _id: doc._id,
    key: String(doc.key || ''),
    value: preserve(doc.value),
    description: preserve(doc.description),
    category: preserve(doc.category),
    isPublic: preserve(doc.isPublic),
    createdAt: toUnixTimestamp(doc.createdAt) || now(),
    lastModified: toUnixTimestamp(doc.lastModified) || now(),
    lastModifiedBy: preserve(toReferenceId(doc.lastModifiedBy)),
  };
}

// ============================================================================
// SPECIAL HANDLERS FOR SUBCOLLECTIONS
// ============================================================================

/**
 * Post-process event attendees to set eventId from collection path
 */
export function postProcessEventAttendees(doc: ExportedDocument, eventId: string): any {
  const transformed = transformEventAttendees(doc);
  transformed.eventId = eventId;
  return transformed;
}

/**
 * Post-process constitution sections to set constitutionId from collection path
 */
export function postProcessConstitutionSections(doc: ExportedDocument, constitutionId: string): any {
  const transformed = transformConstitutionSections(doc);
  transformed.constitutionId = constitutionId;
  return transformed;
}

/**
 * Post-process constitution audit log to set constitutionId from collection path
 */
export function postProcessConstitutionAuditLog(doc: ExportedDocument, constitutionId: string): any {
  const transformed = transformConstitutionAuditLog(doc);
  transformed.constitutionId = constitutionId;
  return transformed;
}
