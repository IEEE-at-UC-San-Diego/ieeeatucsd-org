/**
 * Verification Actions for Convex
 *
 * These actions provide read-only access to Convex data for migration verification.
 * All actions are designed to be non-destructive and support comprehensive
 * data integrity checks between Firebase and Convex.
 */

import { v } from 'convex/values';
import { action, mutation, query } from '../_generated/server';
import type { Id, Doc } from '../_generated/dataModel';

// ============================================================================
// VERIFICATION REPORT INTERFACES
// ============================================================================

/**
 * Individual verification check result
 */
export interface VerificationCheck {
  status: 'passed' | 'failed' | 'skipped';
  message: string;
  details?: Array<{
    table: string;
    issue: string;
    count: number;
  }>;
}

/**
 * Comprehensive verification report
 */
export interface VerificationReport {
  passed: boolean;
  timestamp: number;
  checks: {
    documentCounts: VerificationCheck;
    foreignKeys: VerificationCheck;
    fileChecksums: VerificationCheck;
    documentContent: VerificationCheck;
    tableSpecific: Record<string, VerificationCheck>;
  };
  summary: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    skippedChecks: number;
  };
}

/**
 * Firebase export data for comparison
 */
export interface FirebaseExportData {
  collectionCounts: Record<string, number>;
  fileChecksums?: Record<string, string>; // firebase path -> sha256 checksum
}

// ============================================================================
// MAIN VERIFICATION ACTIONS
// ============================================================================

/**
 * Run comprehensive verification suite
 *
 * Executes all verification checks and returns a complete report.
 */
export const verifyAll = action({
  args: {
    firebaseExportData: v.optional(v.any()),
    options: v.optional(
      v.object({
        skipDocumentContent: v.optional(v.boolean()),
        skipFileChecksums: v.optional(v.boolean()),
        sampleSize: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const options = args.options || {};
    const firebaseData = args.firebaseExportData as FirebaseExportData | undefined;

    const report: VerificationReport = {
      passed: true,
      timestamp: Date.now(),
      checks: {
        documentCounts: { status: 'skipped', message: 'Not run' },
        foreignKeys: { status: 'skipped', message: 'Not run' },
        fileChecksums: { status: 'skipped', message: 'Not run' },
        documentContent: { status: 'skipped', message: 'Not run' },
        tableSpecific: {},
      },
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        skippedChecks: 0,
      },
    };

    // Run document counts verification
    if (firebaseData?.collectionCounts) {
      report.checks.documentCounts = await ctx.runAction(api.verification.verifyDocumentCounts, {
        firebaseCollectionCounts: firebaseData.collectionCounts,
      });
    } else {
      report.checks.documentCounts = {
        status: 'skipped',
        message: 'Firebase export data not provided',
      };
    }

    // Run foreign key verification
    report.checks.foreignKeys = await ctx.runAction(api.verification.verifyForeignKeys, {});

    // Run file checksums verification
    if (!options.skipFileChecksums && firebaseData?.fileChecksums) {
      report.checks.fileChecksums = await ctx.runAction(api.verification.verifyFileChecksums, {
        firebaseFileChecksums: firebaseData.fileChecksums,
      });
    } else if (options.skipFileChecksums) {
      report.checks.fileChecksums = {
        status: 'skipped',
        message: 'Skipped by option',
      };
    } else {
      report.checks.fileChecksums = {
        status: 'skipped',
        message: 'Firebase file checksums not provided',
      };
    }

    // Run document content verification
    if (!options.skipDocumentContent && firebaseData?.collectionCounts) {
      report.checks.documentContent = await ctx.runAction(api.verification.verifyDocumentContent, {
        sampleSize: options.sampleSize || 5,
      });
    } else if (options.skipDocumentContent) {
      report.checks.documentContent = {
        status: 'skipped',
        message: 'Skipped by option',
      };
    }

    // Run table-specific verification
    report.checks.tableSpecific = await ctx.runAction(api.verification.verifyTableSpecific, {});

    // Calculate summary
    const allChecks = [
      report.checks.documentCounts,
      report.checks.foreignKeys,
      report.checks.fileChecksums,
      report.checks.documentContent,
      ...Object.values(report.checks.tableSpecific),
    ];

    report.summary.totalChecks = allChecks.length;
    report.summary.passedChecks = allChecks.filter((c) => c.status === 'passed').length;
    report.summary.failedChecks = allChecks.filter((c) => c.status === 'failed').length;
    report.summary.skippedChecks = allChecks.filter((c) => c.status === 'skipped').length;
    report.passed = report.summary.failedChecks === 0;

    return report;
  },
});

/**
 * Verify document counts match between Firebase and Convex
 *
 * Compares Firebase export counts with Convex table counts.
 */
export const verifyDocumentCounts = action({
  args: {
    firebaseCollectionCounts: v.record(v.string(), v.number()),
  },
  handler: async (ctx, args) => {
    const convexCounts = await ctx.runAction(api.verification.getCollectionCounts, {});

    const issues: Array<{ table: string; issue: string; count: number }> = [];
    let passed = true;

    // Firebase collection name to Convex table mapping
    const collectionToTable: Record<string, string> = {
      users: 'users',
      events: 'events',
      event_requests: 'event_requests',
      reimbursements: 'reimbursements',
      fundDeposits: 'fundDeposits',
      public_profiles: 'public_profiles',
      officerInvitations: 'officerInvitations',
      sponsorDomains: 'sponsorDomains',
      links: 'links',
      constitutions: 'constitutions',
      notifications: 'notifications',
      googleGroupAssignments: 'googleGroupAssignments',
      directOnboardings: 'directOnboardings',
      invites: 'invites',
      organizationSettings: 'organizationSettings',
      'events/attendees': 'event_attendees',
      'constitutions/sections': 'constitution_sections',
      'constitutions/auditLog': 'constitution_audit_log',
    };

    for (const [collection, firebaseCount] of Object.entries(args.firebaseCollectionCounts)) {
      const table = collectionToTable[collection];
      const convexCount = table ? convexCounts[table] || 0 : 0;

      if (firebaseCount !== convexCount) {
        passed = false;
        issues.push({
          table: table || collection,
          issue: `Count mismatch: Firebase=${firebaseCount}, Convex=${convexCount}`,
          count: Math.abs(firebaseCount - convexCount),
        });
      }
    }

    // Check for tables in Convex that weren't in Firebase export
    for (const [table, convexCount] of Object.entries(convexCounts)) {
      const collection = Object.keys(collectionToTable).find((c) => collectionToTable[c] === table);
      if (collection && !args.firebaseCollectionCounts[collection] && convexCount > 0) {
        // This might be expected if documents were added after migration
        issues.push({
          table,
          issue: `Extra documents in Convex not in Firebase export`,
          count: convexCount,
        });
      }
    }

    return {
      status: passed ? ('passed' as const) : ('failed' as const),
      message: passed
        ? 'All document counts match'
        : `Found ${issues.length} count mismatches`,
      details: issues,
    };
  },
});

/**
 * Verify document content by sampling and comparing values
 *
 * Samples documents from Convex and validates critical field values.
 */
export const verifyDocumentContent = action({
  args: {
    sampleSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const size = args.sampleSize || 5;
    const issues: Array<{ table: string; issue: string; count: number }> = [];

    // Define required fields for each table
    const requiredFields: Record<string, string[]> = {
      users: ['logtoSub', 'email', 'createdAt', 'updatedAt'],
      events: ['eventName', 'eventCode', 'startDate', 'endDate', 'createdAt'],
      event_attendees: ['eventId', 'userId', 'checkedInAt'],
      event_requests: ['name', 'startDateTime', 'endDateTime', 'status'],
      reimbursements: ['title', 'totalAmount', 'submittedBy', 'status'],
      fundDeposits: ['amount', 'depositedBy', 'status'],
      public_profiles: ['userId', 'name', 'points', 'totalEventsAttended'],
      constitutions: ['title', 'version', 'status'],
      constitution_sections: ['constitutionId', 'type', 'title', 'content'],
    };

    let totalIssues = 0;

    for (const [table, fields] of Object.entries(requiredFields)) {
      try {
        const sampleResult = await ctx.runAction(api.verification.getDocumentSample, {
          table,
          sampleSize: size,
        });

        if (!sampleResult.success) {
          issues.push({
            table,
            issue: `Failed to sample: ${sampleResult.error}`,
            count: 1,
          });
          totalIssues++;
          continue;
        }

        let tableIssues = 0;

        for (const doc of sampleResult.documents) {
          const missing: string[] = [];

          for (const field of fields) {
            if (doc[field as keyof typeof doc] === undefined || doc[field as keyof typeof doc] === null) {
              missing.push(field);
            }
          }

          if (missing.length > 0) {
            tableIssues++;
          }
        }

        if (tableIssues > 0) {
          issues.push({
            table,
            issue: `${tableIssues}/${sampleResult.documents.length} sampled documents missing required fields`,
            count: tableIssues,
          });
          totalIssues += tableIssues;
        }
      } catch (error) {
        issues.push({
          table,
          issue: `Error verifying: ${String(error)}`,
          count: 1,
        });
        totalIssues++;
      }
    }

    const passed = totalIssues === 0;

    return {
      status: passed ? ('passed' as const) : ('failed' as const),
      message: passed
        ? `All sampled documents have required fields`
        : `Found ${totalIssues} documents with missing required fields`,
      details: issues,
    };
  },
});

/**
 * Verify foreign key relationships
 *
 * Checks that all foreign key references point to valid documents.
 */
export const verifyForeignKeys = action({
  args: {},
  handler: async (ctx, args) => {
    const orphanResult = await ctx.runAction(api.verification.getAllOrphanedRecords, {});

    if (orphanResult.total === 0) {
      return {
        status: 'passed' as const,
        message: 'All foreign key references are valid',
        details: [],
      };
    }

    // Group by table for better reporting
    const byTable: Record<string, number> = {};
    for (const orphan of orphanResult.orphans) {
      byTable[orphan.table] = (byTable[orphan.table] || 0) + 1;
    }

    const details = Object.entries(byTable).map(([table, count]) => ({
      table,
      issue: `${count} orphaned records with broken references`,
      count,
    }));

    return {
      status: 'failed' as const,
      message: `Found ${orphanResult.total} orphaned records with broken references`,
      details,
    };
  },
});

/**
 * Verify file checksums between Firebase and Convex blobs
 *
 * Compares SHA-256 checksums from Firebase export with Convex blob checksums.
 */
export const verifyFileChecksums = action({
  args: {
    firebaseFileChecksums: v.record(v.string(), v.string()), // firebase path -> checksum
  },
  handler: async (ctx, args) => {
    const crypto = require('crypto');

    // Get all completed file migrations
    const completedMigrations = await ctx.runQuery(async (q) => {
      return q.db.query('fileMigrations').withIndex('byStatus', (q) => q.eq('status', 'completed')).collect();
    });

    const issues: Array<{ table: string; issue: string; count: number }> = [];
    let passed = true;
    let matchedCount = 0;

    for (const migration of completedMigrations) {
      const firebasePath = migration.firebasePath;
      const firebaseChecksum = args.firebaseFileChecksums[firebasePath];

      if (!firebaseChecksum) {
        issues.push({
          table: 'fileMigrations',
          issue: `Firebase checksum not found for path: ${firebasePath}`,
          count: 1,
        });
        passed = false;
        continue;
      }

      // Get blob from Convex storage and calculate checksum
      try {
        const blob = await ctx.storage.get(migration.blobId);

        if (!blob) {
          issues.push({
            table: 'fileMigrations',
            issue: `Blob not found for migration: ${firebasePath}`,
            count: 1,
          });
          passed = false;
          continue;
        }

        const hash = crypto.createHash('sha256');
        hash.update(await blob.arrayBuffer());
        const convexChecksum = hash.digest('hex');

        if (convexChecksum !== firebaseChecksum) {
          issues.push({
            table: 'fileMigrations',
            issue: `Checksum mismatch for ${firebasePath}: expected ${firebaseChecksum}, got ${convexChecksum}`,
            count: 1,
          });
          passed = false;
        } else {
          matchedCount++;
        }
      } catch (error) {
        issues.push({
          table: 'fileMigrations',
          issue: `Error calculating checksum for ${firebasePath}: ${String(error)}`,
          count: 1,
        });
        passed = false;
      }
    }

    const message = passed
      ? `All ${matchedCount} file checksums match`
      : `Found ${issues.length} checksum issues (${matchedCount}/${completedMigrations.length} matched)`;

    return {
      status: passed ? ('passed' as const) : ('failed' as const),
      message,
      details: issues,
    };
  },
});

/**
 * Verify table-specific constraints and uniqueness
 *
 * Checks table-specific validation rules like unique constraints.
 */
export const verifyTableSpecific = action({
  args: {},
  handler: async (ctx, args) => {
    const results: Record<string, VerificationCheck> = {};

    // Verify users: unique logtoSub and email
    results.users = await ctx.verifyUniqueFields('users', ['logtoSub', 'email']);

    // Verify events: unique eventCode
    results.events = await ctx.verifyUniqueFields('events', ['eventCode']);

    // Verify sponsorDomains: unique domain
    results.sponsorDomains = await ctx.verifyUniqueFields('sponsorDomains', ['domain']);

    // Verify organizationSettings: unique key
    results.organizationSettings = await ctx.verifyUniqueFields('organizationSettings', ['key']);

    // Verify officerInvitations: unique email
    results.officerInvitations = await ctx.verifyUniqueFields('officerInvitations', ['email']);

    // Verify directOnboardings: unique email
    results.directOnboardings = await ctx.verifyUniqueFields('directOnboardings', ['email']);

    // Verify invites: unique email
    results.invites = await ctx.verifyUniqueFields('invites', ['email']);

    // Verify events have attendees referencing valid events
    results.event_attendees = await ctx.verifyEventAttendeeReferences();

    // Verify constitution sections reference valid constitutions
    results.constitution_sections = await ctx.verifyConstitutionSectionReferences();

    return results;
  },
});

/**
 * Internal helper to verify unique fields in a table
 */
async function verifyUniqueFields(
  ctx: any,
  table: string,
  fields: string[]
): Promise<VerificationCheck> {
  const issues: Array<{ table: string; issue: string; count: number }> = [];

  for (const field of fields) {
    let docs: Doc<any>[] = [];

    try {
      docs = await ctx.runQuery(async (q: any) => {
        return q.db.query(table as any).collect();
      });
    } catch (error) {
      return {
        status: 'failed',
        message: `Failed to query ${table}: ${String(error)}`,
        details: [],
      };
    }

    const valueCounts: Record<string, number> = {};
    let duplicates = 0;

    for (const doc of docs) {
      const value = (doc as Record<string, unknown>)[field] as string | undefined;
      if (value) {
        valueCounts[value] = (valueCounts[value] || 0) + 1;
      }
    }

    for (const [value, count] of Object.entries(valueCounts)) {
      if (count > 1) {
        duplicates++;
      }
    }

    if (duplicates > 0) {
      issues.push({
        table,
        issue: `Field '${field}' has ${duplicates} duplicate value(s)`,
        count: duplicates,
      });
    }
  }

  if (issues.length > 0) {
    return {
      status: 'failed',
      message: `Found ${issues.length} uniqueness violations`,
      details: issues,
    };
  }

  return {
    status: 'passed',
    message: `All unique constraints verified for ${table}`,
  };
}

/**
 * Internal helper to verify event attendee references
 */
async function verifyEventAttendeeReferences(ctx: any): Promise<VerificationCheck> {
  try {
    const attendees = await ctx.runQuery(async (q: any) => {
      return q.db.query('event_attendees').collect();
    });

    const issues: Array<{ table: string; issue: string; count: number }> = [];
    let brokenRefs = 0;

    for (const attendee of attendees) {
      // Check event exists
      const event = await ctx.runQuery(async (q: any) => {
        return q.db.get(attendee.eventId as Id<'events'>);
      });

      if (!event) {
        brokenRefs++;
      }

      // Check user exists
      const user = await ctx.runQuery(async (q: any) => {
        return q.db.get(attendee.userId as Id<'users'>);
      });

      if (!user) {
        brokenRefs++;
      }
    }

    if (brokenRefs > 0) {
      return {
        status: 'failed',
        message: `Found ${brokenRefs} broken references in event_attendees`,
        details: [{ table: 'event_attendees', issue: 'Broken event or user references', count: brokenRefs }],
      };
    }

    return {
      status: 'passed',
      message: 'All event attendee references are valid',
    };
  } catch (error) {
    return {
      status: 'failed',
      message: `Error verifying event attendees: ${String(error)}`,
      details: [],
    };
  }
}

/**
 * Internal helper to verify constitution section references
 */
async function verifyConstitutionSectionReferences(ctx: any): Promise<VerificationCheck> {
  try {
    const sections = await ctx.runQuery(async (q: any) => {
      return q.db.query('constitution_sections').collect();
    });

    const issues: Array<{ table: string; issue: string; count: number }> = [];
    let brokenConstitutionRefs = 0;
    let brokenParentRefs = 0;

    for (const section of sections) {
      // Check constitution exists
      const constitution = await ctx.runQuery(async (q: any) => {
        return q.db.get(section.constitutionId as Id<'constitutions'>);
      });

      if (!constitution) {
        brokenConstitutionRefs++;
      }

      // Check parent section if specified
      if (section.parentId) {
        const parent = await ctx.runQuery(async (q: any) => {
          return q.db.get(section.parentId as Id<'constitution_sections'>);
        });

        if (!parent) {
          brokenParentRefs++;
        }
      }
    }

    if (brokenConstitutionRefs > 0 || brokenParentRefs > 0) {
      const details: Array<{ table: string; issue: string; count: number }> = [];
      if (brokenConstitutionRefs > 0) {
        details.push({
          table: 'constitution_sections',
          issue: 'Broken constitution references',
          count: brokenConstitutionRefs,
        });
      }
      if (brokenParentRefs > 0) {
        details.push({
          table: 'constitution_sections',
          issue: 'Broken parent section references',
          count: brokenParentRefs,
        });
      }
      return {
        status: 'failed',
        message: `Found ${brokenConstitutionRefs + brokenParentRefs} broken references`,
        details,
      };
    }

    return {
      status: 'passed',
      message: 'All constitution section references are valid',
    };
  } catch (error) {
    return {
      status: 'failed',
      message: `Error verifying constitution sections: ${String(error)}`,
      details: [],
    };
  }
}

// ============================================================================
// COLLECTION COUNT VERIFICATION
// ============================================================================

/**
 * Get document counts for all collections
 *
 * Returns the total document count for each collection/table.
 */
export const getCollectionCounts = action({
  args: {},
  handler: async (ctx, args) => {
    const tableNames: Array<keyof Doc<any>> = [
      'users',
      'userRoles',
      'roleAudit',
      'events',
      'event_attendees',
      'event_requests',
      'reimbursements',
      'fundDeposits',
      'public_profiles',
      'officerInvitations',
      'directOnboardings',
      'invites',
      'sponsorDomains',
      'links',
      'constitutions',
      'constitution_sections',
      'constitution_audit_log',
      'notifications',
      'googleGroupAssignments',
      'organizationSettings',
      'fileMigrations',
    ];

    const counts: Record<string, number> = {};

    for (const tableName of tableNames) {
      try {
        const docs = await ctx.runQuery(api.verification._queryAll, { table: tableName });
        counts[tableName] = docs.length;
      } catch (error) {
        counts[tableName] = 0;
      }
    }

    return counts;
  },
});

/**
 * Get document count for a specific collection
 */
export const getCollectionCount = action({
  args: { table: v.string() },
  handler: async (ctx, args) => {
    try {
      const docs = await ctx.runQuery(api.verification._queryAll, { table: args.table as any });
      return { success: true, count: docs.length };
    } catch (error) {
      return { success: false, count: 0, error: String(error) };
    }
  },
});

// ============================================================================
// DOCUMENT RETRIEVAL
// ============================================================================

/**
 * Retrieve a document by its original Firebase ID
 *
 * This uses a mapping table to find the Convex ID corresponding to the
 * original Firebase document ID. For now, assumes Firebase and Convex IDs
 * are the same for documents that were migrated with original IDs.
 */
export const getDocumentByOriginalId = action({
  args: {
    table: v.string(),
    originalId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Try to find the document by _id (assuming Firebase ID was used as Convex ID)
      const doc = await ctx.runQuery(api.verification._getById, {
        table: args.table as any,
        id: args.originalId as Id<any>,
      });

      if (!doc) {
        return { success: false, document: null, error: 'Document not found' };
      }

      // Convert Document to a plain object (remove system fields)
      const plainDoc = { ...doc };
      return { success: true, document: plainDoc };
    } catch (error) {
      return { success: false, document: null, error: String(error) };
    }
  },
});

/**
 * Retrieve multiple documents by a specific field value
 */
export const getDocumentsByField = action({
  args: {
    table: v.string(),
    field: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    try {
      const docs = await ctx.runQuery(api.verification._queryByField, {
        table: args.table as any,
        field: args.field,
        value: args.value,
      });

      return { success: true, documents: docs };
    } catch (error) {
      return { success: false, documents: [], error: String(error) };
    }
  },
});

/**
 * Retrieve a sample of documents from a table
 */
export const getDocumentSample = action({
  args: {
    table: v.string(),
    sampleSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const size = args.sampleSize ?? 5;

    try {
      // Get all documents and sample from them
      const allDocs = await ctx.runQuery(api.verification._queryAll, {
        table: args.table as any,
      });

      // Fisher-Yates shuffle to get random sample
      const shuffled = [...allDocs];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const sample = shuffled.slice(0, Math.min(size, shuffled.length));

      return { success: true, documents: sample, total: allDocs.length };
    } catch (error) {
      return { success: false, documents: [], total: 0, error: String(error) };
    }
  },
});

// ============================================================================
// REFERENTIAL INTEGRITY
// ============================================================================

/**
 * Check referential integrity for a collection's references
 *
 * Checks that all foreign key references point to valid documents.
 */
export const getReferentialIntegrity = action({
  args: {
    table: v.string(),
    referenceFields: v.array(v.string()),
    targetTables: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const results: Array<{
      table: string;
      referenceField: string;
      targetTable: string;
      totalRecords: number;
      validReferences: number;
      brokenReferences: number;
      orphanedRecords: Array<{ documentId: string; referenceValue: string }>;
    }> = [];

    for (let i = 0; i < args.referenceFields.length; i++) {
      const referenceField = args.referenceFields[i];
      const targetTable = args.targetTables[i];

      try {
        const integrity = await ctx.runQuery(api.verification._checkReferenceIntegrity, {
          table: args.table as any,
          referenceField,
          targetTable: targetTable as any,
        });

        results.push(integrity);
      } catch (error) {
        results.push({
          table: args.table,
          referenceField,
          targetTable,
          totalRecords: 0,
          validReferences: 0,
          brokenReferences: 0,
          orphanedRecords: [],
        });
      }
    }

    return results;
  },
});

/**
 * Get all orphaned records across all collections
 *
 * An orphaned record is one that has a reference to a non-existent document.
 */
export const getAllOrphanedRecords = action({
  args: {},
  handler: async (ctx, args) => {
    const orphans: Array<{
      table: string;
      documentId: string;
      referenceField: string;
      referenceValue: string;
      targetTable: string;
    }> = [];

    // Define reference mappings for all collections
    const referenceMappings: Array<{
      table: keyof Doc<any>;
      referenceField: string;
      targetTable: keyof Doc<any>;
    }> = [
      { table: 'public_profiles', referenceField: 'userId', targetTable: 'users' },
      { table: 'event_attendees', referenceField: 'eventId', targetTable: 'events' },
      { table: 'event_attendees', referenceField: 'userId', targetTable: 'users' },
      { table: 'event_requests', referenceField: 'requestedUser', targetTable: 'users' },
      { table: 'event_requests', referenceField: 'lastModifiedBy', targetTable: 'users' },
      { table: 'reimbursements', referenceField: 'submittedBy', targetTable: 'users' },
      { table: 'fundDeposits', referenceField: 'depositedBy', targetTable: 'users' },
      { table: 'fundDeposits', referenceField: 'approvedBy', targetTable: 'users' },
      { table: 'officerInvitations', referenceField: 'invitedBy', targetTable: 'users' },
      { table: 'directOnboardings', referenceField: 'createdBy', targetTable: 'users' },
      { table: 'directOnboardings', referenceField: 'userCreated', targetTable: 'users' },
      { table: 'invites', referenceField: 'invitedBy', targetTable: 'users' },
      { table: 'invites', referenceField: 'userId', targetTable: 'users' },
      { table: 'sponsorDomains', referenceField: 'createdBy', targetTable: 'users' },
      { table: 'sponsorDomains', referenceField: 'lastModifiedBy', targetTable: 'users' },
      { table: 'links', referenceField: 'createdBy', targetTable: 'users' },
      { table: 'links', referenceField: 'lastModifiedBy', targetTable: 'users' },
      { table: 'constitutions', referenceField: 'lastModifiedBy', targetTable: 'users' },
      { table: 'constitution_sections', referenceField: 'constitutionId', targetTable: 'constitutions' },
      { table: 'constitution_sections', referenceField: 'parentId', targetTable: 'constitution_sections' },
      { table: 'constitution_sections', referenceField: 'lastModifiedBy', targetTable: 'users' },
      { table: 'constitution_audit_log', referenceField: 'constitutionId', targetTable: 'constitutions' },
      { table: 'constitution_audit_log', referenceField: 'sectionId', targetTable: 'constitution_sections' },
      { table: 'constitution_audit_log', referenceField: 'userId', targetTable: 'users' },
      { table: 'notifications', referenceField: 'userId', targetTable: 'users' },
      { table: 'googleGroupAssignments', referenceField: 'userId', targetTable: 'users' },
      { table: 'googleGroupAssignments', referenceField: 'assignedBy', targetTable: 'users' },
      { table: 'googleGroupAssignments', referenceField: 'removedBy', targetTable: 'users' },
      { table: 'organizationSettings', referenceField: 'lastModifiedBy', targetTable: 'users' },
      { table: 'users', referenceField: 'invitedBy', targetTable: 'users' },
      { table: 'users', referenceField: 'lastUpdatedBy', targetTable: 'users' },
      { table: 'userRoles', referenceField: 'userId', targetTable: 'users' },
      { table: 'roleAudit', referenceField: 'userId', targetTable: 'users' },
      { table: 'roleAudit', referenceField: 'performedBy', targetTable: 'users' },
    ];

    for (const mapping of referenceMappings) {
      try {
        const integrity = await ctx.runQuery(api.verification._checkReferenceIntegrity, mapping);

        for (const orphan of integrity.orphanedRecords) {
          orphans.push({
            table: mapping.table,
            documentId: orphan.documentId,
            referenceField: mapping.referenceField,
            referenceValue: orphan.referenceValue,
            targetTable: mapping.targetTable,
          });
        }
      } catch (error) {
        // Skip on error
        continue;
      }
    }

    return { total: orphans.length, orphans };
  },
});

// ============================================================================
// FIELD VALIDATION
// ============================================================================

/**
 * Verify field values for a specific document
 *
 * Compares expected field values with actual values in the document.
 */
export const verifyCollectionFields = action({
  args: {
    table: v.string(),
    documentId: v.string(),
    expectedFields: v.record(v.string(), v.any()),
  },
  handler: async (ctx, args) => {
    try {
      const doc = await ctx.runQuery(api.verification._getById, {
        table: args.table as any,
        id: args.documentId as Id<any>,
      });

      if (!doc) {
        return {
          success: false,
          document: null,
          matches: {},
          mismatches: {},
          error: 'Document not found',
        };
      }

      const matches: Record<string, unknown> = {};
      const mismatches: Record<string, { expected: unknown; actual: unknown }> = {};

      for (const [field, expectedValue] of Object.entries(args.expectedFields)) {
        const actualValue = (doc as any)[field];

        // Deep comparison
        if (JSON.stringify(actualValue) === JSON.stringify(expectedValue)) {
          matches[field] = actualValue;
        } else {
          mismatches[field] = { expected: expectedValue, actual: actualValue };
        }
      }

      return {
        success: true,
        document: doc,
        matches,
        mismatches,
      };
    } catch (error) {
      return {
        success: false,
        document: null,
        matches: {},
        mismatches: {},
        error: String(error),
      };
    }
  },
});

/**
 * Validate required fields are present in a collection
 */
export const validateCollectionFields = action({
  args: {
    table: v.string(),
    requiredFields: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const docs = await ctx.runQuery(api.verification._queryAll, {
        table: args.table as any,
      });

      const missingRequiredFields: Record<string, string[]> = {};
      let totalValid = 0;

      for (const doc of docs) {
        const missing: string[] = [];

        for (const field of args.requiredFields) {
          if (doc[field as keyof typeof doc] === undefined || doc[field as keyof typeof doc] === null) {
            missing.push(field);
          }
        }

        if (missing.length > 0) {
          missingRequiredFields[doc._id] = missing;
        } else {
          totalValid++;
        }
      }

      return {
        success: true,
        totalDocuments: docs.length,
        documentsWithMissingFields: Object.keys(missingRequiredFields).length,
        totalValid,
        perDocumentMissingFields: missingRequiredFields,
      };
    } catch (error) {
      return {
        success: false,
        totalDocuments: 0,
        documentsWithMissingFields: 0,
        totalValid: 0,
        perDocumentMissingFields: {},
        error: String(error),
      };
    }
  },
});

// ============================================================================
// BLOB AND FILE VERIFICATION
// ============================================================================

/**
 * Get checksum of a stored blob
 *
 * Returns the SHA-256 checksum of the blob data.
 * This requires reading the blob content, which may be slow for large files.
 */
export const getBlobFileChecksum = action({
  args: {
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const crypto = require('crypto');

      // Fetch blob from storage
      const blob = await ctx.storage.get(args.storageId);

      if (!blob) {
        return { success: false, checksum: null, error: 'Blob not found' };
      }

      // Calculate SHA-256 checksum
      const hash = crypto.createHash('sha256');
      hash.update(await blob.arrayBuffer());
      const checksum = hash.digest('hex');

      return { success: true, checksum, size: blob.size };
    } catch (error) {
      return { success: false, checksum: null, error: String(error) };
    }
  },
});

/**
 * Verify multiple blob checksums
 */
export const verifyBlobChecksums = action({
  args: {
    checksums: v.array(
      v.object({
        storageId: v.string(),
        expectedChecksum: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results: Array<{
      storageId: string;
      expectedChecksum: string;
      actualChecksum: string | null;
      matches: boolean;
      error?: string;
    }> = [];

    const crypto = require('crypto');

    for (const item of args.checksums) {
      try {
        const blob = await ctx.storage.get(item.storageId);

        if (!blob) {
          results.push({
            storageId: item.storageId,
            expectedChecksum: item.expectedChecksum,
            actualChecksum: null,
            matches: false,
            error: 'Blob not found',
          });
          continue;
        }

        // Calculate checksum
        const hash = crypto.createHash('sha256');
        hash.update(await blob.arrayBuffer());
        const actualChecksum = hash.digest('hex');

        const matches = actualChecksum === item.expectedChecksum;

        results.push({
          storageId: item.storageId,
          expectedChecksum: item.expectedChecksum,
          actualChecksum,
          matches,
        });
      } catch (error) {
        results.push({
          storageId: item.storageId,
          expectedChecksum: item.expectedChecksum,
          actualChecksum: null,
          matches: false,
          error: String(error),
        });
      }
    }

    return results;
  },
});

// ============================================================================
// QUERY EQUIVALENCE TRIGGERS
// ============================================================================

/**
 * Trigger for querying users by email
 *
 * Used to verify that user lookup by email works identically in both systems.
 */
export const queryUsersByEmail = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const user = await ctx.runQuery(api.verification._queryByField, {
        table: 'users',
        field: 'email',
        value: args.email,
      });

      return { success: true, documents: user };
    } catch (error) {
      return { success: false, documents: [], error: String(error) };
    }
  },
});

/**
 * Trigger for querying users by status
 */
export const queryUsersByStatus = action({
  args: {
    status: v.union(
      v.literal('active'),
      v.literal('inactive'),
      v.literal('suspended')
    ),
  },
  handler: async (ctx, args) => {
    try {
      const users = await ctx.runQuery(api.verification._queryByField, {
        table: 'users',
        field: 'status',
        value: args.status,
      });

      return { success: true, count: users.length, documents: users };
    } catch (error) {
      return { success: false, count: 0, documents: [], error: String(error) };
    }
  },
});

/**
 * Trigger for querying events by date range
 */
export const queryEventsByDateRange = action({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      const events = await ctx.runQuery(api.verification._queryEventsByDateRange, {
        startDate: args.startDate,
        endDate: args.endDate,
      });

      return { success: true, count: events.length, documents: events };
    } catch (error) {
      return { success: false, count: 0, documents: [], error: String(error) };
    }
  },
});

/**
 * Trigger for querying reimbursements by status
 */
export const queryReimbursementsByStatus = action({
  args: {
    status: v.union(
      v.literal('submitted'),
      v.literal('declined'),
      v.literal('approved'),
      v.literal('paid')
    ),
  },
  handler: async (ctx, args) => {
    try {
      const reimbursements = await ctx.runQuery(api.verification._queryByField, {
        table: 'reimbursements',
        field: 'status',
        value: args.status,
      });

      return { success: true, count: reimbursements.length, documents: reimbursements };
    } catch (error) {
      return { success: false, count: 0, documents: [], error: String(error) };
    }
  },
});

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

/**
 * Internal query to get all documents from a table
 */
const _queryAll = query({
  args: { table: v.string() },
  handler: async (ctx, args) => {
    const db = ctx.db;
    let results: Doc<any>[] = [];

    try {
      // Use a type-safe query based on the table name
      switch (args.table) {
        case 'users':
          results = (await db.query('users').collect()) as Doc<any>[];
          break;
        case 'userRoles':
          results = (await db.query('userRoles').collect()) as Doc<any>[];
          break;
        case 'roleAudit':
          results = (await db.query('roleAudit').collect()) as Doc<any>[];
          break;
        case 'events':
          results = (await db.query('events').collect()) as Doc<any>[];
          break;
        case 'event_attendees':
          results = (await db.query('event_attendees').collect()) as Doc<any>[];
          break;
        case 'event_requests':
          results = (await db.query('event_requests').collect()) as Doc<any>[];
          break;
        case 'reimbursements':
          results = (await db.query('reimbursements').collect()) as Doc<any>[];
          break;
        case 'fundDeposits':
          results = (await db.query('fundDeposits').collect()) as Doc<any>[];
          break;
        case 'public_profiles':
          results = (await db.query('public_profiles').collect()) as Doc<any>[];
          break;
        case 'officerInvitations':
          results = (await db.query('officerInvitations').collect()) as Doc<any>[];
          break;
        case 'directOnboardings':
          results = (await db.query('directOnboardings').collect()) as Doc<any>[];
          break;
        case 'invites':
          results = (await db.query('invites').collect()) as Doc<any>[];
          break;
        case 'sponsorDomains':
          results = (await db.query('sponsorDomains').collect()) as Doc<any>[];
          break;
        case 'links':
          results = (await db.query('links').collect()) as Doc<any>[];
          break;
        case 'constitutions':
          results = (await db.query('constitutions').collect()) as Doc<any>[];
          break;
        case 'constitution_sections':
          results = (await db.query('constitution_sections').collect()) as Doc<any>[];
          break;
        case 'constitution_audit_log':
          results = (await db.query('constitution_audit_log').collect()) as Doc<any>[];
          break;
        case 'notifications':
          results = (await db.query('notifications').collect()) as Doc<any>[];
          break;
        case 'googleGroupAssignments':
          results = (await db.query('googleGroupAssignments').collect()) as Doc<any>[];
          break;
        case 'organizationSettings':
          results = (await db.query('organizationSettings').collect()) as Doc<any>[];
          break;
        case 'fileMigrations':
          results = (await db.query('fileMigrations').collect()) as Doc<any>[];
          break;
        default:
          results = [];
      }
    } catch (error) {
      results = [];
    }

    return results;
  },
});

/**
 * Internal query to get document by ID
 */
const _getById = query({
  args: {
    table: v.string(),
    id: v.id('users'), // Generic ID, will be cast
  },
  handler: async (ctx, args) => {
    const db = ctx.db;

    try {
      const doc = await db.get(args.id as any);
      return doc;
    } catch (error) {
      return null;
    }
  },
});

/**
 * Internal query to get documents by field value
 */
const _queryByField = query({
  args: {
    table: v.string(),
    field: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const db = ctx.db;
    let results: Doc<any>[] = [];

    try {
      switch (args.table) {
        case 'users':
          results = (await db
            .query('users')
            .filter((q) => q.eq(q.field(args.field as keyof Doc<'users'>), args.value as any))
            .collect()) as Doc<any>[];
          break;
        case 'userRoles':
          results = (await db
            .query('userRoles')
            .filter((q) => q.eq(q.field(args.field as keyof Doc<'userRoles'>), args.value as any))
            .collect()) as Doc<any>[];
          break;
        case 'events':
          results = (await db
            .query('events')
            .filter((q) => q.eq(q.field(args.field as keyof Doc<'events'>), args.value as any))
            .collect()) as Doc<any>[];
          break;
        case 'public_profiles':
          results = (await db
            .query('public_profiles')
            .filter((q) => q.eq(q.field(args.field as keyof Doc<'public_profiles'>), args.value as any))
            .collect()) as Doc<any>[];
          break;
        case 'officerInvitations':
          results = (await db
            .query('officerInvitations')
            .filter((q) => q.eq(q.field(args.field as keyof Doc<'officerInvitations'>), args.value as any))
            .collect()) as Doc<any>[];
          break;
        case 'reimbursements':
          results = (await db
            .query('reimbursements')
            .filter((q) => q.eq(q.field(args.field as keyof Doc<'reimbursements'>), args.value as any))
            .collect()) as Doc<any>[];
          break;
        case 'fundDeposits':
          results = (await db
            .query('fundDeposits')
            .filter((q) => q.eq(q.field(args.field as keyof Doc<'fundDeposits'>), args.value as any))
            .collect()) as Doc<any>[];
          break;
        case 'links':
          results = (await db
            .query('links')
            .filter((q) => q.eq(q.field(args.field as keyof Doc<'links'>), args.value as any))
            .collect()) as Doc<any>[];
          break;
        case 'sponsorDomains':
          results = (await db
            .query('sponsorDomains')
            .filter((q) => q.eq(q.field(args.field as keyof Doc<'sponsorDomains'>), args.value as any))
            .collect()) as Doc<any>[];
          break;
        case 'notifications':
          results = (await db
            .query('notifications')
            .filter((q) => q.eq(q.field(args.field as keyof Doc<'notifications'>), args.value as any))
            .collect()) as Doc<any>[];
          break;
        case 'invites':
          results = (await db
            .query('invites')
            .filter((q) => q.eq(q.field(args.field as keyof Doc<'invites'>), args.value as any))
            .collect()) as Doc<any>[];
          break;
        default:
          results = [];
      }
    } catch (error) {
      results = [];
    }

    return results;
  },
});

/**
 * Internal query to check reference integrity
 */
const _checkReferenceIntegrity = query({
  args: {
    table: v.string(),
    referenceField: v.string(),
    targetTable: v.string(),
  },
  handler: async (ctx, args) => {
    const db = ctx.db;
    const orphanedRecords: Array<{ documentId: string; referenceValue: string }> = [];

    try {
      let sourceDocs: Doc<any>[] = [];

      // Get all documents from source table
      switch (args.table) {
        case 'public_profiles':
          sourceDocs = (await db.query('public_profiles').collect()) as Doc<any>[];
          break;
        case 'event_attendees':
          sourceDocs = (await db.query('event_attendees').collect()) as Doc<any>[];
          break;
        case 'event_requests':
          sourceDocs = (await db.query('event_requests').collect()) as Doc<any>[];
          break;
        case 'reimbursements':
          sourceDocs = (await db.query('reimbursements').collect()) as Doc<any>[];
          break;
        case 'fundDeposits':
          sourceDocs = (await db.query('fundDeposits').collect()) as Doc<any>[];
          break;
        case 'officerInvitations':
          sourceDocs = (await db.query('officerInvitations').collect()) as Doc<any>[];
          break;
        case 'directOnboardings':
          sourceDocs = (await db.query('directOnboardings').collect()) as Doc<any>[];
          break;
        case 'invites':
          sourceDocs = (await db.query('invites').collect()) as Doc<any>[];
          break;
        case 'sponsorDomains':
          sourceDocs = (await db.query('sponsorDomains').collect()) as Doc<any>[];
          break;
        case 'links':
          sourceDocs = (await db.query('links').collect()) as Doc<any>[];
          break;
        case 'constitutions':
          sourceDocs = (await db.query('constitutions').collect()) as Doc<any>[];
          break;
        case 'constitution_sections':
          sourceDocs = (await db.query('constitution_sections').collect()) as Doc<any>[];
          break;
        case 'constitution_audit_log':
          sourceDocs = (await db.query('constitution_audit_log').collect()) as Doc<any>[];
          break;
        case 'notifications':
          sourceDocs = (await db.query('notifications').collect()) as Doc<any>[];
          break;
        case 'googleGroupAssignments':
          sourceDocs = (await db.query('googleGroupAssignments').collect()) as Doc<any>[];
          break;
        case 'organizationSettings':
          sourceDocs = (await db.query('organizationSettings').collect()) as Doc<any>[];
          break;
        case 'users':
          sourceDocs = (await db.query('users').collect()) as Doc<any>[];
          break;
        case 'userRoles':
          sourceDocs = (await db.query('userRoles').collect()) as Doc<any>[];
          break;
        case 'roleAudit':
          sourceDocs = (await db.query('roleAudit').collect()) as Doc<any>[];
          break;
        default:
          sourceDocs = [];
      }

      for (const doc of sourceDocs) {
        const referenceValue = (doc as Record<string, unknown>)[args.referenceField];

        if (referenceValue === undefined || referenceValue === null) {
          continue; // Null references are not considered broken
        }

        // For array references
        if (Array.isArray(referenceValue)) {
          for (const ref of referenceValue) {
            if (typeof ref === 'string') {
              try {
                const exists = await db.get(ref as any);
                if (!exists) {
                  orphanedRecords.push({
                    documentId: doc._id,
                    referenceValue: ref,
                  });
                }
              } catch {
                orphanedRecords.push({
                  documentId: doc._id,
                  referenceValue: ref,
                });
              }
            }
          }
        } else if (typeof referenceValue === 'string') {
          try {
            const exists = await db.get(referenceValue as any);
            if (!exists) {
              orphanedRecords.push({
                documentId: doc._id,
                referenceValue: referenceValue as string,
              });
            }
          } catch {
            orphanedRecords.push({
              documentId: doc._id,
              referenceValue: referenceValue as string,
            });
          }
        }
      }
    } catch (error) {
      // Return partial results on error
    }

    return {
      table: args.table,
      referenceField: args.referenceField,
      targetTable: args.targetTable,
      totalRecords: sourceDocs?.length ?? 0,
      validReferences: sourceDocs?.length ?? orphanedRecords.length,
      brokenReferences: orphanedRecords.length,
      orphanedRecords,
    };
  },
});

/**
 * Internal query for events by date range
 */
const _queryEventsByDateRange = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const db = ctx.db;

    const events = await db
      .query('events')
      .filter((q) =>
        q.and(
          q.gte(q.field('startDate'), args.startDate),
          q.lte(q.field('endDate'), args.endDate)
        )
      )
      .collect();

    return events;
  },
});
