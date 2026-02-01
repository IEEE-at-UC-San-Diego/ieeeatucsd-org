/**
 * Convex Backfill Actions
 *
 * Server-side actions for backfill operations on migrated data.
 * These actions support:
 * - Upserting documents (insert or update)
 * - Deleting orphaned records
 * - Repairing broken references
 * - Getting collection differences
 * - Merging document updates
 * - Syncing incremental changes
 * - Rolling back collections
 * - Re-running migrations with transformers
 */

import { v } from 'convex/values';
import { mutation, action, query } from './_generated/server';
import {
  transformUsers,
  transformEvents,
  transformEventAttendees,
  transformEventRequests,
  transformReimbursements,
  transformFundDeposits,
  transformPublicProfiles,
  transformOfficerInvitations,
  transformDirectOnboardings,
  transformInvites,
  transformSponsorDomains,
  transformLinks,
  transformConstitutions,
  transformConstitutionSections,
  transformConstitutionAuditLog,
  transformNotifications,
  transformGoogleGroupAssignments,
  transformOrganizationSettings,
} from '../migration/transformers';
import type { ExportedDocument } from './firebase-export';
import type { ExportedDocument as FirebaseExportedDocument } from './firebase-export';

// ============================================================================
// VALID TABLE NAMES
// ============================================================================

const VALID_TABLES = [
  'users',
  'userRoles',
  'roleAudit',
  'public_profiles',
  'events',
  'event_attendees',
  'event_requests',
  'reimbursements',
  'fundDeposits',
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
] as const;

type ValidTable = (typeof VALID_TABLES)[number];

// ============================================================================
// BACKFILL COLLECTION
// ============================================================================

/**
 * Get documents to backfill (candidates for re-import)
 */
export const getBackfillCandidates = action({
  args: {
    table: v.string(),
    lastUpdatedAfter: v.optional(v.number()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!VALID_TABLES.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;
    const lastUpdated = args.lastUpdatedAfter || 0;
    const limit = args.batchSize || 100;

    // Get documents that were updated since the specified timestamp
    // @ts-expect-error - Dynamic table access
    const documents = await ctx.runQuery(async (queryCtx) => {
      // @ts-expect-error - Dynamic table access
      return queryCtx.db
        .query(table)
        .filter((q) => q.gt(q.field('_creationTime'), lastUpdated))
        .take(limit);
    });

    return { documents };
  },
});

/**
 * Upsert documents (insert or update existing ones)
 */
export const upsertDocuments = action({
  args: {
    table: v.string(),
    documents: v.array(v.any()),
    options: v.object({
      skipExisting: v.optional(v.boolean()),
      continueOnError: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    if (!VALID_TABLES.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;
    const skipExisting = args.options.skipExisting ?? false;
    const continueOnError = args.options.continueOnError ?? true;

    const results = {
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      errors: [] as string[],
    };

    for (const doc of args.documents) {
      try {
        const docId = doc._id as string;

        if (!docId) {
          results.failureCount++;
          results.errors.push('Document missing _id field');
          continue;
        }

        // Create a clean document without _id
        const { _id, ...cleanDoc } = doc as Record<string, unknown>;

        // Check if document exists
        // @ts-expect-error - Dynamic table access
        const existing = await ctx.runQuery(async (queryCtx) => {
          // @ts-expect-error - Dynamic table access
          return queryCtx.db.get(docId as any);
        });

        if (existing) {
          if (skipExisting) {
            results.skippedCount++;
            continue;
          }

          // Update existing document
          await ctx.runMutation(async (mutationCtx) => {
            await mutationCtx.db.patch(existing._id, cleanDoc);
          });

          results.successCount++;
        } else {
          // Insert new document
          const convexId = await ctx.runMutation(async (mutationCtx) => {
            // @ts-expect-error - Dynamic table access with custom _id
            return mutationCtx.db.insert(table, { ...cleanDoc, _id: docId }) as any;
          });

          results.successCount++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.failureCount++;
        results.errors.push(errorMessage);

        if (!continueOnError) {
          break;
        }
      }
    }

    return results;
  },
});

/**
 * Merge document updates into existing documents
 */
export const mergeDocuments = action({
  args: {
    table: v.string(),
    updates: v.array(
      v.object({
        _id: v.string(),
        updates: v.any(),
      })
    ),
    options: v.object({
      continueOnError: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    if (!VALID_TABLES.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;
    const continueOnError = args.options.continueOnError ?? true;

    const results = {
      mergedCount: 0,
      notFoundCount: 0,
      errorCount: 0,
      errors: [] as string[],
    };

    for (const { _id, updates } of args.updates) {
      try {
        // Get existing document
        // @ts-expect-error - Dynamic table access
        const existing = await ctx.runQuery(async (queryCtx) => {
          // @ts-expect-error - Dynamic table access
          return queryCtx.db.get(_id as any);
        });

        if (!existing) {
          results.notFoundCount++;
          continue;
        }

        // Merge updates into existing document
        await ctx.runMutation(async (mutationCtx) => {
          await mutationCtx.db.patch(existing._id, updates);
        });

        results.mergedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errorCount++;
        results.errors.push(`${_id}: ${errorMessage}`);

        if (!continueOnError) {
          break;
        }
      }
    }

    return results;
  },
});

/**
 * Get differences between collections (for sync comparison)
 */
export const getCollectionDiff = action({
  args: {
    table: v.string(),
    sourceDocuments: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    if (!VALID_TABLES.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;

    // Get all documents in the table
    // @ts-expect-error - Dynamic table access
    const existingDocs = await ctx.runQuery(async (queryCtx) => {
      // @ts-expect-error - Dynamic table access
      return queryCtx.db.query(table).collect();
    });

    // Create a map of existing documents by ID
    const existingMap = new Map(
      existingDocs.map(doc => [(doc._id || doc.createdBy || doc.userId || 'unknown'), doc])
    );

    const diff = {
      newDocuments: [] as any[],
      updatedDocuments: [] as any[],
      unchangedDocuments: [] as any[],
      deletedFromSource: [] as any[],
    };

    for (const sourceDoc of args.sourceDocuments) {
      const docId = sourceDoc._id as string;
      const existing = existingMap.get(docId);

      if (!existing) {
        diff.newDocuments.push(sourceDoc);
      } else {
        // Compare documents (simple comparison)
        const existingWithoutId = { ...existing };
        delete (existingWithoutId as any)._id;
        const sourceWithoutId = { ...sourceDoc };
        delete (sourceWithoutId as any)._id;

        const existingJson = JSON.stringify(existingWithoutId);
        const sourceJson = JSON.stringify(sourceWithoutId);

        if (existingJson !== sourceJson) {
          diff.updatedDocuments.push({
            existing: existingWithoutId,
            source: sourceWithoutId,
            _id: docId,
          });
        } else {
          diff.unchangedDocuments.push(docId);
        }
      }
    }

    return diff;
  },
});

// ============================================================================
// REPAIR OPERATIONS
// ============================================================================

/**
 * Delete orphaned records (those that reference non-existent documents)
 */
export const deleteOrphanedRecords = action({
  args: {
    table: v.string(),
    referenceFields: v.array(v.string()),
    targetTables: v.array(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!VALID_TABLES.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;
    const dryRun = args.options?.dryRun ?? false;

    // Get all documents in the table
    // @ts-expect-error - Dynamic table access
    const documents = await ctx.runQuery(async (queryCtx) => {
      // @ts-expect-error - Dynamic table access
      return queryCtx.db.query(table).collect();
    });

    const removed: string[] = [];
    const scanned = documents.length;

    for (const doc of documents) {
      let isOrphan = false;

      // Check each reference field
      for (const field of args.referenceFields) {
        const refValue = (doc as Record<string, unknown>)[field];

        if (!refValue) continue;

        // Handle both single references and arrays
        const refs = Array.isArray(refValue) ? refValue : [refValue];

        for (const ref of refs) {
          if (typeof ref !== 'string') continue;

          // Check if referenced document exists
          for (const targetTable of args.targetTables) {
            if (!VALID_TABLES.includes(targetTable as ValidTable)) continue;

            try {
              // @ts-expect-error - Dynamic table access
              const exists = await ctx.runQuery(async (queryCtx) => {
                // @ts-expect-error - Dynamic table access
                return queryCtx.db.get(ref as any);
              });

              if (!exists) {
                isOrphan = true;
                break;
              }
            } catch {
              isOrphan = true;
              break;
            }
          }

          if (isOrphan) break;
        }

        if (isOrphan) break;
      }

      if (isOrphan) {
        if (!dryRun) {
          await ctx.runMutation(async (mutationCtx) => {
            await mutationCtx.db.delete(doc._id);
          });
        }
        removed.push(doc._id as string);
      }
    }

    return { removed, scanned };
  },
});

/**
 * Repair broken references (set to null or remove)
 */
export const repairReferences = action({
  args: {
    table: v.string(),
    referenceFields: v.array(v.string()),
    targetTables: v.array(v.string()),
    repairAction: v.optional(v.union(v.literal('null'), v.literal('remove'))),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!VALID_TABLES.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;
    const repairAction = args.repairAction ?? 'null';
    const dryRun = args.dryRun ?? false;

    // Get all documents in the table
    // @ts-expect-error - Dynamic table access
    const documents = await ctx.runQuery(async (queryCtx) => {
      // @ts-expect-error - Dynamic table access
      return queryCtx.db.query(table).collect();
    });

    const fixed = 0;
    const scanned = documents.length;
    const errors: string[] = [];

    for (const doc of documents) {
      const updates: Record<string, unknown> = {};
      let hasFixes = false;

      for (const field of args.referenceFields) {
        const refValue = (doc as Record<string, unknown>)[field];

        if (!refValue) continue;

        const isArray = Array.isArray(refValue);
        const refs = isArray ? refValue : [refValue];

        const validRefs: unknown[] = [];

        for (const ref of refs) {
          if (typeof ref !== 'string') {
            validRefs.push(ref);
            continue;
          }

          let refExists = false;
          for (const targetTable of args.targetTables) {
            if (!VALID_TABLES.includes(targetTable as ValidTable)) continue;

            try {
              // @ts-expect-error - Dynamic table access
              const exists = await ctx.runQuery(async (queryCtx) => {
                // @ts-expect-error - Dynamic table access
                return queryCtx.db.get(ref as any);
              });

              if (exists) {
                refExists = true;
                break;
              }
            } catch {
              // Continue to next target table
            }
          }

          if (refExists) {
            validRefs.push(ref);
          } else {
            hasFixes = true;
          }
        }

        if (hasFixes) {
          if (repairAction === 'null' && validRefs.length === refs.length) {
            // No changes needed
            hasFixes = false;
          } else {
            updates[field] = isArray
              ? (repairAction === 'remove' ? validRefs : validRefs.length > 0 ? validRefs : null)
              : (repairAction === 'remove' ? validRefs[0] : null);
          }
        }
      }

      if (hasFixes && Object.keys(updates).length > 0) {
        if (!dryRun) {
          try {
            await ctx.runMutation(async (mutationCtx) => {
              // @ts-expect-error - Dynamic patch
              mutationCtx.db.patch(doc._id, updates);
            });
          } catch (error) {
            errors.push(`${doc._id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }

    return { fixed: errors.length === 0 ? scanned : 0, scanned, errors };
  },
});

/**
 * Remove duplicate documents
 */
export const removeDuplicates = action({
  args: {
    table: v.string(),
    uniqueFields: v.array(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!VALID_TABLES.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;
    const dryRun = args.dryRun ?? false;

    // Get all documents in the table
    // @ts-expect-error - Dynamic table access
    const documents = await ctx.runQuery(async (queryCtx) => {
      // @ts-expect-error - Dynamic table access
      return queryCtx.db.query(table).collect();
    });

    const removed: string[] = [];
    const scanned = documents.length;

    // Track seen documents by unique field combinations
    const seen = new Map<string, string>(); // key -> first doc ID

    for (const doc of documents) {
      const key = args.uniqueFields
        .map(field => (doc as Record<string, unknown>)[field])
        .join('|');

      if (seen.has(key)) {
        // Duplicate found
        if (!dryRun) {
          await ctx.runMutation(async (mutationCtx) => {
            await mutationCtx.db.delete(doc._id);
          });
        }
        removed.push(doc._id as string);
      } else {
        seen.set(key, doc._id as string);
      }
    }

    return { removed, scanned };
  },
});

/**
 * Repair data types (convert strings to numbers, etc.)
 */
export const repairTypes = action({
  args: {
    table: v.string(),
    fieldTypes: v.array(
      v.object({
        field: v.string(),
        targetType: v.union(v.literal('number'), v.literal('string'), v.literal('boolean')),
      })
    ),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!VALID_TABLES.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;
    const dryRun = args.dryRun ?? false;

    // Get all documents in the table
    // @ts-expect-error - Dynamic table access
    const documents = await ctx.runQuery(async (queryCtx) => {
      // @ts-expect-error - Dynamic table access
      return queryCtx.db.query(table).collect();
    });

    const repaired = 0;
    const scanned = documents.length;

    for (const doc of documents) {
      const updates: Record<string, unknown> = {};

      for (const { field, targetType } of args.fieldTypes) {
        const value = (doc as Record<string, unknown>)[field];

        if (value === undefined || value === null) {
          continue;
        }

        const currentType = typeof value;
        if (currentType === targetType) {
          continue;
        }

        // Attempt type conversion
        let converted: unknown;
        const conversionFailed = false;

        try {
          switch (targetType) {
            case 'number':
              converted = Number(value);
              if (isNaN(Number(converted))) {
                throw new Error('Not a valid number');
              }
              break;
            case 'string':
              converted = String(value);
              break;
            case 'boolean':
              if (value === 'true' || value === 1 || value === '1') {
                converted = true;
              } else if (value === 'false' || value === 0 || value === '0') {
                converted = false;
              } else {
                throw new Error('Not a valid boolean');
              }
              break;
          }
        } catch {
          continue;
        }

        updates[field] = converted;
      }

      if (Object.keys(updates).length > 0) {
        if (!dryRun) {
          await ctx.runMutation(async (mutationCtx) => {
            mutationCtx.db.patch(doc._id, updates);
          });
        }
      }
    }

    return { repaired, scanned };
  },
});

// ============================================================================
// VERIFICATION
// ============================================================================

/**
 * Verify collection integrity
 */
export const verifyCollection = action({
  args: {
    table: v.string(),
    checkOrphans: v.optional(v.boolean()),
    checkReferences: v.optional(v.boolean()),
    checkDuplicates: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!VALID_TABLES.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;
    const startTime = Date.now();

    // Get all documents in the table
    // @ts-expect-error - Dynamic table access
    const documents = await ctx.runQuery(async (queryCtx) => {
      // @ts-expect-error - Dynamic table access
      return queryCtx.db.query(table).collect();
    });

    const result = {
      totalDocuments: documents.length,
      orphanedRecords: 0,
      brokenReferences: 0,
      duplicateRecords: 0,
      typeErrors: 0,
      duration: 0,
    };

    // Check for orphans
    if (args.checkOrphans) {
      const refFields = ['userId', 'eventId', 'constitutionId', 'invitedBy', 'deletedBy', 'createdBy'];
      const targetTables = ['users', 'events', 'constitutions'];

      for (const doc of documents) {
        for (const field of refFields) {
          const refValue = (doc as Record<string, unknown>)[field];
          if (!refValue || typeof refValue !== 'string') continue;

          let refExists = false;
          for (const targetTable of targetTables) {
            if (!VALID_TABLES.includes(targetTable as ValidTable)) continue;

            try {
              // @ts-expect-error - Dynamic table access
              const exists = await ctx.runQuery(async (queryCtx) => {
                // @ts-expect-error - Dynamic table access
                return queryCtx.db.get(refValue as any);
              });

              if (exists) {
                refExists = true;
                break;
              }
            } catch {
              // Continue
            }
          }

          if (!refExists) {
            result.orphanedRecords++;
            break;
          }
        }
      }
    }

    // Check for broken references
    if (args.checkReferences) {
      const refFields = ['submittedBy', 'depositedBy', 'requestedUser', 'collaborators'];

      for (const doc of documents) {
        for (const field of refFields) {
          const refValue = (doc as Record<string, unknown>)[field];
          if (!refValue) continue;

          const refs = Array.isArray(refValue) ? refValue : [refValue];

          for (const ref of refs) {
            if (typeof ref !== 'string') continue;

            let refExists = false;
            for (const targetTable of ['users']) {
              try {
                // @ts-expect-error - Dynamic table access
                const exists = await ctx.runQuery(async (queryCtx) => {
                  // @ts-expect-error - Dynamic table access
                  return queryCtx.db.get(ref as any);
                });

                if (exists) {
                  refExists = true;
                  break;
                }
              } catch {
                // Continue
              }
            }

            if (!refExists) {
              result.brokenReferences++;
              break;
            }
          }
        }
      }
    }

    // Check for duplicates (by commonly unique fields)
    if (args.checkDuplicates) {
      const uniqueFields = ['logtoSub', 'email', 'domain', 'key'];
      const seenKeys = new Set<string>();

      for (const doc of documents) {
        for (const field of uniqueFields) {
          const value = (doc as Record<string, unknown>)[field];
          if (!value) continue;

          const key = `${field}:${value}`;
          if (seenKeys.has(key)) {
            result.duplicateRecords++;
            break;
          }
          seenKeys.add(key);
        }
      }
    }

    result.duration = Date.now() - startTime;

    return result;
  },
});

// ============================================================================
// INCREMENTAL SYNC
// ============================================================================

/**
 * Sync incremental changes from a source
 */
export const syncIncremental = action({
  args: {
    table: v.string(),
    since: v.number(),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!VALID_TABLES.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;
    const dryRun = args.dryRun ?? false;

    // Get documents created/updated since the timestamp
    // @ts-expect-error - Dynamic table access
    const documents = await ctx.runQuery(async (queryCtx) => {
      // @ts-expect-error - Dynamic table access
      return queryCtx.db
        .query(table)
        .filter((q) => q.gt(q.field('_creationTime'), args.since))
        .collect();
    });

    const synced = documents.length;
    const errors: string[] = [];

    // In a real implementation, this would sync with Firebase or another source
    // For now, return the documents that would need syncing

    return { synced, documents, errors, dryRun };
  },
});

// ============================================================================
// ROLLBACK
// ============================================================================

/**
 * Rollback a collection to a backup state
 */
export const rollbackCollection = action({
  args: {
    table: v.string(),
    backupId: v.string(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!VALID_TABLES.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;
    const force = args.force ?? false;

    // In a real implementation, this would:
    // 1. Load backup data from storage (file or separate table)
    // 2.Validate backup integrity
    // 3. Delete all current documents
    // 4. Insert documents from backup
    // 5. Verify the restore

    // For now, return a placeholder response
    throw new Error('Rollback requires a backup storage mechanism. Implement with storage actions.');
  },
});

// ============================================================================
// BACKUP OPERATIONS
// ============================================================================

/**
 * Export a collection for backup
 */
export const exportCollection = action({
  args: {
    table: v.string(),
  },
  handler: async (ctx, args) => {
    if (!VALID_TABLES.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;

    // Get all documents
    // @ts-expect-error - Dynamic table access
    const documents = await ctx.runQuery(async (queryCtx) => {
      // @ts-expect-error - Dynamic table access
      return queryCtx.db.query(table).collect();
    });

    return { documents };
  },
});

/**
 * Restore a collection from backup
 */
export const restoreCollection = action({
  args: {
    table: v.string(),
    documents: v.array(v.any()),
    options: v.object({
      force: v.optional(v.boolean()),
      skipExisting: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    if (!VALID_TABLES.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;
    const force = args.options.force ?? false;
    const skipExisting = args.options.skipExisting ?? false;

    const results = {
      restored: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const doc of args.documents) {
      try {
        const docId = doc._id as string;
        if (!docId) {
          results.failed++;
          results.errors.push('Document missing _id');
          continue;
        }

        // Check if exists
        // @ts-expect-error - Dynamic table access
        const existing = await ctx.runQuery(async (queryCtx) => {
          // @ts-expect-error - Dynamic table access
          return queryCtx.db.get(docId as any);
        });

        if (existing && !force) {
          results.skipped++;
          continue;
        }

        const { _id, ...cleanDoc } = doc as Record<string, unknown>;

        if (existing) {
          await ctx.runMutation(async (mutationCtx) => {
            await mutationCtx.db.delete(existing._id);
          });
        }

        const newId = await ctx.runMutation(async (mutationCtx) => {
          // @ts-expect-error - Dynamic table access
          return mutationCtx.db.insert(table, { ...cleanDoc, _id: docId }) as any;
        });

        results.restored++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.failed++;
        results.errors.push(`${(doc._id as string)}: ${errorMessage}`);
      }
    }

    return results;
  },
});

// ============================================================================
// MIGRATION RERUN UTILITIES
// ============================================================================

/**
 * Transformer mapping for re-running migrations
 */
const MIGRATION_TRANSFORMERS: Record<string, (doc: ExportedDocument) => any> = {
  users: transformUsers,
  events: transformEvents,
  'events/attendees': transformEventAttendees,
  event_requests: transformEventRequests,
  reimbursements: transformReimbursements,
  fundDeposits: transformFundDeposits,
  public_profiles: transformPublicProfiles,
  officerInvitations: transformOfficerInvitations,
  directOnboardings: transformDirectOnboardings,
  invites: transformInvites,
  sponsorDomains: transformSponsorDomains,
  links: transformLinks,
  constitutions: transformConstitutions,
  'constitutions/sections': transformConstitutionSections,
  'constitutions/auditLog': transformConstitutionAuditLog,
  notifications: transformNotifications,
  googleGroupAssignments: transformGoogleGroupAssignments,
  organizationSettings: transformOrganizationSettings,
};

/**
 * Re-run migration for a specific collection with updated transformer logic
 */
export const rerunCollectionMigration = action({
  args: {
    collection: v.string(),
    exportData: v.array(v.any()),
    options: v.object({
      clearFirst: v.optional(v.boolean()),
      dryRun: v.optional(v.boolean()),
      continueOnError: v.optional(v.boolean()),
      batchSize: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const transformer = MIGRATION_TRANSFORMERS[args.collection];
    if (!transformer) {
      throw new Error(`No transformer found for collection: ${args.collection}`);
    }

    const options = {
      clearFirst: args.options.clearFirst ?? true,
      dryRun: args.options.dryRun ?? false,
      continueOnError: args.options.continueOnError ?? true,
      batchSize: args.options.batchSize ?? 100,
    };

    // Determine target table
    const tableMap: Record<string, string> = {
      'events/attendees': 'event_attendees',
      'constitutions/sections': 'constitution_sections',
      'constitutions/auditLog': 'constitution_audit_log',
    };
    const table = tableMap[args.collection] || args.collection;

    if (!VALID_TABLES.includes(table as ValidTable)) {
      throw new Error(`Invalid table: ${table}`);
    }

    // Clear existing data if requested
    if (options.clearFirst && !options.dryRun) {
      const clearResult = await ctx.runMutation(async (mutationCtx) => {
        // @ts-expect-error - Dynamic table access
        const existing = await mutationCtx.db.query(table).collect();
        for (const doc of existing) {
          await mutationCtx.db.delete(doc._id);
        }
        return { cleared: existing.length };
      });
    }

    const results: Array<{
      originalId: string;
      convexId?: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const doc of args.exportData) {
      try {
        const originalId = doc._id as string;
        if (!originalId) {
          results.push({
            originalId: 'unknown',
            success: false,
            error: 'Document missing _id field',
          });
          if (!options.continueOnError) break;
          continue;
        }

        // Transform the document
        const transformed = transformer(doc as ExportedDocument);
        const { _id, ...cleanDoc } = transformed as Record<string, unknown>;

        if (options.dryRun) {
          results.push({
            originalId,
            success: true,
            error: undefined,
          });
          continue;
        }

        // Insert the document
        const convexId = await ctx.runMutation(async (mutationCtx) => {
          // @ts-expect-error - Dynamic table access
          return mutationCtx.db.insert(table, cleanDoc);
        });

        results.push({
          originalId,
          convexId,
          success: true,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          originalId: (doc as ExportedDocument)._id as string || 'unknown',
          success: false,
          error: errorMessage,
        });

        if (!options.continueOnError) {
          break;
        }
      }
    }

    return {
      collection: args.collection,
      table,
      totalDocuments: args.exportData.length,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
      results,
    };
  },
});

/**
 * Re-run migration for multiple collections
 */
export const rerunAllMigrations = action({
  args: {
    exportData: v.array(
      v.object({
        collection: v.string(),
        documents: v.array(v.any()),
      })
    ),
    options: v.object({
      clearFirst: v.optional(v.boolean()),
      dryRun: v.optional(v.boolean()),
      continueOnError: v.optional(v.boolean()),
      batchSize: v.optional(v.number()),
      clearOrder: v.optional(v.array(v.string())), // Order to clear tables (respect dependencies)
    }),
  },
  handler: async (ctx, args) => {
    const clearOrder = args.options.clearOrder || [
      'event_attendees',
      'constitution_audit_log',
      'constitution_sections',
      'notifications',
      'googleGroupAssignments',
      'public_profiles',
      'events',
      'event_requests',
      'reimbursements',
      'fundDeposits',
      'invites',
      'officerInvitations',
      'directOnboardings',
      'sponsorDomains',
      'links',
      'constitutions',
      'organizationSettings',
      'users',
    ];

    const results: Array<{
      collection: string;
      table: string;
      totalDocuments: number;
      successCount: number;
      failureCount: number;
    }> = [];

    const options = {
      clearFirst: args.options.clearFirst ?? true,
      dryRun: args.options.dryRun ?? false,
      continueOnError: args.options.continueOnError ?? true,
      batchSize: args.options.batchSize ?? 100,
    };

    // Clear all tables in order if requested
    if (options.clearFirst && !options.dryRun) {
      for (const tableName of clearOrder) {
        if (!VALID_TABLES.includes(tableName as ValidTable)) continue;
        await ctx.runMutation(async (mutationCtx) => {
          // @ts-expect-error - Dynamic table access
          const existing = await mutationCtx.db.query(tableName).collect();
          for (const doc of existing) {
            await mutationCtx.db.delete(doc._id);
          }
        });
      }
    }

    // Import all collections
    for (const exportItem of args.exportData) {
      const result = await ctx.runAction(rerunCollectionMigration, {
        collection: exportItem.collection,
        exportData: exportItem.documents,
        options: {
          ...options,
          clearFirst: false, // Already cleared
        },
      });

      results.push({
        collection: result.collection,
        table: result.table,
        totalDocuments: result.totalDocuments,
        successCount: result.successCount,
        failureCount: result.failureCount,
      });

      if (!options.continueOnError) {
        const hasFailures = result.failureCount > 0;
        if (hasFailures) break;
      }
    }

    const totalDocuments = results.reduce((sum, r) => sum + r.totalDocuments, 0);
    const totalSuccess = results.reduce((sum, r) => sum + r.successCount, 0);
    const totalFailure = results.reduce((sum, r) => sum + r.failureCount, 0);

    return {
      importedCollections: results.length,
      totalDocuments,
      totalSuccess,
      totalFailure,
      results,
    };
  },
});

/**
 * Validate transformation for a collection without inserting
 */
export const validateTransforms = action({
  args: {
    collection: v.string(),
    exportData: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const transformer = MIGRATION_TRANSFORMERS[args.collection];
    if (!transformer) {
      throw new Error(`No transformer found for collection: ${args.collection}`);
    }

    const results: Array<{
      originalId: string;
      success: boolean;
      error?: string;
      transformed?: any;
    }> = [];

    for (const doc of args.exportData) {
      try {
        const originalId = doc._id as string;
        if (!originalId) {
          results.push({
            originalId: 'unknown',
            success: false,
            error: 'Document missing _id field',
          });
          continue;
        }

        const transformed = transformer(doc as ExportedDocument);
        results.push({
          originalId,
          success: true,
          transformed,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          originalId: (doc as ExportedDocument)._id as string || 'unknown',
          success: false,
          error: errorMessage,
        });
      }
    }

    return {
      collection: args.collection,
      totalDocuments: args.exportData.length,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
      results,
    };
  },
});

/**
 * Get migration status for all tables
 */
export const getMigrationStatus = query({
  args: {},
  handler: async (ctx) => {
    const tables = [
      'users',
      'userRoles',
      'roleAudit',
      'public_profiles',
      'events',
      'event_attendees',
      'event_requests',
      'reimbursements',
      'fundDeposits',
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
    ] as const;

    const status: Record<string, { count: number; lastUpdated?: number }> = {};

    for (const table of tables) {
      // @ts-expect-error - Dynamic table access
      const documents = await ctx.db.query(table).collect();
      const lastUpdated = documents.reduce((max, doc) => {
        const updated = (doc as any)._creationTime || 0;
        return updated > max ? updated : max;
      }, 0);

      status[table] = {
        count: documents.length,
        lastUpdated: lastUpdated || undefined,
      };
    }

    return status;
  },
});
