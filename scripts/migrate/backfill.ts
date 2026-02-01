#!/usr/bin/env -S bun run

/**
 * Backfill Utilities for Firebase to Convex Migration
 *
 * Phase 2 of Firebase to Convex Migration - Backfill & Repair
 *
 * Provides utilities for:
 * - Re-running data imports for specific collections
 * - Running integrity checks on migrated data
 * - Fixing orphaned or corrupted records
 * - Handling individual file migrations
 * - Incremental migrations for new/changed data
 * - Rolling back collection changes
 * - Comprehensive audit logging
 *
 * Usage:
 *   bun run scripts/migrate/backfill.ts backfill-collection --collection users
 *   bun run scripts/migrate/backfill.ts verify-data --collection events
 *   bun run scripts/migrate/backfill.ts repair-data --collection users
 *   bun run scripts/migrate/backfill.ts migrate-single-file --path avatars/user123.jpg
 *   bun run scripts/migrate/backfill.ts backfill-incremental
 *   bun run scripts/migrate/backfill.ts rollback-collection --collection users
 */

import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { ConvexHttpClient } from 'convex/browser';
import {
  ALL_COLLECTIONS,
  COLLECTION_SETTINGS,
  type CollectionImportSettings,
  isValidCollection,
} from './import-config';
import {
  DEFAULT_IMPORT_OPTIONS,
  type FileMigrationOptions,
  getFilenameFromPath,
} from './file-migration-config';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BackfillOptions {
  dryRun: boolean;
  verbose: boolean;
  collection: string;
  skipExisting: boolean;
  batchSize: number;
  continueOnError: boolean;
  userId?: string;
  timestamp?: number;
}

export interface VerifyOptions {
  dryRun: boolean;
  verbose: boolean;
  collection?: string;
  checkOrphans: boolean;
  checkReferences: boolean;
  checkDuplicates: boolean;
  repair: boolean;
}

export interface RepairOptions {
  dryRun: boolean;
  verbose: boolean;
  collection: string;
  repairOrphans: boolean;
  repairReferences: boolean;
  repairTypes: boolean;
  removeDuplicates: boolean;
  batchSize: number;
}

export interface IncrementalBackfillOptions {
  dryRun: boolean;
  verbose: boolean;
  lastSyncTimestamp?: number;
  collections: string[];
  syncFiles: boolean;
}

export interface RollbackOptions {
  dryRun: boolean;
  verbose: boolean;
  collection: string;
  backupId: string;
  force: boolean;
}

export interface AuditLogEntry {
  id: string;
  operation: string;
  collection?: string;
  timestamp: number;
  actor: string;
  status: 'success' | 'failed' | 'partial';
  affectedDocuments: number;
  duration: number;
  details?: Record<string, unknown>;
  error?: string;
}

export interface BackfillResult {
  operation: string;
  success: boolean;
  collection?: string;
  documentsProcessed: number;
  documentsSucceeded: number;
  documentsFailed: number;
  documentsSkipped: number;
  duration: number;
  auditId: string;
  errors: string[];
}

export interface VerifyResult {
  collection: string;
  totalDocuments: number;
  orphanedRecords: number;
  brokenReferences: number;
  duplicateRecords: number;
  typeErrors: number;
  issuesFound: number;
  duration: number;
}

export interface RepairResult {
  collection: string;
  orphansRemoved: number;
  referencesFixed: number;
  typesRepaired: number;
  duplicatesRemoved: number;
  documentsProcessed: number;
  duration: number;
}

export interface FileMigrateResult {
  path: string;
  success: boolean;
  blobId?: string;
  error?: string;
  duration: number;
}

export interface IncrementalBackfillResult {
  collectionsProcessed: string[];
  documentsSynced: number;
  filesSynced: number;
  errors: string[];
  duration: number;
  lastSyncTimestamp: number;
}

export interface RollbackResult {
  collection: string;
  backupId: string;
  documentsRestored: number;
  documentsDeleted: number;
  success: boolean;
  duration: number;
  error?: string;
}

// ============================================================================
// AUDIT LOGGER
// ============================================================================

class AuditLogger {
  private auditLogPath: string;
  private verbose: boolean;

  constructor(auditLogPath: string, verbose: boolean) {
    this.auditLogPath = auditLogPath;
    this.verbose = verbose;
    this.ensureAuditLogDir();
  }

  private ensureAuditLogDir(): void {
    const dir = this.auditLogPath.substring(0, this.auditLogPath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Log a backfill operation
   */
  async log(operation: string, details: {
    collection?: string;
    status: 'success' | 'failed' | 'partial';
    affectedDocuments: number;
    duration: number;
    actor?: string;
    error?: string;
    [key: string]: unknown;
  }): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = {
      id: this.generateId(),
      operation,
      collection: details.collection,
      timestamp: Date.now(),
      actor: details.actor || process.env.USER || 'system',
      status: details.status,
      affectedDocuments: details.affectedDocuments,
      duration: details.duration,
      details,
      error: details.error,
    };

    // Save to audit log file
    this.appendAuditEntry(entry);

    if (this.verbose) {
      console.log(`[AUDIT] ${entry.operation} ${entry.status}/${entry.id}`);
    }

    return entry;
  }

  /**
   * Get audit history
   */
  async getHistory(collection?: string, limit = 100): Promise<AuditLogEntry[]> {
    const logs = this.loadAuditLogs();
    let filtered = logs;

    if (collection) {
      filtered = logs.filter(log => log.collection === collection);
    }

    return filtered
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get last successful operation
   */
  async getLastSuccessfulOperation(operation: string, collection?: string): Promise<AuditLogEntry | null> {
    const logs = await this.getHistory(collection);
    return logs.find(log => log.operation === operation && log.status === 'success') || null;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private appendAuditEntry(entry: AuditLogEntry): void {
    const logs = this.loadAuditLogs();
    logs.push(entry);
    writeFileSync(this.auditLogPath, JSON.stringify(logs, null, 2), 'utf-8');
  }

  private loadAuditLogs(): AuditLogEntry[] {
    if (!existsSync(this.auditLogPath)) {
      return [];
    }
    try {
      const content = readFileSync(this.auditLogPath, 'utf-8');
      return JSON.parse(content) as AuditLogEntry[];
    } catch {
      return [];
    }
  }
}

// ============================================================================
// BACKFILL CLIENT
// ============================================================================

class BackfillClient {
  private client: ConvexHttpClient;
  private auditLogger: AuditLogger;
  private verbose: boolean;
  private dryRun: boolean;

  constructor(convexUrl: string, auditLogger: AuditLogger, verbose: boolean, dryRun: boolean) {
    this.client = new ConvexHttpClient(convexUrl);
    this.auditLogger = auditLogger;
    this.verbose = verbose;
    this.dryRun = dryRun;
  }

  /**
   * Backfill a collection - re-run import for specific documents
   */
  async backfillCollection(options: BackfillOptions): Promise<BackfillResult> {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Backfill Collection: ${options.collection}`);
    console.log(`${'='.repeat(60)}`);

    const result: BackfillResult = {
      operation: 'backfillCollection',
      success: true,
      collection: options.collection,
      documentsProcessed: 0,
      documentsSucceeded: 0,
      documentsFailed: 0,
      documentsSkipped: 0,
      duration: 0,
      auditId: '',
      errors: [],
    };

    try {
      if (!isValidCollection(options.collection)) {
        throw new Error(`Invalid collection: ${options.collection}`);
      }

      const settings = COLLECTION_SETTINGS[options.collection];
      if (!settings) {
        throw new Error(`No settings found for collection: ${options.collection}`);
      }

      // Get documents from Convex
      const existingDocsResult = await this.client.action('backfill:getBackfillCandidates', {
        table: options.collection,
        lastUpdatedAfter: options.timestamp,
        batchSize: options.batchSize,
      });

      const documents = existingDocsResult?.documents || [];
      result.documentsProcessed = documents.length;

      if (documents.length === 0) {
        console.log('No documents to backfill');
        return result;
      }

      console.log(`Found ${documents.length} documents to backfill`);

      // Upsert documents
      const batchSize = options.batchSize || settings.batchSize;
      const batches = this.createBatches(documents, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} documents)`);

        try {
          if (!this.dryRun) {
            const batchResult = await this.client.action('backfill:upsertDocuments', {
              table: options.collection,
              documents: batch,
              options: {
                skipExisting: options.skipExisting,
                continueOnError: options.continueOnError,
              },
            });

            result.documentsSucceeded += batchResult.successCount || 0;
            result.documentsFailed += batchResult.failureCount || 0;
            result.documentsSkipped += batchResult.skippedCount || 0;

            if (batchResult.errors && batchResult.errors.length > 0) {
              result.errors.push(...batchResult.errors);
            }
          } else {
            console.log(`[DRY RUN] Would upsert ${batch.length} documents`);
            result.documentsSucceeded += batch.length;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(errorMessage);
          result.documentsFailed += batch.length;

          if (!options.continueOnError) {
            throw new Error(`Batch ${i + 1} failed: ${errorMessage}`);
          }
        }
      }

      result.duration = Date.now() - startTime;

      // Log audit entry
      const auditEntry = await this.auditLogger.log('backfillCollection', {
        collection: options.collection,
        status: result.documentsFailed === 0 ? 'success' : 'partial',
        affectedDocuments: result.documentsSucceeded,
        duration: result.duration,
        dryRun: this.dryRun,
      });
      result.auditId = auditEntry.id;

      return result;
    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : String(error);

      // Log failed audit entry
      const auditEntry = await this.auditLogger.log('backfillCollection', {
        collection: options.collection,
        status: 'failed',
        affectedDocuments: 0,
        duration: result.duration,
        error: result.error,
      });
      result.auditId = auditEntry.id;

      throw error;
    }
  }

  /**
   * Verify data integrity
   */
  async verifyData(options: VerifyOptions): Promise<VerifyResult[]> {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log('Verify Data Integrity');
    console.log(`${'='.repeat(60)}`);

    const collections = options.collection
      ? [options.collection]
      : Array.from(ALL_COLLECTIONS);

    const results: VerifyResult[] = [];

    for (const collection of collections) {
      try {
        console.log(`\nVerifying: ${collection}`);

        const verifyResult = await this.client.action('backfill:verifyCollection', {
          table: collection,
          checkOrphans: options.checkOrphans,
          checkReferences: options.checkReferences,
          checkDuplicates: options.checkDuplicates,
        });

        const result: VerifyResult = {
          collection,
          totalDocuments: verifyResult.totalDocuments || 0,
          orphanedRecords: verifyResult.orphanedRecords || 0,
          brokenReferences: verifyResult.brokenReferences || 0,
          duplicateRecords: verifyResult.duplicateRecords || 0,
          typeErrors: verifyResult.typeErrors || 0,
          issuesFound: (verifyResult.orphanedRecords || 0) +
                      (verifyResult.brokenReferences || 0) +
                      (verifyResult.duplicateRecords || 0) +
                      (verifyResult.typeErrors || 0),
          duration: verifyResult.duration || 0,
        };

        results.push(result);

        console.log(`  Total: ${result.totalDocuments}`);
        console.log(`  Orphans: ${result.orphanedRecords}`);
        console.log(`  Broken References: ${result.brokenReferences}`);
        console.log(`  Duplicates: ${result.duplicateRecords}`);
        console.log(`  Type Errors: ${result.typeErrors}`);
        console.log(`  Issues found: ${result.issuesFound}`);

        // Auto-repair if requested
        if (options.repair && result.issuesFound > 0) {
          console.log('  Auto-repair enabled...');
          await this.repairData({
            dryRun: options.dryRun,
            verbose: options.verbose,
            collection,
            repairOrphans: options.checkOrphans && result.orphanedRecords > 0,
            repairReferences: options.checkReferences && result.brokenReferences > 0,
            repairTypes: false,
            removeDuplicates: options.checkDuplicates && result.duplicateRecords > 0,
            batchSize: 50,
          });
        }

        const auditEntry = await this.auditLogger.log('verifyData', {
          collection,
          status: result.issuesFound === 0 ? 'success' : 'partial',
          affectedDocuments: result.totalDocuments,
          duration: result.duration,
          dryRun: options.dryRun,
        });

        if (this.verbose) {
          console.log(`  Audit ID: ${auditEntry.id}`);
        }
      } catch (error) {
        console.error(`  Error verifying ${collection}: ${error}`);
        results.push({
          collection,
          totalDocuments: 0,
          orphanedRecords: 0,
          brokenReferences: 0,
          duplicateRecords: 0,
          typeErrors: 0,
          issuesFound: -1,
          duration: 0,
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`\nVerification complete in ${totalDuration}ms`);
    console.log(`Total issues found: ${results.reduce((sum, r) => sum + Math.max(0, r.issuesFound), 0)}`);

    await this.auditLogger.log('verifyData', {
      status: 'success',
      affectedDocuments: results.reduce((sum, r) => sum + r.totalDocuments, 0),
      duration: totalDuration,
      dryRun: options.dryRun,
    });

    return results;
  }

  /**
   * Repair data issues
   */
  async repairData(options: RepairOptions): Promise<RepairResult> {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Repair Data: ${options.collection}`);
    console.log(`${'='.repeat(60)}`);

    const result: RepairResult = {
      collection: options.collection,
      orphansRemoved: 0,
      referencesFixed: 0,
      typesRepaired: 0,
      duplicatesRemoved: 0,
      documentsProcessed: 0,
      duration: 0,
    };

    try {
      if (!isValidCollection(options.collection)) {
        throw new Error(`Invalid collection: ${options.collection}`);
      }

      const operations: string[] = [];
      if (options.repairOrphans) operations.push('deleteOrphanedRecords');
      if (options.repairReferences) operations.push('repairReferences');
      if (options.repairTypes) operations.push('repairTypes');
      if (options.removeDuplicates) operations.push('removeDuplicates');

      if (operations.length === 0) {
        console.log('No repair operations enabled');
        return result;
      }

      console.log(`Operations: ${operations.join(', ')}`);

      if (options.removeDuplicates) {
        console.log('Removing duplicates...');
        const dupResult = await this.client.action('backfill:removeDuplicates', {
          table: options.collection,
          dryRun: this.dryRun,
        });
        result.duplicatesRemoved = dupResult.removed || 0;
        result.documentsProcessed += dupResult.scanned || 0;
        console.log(`  Removed ${result.duplicatesRemoved} duplicates`);
      }

      if (options.repairOrphans) {
        console.log('Removing orphaned records...');
        const orphanResult = await this.client.action('backfill:deleteOrphanedRecords', {
          table: options.collection,
          dryRun: this.dryRun,
        });
        result.orphansRemoved = orphanResult.removed || 0;
        result.documentsProcessed += orphanResult.scanned || 0;
        console.log(`  Removed ${result.orphansRemoved} orphaned records`);
      }

      if (options.repairReferences) {
        console.log('Repairing broken references...');
        const refResult = await this.client.action('backfill:repairReferences', {
          table: options.collection,
          dryRun: this.dryRun,
        });
        result.referencesFixed = refResult.fixed || 0;
        result.documentsProcessed += refResult.scanned || 0;
        console.log(`  Fixed ${result.referencesFixed} references`);
      }

      if (options.repairTypes) {
        console.log('Repairing data types...');
        const typeResult = await this.client.action('backfill:repairTypes', {
          table: options.collection,
          dryRun: this.dryRun,
        });
        result.typesRepaired = typeResult.repaired || 0;
        result.documentsProcessed += typeResult.scanned || 0;
        console.log(`  Repaired ${result.typesRepaired} type errors`);
      }

      result.duration = Date.now() - startTime;

      const auditEntry = await this.auditLogger.log('repairData', {
        collection: options.collection,
        status: 'success',
        affectedDocuments: result.documentsProcessed,
        duration: result.duration,
        details: {
          orphansRemoved: result.orphansRemoved,
          referencesFixed: result.referencesFixed,
          typesRepaired: result.typesRepaired,
          duplicatesRemoved: result.duplicatesRemoved,
        },
        dryRun: this.dryRun,
      });

      console.log(`\nRepair complete in ${result.duration}ms (${auditEntry.id})`);

      return result;
    } catch (error) {
      result.duration = Date.now() - startTime;

      await this.auditLogger.log('repairData', {
        collection: options.collection,
        status: 'failed',
        affectedDocuments: result.documentsProcessed,
        duration: result.duration,
        error: error instanceof Error ? error.message : String(error),
        dryRun: this.dryRun,
      });

      throw error;
    }
  }

  /**
   * Migrate a single file
   */
  async migrateSingleFile(firebasePath: string): Promise<FileMigrateResult> {
    const startTime = Date.now();
    console.log(`\nMigrating single file: ${firebasePath}`);

    const result: FileMigrateResult = {
      path: firebasePath,
      success: false,
      duration: 0,
    };

    try {
      // Call file migration action for single file
      if (!this.dryRun) {
        const migrationResult = await this.client.action('fileMigration:migrateSingleFile', {
          path: firebasePath,
        });

        result.success = migrationResult.success;
        result.blobId = migrationResult.blobId;
        result.error = migrationResult.error;
      } else {
        console.log('[DRY RUN] Would migrate file');
        result.success = true;
      }

      result.duration = Date.now() - startTime;

      // Log audit entry
      await this.auditLogger.log('migrateSingleFile', {
        status: result.success ? 'success' : 'failed',
        affectedDocuments: result.success ? 1 : 0,
        duration: result.duration,
        details: { path: firebasePath, blobId: result.blobId },
        error: result.error,
        dryRun: this.dryRun,
      });

      if (result.success) {
        console.log(`Migration complete: ${result.blobId}`);
      } else {
        console.error(`Migration failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : String(error);

      await this.auditLogger.log('migrateSingleFile', {
        status: 'failed',
        affectedDocuments: 0,
        duration: result.duration,
        details: { path: firebasePath },
        error: result.error,
        dryRun: this.dryRun,
      });

      throw error;
    }
  }

  /**
   * Incremental backfill - sync new documents from Firebase
   */
  async backfillIncremental(options: IncrementalBackfillOptions): Promise<IncrementalBackfillResult> {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log('Incremental Backfill');
    console.log(`${'='.repeat(60)}`);

    const result: IncrementalBackfillResult = {
      collectionsProcessed: [],
      documentsSynced: 0,
      filesSynced: 0,
      errors: [],
      duration: 0,
      lastSyncTimestamp: 0,
    };

    try {
      // Get last sync timestamp from audit log or use provided
      let lastSync = options.lastSyncTimestamp;
      if (!lastSync) {
        const lastOp = await this.auditLogger.getLastSuccessfulOperation('backfillIncremental');
        if (lastOp?.details) {
          lastSync = (lastOp.details as { lastSyncTimestamp?: number }).lastSyncTimestamp;
          console.log(`Resuming from last sync: ${new Date(lastSync!).toISOString()}`);
        }
      }

      if (!lastSync) {
        console.log('No last sync timestamp found. Starting from beginning.');
        lastSync = 0;
      }

      const currentTimestamp = Date.now();

      // Sync files first if enabled
      if (options.syncFiles) {
        console.log('Syncing new files...');
        const fileResult = await this.client.action('fileMigration:syncIncrementalFiles', {
          since: lastSync,
          dryRun: this.dryRun,
        });
        result.filesSynced = fileResult.synced || 0;
        console.log(`  Synced ${result.filesSynced} files`);
      }

      // Sync collections
      const collections = options.collections.length > 0
        ? options.collections
        : Array.from(ALL_COLLECTIONS);

      for (const collection of collections) {
        try {
          console.log(`\nSyncing: ${collection}`);

          const syncResult = await this.client.action('backfill:syncIncremental', {
            table: collection,
            since: lastSync,
            dryRun: this.dryRun,
          });

          const synced = syncResult.synced || 0;
          result.documentsSynced += synced;
          result.collectionsProcessed.push(collection);

          console.log(`  Synced ${synced} documents`);

          if (syncResult.errors && syncResult.errors.length > 0) {
            result.errors.push(...syncResult.errors);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`${collection}: ${errorMessage}`);
          console.error(`  Error syncing ${collection}: ${errorMessage}`);
        }
      }

      result.duration = Date.now() - startTime;
      result.lastSyncTimestamp = currentTimestamp;

      // Log audit entry
      await this.auditLogger.log('backfillIncremental', {
        status: result.errors.length === 0 ? 'success' : 'partial',
        affectedDocuments: result.documentsSynced + result.filesSynced,
        duration: result.duration,
        details: {
          collectionsProcessed: result.collectionsProcessed,
          documentsSynced: result.documentsSynced,
          filesSynced: result.filesSynced,
          lastSyncTimestamp: result.lastSyncTimestamp,
        },
        dryRun: this.dryRun,
      });

      console.log(`\nIncremental backfill complete in ${result.duration}ms`);
      console.log(`Synced ${result.documentsSynced} documents and ${result.filesSynced} files`);

      return result;
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.lastSyncTimestamp = Date.now();

      await this.auditLogger.log('backfillIncremental', {
        status: 'failed',
        affectedDocuments: result.documentsSynced + result.filesSynced,
        duration: result.duration,
        error: error instanceof Error ? error.message : String(error),
        details: {
          collectionsProcessed: result.collectionsProcessed,
          documentsSynced: result.documentsSynced,
          filesSynced: result.filesSynced,
          lastSyncTimestamp: result.lastSyncTimestamp,
        },
        dryRun: this.dryRun,
      });

      throw error;
    }
  }

  /**
   * Rollback a collection to a backup
   */
  async rollbackCollection(options: RollbackOptions): Promise<RollbackResult> {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log('Rollback Collection');
    console.log(`${'='.repeat(60)}`);

    const result: RollbackResult = {
      collection: options.collection,
      backupId: options.backupId,
      documentsRestored: 0,
      documentsDeleted: 0,
      success: false,
      duration: 0,
    };

    try {
      console.log(`Restoring ${options.collection} from backup: ${options.backupId}`);

      if (!this.dryRun) {
        const rollbackResult = await this.client.action('backfill:rollbackCollection', {
          table: options.collection,
          backupId: options.backupId,
          force: options.force,
        });

        result.documentsRestored = rollbackResult.restored || 0;
        result.documentsDeleted = rollbackResult.deleted || 0;
        result.success = rollbackResult.success;
        result.error = rollbackResult.error;
      } else {
        console.log('[DRY RUN] Would rollback collection');
        result.success = true;
      }

      result.duration = Date.now() - startTime;

      // Log audit entry
      await this.auditLogger.log('rollbackCollection', {
        collection: options.collection,
        status: result.success ? 'success' : 'failed',
        affectedDocuments: result.documentsRestored + result.documentsDeleted,
        duration: result.duration,
        details: {
          backupId: options.backupId,
          documentsRestored: result.documentsRestored,
          documentsDeleted: result.documentsDeleted,
        },
        error: result.error,
        dryRun: this.dryRun,
      });

      if (result.success) {
        console.log(`Rollback complete: ${result.documentsRestored} documents restored, ${result.documentsDeleted} deleted`);
      } else {
        console.error(`Rollback failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : String(error);

      await this.auditLogger.log('rollbackCollection', {
        collection: options.collection,
        status: 'failed',
        affectedDocuments: 0,
        duration: result.duration,
        error: result.error,
        details: { backupId: options.backupId },
        dryRun: this.dryRun,
      });

      throw error;
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

function parseArgs(args: string[]): {
  command: string;
  dryRun: boolean;
  verbose: boolean;
  help: boolean;
  options: Record<string, unknown>;
} {
  const result = {
    command: '',
    dryRun: args.includes('--dry-run') || args.includes('-n'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    help: args.includes('--help') || args.includes('-h'),
    options: {} as Record<string, unknown>,
  };

  let currentOption: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex > 0) {
        const key = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        result.options[key] = value;
        currentOption = null;
      } else {
        currentOption = arg.slice(2);
      }
    } else if (currentOption && !arg.startsWith('-')) {
      result.options[currentOption] = arg;
      currentOption = null;
    } else if (!arg.startsWith('-') && !result.command) {
      result.command = arg;
    }
  }

  return result;
}

function showHelp(): void {
  console.log(`
Backfill Utilities - Firebase to Convex Migration

USAGE:
  bun run scripts/migrate/backfill.ts <command> [OPTIONS]

COMMANDS:
  backfill-collection      Re-run data imports for a specific collection
  verify-data              Run integrity checks on migrated data
  repair-data              Fix orphaned or corrupted records
  migrate-single-file      Handle individual file migrations
  backfill-incremental     Migrate new/changed data post-launch
  rollback-collection      Rollback changes to a collection
  audit-history            Show audit log history

GLOBAL OPTIONS:
  --dry-run, -n            Run without making changes
  --verbose, -v            Enable verbose logging
  --help, -h               Show this help message

BACKFILL-COLLECTION OPTIONS:
  --collection, -c         Collection to backfill (required)
  --skip-existing          Skip documents that already exist
  --batch-size             Batch size for processing (default: 50)
  --continue-on-error      Continue on individual document errors
  --timestamp              Only backfill documents after this timestamp
  --user-id                Only backfill documents for specific user

VERIFY-DATA OPTIONS:
  --collection, -c         Specific collection to verify (default: all)
  --check-orphans          Check for orphaned records
  --check-references       Check for broken references
  --check-duplicates       Check for duplicate records
  --repair                 Auto-repair issues found

REPAIR-DATA OPTIONS:
  --collection, -c         Collection to repair (required)
  --repair-orphans         Remove orphaned records
  --repair-references      Fix broken references
  --repair-types           Repair data type errors
  --remove-duplicates      Remove duplicate records
  --batch-size             Batch size for processing (default: 50)

MIGRATE-SINGLE-FILE OPTIONS:
  --path, -p               File path to migrate (required)

BACKFILL-INCREMENTAL OPTIONS:
  --collections            Comma-separated list of collections (default: all)
  --sync-files             Enable file syncing
  --timestamp              Last sync timestamp (resumes from audit if not provided)

ROLLBACK-COLLECTION OPTIONS:
  --collection, -c         Collection to rollback (required)
  --backup-id              Backup ID to restore (required)
  --force                  Force rollback even if validation fails

AUDIT-HISTORY OPTIONS:
  --collection, -c         Filter by collection
  --limit                  Max number of entries to show (default: 50)

EXAMPLES:
  # Backfill a collection
  bun run scripts/migrate/backfill.ts backfill-collection --collection users

  # Verify all data and auto-repair
  bun run scripts/migrate/backfill.ts verify-data --check-orphans --repair

  # Repair orphaned records in events
  bun run scripts/migrate/backfill.ts repair-data --collection events --repair-orphans

  # Migrate a single file
  bun run scripts/migrate/backfill.ts migrate-single-file --path avatars/user123.jpg

  # Incremental sync with file syncing
  bun run scripts/migrate/backfill.ts backfill-incremental --sync-files

  # Rollback a collection
  bun run scripts/migrate/backfill.ts rollback-collection --collection users --backup-id backup-20240131

  # Show audit history
  bun run scripts/migrate/backfill.ts audit-history --collection users
`);
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

async function handleBackfillCollection(client: BackfillClient, options: Record<string, unknown>): Promise<void> {
  const collection = (options.collection || options.c) as string;
  if (!collection) {
    throw new Error('--collection is required for backfill-collection');
  }

  const result = await client.backfillCollection({
    dryRun: false, // Already handled at global level
    verbose: false,
    collection,
    skipExisting: options['skip-existing'] === 'true' || options['skip-existing'] === true,
    batchSize: parseInt((options['batch-size'] as string) || '50', 10),
    continueOnError: options['continue-on-error'] === 'true' || options['continue-on-error'] === true,
    userId: options['user-id'] as string,
    timestamp: options['timestamp'] ? parseInt(options['timestamp'] as string, 10) : undefined,
  });

  console.log(`\n${result.success ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} Backfill complete`);
  console.log(`  Processed: ${result.documentsProcessed}`);
  console.log(`  Succeeded: ${result.documentsSucceeded}`);
  console.log(`  Failed: ${result.documentsFailed}`);
  console.log(`  Skipped: ${result.documentsSkipped}`);
  console.log(`  Duration: ${result.duration}ms`);
  console.log(`  Audit ID: ${result.auditId}`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.slice(0, 5).forEach(err => console.log(`  - ${err}`));
    if (result.errors.length > 5) {
      console.log(`  ... and ${result.errors.length - 5} more`);
    }
  }
}

async function handleVerifyData(client: BackfillClient, options: Record<string, unknown>): Promise<void> {
  const results = await client.verifyData({
    dryRun: false,
    verbose: false,
    collection: (options.collection || options.c) as string,
    checkOrphans: options['check-orphans'] === 'true' || options['check-orphans'] === true,
    checkReferences: options['check-references'] === 'true' || options['check-references'] === true,
    checkDuplicates: options['check-duplicates'] === 'true' || options['check-duplicates'] === true,
    repair: options.repair === 'true' || options.repair === true,
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log('Verification Summary');
  console.log(`${'='.repeat(60)}`);

  for (const result of results) {
    const status = result.issuesFound === 0
      ? '\x1b[32m✓ PASS\x1b[0m'
      : result.issuesFound > 0 ? '\x1b[33m⚠ WARNING\x1b[0m' : '\x1b[31m✗ ERROR\x1b[0m';
    console.log(`\n${status} ${result.collection}`);
    console.log(`  Total documents: ${result.totalDocuments}`);
    console.log(`  Orphans: ${result.orphanedRecords}`);
    console.log(`  Broken references: ${result.brokenReferences}`);
    console.log(`  Duplicates: ${result.duplicateRecords}`);
    console.log(`  Type errors: ${result.typeErrors}`);
    console.log(`  Issues found: ${result.issuesFound}`);
  }

  const totalIssues = results.reduce((sum, r) => sum + Math.max(0, r.issuesFound), 0);
  const exitCode = totalIssues > 0 ? 1 : 0;
  process.exit(exitCode);
}

async function handleRepairData(client: BackfillClient, options: Record<string, unknown>): Promise<void> {
  const collection = (options.collection || options.c) as string;
  if (!collection) {
    throw new Error('--collection is required for repair-data');
  }

  const result = await client.repairData({
    dryRun: false,
    verbose: false,
    collection,
    repairOrphans: options['repair-orphans'] === 'true' || options['repair-orphans'] === true,
    repairReferences: options['repair-references'] === 'true' || options['repair-references'] === true,
    repairTypes: options['repair-types'] === 'true' || options['repair-types'] === true,
    removeDuplicates: options['remove-duplicates'] === 'true' || options['remove-duplicates'] === true,
    batchSize: parseInt((options['batch-size'] as string) || '50', 10),
  });

  console.log(`\n\x1b[32m✓\x1b[0m Repair complete`);
  console.log(`  Orphans removed: ${result.orphansRemoved}`);
  console.log(`  References fixed: ${result.referencesFixed}`);
  console.log(`  Types repaired: ${result.typesRepaired}`);
  console.log(`  Duplicates removed: ${result.duplicatesRemoved}`);
  console.log(`  Documents processed: ${result.documentsProcessed}`);
  console.log(`  Duration: ${result.duration}ms`);
}

async function handleMigrateSingleFile(client: BackfillClient, options: Record<string, unknown>): Promise<void> {
  const path = (options.path || options.p) as string;
  if (!path) {
    throw new Error('--path is required for migrate-single-file');
  }

  const result = await client.migrateSingleFile(path);

  if (result.success) {
    console.log(`\n\x1b[32m✓\x1b[0m File migrated successfully`);
    console.log(`  Blob ID: ${result.blobId}`);
    console.log(`  Duration: ${result.duration}ms`);
    process.exit(0);
  } else {
    console.error(`\n\x1b[31m✗\x1b[0m File migration failed`);
    console.error(`  Error: ${result.error}`);
    process.exit(1);
  }
}

async function handleBackfillIncremental(client: BackfillClient, options: Record<string, unknown>): Promise<void> {
  const collectionsStr = (options.collections as string) || '';
  const collections = collectionsStr
    ? collectionsStr.split(',').map(c => c.trim())
    : Array.from(ALL_COLLECTIONS);

  const result = await client.backfillIncremental({
    dryRun: false,
    verbose: false,
    lastSyncTimestamp: options.timestamp ? parseInt(options.timestamp as string, 10) : undefined,
    collections,
    syncFiles: options['sync-files'] === 'true' || options['sync-files'] === true,
  });

  console.log(`\n\x1b[32m✓\x1b[0m Incremental backfill complete`);
  console.log(`  Collections processed: ${result.collectionsProcessed.length}`);
  console.log(`  Documents synced: ${result.documentsSynced}`);
  console.log(`  Files synced: ${result.filesSynced}`);
  console.log(`  Duration: ${result.duration}ms`);
  console.log(`  Last sync timestamp: ${new Date(result.lastSyncTimestamp).toISOString()}`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.slice(0, 5).forEach(err => console.log(`  - ${err}`));
    if (result.errors.length > 5) {
      console.log(`  ... and ${result.errors.length - 5} more`);
    }
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

async function handleRollbackCollection(client: BackfillClient, options: Record<string, unknown>): Promise<void> {
  const collection = (options.collection || options.c) as string;
  const backupId = (options['backup-id'] as string);

  if (!collection) {
    throw new Error('--collection is required for rollback-collection');
  }
  if (!backupId) {
    throw new Error('--backup-id is required for rollback-collection');
  }

  const result = await client.rollbackCollection({
    dryRun: false,
    verbose: false,
    collection,
    backupId,
    force: options.force === 'true' || options.force === true,
  });

  if (result.success) {
    console.log(`\n\x1b[32m✓\x1b[0m Rollback complete`);
    console.log(`  Documents restored: ${result.documentsRestored}`);
    console.log(`  Documents deleted: ${result.documentsDeleted}`);
    console.log(`  Duration: ${result.duration}ms`);
    process.exit(0);
  } else {
    console.error(`\n\x1b[31m✗\x1b[0m Rollback failed`);
    console.error(`  Error: ${result.error}`);
    process.exit(1);
  }
}

async function handleAuditHistory(auditLogger: AuditLogger, options: Record<string, unknown>): Promise<void> {
  const limit = parseInt((options.limit as string) || '50', 10);
  const history = await auditLogger.getHistory((options.collection || options.c) as string, limit);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Audit History ${options.collection ? `(${options.collection})` : ''}`);
  console.log(`${'='.repeat(60)}\n`);

  if (history.length === 0) {
    console.log('No audit history found');
    return;
  }

  for (const entry of history) {
    const statusColor = entry.status === 'success' ? '\x1b[32m' :
                       entry.status === 'failed' ? '\x1b[31m' : '\x1b[33m';
    const reset = '\x1b[0m';

    console.log(`${statusColor}${entry.status}${reset} [ ${new Date(entry.timestamp).toISOString()} ]`);
    console.log(`  Operation: ${entry.operation}`);
    if (entry.collection) console.log(`  Collection: ${entry.collection}`);
    console.log(`  Actor: ${entry.actor}`);
    console.log(`  Affected: ${entry.affectedDocuments} document(s)`);
    console.log(`  Duration: ${entry.duration}ms`);
    if (entry.error) console.log(`  Error: ${entry.error}`);
    console.log(`  ID: ${entry.id}`);
    console.log();
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.command) {
    showHelp();
    process.exit(0);
  }

  // Validate Convex URL
  const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error('Error: VITE_CONVEX_URL or CONVEX_URL environment variable is required');
    process.exit(1);
  }

  // Initialize audit logger
  const auditLogPath = join(__dirname, 'audit', 'backfill-audit.json');
  const auditLogger = new AuditLogger(auditLogPath, args.verbose);

  // Initialize backfill client
  const client = new BackfillClient(convexUrl, auditLogger, args.verbose, args.dryRun);

  try {
    switch (args.command) {
      case 'backfill-collection':
        await handleBackfillCollection(client, args.options);
        break;
      case 'verify-data':
        await handleVerifyData(client, args.options);
        break;
      case 'repair-data':
        await handleRepairData(client, args.options);
        break;
      case 'migrate-single-file':
        await handleMigrateSingleFile(client, args.options);
        break;
      case 'backfill-incremental':
        await handleBackfillIncremental(client, args.options);
        break;
      case 'rollback-collection':
        await handleRollbackCollection(client, args.options);
        break;
      case 'audit-history':
        await handleAuditHistory(auditLogger, args.options);
        break;
      default:
        console.error(`Unknown command: ${args.command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (args.verbose && error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the script
main();
