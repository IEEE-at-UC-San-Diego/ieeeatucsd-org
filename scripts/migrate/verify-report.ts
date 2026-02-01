/**
 * Migration Verification Report Types
 *
 * Defines types for verification reports generated during Firebase to Convex
 * migration verification. Reports include pass/fail status, recommendations,
 * and detailed check results.
 */

// ============================================================================
// CHECK RESULT TYPES
// ============================================================================

/**
 * Status of a single verification check
 */
export type CheckStatus = 'pass' | 'fail' | 'warning' | 'skipped';

/**
 * Severity level for verification issues
 */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Result of a single verification check
 */
export interface CheckResult {
  /** Check identifier */
  checkId: string;
  /** Display name for the check */
  checkName: string;
  /** Check category (e.g., 'count', 'integrity', 'field') */
  category: string;
  /** Whether the check passed, failed, or was skipped */
  status: CheckStatus;
  /** Check duration in milliseconds */
  duration: number;
  /** Timestamp when check was performed */
  timestamp: string;
  /** Description of what was verified */
  description?: string;
  /** Error message if check failed */
  error?: string;
  /** Issues found during verification */
  issues: VerificationIssue[];
  /** Recommendations for fixing issues */
  recommendations: string[];
  /** Additional metadata about the check */
  metadata?: Record<string, unknown>;
}

/**
 * A specific issue found during verification
 */
export interface VerificationIssue {
  /** Issue severity */
  severity: IssueSeverity;
  /** Issue category */
  category: string;
  /** Short description of the issue */
  title: string;
  /** Detailed description of the issue */
  description: string;
  /** Relevant document ID if applicable */
  documentId?: string;
  /** Relevant field name if applicable */
  field?: string;
  /** Expected value */
  expected?: unknown;
  /** Actual value */
  actual?: unknown;
  /** Recommendation to fix the issue */
  recommendation?: string;
}

// ============================================================================
// VERIFICATION CHECK RESULT TYPES
// ============================================================================

/**
 * Result of record count verification
 */
export interface RecordCountCheckResult {
  collection: string;
  firebaseCount: number;
  convexCount: number;
  matches: boolean;
  difference: number;
  sampleDate: string;
}

/**
 * Result of file checksum verification
 */
export interface FileChecksumCheckResult {
  blobId: string;
  originalPath: string;
  originalChecksum: string;
  verifiedChecksum?: string;
  matches: boolean;
  status: 'verified' | 'not_found' | 'checksum_mismatch' | 'error';
  error?: string;
}

/**
 * Result of sampling verification
 */
export interface SampleCheckResult {
  collection: string;
  sampleSize: number;
  samplesChecked: number;
  passingSamples: number;
  failingSamples: number;
  samples: SampleDocumentResult[];
}

/**
 * Result of verifying a single sampled document
 */
export interface SampleDocumentResult {
  documentId: string;
  firebaseDocId?: string;
  convexDocId?: string;
  matches: boolean;
  fieldDifferences: FieldDifference[];
  status: 'match' | 'partial_match' | 'mismatch' | 'not_found';
}

/**
 * Difference between field values in Firebase vs Convex
 */
export interface FieldDifference {
  field: string;
  firebaseValue: unknown;
  convexValue: unknown;
  differenceType: 'value' | 'type' | 'missing_firebase' | 'missing_convex';
}

/**
 * Result of referential integrity check
 */
export interface ReferentialIntegrityCheckResult {
  collection: string;
  referenceField: string;
  targetCollection: string;
  totalRecords: number;
  validReferences: number;
  brokenReferences: number;
  orphanedRecords: OrphanRecord[];
}

/**
 * An orphaned record (reference points to non-existent document)
 */
export interface OrphanRecord {
  documentId: string;
  referenceField: string;
  referenceValue: string;
  targetDocumentMissing: boolean;
}

/**
 * Result of query equivalence test
 */
export interface QueryEquivalenceCheckResult {
  queryName: string;
  queryType: string;
  firebaseResults: QueryResult;
  convexResults: QueryResult;
  resultsMatch: boolean;
  countMatch: boolean;
  contentMatch: boolean;
  differences: QueryDifference[];
}

/**
 * Results from a query
 */
export interface QueryResult {
  count: number;
  executionTime: number;
  sampleResults?: Record<string, unknown>[];
}

/**
 * Difference between Firebase and Convex query results
 */
export interface QueryDifference {
  type: 'count' | 'content' | 'order' | 'missing';
  description: string;
  details?: Record<string, unknown>;
}

/**
 * Result of field validation check
 */
export interface FieldValidationCheckResult {
  collection: string;
  documentId?: string;
  totalFields: number;
  validFields: number;
  invalidFields: number;
  missingRequiredFields: string[];
  invalidTypeFields: InvalidTypeField[];
  invalidEnumFields: InvalidEnumField[];
}

/**
 * Field with invalid type
 */
export interface InvalidTypeField {
  field: string;
  expectedType: string;
  actualType: string;
}

/**
 * Field with invalid enum value
 */
export interface InvalidEnumField {
  field: string;
  value: unknown;
  validValues: unknown[];
}

// ============================================================================
// COMPREHENSIVE VERIFICATION REPORT
// ============================================================================

/**
 * Comprehensive verification report for migration
 */
export interface VerificationReport {
  /** Report metadata */
  metadata: ReportMetadata;
  /** Overall verification status */
  status: CheckStatus;
  /** All check results grouped by category */
  checks: Record<string, CheckResult[]>;
  /** Summary statistics */
  summary: VerificationSummary;
}

/**
 * Report metadata
 */
export interface ReportMetadata {
  /** Unique report identifier */
  reportId: string;
  /** Firebase project ID */
  firebaseProjectId: string;
  /** Convex deployment URL */
  convexDeploymentUrl: string;
  /** Report generation timestamp */
  generatedAt: string;
  /** Report version */
  version: string;
  /** Verification options used */
  options: VerificationOptions;
}

/**
 * Options used for verification
 */
export interface VerificationOptions {
  /** Verbose logging */
  verbose: boolean;
  /** Dry run mode */
  dryRun: boolean;
  /** Selected collections (empty = all) */
  collections: string[];
  /** Selected check types (empty = all) */
  checkTypes: CheckType[];
  /** Sample size for sampling verification */
  sampleSize: number;
  /** Specific document IDs to verify */
  documentIds?: string[];
  /** Force re-verification of already verified items */
  forceReverify: boolean;
}

/**
 * Check types supported by verification
 */
export type CheckType =
  | 'record_count'
  | 'file_checksum'
  | 'sampling'
  | 'referential_integrity'
  | 'query_equivalence'
  | 'field_validation';

/**
 * Summary statistics for verification report
 */
export interface VerificationSummary {
  /** Total checks performed */
  totalChecks: number;
  /** Checks that passed */
  passedChecks: number;
  /** Checks that failed */
  failedChecks: number;
  /** Checks with warnings */
  warningChecks: number;
  /** Checks that were skipped */
  skippedChecks: number;
  /** Overall pass rate (0-100) */
  passRate: number;
  /** Critical issues count */
  criticalIssues: number;
  /** High severity issues count */
  highSeverityIssues: number;
  /** Total records verified across all checks */
  totalRecordsVerified: number;
  /** Total fields verified */
  totalFieldsVerified: number;
}

// ============================================================================
// REPORT GENERATION FUNCTIONS
// ============================================================================

/**
 * Generate a unique report ID
 */
export function generateReportId(): string {
  return `verify-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a basic check result
 */
export function createCheckResult(
  checkId: string,
  checkName: string,
  category: string,
  status: CheckStatus,
  duration: number,
  options: Partial<CheckResult> = {}
): CheckResult {
  return {
    checkId,
    checkName,
    category,
    status,
    duration,
    timestamp: new Date().toISOString(),
    issues: [],
    recommendations: [],
    ...options,
  };
}

/**
 * Determine overall status from check results
 */
export function determineOverallStatus(checks: CheckResult[]): CheckStatus {
  if (checks.length === 0) {
    return 'skipped';
  }

  const failedChecks = checks.filter((c) => c.status === 'fail');
  const warningChecks = checks.filter((c) => c.status === 'warning');
  const passedChecks = checks.filter((c) => c.status === 'pass');

  if (failedChecks.length > 0) {
    return 'fail';
  }

  if (warningChecks.length > 0) {
    return 'warning';
  }

  if (passedChecks.length > 0) {
    return 'pass';
  }

  return 'skipped';
}

/**
 * Calculate summary statistics from check results
 */
export function calculateSummary(checks: CheckResult[]): VerificationSummary {
  const totalChecks = checks.length;
  const passedChecks = checks.filter((c) => c.status === 'pass').length;
  const failedChecks = checks.filter((c) => c.status === 'fail').length;
  const warningChecks = checks.filter((c) => c.status === 'warning').length;
  const skippedChecks = checks.filter((c) => c.status === 'skipped').length;

  const passRate = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0;

  const criticalIssues = checks.reduce(
    (sum, c) => sum + c.issues.filter((i) => i.severity === 'critical').length,
    0
  );
  const highSeverityIssues = checks.reduce(
    (sum, c) => sum + c.issues.filter((i) => i.severity === 'high').length,
    0
  );

  const totalRecordsVerified = checks.reduce((sum, c) => {
    const recordCount = (c.metadata as { recordCount?: number })?.recordCount || 0;
    return sum + recordCount;
  }, 0);

  const totalFieldsVerified = checks.reduce((sum, c) => {
    const fieldCount = (c.metadata as { fieldCount?: number })?.fieldCount || 0;
    return sum + fieldCount;
  }, 0);

  return {
    totalChecks,
    passedChecks,
    failedChecks,
    warningChecks,
    skippedChecks,
    passRate,
    criticalIssues,
    highSeverityIssues,
    totalRecordsVerified,
    totalFieldsVerified,
  };
}

/**
 * Group checks by category
 */
export function groupChecksByCategory(checks: CheckResult[]): Record<string, CheckResult[]> {
  const grouped: Record<string, CheckResult[]> = {};

  for (const check of checks) {
    if (!grouped[check.category]) {
      grouped[check.category] = [];
    }
    grouped[check.category].push(check);
  }

  return grouped;
}

/**
 * Generate a human-friendly status message
 */
export function getStatusMessage(status: CheckStatus): string {
  const messages = {
    pass: 'All checks passed successfully',
    fail: 'One or more checks failed',
    warning: 'Some checks passed with warnings',
    skipped: 'No checks were performed',
  };
  return messages[status];
}

/**
 * Format duration as human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

// ============================================================================
// PASS/FAIL CRITERIA
// ============================================================================

/**
 * Criteria for check pass/fail determination
 */
export interface PassFailCriteria {
  /** Maximum allowed failures for record count (0 = exact match required) */
  maxCountDifference?: number;
  /** Maximum percentage of failing samples in sampling check */
  maxSampleFailureRate?: number; // 0-100
  /** Maximum allowed broken references in integrity check */
  maxBrokenReferences?: number;
  /** Maximum percentage of broken references */
  maxBrokenReferenceRate?: number; // 0-100
  /** Whether checksum mismatches should fail the check */
  failOnChecksumMismatch?: boolean;
  /** Whether query result mismatches should fail the check */
  failOnQueryMismatch?: boolean;
}

/**
 * Default pass/fail criteria
 */
export const DEFAULT_PASS_FAIL_CRITERIA: PassFailCriteria = {
  maxCountDifference: 0,
  maxSampleFailureRate: 5, // Allow 5% sample failures
  maxBrokenReferences: 0,
  maxBrokenReferenceRate: 0,
  failOnChecksumMismatch: true,
  failOnQueryMismatch: false, // Query mismatches are warnings by default
};

/**
 * Evaluate if a check passes based on criteria
 */
export function evaluateCheckPass(
  checkType: CheckType,
  result: Record<string, unknown>,
  criteria: PassFailCriteria = DEFAULT_PASS_FAIL_CRITERIA
): { passes: boolean; status: CheckStatus; reason?: string } {
  switch (checkType) {
    case 'record_count': {
      const countResult = result as RecordCountCheckResult;
      if (!countResult.matches) {
        if (criteria.maxCountDifference !== undefined) {
          if (Math.abs(countResult.difference) <= criteria.maxCountDifference) {
            return {
              passes: true,
              status: 'warning',
              reason: `Count difference (${countResult.difference}) within tolerance`,
            };
          }
        }
        return {
          passes: false,
          status: 'fail',
          reason: `Record count mismatch: Firebase=${countResult.firebaseCount}, Convex=${countResult.convexCount}`,
        };
      }
      return { passes: true, status: 'pass' };
    }

    case 'sampling': {
      const sampleResult = result as SampleCheckResult;
      const failureRate = (sampleResult.failingSamples / sampleResult.samplesChecked) * 100;
      const maxRate = criteria.maxSampleFailureRate ?? 5;

      if (failureRate > maxRate) {
        return {
          passes: false,
          status: 'fail',
          reason: `${failureRate.toFixed(2)}% samples failed (max: ${maxRate}%)`,
        };
      }

      if (sampleResult.failingSamples > 0) {
        return {
          passes: true,
          status: 'warning',
          reason: `${sampleResult.failingSamples} samples had discrepancies`,
        };
      }

      return { passes: true, status: 'pass' };
    }

    case 'referential_integrity': {
      const integrityResult = result as ReferentialIntegrityCheckResult;
      const brokenRate = (integrityResult.brokenReferences / integrityResult.totalRecords) * 100;
      const maxBroken = criteria.maxBrokenReferences ?? 0;
      const maxRate = criteria.maxBrokenReferenceRate ?? 0;

      if (integrityResult.brokenReferences > maxBroken && maxBroken >= 0) {
        return {
          passes: false,
          status: 'fail',
          reason: `${integrityResult.brokenReferences} broken references found (max: ${maxBroken})`,
        };
      }

      if (brokenRate > maxRate && maxRate >= 0) {
        return {
          passes: false,
          status: 'fail',
          reason: `${brokenRate.toFixed(2)}% broken references (max: ${maxRate}%)`,
        };
      }

      if (integrityResult.brokenReferences > 0) {
        return {
          passes: true,
          status: 'warning',
          reason: `${integrityResult.brokenReferences} broken references found`,
        };
      }

      return { passes: true, status: 'pass' };
    }

    case 'file_checksum': {
      const checksumResult = result as FileChecksumCheckResult;
      if (!checksumResult.matches && checksumResult.status === 'checksum_mismatch') {
        if (criteria.failOnChecksumMismatch) {
          return {
            passes: false,
            status: 'fail',
            reason: 'Checksum mismatch detected',
          };
        }
        return {
          passes: true,
          status: 'warning',
          reason: 'Checksum mismatch (tolerated)',
        };
      }
      return { passes: true, status: 'pass' };
    }

    case 'query_equivalence': {
      const queryResult = result as QueryEquivalenceCheckResult;
      if (!queryResult.resultsMatch) {
        if (criteria.failOnQueryMismatch) {
          return {
            passes: false,
            status: 'fail',
            reason: 'Query results do not match',
          };
        }
        return {
          passes: true,
          status: 'warning',
          reason: 'Query results differ (tolerated)',
        };
      }
      return { passes: true, status: 'pass' };
    }

    case 'field_validation': {
      const fieldResult = result as FieldValidationCheckResult;
      if (fieldResult.missingRequiredFields.length > 0) {
        return {
          passes: false,
          status: 'fail',
          reason: `${fieldResult.missingRequiredFields.length} required fields missing`,
        };
      }

      if (fieldResult.invalidTypeFields.length > 0 || fieldResult.invalidEnumFields.length > 0) {
        return {
          passes: true,
          status: 'warning',
          reason: `${fieldResult.invalidTypeFields.length} type errors, ${fieldResult.invalidEnumFields.length} enum errors`,
        };
      }

      return { passes: true, status: 'pass' };
    }

    default:
      return { passes: true, status: 'pass' };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  CheckResult,
  VerificationIssue,
  RecordCountCheckResult,
  FileChecksumCheckResult,
  SampleCheckResult,
  SampleDocumentResult,
  FieldDifference,
  ReferentialIntegrityCheckResult,
  OrphanRecord,
  QueryEquivalenceCheckResult,
  QueryResult,
  QueryDifference,
  FieldValidationCheckResult,
  InvalidTypeField,
  InvalidEnumField,
};
