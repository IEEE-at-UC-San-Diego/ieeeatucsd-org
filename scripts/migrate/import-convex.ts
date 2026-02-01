#!/usr/bin/env -S bun run
/**
 * Convex Import Script
 *
 * Phase 2 of Firebase to Convex Migration
 *
 * Imports transformed JSON data into Convex using the Convex Admin API/CLI.
 * Maintains referential integrity by importing collections in the correct order.
 *
 * Usage:
 *   bun run import-convex                    # Import all collections
 *   bun run import-convex --dry-run          # Dry run (no actual import)
 *   bun run import-convex --verbose          # Verbose logging
 *   bun run import-convex --collection users # Import single collection
 *   bun run import-convex --report           # Show import report
 */

import { join } from 'path';
import { readFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { ConvexHttpClient } from 'convex/browser';
import {
  ALL_COLLECTIONS,
  COLLECTION_SETTINGS,
  DEFAULT_IMPORT_OPTIONS,
  type ImportOptions,
  type ImportReport,
  type CollectionImportResult,
  type DocumentImportResult,
  type CollectionImportSettings,
  getImportOrderForCollections,
  isValidCollection,
} from './import-config';
import type {
  TransformedDocument,
  TransformedUser,
  TransformedEvent,
  TransformedEventAttendee,
  TransformedEventRequest,
  TransformedReimbursement,
  TransformedFundDeposit,
  TransformedPublicProfile,
  TransformedOfficerInvitation,
  TransformedDirectOnboarding,
  TransformedInvite,
  TransformedSponsorDomain,
  TransformedLink,
  TransformedConstitution,
  TransformedConstitutionSection,
  TransformedConstitutionAuditEntry,
  TransformedNotification,
  TransformedGoogleGroupAssignment,
  TransformedOrganizationSetting,
} from './transformed-types';

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

interface ParsedArgs {
  dryRun: boolean;
  verbose: boolean;
  collections: string[];
  continueOnError: boolean;
  deployment: string | undefined;
  report: boolean;
  help: boolean;
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    dryRun: false,
    verbose: false,
    collections: [],
    continueOnError: true,
    deployment: undefined,
    report: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--dry-run':
        parsed.dryRun = true;
        break;
      case '-n':
        parsed.dryRun = true;
        break;
      case '--verbose':
        parsed.verbose = true;
        break;
      case '-v':
        parsed.verbose = true;
        break;
      case '--collection':
      case '-c':
        if (i + 1 < args.length) {
          const collection = args[++i];
          if (isValidCollection(collection)) {
            parsed.collections.push(collection);
          } else {
            console.error(`Error: Invalid collection '${collection}'`);
            console.error(`Valid collections: ${ALL_COLLECTIONS.join(', ')}`);
            process.exit(1);
          }
        }
        break;
      case '--continue-on-error':
        parsed.continueOnError = true;
        break;
      case '--stop-on-error':
        parsed.continueOnError = false;
        break;
      case '--deployment':
      case '-d':
        if (i + 1 < args.length) {
          parsed.deployment = args[++i];
        }
        break;
      case '--report':
        parsed.report = true;
        break;
      case '--help':
      case '-h':
        parsed.help = true;
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`Warning: Unknown option '${arg}'`);
        }
    }
  }

  return parsed;
}

function showHelp(): void {
  console.log(`
Convex Import Script - Firebase to Convex Migration

USAGE:
  bun run scripts/migrate/import-convex.ts [OPTIONS]

OPTIONS:
  --dry-run, -n              Run without actually importing data
  --verbose, -v              Enable verbose logging
  --collection, -c NAME      Import specific collection only
  --continue-on-error        Continue on collection errors (default)
  --stop-on-error            Stop on first error
  --deployment, -d URL       Override Convex deployment URL
  --report                   Show detailed import report
  --help, -h                 Show this help message

EXAMPLES:
  # Import all collections
  bun run scripts/migrate/import-convex.ts

  # Dry run to test
  bun run scripts/migrate/import-convex.ts --dry-run

  # Import specific collection with verbose output
  bun run scripts/migrate/import-convex.ts --collection users --verbose

  # Import multiple specific collections
  bun run scripts/migrate/import-convex.ts -c users -c public_profiles -v

COLLECTIONS (imported in order):
  Phase 1 (Independent):
    - organizationSettings, sponsorDomains

  Phase 2 (Parent):
    - users, public_profiles, events, officerInvitations,
      directOnboardings, invites, constitutions

  Phase 3 (Dependent):
    - event_attendees, event_requests, reimbursements,
      fundDeposits, constitution_sections, constitution_audit_log

  Phase 4 (Cross-references):
    - notifications, links, googleGroupAssignments
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

  indent(message: string, level = 1): void {
    const prefix = '  '.repeat(level);
    console.log(`${prefix}${message}`);
  }
}

// ============================================================================
// FILE READING
// ============================================================================

function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to read ${filePath}: ${error.message}`);
    }
    throw new Error(`Failed to read ${filePath}: ${String(error)}`);
  }
}

function loadTransformedCollection(collection: string, inputDir: string): unknown[] {
  const filePath = join(inputDir, `${collection}.json`);

  const data = readJsonFile<unknown[]>(filePath);

  if (data === null) {
    return [];
  }

  if (!Array.isArray(data)) {
    throw new Error(`Invalid data format in ${filePath}: expected array`);
  }

  return data;
}

// ============================================================================
// CONVEX CLIENT
// ============================================================================

class ConvexImporter {
  private logger: Logger;
  private options: ImportOptions;
  private deploymentUrl: string;
  private client: ConvexHttpClient;

  constructor(logger: Logger, options: ImportOptions) {
    this.logger = logger;
    this.options = options;

    // Get deployment URL from env or use provided value
    const envUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;

    if (!envUrl && !options.convexDeployment) {
      throw new Error(
        'Convex deployment URL not found. Set VITE_CONVEX_URL or CONVEX_URL environment variable, or use --deployment option.'
      );
    }

    this.deploymentUrl = options.convexDeployment || envUrl!;

    if (!this.deploymentUrl.startsWith('https://')) {
      this.deploymentUrl = `https://${this.deploymentUrl}`;
    }

    this.client = new ConvexHttpClient(this.deploymentUrl);

    this.logger.info(`Connected to Convex deployment: ${this.deploymentUrl}`);
  }

  async importCollection(collection: string, settings: CollectionImportSettings): Promise<CollectionImportResult> {
    const startTime = Date.now();
    this.logger.info(`\n${'='.repeat(60)}`);
    this.logger.info(`Importing collection: ${collection}`);
    this.logger.verboseLog(`Settings: batch=${settings.batchSize}, delay=${settings.batchDelay}ms`);

    const result: CollectionImportResult = {
      collection,
      success: true,
      documentCount: 0,
      successCount: 0,
      failureCount: 0,
      skippedCount: 0,
      duration: 0,
    };

    try {
      // Load the transformed data
      const documents = loadTransformedCollection(collection, this.options.inputDir);

      if (documents.length === 0) {
        this.logger.warning(`No documents found for ${collection}`);
        result.duration = Date.now() - startTime;
        return result;
      }

      result.documentCount = documents.length;
      this.logger.info(`Found ${documents.length} documents to import`);

      // Import in batches
      const batches = this.createBatches(documents, settings.batchSize);
      this.logger.info(`Processing ${batches.length} batches of up to ${settings.batchSize} documents each`);

      const allDocumentResults: DocumentImportResult[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        this.logger.verboseLog(`Processing batch ${i + 1}/${batches.length} (${batch.length} documents)`);

        // Pre-process documents (remove _id, convert ID references)
        const processedBatch = this.preprocessDocuments(batch, collection, settings);

        // Import the batch
        const batchResults = await this.importBatch(collection, processedBatch, settings);

        allDocumentResults.push(...batchResults);

        // Update counts
        for (const docResult of batchResults) {
          if (docResult.success) {
            result.successCount++;
          } else {
            result.failureCount++;
          }
        }

        // Log progress
        if (this.options.verbose || (i + 1) % 5 === 0 || i === batches.length - 1) {
          const totalProcessed = (i + 1) * settings.batchSize;
          const actualProcessed = Math.min(totalProcessed, documents.length);
          this.logger.verboseLog(
            `Progress: ${actualProcessed}/${documents.length} documents (${Math.round((actualProcessed / documents.length) * 100)}%)`
          );
        }

        // Delay between batches for rate limiting
        if (i < batches.length - 1 && settings.batchDelay > 0) {
          if (!this.options.dryRun) {
            await this.sleep(settings.batchDelay);
          }
        }
      }

      result.documentResults = this.options.verbose ? allDocumentResults : undefined;
      result.duration = Date.now() - startTime;

      // Final result for collection
      if (result.failureCount > 0 && !settings.continueOnError) {
        result.success = false;
        result.error = `${result.failureCount} documents failed to import`;
        this.logger.error(`Collection import failed: ${result.error}`);
      } else if (result.failureCount > 0) {
        this.logger.warning(`Imported ${result.successCount} documents, skipped/failed ${result.failureCount}`);
      } else {
        this.logger.success(`Successfully imported ${result.successCount} documents`);
      }

      return result;
    } catch (error) {
      result.duration = Date.now() - startTime;
      result.success = false;
      result.error = error instanceof Error ? error.message : String(error);

      this.logger.error(`Failed to import collection ${collection}: ${result.error}`);

      return result;
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private preprocessDocuments(documents: Record<string, unknown>[], collection: string, settings: CollectionImportSettings): Record<string, unknown>[] {
    return documents.map((doc) => {
      const processed: Record<string, unknown> = { ...doc };

      // Remove _id field - Convex will generate its own
      delete processed._id;

      // Handle ID reference fields - they need to be proper Convex IDs
      for (const field of settings.idReferenceFields) {
        const value = processed[field];
        if (Array.isArray(value)) {
          // Array of IDs (e.g., collaborators)
          processed[field] = value.map((id) => this.convertToConvexId(id));
        } else if (value !== undefined && value !== null) {
          processed[field] = this.convertToConvexId(value);
        }
      }

      return processed;
    });
  }

  private convertToConvexId(id: unknown): string | undefined {
    if (!id || typeof id !== 'string') {
      return undefined;
    }

    // If it's already a Convex ID format (64 char hex), keep it
    if (id.length === 64 && /^[a-f0-9]+$/i.test(id)) {
      return id;
    }

    // Otherwise, we need to handle the Firebase ID format
    // In a real migration, you would have an ID mapping from Firebase IDs to Convex IDs
    // For now, we'll use the Firebase ID as is, but this may need adjustment
    return id;
  }

  private async importBatch(collection: string, documents: Record<string, unknown>[], settings: CollectionImportSettings): Promise<DocumentImportResult[]> {
    if (this.options.dryRun) {
      // In dry run mode, just validate and return success for all
      return documents.map((doc) => ({
        originalId: String(doc._id || 'unknown'),
        success: true,
      }));
    }

    try {
      // Call the appropriate Convex action based on collection
      const actionName = this.getBatchActionName(collection);

      const results = await this.client.action(
        actionName,
        {
          documents,
          options: {
            onExisting: settings.onExisting,
            dryRun: this.options.dryRun,
            continueOnError: settings.continueOnError,
            skipExisting: this.options.skipExisting,
          },
        }
      );

      return results as DocumentImportResult[];
    } catch (error) {
      // If batch action fails, return failure for all documents
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.verboseLog(`Batch import error: ${errorMessage}`);

      return documents.map((doc) => ({
        originalId: String(doc._id || 'unknown'),
        success: false,
        error: errorMessage,
      }));
    }
  }

  private getBatchActionName(collection: string): string {
    // Map collection names to specific action names
    const actionMap: Record<string, string> = {
      users: 'migration:batchInsertUsers',
      events: 'migration:batchInsertEvents',
      event_attendees: 'migration:batchInsertEventAttendees',
      public_profiles: 'migration:batchInsertPublicProfiles',
      organizationSettings: 'migration:batchInsertOrganizationSettings',
      sponsorDomains: 'migration:batchInsertSponsorDomains',
      constitutions: 'migration:batchInsertConstitutions',
      constitution_sections: 'migration:batchInsertConstitutionSections',
      constitution_audit_log: 'migration:batchInsertConstitutionAuditLog',
    };

    return actionMap[collection] || 'migration:batchInsert';
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async runImport(collections: string[]): Promise<ImportReport> {
    const startTime = new Date();
    this.logger.info(`\n${'='.repeat(60)}`);
    this.logger.info(
      `Starting Convex Import ${this.options.dryRun ? '(DRY RUN)' : ''}`
    );
    this.logger.info(`Collections to import: ${collections.join(', ')}`);
    this.logger.info(`${'='.repeat(60)}`);

    const report: ImportReport = {
      startTime: startTime.toISOString(),
      endTime: '',
      duration: 0,
      success: true,
      totalCollections: collections.length,
      successfulCollections: 0,
      failedCollections: 0,
      totalDocuments: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      totalSkipped: 0,
      results: [],
    };

    for (const collection of collections) {
      const settings = COLLECTION_SETTINGS[collection];

      if (!settings) {
        this.logger.warning(`No settings found for collection: ${collection}, skipping`);
        continue;
      }

      if (!settings.enabled) {
        this.logger.info(`Collection ${collection} is disabled, skipping`);
        continue;
      }

      const result = await this.importCollection(collection, settings);
      report.results.push(result);

      // Update totals
      report.totalDocuments += result.documentCount;
      report.totalSuccesses += result.successCount;
      report.totalFailures += result.failureCount;
      report.totalSkipped += result.skippedCount;

      if (result.success) {
        report.successfulCollections++;
      } else {
        report.failedCollections++;
        report.success = false;

        if (!this.options.continueOnError) {
          this.logger.error('Stopping import due to error and --stop-on-error flag');
          break;
        }
      }
    }

    report.endTime = new Date().toISOString();
    report.duration = Date.now() - startTime.getTime();

    return report;
  }
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

function printReport(report: ImportReport, verbose: boolean): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log('IMPORT REPORT');
  console.log(`${'='.repeat(60)}`);
  console.log(`Start Time:      ${new Date(report.startTime).toLocaleString()}`);
  console.log(`End Time:        ${new Date(report.endTime).toLocaleString()}`);
  console.log(`Duration:        ${Math.round(report.duration / 1000)}s`);
  console.log(`Status:          ${report.success ? '\x1b[32mSUCCESS\x1b[0m' : '\x1b[31mFAILED\x1b[0m'}`);
  console.log(``);
  console.log(`Collections:     ${report.successfulCollections}/${report.totalCollections} successful`);
  console.log(`Documents:       ${report.totalSuccesses}/${report.totalDocuments} imported`);
  console.log(`Failures:        ${report.totalFailures}`);
  console.log(`Skipped:         ${report.totalSkipped}`);

  if (report.failedCollections > 0) {
    console.log(`\nFailed Collections:`);
    for (const result of report.results) {
      if (!result.success) {
        console.log(`  - ${result.collection}: ${result.error || 'Unknown error'}`);
      }
    }
  }

  if (verbose && report.results.length > 0) {
    console.log(`\n${'='.repeat(60)}`);
    console.log('PER COLLECTION DETAILS');
    console.log(`${'='.repeat(60)}`);

    for (const result of report.results) {
      const status = result.success ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      console.log(
        `\n${status} ${result.collection} (${result.duration}ms)`
      );
      console.log(`    Documents: ${result.successCount}/${result.documentCount} imported`);

      if (result.failureCount > 0) {
        console.log(`    Failed: ${result.failureCount}`);

        // Show first few errors
        if (result.documentResults) {
          const errors = result.documentResults.filter((r) => !r.success).slice(0, 5);
          for (const err of errors) {
            console.log(`      - ${err.originalId}: ${err.error || 'Unknown error'}`);
          }

          if (result.failureCount > 5) {
            console.log(`      ... and ${result.failureCount - 5} more errors`);
          }
        }
      }
    }
  }

  console.log(`${'='.repeat(60)}\n`);
}

function saveReport(report: ImportReport, outputPath: string): void {
  const reportPath = join(outputPath, `import-report-${Date.now()}.json`);

  const fs = require('fs');
  const path = require('path');

  // Ensure directory exists
  const dir = path.dirname(reportPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

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

  const reportOnly = args.report;

  // Determine which collections to import
  const collectionsToImport =
    args.collections.length > 0
      ? getImportOrderForCollections(args.collections)
      : Array.from(ALL_COLLECTIONS);

  const logger = new Logger(args.verbose, args.dryRun);

  const options: ImportOptions = {
    ...DEFAULT_IMPORT_OPTIONS,
    dryRun: args.dryRun,
    verbose: args.verbose,
    collections: collectionsToImport,
    continueOnError: args.continueOnError,
    convexDeployment: args.deployment,
  };

  try {
    const importer = new ConvexImporter(logger, options);

    if (!reportOnly) {
      const report = await importer.runImport(collectionsToImport);
      printReport(report, args.verbose);

      // Save report to file
      saveReport(report, options.inputDir);

      process.exit(report.success ? 0 : 1);
    } else {
      // Report-only mode would load and display a previous report
      console.log('Report mode requires an existing report file path');
      console.log('Usage: --report <report-file-path>');
      process.exit(0);
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
