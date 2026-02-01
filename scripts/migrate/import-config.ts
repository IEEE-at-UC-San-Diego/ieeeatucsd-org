/**
 * Convex Import Configuration
 *
 * Defines import order, collection settings, and dependencies for the
 * Firebase to Convex migration.
 */

import type { ConvexId } from './transformed-types';

// ============================================================================
// COLLECTION IMPORT ORDER
// ============================================================================

/**
 * Collection import phases - defines the order for maintaining referential integrity
 * Collections are imported in phases to ensure dependencies are available before
 * documents that reference them are imported.
 */
export const IMPORT_PHASES = {
  // Phase 1: Independent collections (no dependencies on other collections)
 phase1: ['organizationSettings', 'sponsorDomains'],

  // Phase 2: Parent collections (referenced by others but don't reference other tables)
  phase2: [
    'users',
    'public_profiles',
    'events',
    'officerInvitations',
    'directOnboardings',
    'invites',
    'constitutions',
  ],

  // Phase 3: Dependent collections (reference parent collections)
  phase3: [
    'event_attendees', // depends on events, users
    'event_requests', // depends on users
    'reimbursements', // depends on users
    'fundDeposits', // depends on users
    'constitution_sections', // depends on constitutions
    'constitution_audit_log', // depends on constitutions
  ],

  // Phase 4: Collections with cross-references
  phase4: [
    'notifications', // depends on users
    'links', // depends on users
    'googleGroupAssignments', // depends on users
  ],
} as const;

/**
 * All collections in their correct import order
 */
export const ALL_COLLECTIONS = [
  ...IMPORT_PHASES.phase1,
  ...IMPORT_PHASES.phase2,
  ...IMPORT_PHASES.phase3,
  ...IMPORT_PHASES.phase4,
] as const;

/**
 * Collection to phase mapping
 */
export const COLLECTION_PHASES: Record<string, number> = ALL_COLLECTIONS.reduce((acc, collection) => {
  acc[collection] = Object.keys(IMPORT_PHASES).findIndex((phase) =>
    IMPORT_PHASES[phase as keyof typeof IMPORT_PHASES].includes(collection)
  ) + 1;
  return acc;
}, {} as Record<string, number>);

// ============================================================================
// COLLECTION DEPENDENCIES
// ============================================================================

/**
 * Maps collections to their dependencies (collections they reference)
 * Used to validate import order and handle edge cases
 */
export const COLLECTION_DEPENDENCIES: Record<string, string[]> = {
  users: [],
  userRoles: ['users'],
  roleAudit: ['users'],
  public_profiles: ['users'],
  events: ['users'],
  event_attendees: ['events', 'users'],
  event_requests: ['users'],
  reimbursements: ['users'],
  fundDeposits: ['users'],
  officerInvitations: ['users'],
  directOnboardings: ['users'],
  invites: ['users'],
  sponsorDomains: [],
  links: ['users'],
  constitutions: ['users'],
  constitution_sections: ['constitutions', 'constitution_sections', 'users'],
  constitution_audit_log: ['constitutions', 'constitution_sections', 'users'],
  notifications: ['users'],
  googleGroupAssignments: ['users'],
  organizationSettings: [],
};

// ============================================================================
// COLLECTION SETTINGS
// ============================================================================

/**
 * Settings for each collection during import
 */
export interface CollectionImportSettings {
  /** Enable/disable import for this collection */
  enabled: boolean;
  /** Batch size for insert operations */
  batchSize: number;
  /** Delay in ms between batches (for rate limiting) */
  batchDelay: number;
  /** What to do if document already exists: 'skip' or 'update' */
  onExisting: 'skip' | 'update' | 'error';
  /** Whether to continue on individual document errors */
  continueOnError: boolean;
  /** Whether this is a subcollection */
  isSubcollection: boolean;
  /** Parent collection (if subcollection) */
  parentCollection?: string;
  /** Foreign key field that references parent */
  parentReferenceField?: string;
  /** Fields that are Convex ID references */
  idReferenceFields: string[];
}

/**
 * Default settings for collection imports
 */
export const COLLECTION_SETTINGS: Record<string, CollectionImportSettings> = {
  organizationSettings: {
    enabled: true,
    batchSize: 100,
    batchDelay: 50,
    onExisting: 'update',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['lastModifiedBy'],
  },

  sponsorDomains: {
    enabled: true,
    batchSize: 100,
    batchDelay: 50,
    onExisting: 'update',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['createdBy', 'lastModifiedBy'],
  },

  users: {
    enabled: true,
    batchSize: 50,
    batchDelay: 100,
    onExisting: 'update',
    continueOnError: false,
    isSubcollection: false,
    idReferenceFields: ['invitedBy', 'lastUpdatedBy'],
  },

  userRoles: {
    enabled: true,
    batchSize: 100,
    batchDelay: 50,
    onExisting: 'update',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['userId'],
  },

  roleAudit: {
    enabled: true,
    batchSize: 100,
    batchDelay: 50,
    onExisting: 'skip',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['userId', 'performedBy'],
  },

  public_profiles: {
    enabled: true,
    batchSize: 100,
    batchDelay: 50,
    onExisting: 'update',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['userId'],
  },

  events: {
    enabled: true,
    batchSize: 50,
    batchDelay: 75,
    onExisting: 'update',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['createdFrom', 'createdBy'],
  },

  event_attendees: {
    enabled: true,
    batchSize: 100,
    batchDelay: 50,
    onExisting: 'skip',
    continueOnError: true,
    isSubcollection: true,
    parentCollection: 'events',
    parentReferenceField: 'eventId',
    idReferenceFields: ['eventId', 'userId'],
  },

  event_requests: {
    enabled: true,
    batchSize: 50,
    batchDelay: 75,
    onExisting: 'update',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['requestedUser', 'lastModifiedBy'],
  },

  reimbursements: {
    enabled: true,
    batchSize: 50,
    batchDelay: 75,
    onExisting: 'update',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['submittedBy'],
  },

  fundDeposits: {
    enabled: true,
    batchSize: 100,
    batchDelay: 50,
    onExisting: 'update',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['depositedBy', 'approvedBy'],
  },

  officerInvitations: {
    enabled: true,
    batchSize: 100,
    batchDelay: 50,
    onExisting: 'skip',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['invitedBy'],
  },

  directOnboardings: {
    enabled: true,
    batchSize: 100,
    batchDelay: 50,
    onExisting: 'skip',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['createdBy', 'userCreated'],
  },

  invites: {
    enabled: true,
    batchSize: 100,
    batchDelay: 50,
    onExisting: 'skip',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['invitedBy', 'userId'],
  },

  constitutions: {
    enabled: true,
    batchSize: 50,
    batchDelay: 75,
    onExisting: 'update',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['lastModifiedBy', 'collaborators'],
  },

  constitution_sections: {
    enabled: true,
    batchSize: 50,
    batchDelay: 75,
    onExisting: 'update',
    continueOnError: true,
    isSubcollection: true,
    parentCollection: 'constitutions',
    parentReferenceField: 'constitutionId',
    idReferenceFields: ['constitutionId', 'parentId', 'lastModifiedBy'],
  },

  constitution_audit_log: {
    enabled: true,
    batchSize: 100,
    batchDelay: 50,
    onExisting: 'skip',
    continueOnError: true,
    isSubcollection: true,
    parentCollection: 'constitutions',
    parentReferenceField: 'constitutionId',
    idReferenceFields: ['constitutionId', 'sectionId', 'userId'],
  },

  notifications: {
    enabled: true,
    batchSize: 100,
    batchDelay: 50,
    onExisting: 'skip',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['userId'],
  },

  links: {
    enabled: true,
    batchSize: 100,
    batchDelay: 50,
    onExisting: 'update',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['createdBy', 'lastModifiedBy'],
  },

  googleGroupAssignments: {
    enabled: true,
    batchSize: 100,
    batchDelay: 50,
    onExisting: 'skip',
    continueOnError: true,
    isSubcollection: false,
    idReferenceFields: ['userId', 'assignedBy', 'removedBy'],
  },
};

// ============================================================================
// IMPORT OPTIONS
// ============================================================================

/**
 * Global import options
 */
export interface ImportOptions {
  /** Path to transformed JSON files */
  inputDir: string;
  /** Dry run mode - don't actually import data */
  dryRun: boolean;
  /** Verbose logging output */
  verbose: boolean;
  /** Specific collections to import (empty = all) */
  collections: string[];
  /** Continue on collection-level errors */
  continueOnError: boolean;
  /** Convex deployment URL */
  convexDeployment?: string;
  /** Skip existing documents */
  skipExisting?: boolean;
}

/**
 * Default import options
 */
export const DEFAULT_IMPORT_OPTIONS: ImportOptions = {
  inputDir: './scripts/migrate/transformed',
  dryRun: false,
  verbose: false,
  collections: [],
  continueOnError: true,
  convexDeployment: undefined,
  skipExisting: undefined,
};

// ============================================================================
// IMPORT RESULT TYPES
// ============================================================================

/**
 * Result of importing a single document
 */
export interface DocumentImportResult {
  /** Original ID from transformed data */
  originalId: string;
  /** Convex-assigned ID (for created documents) */
  convexId?: string;
  /** Whether the import was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Result of importing a collection
 */
export interface CollectionImportResult {
  /** Collection name */
  collection: string;
  /** Whether the collection import was successful */
  success: boolean;
  /** Total documents attempted */
  documentCount: number;
  /** Number of successful imports */
  successCount: number;
  /** Number of failed imports */
  failureCount: number;
  /** Number of skipped documents */
  skippedCount: number;
  /** Individual document results (if verbose) */
  documentResults?: DocumentImportResult[];
  /** Error message if collection-level failure */
  error?: string;
  /** Duration in milliseconds */
  duration: number;
}

/**
 * Overall import report
 */
export interface ImportReport {
  /** Start timestamp */
  startTime: string;
  /** End timestamp */
  endTime: string;
  /** Total duration in milliseconds */
  duration: number;
  /** Whether the entire import was successful */
  success: boolean;
  /** Total collections imported */
  totalCollections: number;
  /** Successful collections */
  successfulCollections: number;
  /** Failed collections */
  failedCollections: number;
  /** Total documents across all collections */
  totalDocuments: number;
  /** Total successful imports */
  totalSuccesses: number;
  /** Total failed imports */
  totalFailures: number;
  /** Total skipped documents */
  totalSkipped: number;
  /** Per-collection results */
  results: CollectionImportResult[];
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates that a collection name is recognized
 */
export function isValidCollection(collection: string): boolean {
  return ALL_COLLECTIONS.includes(collection as (typeof ALL_COLLECTIONS)[number]);
}

/**
 * Validates that the import order is correct (no dependencies are imported before their dependencies)
 */
export function validateImportOrder(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const imported: Set<string> = new Set();

  for (const collection of ALL_COLLECTIONS) {
    const deps = COLLECTION_DEPENDENCIES[collection] || [];
    for (const dep of deps) {
      if (!imported.has(dep)) {
        errors.push(`${collection} depends on ${dep} which is imported later`);
      }
    }
    imported.add(collection);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Gets the import order for specific collections, maintaining dependency order
 */
export function getImportOrderForCollections(collections: string[]): string[] {
  const collectionSet = new Set(collections);
  return ALL_COLLECTIONS.filter((c) => collectionSet.has(c));
}
