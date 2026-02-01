#!/usr/bin/env -S bun run

/**
 * Backup and Restore Utilities for Convex Data
 *
 * Phase 2 of Firebase to Convex Migration - Backup & Restore
 *
 * Provides utilities for:
 * - Creating backups of Convex collections
 * - Restoring collections from backups
 * - Listing available backups
 * - Managing backup retention
 * - Validating backup integrity
 *
 * Usage:
 *   bun run scripts/migrate/backup.ts backup --collection users
 *   bun run scripts/migrate/backup.ts backup --all
 *   bun run scripts/migrate/backup.ts restore --collection users --backup-id backup-20240131-...
 *   bun run scripts/migrate/backup.ts list
 *   bun run scripts/migrate/backup.ts delete --backup-id backup-20240131-...
 *   bun run scripts/migrate/backup.ts validate --backup-id backup-20240131-...
 */

import { join, dirname } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { ConvexHttpClient } from 'convex/browser';
import { ALL_COLLECTIONS, isValidCollection } from './import-config';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BackupOptions {
  dryRun: boolean;
  verbose: boolean;
  collection?: string;
  allCollections: boolean;
  compress: boolean;
  includeMetadata: boolean;
  retentionDays: number;
}

export interface RestoreOptions {
  dryRun: boolean;
  verbose: boolean;
  collection: string;
  backupId: string;
  force: boolean;
  validateBeforeRestore: boolean;
}

export interface BackupMetadata {
  id: string;
  timestamp: number;
  createdAt: string;
  collections: string[];
  documentCounts: Record<string, number>;
  checksums: Record<string, string>;
  compressed: boolean;
  actor: string;
  version: string;
}

export interface RestoreResult {
  collection: string;
  backupId: string;
  documentsRestored: number;
  documentsSkipped: number;
  documentsFailed: number;
  duration: number;
  success: boolean;
  error?: string;
}

export interface BackupResult {
  backupId: string;
  collection?: string;
  filePath?: string;
  documentCount: number;
  duration: number;
  checksum: string;
  compressed: boolean;
  success: boolean;
  error?: string;
}

export interface BackupInfo {
  id: string;
  createdAt: string;
  collections: string[];
  totalDocuments: number;
  compressed: boolean;
  actor: string;
  size: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BACKUP_DIR = join(__dirname, 'backups');
const BACKUP_VERSION = '1.0.0';
const CHECKSUM_ALGORITHM = 'sha256';

// ============================================================================
// BACKUP MANAGER
// ============================================================================

class BackupManager {
  private client: ConvexHttpClient;
  private backupDir: string;
  private verbose: boolean;
  private dryRun: boolean;

  constructor(convexUrl: string, verbose: boolean, dryRun: boolean) {
    this.client = new ConvexHttpClient(convexUrl);
    this.backupDir = BACKUP_DIR;
    this.verbose = verbose;
    this.dryRun = dryRun;
    this.ensureBackupDir();
  }

  /**
   * Ensure backup directory exists
   */
  private ensureBackupDir(): void {
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
      if (this.verbose) {
        console.log(`Created backup directory: ${this.backupDir}`);
      }
    }
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(collection?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const collectionPart = collection ? `-${collection}` : '-all';
    return `backup${collectionPart}-${timestamp}`;
  }

  /**
   * Calculate checksum for data
   */
  private calculateChecksum(data: unknown): string {
    const str = JSON.stringify(data);
    return createHash(CHECKSUM_ALGORITHM).update(str).digest('hex');
  }

  /**
   * Get all documents from a collection
   */
  private async getCollectionDocuments(collection: string): Promise<unknown[]> {
    try {
      const result = await this.client.action('backup:exportCollection', {
        table: collection,
      });
      return (result as { documents: unknown[] }).documents || [];
    } catch (error) {
      throw new Error(`Failed to export collection ${collection}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save backup to file
   */
  private async saveBackup(backupId: string, data: {
    documents: Record<string, unknown[]>;
    metadata: BackupMetadata;
  }): Promise<string> {
    const json = JSON.stringify(data, null, 2);
    const filePath = join(this.backupDir, `${backupId}.json`);

    writeFileSync(filePath, json, 'utf-8');

    if (this.verbose) {
      const size = statSync(filePath).size;
      console.log(`Saved backup to: ${filePath} (${(size / 1024).toFixed(2)} KB)`);
    }

    return filePath;
  }

  /**
   * Load backup from file
   */
  private loadBackup(backupId: string): {
    documents: Record<string, unknown[]>;
    metadata: BackupMetadata;
  } | null {
    const filePath = join(this.backupDir, `${backupId}.json`);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as { documents: Record<string, unknown[]>; metadata: BackupMetadata };
    } catch (error) {
      throw new Error(`Failed to load backup ${backupId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Backup a single collection
   */
  async backupCollection(collection: string, options: Omit<BackupOptions, 'allCollections'>): Promise<BackupResult> {
    const startTime = Date.now();
    const backupId = this.generateBackupId(collection);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Backing up collection: ${collection}`);
    console.log(`Backup ID: ${backupId}`);
    console.log(`${'='.repeat(60)}`);

    const result: BackupResult = {
      backupId,
      collection,
      documentCount: 0,
      duration: 0,
      checksum: '',
      compressed: options.compress,
      success: false,
    };

    try {
      if (!isValidCollection(collection)) {
        throw new Error(`Invalid collection: ${collection}`);
      }

      // Get documents from Convex
      console.log('Fetching documents from Convex...');
      const documents = await this.getCollectionDocuments(collection);
      result.documentCount = documents.length;

      console.log(`Found ${documents.length} documents`);

      if (documents.length === 0) {
        console.log('No documents to backup');
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Calculate checksum
      const checksum = this.calculateChecksum(documents);
      result.checksum = checksum;

      // Prepare metadata
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        collections: [collection],
        documentCounts: { [collection]: documents.length },
        checksums: { [collection]: checksum },
        compressed: options.compress,
        actor: process.env.USER || 'system',
        version: BACKUP_VERSION,
      };

      // Save backup
      if (!this.dryRun) {
        const filePath = await this.saveBackup(backupId, { documents: { [collection]: documents }, metadata });
        result.filePath = filePath;

        // Also save metadata separately for easier listing
        await this.saveMetadata(backupId, metadata);
      } else {
        console.log(`[DRY RUN] Would save backup with ${documents.length} documents`);
      }

      result.duration = Date.now() - startTime;
      result.success = true;

      console.log(`Backup complete in ${result.duration}ms`);
      console.log(`Checksum: ${checksum}`);

      return result;
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Backup all collections
   */
  async backupAllCollections(options: BackupOptions): Promise<BackupResult[]> {
    const startTime = Date.now();
    const backupId = this.generateBackupId();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Backing up all collections`);
    console.log(`Backup ID: ${backupId}`);
    console.log(`${'='.repeat(60)}`);

    const results: BackupResult[] = [];

    try {
      const allDocuments: Record<string, unknown[]> = {};
      const documentCounts: Record<string, number> = {};
      const checksums: Record<string, string> = {};

      // Backup each collection
      for (const collection of Array.from(ALL_COLLECTIONS)) {
        console.log(`\n[${results.length + 1}/${ALL_COLLECTIONS.length}] Backing up: ${collection}`);

        try {
          const documents = await this.getCollectionDocuments(collection);
          allDocuments[collection] = documents;
          documentCounts[collection] = documents.length;
          checksums[collection] = this.calculateChecksum(documents);

          results.push({
            backupId,
            collection,
            documentCount: documents.length,
            duration: 0,
            checksum: checksums[collection],
            compressed: options.compress,
            success: true,
          });

          console.log(`  ✓ ${documents.length} documents`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`  ✗ Error: ${errorMessage}`);
          results.push({
            backupId,
            collection,
            documentCount: 0,
            duration: 0,
            checksum: '',
            compressed: options.compress,
            success: false,
            error: errorMessage,
          });
        }
      }

      // Save combined backup
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        collections: Object.keys(allDocuments),
        documentCounts,
        checksums,
        compressed: options.compress,
        actor: process.env.USER || 'system',
        version: BACKUP_VERSION,
      };

      if (!this.dryRun) {
        await this.saveBackup(backupId, { documents: allDocuments, metadata });
        await this.saveMetadata(backupId, metadata);
      } else {
        console.log(`\n[DRY RUN] Would save backup with metadata`);
      }

      const totalDocuments = Object.values(documentCounts).reduce((a, b) => a + b, 0);
      const duration = Date.now() - startTime;

      console.log(`\n${'='.repeat(60)}`);
      console.log(`Backup complete: ${backupId}`);
      console.log(`Total documents: ${totalDocuments}`);
      console.log(`Collections: ${results.filter(r => r.success).length}/${ALL_COLLECTIONS.length}`);
      console.log(`Duration: ${duration}ms`);

      results.forEach(r => r.duration = duration);

      return results;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Save backup metadata separately
   */
  private async saveMetadata(backupId: string, metadata: BackupMetadata): Promise<void> {
    const metadataPath = join(this.backupDir, `${backupId}.meta.json`);
    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  /**
   * Restore a collection from backup
   */
  async restoreCollection(options: RestoreOptions): Promise<RestoreResult> {
    const startTime = Date.now();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Restoring collection: ${options.collection}`);
    console.log(`From backup: ${options.backupId}`);
    console.log(`${'='.repeat(60)}`);

    const result: RestoreResult = {
      collection: options.collection,
      backupId: options.backupId,
      documentsRestored: 0,
      documentsSkipped: 0,
      documentsFailed: 0,
      duration: 0,
      success: false,
    };

    try {
      // Validate backup exists
      const backup = this.loadBackup(options.backupId);
      if (!backup) {
        throw new Error(`Backup not found: ${options.backupId}`);
      }

      // Validate operation
      if (options.validateBeforeRestore) {
        console.log('Validating backup integrity...');
        const valid = await this.validateBackup(options.backupId, false);
        if (!valid) {
          throw new Error('Backup validation failed');
        }
      }

      // Get documents for collection
      const documents = backup.documents[options.collection];
      if (!documents) {
        throw new Error(`Collection ${options.collection} not found in backup`);
      }

      console.log(`Found ${documents.length} documents to restore`);

      // Verify checksum if available
      const expectedChecksum = backup.metadata.checksums[options.collection];
      if (expectedChecksum) {
        const actualChecksum = this.calculateChecksum(documents);
        if (actualChecksum !== expectedChecksum) {
          throw new Error(`Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`);
        }
        console.log('Checksum verified');
      }

      // Restore documents
      if (!this.dryRun) {
        const batchSize = 50;
        const batches = this.createBatches(documents, batchSize);

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} documents)`);

          try {
            const batchResult = await this.client.action('backup:restoreCollection', {
              table: options.collection,
              documents: batch,
              options: {
                force: options.force,
                skipExisting: false,
              },
            });

            result.documentsRestored += batchResult.restored || 0;
            result.documentsSkipped += batchResult.skipped || 0;
            result.documentsFailed += batchResult.failed || 0;

            if (batchResult.errors && batchResult.errors.length > 0) {
              console.error(`  Batch errors: ${batchResult.errors.slice(0, 3).join(', ')}`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`  Batch ${i + 1} failed: ${errorMessage}`);
            result.documentsFailed += batch.length;

            if (!options.force) {
              throw error;
            }
          }
        }
      } else {
        console.log(`[DRY RUN] Would restore ${documents.length} documents`);
        result.documentsRestored = documents.length;
      }

      result.duration = Date.now() - startTime;
      result.success = result.documentsFailed === 0;

      console.log(`\nRestore complete in ${result.duration}ms`);
      console.log(`Restored: ${result.documentsRestored}`);
      console.log(`Skipped: ${result.documentsSkipped}`);
      console.log(`Failed: ${result.documentsFailed}`);

      return result;
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * List all available backups
   */
  async listBackups(collection?: string, limit = 50): Promise<BackupInfo[]> {
    console.log(`Scanning backups directory: ${this.backupDir}`);

    const backups: BackupInfo[] = [];

    if (!existsSync(this.backupDir)) {
      return backups;
    }

    const files = readdirSync(this.backupDir);
    const backupIds = new Set<string>();

    // Find all unique backup IDs
    for (const file of files) {
      if (file.endsWith('.meta.json')) {
        backupIds.add(file.replace('.meta.json', ''));
      } else if (file.endsWith('.json') && !file.includes('.meta')) {
        backupIds.add(file.replace('.json', ''));
      }
    }

    // Load info for each backup
    for (const backupId of Array.from(backupIds)) {
      try {
        // Try to load metadata first
        const metadataPath = join(this.backupDir, `${backupId}.meta.json`);
        let metadata: BackupMetadata | null = null;

        if (existsSync(metadataPath)) {
          const content = readFileSync(metadataPath, 'utf-8');
          metadata = JSON.parse(content) as BackupMetadata;
        } else {
          // Fallback to loading from backup file
          const backupPath = join(this.backupDir, `${backupId}.json`);
          if (existsSync(backupPath)) {
            const content = readFileSync(backupPath, 'utf-8');
            const backup = JSON.parse(content) as { documents: Record<string, unknown[]>; metadata: BackupMetadata };
            metadata = backup.metadata;
          }
        }

        if (metadata) {
          // Filter by collection if specified
          if (collection && !metadata.collections.includes(collection)) {
            continue;
          }

          const filePath = join(this.backupDir, `${backupId}.json`);
          const size = existsSync(filePath) ? statSync(filePath).size : 0;

          backups.push({
            id: metadata.id,
            createdAt: metadata.createdAt,
            collections: metadata.collections,
            totalDocuments: Object.values(metadata.documentCounts).reduce((a, b) => a + b, 0),
            compressed: metadata.compressed,
            actor: metadata.actor,
            size,
          });
        }
      } catch (error) {
        if (this.verbose) {
          console.warn(`Failed to read backup ${backupId}`);
        }
      }
    }

    // Sort by creation date (newest first)
    backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return backups.slice(0, limit);
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`\nDeleting backup: ${backupId}`);

    const filesToDelete = [
      `${backupId}.json`,
      `${backupId}.meta.json`,
    ];

    let deletedCount = 0;
    let missingCount = 0;

    for (const file of filesToDelete) {
      const filePath = join(this.backupDir, file);
      if (existsSync(filePath)) {
        if (!this.dryRun) {
          unlinkSync(filePath);
          const size = statSync(filePath).size;
          console.log(`  Deleted: ${file} (${(size / 1024).toFixed(2)} KB)`);
        } else {
          console.log(`  [DRY RUN] Would delete: ${file}`);
        }
        deletedCount++;
      } else {
        missingCount++;
      }
    }

    const success = deletedCount > 0;

    if (success) {
      console.log(`\nDeleted ${deletedCount} file(s) for backup ${backupId}`);
    } else {
      console.log(`No files found for backup ${backupId}`);
    }

    return { success };
  }

  /**
   * Validate a backup's integrity
   */
  async validateBackup(backupId: string, output = true): Promise<boolean> {
    const startTime = Date.now();

    if (output) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Validating backup: ${backupId}`);
      console.log(`${'='.repeat(60)}`);
    }

    const backup = this.loadBackup(backupId);
    if (!backup) {
      if (output) console.error('Backup not found');
      return false;
    }

    // Validate metadata structure
    const metadata = backup.metadata;
    if (!metadata.id || !metadata.timestamp || !metadata.collections) {
      if (output) console.error('Invalid metadata structure');
      return false;
    }

    // Validate each collection
    let valid = true;
    for (const collection of metadata.collections) {
      const documents = backup.documents[collection];
      if (!documents) {
        if (output) console.error(`  ✗ Collection ${collection} missing`);
        valid = false;
        continue;
      }

      // Verify checksum
      const expectedChecksum = metadata.checksums[collection];
      const actualChecksum = this.calculateChecksum(documents);

      if (expectedChecksum && actualChecksum !== expectedChecksum) {
        if (output) {
          console.error(`  ✗ Collection ${collection} checksum mismatch`);
          console.error(`    Expected: ${expectedChecksum}`);
          console.error(`    Actual: ${actualChecksum}`);
        }
        valid = false;
      } else {
        if (output) {
          console.log(`  ✓ Collection ${collection} (${documents.length} documents)`);
        }
      }
    }

    // Verify document counts match metadata
    for (const collection of metadata.collections) {
      const expected = metadata.documentCounts[collection];
      const actual = backup.documents[collection]?.length || 0;
      if (expected !== actual) {
        if (output) {
          console.warn(`  ! Document count mismatch for ${collection}: expected ${expected}, got ${actual}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    if (output) {
      console.log(`\nValidation complete in ${duration}ms`);
      console.log(`Status: ${valid ? '\x1b[32mVALID\x1b[0m' : '\x1b[31mINVALID\x1b[0m'}`);
    }

    return valid;
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(retentionDays: number): Promise<{ deleted: number; kept: number; errors: string[] }> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Cleaning up backups older than ${retentionDays} days`);
    console.log(`${'='.repeat(60)}`);

    const backups = await this.listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const toDelete: BackupInfo[] = [];
    const toKeep: BackupInfo[] = [];

    for (const backup of backups) {
      const backupDate = new Date(backup.createdAt);
      if (backupDate < cutoffDate) {
        toDelete.push(backup);
      } else {
        toKeep.push(backup);
      }
    }

    const result = {
      deleted: 0,
      kept: toKeep.length,
      errors: [] as string[],
    };

    for (const backup of toDelete) {
      try {
        if (!this.dryRun) {
          const deleteResult = await this.deleteBackup(backup.id);
          if (deleteResult.success) {
            result.deleted++;
          }
        } else {
          console.log(`[DRY RUN] Would delete: ${backup.id}`);
          result.deleted++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push(`${backup.id}: ${errorMessage}`);
      }
    }

    console.log(`\nCleanup complete`);
    console.log(`Deleted: ${result.deleted}`);
    console.log(`Kept: ${result.kept}`);

    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.length}`);
      result.errors.forEach(err => console.log(`  - ${err}`));
    }

    return result;
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
Backup and Restore Utilities - Convex Migration

USAGE:
  bun run scripts/migrate/backup.ts <command> [OPTIONS]

COMMANDS:
  backup              Create backups of Convex collections
  restore             Restore collections from backups
  list                List available backups
  delete              Delete a backup
  validate            Validate backup integrity
  cleanup             Clean up old backups

GLOBAL OPTIONS:
  --dry-run, -n       Run without making changes
  --verbose, -v       Enable verbose logging
  --help, -h          Show this help message

BACKUP OPTIONS:
  --collection, -c    Specific collection to backup
  --all               Backup all collections (default when --collection not specified)
  --compress          Compress backup file
  --retention-days    Set retention policy in days (used with cleanup)

RESTORE OPTIONS:
  --collection, -c    Collection to restore (required)
  --backup-id         Backup ID to restore from (required)
  --force             Force restore even on conflicts
  --no-validate       Skip validation before restore

LIST OPTIONS:
  --collection, -c    Filter by collection
  --limit             Max number of backups to show (default: 50)

DELETE OPTIONS:
  --backup-id         Backup ID to delete (required)

VALIDATE OPTIONS:
  --backup-id         Backup ID to validate (required)

CLEANUP OPTIONS:
  --retention-days    Retention period in days (required)

EXAMPLES:
  # Backup a specific collection
  bun run scripts/migrate/backup.ts backup --collection users

  # Backup all collections
  bun run scripts/migrate/backup.ts backup --all

  # Restore a collection from backup
  bun run scripts/migrate/backup.ts restore --collection users --backup-id backup-users-2024-01-31...

  # List all backups
  bun run scripts/migrate/backup.ts list

  # List backups for a specific collection
  bun run scripts/migrate/backup.ts list --collection events

  # Validate a backup
  bun run scripts/migrate/backup.ts validate --backup-id backup-users-2024-01-31...

  # Delete a backup
  bun run scripts/migrate/backup.ts delete --backup-id backup-users-2024-01-31...

  # Clean up backups older than 30 days
  bun run scripts/migrate/backup.ts cleanup --retention-days 30
`);
}

// ============================================================================
// COMMAND HANDLERS
// ============================================================================

async function handleBackup(manager: BackupManager, options: Record<string, unknown>): Promise<void> {
  const collection = (options.collection || options.c) as string;
  const allCollections = options.all === 'true' || options.all === true;

  let backupOptions: Omit<BackupOptions, 'allCollections'> = {
    dryRun: false,
    verbose: false,
    collection,
    compress: options.compress === 'true' || options.compress === true,
    includeMetadata: true,
    retentionDays: parseInt((options['retention-days'] as string) || '30', 10),
  };

  if (allCollections) {
    const results = await manager.backupAllCollections({ ...backupOptions, allCollections });

    console.log(`\n${'='.repeat(60)}`);
    console.log('Backup Summary');
    console.log(`${'='.repeat(60)}`);

    for (const result of results) {
      const status = result.success ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      console.log(`${status} ${result.collection}: ${result.documentCount} documents`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    }

    const succeeded = results.filter(r => r.success).length;
    console.log(`\nTotal: ${succeeded}/${results.length} collections backed up`);

    process.exit(succeeded === results.length ? 0 : 1);
  } else if (collection) {
    const result = await manager.backupCollection(collection, backupOptions);

    console.log(`\n${result.success ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} Backup ${result.success ? 'complete' : 'failed'}`);
    console.log(`Backup ID: ${result.backupId}`);
    console.log(`Documents: ${result.documentCount}`);
    console.log(`Checksum: ${result.checksum}`);
    console.log(`Duration: ${result.duration}ms`);

    process.exit(result.success ? 0 : 1);
  } else {
    console.error('Error: Specify --collection or --all');
    process.exit(1);
  }
}

async function handleRestore(manager: BackupManager, options: Record<string, unknown>): Promise<void> {
  const collection = (options.collection || options.c) as string;
  const backupId = (options['backup-id'] as string);

  if (!collection) {
    throw new Error('--collection is required');
  }
  if (!backupId) {
    throw new Error('--backup-id is required');
  }

  const result = await manager.restoreCollection({
    dryRun: false,
    verbose: false,
    collection,
    backupId,
    force: options.force === 'true' || options.force === true,
    validateBeforeRestore: options['no-validate'] !== 'true' && options['no-validate'] !== true,
  });

  if (result.success) {
    console.log(`\n\x1b[32m✓\x1b[0m Restore complete`);
    process.exit(0);
  } else {
    console.error(`\n\x1b[31m✗\x1b[0m Restore failed: ${result.error}`);
    process.exit(1);
  }
}

async function handleList(manager: BackupManager, options: Record<string, unknown>): Promise<void> {
  const collection = (options.collection || options.c) as string;
  const limit = parseInt((options.limit as string) || '50', 10);

  const backups = await manager.listBackups(collection, limit);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Available Backups${collection ? ` (${collection})` : ''}`);
  console.log(`${'='.repeat(60)}`);

  if (backups.length === 0) {
    console.log('No backups found');
    return;
  }

  for (const backup of backups) {
    const date = new Date(backup.createdAt);
    const age = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));

    console.log(`\nID: ${backup.id}`);
    console.log(`  Created: ${backup.createdAt} (${age} days ago)`);
    console.log(`  Collections: ${backup.collections.join(', ')}`);
    console.log(`  Documents: ${backup.totalDocuments}`);
    console.log(`  Size: ${(backup.size / 1024).toFixed(2)} KB`);
    console.log(`  Actor: ${backup.actor}`);
    console.log(`  Compressed: ${backup.compressed ? 'Yes' : 'No'}`);
  }

  console.log(`\nTotal: ${backups.length} backup(s)`);
}

async function handleDelete(manager: BackupManager, options: Record<string, unknown>): Promise<void> {
  const backupId = (options['backup-id'] as string);

  if (!backupId) {
    throw new Error('--backup-id is required');
  }

  await manager.deleteBackup(backupId);
}

async function handleValidate(manager: BackupManager, options: Record<string, unknown>): Promise<void> {
  const backupId = (options['backup-id'] as string);

  if (!backupId) {
    throw new Error('--backup-id is required');
  }

  const valid = await manager.validateBackup(backupId, true);
  process.exit(valid ? 0 : 1);
}

async function handleCleanup(manager: BackupManager, options: Record<string, unknown>): Promise<void> {
  const retentionDays = parseInt((options['retention-days'] as string), 10);

  if (isNaN(retentionDays) || retentionDays <= 0) {
    throw new Error('--retention-days must be a positive integer');
  }

  const result = await manager.cleanupOldBackups(retentionDays);

  if (result.errors.length > 0) {
    process.exit(1);
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

  // Initialize backup manager
  const manager = new BackupManager(convexUrl, args.verbose, args.dryRun);

  try {
    switch (args.command) {
      case 'backup':
        await handleBackup(manager, args.options);
        break;
      case 'restore':
        await handleRestore(manager, args.options);
        break;
      case 'list':
        await handleList(manager, args.options);
        break;
      case 'delete':
        await handleDelete(manager, args.options);
        break;
      case 'validate':
        await handleValidate(manager, args.options);
        break;
      case 'cleanup':
        await handleCleanup(manager, args.options);
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
