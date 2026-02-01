import { v4 as uuidv4 } from 'uuid';
import {
  getFirestore,
  initializeFirebaseFromEnv,
  convertTimestampsToIso,
  type FirebaseConfig,
  getStorage,
} from '../migration/firebase-client';
import type {
  CollectionReference,
  QueryDocumentSnapshot,
} from '@firebase/firestore-types';

/**
 * Exported document structure with _id and converted data.
 */
export interface ExportedDocument {
  _id: string;
  [key: string]: unknown;
}

/**
 * Exported collection structure.
 */
export interface ExportedCollection {
  collection: string;
  documents: ExportedDocument[];
}

/**
 * Exported storage file with metadata.
 */
export interface ExportedStorageFile {
  name: string;
  size: number;
  contentType: string | null;
  timeCreated: string;
  updated: string;
  downloadUrl?: string;
  metadata?: Record<string, string>;
}

/**
 * All 15 Firestore collections to migrate.
 */
export const ALL_COLLECTIONS = [
  'users',
  'events',
  'event_requests',
  'reimbursements',
  'fundDeposits',
  'public_profiles',
  'officerInvitations',
  'sponsorDomains',
  'links',
  'constitutions',
  'notifications',
  'googleGroupAssignments',
  'directOnboardings',
  'invites',
  'organizationSettings',
] as const;

/**
 * Known subcollections with their parent collection patterns.
 */
export const SUBCOLLECTIONS = {
  events: ['attendees'],
  constitutions: ['sections', 'auditLog'],
} as const;

export type SubcollectionPath = {
  parentCollection: string;
  subcollection: string;
  parentId: string;
};

/**
 * Export options for collection export.
 */
export interface ExportOptions {
  pageSize?: number;
  includeSubcollections?: boolean;
}

/**
 * Default export options.
 */
const DEFAULT_OPTIONS: Required<ExportOptions> = {
  pageSize: 100,
  includeSubcollections: true,
};

/**
 * Export a single Firestore collection with pagination.
 */
export async function exportCollection(
  collectionPath: string,
  options: ExportOptions = {},
): Promise<ExportedCollection[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const db = getFirestore();
  const collectionRef = db.collection(collectionPath);

  const allExports: ExportedCollection[] = [];
  let lastDoc: QueryDocumentSnapshot | null = null;
  let hasMore = true;

  while (hasMore) {
    let query = collectionRef.orderBy('__name__').limit(opts.pageSize);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    const documents: ExportedDocument[] = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const convertedData = convertTimestampsToIso(data);

      documents.push({
        _id: doc.id,
        ...(convertedData as Record<string, unknown>),
      });
    }

    allExports.push({
      collection: collectionPath,
      documents,
    });

    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.docs.length < opts.pageSize) {
      hasMore = false;
    }
  }

  if (opts.includeSubcollections) {
    const subcollectionExports = await exportSubcollections(
      collectionPath,
      documents,
      options,
    );
    allExports.push(...subcollectionExports);
  }

  return allExports;
}

/**
 * Export all known subcollections for a parent collection.
 */
async function exportSubcollections(
  parentCollection: string,
  parentDocuments: ExportedDocument[],
  options: ExportOptions = {},
): Promise<ExportedCollection[]> {
  const subcollectionConfigs = SUBCOLLECTIONS[parentCollection as keyof typeof SUBCOLLECTIONS];

  if (!subcollectionConfigs) {
    return [];
  }

  const allSubExports: ExportedCollection[] = [];

  for (const subcollectionName of subcollectionConfigs) {
    for (const parentDoc of parentDocuments) {
      const parentId = parentDoc._id as string;
      const subPath = `${parentCollection}/${parentId}/${subcollectionName}`;

      const subExports = await exportCollection(subPath, {
        ...options,
        includeSubcollections: false,
      });

      allSubExports.push(...subExports);
    }
  }

  return allSubExports;
}

/**
 * Export all 15 main collections.
 */
export async function exportAllCollections(
  options: ExportOptions = {},
): Promise<{
  collections: ExportedCollection[];
  summary: CollectionSummary;
}> {
  const collections: ExportedCollection[] = [];
  const summary: Record<string, number> = {};

  for (const collectionName of ALL_COLLECTIONS) {
    const exports = await exportCollection(collectionName, options);
    collections.push(...exports);

    let docCount = 0;
    for (const exp of exports) {
      docCount += exp.documents.length;
    }
    summary[collectionName] = docCount;
  }

  const totalDocs = Object.values(summary).reduce((sum, count) => sum + count, 0);

  return {
    collections,
    summary: {
      totalCollections: Object.keys(summary).length,
      totalDocuments: totalDocs,
      byCollection: summary,
    },
  };
}

/**
 * Export a specific subcollection path.
 */
export async function exportSubcollectionPath(
  subcollectionPath: SubcollectionPath,
  options: ExportOptions = {},
): Promise<ExportedCollection> {
  const { parentCollection, subcollection, parentId } = subcollectionPath;
  const fullPath = `${parentCollection}/${parentId}/${subcollection}`;

  const exports = await exportCollection(fullPath, {
    ...options,
    includeSubcollections: false,
  });

  if (exports.length === 0) {
    return {
      collection: fullPath,
      documents: [],
    };
  }

  return exports[0];
}

/**
 * List all files in Firebase Storage with metadata.
 */
export async function exportStorageFiles(
  prefix: string = '',
  options: {
    includeDownloadUrls?: boolean;
    maxResults?: number;
    pageToken?: string;
  } = {},
): Promise<{
  files: ExportedStorageFile[];
  nextPageToken?: string;
}> {
  const opts = {
    includeDownloadUrls: false,
    maxResults: 1000,
    ...options,
  };

  const storage = getStorage();
  const bucket = storage.bucket();
  const [files, nextQuery] = await bucket.getFiles({
    prefix,
    maxResults: opts.maxResults,
    pageToken: options.pageToken,
  });

  const exportedFiles: ExportedStorageFile[] = [];

  for (const file of files) {
    const [metadata] = await file.getMetadata();
    let downloadUrl: string | undefined;

    if (opts.includeDownloadUrls) {
      try {
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });
        downloadUrl = url;
      } catch {
        downloadUrl = undefined;
      }
    }

    exportedFiles.push({
      name: file.name,
      size: parseInt(metadata.size || '0', 10),
      contentType: metadata.contentType || null,
      timeCreated: metadata.timeCreated || new Date().toISOString(),
      updated: metadata.updated || new Date().toISOString(),
      downloadUrl,
      metadata: metadata.metadata as Record<string, string> | undefined,
    });
  }

  return {
    files: exportedFiles,
    nextPageToken: nextQuery?.pageToken,
  };
}

/**
 * Export all storage files with pagination.
 */
export async function exportAllStorageFiles(
  options: {
    includeDownloadUrls?: boolean;
  } = {},
): Promise<{
  files: ExportedStorageFile[];
  summary: {
    totalFiles: number;
    totalBytes: number;
    byPrefix: Record<string, number>;
  };
}> {
  const allFiles: ExportedStorageFile[] = [];
  let nextPageToken: string | undefined;
  const summary: Record<string, number> = {};
  let totalBytes = 0;

  const opts = {
    includeDownloadUrls: false,
    ...options,
  };

  do {
    const result = await exportStorageFiles('', {
      ...opts,
      pageToken: nextPageToken,
    });

    allFiles.push(...result.files);
    nextPageToken = result.nextPageToken;

    for (const file of result.files) {
      totalBytes += file.size;
      const prefix = file.name.split('/')[0] || 'root';
      summary[prefix] = (summary[prefix] || 0) + 1;
    }
  } while (nextPageToken);

  return {
    files: allFiles,
    summary: {
      totalFiles: allFiles.length,
      totalBytes,
      byPrefix: summary,
    },
  };
}

/**
 * Summary statistics for exported collections.
 */
export interface CollectionSummary {
  totalCollections: number;
  totalDocuments: number;
  byCollection: Record<string, number>;
}

/**
 * Export everything (collections + storage) with a single call.
 */
export async function exportAllData(
  options: {
    collectionOptions?: ExportOptions;
    storageOptions?: Parameters<typeof exportAllStorageFiles>[0];
  } = {},
): Promise<{
  collections: ExportedCollection[];
  storageFiles: ExportedStorageFile[];
  summary: {
    collections: CollectionSummary;
    storage: {
      totalFiles: number;
      totalBytes: number;
      byPrefix: Record<string, number>;
    };
    exportId: string;
    exportedAt: string;
  };
}> {
  const exportId = uuidv4();

  const [collectionsResult, storageResult] = await Promise.all([
    exportAllCollections(options.collectionOptions),
    exportAllStorageFiles(options.storageOptions),
  ]);

  return {
    collections: collectionsResult.collections,
    storageFiles: storageResult.files,
    summary: {
      collections: collectionsResult.summary,
      storage: storageResult.summary,
      exportId,
      exportedAt: new Date().toISOString(),
    },
  };
}

/**
 * Initialize Firebase with custom config (for testing or non-env usage).
 */
export function initializeFirebaseForExport(config: FirebaseConfig): void {
  initializeFirebaseFromEnv();
}

/**
 * Get all subcollection paths for a parent document.
 */
export function getSubcollectionPaths(
  parentCollection: string,
  parentId: string,
): SubcollectionPath[] {
  const subcollectionConfigs = SUBCOLLECTIONS[parentCollection as keyof typeof SUBCOLLECTIONS];

  if (!subcollectionConfigs) {
    return [];
  }

  return subcollectionConfigs.map((subcollection) => ({
    parentCollection,
    subcollection,
    parentId,
  }));
}
