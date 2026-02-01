#!/usr/bin/env npx tsx

/**
 * Firestore Export Script
 *
 * Exports all 15 Firestore collections to JSON/NDJSON format for migration to Convex.
 *
 * Collections exported:
 * - users
 * - events (with attendees subcollection)
 * - event_requests
 * - reimbursements
 * - fundDeposits
 * - public_profiles
 * - officerInvitations
 * - sponsorDomains
 * - links
 * - constitutions (with sections, auditLog subcollections)
 * - notifications
 * - googleGroupAssignments
 * - directOnboardings
 * - invites
 * - organizationSettings
 *
 * Usage:
 *   npx tsx scripts/migrate/export-firestore.ts
 *   npx tsx scripts/migrate/export-firestore.ts --dry-run
 *   npx tsx scripts/migrate/export-firestore.ts --collection users
 *   npx tsx scripts/migrate/export-firestore.ts --verbose
 *
 * Environment Variables:
 *   FIREBASE_PROJECT_ID: Firebase project ID
 *   FIREBASE_PRIVATE_KEY: Service account private key (or use GOOGLE_APPLICATION_CREDENTIALS)
 *   FIREBASE_CLIENT_EMAIL: Service account client email
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
// @ts-ignore firebase-admin types
import { initializeApp, cert } from 'firebase-admin/app';
// @ts-ignore firebase-admin types
import { getFirestore } from 'firebase-admin/firestore';

// ============================================================================
// CONFIGURATION
// ============================================================================

const OUTPUT_DIR = path.join(__dirname, 'exported');
const BATCH_SIZE = 500;
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Parse --collection argument
const COLLECTION_ARG = process.argv.find(arg => arg.startsWith('--collection='));
const SELECTED_COLLECTIONS = COLLECTION_ARG
  ? [COLLECTION_ARG.split('=')[1]]
  : undefined;

// ============================================================================
// COLLECTION CONFIGURATION
// ============================================================================

interface CollectionConfig {
  name: string;
  fileName: string;
  hasSubcollections: boolean;
  subcollections?: string[];
}

const COLLECTIONS: readonly CollectionConfig[] = [
  { name: 'users', fileName: 'users.json', hasSubcollections: false },
  { name: 'events', fileName: 'events.json', hasSubcollections: true, subcollections: ['attendees'] },
  { name: 'event_requests', fileName: 'event_requests.json', hasSubcollections: false },
  { name: 'reimbursements', fileName: 'reimbursements.json', hasSubcollections: false },
  { name: 'fundDeposits', fileName: 'fundDeposits.json', hasSubcollections: false },
  { name: 'public_profiles', fileName: 'public_profiles.json', hasSubcollections: false },
  { name: 'officerInvitations', fileName: 'officerInvitations.json', hasSubcollections: false },
  { name: 'sponsorDomains', fileName: 'sponsorDomains.json', hasSubcollections: false },
  { name: 'links', fileName: 'links.json', hasSubcollections: false },
  {
    name: 'constitutions',
    fileName: 'constitutions.json',
    hasSubcollections: true,
    subcollections: ['sections', 'auditLog'],
  },
  { name: 'notifications', fileName: 'notifications.json', hasSubcollections: false },
  { name: 'googleGroupAssignments', fileName: 'googleGroupAssignments.json', hasSubcollections: false },
  { name: 'directOnboardings', fileName: 'directOnboardings.json', hasSubcollections: false },
  { name: 'invites', fileName: 'invites.json', hasSubcollections: false },
  { name: 'organizationSettings', fileName: 'organizationSettings.json', hasSubcollections: false },
] as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Logs a debug message if verbose mode is enabled
 */
function debug(message: string): void {
  if (VERBOSE) {
    console.log(`[DEBUG] ${message}`);
  }
}

/**
 * Logs a progress message
 */
function log(message: string): void {
  console.log(`[INFO] ${message}`);
}

/**
 * Logs a warning message
 */
function warn(message: string): void {
  console.warn(`[WARN] ${message}`);
}

/**
 * Logs an error message
 */
function error(message: string): void {
  console.error(`[ERROR] ${message}`);
}

/**
 * Serializes Firestore data for JSON export
 * Converts Firestore Timestamps to ISO strings and DocumentReferences to paths
 */
function serializeFirestoreData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    // Handle Firestore Timestamp
    if (
      '_seconds' in obj &&
      '_nanoseconds' in obj &&
      Object.keys(obj).length === 2
    ) {
      const timestamp = obj as { _seconds: number; _nanoseconds: number };
      return new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1_000_000).toISOString();
    }

    // Handle DocumentReference - convert to path string
    if ('_firestore' in obj && '_path' in obj) {
      try {
        // @ts-ignore DocumentReference type
        return obj.path as string;
      } catch {
        return (obj as { _path: { segments: string[] } })._path.segments.join('/');
      }
    }

    // Handle GeoPoint
    if ('_latitude' in obj && '_longitude' in obj && Object.keys(obj).length === 2) {
      return { latitude: obj._latitude as number, longitude: obj._longitude as number };
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(serializeFirestoreData);
    }

    // Handle regular objects
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeFirestoreData(value);
    }
    return result;
  }

  return data;
}

/**
 * Serializes a Firestore document with its ID included
 */
function serializeDocument(docId: string, data: Record<string, unknown>): Record<string, unknown> {
  return {
    _id: docId,
    ...serializeFirestoreData(data),
  };
}

/**
 * Serializes a subcollection document with parent reference
 */
function serializeSubcollectionDocument(
  parentId: string,
  parentCollection: string,
  docId: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    _id: docId,
    _parentId: parentId,
    _parentCollection: parentCollection,
    ...serializeFirestoreData(data),
  };
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

interface ExportResult {
  collection: string;
  success: boolean;
  documentCount: number;
  subcollectionCounts?: Record<string, number>;
  error?: string;
  duration: number;
}

/**
 * Export documents from a Firestore collection with pagination
 */
async function exportCollection(
  db: import('firebase-admin/firestore').Firestore,
  collectionName: string,
  config: CollectionConfig
): Promise<ExportResult> {
  const startTime = Date.now();
  const result: ExportResult = {
    collection: collectionName,
    success: true,
    documentCount: 0,
    subcollectionCounts: {},
    duration: 0,
  };

  if (!SELECTED_COLLECTIONS || SELECTED_COLLECTIONS.includes(collectionName)) {
    try {
      log(`Exporting collection: ${collectionName}`);
      debug(`Reading from Firestore: ${collectionName}`);

      const documents: Record<string, unknown>[] = [];
      let lastDoc: import('firebase-admin/firestore').QueryDocumentSnapshot | null = null;
      let hasMore = true;
      let totalProcessed = 0;

      // Paginated read to handle large collections
      while (hasMore) {
        let query = db.collection(collectionName).orderBy('__name__').limit(BATCH_SIZE);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const snapshot = await query.get();
        debug(`Batch: ${snapshot.size} documents`);

        for (const doc of snapshot.docs) {
          const serializedDoc = serializeDocument(doc.id, doc.data());
          documents.push(serializedDoc);
          lastDoc = doc;
        }

        totalProcessed += snapshot.size;
        hasMore = snapshot.size === BATCH_SIZE;
      }

      result.documentCount = documents.length;
      log(`Exported ${documents.length} documents from ${collectionName}`);

      // Export subcollections if any
      if (config.hasSubcollections && config.subcollections && !DRY_RUN) {
        const limit = Math.min(documents.length, 10); // Limit subcollection export for initial testing

        for (let i = 0; i < Math.min(documents.length, limit); i++) {
          const doc = documents[i] as { _id: string };
          const parentId = doc._id as string;

          for (const subcollectionName of config.subcollections) {
            const subcollectionPath = `${collectionName}/${parentId}/${subcollectionName}`;
            debug(`Checking subcollection: ${subcollectionPath}`);

            const subSnapshot = await db.collection(subcollectionPath).get();

            if (!subSnapshot.empty) {
              if (!result.subcollectionCounts![subcollectionName]) {
                result.subcollectionCounts![subcollectionName] = 0;
              }

              const subDocs: Record<string, unknown>[] = [];

              for (const subDoc of subSnapshot.docs) {
                const serializedSubDoc = serializeSubcollectionDocument(
                  parentId,
                  collectionName,
                  subDoc.id,
                  subDoc.data()
                );
                subDocs.push(serializedSubDoc);
                result.subcollectionCounts![subcollectionName]++;
              }

              debug(`Exported ${subDocs.length} documents from ${subcollectionPath}`);

              // Write subcollection to JSON file
              const subcollectionFileName = `${collectionName}-${subcollectionName}.json`;
              const subcollectionFilePath = path.join(OUTPUT_DIR, subcollectionFileName);
              const subData = { _meta: { collection: subcollectionName, parentCollection: collectionName }, documents: subDocs };

              await fs.writeFile(subcollectionFilePath, JSON.stringify(subData, null, 2), 'utf-8');
              log(`   -> Subcollection exported to: ${subcollectionFileName} (${subDocs.length} documents)`);
            }
          }
        }
      }

      // Write main collection to JSON file
      if (!DRY_RUN) {
        const filePath = path.join(OUTPUT_DIR, config.fileName);
        const exportData = {
          _meta: {
            collection: collectionName,
            exportedAt: new Date().toISOString(),
            documentCount: documents.length,
            subcollections: config.subcollections || [],
            hasSubCollections: config.hasSubcollections,
          },
          documents,
        };

        await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
        log(`   -> Saved to: ${config.fileName}`);

        if (config.hasSubcollections && result.subcollectionCounts !== undefined) {
          const subSummary = Object.entries(result.subcollectionCounts!)
            .map(([name, count]) => `${name}: ${count}`)
            .join(', ');
          if (subSummary) {
            log(`   -> Subcollections: ${subSummary}`);
          }
        }
      } else {
        log(`   -> [DRY RUN] Would save ${documents.length} documents to ${config.fileName}`);
      }
    } catch (err) {
      result.success = false;
      result.error = err instanceof Error ? err.message : String(err);
      error(`Failed to export ${collectionName}: ${result.error}`);
    }
  } else {
    log(`Skipping ${collectionName} (not in selected collections)`);
  }

  result.duration = Date.now() - startTime;
  return result;
}

/**
 * Generate an export report
 */
interface ExportReport {
  totalCollections: number;
  successfulExports: number;
  failedExports: number;
  skippedExports: number;
  totalDocuments: number;
  totalSubcollectionDocuments: number;
  results: ExportResult[];
  duration: number;
  startTime: string;
  endTime: string;
  dryRun: boolean;
}

function generateReport(results: ExportResult[], startTime: number, endTime: number): ExportReport {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const skipped = results.filter(r => r.documentCount === 0 && r.success);
  const totalDocuments = successful.reduce((sum, r) => sum + r.documentCount, 0);
  const totalSubcollectionDocs = successful.reduce(
    (sum, r) =>
      sum + Object.values(r.subcollectionCounts || {}).reduce((s, count) => s + count, 0),
    0
  );

  return {
    totalCollections: results.length,
    successfulExports: successful.length,
    failedExports: failed.length,
    skippedExports: skipped.length,
    totalDocuments,
    totalSubcollectionDocuments: totalSubcollectionDocs,
    results,
    duration: endTime - startTime,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    dryRun: DRY_RUN,
  };
}

/**
 * Print the export report
 */
function printReport(report: ExportReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('FIRESTORE EXPORT REPORT');
  console.log('='.repeat(80));
  console.log(`Dry Run: ${report.dryRun ? 'YES' : 'NO'}`);
  console.log(`Start Time: ${report.startTime}`);
  console.log(`End Time: ${report.endTime}`);
  console.log(`Duration: ${(report.duration / 1000).toFixed(2)}s`);
  console.log('');
  console.log(`Total Collections: ${report.totalCollections}`);
  console.log(`Successful: ${report.successfulExports}`);
  console.log(`Failed: ${report.failedExports}`);
  console.log(`Skipped: ${report.skippedExports}`);
  console.log(`Total Documents: ${report.totalDocuments}`);
  console.log(`Total Subcollection Documents: ${report.totalSubcollectionDocuments}`);
  console.log('');
  console.log('Collection Details:');
  console.log('-'.repeat(80));

  for (const result of report.results) {
    const status = result.success ? '✓' : '✗';
    const duration = (result.duration / 1000).toFixed(2);
    const subInfo =
      result.subcollectionCounts && Object.keys(result.subcollectionCounts).length > 0
        ? Object.entries(result.subcollectionCounts)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
        : '';

    console.log(
      `${status} ${result.collection}: ${result.documentCount} documents (${duration}s)${
        subInfo ? ` [${subInfo}]` : ''
      }${result.error ? ` - ERROR: ${result.error}` : ''}`
    );
  }

  console.log('='.repeat(80));
}

/**
 * Ensure the output directory exists
 */
async function ensureOutputDirectory(): Promise<void> {
  if (!existsSync(OUTPUT_DIR)) {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    debug(`Created output directory: ${OUTPUT_DIR}`);
  }
}

/**
 * Initialize Firebase Admin SDK
 */
function initializeFirebaseAdmin(): import('firebase-admin/app').App {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID environment variable is required');
  }

  let credentials;

  if (privateKey && clientEmail) {
    // Use individual environment variables
    credentials = cert({
      projectId,
      privateKey,
      clientEmail,
    });
  } else if (credentialsPath) {
    // Use service account file
    credentials = cert(credentialsPath);
  } else if (projectId.endsWith('-firebaseapp.com') || projectId.endsWith('.firebaseio.com')) {
    // Try to auto-detect credentials from ADC
    credentials = undefined;
  } else {
    throw new Error(
      'Firebase credentials required. Set FIREBASE_PRIVATE_KEY and FIREBASE_CLIENT_EMAIL, or GOOGLE_APPLICATION_CREDENTIALS'
    );
  }

  const config = {
    projectId,
    credential: credentials,
  };

  return initializeApp(config);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  const startTime = Date.now();

  log('Firestore Export Script - Phase 2: Export to Convex');
  log('='.repeat(80));

  if (DRY_RUN) {
    warn('DRY RUN MODE - No files will be written');
  }

  if (SELECTED_COLLECTIONS) {
    log(`Selected collections: ${SELECTED_COLLECTIONS.join(', ')}`);
  }

  try {
    // Initialize Firebase
    log('Initializing Firebase Admin SDK...');
    const app = initializeFirebaseAdmin();
    const db = getFirestore(app);
    log('Firebase initialized successfully');

    // Ensure output directory exists
    await ensureOutputDirectory();

    // Export all collections
    const results: ExportResult[] = [];

    for (const config of COLLECTIONS) {
      const result = await exportCollection(db, config.name, config);
      results.push(result);
    }

    // Generate and print report
    const report = generateReport(results, startTime, Date.now());
    printReport(report);

    // Save report to JSON
    if (!DRY_RUN) {
      const reportPath = path.join(OUTPUT_DIR, 'export-report.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
      log(`Export report saved to: ${path.relative(process.cwd(), reportPath)}`);
    }

    // Exit with appropriate code
    if (report.failedExports > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
    if (VERBOSE && err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Run the script
main();
