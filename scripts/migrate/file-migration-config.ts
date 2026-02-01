/**
 * Firebase Storage to Convex Blob Migration Configuration
 *
 * Defines file path patterns, collection mappings, and configuration
 * for migrating binary files from Firebase Storage to Convex blob storage.
 */

// ============================================================================
// FILE PATH PATTERNS
// ============================================================================

/**
 * Firebase Storage path patterns for different file types
 * These patterns define where files are stored in Firebase Storage
 * and how they map to Convex blob IDs in the database.
 */
export const FIREBASE_STORAGE_PATHS = {
  // User avatar images
  avatars: 'avatars/{userId}',

  // Reimbursement receipt files
  receipts: 'reimbursements/{reimbursementId}/receipts/{receiptFile}',

  // Fund deposit proof files
  fundDeposits: 'fundDeposits/{depositId}/proof/{proofFile}',

  // Event-related files (flyers, room booking confirmation, etc.)
  eventFiles: 'events/{eventId}/{fileType}/{fileName}',

  // Event request files
  eventRequestFiles: 'eventRequests/{requestId}/{fileType}/{fileName}',

  // Constitution document files
  constitutions: 'constitutions/{constitutionId}/{fileName}',

  // Organization logo/image files
  logos: 'logos/{logoName}',

  // Sponsor images/icons
  sponsorImages: 'sponsors/{sponsorId}/{fileName}',

  // Resume files (if stored in Firebase Storage)
  resumes: 'resumes/{userId}/{fileName}',

  // Other miscellaneous files
  other: 'other/{fileName}',
} as const;

// ============================================================================
// COLLECTION FILE MAPPINGS
// ============================================================================

/**
 * Maps Firebase collections to their file reference fields
 * This defines which fields in each collection reference Firebase Storage URLs
 * that need to be updated with Convex blob IDs.
 */
export const COLLECTION_FILE_MAPPINGS = {
  users: {
    collection: 'users',
    fileFields: [
      {
        field: 'avatarUrl',
        pathPattern: FIREBASE_STORAGE_PATHS.avatars,
        isArray: false,
        optional: true,
      },
      {
        field: 'resume',
        pathPattern: FIREBASE_STORAGE_PATHS.resumes,
        isArray: false,
        optional: true,
      },
    ],
  },

  reimbursements: {
    collection: 'reimbursements',
    fileFields: [
      {
        field: 'receipts',
        pathPattern: FIREBASE_STORAGE_PATHS.receipts,
        isArray: true,
        optional: true,
      },
    ],
  },

  fundDeposits: {
    collection: 'fundDeposits',
    fileFields: [
      {
        field: 'receiptFile',
        pathPattern: FIREBASE_STORAGE_PATHS.fundDeposits,
        isArray: false,
        optional: true,
      },
    ],
  },

  events: {
    collection: 'events',
    fileFields: [
      {
        field: 'files',
        pathPattern: FIREBASE_STORAGE_PATHS.eventFiles,
        isArray: true,
        optional: true,
      },
    ],
  },

  event_requests: {
    collection: 'event_requests',
    fileFields: [
      {
        field: 'roomBookingFiles',
        pathPattern: FIREBASE_STORAGE_PATHS.eventRequestFiles,
        isArray: true,
        optional: true,
      },
      {
        field: 'graphicsFiles',
        pathPattern: FIREBASE_STORAGE_PATHS.eventRequestFiles,
        isArray: true,
        optional: true,
      },
    ],
  },

  links: {
    collection: 'links',
    fileFields: [
      {
        field: 'iconUrl',
        pathPattern: FIREBASE_STORAGE_PATHS.logos,
        isArray: false,
        optional: true,
      },
    ],
  },

  sponsorDomains: {
    collection: 'sponsorDomains',
    fileFields: [], // Sponsor files are stored in sponsorImages path, not in domain records
  },
} as const;

// ============================================================================
// FILE METADATA SCHEMA
// ============================================================================

/**
 * Metadata captured for each migrated file
 */
export interface FileMetadata {
  /** Original Firebase Storage path */
  originalPath: string;
  /** Generated Convex blob ID */
  blobId?: string;
  /** Content type (MIME type) */
  contentType: string;
  /** Original filename */
  filename: string;
  /** File size in bytes */
  size: number;
  /** SHA-256 checksum for verification */
  checksum: string;
  /** Upload timestamp (from Firebase) */
  uploadTime?: number;
  /** Whether file was already migrated (from checkpoint) */
  alreadyMigrated?: boolean;
  /** Migration status */
  status: 'pending' | 'downloading' | 'uploading' | 'completed' | 'failed';
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// MIGRATION CHECKPOINT
// ============================================================================

/**
 * Checkpoint data for resume capability
 */
export interface MigrationCheckpoint {
  /** Checkpoint version */
  version: number;
  /** Timestamp when checkpoint was created */
  timestamp: number;
  /** Total files to migrate */
  totalFiles: number;
  /** Files completed so far */
  completedFiles: number;
  /** Files that failed */
  failedFiles: number;
  /** Blob ID mappings (original path -> blob ID) */
  blobIdMappings: Record<string, string>;
  /** Failed file paths (with error messages) */
  failedPaths: Record<string, string>;
}

/** Current checkpoint version - increment when format changes */
export const CHECKPOINT_VERSION = 1;

// ============================================================================
// MIGRATION OPTIONS
// ============================================================================

/**
 * Configuration options for file migration
 */
export interface FileMigrationOptions {
  /** Dry run mode - don't actually download/upload files */
  dryRun: boolean;
  /** Verbose logging */
  verbose: boolean;
  /** Continue on individual file errors */
  continueOnError: boolean;
  /** Maximum retry attempts for failed uploads */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  retryDelay: number;
  /** Batch size for processing files */
  batchSize: number;
  /** Delay between batches in milliseconds */
  batchDelay: number;
  /** Enable resume from checkpoint */
  resumeFromCheckpoint: boolean;
  /** Force re-migration of all files (ignore checkpoint) */
  forceRemigrate: boolean;
  /** Specific Firebase path prefix to migrate (e.g., "avatars/") */
  pathPrefix?: string;
  /** Output directory for temporary files */
  tempDir: string;
  /** Checkpoint file path */
  checkpointPath: string;

  // Firebase configuration
  firebaseProjectId?: string;
  firebaseStorageBucket?: string;

  // Convex configuration
  convexDeploymentUrl?: string;
}

/**
 * Default migration options
 */
export const DEFAULT_MIGRATION_OPTIONS: FileMigrationOptions = {
  dryRun: false,
  verbose: false,
  continueOnError: true,
  maxRetries: 3,
  retryDelay: 1000,
  batchSize: 10,
  batchDelay: 100,
  resumeFromCheckpoint: true,
  forceRemigrate: false,
  tempDir: './scripts/migrate/temp-files',
  checkpointPath: './scripts/migrate/file-migration-checkpoint.json',
};

// ============================================================================
// MIGRATION RESULT TYPES
// ============================================================================

/**
 * Result of migrating a single file
 */
export interface FileMigrationResult {
  /** Original Firebase path */
  originalPath: string;
  /** Generated blob ID */
  blobId?: string;
  /** Whether migration was successful */
  success: boolean;
  /** File size in bytes */
  size: number;
  /** Original checksum */
  checksum: string;
  /** Verified checksum after upload */
  verifiedChecksum?: string;
  /** Duration in milliseconds */
  duration: number;
  /** Number of retries */
  retries: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Result of updating document references
 */
export interface ReferenceUpdateResult {
  /** Collection name */
  collection: string;
  /** Document ID */
  documentId: string;
  /** Field that was updated */
  field: string;
  /** Whether update was successful */
  success: boolean;
  /** Number of file references updated */
  updatedCount: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Result of verifying a migrated file
 */
export interface FileVerificationResult {
  /** Blob ID */
  blobId: string;
  /** Original path */
  originalPath: string;
  /** Whether verification was successful */
  success: boolean;
  /** Original checksum */
  originalChecksum: string;
  /** Verified checksum */
  verifiedChecksum: string;
  /** Whether checksums match */
  checksumsMatch: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Overall file migration report
 */
export interface FileMigrationReport {
  /** Start timestamp */
  startTime: string;
  /** End timestamp */
  endTime: string;
  /** Total duration in milliseconds */
  duration: number;
  /** Whether the entire migration was successful */
  success: boolean;
  /** Total files to migrate */
  totalFiles: number;
  /** Files successfully migrated */
  successfulMigrations: number;
  /** Files that failed */
  failedMigrations: number;
  /** Files skipped (already migrated) */
  skippedFiles: number;
  /** Total bytes transferred */
  totalBytes: number;
  /** Total retries performed */
  totalRetries: number;
  /** Per-file results */
  fileResults: FileMigrationResult[];
  /** Reference update results */
  referenceUpdates: ReferenceUpdateResult[];
  /** Verification results */
  verificationResults: FileVerificationResult[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine content type from filename extension
 */
export function getContentTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  const contentTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',

    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // Text
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',

    // Archives
    zip: 'application/zip',
    rar: 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',

    // Other
    bin: 'application/octet-stream',
  };

  return contentTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Generate a safe filename from a Firebase Storage path
 */
export function getFilenameFromPath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || 'unnamed';
}

/**
 * Check if a URL is a Firebase Storage URL
 */
export function isFirebaseStorageUrl(url: string): boolean {
  return url.startsWith('gs://') || url.includes('firebasestorage.googleapis.com');
}

/**
 * Extract the storage path from a Firebase Storage URL
 */
export function extractPathFromFirebaseUrl(url: string): string {
  // Handle gs://bucket/path format
  if (url.startsWith('gs://')) {
    const withoutPrefix = url.substring(5);
    const firstSlash = withoutPrefix.indexOf('/');
    if (firstSlash === -1) {
      return '';
    }
    return withoutPrefix.substring(firstSlash + 1);
  }

  // Handle https://firebasestorage.googleapis.com/... format
  if (url.includes('firebasestorage.googleapis.com')) {
    const match = url.match(/\/o\/([^?]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  return '';
}

/**
 * Generate a migration checkpoint file path
 */
export function getCheckpointPath(basePath: string): string {
  return basePath;
}

/**
 * Check if checkpoint file exists and is valid
 */
export async function isValidCheckpoint(checkpointPath: string): Promise<boolean> {
  const { existsSync } = await import('fs');
  const { readFileSync } = await import('fs');

  try {
    if (!existsSync(checkpointPath)) {
      return false;
    }

    const content = readFileSync(checkpointPath, 'utf-8');
    const checkpoint = JSON.parse(content) as MigrationCheckpoint;

    // Check version compatibility
    if (checkpoint.version !== CHECKPOINT_VERSION) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// COLLECTION FILE ENUMERATION HELPERS
// ============================================================================

/**
 * Get all collections that contain file references
 */
export function getCollectionsWithFiles(): string[] {
  return Object.keys(COLLECTION_FILE_MAPPINGS);
}

/**
 * Get file field configurations for a collection
 */
export function getFileFieldsForCollection(collection: string): typeof COLLECTION_FILE_MAPPINGS[keyof typeof COLLECTION_FILE_MAPPINGS]['fileFields'] {
  const mapping = COLLECTION_FILE_MAPPINGS[collection as keyof typeof COLLECTION_FILE_MAPPINGS];
  return mapping?.fileFields || [];
}

/**
 * Check if a collection has file references
 */
export function collectionHasFiles(collection: string): boolean {
  const fields = getFileFieldsForCollection(collection);
  return fields.length > 0;
}
