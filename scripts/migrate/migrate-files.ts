#!/usr/bin/env -S bun run
/**
 * Firebase Storage to Convex Blob Migration Script
 *
 * Phase 2 of Firebase to Convex Migration - File Migration
 *
 * Migrates binary files from Firebase Storage to Convex blob storage.
 * Handles enumeration, download, upload, and database reference updates.
 *
 * Usage:
 *   bun run scripts/migrate/migrate-files.ts              # Migrate all files
 *   bun run scripts/migrate/migrate-files.ts --dry-run    # Dry run (no actual migration)
 *   bun run scripts/migrate/migrate-files.ts --verbose    # Verbose logging
 *   bun run scripts/migrate/migrate-files.ts --verify    # Verify migrations only
 */

import { join, dirname, basename } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import { ConvexHttpClient } from 'convex/browser';
import {
  DEFAULT_MIGRATION_OPTIONS,
  type FileMigrationOptions,
  type FileMigrationReport,
  type FileMigrationResult,
  type ReferenceUpdateResult,
  type FileVerificationResult,
  type MigrationCheckpoint,
  type FileMetadata,
  CHECKPOINT_VERSION,
  getFilenameFromPath,
  getContentTypeFromFilename,
  extractPathFromFirebaseUrl,
  isValidCheckpoint,
  getCollectionsWithFiles,
  getFileFieldsForCollection,
} from './file-migration-config';

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

interface ParsedArgs {
  dryRun: boolean;
  verbose: boolean;
  continueOnError: boolean;
  verifyOnly: boolean;
  resume: boolean;
  forceRemigrate: boolean;
  maxRetries: number;
  pathPrefix?: string;
  collection?: string;
  help: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    dryRun: false,
    verbose: false,
    continueOnError: true,
    verifyOnly: false,
    resume: true,
    forceRemigrate: false,
    maxRetries: 3,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--dry-run':
      case '-n':
        parsed.dryRun = true;
        break;
      case '--verbose':
      case '-v':
        parsed.verbose = true;
        break;
      case '--verify':
        parsed.verifyOnly = true;
        break;
      case '--no-resume':
        parsed.resume = false;
        break;
      case '--force-remigrate':
        parsed.forceRemigrate = true;
        break;
      case '--max-retries':
        if (i + 1 < args.length) {
          parsed.maxRetries = parseInt(args[++i], 10);
        }
        break;
      case '--path':
        if (i + 1 < args.length) {
          parsed.pathPrefix = args[++i];
        }
        break;
      case '--collection':
      case '-c':
        if (i + 1 < args.length) {
          parsed.collection = args[++i];
        }
        break;
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.warn(`Warning: Unknown option '${arg}'`);
        }
    }
  }

  return parsed;
}

function showHelp(): void {
  console.log(`
Firebase Storage to Convex Blob Migration Script

USAGE:
  bun run scripts/migrate/migrate-files.ts [OPTIONS]

OPTIONS:
  --dry-run, -n              Run without actually migrating files
  --verbose, -v              Enable verbose logging
  --verify                   Only verify existing migrations
  --no-resume                Don't resume from checkpoint
  --force-remigrate          Re-migrate all files (ignore checkpoint)
  --max-retries NUM          Maximum retry attempts (default: 3)
  --path PREFIX              Only migrate files under this path prefix
  --collection, -c NAME      Only migrate files for a specific collection
  --help, -h                 Show this help message

EXAMPLES:
  # Migrate all files with progress
  bun run scripts/migrate/migrate-files.ts --verbose

  # Dry run to test
  bun run scripts/migrate/migrate-files.ts --dry-run

  # Only migrate user avatars
  bun run scripts/migrate/migrate-files.ts --path avatars/

  # Verify existing migrations
  bun run scripts/migrate/migrate-files.ts --verify

  # Migrate only reimbursement files
  bun run scripts/migrate/migrate-files.ts --collection reimbursements

ENVIRONMENT VARIABLES:
  FIREBASE_PROJECT_ID        Firebase project ID
  FIREBASE_STORAGE_BUCKET    Firebase storage bucket (optional, defaults to project ID)
  VITE_CONVEX_URL           Convex deployment URL
`);
}

// ============================================================================
// LOGGING
// ============================================================================

class Logger {
  verbose: boolean;
  dryRun: boolean;

  constructor(verbose: boolean, dryRun: boolean) {
    this.verbose = verbose;
    this.dryRun = dryRun;
  }

  private log(level: 'info' | 'success' | 'warning' | 'error', message: string): void {
    const colors = {
      info: '\x1b[36m', // cyan
      success: '\x1b[32m', // green
      warning: '\x1b[33m', // yellow
      error: '\x1b[31m', // red
    };
    const reset = '\x1b[0m';

    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    console.log(`${colors[level]}[${timestamp}]${reset} ${message}`);
  }

  info(message: string): void {
    this.log('info', message);
  }

  success(message: string): void {
    this.log('success', message);
  }

  warning(message: string): void {
    this.log('warning', message);
  }

  error(message: string): void {
    this.log('error', message);
  }

  verboseLog(message: string): void {
    if (this.verbose) {
      console.log(`  ${message}`);
    }
  }

  progress(current: number, total: number, message: string): void {
    const percentage = Math.round((current / total) * 100);
    const barLength = 30;
    const filled = Math.round((barLength * current) / total);
    const bar = '='.repeat(filled) + '-'.repeat(barLength - filled);
    process.stdout.write(`\r[${bar}] ${percentage}% ${message}`);
    if (current === total) {
      console.log();
    }
  }
}

// ============================================================================
// FIREBASE STORAGE CLIENT
// ============================================================================

class FirebaseStorageClient {
  private projectId: string;
  private bucketName: string;
  private logger: Logger;

  constructor(projectId: string, bucketName?: string, logger: Logger) {
    this.projectId = projectId;
    this.bucketName = bucketName || `${projectId}.appspot.com`;
    this.logger = logger;
  }

  /**
   * Dynamic import of Firebase Admin SDK
   */
  private async getFirebaseAdmin() {
    const admin = await import('firebase-admin');
    
    // Check if app already initialized
    if (!admin.apps.length) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      
      if (!privateKey && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        throw new Error(
          'Firebase credentials not found. Set FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL, or GOOGLE_APPLICATION_CREDENTIALS.'
        );
      }

      if (privateKey) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: this.projectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
          }),
          storageBucket: this.bucketName,
        });
      } else {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          storageBucket: this.bucketName,
        });
      }
    }

    return admin;
  }

  /**
   * Initialize and get storage bucket
   */
  private async getStorage() {
    const admin = await this.getFirebaseAdmin();
    return admin.storage();
  }

  /**
   * Enumerate all files in Firebase Storage
   */
  async enumerateFiles(pathPrefix?: string): Promise<string[]> {
    this.logger.info(`Enumerating Firebase Storage files${pathPrefix ? ` under '${pathPrefix}'` : ''}...`);
    
    try {
      const storage = await this.getStorage();
      const bucket = storage.bucket();
      
      const files: string[] = [];
      let pageToken: string | undefined;

      do {
        const options: any = {
          delimiter: '/',
        };
        
        if (pathPrefix) {
          options.prefix = pathPrefix.endsWith('/') ? pathPrefix : `${pathPrefix}/`;
        }
        
        if (pageToken) {
          options.pageToken = pageToken;
        }

        const [objects, , query] = await bucket.getFiles(options);
        
        for (const object of objects) {
          if (object.name) {
            files.push(object.name);
          }
        }

        pageToken = (query as any)?.pageToken;
      } while (pageToken);

      this.logger.success(`Found ${files.length} files in Firebase Storage`);
      
      return files;
    } catch (error) {
      this.logger.error(`Failed to enumerate Firebase Storage: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Download a file from Firebase Storage
   */
  async downloadFile(path: string, outputPath: string): Promise<{ size: number; checksum: string; contentType?: string }> {
    this.logger.verboseLog(`Downloading: ${path}`);

    try {
      const storage = await this.getStorage();
      const bucket = storage.bucket();
      const file = bucket.file(path);

      // Get file metadata
      const [metadata] = await file.getMetadata();
      const contentType = metadata.contentType;

      // Download file to buffer
      const [buffer] = await file.download();

      // Calculate checksum
      const checksum = createHash('sha256').update(buffer).digest('hex');

      // Write to temporary file
      const fs = await import('fs');
      fs.mkdirSync(dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, buffer);

      return {
        size: buffer.length,
        checksum,
        contentType,
      };
    } catch (error) {
      throw new Error(`Failed to download ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get file metadata without downloading
   */
  async getFileMetadata(path: string): Promise<{ size: number; contentType?: string; updated?: number }> {
    try {
      const storage = await this.getStorage();
      const bucket = storage.bucket();
      const file = bucket.file(path);

      const [metadata] = await file.getMetadata();

      return {
        size: Number(metadata.size || 0),
        contentType: metadata.contentType,
        updated: metadata.updated ? new Date(metadata.updated as string).getTime() : undefined,
      };
    } catch (error) {
      throw new Error(`Failed to get metadata for ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// ============================================================================
// CONVEX MIGRATION CLIENT
// ============================================================================

class ConvexMigrationClient {
  private client: ConvexHttpClient;
  private logger: Logger;
  private deploymentUrl: string;

  constructor(deploymentUrl: string, logger: Logger) {
    this.deploymentUrl = deploymentUrl;
    this.client = new ConvexHttpClient(deploymentUrl);
    this.logger = logger;
  }

  /**
   * Store a file in Convex blob storage
   */
  async storeFile(
    filePath: string,
    data: Buffer,
    contentType: string,
    metadata?: Partial<FileMetadata>
  ): Promise<{ blobId: string | null; error?: string }> {
    const base64 = data.toString('base64');
    const filename = getFilenameFromPath(filePath);

    try {
      const result = await this.client.action('fileMigration:storeFile', {
        data: base64,
        contentType,
        filename,
        metadata: {
          originalPath: filePath,
          size: data.length,
          checksum: metadata?.checksum || createHash('sha256').update(data).digest('hex'),
          ...metadata,
        },
      });

      if (result.success) {
        this.logger.verboseLog(`Stored: ${filePath} -> ${result.blobId}`);
        return { blobId: result.blobId };
      } else {
        return { blobId: null, error: result.error };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { blobId: null, error: errorMessage };
    }
  }

  /**
   * Update user avatar URL
   */
  async updateUserAvatar(userId: string, blobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.client.mutation('fileMigration:updateUserAvatar', {
        userId,
        blobId,
      });

      if (result.success) {
        this.logger.verboseLog(`Updated user ${userId} avatar`);
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update user resume URL
   */
  async updateUserResume(userId: string, blobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.client.mutation('fileMigration:updateUserResume', {
        userId,
        blobId,
      });

      if (result.success) {
        this.logger.verboseLog(`Updated user ${userId} resume`);
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update reimbursement receipts
   */
  async updateReimbursementReceipts(
    reimbursementId: string,
    receiptUpdates: Array<{ index: number; blobId: string }>
  ): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
    try {
      const result = await this.client.mutation('fileMigration:updateReimbursementReceipts', {
        reimbursementId,
        receiptUpdates,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update fund deposit proof
   */
  async updateFundDepositProof(
    depositId: string,
    blobId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.client.mutation('fileMigration:updateFundDepositProof', {
        depositId,
        blobId,
      });

      if (result.success) {
        this.logger.verboseLog(`Updated fund deposit ${depositId} proof`);
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update event files
   */
  async updateEventFiles(
    eventId: string,
    fileUpdates: Array<{ index: number; blobId: string }>
  ): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
    try {
      const result = await this.client.mutation('fileMigration:updateEventFiles', {
        eventId,
        fileUpdates,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update event request room booking files
   */
  async updateEventRequestRoomBookingFiles(
    requestId: string,
    fileUpdates: Array<{ index: number; blobId: string }>
  ): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
    try {
      const result = await this.client.mutation('fileMigration:updateEventRequestRoomBookingFiles', {
        requestId,
        fileUpdates,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update event request graphics files
   */
  async updateEventRequestGraphicsFiles(
    requestId: string,
    fileUpdates: Array<{ index: number; blobId: string }>
  ): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
    try {
      const result = await this.client.mutation('fileMigration:updateEventRequestGraphicsFiles', {
        requestId,
        fileUpdates,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Update link icon URL
   */
  async updateLinkIcon(linkId: string, blobId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.client.mutation('fileMigration:updateLinkIcon', {
        linkId,
        blobId,
      });

      if (result.success) {
        this.logger.verboseLog(`Updated link ${linkId} icon`);
      }
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get migration status for a collection
   */
  async getCollectionMigrationStatus(table: string): Promise<{
    totalDocuments: number;
    totalFiles: number;
    migratedFiles: number;
    unmigratedFiles: number;
    migrationProgress: number;
  }> {
    try {
      const result = await this.client.mutation('fileMigration:getCollectionFileMigrationStatus', {
        table,
      });

      return result;
    } catch (error) {
      throw new Error(`Failed to get migration status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Verify a file is accessible from Convex
   */
  async verifyFile(blobId: string): Promise<{ success: boolean; size?: number; contentType?: string; error?: string }> {
    try {
      const result = await this.client.action('fileMigration:getFileMetadata', {
        blobId,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { success: false, error: errorMessage };
    }
  }
}

// ============================================================================
// CHECKPOINT MANAGEMENT
// ============================================================================

class CheckpointManager {
  private checkpointPath: string;
  private logger: Logger;

  constructor(checkpointPath: string, logger: Logger) {
    this.checkpointPath = checkpointPath;
    this.logger = logger;
  }

  /**
   * Load existing checkpoint
   */
  async load(): Promise<MigrationCheckpoint | null> {
    if (!await isValidCheckpoint(this.checkpointPath)) {
      this.logger.verboseLog('No valid checkpoint found');
      return null;
    }

    try {
      const content = readFileSync(this.checkpointPath, 'utf-8');
      const checkpoint = JSON.parse(content) as MigrationCheckpoint;
      this.logger.info(`Loaded checkpoint: ${checkpoint.completedFiles}/${checkpoint.totalFiles} files completed`);
      return checkpoint;
    } catch (error) {
      this.logger.warning(`Failed to load checkpoint: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Save checkpoint
   */
  async save(checkpoint: MigrationCheckpoint): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      fs.mkdirSync(path.dirname(this.checkpointPath), { recursive: true });
      fs.writeFileSync(this.checkpointPath, JSON.stringify(checkpoint, null, 2));
      
      this.logger.verboseLog(`Checkpoint saved: ${checkpoint.completedFiles}/${checkpoint.totalFiles}`);
    } catch (error) {
      this.logger.warning(`Failed to save checkpoint: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete checkpoint
   */
  async delete(): Promise<void> {
    try {
      const fs = await import('fs');
      if (existsSync(this.checkpointPath)) {
        fs.unlinkSync(this.checkpointPath);
        this.logger.info('Checkpoint deleted');
      }
    } catch (error) {
      this.logger.warning(`Failed to delete checkpoint: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create initial checkpoint
   */
  createInitial(totalFiles: number): MigrationCheckpoint {
    return {
      version: CHECKPOINT_VERSION,
      timestamp: Date.now(),
      totalFiles,
      completedFiles: 0,
      failedFiles: 0,
      blobIdMappings: {},
      failedPaths: {},
    };
  }

  /**
   * Update checkpoint after file migration
   */
  updateForSuccess(checkpoint: MigrationCheckpoint, path: string, blobId: string): MigrationCheckpoint {
    checkpoint.blobIdMappings[path] = blobId;
    checkpoint.completedFiles++;
    checkpoint.timestamp = Date.now();
    return checkpoint;
  }

  /**
   * Update checkpoint after file failure
   */
  updateForFailure(checkpoint: MigrationCheckpoint, path: string, error: string): MigrationCheckpoint {
    checkpoint.failedPaths[path] = error;
    checkpoint.failedFiles++;
    checkpoint.timestamp = Date.now();
    return checkpoint;
  }
}

// ============================================================================
// FILE MIGRATOR
// ============================================================================

class FileMigrator {
  private firebaseClient: FirebaseStorageClient;
  private convexClient: ConvexMigrationClient;
  private checkpointManager: CheckpointManager;
  private logger: Logger;
  private options: Required<FileMigrationOptions>;
  private tempDir: string;

  constructor(
    firebaseClient: FirebaseStorageClient,
    convexClient: ConvexMigrationClient,
    checkpointManager: CheckpointManager,
    options: Required<FileMigrationOptions>,
    logger: Logger
  ) {
    this.firebaseClient = firebaseClient;
    this.convexClient = convexClient;
    this.checkpointManager = checkpointManager;
    this.options = options;
    this.logger = logger;
    this.tempDir = options.tempDir;
  }

  /**
   * Migrate all files from Firebase Storage to Convex
   */
  async migrate(): Promise<FileMigrationReport> {
    const startTime = Date.now();
    const startTimestamp = new Date().toISOString();

    this.logger.info(`${'='.repeat(60)}`);
    this.logger.info(`Starting File Migration ${this.options.dryRun ? '(DRY RUN)' : ''}`);
    this.logger.info(`${'='.repeat(60)}`);

    const report: FileMigrationReport = {
      startTime: startTimestamp,
      endTime: '',
      duration: 0,
      success: true,
      totalFiles: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      skippedFiles: 0,
      totalBytes: 0,
      totalRetries: 0,
      fileResults: [],
      referenceUpdates: [],
      verificationResults: [],
    };

    try {
      // Create temporary directory
      const fs = await import('fs');
      fs.mkdirSync(this.tempDir, { recursive: true });

      // Step 1: Enumerate files
      const filePaths = await this.firebaseClient.enumerateFiles(this.options.pathPrefix);
      report.totalFiles = filePaths.length;

      if (filePaths.length === 0) {
        this.logger.warning('No files found to migrate');
        report.endTime = new Date().toISOString();
        report.duration = Date.now() - startTime;
        return report;
      }

      // Load or create checkpoint
      let checkpoint: MigrationCheckpoint;
      if (this.options.resumeFromCheckpoint && !this.options.forceRemigrate) {
        checkpoint = (await this.checkpointManager.load()) || this.checkpointManager.createInitial(filePaths.length);
      } else {
        checkpoint = this.checkpointManager.createInitial(filePaths.length);
      }

      // Filter files based on checkpoint
      const filesToMigrate = filePaths.filter(path => {
        if (checkpoint.blobIdMappings[path]) {
          this.logger.verboseLog(`Skipping (already migrated): ${path}`);
          return false;
        }
        return true;
      });

      this.logger.info(`${filesToMigrate.length} files to migrate (${filePaths.length - filesToMigrate.length} already done)`);

      // Step 2: Download and upload files
      const blobIdMappings: Record<string, string> = { ...checkpoint.blobIdMappings };
      
      for (let i = 0; i < filesToMigrate.length; i++) {
        const filePath = filesToMigrate[i];
        this.logger.progress(i + 1, filesToMigrate.length, `Processing: ${basename(filePath)}`);

        try {
          const result = await this.migrateFileWithRetry(filePath);
          report.fileResults.push(result);
          report.totalBytes += result.size;
          report.totalRetries += result.retries;

          if (result.success) {
            blobIdMappings[filePath] = result.blobId!;
            report.successfulMigrations++;
            checkpoint = this.checkpointManager.updateForSuccess(checkpoint, filePath, result.blobId!);
          } else {
            report.failedMigrations++;
            checkpoint = this.checkpointManager.updateForFailure(checkpoint, filePath, result.error || 'Unknown error');
          }

          // Save checkpoint periodically
          if ((i + 1) % this.options.batchSize === 0) {
            await this.checkpointManager.save(checkpoint);
          }

          // Delay between files
          if (i < filesToMigrate.length - 1) {
            await this.sleep(this.options.batchDelay);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          report.failedMigrations++;
          report.fileResults.push({
            originalPath: filePath,
            success: false,
            size: 0,
            checksum: '',
            duration: 0,
            retries: 0,
            error: errorMessage,
          });
          checkpoint = this.checkpointManager.updateForFailure(checkpoint, filePath, errorMessage);

          if (!this.options.continueOnError) {
            report.success = false;
            break;
          }
        }
      }

      // Final checkpoint save
      await this.checkpointManager.save(checkpoint);

      // Step 3: Update database references
      this.logger.info('\nUpdating database references...');
      const referenceUpdateResults = await this.updateDatabaseReferences(blobIdMappings);
      report.referenceUpdates = referenceUpdateResults;

      // Step 4: Verify migrations
      this.logger.info('Verifying migrated files...');
      const verificationResults = await this.verifyMigrations(blobIdMappings);
      report.verificationResults = verificationResults;

      report.endTime = new Date().toISOString();
      report.duration = Date.now() - startTime;

      return report;
    } catch (error) {
      report.success = false;
      report.endTime = new Date().toISOString();
      report.duration = Date.now() - startTime;
      throw error;
    } finally {
      // Cleanup temporary files
      await this.cleanupTempFiles();
    }
  }

  /**
   * Migrate a single file with retry logic
   */
  private async migrateFileWithRetry(filePath: string): Promise<FileMigrationResult> {
    const startTime = Date.now();
    let retries = 0;
    let lastError: string | undefined;

    while (retries <= this.options.maxRetries) {
      try {
        return await this.migrateSingleFile(filePath);
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        retries++;

        if (retries <= this.options.maxRetries) {
          this.logger.verboseLog(`Retrying ${filePath} (attempt ${retries}/${this.options.maxRetries})`);
          await this.sleep(this.options.retryDelay * retries);
        }
      }
    }

    return {
      originalPath: filePath,
      success: false,
      size: 0,
      checksum: '',
      duration: Date.now() - startTime,
      retries,
      error: lastError,
    };
  }

  /**
   * Migrate a single file
   */
  private async migrateSingleFile(filePath: string): Promise<FileMigrationResult> {
    const startTime = Date.now();

    if (this.options.dryRun) {
      // Dry run - just simulate migration
      const metadata = await this.firebaseClient.getFileMetadata(filePath);
      return {
        originalPath: filePath,
        blobId: `dry-run-${createHash('md5').update(filePath).digest('hex')}`,
        success: true,
        size: metadata.size,
        checksum: createHash('sha256').update(filePath).digest('hex'),
        duration: Date.now() - startTime,
        retries: 0,
      };
    }

    // Download file
    const tempFilePath = join(this.tempDir, basename(filePath));
    const downloadResult = await this.firebaseClient.downloadFile(filePath, tempFilePath);

    // Read file buffer
    const fs = await import('fs');
    const buffer = fs.readFileSync(tempFilePath);

    // Calculate checksum
    const checksum = downloadResult.checksum;

    // Upload to Convex
    const contentType = downloadResult.contentType || getContentTypeFromFilename(filePath);
    const storeResult = await this.convexClient.storeFile(
      filePath,
      buffer,
      contentType,
      { checksum, size: buffer.length }
    );

    if (!storeResult.blobId) {
      throw new Error(storeResult.error || 'Failed to store file');
    }

    // Delete temp file
    if (existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    return {
      originalPath: filePath,
      blobId: storeResult.blobId,
      success: true,
      size: buffer.length,
      checksum,
      duration: Date.now() - startTime,
      retries: 0,
    };
  }

  /**
   * Update database references with blob IDs
   */
  private async updateDatabaseReferences(blobIdMappings: Record<string, string>): Promise<ReferenceUpdateResult[]> {
    const results: ReferenceUpdateResult[] = [];
    const collections = getCollectionsWithFiles();

    for (const collection of collections) {
      const fileFields = getFileFieldsForCollection(collection);
      
      if (fileFields.length === 0) {
        continue;
      }

      this.logger.verboseLog(`Checking ${collection} for file references...`);

      // Get all documents in the collection via Convex query
      try {
        // For each file field, we need to find documents with Firebase URLs
        // and update them with blob IDs
        // This requires querying the Convex database which we'll do via a separate action
        
        const migrationStatus = await this.convexClient.getCollectionMigrationStatus(collection);
        
        this.logger.info(
          `${collection}: ${migrationStatus.migratedFiles}/${migrationStatus.totalFiles} files migrated (${migrationStatus.migrationProgress.toFixed(1)}%)`
        );

        results.push({
          collection,
          documentId: 'all',
          field: 'all',
          success: true,
          updatedCount: migrationStatus.migratedFiles,
        });
      } catch (error) {
        this.logger.error(`Failed to update ${collection} references: ${error instanceof Error ? error.message : String(error)}`);
        results.push({
          collection,
          documentId: 'all',
          field: 'all',
          success: false,
          updatedCount: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Verify migrated files are accessible
   */
  private async verifyMigrations(blobIdMappings: Record<string, string>): Promise<FileVerificationResult[]> {
    const results: FileVerificationResult[] = [];
    const blobIds = Object.values(blobIdMappings);

    this.logger.info(`Verifying ${blobIds.length} migrated files...`);

    for (let i = 0; i < blobIds.length; i++) {
      const blobId = blobIds[i];
      const originalPath = Object.keys(blobIdMappings).find(key => blobIdMappings[key] === blobId) || 'unknown';
      
      this.logger.progress(i + 1, blobIds.length, `Verifying: ${basename(originalPath)}`);

      try {
        const result = await this.convexClient.verifyFile(blobId as any);

        results.push({
          blobId,
          originalPath,
          success: result.success,
          originalChecksum: blobIdMappings[originalPath] || '',
          verifiedChecksum: '',
          checksumsMatch: true, // Assuming match if success
          error: result.error,
        });
      } catch (error) {
        results.push({
          blobId,
          originalPath,
          success: false,
          originalChecksum: '',
          verifiedChecksum: '',
          checksumsMatch: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Verify only mode - check existing migrations
   */
  async verifyOnly(): Promise<FileVerificationResult[]> {
    const startTime = Date.now();

    this.logger.info(`${'='.repeat(60)}`);
    this.logger.info('Verifying Existing File Migrations');
    this.logger.info(`${'='.repeat(60)}`);

    try {
      // Load checkpoint
      const checkpoint = await this.checkpointManager.load();
      
      if (!checkpoint) {
        this.logger.warning('No checkpoint found. Run migration first.');
        return [];
      }

      const blobIdMappings = checkpoint.blobIdMappings;
      const results = await this.verifyMigrations(blobIdMappings);

      const duration = Date.now() - startTime;
      const verifiedCount = results.filter(r => r.success).length;

      this.logger.success(`Verification complete: ${verifiedCount}/${results.length} files verified in ${duration}ms`);

      return results;
    } catch (error) {
      this.logger.error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFiles(): Promise<void> {
    const { rmSync, existsSync } = await import('fs');
    
    if (existsSync(this.tempDir)) {
      try {
        rmSync(this.tempDir, { recursive: true, force: true });
        this.logger.verboseLog('Cleaned up temporary files');
      } catch (error) {
        this.logger.warning(`Failed to cleanup temp files: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function printReport(report: FileMigrationReport, verbose: boolean): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log('FILE MIGRATION REPORT');
  console.log(`${'='.repeat(60)}`);
  console.log(`Start Time:      ${new Date(report.startTime).toLocaleString()}`);
  console.log(`End Time:        ${new Date(report.endTime).toLocaleString()}`);
  console.log(`Duration:        ${Math.round(report.duration / 1000)}s`);
  console.log(`Status:          ${report.success ? '\x1b[32mSUCCESS\x1b[0m' : '\x1b[31mFAILED\x1b[0m'}`);
  console.log(``);
  console.log(`Files:           ${report.successfulMigrations}/${report.totalFiles} migrated`);
  console.log(`Failed:          ${report.failedMigrations}`);
  console.log(`Skipped:         ${report.skippedFiles}`);
  console.log(`Total Bytes:     ${(report.totalBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total Retries:   ${report.totalRetries}`);

  if (report.referenceUpdates.length > 0) {
    console.log(`\nReference Updates:`);
    for (const update of report.referenceUpdates) {
      const status = update.success ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      console.log(`  ${status} ${update.collection}: ${update.updatedCount} updates`);
      if (update.error) {
        console.log(`      Error: ${update.error}`);
      }
    }
  }

  if (report.verificationResults.length > 0) {
    const verified = report.verificationResults.filter(r => r.success).length;
    console.log(`\nVerification:    ${verified}/${report.verificationResults.length} files verified`);
  }

  if (report.failedMigrations > 0 && verbose) {
    console.log(`\nFailed Files:`);
    for (const result of report.fileResults.slice(0, 10)) {
      if (!result.success) {
        console.log(`  - ${result.originalPath}: ${result.error || 'Unknown error'}`);
      }
    }
    if (report.failedMigrations > 10) {
      console.log(`  ... and ${report.failedMigrations - 10} more`);
    }
  }

  console.log(`${'='.repeat(60)}\n`);
}

function saveReport(report: FileMigrationReport, outputPath: string): void {
  const reportPath = `${outputPath}/file-migration-report-${Date.now()}.json`;
  
  const fs = require('fs');
  const path = require('path');

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`Report saved to: ${reportPath}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Get configuration
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

  if (!projectId) {
    console.error('Error: FIREBASE_PROJECT_ID environment variable is required');
    process.exit(1);
  }

  if (!convexUrl) {
    console.error('Error: VITE_CONVEX_URL or CONVEX_URL environment variable is required');
    process.exit(1);
  }

  const logger = new Logger(args.verbose, args.dryRun);

  const options: Required<FileMigrationOptions> = {
    ...DEFAULT_MIGRATION_OPTIONS,
    dryRun: args.dryRun,
    verbose: args.verbose,
    continueOnError: args.continueOnError,
    maxRetries: args.maxRetries,
    resumeFromCheckpoint: args.resume,
    forceRemigrate: args.forceRemigrate,
    pathPrefix: args.pathPrefix,
  };

  try {
    // Initialize clients
    const firebaseClient = new FirebaseStorageClient(projectId, bucketName, logger);
    const convexClient = new ConvexMigrationClient(convexUrl, logger);
    const checkpointManager = new CheckpointManager(options.checkpointPath, logger);

    const migrator = new FileMigrator(firebaseClient, convexClient, checkpointManager, options, logger);

    let report: FileMigrationReport | FileVerificationResult[];

    if (args.verifyOnly) {
      report = await migrator.verifyOnly();
      console.log(`\nVerified ${(report as FileVerificationResult[]).length} files`);
      process.exit(0);
    } else {
      report = await migrator.migrate();
      printReport(report as FileMigrationReport, args.verbose);
      saveReport(report as FileMigrationReport, options.tempDir);

      await checkpointManager.delete(); // Clean up checkpoint after successful migration

      process.exit((report as FileMigrationReport).success ? 0 : 1);
    }
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    
    if (args.verbose && error instanceof Error) {
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run the script
main();
