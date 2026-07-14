import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { resumeObject } from "./resume";

const userRole = v.union(
  v.literal("Member"),
  v.literal("General Officer"),
  v.literal("Executive Officer"),
  v.literal("Member at Large"),
  v.literal("Past Officer"),
  v.literal("Sponsor"),
  v.literal("Administrator"),
);

const sponsorTier = v.union(
  v.literal("Bronze"),
  v.literal("Silver"),
  v.literal("Gold"),
  v.literal("Platinum"),
  v.literal("Diamond"),
);

const officerTeam = v.union(
  v.literal("Internal"),
  v.literal("Events"),
  v.literal("Projects"),
);

const lineItem = v.object({
  id: v.string(),
  description: v.string(),
  category: v.string(),
  amount: v.number(),
});

const receipt = v.object({
  id: v.string(),
  vendorName: v.string(),
  location: v.string(),
  dateOfPurchase: v.number(),
  lineItems: v.array(lineItem),
  receiptFile: v.optional(v.string()),
  notes: v.optional(v.string()),
  subtotal: v.number(),
  tax: v.optional(v.number()),
  tip: v.optional(v.number()),
  shipping: v.optional(v.number()),
  total: v.number(),
  expenseType: v.optional(
    v.union(v.literal("receipt"), v.literal("mileage")),
  ),
  miles: v.optional(v.number()),
  mileageRatePerMile: v.optional(v.number()),
  mileageFrom: v.optional(v.string()),
  mileageTo: v.optional(v.string()),
  mileageStops: v.optional(v.array(v.string())),
});

const invoiceItem = v.object({
  description: v.string(),
  quantity: v.number(),
  unitPrice: v.number(),
  total: v.number(),
});

const invoice = v.object({
  id: v.string(),
  vendor: v.string(),
  items: v.array(invoiceItem),
  tax: v.number(),
  tip: v.number(),
  invoiceFile: v.optional(v.string()),
  additionalFiles: v.array(v.string()),
  subtotal: v.number(),
  total: v.number(),
});

const eventFieldChange = v.object({
  field: v.string(),
  fieldDisplayName: v.string(),
  oldValue: v.any(),
  newValue: v.any(),
  changeType: v.union(
    v.literal("added"),
    v.literal("updated"),
    v.literal("removed"),
  ),
});

const eventFileChange = v.object({
  action: v.union(v.literal("added"), v.literal("removed")),
  fileName: v.string(),
  fileUrl: v.optional(v.string()),
  fileType: v.union(
    v.literal("room_booking"),
    v.literal("invoice"),
    v.literal("logo"),
    v.literal("graphics"),
    v.literal("other"),
  ),
});

const eventAuditLog = v.object({
  id: v.string(),
  eventRequestId: v.string(),
  action: v.union(
    v.literal("created"),
    v.literal("updated"),
    v.literal("status_changed"),
    v.literal("file_uploaded"),
    v.literal("file_deleted"),
    v.literal("graphics_updated"),
    v.literal("published"),
    v.literal("unpublished"),
  ),
  performedBy: v.string(),
  performedByName: v.optional(v.string()),
  timestamp: v.number(),
  changes: v.optional(v.array(eventFieldChange)),
  oldStatus: v.optional(v.string()),
  newStatus: v.optional(v.string()),
  statusReason: v.optional(v.string()),
  fileChanges: v.optional(v.array(eventFileChange)),
  metadata: v.optional(v.any()),
});

const constitutionSectionType = v.union(
  v.literal("preamble"),
  v.literal("article"),
  v.literal("section"),
  v.literal("subsection"),
  v.literal("amendment"),
);

const constitutionSection = v.object({
  id: v.string(),
  type: constitutionSectionType,
  title: v.string(),
  content: v.string(),
  order: v.number(),
  parentId: v.optional(v.string()),
  articleNumber: v.optional(v.number()),
  sectionNumber: v.optional(v.number()),
  subsectionLetter: v.optional(v.string()),
  amendmentNumber: v.optional(v.number()),
  createdAt: v.number(),
  lastModified: v.number(),
  lastModifiedBy: v.string(),
});

export default defineSchema({
  users: defineTable({
    logtoId: v.optional(v.string()),
    authUserId: v.optional(v.string()),
    email: v.string(),
    emailVisibility: v.boolean(),
    verified: v.boolean(),
    name: v.string(),
    username: v.optional(v.string()),
    avatar: v.optional(v.string()),
    pid: v.optional(v.string()),
    memberId: v.optional(v.string()),
    graduationYear: v.optional(v.number()),
    major: v.optional(v.string()),
    zelleInformation: v.optional(v.string()),
    lastLogin: v.optional(v.number()),
    notificationPreferences: v.optional(v.any()),
    displayPreferences: v.optional(v.any()),
    accessibilitySettings: v.optional(v.any()),
    aiFeaturesEnabled: v.optional(v.boolean()),
    resume: v.optional(resumeObject),
    signedUp: v.boolean(),
    requestedEmail: v.boolean(),
    role: userRole,
    position: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("suspended"),
    ),
    joinDate: v.number(),
    eventsAttended: v.optional(v.number()),
    points: v.optional(v.number()),
    lifetimePointsEarned: v.optional(v.number()),
    team: v.optional(officerTeam),
    invitedBy: v.optional(v.string()),
    inviteAccepted: v.optional(v.number()),
    lastUpdated: v.optional(v.number()),
    lastUpdatedBy: v.optional(v.string()),
    signInMethod: v.optional(v.string()),
    hasIEEEEmail: v.optional(v.boolean()),
    ieeeEmail: v.optional(v.string()),
    ieeeEmailCreatedAt: v.optional(v.number()),
    sponsorTier: v.optional(sponsorTier),
    sponsorOrganization: v.optional(v.string()),
    autoAssignedSponsor: v.optional(v.boolean()),
    tosAcceptedAt: v.optional(v.number()),
    tosVersion: v.optional(v.string()),
    privacyPolicyAcceptedAt: v.optional(v.number()),
    privacyPolicyVersion: v.optional(v.string()),
  })
    .index("by_logtoId", ["logtoId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_points", ["points"]),

  publicProfiles: defineTable({
    userId: v.id("users"),
    name: v.string(),
    major: v.optional(v.string()),
    points: v.number(),
    eventsAttended: v.number(),
    position: v.optional(v.string()),
    graduationYear: v.optional(v.number()),
    joinDate: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  pointAccounts: defineTable({
    userId: v.id("users"),
    balance: v.number(),
    lifetimeEarned: v.number(),
    initializedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  pointLedgerEntries: defineTable({
    userId: v.id("users"),
    balanceDelta: v.number(),
    lifetimeDelta: v.number(),
    balanceAfter: v.number(),
    lifetimeEarnedAfter: v.number(),
    kind: v.union(
      v.literal("opening_balance"),
      v.literal("event_reward"),
      v.literal("purchase"),
      v.literal("refund"),
      v.literal("correction"),
      v.literal("spendable_adjustment"),
    ),
    sourceType: v.string(),
    sourceId: v.optional(v.string()),
    idempotencyKey: v.string(),
    actorId: v.optional(v.id("users")),
    reason: v.optional(v.string()),
    reversalOf: v.optional(v.id("pointLedgerEntries")),
    createdAt: v.number(),
  })
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_source", ["sourceType", "sourceId"])
    .index("by_reversalOf", ["reversalOf"]),

  events: defineTable({
    // Core event fields
    eventName: v.string(),
    eventDescription: v.string(),
    eventCode: v.optional(v.string()),
    location: v.string(),
    files: v.optional(v.array(v.string())),
    pointsToReward: v.optional(v.number()),
    startDate: v.number(),
    endDate: v.number(),
    published: v.optional(v.boolean()),
    eventType: v.optional(
      v.union(
        v.literal("social"),
        v.literal("technical"),
        v.literal("outreach"),
        v.literal("professional"),
        v.literal("projects"),
        v.literal("other"),
      ),
    ),
    hasFood: v.optional(v.boolean()),
    createdAt: v.optional(v.number()),
    // Request workflow fields (merged from eventRequests)
    department: v.optional(
      v.union(
        v.literal("events"),
        v.literal("projects"),
        v.literal("internal"),
        v.literal("other"),
      ),
    ),
    flyersNeeded: v.optional(v.boolean()),
    flyerType: v.optional(v.array(v.string())),
    otherFlyerType: v.optional(v.string()),
    flyerAdvertisingStartDate: v.optional(v.number()),
    flyerAdditionalRequests: v.optional(v.string()),
    flyersCompleted: v.optional(v.boolean()),
    photographyNeeded: v.optional(v.boolean()),
    requiredLogos: v.optional(v.array(v.string())),
    otherLogos: v.optional(v.array(v.string())),
    advertisingFormat: v.optional(v.string()),
    additionalSpecifications: v.optional(v.string()),
    graphicsUploadNote: v.optional(v.string()),
    willOrHaveRoomBooking: v.optional(v.boolean()),
    expectedAttendance: v.optional(v.number()),
    roomBookingFiles: v.optional(v.array(v.string())),
    asFundingRequired: v.optional(v.boolean()),
    foodDrinksBeingServed: v.optional(v.boolean()),
    invoices: v.optional(v.array(invoice)),
    needsGraphics: v.optional(v.boolean()),
    needsAsFunding: v.optional(v.boolean()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("submitted"),
        v.literal("pending"),
        v.literal("completed"),
        v.literal("approved"),
        v.literal("declined"),
        v.literal("needs_review"),
      ),
    ),
    declinedReason: v.optional(v.string()),
    reviewFeedback: v.optional(v.string()),
    requestedUser: v.optional(v.string()),
    auditLogs: v.optional(v.array(eventAuditLog)),
    isDraft: v.optional(v.boolean()),
    graphicsCompleted: v.optional(v.boolean()),
    graphicsFiles: v.optional(v.array(v.string())),
    submittedAt: v.optional(v.number()),
  })
    .index("by_eventCode", ["eventCode"])
    .index("by_startDate", ["startDate"])
    .index("by_published", ["published"])
    .index("by_status", ["status"])
    .index("by_requestedUser", ["requestedUser"]),

  // Internal events for officer calendar (meetings, tabling, etc.)
  internalEvents: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    location: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    eventType: v.union(
      v.literal("meeting"),
      v.literal("tabling"),
      v.literal("workshop"),
      v.literal("social"),
      v.literal("outreach"),
      v.literal("other"),
    ),
    createdBy: v.string(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    updatedBy: v.optional(v.string()),
  })
    .index("by_startDate", ["startDate"])
    .index("by_eventType", ["eventType"])
    .index("by_createdBy", ["createdBy"]),

  googleCalendarSyncState: defineTable({
    calendarId: v.string(),
    lastSuccessfulSourceCount: v.optional(v.number()),
    staleCandidates: v.array(
      v.object({
        eventId: v.string(),
        firstSeenMissingAt: v.number(),
        lastSeenMissingAt: v.number(),
        missingSyncCount: v.number(),
        startMs: v.optional(v.number()),
      }),
    ),
    updatedAt: v.number(),
  }).index("by_calendarId", ["calendarId"]),

  googleCalendarDeletionQueue: defineTable({
    calendar: v.union(v.literal("private"), v.literal("public")),
    googleEventId: v.string(),
    reason: v.union(
      v.literal("event_unpublished"),
      v.literal("event_deleted"),
      v.literal("internal_event_deleted"),
    ),
    sourceTable: v.optional(
      v.union(v.literal("events"), v.literal("internalEvents")),
    ),
    sourceId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_calendar", ["calendar"])
    .index("by_googleEventId", ["googleEventId"]),

  attendees: defineTable({
    eventId: v.id("events"),
    userId: v.string(),
    timeCheckedIn: v.number(),
    food: v.string(),
    pointsEarned: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_userId", ["userId"]),

  reimbursements: defineTable({
    title: v.string(),
    totalAmount: v.number(),
    paymentMethod: v.string(),
    status: v.union(
      v.literal("submitted"),
      v.literal("declined"),
      v.literal("approved"),
      v.literal("paid"),
    ),
    submittedBy: v.string(),
    additionalInfo: v.string(),
    department: v.union(
      v.literal("internal"),
      v.literal("external"),
      v.literal("projects"),
      v.literal("events"),
      v.literal("other"),
    ),
    auditNotes: v.optional(
      v.array(
        v.object({
          note: v.string(),
          createdBy: v.string(),
          timestamp: v.number(),
        }),
      ),
    ),
    auditLogs: v.optional(
      v.array(
        v.object({
          action: v.string(),
          createdBy: v.string(),
          timestamp: v.number(),
        }),
      ),
    ),
    auditRequests: v.optional(
      v.array(
        v.object({
          auditorId: v.string(),
          requestedBy: v.string(),
          requestedAt: v.number(),
          status: v.union(
            v.literal("pending"),
            v.literal("completed"),
            v.literal("declined"),
          ),
          auditResult: v.optional(
            v.union(v.literal("approved"), v.literal("needs_changes")),
          ),
          auditNotes: v.optional(v.string()),
          completedAt: v.optional(v.number()),
        }),
      ),
    ),
    requiresExecutiveOverride: v.optional(v.boolean()),
    paymentDetails: v.optional(
      v.object({
        confirmationNumber: v.string(),
        paymentDate: v.number(),
        amountPaid: v.number(),
        proofFileUrl: v.optional(v.string()),
        memo: v.optional(v.string()),
      }),
    ),
    receipts: v.optional(v.array(receipt)),
    dateOfPurchase: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    createdAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_submittedBy", ["submittedBy"]),

  links: defineTable({
    url: v.string(),
    title: v.string(),
    category: v.string(),
    description: v.optional(v.string()),
    iconUrl: v.optional(v.string()),
    shortUrl: v.optional(v.string()),
    publishDate: v.optional(v.number()),
    expireDate: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    createdBy: v.string(),
    lastModified: v.optional(v.number()),
    lastModifiedBy: v.optional(v.string()),
    order: v.optional(v.number()),
  })
    .index("by_category", ["category"])
    .index("by_shortUrl", ["shortUrl"]),

  constitutions: defineTable({
    title: v.string(),
    organizationName: v.string(),
    sections: v.array(constitutionSection),
    version: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived"),
    ),
    lastModifiedBy: v.string(),
    createdAt: v.optional(v.number()),
    lastModified: v.optional(v.number()),
    collaborators: v.array(v.string()),
    isTemplate: v.optional(v.boolean()),
  }).index("by_status", ["status"]),

  constitutionVersions: defineTable({
    constitutionId: v.id("constitutions"),
    versionNumber: v.number(),
    label: v.string(),
    note: v.optional(v.string()),
    source: v.union(v.literal("manual"), v.literal("auto_backup")),
    snapshotTitle: v.string(),
    snapshotOrganizationName: v.string(),
    snapshotStatus: v.union(
      v.literal("draft"),
      v.literal("published"),
      v.literal("archived"),
    ),
    snapshotSections: v.array(constitutionSection),
    createdBy: v.string(),
    createdByName: v.string(),
    createdAt: v.number(),
    restoredFromVersionNumber: v.optional(v.number()),
  })
    .index("by_constitutionId", ["constitutionId"])
    .index("by_constitutionId_versionNumber", ["constitutionId", "versionNumber"])
    .index("by_constitutionId_createdAt", ["constitutionId", "createdAt"]),

  constitutionAuditLogs: defineTable({
    constitutionId: v.id("constitutions"),
    entries: v.array(
      v.object({
        id: v.string(),
        constitutionId: v.string(),
        sectionId: v.optional(v.string()),
        changeType: v.union(
          v.literal("create"),
          v.literal("update"),
          v.literal("delete"),
          v.literal("reorder"),
        ),
        changeDescription: v.string(),
        changeSummary: v.optional(v.string()),
        beforeValue: v.optional(v.any()),
        afterValue: v.optional(v.any()),
        userId: v.string(),
        userName: v.string(),
        timestamp: v.number(),
      }),
    ),
    totalEntries: v.number(),
  }).index("by_constitutionId", ["constitutionId"]),

  officerInvitations: defineTable({
    name: v.string(),
    email: v.string(),
    role: userRole,
    position: v.string(),
    offeredPositions: v.optional(v.array(v.string())),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired"),
    ),
    invitedBy: v.string(),
    invitedAt: v.number(),
    acceptedAt: v.optional(v.number()),
    declinedAt: v.optional(v.number()),
    expiresAt: v.number(),
    message: v.optional(v.string()),
    acceptanceDeadline: v.optional(v.string()),
    leaderName: v.optional(v.string()),
    googleGroupAssigned: v.optional(v.boolean()),
    googleGroup: v.optional(v.string()),
    permissionsGranted: v.optional(v.boolean()),
    onboardingEmailSent: v.optional(v.boolean()),
    resentAt: v.optional(v.number()),
    lastSentAt: v.optional(v.number()),
    roleGranted: v.optional(v.boolean()),
    roleGrantedAt: v.optional(v.number()),
    userCreatedOrUpdated: v.optional(v.boolean()),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  officerRejections: defineTable({
    name: v.string(),
    email: v.string(),
    positions: v.array(v.string()),
    customMessage: v.optional(v.string()),
    sentBy: v.string(),
    sentAt: v.number(),
    emailSent: v.boolean(),
  })
    .index("by_email", ["email"])
    .index("by_sentAt", ["sentAt"]),

  sponsorDomains: defineTable({
    domain: v.string(),
    organizationName: v.string(),
    sponsorTier: sponsorTier,
    createdAt: v.optional(v.number()),
    createdBy: v.string(),
    lastModified: v.optional(v.number()),
    lastModifiedBy: v.optional(v.string()),
    _updatedAt: v.optional(v.number()),
  }).index("by_domain", ["domain"]),

  fundRequests: defineTable({
    title: v.string(),
    purpose: v.string(),
    amount: v.number(),
    category: v.union(
      v.literal("event"),
      v.literal("travel"),
      v.literal("equipment"),
      v.literal("software"),
      v.literal("other"),
      v.literal("general"),
      v.literal("projects"),
    ),
    department: v.union(
      v.literal("events"),
      v.literal("projects"),
      v.literal("internal"),
      v.literal("other"),
    ),
    fundSource: v.optional(v.union(
      v.literal("ece"),
      v.literal("ieee"),
      v.literal("other"),
    )),
    status: v.union(
      v.literal("draft"),
      v.literal("submitted"),
      v.literal("needs_info"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("completed"),
    ),
    requestedBy: v.string(),
    submittedBy: v.string(),
    submittedByName: v.optional(v.string()),
    submittedByEmail: v.optional(v.string()),
    submittedAt: v.optional(v.number()),
    eventId: v.optional(v.id("events")),
    notes: v.optional(v.string()),
    reviewNotes: v.optional(v.string()),
    infoRequestNotes: v.optional(v.string()),
    infoResponseNotes: v.optional(v.string()),
    vendorLinks: v.optional(v.array(v.object({
      id: v.string(),
      url: v.string(),
      itemName: v.optional(v.string()),
      quantity: v.optional(v.number()),
    }))),
    attachments: v.optional(v.array(v.object({
      id: v.string(),
      url: v.string(),
      name: v.string(),
      size: v.number(),
      type: v.string(),
      uploadedAt: v.number(),
    }))),
    auditLogs: v.optional(v.array(v.object({
      id: v.string(),
      action: v.union(
        v.literal("created"),
        v.literal("updated"),
        v.literal("submitted"),
        v.literal("approved"),
        v.literal("denied"),
        v.literal("info_requested"),
        v.literal("info_provided"),
        v.literal("completed"),
      ),
      performedBy: v.string(),
      performedByName: v.optional(v.string()),
      timestamp: v.number(),
      notes: v.optional(v.string()),
      previousStatus: v.optional(v.string()),
      newStatus: v.optional(v.string()),
    }))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_requestedBy", ["requestedBy"])
    .index("by_department", ["department"]),

  fundDeposits: defineTable({
    title: v.string(),
    amount: v.number(),
    purpose: v.optional(v.string()),
    depositDate: v.number(),
    depositMethod: v.optional(
      v.union(
        v.literal("cash"),
        v.literal("check"),
        v.literal("bank_transfer"),
        v.literal("other"),
      ),
    ),
    otherDepositMethod: v.optional(v.string()),
    description: v.optional(v.string()),
    referenceNumber: v.optional(v.string()),
    receiptFiles: v.optional(v.array(v.string())),
    depositedBy: v.string(),
    depositedByName: v.optional(v.string()),
    depositedByEmail: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("verified"),
      v.literal("rejected"),
    ),
    submittedAt: v.optional(v.number()),
    verifiedBy: v.optional(v.string()),
    verifiedByName: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    notes: v.optional(v.string()),
    source: v.optional(v.string()),
    // IEEE deposit fields
    isIeeeDeposit: v.optional(v.boolean()),
    ieeeDepositSource: v.optional(
      v.union(
        v.literal("upp"),
        v.literal("section"),
        v.literal("region"),
        v.literal("global"),
        v.literal("society"),
        v.literal("other"),
      ),
    ),
    needsBankTransfer: v.optional(v.boolean()),
    bankTransferInstructions: v.optional(v.string()),
    bankTransferFiles: v.optional(v.array(v.string())),
    // Edit tracking
    editedBy: v.optional(v.string()),
    editedByName: v.optional(v.string()),
    editedAt: v.optional(v.number()),
    // Audit logs
    auditLogs: v.optional(
      v.array(
        v.object({
          action: v.string(),
          createdBy: v.string(),
          createdByName: v.optional(v.string()),
          timestamp: v.number(),
          note: v.optional(v.string()),
          previousData: v.optional(v.any()),
          newData: v.optional(v.any()),
        }),
      ),
    ),
  })
    .index("by_status", ["status"])
    .index("by_depositedBy", ["depositedBy"])
    .index("by_submittedAt", ["submittedAt"]),

  logs: defineTable({
    userId: v.string(),
    type: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("error"),
      v.literal("update"),
      v.literal("delete"),
      v.literal("create"),
      v.literal("login"),
      v.literal("logout"),
    ),
    part: v.string(),
    message: v.string(),
  }),

  organizationSettings: defineTable({
    googleSheetsContactListUrl: v.optional(v.string()),
    directOnboardingEmailTemplate: v.optional(v.string()),
    fallWeek0Start: v.optional(v.string()),
    winterWeek1Start: v.optional(v.string()),
    springWeek1Start: v.optional(v.string()),
    merchStoreEnabled: v.optional(v.boolean()),
    merchCheckoutEnabled: v.optional(v.boolean()),
    merchProjectSpaceName: v.optional(v.string()),
    merchProjectSpaceAddress: v.optional(v.string()),
    merchDefaultTimezone: v.optional(v.string()),
    merchMemberCancellationCutoffMinutes: v.optional(v.number()),
    updatedBy: v.optional(v.string()),
  }),

  merchProducts: defineTable({
    name: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("archived"),
    ),
    imageStorageId: v.optional(v.id("_storage")),
    imageContentType: v.optional(v.string()),
    imageFileName: v.optional(v.string()),
    availableFrom: v.optional(v.number()),
    availableUntil: v.optional(v.number()),
    purchaseLimit: v.optional(v.number()),
    displayOrder: v.number(),
    revision: v.number(),
    createdAt: v.number(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_status_displayOrder", ["status", "displayOrder"])
    .index("by_updatedAt", ["updatedAt"]),

  merchVariants: defineTable({
    productId: v.id("merchProducts"),
    sku: v.string(),
    normalizedSku: v.string(),
    optionValues: v.array(
      v.object({ name: v.string(), value: v.string() }),
    ),
    pointPrice: v.number(),
    stockOnHand: v.number(),
    active: v.boolean(),
    revision: v.number(),
    createdAt: v.number(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_product", ["productId"])
    .index("by_normalizedSku", ["normalizedSku"]),

  merchImageUploads: defineTable({
    claimToken: v.string(),
    managerId: v.id("users"),
    storageId: v.optional(v.id("_storage")),
    productId: v.optional(v.id("merchProducts")),
    state: v.union(
      v.literal("pending"),
      v.literal("uploaded"),
      v.literal("claimed"),
      v.literal("deleted"),
    ),
    createdAt: v.number(),
    expiresAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_claimToken", ["claimToken"])
    .index("by_storageId", ["storageId"])
    .index("by_state_expiresAt", ["state", "expiresAt"]),

  merchInventoryEntries: defineTable({
    variantId: v.id("merchVariants"),
    quantityDelta: v.number(),
    resultingQuantity: v.number(),
    kind: v.union(
      v.literal("initial"),
      v.literal("purchase"),
      v.literal("cancellation"),
      v.literal("adjustment"),
    ),
    orderId: v.optional(v.id("merchOrders")),
    sourceId: v.optional(v.string()),
    idempotencyKey: v.string(),
    actorId: v.id("users"),
    reason: v.string(),
    reversalOf: v.optional(v.id("merchInventoryEntries")),
    createdAt: v.number(),
  })
    .index("by_variant_createdAt", ["variantId", "createdAt"])
    .index("by_order", ["orderId"])
    .index("by_reversalOf", ["reversalOf"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  merchPickupEvents: defineTable({
    eventId: v.id("events"),
    enabled: v.boolean(),
    capacity: v.optional(v.number()),
    bookedCount: v.number(),
    bookingCutoffAt: v.optional(v.number()),
    managerNotes: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_event", ["eventId"])
    .index("by_enabled", ["enabled"]),

  merchPickupWindows: defineTable({
    requestId: v.string(),
    displayName: v.string(),
    address: v.string(),
    timezone: v.string(),
    startAt: v.number(),
    endAt: v.number(),
    slotDurationMinutes: v.number(),
    defaultCapacity: v.optional(v.number()),
    enabled: v.boolean(),
    createdAt: v.number(),
    createdBy: v.id("users"),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_startAt", ["startAt"])
    .index("by_requestId", ["requestId"])
    .index("by_enabled_startAt", ["enabled", "startAt"]),

  merchPickupSlots: defineTable({
    windowId: v.id("merchPickupWindows"),
    startAt: v.number(),
    endAt: v.number(),
    capacity: v.optional(v.number()),
    bookedCount: v.number(),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    updatedBy: v.id("users"),
  })
    .index("by_window_startAt", ["windowId", "startAt"])
    .index("by_enabled_startAt", ["enabled", "startAt"]),

  merchOrders: defineTable({
    orderNumber: v.string(),
    ownerId: v.id("users"),
    ownerName: v.string(),
    ownerEmail: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("fulfilled"),
      v.literal("canceled"),
    ),
    pickupHealth: v.union(
      v.literal("scheduled"),
      v.literal("overdue"),
      v.literal("action_required"),
    ),
    lines: v.array(
      v.object({
        productId: v.id("merchProducts"),
        variantId: v.id("merchVariants"),
        productName: v.string(),
        variantName: v.string(),
        sku: v.string(),
        imageStorageId: v.optional(v.id("_storage")),
        unitPrice: v.number(),
        quantity: v.number(),
        lineTotal: v.number(),
        productRevision: v.number(),
        variantRevision: v.number(),
        purchaseInventoryEntryId: v.optional(v.id("merchInventoryEntries")),
      }),
    ),
    totalPoints: v.number(),
    pickupType: v.union(v.literal("event"), v.literal("slot")),
    pickupEventId: v.optional(v.id("merchPickupEvents")),
    pickupSlotId: v.optional(v.id("merchPickupSlots")),
    pickupSnapshot: v.object({
      label: v.string(),
      address: v.string(),
      startAt: v.number(),
      endAt: v.number(),
      timezone: v.string(),
      cutoffAt: v.optional(v.number()),
    }),
    checkoutIdempotencyKey: v.string(),
    checkoutRequestFingerprint: v.optional(v.string()),
    qrToken: v.string(),
    purchaseLedgerEntryId: v.optional(v.id("pointLedgerEntries")),
    refundLedgerEntryId: v.optional(v.id("pointLedgerEntries")),
    fulfilledAt: v.optional(v.number()),
    fulfilledBy: v.optional(v.id("users")),
    fulfillmentRequestId: v.optional(v.string()),
    canceledAt: v.optional(v.number()),
    canceledBy: v.optional(v.id("users")),
    cancellationReason: v.optional(v.string()),
    lastRescheduleRequestId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_createdAt", ["ownerId", "createdAt"])
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_owner_checkoutKey", ["ownerId", "checkoutIdempotencyKey"])
    .index("by_orderNumber", ["orderNumber"])
    .index("by_qrToken", ["qrToken"])
    .index("by_pickupEvent", ["pickupEventId"])
    .index("by_pickupSlot", ["pickupSlotId"]),

  merchOrderEvents: defineTable({
    orderId: v.id("merchOrders"),
    action: v.union(
      v.literal("checkout"),
      v.literal("rescheduled"),
      v.literal("canceled"),
      v.literal("fulfilled"),
      v.literal("pickup_attention"),
    ),
    actorId: v.id("users"),
    beforeStatus: v.optional(v.string()),
    afterStatus: v.optional(v.string()),
    beforePickup: v.optional(v.any()),
    afterPickup: v.optional(v.any()),
    pickupEventId: v.optional(v.id("merchPickupEvents")),
    pickupSlotId: v.optional(v.id("merchPickupSlots")),
    reason: v.optional(v.string()),
    requestId: v.string(),
    pointLedgerEntryId: v.optional(v.id("pointLedgerEntries")),
    createdAt: v.number(),
  })
    .index("by_order_createdAt", ["orderId", "createdAt"])
    .index("by_requestId", ["requestId"]),

  merchNotificationOutbox: defineTable({
    orderId: v.id("merchOrders"),
    recipientUserId: v.id("users"),
    recipientEmail: v.string(),
    kind: v.union(
      v.literal("order_confirmation"),
      v.literal("rescheduled"),
      v.literal("canceled_refunded"),
      v.literal("fulfilled"),
    ),
    payload: v.any(),
    state: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("sent"),
      v.literal("dead_letter"),
    ),
    attempts: v.number(),
    nextAttemptAt: v.number(),
    processingStartedAt: v.optional(v.number()),
    inAppDeliveredAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    idempotencyKey: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_state_nextAttemptAt", ["state", "nextAttemptAt"])
    .index("by_order", ["orderId"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

  emailTemplates: defineTable({
    templateId: v.string(),
    templateName: v.string(),
    subject: v.string(),
    body: v.string(),
    variables: v.array(v.string()),
    updatedBy: v.string(),
    isDefault: v.boolean(),
  }).index("by_templateId", ["templateId"]),

  notifications: defineTable({
    userId: v.string(),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    data: v.optional(v.any()),
    read: v.boolean(),
    createdAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  googleGroupAssignments: defineTable({
    email: v.string(),
    googleGroup: v.string(),
    role: v.optional(v.string()),
    assignedAt: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
  }).index("by_email", ["email"]),

  directOnboardings: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.string(),
    position: v.string(),
    team: v.optional(v.string()),
    onboardedBy: v.string(),
    onboardedAt: v.number(),
    emailSent: v.boolean(),
    googleGroupAssigned: v.boolean(),
    googleGroup: v.optional(v.string()),
  }).index("by_email", ["email"]),

  invites: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.string(),
    position: v.optional(v.string()),
    message: v.optional(v.string()),
    invitedBy: v.string(),
    invitedAt: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
    ),
    acceptedAt: v.optional(v.number()),
    acceptedBy: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  // Budget configuration per department
  budgetConfigs: defineTable({
    department: v.union(
      v.literal("events"),
      v.literal("projects"),
      v.literal("internal"),
      v.literal("other"),
    ),
    totalBudget: v.number(),
    startDate: v.number(),
    updatedAt: v.number(),
    updatedBy: v.string(),
    updatedByName: v.optional(v.string()),
  })
    .index("by_department", ["department"]),

  // Manual budget adjustments
  budgetAdjustments: defineTable({
    department: v.union(
      v.literal("events"),
      v.literal("projects"),
      v.literal("internal"),
      v.literal("other"),
    ),
    amount: v.number(),
    description: v.string(),
    createdAt: v.number(),
    createdBy: v.string(),
    createdByName: v.optional(v.string()),
  })
    .index("by_department", ["department"]),
});
