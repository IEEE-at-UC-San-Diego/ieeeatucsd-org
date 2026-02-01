/**
 * Convex Migration Actions
 *
 * Server-side actions for importing migrated data into Convex.
 * These actions are used by the import script to insert documents
 * into Convex in batches.
 */

import { v } from 'convex/values';
import { mutation, action } from './_generated/server';
import type { Id } from './_generated/dataModel';
import {
  ALL_COLLECTIONS,
  SUBCOLLECTIONS,
  type ExportedDocument,
  type ExportedCollection,
} from './firebase-export';
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

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Firebase export collection name to Convex table name mapping
 */
const COLLECTION_MAP: Record<string, string> = {
  users: 'users',
  events: 'events',
  'events/attendees': 'event_attendees',
  event_requests: 'event_requests',
  reimbursements: 'reimbursements',
  fundDeposits: 'fundDeposits',
  public_profiles: 'public_profiles',
  officerInvitations: 'officerInvitations',
  directOnboardings: 'directOnboardings',
  invites: 'invites',
  sponsorDomains: 'sponsorDomains',
  links: 'links',
  constitutions: 'constitutions',
  'constitutions/sections': 'constitution_sections',
  'constitutions/auditLog': 'constitution_audit_log',
  notifications: 'notifications',
  googleGroupAssignments: 'googleGroupAssignments',
  organizationSettings: 'organizationSettings',
};

/**
 * Transformer function mapping for each collection
 */
const TRANSFORMERS: Record<string, (doc: ExportedDocument, ctx?: any) => any> = {
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
 * Transform a single Firebase document to Convex format
 */
export const transformDocument = action({
  args: {
    collection: v.string(),
    document: v.any(),
  },
  handler: async (ctx, args) => {
    const transformer = TRANSFORMERS[args.collection];
    if (!transformer) {
      throw new Error(`No transformer found for collection: ${args.collection}`);
    }

    return transformer(args.document as ExportedDocument, ctx);
  },
});

/**
 * Import a single collection to Convex
 */
export const importCollection = action({
  args: {
    exportData: v.any(),
    options: v.object({
      onExisting: v.optional(v.union(v.literal('skip'), v.literal('update'), v.literal('error'))),
      dryRun: v.optional(v.boolean()),
      continueOnError: v.optional(v.boolean()),
      batchSize: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const {
      collection,
      documents,
    } = args.exportData as ExportedCollection;

    const table = COLLECTION_MAP[collection];
    if (!table) {
      throw new Error(`No table mapping for collection: ${collection}`);
    }

    const transformer = TRANSFORMERS[collection];
    if (!transformer) {
      throw new Error(`No transformer found for collection: ${collection}`);
    }

    const options = {
      onExisting: args.options.onExisting ?? 'skip',
      dryRun: args.options.dryRun ?? false,
      continueOnError: args.options.continueOnError ?? true,
      batchSize: args.options.batchSize ?? 100,
    };

    const results: Array<{
      originalId: string;
      convexId?: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const doc of documents) {
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
        const transformed = transformer(doc, ctx);

        // Remove _id from transformed data for insertion
        const { _id, ...cleanDoc } = transformed as Record<string, unknown>;

        if (options.dryRun) {
          results.push({
            originalId,
            success: true,
            error: undefined,
          });
          continue;
        }

        // Check if document exists (skip mode)
        let shouldInsert = true;
        let existingId: Id<any> | undefined;

        if (options.onExisting === 'skip' || options.onExisting === 'update') {
          if (table === 'users' && cleanDoc.logtoSub) {
            const existing = await ctx.runQuery(async (queryCtx) => {
              return queryCtx.db
                .query('users')
                .withIndex('byLogtoSub', (q) => q.eq('logtoSub', cleanDoc.logtoSub as string))
                .first();
            });
            if (existing) {
              shouldInsert = false;
              existingId = existing._id;
            }
          } else if (table === 'sponsorDomains' && cleanDoc.domain) {
            const existing = await ctx.runQuery(async (queryCtx) => {
              return queryCtx.db
                .query('sponsorDomains')
                .withIndex('byDomain', (q) => q.eq('domain', cleanDoc.domain as string))
                .first();
            });
            if (existing) {
              shouldInsert = false;
              existingId = existing._id;
            }
          } else if (table === 'organizationSettings' && cleanDoc.key) {
            const existing = await ctx.runQuery(async (queryCtx) => {
              return queryCtx.db
                .query('organizationSettings')
                .withIndex('byKey', (q) => q.eq('key', cleanDoc.key as string))
                .first();
            });
            if (existing) {
              shouldInsert = false;
              existingId = existing._id;
            }
          }
        }

        if (options.onExisting === 'update' && existingId) {
          // Update existing document
          await ctx.runMutation(async (mutationCtx) => {
            await mutationCtx.db.patch(existingId, cleanDoc);
          });
          results.push({
            originalId,
            convexId: existingId,
            success: true,
          });
          continue;
        }

        if (shouldInsert) {
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
        } else {
          // Skip existing document
          results.push({
            originalId,
            success: true,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          originalId: doc._id as string || 'unknown',
          success: false,
          error: errorMessage,
        });

        if (!options.continueOnError) {
          break;
        }
      }
    }

    return {
      table,
      collection,
      totalDocuments: documents.length,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
      results,
    };
  },
});

/**
 * Import all 15 collections to Convex
 */
export const importAllCollections = action({
  args: {
    exportCollections: v.array(v.any()),
    options: v.object({
      onExisting: v.optional(v.union(v.literal('skip'), v.literal('update'), v.literal('error'))),
      dryRun: v.optional(v.boolean()),
      continueOnError: v.optional(v.boolean()),
      batchSize: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const results: Array<{
      collection: string;
      table: string;
      totalDocuments: number;
      successCount: number;
      failureCount: number;
      documents: Array<{
        originalId: string;
        convexId?: string;
        success: boolean;
        error?: string;
      }>;
    }> = [];

    for (const exportData of args.exportCollections) {
      const result = await ctx.runAction(importCollection, {
        exportData,
        options: args.options,
      });
      results.push(result);

      if (!args.options.continueOnError) {
        const hasFailures = result.results.some((r) => !r.success);
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
 * Batch insert all exported collections in one call
 */
export const batchImportAll = action({
  args: {
    exportData: v.object({
      collections: v.array(v.any()),
      summary: v.any(),
    }),
    options: v.object({
      onExisting: v.optional(v.union(v.literal('skip'), v.literal('update'), v.literal('error'))),
      dryRun: v.optional(v.boolean()),
      continueOnError: v.optional(v.boolean()),
      batchSize: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    return ctx.runAction(importAllCollections, {
      exportCollections: args.exportData.collections,
      options: args.options,
    });
  },
});

// ============================================================================
// GENERIC BATCH INSERT (existing)
// ============================================================================

/**
 * Generic batch insert mutation for any table
 * This action creates documents one at a time with generated IDs
 */
export const batchInsert = action({
  args: {
    table: v.string(),
    documents: v.array(v.any()),
    options: v.object({
      onExisting: v.optional(v.union(v.literal('skip'), v.literal('update'), v.literal('error'))),
      dryRun: v.optional(v.boolean()),
      continueOnError: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const results: Array<{
      originalId: string;
      convexId?: string;
      success: boolean;
      error?: string;
    }> = [];

    // Type-safe table name mapping
    const validTables = [
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

    type ValidTable = (typeof validTables)[number];

    if (!validTables.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;
    const dryRun = args.options.dryRun ?? false;
    const continueOnError = args.options.continueOnError ?? true;
    const onExisting = args.options.onExisting ?? 'skip';

    for (const doc of args.documents) {
      try {
        const originalId = doc._id as string;

        if (!originalId) {
          results.push({
            originalId: 'unknown',
            success: false,
            error: 'Document missing _id field',
          });
          if (!continueOnError) break;
          continue;
        }

        // Create a clean document without _id
        const { _id, ...cleanDoc } = doc as Record<string, unknown>;

        if (dryRun) {
          // In dry run mode, just validate and return success
          results.push({
            originalId,
            success: true,
            error: undefined,
          });
          continue;
        }

        // Check if document exists (for unique key tables)
        let shouldInsert = true;

        if (onExisting === 'skip') {
          // For tables with unique keys, check existence
          if (table === 'users' && cleanDoc.logtoSub) {
            const existing = await ctx.runQuery(async (queryCtx) => {
              return queryCtx.db
                .query('users')
                .withIndex('byLogtoSub', (q) => q.eq('logtoSub', cleanDoc.logtoSub as string))
                .first();
            });
            if (existing) shouldInsert = false;
          } else if (table === 'sponsorDomains' && cleanDoc.domain) {
            const existing = await ctx.runQuery(async (queryCtx) => {
              return queryCtx.db
                .query('sponsorDomains')
                .withIndex('byDomain', (q) => q.eq('domain', cleanDoc.domain as string))
                .first();
            });
            if (existing) shouldInsert = false;
          } else if (table === 'organizationSettings' && cleanDoc.key) {
            const existing = await ctx.runQuery(async (queryCtx) => {
              return queryCtx.db
                .query('organizationSettings')
                .withIndex('byKey', (q) => q.eq('key', cleanDoc.key as string))
                .first();
            });
            if (existing) {
              // Update existing settings
              await ctx.runMutation(async (mutationCtx) => {
                await mutationCtx.db.patch(existing._id, cleanDoc);
              });
              results.push({
                originalId,
                convexId: existing._id,
                success: true,
              });
              continue;
            }
          }
        }

        if (shouldInsert) {
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
        } else {
          results.push({
            originalId,
            success: true,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({
          originalId: doc._id as string || 'unknown',
          success: false,
          error: errorMessage,
        });

        if (!continueOnError) {
          break;
        }
      }
    }

    return results;
  },
});

// ============================================================================
// SPECIALIZED BATCH INSERTS (existing)
// ============================================================================

/**
 * Insert users in batch using the users table schema
 */
export const batchInsertUsers = action({
  args: {
    documents: v.array(
      v.object({
        _id: v.string(),
        logtoSub: v.string(),
        email: v.string(),
        name: v.optional(v.string()),
        avatarUrl: v.optional(v.string()),
        createdAt: v.number(),
        updatedAt: v.number(),
        emailVisibility: v.optional(v.boolean()),
        verified: v.optional(v.boolean()),
        username: v.optional(v.string()),
        pid: v.optional(v.string()),
        memberId: v.optional(v.string()),
        graduationYear: v.optional(v.number()),
        major: v.optional(v.string()),
        zelleInformation: v.optional(v.string()),
        lastLogin: v.optional(v.number()),
        notificationPreferences: v.optional(v.any()),
        displayPreferences: v.optional(v.any()),
        accessibilitySettings: v.optional(v.any()),
        navigationLayout: v.optional(v.union(v.literal('horizontal'), v.literal('sidebar'))),
        resume: v.optional(v.string()),
        signedUp: v.optional(v.boolean()),
        requestedEmail: v.optional(v.boolean()),
        position: v.optional(v.string()),
        status: v.optional(v.union(v.literal('active'), v.literal('inactive'), v.literal('suspended'))),
        joinDate: v.optional(v.number()),
        eventsAttended: v.optional(v.number()),
        points: v.optional(v.number()),
        team: v.optional(v.union(v.literal('Internal'), v.literal('Events'), v.literal('Projects'))),
        invitedBy: v.optional(v.string()),
        inviteAccepted: v.optional(v.number()),
        lastUpdated: v.optional(v.number()),
        lastUpdatedBy: v.optional(v.string()),
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
        ieeeEmailCreatedAt: v.optional(v.number()),
        sponsorTier: v.optional(
          v.union(v.literal('Bronze'), v.literal('Silver'), v.literal('Gold'), v.literal('Platinum'), v.literal('Diamond'))
        ),
        sponsorOrganization: v.optional(v.string()),
        autoAssignedSponsor: v.optional(v.boolean()),
      })
    ),
    options: v.object({
      onExisting: v.optional(v.union(v.literal('skip'), v.literal('update'), v.literal('error'))),
      dryRun: v.optional(v.boolean()),
      continueOnError: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    return ctx.runAction(batchInsert, {
      table: 'users',
      documents: args.documents,
      options: args.options,
    });
  },
});

/**
 * Insert events in batch
 */
export const batchInsertEvents = action({
  args: {
    documents: v.array(
      v.object({
        _id: v.optional(v.string()),
        eventName: v.string(),
        eventDescription: v.string(),
        eventCode: v.string(),
        location: v.string(),
        files: v.array(v.string()),
        pointsToReward: v.number(),
        startDate: v.number(),
        endDate: v.number(),
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
        createdFrom: v.optional(v.string()),
        createdAt: v.number(),
        createdBy: v.optional(v.string()),
      })
    ),
    options: v.object({
      onExisting: v.optional(v.union(v.literal('skip'), v.literal('update'), v.literal('error'))),
      dryRun: v.optional(v.boolean()),
      continueOnError: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    return ctx.runAction(batchInsert, {
      table: 'events',
      documents: args.documents,
      options: args.options,
    });
  },
});

/**
 * Insert public profiles in batch
 */
export const batchInsertPublicProfiles = action({
  args: {
    documents: v.array(
      v.object({
        _id: v.optional(v.string()),
        userId: v.string(),
        name: v.string(),
        major: v.string(),
        points: v.number(),
        totalEventsAttended: v.number(),
        createdAt: v.number(),
        updatedAt: v.number(),
      })
    ),
    options: v.object({
      onExisting: v.optional(v.union(v.literal('skip'), v.literal('update'), v.literal('error'))),
      dryRun: v.optional(v.boolean()),
      continueOnError: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    return ctx.runAction(batchInsert, {
      table: 'public_profiles',
      documents: args.documents,
      options: args.options,
    });
  },
});

/**
 * Insert organization settings in batch
 */
export const batchInsertOrganizationSettings = action({
  args: {
    documents: v.array(
      v.object({
        _id: v.optional(v.string()),
        key: v.string(),
        value: v.any(),
        description: v.optional(v.string()),
        category: v.optional(v.string()),
        isPublic: v.optional(v.boolean()),
        createdAt: v.number(),
        lastModified: v.number(),
        lastModifiedBy: v.optional(v.string()),
      })
    ),
    options: v.object({
      onExisting: v.optional(v.union(v.literal('skip'), v.literal('update'), v.literal('error'))),
      dryRun: v.optional(v.boolean()),
      continueOnError: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    return ctx.runAction(batchInsert, {
      table: 'organizationSettings',
      documents: args.documents,
      options: args.options,
    });
  },
});

/**
 * Clear all data from a table (for testing/migration reset)
 */
export const clearTable = mutation({
  args: {
    table: v.string(),
  },
  handler: async (ctx, args) => {
    const validTables = [
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

    type ValidTable = (typeof validTables)[number];

    if (!validTables.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;

    // Get all documents in the table
    // @ts-expect-error - Dynamic table access
    const documents = await ctx.db.query(table).collect();

    // Delete all documents
    for (const doc of documents) {
      await ctx.db.delete(doc._id);
    }

    return { deleted: documents.length };
  },
});

/**
 * Get count of documents in a table
 */
export const getTableCount = mutation({
  args: {
    table: v.string(),
  },
  handler: async (ctx, args) => {
    const validTables = [
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

    type ValidTable = (typeof validTables)[number];

    if (!validTables.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;

    // @ts-expect-error - Dynamic table access
    const documents = await ctx.db.query(table).collect();

    return { count: documents.length };
  },
});

/**
 * Get document counts for all tables
 */
export const getAllTableCounts = mutation({
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

    const counts: Record<string, number> = {};

    for (const table of tables) {
      // @ts-expect-error - Dynamic table access
      const documents = await ctx.db.query(table).collect();
      counts[table] = documents.length;
    }

    return counts;
  },
});
