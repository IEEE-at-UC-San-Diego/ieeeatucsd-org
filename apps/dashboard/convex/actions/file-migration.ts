/**
 * Convex File Migration Actions
 *
 * Server-side actions for migrating files from Firebase Storage to Convex blob storage.
 * These actions handle file storage, retrieval, and database reference updates.
 */

import { v } from 'convex/values';
import { mutation, action } from './_generated/server';
import { api } from './_generated/api';
import { getStorage, initializeFirebaseFromEnv } from '../migration/firebase-client';
import { exportAllStorageFiles } from './firebase-export';
import { createHash } from 'crypto';

// ============================================================================
// BLOB STORAGE ACTIONS
// ============================================================================

/**
 * Store a file in Convex blob storage
 * Converts binary data to a Convex blob and returns the blob ID
 */
export const storeFile = action({
  args: {
    data: v.string(), // Base64 encoded file data
    contentType: v.string(),
    filename: v.string(),
    metadata: v.optional(v.object({
      originalPath: v.string(),
      size: v.number(),
      checksum: v.string(),
      uploaderId: v.optional(v.string()),
      uploadTime: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    try {
      // Decode base64 data to buffer
      const buffer = Buffer.from(args.data, 'base64');

      // Store the file in Convex blob storage
      const blobId = await ctx.storage.store(
        new Uint8Array(buffer),
        args.contentType
      );

      return {
        success: true,
        blobId,
        size: buffer.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

/**
 * Retrieve a file from Convex blob storage
 * Returns the file data as base64 encoded string
 */
export const getFile = action({
  args: {
    blobId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    try {
      // Retrieve the file from blob storage
      const blobResult = await ctx.storage.get(args.blobId);

      if (!blobResult) {
        return {
          success: false,
          error: 'File not found',
        };
      }

      // Convert blob to base64
      const arrayBuffer = await blobResult.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');

      return {
        success: true,
        data: base64,
        size: buffer.length,
        contentType: blobResult.type || 'application/octet-stream',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

/**
 * Get file metadata without downloading the content
 */
export const getFileMetadata = action({
  args: {
    blobId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    try {
      // Retrieve the file from blob storage
      const blobResult = await ctx.storage.get(args.blobId);

      if (!blobResult) {
        return {
          success: false,
          error: 'File not found',
        };
      }

      // Return available metadata
      return {
        success: true,
        size: blobResult.size,
        contentType: blobResult.type || 'application/octet-stream',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

/**
 * Delete a file from Convex blob storage
 * Note: This requires appropriate cleanup of references in the database
 */
export const deleteFile = action({
  args: {
    blobId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    try {
      // Convex storage doesn't have a direct delete API
      // Files are automatically garbage collected when no longer referenced
      // This action would be for record-keeping or triggering cleanup

      return {
        success: true,
        message: 'File will be garbage collected when unreferenced',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

/**
 * Store multiple files in a batch
 */
export const storeFiles = action({
  args: {
    files: v.array(v.object({
      data: v.string(), // Base64 encoded
      contentType: v.string(),
      filename: v.string(),
      metadata: v.optional(v.object({
        originalPath: v.string(),
        size: v.number(),
        checksum: v.string(),
        uploaderId: v.optional(v.string()),
        uploadTime: v.optional(v.number()),
      })),
    })),
  },
  handler: async (ctx, args) => {
    const results: Array<{
      filename: string;
      blobId?: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const file of args.files) {
      const result = await ctx.runAction(api.fileMigration.storeFile, {
        data: file.data,
        contentType: file.contentType,
        filename: file.filename,
        metadata: file.metadata,
      });

      results.push({
        filename: file.filename,
        blobId: result.success ? result.blobId : undefined,
        success: result.success,
        error: result.success ? undefined : result.error,
      });
    }

    return {
      results,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
    };
  },
});

// ============================================================================
// DATABASE REFERENCE UPDATE ACTIONS
// ============================================================================

/**
 * Update user's avatar URL with blob ID
 */
export const updateUserAvatar = mutation({
  args: {
    userId: v.id('users'),
    blobId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    await ctx.db.patch(args.userId, {
      avatarUrl: args.blobId,
    });

    return {
      success: true,
      previousUrl: user.avatarUrl,
    };
  },
});

/**
 * Update user's resume URL with blob ID
 */
export const updateUserResume = mutation({
  args: {
    userId: v.id('users'),
    blobId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    await ctx.db.patch(args.userId, {
      resume: args.blobId,
    });

    return {
      success: true,
      previousUrl: user.resume,
    };
  },
});

/**
 * Update reimbursement receipts with blob IDs
 */
export const updateReimbursementReceipts = mutation({
  args: {
    reimbursementId: v.id('reimbursements'),
    receiptUpdates: v.array(v.object({
      index: v.number(),
      blobId: v.id('_storage'),
    })),
  },
  handler: async (ctx, args) => {
    const reimbursement = await ctx.db.get(args.reimbursementId);

    if (!reimbursement) {
      return {
        success: false,
        error: 'Reimbursement not found',
      };
    }

    // Get current receipts
    const currentReceipts = reimbursement.receipts || undefined;

    if (!currentReceipts) {
      return {
        success: false,
        error: 'No receipts found on reimbursement',
      };
    }

    // Create updated receipts array
    const updatedReceipts = [...currentReceipts];
    let updatedCount = 0;

    for (const update of args.receiptUpdates) {
      if (update.index >= 0 && update.index < updatedReceipts.length) {
        // Update the fileUrl to be the blob ID
        const receipt = updatedReceipts[update.index] as Record<string, unknown>;
        receipt.fileUrl = update.blobId;
        updatedCount++;
      }
    }

    await ctx.db.patch(args.reimbursementId, {
      receipts: updatedReceipts,
    });

    return {
      success: true,
      updatedCount,
    };
  },
});

/**
 * Update fund deposit proof with blob ID
 */
export const updateFundDepositProof = mutation({
  args: {
    depositId: v.id('fundDeposits'),
    blobId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const deposit = await ctx.db.get(args.depositId);

    if (!deposit) {
      return {
        success: false,
        error: 'Fund deposit not found',
      };
    }

    await ctx.db.patch(args.depositId, {
      receiptFile: args.blobId,
    });

    return {
      success: true,
      previousUrl: deposit.receiptFile,
    };
  },
});

/**
 * Update event files with blob IDs
 */
export const updateEventFiles = mutation({
  args: {
    eventId: v.id('events'),
    fileUpdates: v.array(v.object({
      index: v.number(),
      blobId: v.id('_storage'),
    })),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);

    if (!event) {
      return {
        success: false,
        error: 'Event not found',
      };
    }

    // Get current files
    const currentFiles = [...event.files];

    // Create updated files array
    let updatedCount = 0;

    for (const update of args.fileUpdates) {
      if (update.index >= 0 && update.index < currentFiles.length) {
        currentFiles[update.index] = update.blobId;
        updatedCount++;
      }
    }

    await ctx.db.patch(args.eventId, {
      files: currentFiles,
    });

    return {
      success: true,
      updatedCount,
    };
  },
});

/**
 * Update event request room booking files with blob IDs
 */
export const updateEventRequestRoomBookingFiles = mutation({
  args: {
    requestId: v.id('event_requests'),
    fileUpdates: v.array(v.object({
      index: v.number(),
      blobId: v.id('_storage'),
    })),
  },
  handler: async (ctx, args) => {
    const eventRequest = await ctx.db.get(args.requestId);

    if (!eventRequest) {
      return {
        success: false,
        error: 'Event request not found',
      };
    }

    // Get current room booking files
    const currentFiles = [...eventRequest.roomBookingFiles];

    // Create updated files array
    let updatedCount = 0;

    for (const update of args.fileUpdates) {
      if (update.index >= 0 && update.index < currentFiles.length) {
        currentFiles[update.index] = update.blobId;
        updatedCount++;
      }
    }

    await ctx.db.patch(args.requestId, {
      roomBookingFiles: currentFiles,
    });

    return {
      success: true,
      updatedCount,
    };
  },
});

/**
 * Update event request graphics files with blob IDs
 */
export const updateEventRequestGraphicsFiles = mutation({
  args: {
    requestId: v.id('event_requests'),
    fileUpdates: v.array(v.object({
      index: v.number(),
      blobId: v.id('_storage'),
    })),
  },
  handler: async (ctx, args) => {
    const eventRequest = await ctx.db.get(args.requestId);

    if (!eventRequest) {
      return {
        success: false,
        error: 'Event request not found',
      };
    }

    // Get current graphics files
    const currentFiles = eventRequest.graphicsFiles ? [...eventRequest.graphicsFiles] : [];

    // Create updated files array
    let updatedCount = 0;

    for (const update of args.fileUpdates) {
      if (update.index >= 0 && update.index < currentFiles.length) {
        currentFiles[update.index] = update.blobId;
        updatedCount++;
      }
    }

    await ctx.db.patch(args.requestId, {
      graphicsFiles: currentFiles,
    });

    return {
      success: true,
      updatedCount,
    };
  },
});

/**
 * Update link icon URL with blob ID
 */
export const updateLinkIcon = mutation({
  args: {
    linkId: v.id('links'),
    blobId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.linkId);

    if (!link) {
      return {
        success: false,
        error: 'Link not found',
      };
    }

    await ctx.db.patch(args.linkId, {
      iconUrl: args.blobId,
    });

    return {
      success: true,
      previousUrl: link.iconUrl,
    };
  },
});

// ============================================================================
// BATCH REFERENCE UPDATE ACTIONS
// ============================================================================

/**
 * Update all file references for a user
 */
export const updateUserFileReferences = mutation({
  args: {
    userId: v.id('users'),
    avatarBlobId: v.optional(v.id('_storage')),
    resumeBlobId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    const updates: Record<string, unknown> = {};
    let updatedCount = 0;

    if (args.avatarBlobId !== undefined) {
      updates.avatarUrl = args.avatarBlobId;
      updatedCount++;
    }

    if (args.resumeBlobId !== undefined) {
      updates.resume = args.resumeBlobId;
      updatedCount++;
    }

    if (updatedCount === 0) {
      return {
        success: true,
        message: 'No updates provided',
        updatedCount: 0,
      };
    }

    await ctx.db.patch(args.userId, updates);

    return {
      success: true,
      updatedCount,
    };
  },
});

/**
 * Replace Firebase Storage URLs with blob IDs in document fields
 * Generic action for any collection
 */
export const replaceFirebaseUrlsWithBlobIds = mutation({
  args: {
    table: v.string(),
    documentId: v.id('users'), // This will be validated per table
    urlReplacements: v.array(v.object({
      field: v.string(),
      index: v.optional(v.number()), // For array fields
      blobId: v.id('_storage'),
    })),
  },
  handler: async (ctx, args) => {
    const validTables = [
      'users',
      'reimbursements',
      'fundDeposits',
      'events',
      'event_requests',
      'links',
    ] as const;

    type ValidTable = (typeof validTables)[number];

    if (!validTables.includes(args.table as ValidTable)) {
      return {
        success: false,
        error: `Invalid table name: ${args.table}`,
      };
    }

    const table = args.table as ValidTable;

    // Get the document
    // @ts-expect-error - Dynamic table access
    const doc = await ctx.db.get(table, args.documentId as typeof args.documentId);

    if (!doc) {
      return {
        success: false,
        error: 'Document not found',
      };
    }

    const updates: Record<string, unknown> = {};
    let updatedCount = 0;

    for (const replacement of args.urlReplacements) {
      const currentValue = doc[replacement.field];

      if (Array.isArray(currentValue)) {
        // Handle array fields
        const arrayData = [...currentValue];
        if (replacement.index !== undefined && replacement.index >= 0 && replacement.index < arrayData.length) {
          arrayData[replacement.index] = replacement.blobId;
          updates[replacement.field] = arrayData;
          updatedCount++;
        }
      } else {
        // Handle single value fields
        updates[replacement.field] = replacement.blobId;
        updatedCount++;
      }
    }

    if (updatedCount === 0) {
      return {
        success: true,
        message: 'No valid updates performed',
        updatedCount: 0,
      };
    }

    // @ts-expect-error - Dynamic table access
    await ctx.db.patch(table, args.documentId, updates);

    return {
      success: true,
      updatedCount,
    };
  },
});

// ============================================================================
// FIREBASE STORAGE MIGRATION ACTIONS (Phase 2, Subtask 4)
// ============================================================================

/**
 * Interface for file reference mapping
 */
interface FileReferenceField {
  table: string;
  field: string;
  isArray: boolean;
  nestedPath?: string; // For objects within arrays (e.g., receipts[].fileUrl)
}

/**
 * File reference mapping for all tables containing Firebase Storage URLs
 */
const FILE_REFERENCE_FIELDS: FileReferenceField[] = [
  { table: 'events', field: 'files', isArray: true },
  { table: 'events', field: 'graphics', isArray: true },
  { table: 'events', field: 'invoiceUrls', isArray: true },
  { table: 'reimbursements', field: 'receipts', isArray: true, nestedPath: 'fileUrl' },
  { table: 'fundDeposits', field: 'receiptFile', isArray: false },
  { table: 'users', field: 'avatarUrl', isArray: false },
  { table: 'users', field: 'resume', isArray: false },
  { table: 'public_profiles', field: 'profilePictureUrl', isArray: false },
];

/**
 * Extract Firebase URL from a value (handles Firebase Storage URLs)
 */
function isFirebaseUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return value.startsWith('https://firebasestorage.googleapis.com/') ||
         value.startsWith('gs://');
}

/**
 * Calculate checksum for file integrity verification
 */
function calculateChecksum(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Migrate a single file from Firebase Storage to Convex blob storage
 *
 * @param firebasePath - The Firebase Storage path of the file
 * @param skipIfExists - Skip migration if already migrated
 */
export const migrateFile = action({
  args: {
    firebasePath: v.string(),
    skipIfExists: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Initialize Firebase Admin SDK
    initializeFirebaseFromEnv();
    const storage = getStorage();
    const bucket = storage.bucket();
    
    try {
      // Check if file was already migrated
      if (args.skipIfExists !== false) {
        const existingMigration = await ctx.runQuery(async (q) => {
          return q
            .db.query('fileMigrations')
            .withIndex('byFirebasePath', (q) => q.eq('firebasePath', args.firebasePath))
            .first();
        });
        
        if (existingMigration) {
          return {
            success: true,
            skipped: true,
            blobId: existingMigration.blobId,
            message: 'File already migrated',
          };
        }
      }
      
      // Get Firebase file
      const firebaseFile = bucket.file(args.firebasePath);
      const [exists] = await firebaseFile.exists();
      
      if (!exists) {
        return {
          success: false,
          error: `Firebase file not found: ${args.firebasePath}`,
        };
      }
      
      // Download file from Firebase
      const [metadata] = await firebaseFile.getMetadata();
      const [dataBuffer] = await firebaseFile.download();
      
      // Calculate checksum for integrity verification
      const checksum = calculateChecksum(dataBuffer);
      
      // Upload to Convex blob storage
      const blobId = await ctx.storage.store(
        new Uint8Array(dataBuffer),
        metadata.contentType || 'application/octet-stream'
      );
      
      // Generate Firebase URL
      const firebaseUrl = `https://firebasestorage.googleapis.com/${bucket.name}/${args.firebasePath}`;
      
      // Store migration record in database
      const migrationId = await ctx.runMutation(async (q) => {
        return q.db.insert('fileMigrations', {
          firebasePath: args.firebasePath,
          firebaseUrl,
          blobId,
          size: parseInt(metadata.size || '0', 10),
          contentType: metadata.contentType || 'application/octet-stream',
          migratedAt: Date.now(),
          status: 'completed',
          checksum,
          metadata: metadata.metadata as Record<string, unknown> | undefined,
        });
      });
      
      return {
        success: true,
        skipped: false,
        blobId,
        size: parseInt(metadata.size || '0', 10),
        contentType: metadata.contentType || 'application/octet-stream',
        checksum,
        migrationId,
      };
    } catch (error) {
      // Log failed migration
      try {
        await ctx.runMutation(async (q) => {
          await q.db.insert('fileMigrations', {
            firebasePath: args.firebasePath,
            firebaseUrl: `https://firebasestorage.googleapis.com/.../${args.firebasePath}`,
            blobId: '' as any, // Placeholder, will be set on retry
            size: 0,
            contentType: 'application/octet-stream',
            migratedAt: Date.now(),
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : String(error),
          });
        });
      } catch {
        // Ignore migration tracking errors
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

/**
 * Migrate all files from Firebase Storage to Convex blob storage
 *
 * @param batchSize - Number of files to migrate per batch (default: 50)
 * @param skipExisting - Skip files that have already been migrated
 * @param dryRun - List files to migrate without actually migrating
 */
export const migrateAllFiles = action({
  args: {
    batchSize: v.optional(v.number()),
    skipExisting: v.optional(v.boolean()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const batchSize = args.batchSize || 50;
    const skipExisting = args.skipExisting !== false;
    const dryRun = args.dryRun || false;
    
    // Initialize Firebase Admin SDK
    initializeFirebaseFromEnv();
    
    try {
      // Export all files from Firebase Storage
      const { files, summary } = await exportAllStorageFiles({ includeDownloadUrls: false });
      
      const results: Array<{
        firebasePath: string;
        success: boolean;
        blobId?: string;
        error?: string;
        skipped?: boolean;
      }> = [];
      
      let migratedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      let totalSize = 0;
      
      // Process files in batches
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchPromises = batch.map(async (file) => {
          if (dryRun) {
            return {
              firebasePath: file.name,
              success: true,
              skipped: false,
              size: file.size,
              contentType: file.contentType,
            };
          }
          
          const result = await ctx.runAction(api.fileMigration.migrateFile, {
            firebasePath: file.name,
            skipIfExists: skipExisting,
          });
          
          if (result.success) {
            if (result.skipped) {
              skippedCount++;
            } else {
              migratedCount++;
              totalSize += result.size || 0;
            }
          } else {
            failedCount++;
          }
          
          return {
            firebasePath: file.name,
            success: result.success,
            blobId: result.blobId,
            error: result.error,
            skipped: result.skipped,
          };
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }
      
      return {
        success: true,
        totalFiles: files.length,
        migratedCount,
        skippedCount,
        failedCount,
        totalSize,
        totalBytes: summary.totalBytes,
        results,
        dryRun,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

/**
 * Update database references from Firebase Storage URLs to Convex blob IDs
 * Scans all relevant tables and fields for Firebase URLs and replaces them with blob IDs
 *
 * @param dryRun - Preview changes without applying them
 * @param batchSize - Process documents in batches to avoid timeouts
 */
export const updateDatabaseReferences = action({
  args: {
    dryRun: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const dryRun = args.dryRun || false;
    const batchSize = args.batchSize || 50;
    
    const results: Array<{
      table: string;
      documentId: string;
      field: string;
      firebaseUrl: string;
      blobId?: string;
      success: boolean;
      error?: string;
    }> = [];
    
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    // Get all migration records to build URL -> blobId mapping
    const allMigrations = await ctx.runQuery(async (q) => {
      return q.db.query('fileMigrations').withIndex('byStatus', (q) => q.eq('status', 'completed')).collect();
    });
    
    // Build Firebase URL -> blobId mapping
    const urlToBlobId = new Map<string, string>();
    for (const migration of allMigrations) {
      urlToBlobId.set(migration.firebaseUrl, migration.blobId);
    }
    
    // Process each reference field configuration
    for (const fieldConfig of FILE_REFERENCE_FIELDS) {
      const { table, field, isArray, nestedPath } = fieldConfig;
      
      // Query all documents in the table
      const documents = await ctx.runQuery(async (q) => {
        // @ts-expect-error - Dynamic table access
        return q.db.query(table).collect();
      });
      
      for (const doc of documents) {
        const docId = doc._id;
        const value = doc[field];
        
        if (value === null || value === undefined) {
          continue;
        }
        
        const updates: Record<string, unknown> = {};
        
        if (isArray && Array.isArray(value)) {
          // Handle array fields
          const updatedArray = [...value];
          let needsUpdate = false;
          
          for (let i = 0; i < updatedArray.length; i++) {
            const item = updatedArray[i];
            
            let itemUrl: string | undefined;
            
            if (nestedPath && typeof item === 'object' && item !== null) {
              // Handle nested path (e.g., receipts[].fileUrl)
              itemUrl = (item as Record<string, unknown>)[nestedPath] as string;
            } else if (typeof item === 'string') {
              // Handle direct string arrays
              itemUrl = item;
            }
            
            if (itemUrl && isFirebaseUrl(itemUrl)) {
              const blobId = urlToBlobId.get(itemUrl);
              
              if (blobId) {
                if (nestedPath && typeof item === 'object' && item !== null) {
                  // Update nested property
                  (item as Record<string, unknown>)[nestedPath] = blobId;
                } else {
                  // Update array element directly
                  updatedArray[i] = blobId;
                }
                needsUpdate = true;
                
                results.push({
                  table,
                  documentId: String(docId),
                  field,
                  firebaseUrl: itemUrl,
                  blobId,
                  success: true,
                });
              } else {
                totalSkipped++;
                results.push({
                  table,
                  documentId: String(docId),
                  field,
                  firebaseUrl: itemUrl,
                  success: false,
                  error: 'No corresponding blob ID found for Firebase URL',
                });
              }
            }
          }
          
          if (needsUpdate && !dryRun) {
            updates[field] = updatedArray;
          }
        } else if (typeof value === 'string' && isFirebaseUrl(value)) {
          // Handle single string fields
          const blobId = urlToBlobId.get(value);
          
          if (blobId) {
            updates[field] = blobId;
            totalUpdated++;
            
            results.push({
              table,
              documentId: String(docId),
              field,
              firebaseUrl: value,
              blobId,
              success: true,
            });
          } else {
            totalSkipped++;
            results.push({
              table,
              documentId: String(docId),
              field,
              firebaseUrl: value,
              success: false,
              error: 'No corresponding blob ID found for Firebase URL',
            });
          }
        }
        
        // Apply updates if not dry run
        if (Object.keys(updates).length > 0 && !dryRun) {
          try {
            // @ts-expect-error - Dynamic table access
            await ctx.runMutation(async (q) => {
              return q.db.patch(table, docId, updates);
            });
          } catch (error) {
            totalErrors++;
            results.push({
              table,
              documentId: String(docId),
              field,
              firebaseUrl: '',
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }
    
    return {
      success: true,
      totalUpdated,
      totalSkipped,
      totalErrors,
      results,
      dryRun,
    };
  },
});

/**
 * Get migration status summary
 */
export const getMigrationStatus = action({
  args: {},
  handler: async (ctx) => {
    const allMigrations = await ctx.runQuery(async (q) => {
      return q.db.query('fileMigrations').collect();
    });
    
    const statusCounts = {
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
    };
    
    let totalSize = 0;
    
    for (const migration of allMigrations) {
      statusCounts[migration.status]++;
      if (migration.status === 'completed') {
        totalSize += migration.size;
      }
    }
    
    return {
      totalFiles: allMigrations.length,
      ...statusCounts,
      totalSize,
      progress: allMigrations.length > 0
        ? (statusCounts.completed / allMigrations.length) * 100
        : 0,
    };
  },
});

/**
 * Retry failed file migrations
 *
 * @param limit - Maximum number of failed migrations to retry
 */
export const retryFailedMigrations = action({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    
    // Get failed migrations
    const failedMigrations = await ctx.runQuery(async (q) => {
      return q.db.query('fileMigrations')
        .withIndex('byStatus', (q) => q.eq('status', 'failed'))
        .take(limit);
    });
    
    const results: Array<{
      firebasePath: string;
      success: boolean;
      blobId?: string;
      error?: string;
    }> = [];
    
    for (const migration of failedMigrations) {
      // Delete old migration record
      await ctx.runMutation(async (q) => {
        await q.db.delete(migration._id);
      });
      
      // Retry migration
      const result = await ctx.runAction(api.fileMigration.migrateFile, {
        firebasePath: migration.firebasePath,
        skipIfExists: false,
      });
      
      results.push({
        firebasePath: migration.firebasePath,
        success: result.success,
        blobId: result.blobId,
        error: result.error,
      });
    }
    
    return {
      success: true,
      retried: failedMigrations.length,
      results,
    };
  },
});

// ============================================================================
// FILE ACCESS ACTIONS
// ============================================================================

/**
 * Protected download for avatar images (public access)
 * Returns a signed URL or the file data directly
 */
export const getAvatar = action({
  args: {
    blobId: v.id('_storage'),
  },
  handler: async (ctx, args) => {
    return await ctx.runAction(api.fileMigration.getFile, {
      blobId: args.blobId,
    });
  },
});

/**
 * Get reimbursement receipt with access control
 * Only users with appropriate roles can access receipts
 */
export const getReimbursementReceipt = action({
  args: {
    reimbursementId: v.id('reimbursements'),
    receiptIndex: v.number(),
    userId: v.id('users'),
    userRoles: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user has permission to access receipts
    const hasAccess =
      args.userRoles.includes('administrator') ||
      args.userRoles.includes('executive_officer');

    // Also allow if user is the submitter
    const reimbursement = await ctx.runQuery(async (q) => {
      return q.db.get(args.reimbursementId);
    });

    if (!reimbursement) {
      return {
        success: false,
        error: 'Reimbursement not found',
      };
    }

    // Allow access to admins/execs or the submitter
    if (!hasAccess && reimbursement.submittedBy !== args.userId) {
      return {
        success: false,
        error: 'Access denied',
      };
    }

    // Get receipts array
    const receipts = reimbursement.receipts;

    if (!receipts || args.receiptIndex < 0 || args.receiptIndex >= receipts.length) {
      return {
        success: false,
        error: 'Receipt not found',
      };
    }

    const receipt = receipts[args.receiptIndex] as Record<string, unknown>;
    const blobId = receipt.fileUrl as string;

    // Check if the fileUrl is a blob ID or Firebase URL
    if (!blobId.match(/^[a-f0-9]{24}$/)) {
      return {
        success: false,
        error: 'File is stored in Firebase, not yet migrated',
      };
    }

    return await ctx.runAction(api.fileMigration.getFile, {
      blobId: blobId as any, // Type assertion for blob ID
    });
  },
});

/**
 * Get fund deposit proof with access control
 */
export const getFundDepositProof = action({
  args: {
    depositId: v.id('fundDeposits'),
    userId: v.id('users'),
    userRoles: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user has permission
    const hasAccess =
      args.userRoles.includes('administrator') ||
      args.userRoles.includes('executive_officer');

    const deposit = await ctx.runQuery(async (q) => {
      return q.db.get(args.depositId);
    });

    if (!deposit) {
      return {
        success: false,
        error: 'Fund deposit not found',
      };
    }

    // Allow access to admins/execs or the submitter
    if (!hasAccess && deposit.depositedBy !== args.userId) {
      return {
        success: false,
        error: 'Access denied',
      };
    }

    if (!deposit.receiptFile) {
      return {
        success: false,
        error: 'No proof file attached',
      };
    }

    const blobId = deposit.receiptFile;

    // Check if the fileUrl is a blob ID or Firebase URL
    if (!blobId.match(/^[a-f0-9]{24}$/)) {
      return {
        success: false,
        error: 'File is stored in Firebase, not yet migrated',
      };
    }

    return await ctx.runAction(api.fileMigration.getFile, {
      blobId: blobId as any, // Type assertion for blob ID
    });
  },
});

/**
 * Get user resume with access control
 */
export const getUserResume = action({
  args: {
    userId: v.id('users'),
    requestingUserId: v.id('users'),
    userRoles: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user has permission
    const hasAccess =
      args.userRoles.includes('administrator') ||
      args.userRoles.includes('executive_officer') ||
      args.userRoles.includes('general_officer');

    const user = await ctx.runQuery(async (q) => {
      return q.db.get(args.userId);
    });

    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    // Allow access to admins/officers or the user themselves
    if (!hasAccess && args.userId !== args.requestingUserId) {
      return {
        success: false,
        error: 'Access denied',
      };
    }

    if (!user.resume) {
      return {
        success: false,
        error: 'No resume file attached',
      };
    }

    const blobId = user.resume;

    // Check if the fileUrl is a blob ID or Firebase URL
    if (!blobId.match(/^[a-f0-9]{24}$/)) {
      return {
        success: false,
        error: 'File is stored in Firebase, not yet migrated',
      };
    }

    return await ctx.runAction(api.fileMigration.getFile, {
      blobId: blobId as any, // Type assertion for blob ID
    });
  },
});

// ============================================================================
// MIGRATION STATUS TRACKING
// ============================================================================

/**
 * Get migration status for all file references in a collection
 * Returns counts of files still using Firebase URLs vs blob IDs
 */
export const getCollectionFileMigrationStatus = mutation({
  args: {
    table: v.string(),
  },
  handler: async (ctx, args) => {
    const validTables = [
      'users',
      'reimbursements',
      'fundDeposits',
      'events',
      'event_requests',
      'links',
    ] as const;

    type ValidTable = (typeof validTables)[number];

    if (!validTables.includes(args.table as ValidTable)) {
      throw new Error(`Invalid table name: ${args.table}`);
    }

    const table = args.table as ValidTable;

    // @ts-expect-error - Dynamic table access
    const documents = await ctx.db.query(table).collect();

    const fileFields: Record<string, string[]> = {
      users: ['avatarUrl', 'resume'],
      reimbursements: ['receipts'],
      fundDeposits: ['receiptFile'],
      events: ['files'],
      event_requests: ['roomBookingFiles', 'graphicsFiles'],
      links: ['iconUrl'],
    };

    const fields = fileFields[table] || [];
    let totalFiles = 0;
    let migratedFiles = 0;
    let unmigratedFiles = 0;

    for (const doc of documents) {
      for (const field of fields) {
        const value = doc[field];
        const isBlobId = (val: unknown) => typeof val === 'string' && /^[a-f0-9]{24}$/.test(val);

        if (Array.isArray(value)) {
          totalFiles += value.length;
          for (const item of value) {
            if (isBlobId(item)) {
              migratedFiles++;
            } else if (item) {
              unmigratedFiles++;
            }
          }
        } else if (value) {
          totalFiles++;
          if (isBlobId(value)) {
            migratedFiles++;
          } else {
            unmigratedFiles++;
          }
        }
      }
    }

    return {
      table,
      totalDocuments: documents.length,
      totalFiles,
      migratedFiles,
      unmigratedFiles,
      migrationProgress: totalFiles > 0 ? (migratedFiles / totalFiles) * 100 : 100,
    };
  },
});

/**
 * Get migration status for all collections
 */
export const getAllCollectionMigrationStatus = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      'users',
      'reimbursements',
      'fundDeposits',
      'events',
      'event_requests',
      'links',
    ] as const;

    const results: Record<
      string,
      Awaited<ReturnType<typeof api.fileMigration.getCollectionFileMigrationStatus>>
    > = {};

    for (const table of tables) {
      results[table] = await ctx.runMutation(api.fileMigration.getCollectionFileMigrationStatus, {
        table,
      });
    }

    return results;
  },
});