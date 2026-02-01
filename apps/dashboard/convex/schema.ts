import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

/**
 * Convex Schema for IEEE at UCSD Dashboard
 *
 * This schema defines the complete tables required for the migration
 * from Firebase to TanStack Start + Logto + Self-Hosted Convex.
 *
 * Phase 1: Authentication tables (users, userRoles, roleAudit)
 * Phase 2: All Firestore collections migrated (15 collections + subcollections)
 *
 * TODO: Migration scripts will be created in subsequent phases.
 */

export default defineSchema({
  // ============================================================================
  // CORE AUTHENTICATION & AUTHORIZATION TABLES (Phase 1)
  // ============================================================================

  /**
   * Users table - Stores user profiles linked to Logto authentication
   *
   * Extended to include all Firebase user fields for migration compatibility.
   * Existing fields from Phase 1 are preserved: logtoSub, email, name, avatarUrl,
   * createdAt, updatedAt with additional Firebase-specific fields added.
   */
  users: defineTable({
    // Phase 1 Auth fields
    logtoSub: v.string(), // Logto subject ID (unique identifier)
    email: v.string(),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(), // Unix timestamp
    updatedAt: v.number(),

    // Firebase user fields
    emailVisibility: v.optional(v.boolean()),
    verified: v.optional(v.boolean()),
    username: v.optional(v.string()),
    pid: v.optional(v.string()), // Profile ID
    memberId: v.optional(v.string()), // IEEE member ID
    graduationYear: v.optional(v.number()),
    major: v.optional(v.string()),
    zelleInformation: v.optional(v.string()),
    lastLogin: v.optional(v.number()), // Unix timestamp
    notificationPreferences: v.optional(v.any()), // Record<string, unknown>
    displayPreferences: v.optional(v.any()), // Record<string, unknown>
    accessibilitySettings: v.optional(v.any()), // Record<string, unknown>
    navigationLayout: v.optional(v.union(v.literal('horizontal'), v.literal('sidebar'))),
    resume: v.optional(v.string()), // Resume URL
    signedUp: v.optional(v.boolean()),
    requestedEmail: v.optional(v.boolean()),
    position: v.optional(v.string()),
    status: v.optional(v.union(v.literal('active'), v.literal('inactive'), v.literal('suspended'))),
    joinDate: v.optional(v.number()), // Unix timestamp
    eventsAttended: v.optional(v.number()),
    points: v.optional(v.number()),
    team: v.optional(v.union(v.literal('Internal'), v.literal('Events'), v.literal('Projects'))),
    invitedBy: v.optional(v.id('users')),
    inviteAccepted: v.optional(v.number()), // Unix timestamp
    lastUpdated: v.optional(v.number()), // Unix timestamp
    lastUpdatedBy: v.optional(v.id('users')),
    signInMethod: v.optional(
      v.union(
        v.literal('email'),
        v.literal('google'),
        v.literal('microsoft'),
        v.literal('github'),
        v.literal('facebook'),
        v.literal('twitter'),
        v.literal('apple'),
        v.literal('other')
      )
    ),
    hasIEEEEmail: v.optional(v.boolean()),
    ieeeEmail: v.optional(v.string()),
    ieeeEmailCreatedAt: v.optional(v.number()), // Unix timestamp
    sponsorTier: v.optional(
      v.union(v.literal('Bronze'), v.literal('Silver'), v.literal('Gold'), v.literal('Platinum'), v.literal('Diamond'))
    ),
    sponsorOrganization: v.optional(v.string()),
    autoAssignedSponsor: v.optional(v.boolean()),
  })
    // Index for fast lookup by Logto subject (primary auth lookup)
    .index('byLogtoSub', ['logtoSub'])
    // Index for email-based queries (e.g., invitation flows)
    .index('byEmail', ['email'])
    // Index for IEEE email lookup
    .index('byIeeeEmail', ['ieeeEmail'])
    // Index for querying users by role (via userRoles join)
    .index('byStatus', ['status'])
    // Index for sponsor queries
    .index('bySponsorTier', ['sponsorTier']),

  /**
   * UserRoles table - Stores role assignments for users
   *
   * Roles are synced bidirectionally between Logto and Convex.
   * Primary roles: member, general_officer, executive_officer,
   * member_at_large, past_officer, sponsor, administrator
   */
  userRoles: defineTable({
    userId: v.id('users'), // Reference to users table
    roles: v.array(
      v.union(
        v.literal('member'),
        v.literal('general_officer'),
        v.literal('executive_officer'),
        v.literal('member_at_large'),
        v.literal('past_officer'),
        v.literal('sponsor'),
        v.literal('administrator')
      )
    ),
    source: v.string(), // "logto" or "convex" - tracks origin of last update
    updatedAt: v.number(),
  })
    // Index for fast role lookup by user
    .index('byUser', ['userId'])
    // Index for finding users by specific role
    .index('byRole', ['roles']),

  /**
   * RoleAudit table - Audit trail for all role changes
   *
   * Tracks who changed what roles and when, for both directions
   * of the Logto ↔ Convex sync.
   */
  roleAudit: defineTable({
    userId: v.id('users'), // Reference to users table
    roles: v.array(v.string()), // New/current roles after change
    previousRoles: v.array(v.string()), // Roles before change
    action: v.union(v.literal('granted'), v.literal('revoked'), v.literal('synced'), v.literal('updated')),
    source: v.union(v.literal('logto_sync'), v.literal('manual_update'), v.literal('migration'), v.literal('invitation')),
    performedBy: v.optional(v.id('users')), // Who made the change (if applicable)
    timestamp: v.number(),
  })
    // Index for querying audit history by user
    .index('byUser', ['userId'])
    // Index for chronological audit queries per user
    .index('byUserAt', ['userId', 'timestamp'])
    // Index for querying by action type (e.g., all manual updates)
    .index('byAction', ['action', 'timestamp']),

  // ============================================================================
  // EVENT MANAGEMENT TABLES
  // ============================================================================

  /**
   * Events table - Published events
   */
  events: defineTable({
    eventName: v.string(),
    eventDescription: v.string(),
    eventCode: v.string(), // Unique event code
    location: v.string(),
    files: v.array(v.string()), // Associated file URLs
    pointsToReward: v.number(),
    startDate: v.number(), // Unix timestamp
    endDate: v.number(), // Unix timestamp
    published: v.boolean(),
    eventType: v.union(
      v.literal('social'),
      v.literal('technical'),
      v.literal('outreach'),
      v.literal('professional'),
      v.literal('projects'),
      v.literal('other')
    ),
    hasFood: v.boolean(),
    createdFrom: v.optional(v.id('event_requests')), // Source event request ID
    createdAt: v.number(), // Unix timestamp
    createdBy: v.optional(v.id('users')),
  })
    .index('byPublishedStartDate', ['published', 'startDate'])
    .index('byPublishedStartDateDesc', ['published', 'startDate'])
    .index('byEventCode', ['eventCode'])
    .index('byEventType', ['eventType']),

  /**
   * Event attendees table - Subcollection of events
   */
  event_attendees: defineTable({
    eventId: v.id('events'), // Reference to events table
    userId: v.id('users'), // Attendee user ID
    timeCheckedIn: v.number(), // Unix timestamp
    food: v.string(), // Food preference
    pointsEarned: v.number(),
    checkedInAt: v.number(), // Unix timestamp
  })
    .index('byEvent', ['eventId'])
    .index('byUser', ['userId'])
    .index('byEventUser', ['eventId', 'userId']),

  /**
   * Event requests table - Event requests awaiting approval
   */
  event_requests: defineTable({
    name: v.string(),
    location: v.string(),
    startDateTime: v.number(), // Unix timestamp
    endDateTime: v.number(), // Unix timestamp
    eventDescription: v.string(),
    flyersNeeded: v.boolean(),
    flyerType: v.array(v.string()),
    otherFlyerType: v.optional(v.string()),
    flyerAdvertisingStartDate: v.optional(v.number()), // Unix timestamp
    flyerAdditionalRequests: v.optional(v.string()),
    flyersCompleted: v.boolean(),
    photographyNeeded: v.boolean(),
    requiredLogos: v.array(v.string()),
    otherLogos: v.optional(v.array(v.string())),
    advertisingFormat: v.optional(v.string()),
    willOrHaveRoomBooking: v.boolean(),
    expectedAttendance: v.optional(v.number()),
    roomBookingFiles: v.array(v.string()),
    asFundingRequired: v.boolean(),
    foodDrinksBeingServed: v.boolean(),
    invoices: v.optional(v.any()), // Invoice[] - array of invoice objects
    needsGraphics: v.boolean(),
    needsAsFunding: v.boolean(),
    status: v.union(
      v.literal('draft'),
      v.literal('submitted'),
      v.literal('pending'),
      v.literal('completed'),
      v.literal('approved'),
      v.literal('declined'),
      v.literal('needs_review')
    ),
    declinedReason: v.optional(v.string()),
    reviewFeedback: v.optional(v.string()),
    requestedUser: v.id('users'),
    auditLogs: v.optional(
      v.array(
        v.object({
          action: v.string(),
          createdBy: v.string(),
          timestamp: v.number(), // Unix timestamp
        })
      )
    ),
    isDraft: v.optional(v.boolean()),
    department: v.optional(v.string()),
    graphicsCompleted: v.optional(v.boolean()),
    graphicsFiles: v.optional(v.array(v.string())),
    published: v.optional(v.boolean()),
    createdAt: v.number(), // Unix timestamp
    lastModified: v.number(), // Unix timestamp
    lastModifiedBy: v.optional(v.id('users')),
  })
    .index('byRequestedUser', ['requestedUser', 'createdAt'])
    .index('byStatus', ['status'])
    .index('byDepartment', ['department'])
    .index('byStartDate', ['startDateTime']),

  // ============================================================================
  // FINANCIAL TABLES
  // ============================================================================

  /**
   * Reimbursements table - Reimbursement requests
   */
  reimbursements: defineTable({
    title: v.string(),
    totalAmount: v.number(),
    paymentMethod: v.string(),
    status: v.union(v.literal('submitted'), v.literal('declined'), v.literal('approved'), v.literal('paid')),
    submittedBy: v.id('users'),
    additionalInfo: v.string(),
    department: v.union(
      v.literal('internal'),
      v.literal('external'),
      v.literal('projects'),
      v.literal('events'),
      v.literal('other')
    ),
    auditNotes: v.optional(
      v.array(
        v.object({
          note: v.string(),
          createdBy: v.string(),
          timestamp: v.number(), // Unix timestamp
        })
      )
    ),
    auditLogs: v.optional(
      v.array(
        v.object({
          action: v.string(),
          createdBy: v.string(),
          timestamp: v.number(), // Unix timestamp
        })
      )
    ),
    auditRequests: v.optional(
      v.array(
        v.object({
          auditorId: v.string(),
          requestedBy: v.string(),
          requestedAt: v.number(), // Unix timestamp
          status: v.union(v.literal('pending'), v.literal('completed'), v.literal('declined')),
          auditResult: v.optional(v.union(v.literal('approved'), v.literal('needs_changes'))),
          auditNotes: v.optional(v.string()),
          completedAt: v.optional(v.number()), // Unix timestamp
        })
      )
    ),
    requiresExecutiveOverride: v.optional(v.boolean()),
    receipts: v.optional(v.any()), // Receipt[] - array of receipt objects
    // Legacy fields for backward compatibility
    dateOfPurchase: v.optional(v.number()), // Unix timestamp
    expenses: v.optional(v.any()), // LegacyExpense[]
    createdAt: v.number(), // Unix timestamp
    lastModified: v.number(), // Unix timestamp
  })
    .index('bySubmittedBy', ['submittedBy', 'createdAt'])
    .index('byStatus', ['status'])
    .index('byDepartment', ['department']),

  /**
   * Fund deposits table - Fund deposit records
   */
  fundDeposits: defineTable({
    amount: v.number(),
    depositedBy: v.id('users'),
    submittedAt: v.number(), // Unix timestamp
    status: v.union(v.literal('pending'), v.literal('approved'), v.literal('declined')),
    notes: v.optional(v.string()),
    receiptFile: v.optional(v.string()), // Receipt file URL
    approvedAt: v.optional(v.number()), // Unix timestamp
    approvedBy: v.optional(v.id('users')),
    auditLogs: v.optional(
      v.array(
        v.object({
          action: v.string(),
          createdBy: v.string(),
          timestamp: v.number(), // Unix timestamp
        })
      )
    ),
    createdAt: v.number(), // Unix timestamp
    lastModified: v.number(), // Unix timestamp
  })
    .index('byDepositedBy', ['depositedBy', 'submittedAt'])
    .index('byStatus', ['status']),

  // ============================================================================
  // USER PROFILE TABLES
  // ============================================================================

  /**
   * Public profiles table - Public user profiles for leaderboard
   */
  public_profiles: defineTable({
    userId: v.id('users'), // Reference to users table
    name: v.string(),
    major: v.string(),
    points: v.number(),
    totalEventsAttended: v.number(),
    createdAt: v.number(), // Unix timestamp
    updatedAt: v.number(), // Unix timestamp
  })
    .index('byUser', ['userId'])
    .index('byPoints', ['points'])
    .index('byEventsAttended', ['totalEventsAttended']),

  /**
   * Officer invitations table - Officer invitation records
   */
  officerInvitations: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal('member'),
      v.literal('general_officer'),
      v.literal('executive_officer'),
      v.literal('member_at_large'),
      v.literal('past_officer'),
      v.literal('sponsor'),
      v.literal('administrator')
    ),
    position: v.string(),
    status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('declined'), v.literal('expired')),
    invitedBy: v.id('users'),
    invitedAt: v.number(), // Unix timestamp
    acceptedAt: v.optional(v.number()), // Unix timestamp
    declinedAt: v.optional(v.number()), // Unix timestamp
    expiresAt: v.number(), // Unix timestamp
    message: v.optional(v.string()),
    acceptanceDeadline: v.optional(v.string()), // Human-readable deadline
    leaderName: v.optional(v.string()),
    googleGroupAssigned: v.optional(v.boolean()),
    googleGroup: v.optional(
      v.union(
        v.literal('executive-officers@ieeeatucsd.org'),
        v.literal('general-officers@ieeeatucsd.org'),
        v.literal('past-officers@ieeeatucsd.org')
      )
    ),
    permissionsGranted: v.optional(v.boolean()),
    onboardingEmailSent: v.optional(v.boolean()),
    resentAt: v.optional(v.number()), // Unix timestamp
    lastSentAt: v.optional(v.number()), // Unix timestamp
    roleGranted: v.optional(v.boolean()),
    roleGrantedAt: v.optional(v.number()), // Unix timestamp
    userCreatedOrUpdated: v.optional(v.boolean()),
  })
    .index('byEmail', ['email'])
    .index('byStatus', ['status'])
    .index('byInvitedBy', ['invitedBy'])
    .index('byRole', ['role']),

  /**
   * Direct onboardings table - Direct onboarding records
   */
  directOnboardings: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(
      v.literal('member'),
      v.literal('general_officer'),
      v.literal('executive_officer'),
      v.literal('member_at_large'),
      v.literal('past_officer'),
      v.literal('sponsor'),
      v.literal('administrator')
    ),
    position: v.string(),
    team: v.optional(v.union(v.literal('Internal'), v.literal('Events'), v.literal('Projects'))),
    status: v.union(v.literal('pending'), v.literal('completed'), v.literal('failed')),
    createdBy: v.id('users'),
    createdAt: v.number(), // Unix timestamp
    completedAt: v.optional(v.number()), // Unix timestamp
    userCreated: v.optional(v.id('users')),
    googleGroupAssigned: v.optional(v.boolean()),
    googleGroup: v.optional(
      v.union(
        v.literal('executive-officers@ieeeatucsd.org'),
        v.literal('general-officers@ieeeatucsd.org'),
        v.literal('past-officers@ieeeatucsd.org')
      )
    ),
    permissionsGranted: v.optional(v.boolean()),
    onboardingEmailSent: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  })
    .index('byEmail', ['email'])
    .index('byStatus', ['status'])
    .index('byCreatedBy', ['createdAt']),

  /**
   * Invites table - User invitation records
   */
  invites: defineTable({
    email: v.string(),
    name: v.string(),
    role: v.union(
      v.literal('member'),
      v.literal('general_officer'),
      v.literal('executive_officer'),
      v.literal('member_at_large'),
      v.literal('past_officer'),
      v.literal('sponsor'),
      v.literal('administrator')
    ),
    status: v.union(v.literal('pending'), v.literal('accepted'), v.literal('declined'), v.literal('expired')),
    invitedBy: v.id('users'),
    invitedAt: v.number(), // Unix timestamp
    acceptedAt: v.optional(v.number()), // Unix timestamp
    expiresAt: v.number(), // Unix timestamp
    message: v.optional(v.string()),
    userId: v.optional(v.id('users')), // Set when invite is accepted
  })
    .index('byEmail', ['email'])
    .index('byStatus', ['status'])
    .index('byInvitedBy', ['invitedBy', 'invitedAt'])
    .index('byExpiresAt', ['expiresAt']),

  // ============================================================================
  // SPONSORSHIP TABLES
  // ============================================================================

  /**
   * Sponsor domains table - Sponsor email domain mappings
   */
  sponsorDomains: defineTable({
    domain: v.string(),
    organizationName: v.string(),
    sponsorTier: v.union(
      v.literal('Bronze'),
      v.literal('Silver'),
      v.literal('Gold'),
      v.literal('Platinum'),
      v.literal('Diamond')
    ),
    createdAt: v.number(), // Unix timestamp
    createdBy: v.id('users'),
    lastModified: v.optional(v.number()), // Unix timestamp
    lastModifiedBy: v.optional(v.id('users')),
  })
    .index('byDomain', ['domain'])
    .index('byOrganization', ['organizationName'])
    .index('bySponsorTier', ['sponsorTier']),

  /**
   * Links table - Shortened links
   */
  links: defineTable({
    url: v.string(),
    title: v.string(),
    category: v.string(),
    description: v.optional(v.string()),
    iconUrl: v.optional(v.string()),
    shortUrl: v.optional(v.string()), // Short URL slug
    publishDate: v.optional(v.number()), // Unix timestamp
    expireDate: v.optional(v.number()), // Unix timestamp
    createdAt: v.number(), // Unix timestamp
    createdBy: v.id('users'),
    lastModified: v.optional(v.number()), // Unix timestamp
    lastModifiedBy: v.optional(v.id('users')),
    order: v.optional(v.number()),
  })
    .index('byShortUrl', ['shortUrl'])
    .index('byCategory', ['category'])
    .index('byCreatedBy', ['createdBy', 'createdAt'])
    .index('byPublishDate', ['publishDate']),

  // ============================================================================
  // CONSTITUTION TABLES
  // ============================================================================

  /**
   * Constitutions table - Constitution documents
   */
  constitutions: defineTable({
    title: v.string(),
    organizationName: v.string(),
    version: v.number(),
    status: v.union(v.literal('draft'), v.literal('published'), v.literal('archived')),
    createdAt: v.number(), // Unix timestamp
    lastModified: v.number(), // Unix timestamp
    lastModifiedBy: v.id('users'),
    collaborators: v.array(v.id('users')),
    isTemplate: v.optional(v.boolean()),
  })
    .index('byOrganization', ['organizationName'])
    .index('byStatus', ['status'])
    .index('byVersion', ['version'])
    .index('byLastModifiedBy', ['lastModifiedBy', 'lastModified']),

  /**
   * Constitution sections table - Subcollection of constitutions
   */
  constitution_sections: defineTable({
    constitutionId: v.id('constitutions'), // Reference to constitutions table
    type: v.union(
      v.literal('preamble'),
      v.literal('article'),
      v.literal('section'),
      v.literal('subsection'),
      v.literal('amendment')
    ),
    title: v.string(),
    content: v.string(),
    order: v.number(),
    parentId: v.optional(v.id('constitution_sections')), // Self-reference
    articleNumber: v.optional(v.number()),
    sectionNumber: v.optional(v.number()),
    subsectionLetter: v.optional(v.string()),
    amendmentNumber: v.optional(v.number()),
    createdAt: v.number(), // Unix timestamp
    lastModified: v.number(), // Unix timestamp
    lastModifiedBy: v.id('users'),
  })
    .index('byConstitution', ['constitutionId', 'order'])
    .index('byParentId', ['parentId'])
    .index('byTypeAndOrder', ['type', 'order']),

  /**
   * Constitution audit log table - Subcollection of constitutions
   */
  constitution_audit_log: defineTable({
    constitutionId: v.id('constitutions'), // Reference to constitutions table
    sectionId: v.optional(v.id('constitution_sections')), // Null for constitution-level
    changeType: v.union(v.literal('create'), v.literal('update'), v.literal('delete'), v.literal('reorder')),
    changeDescription: v.string(),
    beforeValue: v.optional(v.any()), // Previous values
    afterValue: v.optional(v.any()), // New values
    userId: v.id('users'), // Modifying user ID
    userName: v.string(), // Modifying user name
    timestamp: v.number(), // Unix timestamp
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  })
    .index('byConstitution', ['constitutionId', 'timestamp'])
    .index('bySectionId', ['sectionId', 'timestamp'])
    .index('byUserId', ['userId', 'timestamp'])
    .index('byChangeType', ['changeType', 'timestamp']),

  // ============================================================================
  // NOTIFICATION TABLES
  // ============================================================================

  /**
   * Notifications table - User notifications
   */
  notifications: defineTable({
    userId: v.id('users'),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    data: v.optional(v.any()), // Record<string, any>
    read: v.boolean(),
    createdAt: v.number(), // Unix timestamp
    expiresAt: v.optional(v.number()), // Unix timestamp
  })
    .index('byUserId', ['userId', 'createdAt'])
    .index('byUnread', ['userId', 'read', 'createdAt'])
    .index('byExpiresAt', ['expiresAt']),

  // ============================================================================
  // GOOGLE GROUPS TABLES
  // ============================================================================

  /**
   * Google group assignments table - Google Group assignment records
   */
  googleGroupAssignments: defineTable({
    userId: v.id('users'),
    googleGroup: v.union(
      v.literal('executive-officers@ieeeatucsd.org'),
      v.literal('general-officers@ieeeatucsd.org'),
      v.literal('past-officers@ieeeatucsd.org')
    ),
    assignedAt: v.number(), // Unix timestamp
    assignedBy: v.id('users'),
    status: v.union(v.literal('active'), v.literal('removed'), v.literal('pending')),
    removedAt: v.optional(v.number()), // Unix timestamp
    removedBy: v.optional(v.id('users')),
    reason: v.optional(v.string()),
  })
    .index('byUser', ['userId'])
    .index('byGoogleGroup', ['googleGroup'])
    .index('byStatus', ['status'])
    .index('byUserAndGroup', ['userId', 'googleGroup']),

  // ============================================================================
  // ORGANIZATION SETTINGS TABLES
  // ============================================================================

  /**
   * Organization settings table - Organization-wide settings
   */
  organizationSettings: defineTable({
    key: v.string(), // Unique setting key
    value: v.any(), // Flexible storage for different value types
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    isPublic: v.optional(v.boolean()), // Whether setting is publicly accessible
    createdAt: v.number(), // Unix timestamp
    lastModified: v.number(), // Unix timestamp
    lastModifiedBy: v.optional(v.id('users')),
  })
    .index('byKey', ['key'])
    .index('byCategory', ['category'])
    .index('byIsPublic', ['isPublic']),

  // ============================================================================
  // FILE MIGRATION TABLES (Phase 2, Subtask 4)
  // ============================================================================
  /**
   * File migrations table - Tracks Firebase Storage to Convex blob migrations
   */
  fileMigrations: defineTable({
    firebasePath: v.string(), // Original Firebase Storage path
    firebaseUrl: v.string(), // Original Firebase Storage URL
    blobId: v.id('_storage'), // Convex blob ID after migration
    size: v.number(), // File size in bytes
    contentType: v.string(), // MIME type
    migratedAt: v.number(), // Unix timestamp of migration
    status: v.union(
      v.literal('pending'),
      v.literal('in_progress'),
      v.literal('completed'),
      v.literal('failed')
    ),
    errorMessage: v.optional(v.string()), // Error message if failed
    checksum: v.optional(v.string()), // File checksum for integrity verification
    metadata: v.optional(v.any()), // Additional file metadata
  })
    .index('byFirebasePath', ['firebasePath'])
    .index('byStatus', ['status'])
    .index('byBlobId', ['blobId'])
    .index('byMigratedAt', ['migratedAt']),

  // ============================================================================
  // DEMO TABLES - Can be removed in production
  // ============================================================================
  // These tables are for development/testing purposes only.
  // They should be removed before production deployment.

  products: defineTable({
    title: v.string(),
    imageId: v.string(),
    price: v.number(),
  }),

  todos: defineTable({
    text: v.string(),
    completed: v.boolean(),
  }),
})
