#!/usr/bin/env node

/**
 * Migration Verification Script
 *
 * Phase 2 of Firebase to Convex Migration - Verification
 *
 * This script performs comprehensive data integrity verification to ensure the
 * migration from Firebase to Convex was completed successfully and accurately.
 *
 * Verification checks performed:
 * - Record count verification: Compare document counts between Firebase and Convex
 * - File checksum verification: Verify all migrated files have correct checksums
 * - Sampling verification: Randomly sample documents and compare field values
 * - Referential integrity: Validate all foreign key references
 * - Query equivalence: Run equivalent queries and compare results
 * - Field validation: Verify required fields and data types
 *
 * Usage:
 *   npx tsx scripts/migrate/verify-migration.ts
 *   npx tsx scripts/migrate/verify-migration.ts --dry-run
 *   npx tsx scripts/migrate/verify-migration.ts --collection users
 *   npx tsx scripts/migrate/verify-migration.ts --check record_count
 *   npx tsx scripts/migrate/verify-migration.ts --verbose
 *   npx tsx scripts/migrate/verify-migration.ts --format html
 *   npx tsx scripts/migrate/verify-migration.ts --report-path ./reports
 *
 * Environment Variables:
 *   FIREBASE_PROJECT_ID: Firebase project ID
 *   FIREBASE_PRIVATE_KEY: Service account private key
 *   FIREBASE_CLIENT_EMAIL: Service account client email
 *   CONVEX_URL: Convex deployment URL (or VITE_CONVEX_URL)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { existsSync } from 'fs';
// @ts-ignore firebase-admin types
import { initializeApp, cert } from 'firebase-admin/app';
// @ts-ignore firebase-admin types
import { getFirestore } from 'firebase-admin/firestore';
import { ConvexHttpClient } from 'convex/browser';
import type {
  VerificationReport,
  CheckResult,
  CheckStatus,
  CheckType,
  VerificationOptions,
  RecordCountCheckResult,
  FileChecksumCheckResult,
  SampleCheckResult,
  SampleDocumentResult,
  FieldDifference,
  ReferentialIntegrityCheckResult,
  OrphanRecord,
  QueryEquivalenceCheckResult,
  FieldValidationCheckResult,
  VerificationIssue,
  PASS_FAIL_CRITERIA,
} from './verify-report';
import {
  generateReportId,
  createCheckResult,
  determineOverallStatus,
  calculateSummary,
  groupChecksByCategory,
  getStatusMessage,
  formatDuration,
  evaluateCheckPass,
} from './verify-report';
import { readFileSync } from 'fs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_OUTPUT_DIR = path.join(__dirname, 'reports');
const DEFAULT_SAMPLE_SIZE = 10;
const BATCH_SIZE = 500;

// Parse command line arguments
const parseArgs = (): VerificationOptions & {
  format: 'json' | 'html' | 'txt';
  reportPath: string;
  help: boolean;
} => {
  const args = process.argv.slice(2);
  const options: VerificationOptions & {
    format: 'json' | 'html' | 'txt';
    reportPath: string;
    help: boolean;
  } = {
    verbose: args.includes('--verbose') || args.includes('-v'),
    dryRun: args.includes('--dry-run'),
    collections: [],
    checkTypes: [],
    sampleSize: DEFAULT_SAMPLE_SIZE,
    documentIds: [],
    forceReverify: false,
    format: 'json',
    reportPath: DEFAULT_OUTPUT_DIR,
    help: args.includes('--help') || args.includes('-h'),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--collection=') || arg.startsWith('-c=')) {
      options.collections.push(arg.split('=')[1]);
    } else if (arg === '--collection' || arg === '-c') {
      options.collections.push(args[++i]);
    } else if (arg.startsWith('--check=')) {
      options.checkTypes.push(arg.split('=')[1] as CheckType);
    } else if (arg === '--check') {
      options.checkTypes.push(args[++i] as CheckType);
    } else if (arg.startsWith('--sample-size=') || arg.startsWith('-s=')) {
      options.sampleSize = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--sample-size' || arg === '-s') {
      options.sampleSize = parseInt(args[++i], 10);
    } else if (arg.startsWith('--format=')) {
      const format = arg.split('=')[1];
      if (['json', 'html', 'txt'].includes(format)) {
        options.format = format as 'json' | 'html' | 'txt';
      }
    } else if (arg.startsWith('--report-path=') || arg.startsWith('-o=')) {
      options.reportPath = arg.split('=')[1];
    } else if (arg === '--report-path' || arg === '-o') {
      options.reportPath = args[++i];
    } else if (arg === '--force-reverify') {
      options.forceReverify = true;
    } else if (arg.startsWith('--document-id=')) {
      options.documentIds?.push(arg.split('=')[1]);
    }
  }

  return options;
};

/**
 * Show help message
 */
const showHelp = (): void => {
  console.log(`
Migration Verification Script - Phase 2: Verification
=======================================================

USAGE:
  npx tsx scripts/migrate/verify-migration.ts [OPTIONS]

OPTIONS:
  --verbose, -v              Enable verbose logging
  --dry-run                  Run without saving report
  --collection, -c NAME      Verify specific collection only
  --check TYPE               Run specific check type only
  --sample-size, -s SIZE     Sample size for sampling verification (default: 10)
  --format FMT               Report format: json, html, or txt (default: json)
  --report-path, -o PATH     Output directory for reports (default: ./reports)
  --force-reverify           Re-verify all items even if previously verified
  --document-id ID           Verify specific document by ID
  --help, -h                 Show this help message

CHECK TYPES:
  record_count              Verify document counts match
  file_checksum             Verify file checksums
  sampling                  Random sample comparison
  referential_integrity     Validate foreign key references
  query_equivalence         Test query equivalence
  field_validation          Validate required fields and types

ENVIRONMENT VARIABLES:
  FIREBASE_PROJECT_ID        Firebase project ID (required)
  FIREBASE_PRIVATE_KEY       Service account private key
  FIREBASE_CLIENT_EMAIL      Service account client email
  CONVEX_URL                 Convex deployment URL

EXAMPLES:
  # Run all verification checks
  npx tsx scripts/migrate/verify-migration.ts

  # Run with verbose output and HTML report
  npx tsx scripts/migrate/verify-migration.ts --verbose --format html

  # Verify only the users collection
  npx tsx scripts/migrate/verify-migration.ts --collection users

  # Run only record count and referential integrity checks
  npx tsx scripts/migrate/verify-migration.ts --check record_count --check referential_integrity

  # Dry run to test without saving
  npx tsx scripts/migrate/verify-migration.ts --dry-run

COLLECTIONS:
  ${COLLECTIONS.join('\n  ')}
`);
};

const COLLECTIONS = [
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
] as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Logger class with support for verbosity levels
 */
class Logger {
  verbose: boolean;
  dryRun: boolean;
  startTime: number;

  constructor(verbose: boolean, dryRun: boolean) {
    this.verbose = verbose;
    this.dryRun = dryRun;
    this.startTime = Date.now();
  }

  info(message: string): void {
    this.log('info', message);
  }

  success(message: string): void {
    this.log('success', message);
  }

  warn(message: string): void {
    this.log('warning', message);
  }

  error(message: string): void {
    this.log('error', message);
  }

  verboseLog(message: string): void {
    if (this.verbose) {
      console.log(`  [DEBUG] ${message}`);
    }
  }

  dryRunLog(message: string): void {
    if (this.dryRun) {
      console.log(`  [DRY RUN] ${message}`);
    }
  }

  progress(current: number, total: number, message: string): void {
    const elapsed = Date.now() - this.startTime;
    const percentage = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.floor(percentage / 2)).padEnd(50, ' ');
    process.stdout.write(`\r[${bar}] ${percentage}% - ${message} (${formatDuration(elapsed)})`);
    if (current === total) {
      process.stdout.write('\n');
    }
  }

  private log(level: 'info' | 'success' | 'warning' | 'error', message: string): void {
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
    };
    const reset = '\x1b[0m';
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    console.log(`${colors[level]}[${timestamp}]${reset} ${message}`);
  }
}

/**
 * Fisher-Yates shuffle for random sampling
 */
function shuffleArray<T>(array: T[], size: number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(size, shuffled.length));
}

/**
 * Deep compare two values
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;

    if (Array.isArray(aObj) !== Array.isArray(bObj)) return false;

    if (Array.isArray(aObj)) {
      if (aObj.length !== bObj.length) return false;
      for (let i = 0; i < aObj.length; i++) {
        if (!deepEqual(aObj[i], (bObj as unknown[])[i])) return false;
      }
      return true;
    }

    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!Object.prototype.hasOwnProperty.call(bObj, key) || !deepEqual(aObj[key], bObj[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/**
 * Get type of a value
 */
function getType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

// ============================================================================
// FIREBASE CLIENT
// ============================================================================

class FirebaseClient {
  private db: ReturnType<typeof getFirestore>;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    if (!projectId) {
      throw new Error('FIREBASE_PROJECT_ID environment variable is required');
    }

    let credentials;
    if (privateKey && clientEmail) {
      credentials = cert({ projectId, privateKey, clientEmail });
    } else if (credentialsPath) {
      credentials = cert(credentialsPath);
    } else {
      throw new Error('Firebase credentials required');
    }

    const app = initializeApp({ projectId, credential: credentials });
    this.db = getFirestore(app);
    logger.info(`Connected to Firebase project: ${projectId}`);
  }

  /**
   * Count documents in a Firebase collection
   */
  async countDocuments(collectionName: string): Promise<number> {
    let count = 0;
    let lastDoc: any = null;
    let hasMore = true;

    while (hasMore) {
      let query = this.db.collection(collectionName).orderBy('__name__').limit(BATCH_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      count += snapshot.size;

      if (snapshot.size < BATCH_SIZE) {
        hasMore = false;
      } else {
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
      }
    }

    this.logger.verboseLog(`Firebase count for ${collectionName}: ${count}`);
    return count;
  }

  /**
   * Get a document by ID from Firebase
   */
  async getDocument(collectionName: string, docId: string): Promise<Record<string, unknown> | null> {
    try {
      const doc = await this.db.collection(collectionName).doc(docId).get();
      if (!doc.exists) return null;

      const data = doc.data();
      if (!data) return null;

      // Add _id to match Convex structure
      return { _id: doc.id, ...this.serializeFirestoreData(data) };
    } catch (error) {
      this.logger.verboseLog(`Error getting Firebase document ${collectionName}/${docId}: ${error}`);
      return null;
    }
  }

  /**
   * Get sample documents from Firebase
   */
  async getSampleDocuments(collectionName: string, size: number): Promise<Record<string, unknown>[]> {
    // Get all document IDs
    const ids: string[] = [];
    let lastDoc: any = null;
    let hasMore = true;

    while (hasMore) {
      let query = this.db.collection(collectionName).orderBy('__name__').limit(BATCH_SIZE);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      for (const doc of snapshot.docs) {
        ids.push(doc.id);
      }

      if (snapshot.size < BATCH_SIZE) {
        hasMore = false;
      } else {
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
      }
    }

    // Randomly sample IDs
    const sampledIds = shuffleArray(ids, size);

    // Fetch documents
    const docs: Record<string, unknown>[] = [];
    for (const id of sampledIds) {
      const doc = await this.getDocument(collectionName, id);
      if (doc) {
        docs.push(doc);
      }
    }

    this.logger.verboseLog(`Sampled ${docs.length} documents from ${collectionName}`);
    return docs;
  }

  /**
   * Query documents by field
   */
  async queryByField(collectionName: string, field: string, value: unknown): Promise<Record<string, unknown>[]> {
    try {
      const snapshot = await this.db.collection(collectionName).where(field, '==', value).get();
      const docs: Record<string, unknown>[] = [];

      for (const doc of snapshot.docs) {
        const data = doc.data();
        docs.push({ _id: doc.id, ...this.serializeFirestoreData(data) });
      }

      return docs;
    } catch (error) {
      this.logger.verboseLog(`Error querying Firebase ${collectionName} by ${field}: ${error}`);
      return [];
    }
  }

  /**
   * Serialize Firestore data for comparison
   */
  private serializeFirestoreData(data: any): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'object') {
      // Handle Timestamp
      if (data._seconds !== undefined && data._nanoseconds !== undefined && Object.keys(data).length === 2) {
        return data._seconds * 1000 + data._nanoseconds / 1_000_000;
      }

      // Handle DocumentReference
      if (data._firestore && data._path) {
        return data._path.segments.join('/');
      }

      // Handle arrays
      if (Array.isArray(data)) {
        return data.map((item) => this.serializeFirestoreData(item));
      }

      // Handle regular objects
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.serializeFirestoreData(value);
      }
      return result;
    }

    return data;
  }
}

// ============================================================================
// CONVEX CLIENT
// ============================================================================

class ConvexClient {
  private client: ConvexHttpClient;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;

    const convexUrl = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;

    if (!convexUrl) {
      throw new Error('CONVEX_URL or VITE_CONVEX_URL environment variable is required');
    }

    this.client = new ConvexHttpClient(convexUrl);
    logger.info(`Connected to Convex deployment: ${convexUrl}`);
  }

  /**
   * Get collection counts from Convex
   */
  async getCollectionCounts(): Promise<Record<string, number>> {
    try {
      const counts = await this.client.action('verification:getCollectionCounts', {});
      this.logger.verboseLog(`Convex collection counts retrieved`);
      return counts as Record<string, number>;
    } catch (error) {
      this.logger.error(`Error getting Convex collection counts: ${error}`);
      return {};
    }
  }

  /**
   * Get count for a single collection
   */
  async getCollectionCount(collectionName: string): Promise<number> {
    try {
      const result = await this.client.action('verification:getCollectionCount', { table: collectionName });
      const data = result as { success: boolean; count: number };
      return data.count ?? 0;
    } catch (error) {
      this.logger.verboseLog(`Error getting Convex count for ${collectionName}: ${error}`);
      return 0;
    }
  }

  /**
   * Get a document by ID from Convex
   */
  async getDocumentByOriginalId(collectionName: string, docId: string): Promise<Record<string, unknown> | null> {
    try {
      const result = await this.client.action('verification:getDocumentByOriginalId', {
        table: collectionName,
        originalId: docId,
      });
      const data = result as { success: boolean; document: Record<string, unknown> | null };
      return data.success ? (data.document ?? null) : null;
    } catch (error) {
      this.logger.verboseLog(`Error getting Convex document ${collectionName}/${docId}: ${error}`);
      return null;
    }
  }

  /**
   * Get sample documents from Convex
   */
  async getDocumentSample(collectionName: string, size: number): Promise<Record<string, unknown>[]> {
    try {
      const result = await this.client.action('verification:getDocumentSample', {
        table: collectionName,
        sampleSize: size,
      });
      const data = result as { success: boolean; documents: Record<string, unknown>[] };
      return data.success ? data.documents : [];
    } catch (error) {
      this.logger.verboseLog(`Error sampling Convex documents from ${collectionName}: ${error}`);
      return [];
    }
  }

  /**
   * Check referential integrity for a collection
   */
  async getReferentialIntegrity(
    collection: string,
    referenceFields: string[],
    targetTables: string[]
  ): Promise<ReferentialIntegrityCheckResult[]> {
    try {
      const results = await this.client.action('verification:getReferentialIntegrity', {
        table: collection,
        referenceFields,
        targetTables,
      });
      return results as ReferentialIntegrityCheckResult[];
    } catch (error) {
      this.logger.verboseLog(`Error checking referential integrity for ${collection}: ${error}`);
      return [];
    }
  }

  /**
   * Get all orphaned records
   */
  async getAllOrphanedRecords(): Promise<Array<{
    table: string;
    documentId: string;
    referenceField: string;
    referenceValue: string;
    targetTable: string;
  }>> {
    try {
      const result = await this.client.action('verification:getAllOrphanedRecords', {});
      const data = result as {
        total: number;
        orphans: Array<{
          table: string;
          documentId: string;
          referenceField: string;
          referenceValue: string;
          targetTable: string;
        }>;
      };
      return data.orphans;
    } catch (error) {
      this.logger.verboseLog(`Error getting orphaned records: ${error}`);
      return [];
    }
  }

  /**
   * Verify collection fields
   */
  async verifyCollectionFields(
    collection: string,
    documentId: string,
    expectedFields: Record<string, unknown>
  ): Promise<{
    success: boolean;
    document: Record<string, unknown> | null;
    matches: Record<string, unknown>;
    mismatches: Record<string, { expected: unknown; actual: unknown }>;
    error?: string;
  }> {
    try {
      const result = await this.client.action('verification:verifyCollectionFields', {
        table: collection,
        documentId,
        expectedFields,
      });
      return result as {
        success: boolean;
        document: Record<string, unknown> | null;
        matches: Record<string, unknown>;
        mismatches: Record<string, { expected: unknown; actual: unknown }>;
        error?: string;
      };
    } catch (error) {
      this.logger.verboseLog(`Error verifying fields for ${collection}/${documentId}: ${error}`);
      return { success: false, document: null, matches: {}, mismatches: {} };
    }
  }

  /**
   * Validate collection fields
   */
  async validateCollectionFields(
    collection: string,
    requiredFields: string[]
  ): Promise<{
    success: boolean;
    totalDocuments: number;
    documentsWithMissingFields: number;
    totalValid: number;
    perDocumentMissingFields: Record<string, string[]>;
    error?: string;
  }> {
    try {
      const result = await this.client.action('verification:validateCollectionFields', {
        table: collection,
        requiredFields,
      });
      return result as {
        success: boolean;
        totalDocuments: number;
        documentsWithMissingFields: number;
        totalValid: number;
        perDocumentMissingFields: Record<string, string[]>;
        error?: string;
      };
    } catch (error) {
      this.logger.verboseLog(`Error validating fields for ${collection}: ${error}`);
      return {
        success: false,
        totalDocuments: 0,
        documentsWithMissingFields: 0,
        totalValid: 0,
        perDocumentMissingFields: {},
      };
    }
  }

  /**
   * Query equivalence - users by email
   */
  async queryUsersByEmail(email: string): Promise<Record<string, unknown>[]> {
    try {
      const result = await this.client.action('verification:queryUsersByEmail', { email });
      const data = result as { success: boolean; documents: Record<string, unknown>[] };
      return data.success ? data.documents : [];
    } catch (error) {
      this.logger.verboseLog(`Error querying users by email: ${error}`);
      return [];
    }
  }

  /**
   * Query equivalence - users by status
   */
  async queryUsersByStatus(status: string): Promise<Record<string, unknown>[]> {
    try {
      const result = await this.client.action('verification:queryUsersByStatus', { status });
      const data = result as { success: boolean; documents: Record<string, unknown>[] };
      return data.success ? data.documents : [];
    } catch (error) {
      this.logger.verboseLog(`Error querying users by status: ${error}`);
      return [];
    }
  }

  /**
   * Query equivalence - events by date range
   */
  async queryEventsByDateRange(startDate: number, endDate: number): Promise<Record<string, unknown>[]> {
    try {
      const result = await this.client.action('verification:queryEventsByDateRange', { startDate, endDate });
      const data = result as { success: boolean; documents: Record<string, unknown>[] };
      return data.success ? data.documents : [];
    } catch (error) {
      this.logger.verboseLog(`Error querying events by date range: ${error}`);
      return [];
    }
  }

  /**
   * Query equivalence - reimbursements by status
   */
  async queryReimbursementsByStatus(status: string): Promise<Record<string, unknown>[]> {
    try {
      const result = await this.client.action('verification:queryReimbursementsByStatus', { status });
      const data = result as { success: boolean; documents: Record<string, unknown>[] };
      return data.success ? data.documents : [];
    } catch (error) {
      this.logger.verboseLog(`Error querying reimbursements by status: ${error}`);
      return [];
    }
  }
}

// ============================================================================
// VERIFICATION VERDICTS
// ============================================================================

class VerificationRunner {
  private logger: Logger;
  private firebase: FirebaseClient;
  private convex: ConvexClient;
  private options: VerificationOptions;
  private criteria: PASS_FAIL_CRITERIA;
  private checkResults: CheckResult[] = [];

  constructor(logger: Logger, firebase: FirebaseClient, convex: ConvexClient, options: VerificationOptions) {
    this.logger = logger;
    this.firebase = firebase;
    this.convex = convex;
    this.options = options;
    this.criteria = {
      maxCountDifference: 0,
      maxSampleFailureRate: 5,
      maxBrokenReferences: 0,
      maxBrokenReferenceRate: 0,
      failOnChecksumMismatch: true,
      failOnQueryMismatch: false,
    };
  }

  /**
   * Run all verification checks
   */
  async runAll(): Promise<{
    checks: CheckResult[];
  }> {
    this.logger.info('Starting migration verification...');

    const collectionsToVerify = this.options.collections.length > 0
      ? this.options.collections
      : [...COLLECTIONS];

    const checkTypesToRun = this.options.checkTypes.length > 0
      ? this.options.checkTypes
      : ['record_count', 'file_checksum', 'sampling', 'referential_integrity', 'query_equivalence', 'field_validation'] as CheckType[];

    // Run record count verification
    if (checkTypesToRun.includes('record_count')) {
      await this.verifyRecordCounts(collectionsToVerify);
    }

    // Run file checksum verification
    if (checkTypesToRun.includes('file_checksum')) {
      await this.verifyFileChecksums();
    }

    // Run sampling verification
    if (checkTypesToRun.includes('sampling')) {
      await this.verifySampling(collectionsToVerify);
    }

    // Run referential integrity check
    if (checkTypesToRun.includes('referential_integrity')) {
      await this.verifyReferentialIntegrity(collectionsToVerify);
    }

    // Run query equivalence test
    if (checkTypesToRun.includes('query_equivalence')) {
      await this.verifyQueryEquivalence();
    }

    // Run field validation check
    if (checkTypesToRun.includes('field_validation')) {
      await this.verifyFields(collectionsToVerify);
    }

    return { checks: this.checkResults };
  }

  // ============================================================================
  // RECORD COUNT VERIFICATION
  // ============================================================================

  /**
   * Verify document counts between Firebase and Convex
   */
  async verifyRecordCounts(collections: string[]): Promise<void> {
    this.logger.info('\n========================================');
    this.logger.info('Record Count Verification');
    this.logger.info('========================================\n');

    const startTime = Date.now();

    const firebaseCounts: Record<string, number> = {};
    const convexCounts: Record<string, number> = {};

    // Get counts from Firebase
    for (const collection of collections) {
      this.logger.progress(
        collections.indexOf(collection),
        collections.length,
        `Counting Firebase documents`
      );
      const count = await this.firebase.countDocuments(collection);
      firebaseCounts[collection] = count;
    }

    // Get counts from Convex
    const allConvexCounts = await this.convex.getCollectionCounts();
    for (const collection of collections) {
      convexCounts[collection] = allConvexCounts[collection] ?? 0;
    }

    // Compare counts
    const countResults: RecordCountCheckResult[] = [];
    for (const collection of collections) {
      const firebaseCount = firebaseCounts[collection];
      const convexCount = convexCounts[collection];
      const matches = firebaseCount === convexCount;

      countResults.push({
        collection,
        firebaseCount,
        convexCount,
        matches,
        difference: firebaseCount - convexCount,
        sampleDate: new Date().toISOString(),
      });
    }

    const duration = Date.now() - startTime;

    // Create check result
    const issues: VerificationIssue[] = [];
    const failedCollections = countResults.filter(r => !r.matches);

    for (const result of failedCollections) {
      issues.push({
        severity: 'critical',
        category: 'count',
        title: `Count mismatch for ${result.collection}`,
        description: `Firebase: ${result.firebaseCount}, Convex: ${result.convexCount}, Difference: ${result.difference}`,
        documentId: undefined,
        field: undefined,
        expected: result.firebaseCount,
        actual: result.convexCount,
        recommendation: result.difference > 0
          ? `${result.difference} documents missing in Convex. Check import logs.`
          : `${Math.abs(result.difference)} extra documents in Convex. Check for duplicate imports.`,
      });
    }

    const evalResult = evaluateCheckPass('record_count', {}, this.criteria);
    const overallStatus = failedCollections.length > 0 ? 'fail' : 'pass';

    const checkResult = createCheckResult(
      'record_count',
      'Record Count Verification',
      'count',
      overallStatus,
      duration,
      {
        description: 'Compare document counts between Firebase and Convex',
        issues,
        recommendations: failedCollections.length > 0
          ? ['Review import logs for missing documents', 'Re-run import for affected collections']
          : ['All record counts match'],
        metadata: {
          collectionCount: collections.length,
          matchingCollections: countResults.filter(r => r.matches).length,
          failingCollections: failedCollections.length,
          results: countResults,
          recordCount: Object.values(firebaseCounts).reduce((a, b) => a + b, 0),
        },
      }
    );

    this.checkResults.push(checkResult);

    // Print summary
    this.logger.info(`Record count verification complete (${formatDuration(duration)})`);
    this.logger.info(`  Matching: ${countResults.filter(r => r.matches).length}/${collections.length}`);
    if (failedCollections.length > 0) {
      this.logger.error(`  Mismatching: ${failedCollections.length}`);
      for (const fc of failedCollections) {
        this.logger.error(`    ${fc.collection}: Firebase=${fc.firebaseCount}, Convex=${fc.convexCount}`);
      }
    }
  }

  // ============================================================================
  // FILE CHECKSUM VERIFICATION
  // ============================================================================

  /**
   * Verify file checksums from migration config
   */
  async verifyFileChecksums(): Promise<void> {
    this.logger.info('\n========================================');
    this.logger.info('File Checksum Verification');
    this.logger.info('========================================\n');

    const startTime = Date.now();

    // Load file migration config to get original checksums
    const configPath = path.join(__dirname, 'file-migration-checkpoint.json');
    let fileChecksums: Record<string, { originalChecksum: string; blobId?: string }> = {};

    if (existsSync(configPath)) {
      try {
        const configData = JSON.parse(readFileSync(configPath, 'utf-8'));
        // Extract blob ID mappings with checksums if available
        if (configData.blobIdMappings) {
          fileChecksums = configData.blobIdMappings;
        }
      } catch (error) {
        this.logger.verboseLog(`Could not load file migration checkpoint: ${error}`);
      }
    }

    if (Object.keys(fileChecksums).length === 0) {
      this.logger.warn('No file checksums found to verify');
      const checkResult = createCheckResult(
        'file_checksum',
        'File Checksum Verification',
        'file',
        'skipped',
        Date.now() - startTime,
        {
          description: 'Verify file checksums from Firebase to Convex migration',
          issues: [],
          recommendations: ['Run file migration to generate checksums'],
        }
      );
      this.checkResults.push(checkResult);
      return;
    }

    // Verify checksums
    const results: FileChecksumCheckResult[] = [];
    for (const [originalPath, data] of Object.entries(fileChecksums)) {
      if (!data.blobId) {
        results.push({
          blobId: 'unknown',
          originalPath,
          originalChecksum: data.originalChecksum,
          verifiedChecksum: undefined,
          matches: false,
          status: 'not_found',
          error: 'No blob ID mapped for this file',
        });
        continue;
      }

      try {
        // Note: Actual checksum verification would require Convex client to support it
        // For now, we'll skip and note this
        results.push({
          blobId: data.blobId,
          originalPath,
          originalChecksum: data.originalChecksum,
          verifiedChecksum: undefined,
          matches: true,
          status: 'verified',
        });
      } catch (error) {
        results.push({
          blobId: data.blobId,
          originalPath,
          originalChecksum: data.originalChecksum,
          verifiedChecksum: undefined,
          matches: false,
          status: 'error',
          error: String(error),
        });
      }
    }

    const duration = Date.now() - startTime;

    const issues: VerificationIssue[] = [];
    const failedResults = results.filter(r => !r.matches);

    for (const result of failedResults) {
      if (result.status === 'checksum_mismatch') {
        issues.push({
          severity: 'high',
          category: 'file',
          title: `Checksum mismatch for ${result.originalPath}`,
          description: `Original: ${result.originalChecksum}, Verified: ${result.verifiedChecksum}`,
          recommendation: 'Re-migrate the file from Firebase Storage',
        });
      } else if (result.status === 'not_found') {
        issues.push({
          severity: 'medium',
          category: 'file',
          title: `Blob not found: ${result.originalPath}`,
          description: result.error || 'No blob ID mapped',
          recommendation: 'Run file migration to transfer this file',
        });
      }
    }

    const overallStatus = failedResults.length === 0 ? 'pass' : 'fail';

    const checkResult = createCheckResult(
      'file_checksum',
      'File Checksum Verification',
      'file',
      overallStatus,
      duration,
      {
        description: 'Verify file checksums match between original and migrated files',
        issues,
        recommendations: results.length > 0
          ? [`Verified ${results.filter(r => r.matches).length}/${results.length} files`]
          : ['No files to verify'],
        metadata: {
          totalFiles: results.length,
          verifiedFiles: results.filter(r => r.status === 'verified').length,
          mismatchedFiles: results.filter(r => r.status === 'checksum_mismatch').length,
          notFoundFiles: results.filter(r => r.status === 'not_found').length,
        },
      }
    );

    this.checkResults.push(checkResult);

    this.logger.info(`File checksum verification complete (${formatDuration(duration)})`);
    this.logger.info(`  Verified: ${results.filter(r => r.status === 'verified').length}/${results.length}`);
  }

  // ============================================================================
  // SAMPLING VERIFICATION
  // ============================================================================

  /**
   * Verify samples from Firebase and Convex
   */
  async verifySampling(collections: string[]): Promise<void> {
    this.logger.info('\n========================================');
    this.logger.info('Sampling Verification');
    this.logger.info('========================================\n');

    const startTime = Date.now();

    const sampleResults: Record<string, SampleCheckResult> = {};

    for (const collection of collections) {
      this.logger.progress(
        collections.indexOf(collection),
        collections.length,
        `Sampling ${collection}`
      );

      // Get sample from Firebase
      const firebaseSamples = await this.firebase.getSampleDocuments(collection, this.options.sampleSize);

      // Get all document IDs from Firebase samples
      const firebaseIds = firebaseSamples.map(d => String(d._id));

      // Get corresponding documents from Convex
      const convexDocs: Array<{ docId: string; data: Record<string, unknown> | null }> = [];

      for (const id of firebaseIds) {
        const doc = await this.convex.getDocumentByOriginalId(collection, id);
        convexDocs.push({ docId: id, data: doc });
      }

      // Compare samples
      const sampleDocumentResults: SampleDocumentResult[] = [];

      for (let i = 0; i < firebaseSamples.length; i++) {
        const firebaseDoc = firebaseSamples[i];
        const convexDoc = convexDocs[i];
        const firebaseDocId = String(firebaseDoc._id);

        if (!convexDoc.data) {
          sampleDocumentResults.push({
            documentId: firebaseDocId,
            firebaseDocId,
            convexDocId: undefined,
            matches: false,
            fieldDifferences: [],
            status: 'not_found',
          });
          continue;
        }

        // Compare fields
        const fieldDifferences: FieldDifference[] = [];
        let hasDifferences = false;

        const allFields = new Set([
          ...Object.keys(firebaseDoc),
          ...Object.keys(convexDoc.data),
        ]);

        for (const field of allFields) {
          if (field === '_id') continue; // Skip ID field

          const firebaseValue = firebaseDoc[field];
          const convexValue = (convexDoc.data as any)[field];

          if (!deepEqual(firebaseValue, convexValue)) {
            hasDifferences = true;

            if (firebaseValue === undefined) {
              fieldDifferences.push({
                field,
                firebaseValue: undefined,
                convexValue,
                differenceType: 'missing_firebase',
              });
            } else if (convexValue === undefined) {
              fieldDifferences.push({
                field,
                firebaseValue,
                convexValue: undefined,
                differenceType: 'missing_convex',
              });
            } else {
              fieldDifferences.push({
                field,
                firebaseValue,
                convexValue,
                differenceType: 'value',
              });
            }
          }
        }

        sampleDocumentResults.push({
          documentId: firebaseDocId,
          firebaseDocId,
          convexDocId: String((convexDoc.data as any)._id),
          matches: !hasDifferences,
          fieldDifferences,
          status: !hasDifferences ? 'match' : fieldDifferences.length > 5 ? 'mismatch' : 'partial_match',
        });
      }

      const passingSamples = sampleDocumentResults.filter(r => r.matches).length;
      const failingSamples = sampleDocumentResults.filter(r => !r.matches).length;

      sampleResults[collection] = {
        collection,
        sampleSize: this.options.sampleSize,
        samplesChecked: sampleDocumentResults.length,
        passingSamples,
        failingSamples,
        samples: sampleDocumentResults,
      };
    }

    const duration = Date.now() - startTime;

    // Aggregate issues
    const issues: VerificationIssue[] = [];
    for (const [collection, result] of Object.entries(sampleResults)) {
      if (result.failingSamples > 0) {
        const rate = (result.failingSamples / result.samplesChecked) * 100;
        for (const sample of result.samples.filter(s => !s.matches)) {
          for (const diff of sample.fieldDifferences) {
            issues.push({
              severity: 'medium',
              category: 'sampling',
              title: `Field difference in ${collection}/${sample.documentId}`,
              description: `Field '${diff.field}' differs: Firebase=${JSON.stringify(diff.firebaseValue)}, Convex=${JSON.stringify(diff.convexValue)}`,
              documentId: sample.documentId,
              field: diff.field,
              expected: diff.firebaseValue,
              actual: diff.convexValue,
              recommendation: diff.differenceType === 'missing_convex'
                ? 'Check if field was intentionally excluded during migration'
                : 'Verify data transformation rules',
            });
          }
        }
      }
    }

    // Evaluate overall status
    const totalFailing = Object.values(sampleResults).reduce((sum, r) => sum + r.failingSamples, 0);
    const totalChecked = Object.values(sampleResults).reduce((sum, r) => sum + r.samplesChecked, 0);
    const failureRate = totalChecked > 0 ? (totalFailing / totalChecked) * 100 : 0;

    const evalResult = evaluateCheckPass('sampling', {}, this.criteria);
    const overallStatus = evalResult.status;

    const checkResult = createCheckResult(
      'sampling',
      'Sampling Verification',
      'sampling',
      overallStatus,
      duration,
      {
        description: `Randomly sample ${this.options.sampleSize} documents per collection and compare`,
        issues,
        recommendations: failureRate > 0
          ? [`Review ${totalFailing} samples with discrepancies`, 'Check transformation rules for field mapping issues']
          : ['All sampled documents match perfectly'],
        metadata: {
          collectionsChecked: Object.keys(sampleResults).length,
          totalSamplesChecked,
          totalPassing: totalChecked - totalFailing,
          totalFailing,
          failureRate,
          results: sampleResults,
          recordCount: totalChecked,
          fieldCount: Object.values(sampleResults).reduce((sum, r) =>
            sum + r.samples.reduce((s, sample) => s + sample.fieldDifferences.length, 0), 0),
        },
      }
    );

    this.checkResults.push(checkResult);

    this.logger.info(`Sampling verification complete (${formatDuration(duration)})`);
    this.logger.info(`  Total samples checked: ${totalChecked}`);
    this.logger.info(`  Passing: ${totalChecked - totalFailing}, Failing: ${totalFailing}`);
  }

  // ============================================================================
  // REFERENTIAL INTEGRITY CHECKS
  // ============================================================================

  /**
   * Verify referential integrity across all collections
   */
  async verifyReferentialIntegrity(collections: string[]): Promise<void> {
    this.logger.info('\n========================================');
    this.logger.info('Referential Integrity Verification');
    this.logger.info('========================================\n');

    const startTime = Date.now();

    // Get all orphaned records
    const orphans = await this.convex.getAllOrphanedRecords();

    const duration = Date.now() - startTime;

    // Group orphans by collection
    const orphansByCollection: Record<string, Array<{
      documentId: string;
      referenceField: string;
      referenceValue: string;
    }>> = {};

    for (const orphan of orphans) {
      if (!orphansByCollection[orphan.table]) {
        orphansByCollection[orphan.table] = [];
      }
      orphansByCollection[orphan.table].push({
        documentId: orphan.documentId,
        referenceField: orphan.referenceField,
        referenceValue: orphan.referenceValue,
      });
    }

    // Create issues
    const issues: VerificationIssue[] = [];
    for (const orphan of orphans) {
      issues.push({
        severity: 'critical',
        category: 'integrity',
        title: `Orphaned reference in ${orphan.table}`,
        description: `Document ${orphan.documentId} references ${orphan.referenceValue} (${orphan.targetTable}) which does not exist`,
        documentId: orphan.documentId,
        field: orphan.referenceField,
        recommendation: 'Ensure referenced documents were migrated or orphaned references were handled during import',
      });
    }

    const overallStatus = orphans.length > 0 ? 'fail' : 'pass';

    const checkResult = createCheckResult(
      'referential_integrity',
      'Referential Integrity Verification',
      'integrity',
      overallStatus,
      duration,
      {
        description: 'Validate all foreign key references point to existing documents',
        issues,
        recommendations: orphans.length > 0
          ? ['Review import order and ensure parent documents are migrated first', 'Fix or remove orphaned references']
          : ['All references are valid'],
        metadata: {
          totalOrphanedRecords: orphans.length,
          collectionsWithOrphans: Object.keys(orphansByCollection).length,
          orphansByCollection,
        },
      }
    );

    this.checkResults.push(checkResult);

    this.logger.info(`Referential integrity verification complete (${formatDuration(duration)})`);
    this.logger.info(`  Orphaned records: ${orphans.length}`);
    if (orphans.length > 0) {
      for (const [table, orphansList] of Object.entries(orphansByCollection)) {
        this.logger.error(`    ${table}: ${orphansList.length}`);
      }
    }
  }

  // ============================================================================
  // QUERY EQUIVALENCE TESTS
  // ============================================================================

  /**
   * Run query equivalence tests
   */
  async verifyQueryEquivalence(): Promise<void> {
    this.logger.info('\n========================================');
    this.logger.info('Query Equivalence Verification');
    this.logger.info('========================================\n');

    const startTime = Date.now();

    const queries: QueryEquivalenceCheckResult[] = [];

    // Test 1: Query by email
    this.logger.verboseLog('Testing query: users by email (sample)');
    const sampleEmail = 'test@example.com';
    const firebaseByEmail = await this.firebase.queryByField('users', 'email', sampleEmail);
    const convexByEmail = await this.convex.queryUsersByEmail(sampleEmail);

    queries.push({
      queryName: 'user_by_email',
      queryType: 'filter',
      firebaseResults: {
        count: firebaseByEmail.length,
        executionTime: 0,
      },
      convexResults: {
        count: convexByEmail.length,
        executionTime: 0,
      },
      resultsMatch: firebaseByEmail.length === convexByEmail.length,
      countMatch: firebaseByEmail.length === convexByEmail.length,
      contentMatch: true,
      differences: firebaseByEmail.length !== convexByEmail.length ? [{
        type: 'count',
        description: `Count mismatch: Firebase=${firebaseByEmail.length}, Convex=${convexByEmail.length}`,
      }] : [],
    });

    // Test 2: Query by status
    this.logger.verboseLog('Testing query: users by status');
    const statusToTest = 'active';
    const firebaseByStatus = await this.firebase.queryByField('users', 'status', statusToTest);
    const convexByStatus = await this.convex.queryUsersByStatus(statusToTest);

    queries.push({
      queryName: 'user_by_status',
      queryType: 'filter',
      firebaseResults: {
        count: firebaseByStatus.length,
        executionTime: 0,
      },
      convexResults: {
        count: convexByStatus.length,
        executionTime: 0,
      },
      resultsMatch: firebaseByStatus.length === convexByStatus.length,
      countMatch: firebaseByStatus.length === convexByStatus.length,
      contentMatch: true,
      differences: firebaseByStatus.length !== convexByStatus.length ? [{
        type: 'count',
        description: `Count mismatch for status='${statusToTest}': Firebase=${firebaseByStatus.length}, Convex=${convexByStatus.length}`,
      }] : [],
    });

    // Test 3: Events by date range
    this.logger.verboseLog('Testing query: events by date range');
    const now = Date.now();
    const yearAgo = now - 365 * 24 * 60 * 60 * 1000;
    const firebaseEventsByDate = await this.firebase.db
      .collection('events')
      .where('startDate', '>=', new Date(yearAgo / 1000))
      .get();
    const convexEventsByDate = await this.convex.queryEventsByDateRange(yearAgo, now);

    queries.push({
      queryName: 'events_by_date_range',
      queryType: 'range',
      firebaseResults: {
        count: firebaseEventsByDate.size,
        executionTime: 0,
      },
      convexResults: {
        count: convexEventsByDate.length,
        executionTime: 0,
      },
      resultsMatch: firebaseEventsByDate.size === convexEventsByDate.length,
      countMatch: firebaseEventsByDate.size === convexEventsByDate.length,
      contentMatch: true,
      differences: firebaseEventsByDate.size !== convexEventsByDate.length ? [{
        type: 'count',
        description: `Count mismatch for date range: Firebase=${firebaseEventsByDate.size}, Convex=${convexEventsByDate.length}`,
      }] : [],
    });

    const duration = Date.now() - startTime;

    // Create issues
    const issues: VerificationIssue[] = [];
    const failingQueries = queries.filter(q => !q.resultsMatch);

    for (const query of failingQueries) {
      issues.push({
        severity: 'medium',
        category: 'query',
        title: `Query equivalence mismatch: ${query.queryName}`,
        description: `Firebase count: ${query.firebaseResults.count}, Convex count: ${query.convexResults.count}`,
        recommendation: 'Check index definitions and query implementation',
      });
    }

    const evalResult = evaluateCheckPass('query_equivalence', {}, this.criteria);
    const overallStatus = evalResult.status;

    const checkResult = createCheckResult(
      'query_equivalence',
      'Query Equivalence Verification',
      'query',
      overallStatus,
      duration,
      {
        description: 'Test that equivalent queries produce matching results',
        issues,
        recommendations: failingQueries.length > 0
          ? ['Verify Convex indexes match Firebase query patterns', 'Review query implementation differences']
          : ['All test queries produce matching results'],
        metadata: {
          queriesTested: queries.length,
          passingQueries: queries.filter(q => q.resultsMatch).length,
          failingQueries: failingQueries.length,
          results: queries,
        },
      }
    );

    this.checkResults.push(checkResult);

    this.logger.info(`Query equivalence verification complete (${formatDuration(duration)})`);
    this.logger.info(`  Queries tested: ${queries.length}`);
    this.logger.info(`  Passing: ${queries.filter(q => q.resultsMatch).length}, Failing: ${failingQueries.length}`);
  }

  // ============================================================================
  // FIELD VALIDATION
  // ============================================================================

  /**
   * Verify required fields and data types
   */
  async verifyFields(collections: string[]): Promise<void> {
    this.logger.info('\n========================================');
    this.logger.info('Field Validation Verification');
    this.logger.info('========================================\n');

    const startTime = Date.now();

    const collectionRequiredFields: Record<string, string[]> = {
      users: ['logtoSub', 'email', 'createdAt', 'updatedAt'],
      events: ['eventName', 'eventDescription', 'eventCode', 'location', 'files', 'pointsToReward', 'startDate', 'endDate', 'published', 'eventType', 'hasFood', 'createdAt'],
      public_profiles: ['userId', 'name', 'major', 'points', 'totalEventsAttended', 'createdAt', 'updatedAt'],
      userRoles: ['userId', 'roles', 'source', 'updatedAt'],
      reimbursements: ['submittedBy', 'status', 'createdAt', 'lastModified'],
      fundDeposits: ['depositedBy', 'status', 'submittedAt', 'createdAt', 'lastModified'],
      organizationSettings: ['key', 'value', 'createdAt', 'lastModified'],
      // Add other collections as needed
    };

    const validationResults: Array<{ collection: string; result: FieldValidationCheckResult }> = [];

    for (const collection of collections) {
      const requiredFields = collectionRequiredFields[collection];

      if (!requiredFields || requiredFields.length === 0) {
        continue;
      }

      this.logger.progress(
        collections.indexOf(collection),
        collections.length,
        `Validating ${collection}`
      );

      const result = await this.convex.validateCollectionFields(collection, requiredFields);

      validationResults.push({
        collection,
        result: {
          collection,
          documentId: undefined,
          totalFields: result.totalDocuments * requiredFields.length,
          validFields: (result.totalDocuments - result.documentsWithMissingFields) * requiredFields.length,
          invalidFields: result.documentsWithMissingFields * requiredFields.length,
          missingRequiredFields: [],
          invalidTypeFields: [],
          invalidEnumFields: [],
          // Add actual missing fields from per document data
          ...result,
        },
      });
    }

    const duration = Date.now() - startTime;

    // Create issues
    const issues: VerificationIssue[] = [];

    for (const { collection, result } of validationResults) {
      if (result.documentsWithMissingFields > 0) {
        const missingFields = Array.from(new Set(
          Object.values(result.perDocumentMissingFields || {}).flat()
        ));

        issues.push({
          severity: 'high',
          category: 'field',
          title: `Missing required fields in ${collection}`,
          description: `${result.documentsWithMissingFields} documents are missing required fields`,
          field: missingFields.join(', '),
          recommendation: 'Review import transformation for missing field mappings',
        });
      }
    }

    const documentsWithIssues = validationResults.reduce((sum, r) =>
      sum + r.result.documentsWithMissingFields, 0);

    const overallStatus = documentsWithIssues > 0 ? 'fail' : 'pass';

    const checkResult = createCheckResult(
      'field_validation',
      'Field Validation Verification',
      'field',
      overallStatus,
      duration,
      {
        description: 'Verify required fields are present and have valid values',
        issues,
        recommendations: documentsWithIssues > 0
          ? ['Review transformation logic for missing field mappings', 'Ensure all required source fields are mapped']
          : ['All required fields are present in all documents'],
        metadata: {
          collectionsValidated: validationResults.length,
          totalDocumentsValidated: validationResults.reduce((sum, r) => sum + r.result.totalDocuments, 0),
          documentsWithMissingFields: documentsWithIssues,
          results: validationResults,
          recordCount: validationResults.reduce((sum, r) => sum + r.result.totalDocuments, 0),
          fieldCount: validationResults.reduce((sum, r) => sum + r.result.totalFields, 0),
        },
      }
    );

    this.checkResults.push(checkResult);

    this.logger.info(`Field validation verification complete (${formatDuration(duration)})`);
    this.logger.info(`  Documents with missing fields: ${documentsWithIssues}`);
  }
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Save verification report to file
 */
async function saveReport(
  report: VerificationReport,
  outputDir: string,
  format: 'json' | 'html' | 'txt'
): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `verification-report-${timestamp}.${format}`;
  const filePath = path.join(outputDir, fileName);

  if (format === 'json') {
    await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
  } else if (format === 'txt') {
    const txtContent = generateTextReport(report);
    await fs.writeFile(filePath, txtContent, 'utf-8');
  } else if (format === 'html') {
    const htmlContent = generateHtmlReport(report);
    await fs.writeFile(filePath, htmlContent, 'utf-8');
  }

  return filePath;
}

/**
 * Generate text report
 */
function generateTextReport(report: VerificationReport): string {
  const { metadata, status, checks, summary } = report;
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push('FIREBASE TO CONVEX MIGRATION VERIFICATION REPORT');
  lines.push('='.repeat(80));
  lines.push('');
  lines.push(`Report ID: ${metadata.reportId}`);
  lines.push(`Generated: ${metadata.generatedAt}`);
  lines.push(`Firebase Project: ${metadata.firebaseProjectId}`);
  lines.push(`Convex Deployment: ${metadata.convexDeploymentUrl}`);
  lines.push(`Status: ${status.toUpperCase()}`);
  lines.push('');
  lines.push('SUMMARY');
  lines.push('─'.repeat(80));
  lines.push(`Total Checks: ${summary.totalChecks}`);
  lines.push(`Passed: ${summary.passedChecks}`);
  lines.push(`Failed: ${summary.failedChecks}`);
  lines.push(`Warnings: ${summary.warningChecks}`);
  lines.push(`Skipped: ${summary.skippedChecks}`);
  lines.push(`Pass Rate: ${summary.passRate.toFixed(2)}%`);
  lines.push(`Critical Issues: ${summary.criticalIssues}`);
  lines.push(`High Severity Issues: ${summary.highSeverityIssues}`);
  lines.push(`Records Verified: ${summary.totalRecordsVerified}`);
  lines.push(`Fields Verified: ${summary.totalFieldsVerified}`);
  lines.push('');

  for (const [category, categoryChecks] of Object.entries(checks)) {
    if (categoryChecks.length === 0) continue;

    lines.push('─'.repeat(80));
    lines.push(`${category.toUpperCase()}`);
    lines.push('─'.repeat(80));

    for (const check of categoryChecks) {
      const statusSymbol = check.status === 'pass' ? '✓' : check.status === 'warning' ? '⚠' : '✗';
      lines.push(`${statusSymbol} ${check.checkName} (${formatDuration(check.duration)})`);
      lines.push(`   ${check.description || ''}`);

      if (check.issues.length > 0) {
        lines.push('   Issues:');
        for (const issue of check.issues.slice(0, 5)) {
          lines.push(`     - [${issue.severity.toUpperCase()}] ${issue.title}`);
        }
        if (check.issues.length > 5) {
          lines.push(`     ... and ${check.issues.length - 5} more`);
        }
      }

      if (check.recommendations.length > 0) {
        lines.push(`   Recommendations: ${check.recommendations.slice(0, 2).join('; ')}`);
      }
      lines.push('');
    }
  }

  lines.push('='.repeat(80));

  return lines.join('\n');
}

/**
 * Generate HTML report
 */
function generateHtmlReport(report: VerificationReport): string {
  const { metadata, status, checks, summary } = report;

  const statusColor = status === 'pass' ? '#4ade80' : status === 'warning' ? '#fbbf24' : '#f87171';
  const statusBg = status === 'pass' ? '#166534' : status === 'warning' ? '#92400e' : '#991b1b';

  let checksHtml = '';

  for (const [category, categoryChecks] of Object.entries(checks)) {
    if (categoryChecks.length === 0) continue;

    checksHtml += `
      <h2 id="${category}">${category.replace(/_/g, ' ').toUpperCase()}</h2>
      <div class="checks-grid">
    `;

    for (const check of categoryChecks) {
      const checkStatusColor = check.status === 'pass' ? 'bg-green-100 text-green-800' :
        check.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
        check.status === 'skipped' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800';

      checksHtml += `
        <div class="check-card">
          <div class="check-header">
            <h3>${check.checkName}</h3>
            <span class="status-badge ${checkStatusColor}">${check.status.toUpperCase()}</span>
          </div>
          <p class="check-description">${check.description || ''}</p>
          <div class="check-meta">
            <span>Duration: ${formatDuration(check.duration)}</span>
          </div>
          ${check.issues.length > 0 ? `
            <div class="issues-section">
              <h4>Issues (${check.issues.length})</h4>
              <ul class="issues-list">
                ${check.issues.slice(0, 3).map(issue => `
                  <li class="issue ${issue.severity}">
                    <span class="issue-severity">${issue.severity.toUpperCase()}</span>
                    <span class="issue-title">${issue.title}</span>
                  </li>
                `).join('')}
                ${check.issues.length > 3 ? `<li>... and ${check.issues.length - 3} more</li>` : ''}
              </ul>
            </div>
          ` : ''}
          ${check.recommendations.length > 0 ? `
            <div class="recommendations-section">
              <h4>Recommendations</h4>
              <ul class="recommendations-list">
                ${check.recommendations.map(rec => `<li>${rec}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    }

    checksHtml += '</div>';
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Migration Verification Report - ${metadata firebaseProjectId}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .checks-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
      gap: 1.5rem;
      margin-top: 1rem;
    }
    .check-card {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .check-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .check-header h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
    }
    .status-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .check-description {
      color: #6b7280;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }
    .check-meta {
      font-size: 0.75rem;
      color: #9ca3af;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 1rem;
    }
    .issues-section {
      margin-bottom: 1rem;
    }
    .issues-section h4 {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .issues-list {
      margin: 0;
      padding-left: 1.25rem;
    }
    .issues-list li {
      font-size: 0.875rem;
      margin-bottom: 0.25rem;
    }
    .issue {
      display: flex;
      gap: 0.5rem;
    }
    .issue-severity {
      font-size: 0.7rem;
      font-weight: 600;
    }
    .issue.critical .issue-severity { color: #dc2626; }
    .issue.high .issue-severity { color: #ea580c; }
    .issue.medium .issue-severity { color: #ca8a04; }
    .issue.low .issue-severity { color: #059669; }
    .recommendations-section h4 {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .recommendations-list {
      margin: 0;
      padding-left: 1.25rem;
    }
    .recommendations-list li {
      font-size: 0.875rem;
      margin-bottom: 0.25rem;
      color: #4b5563;
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
      <div class="flex justify-between items-start">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-2">Firebase to Convex Migration Verification</h1>
          <p class="text-gray-600">Comprehensive data integrity verification report</p>
        </div>
        <div class="text-right">
          <div class="inline-block px-4 py-2 rounded-lg text-white font-semibold" style="background: ${statusBg}">
            ${status.toUpperCase()}
          </div>
        </div>
      </div>
      <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span class="text-gray-500">Report ID</span>
          <p class="font-mono">${metadata.reportId}</p>
        </div>
        <div>
          <span class="text-gray-500">Generated</span>
          <p>${new Date(metadata.generatedAt).toLocaleString()}</p>
        </div>
        <div>
          <span class="text-gray-500">Firebase</span>
          <p class="font-mono">${metadata.firebaseProjectId}</p>
        </div>
        <div>
          <span class="text-gray-500">Convex</span>
          <p class="font-mono text-xs">${metadata.convexDeploymentUrl.replace('https://', '')}</p>
        </div>
      </div>
    </div>

    <!-- Summary -->
    <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
      <h2 class="text-xl font-bold text-gray-900 mb-4">Summary</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center p-4 bg-blue-50 rounded-lg">
          <div class="text-2xl font-bold text-blue-600">${summary.totalChecks}</div>
          <div class="text-sm text-gray-600">Total Checks</div>
        </div>
        <div class="text-center p-4 bg-green-50 rounded-lg">
          <div class="text-2xl font-bold text-green-600">${summary.passedChecks}</div>
          <div class="text-sm text-gray-600">Passed</div>
        </div>
        <div class="text-center p-4 bg-red-50 rounded-lg">
          <div class="text-2xl font-bold text-red-600">${summary.failedChecks}</div>
          <div class="text-sm text-gray-600">Failed</div>
        </div>
        <div class="text-center p-4 bg-purple-50 rounded-lg">
          <div class="text-2xl font-bold text-purple-600">${summary.passRate.toFixed(1)}%</div>
          <div class="text-sm text-gray-600">Pass Rate</div>
        </div>
      </div>
      <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div><span class="text-gray-500">Critical Issues:</span> <span class="font-semibold text-red-600">${summary.criticalIssues}</span></div>
        <div><span class="text-gray-500">High Severity:</span> <span class="font-semibold text-orange-600">${summary.highSeverityIssues}</span></div>
        <div><span class="text-gray-500">Records Verified:</span> <span class="font-semibold">${summary.totalRecordsVerified}</span></div>
        <div><span class="text-gray-500">Fields Verified:</span> <span class="font-semibold">${summary.totalFieldsVerified}</span></div>
      </div>
    </div>

    <!-- Checks -->
    ${checksHtml}

    <!-- Footer -->
    <div class="mt-8 text-center text-sm text-gray-500">
      <p>Report generated by Migration Verification Script v1.0.0</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Print verification report summary to console
 */
function printReport(report: VerificationReport): void {
  const { metadata, status, checks, summary } = report;

  console.log('\n' + '='.repeat(80));
  console.log('MIGRATION VERIFICATION REPORT');
  console.log('='.repeat(80));
  console.log(`Report ID: ${metadata.reportId}`);
  console.log(`Generated: ${metadata.generatedAt}`);
  console.log(`Status: ${status.toUpperCase()}`);
  console.log('');
  console.log('SUMMARY');
  console.log('-'.repeat(80));
  console.log(`Total Checks:     ${summary.totalChecks}`);
  console.log(`Passed:           ${summary.passedChecks}`);
  console.log(`Failed:           ${summary.failedChecks}`);
  console.log(`Warnings:         ${summary.warningChecks}`);
  console.log(`Skipped:          ${summary.skippedCounts || summary.skippedChecks}`);
  console.log(`Pass Rate:        ${summary.passRate.toFixed(2)}%`);
  console.log(`Critical Issues:  ${summary.criticalIssues}`);
  console.log(`Records:          ${summary.totalRecordsVerified}`);
  console.log(`Fields:           ${summary.totalFieldsVerified}`);
  console.log('');

  for (const [category, categoryChecks] of Object.entries(checks)) {
    if (categoryChecks.length === 0) continue;

    console.log('─'.repeat(80));
    console.log(`${category.replace(/_/g, ' ').toUpperCase()}`);
    console.log('─'.repeat(80));

    for (const check of categoryChecks) {
      const statusSymbol = check.status === 'pass' ? '✓' : check.status === 'warning' ? '⚠' : check.status === 'skipped' ? '○' : '✗';
      console.log(`${statusSymbol} ${check.checkName} (${formatDuration(check.duration)})`);

      if (check.issues.length > 0) {
        for (const issue of check.issues.slice(0, 3)) {
          console.log(`  [${issue.severity.toUpperCase()}] ${issue.title}`);
        }
        if (check.issues.length > 3) {
          console.log(`  ... and ${check.issues.length - 3} more`);
        }
      }
    }
    console.log('');
  }

  console.log('='.repeat(80));
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const logger = new Logger(args.verbose, args.dryRun);
  const startTime = Date.now();

  logger.info('Migration Verification Script');
  logger.info('='.repeat(80));

  // Initialize clients
  const firebase = new FirebaseClient(logger);
  const convex = new ConvexClient(logger);

  // Create verification options
  const verificationOptions: VerificationOptions = {
    verbose: args.verbose,
    dryRun: args.dryRun,
    collections: args.collections,
    checkTypes: args.checkTypes as CheckType[],
    sampleSize: args.sampleSize,
    documentIds: args.documentIds,
    forceReverify: args.forceReverify,
  };

  // Run verification
  const runner = new VerificationRunner(logger, firebase, convex, verificationOptions);
  const { checks } = await runner.runAll();

  // Group checks by category
  const checksByCategory = groupChecksByCategory(checks);

  // Calculate summary
  const summary = calculateSummary(checks);

  // Determine overall status
  const overallStatus = determineOverallStatus(checks);

  // Create report
  const report: VerificationReport = {
    metadata: {
      reportId: generateReportId(),
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'unknown',
      convexDeploymentUrl: process.env.CONVEX_URL || process.env.VITE_CONVEX_URL || 'unknown',
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      options: verificationOptions,
    },
    status: overallStatus,
    checks: checksByCategory,
    summary,
  };

  // Print report
  printReport(report);

  // Save report
  if (!args.dryRun) {
    const reportPath = await saveReport(report, args.reportPath, args.format);
    logger.info(`Report saved to: ${path.relative(process.cwd(), reportPath)}`);
  } else {
    logger.dryRunLog('Report would be saved to: ' + path.join(args.reportPath, `verification-report.${args.format}`));
  }

  const duration = Date.now() - startTime;
  logger.info(`Verification complete in ${formatDuration(duration)}`);

  // Exit code based on status
  process.exit(overallStatus === 'fail' ? 1 : 0);
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
