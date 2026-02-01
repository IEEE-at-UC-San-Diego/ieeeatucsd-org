# Firestore Migration Scripts

Phase 2 of the Firebase to Convex migration - Export scripts for Firebase Firestore collections.

## Overview

This directory contains scripts to export all 15 Firestore collections from Firebase to JSON format, which can then be transformed and imported into Convex.

### Collections Exported

1. **users** - User accounts and profiles
2. **events** - Published events (with `attendees` subcollection)
3. **event_requests** - Event requests awaiting approval
4. **reimbursements** - Reimbursement requests
5. **fundDeposits** - Fund deposit records
6. **public_profiles** - Public user profiles for leaderboard
7. **officerInvitations** - Officer invitation records
8. **sponsorDomains** - Sponsor email domain mappings
9. **links** - Shortened links
10. **constitutions** - Constitution documents (with `sections`, `auditLog` subcollections)
11. **notifications** - User notifications
12. **googleGroupAssignments** - Google Group assignment records
13. **directOnboardings** - Direct onboarding records
14. **invites** - User invitation records
15. **organizationSettings** - Organization-wide settings

### Subcollections Handled

Subcollections are exported as separate JSON files with parent references:

- **events/attendees** → `events-attendees.json`
- **constitutions/sections** → `constitutions-sections.json`
- **constitutions/auditLog** → `constitutions-auditLog.json`

## Files

- [`export-firestore.ts`](export-firestore.ts) - Main export script
- [`types.ts`](types.ts) - TypeScript type definitions for exported data
- `exported/` - Directory where JSON exports are written (auto-created)

## Prerequisites

### 1. Firebase Admin SDK Setup

You need Firebase Admin SDK credentials to access Firestore. Choose one of the following methods:

#### Option 1: Service Account File (Recommended)

1. Go to [Firebase Console > Project Settings > Service Accounts](https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk)
2. Click "Generate new private key"
3. Save the JSON file (e.g., `firebase-service-account.json`)
4. Set the path as an environment variable:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/firebase-service-account.json"
```

#### Option 2: Environment Variables

Set individual environment variables from your service account JSON:

```bash
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_CLIENT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Note:** When setting `FIREBASE_PRIVATE_KEY`, ensure newlines are properly escaped with `\n`.

### 2. Install Dependencies

The script requires `firebase-admin`:

```bash
npm install firebase-admin
# or
yarn add firebase-admin
# or
pnpm add firebase-admin
```

### 3. TypeScript Execution

The script uses `tsx` for TypeScript execution:

```bash
npm install -g tsx
# or
pnpm add -D tsx
```

## Usage

### Basic Export

Export all collections:

```bash
npx tsx scripts/migrate/export-firestore.ts
```

### Dry Run Mode

Test the export without writing any files:

```bash
npx tsx scripts/migrate/export-firestore.ts --dry-run
```

### Export Specific Collection

Export a single collection:

```bash
npx tsx scripts/migrate/export-firestore.ts --collection=users
```

### Verbose Mode

Enable detailed debug logging:

```bash
npx tsx scripts/migrate/export-firestore.ts --verbose
```

### Example Full Command

```bash
FIREBASE_PROJECT_ID="your-project-id" \
FIREBASE_CLIENT_EMAIL="your.service@account.com" \
FIREBASE_PRIVATE_KEY="$(cat ./firebase-service-account.json | grep privateKey | cut -d'"' -f4)" \
npx tsx scripts/migrate/export-firestore.ts --verbose
```

## Output Structure

Exported files are written to `scripts/migrate/exported/`:

```
exported/
├── users.json
├── events.json
├── events-attendees.json
├── event_requests.json
├── reimbursements.json
├── fundDeposits.json
├── public_profiles.json
├── officerInvitations.json
├── sponsorDomains.json
├── links.json
├── constitutions.json
├── constitutions-sections.json
├── constitutions-auditLog.json
├── notifications.json
├── googleGroupAssignments.json
├── directOnboardings.json
├── invites.json
├── organizationSettings.json
└── export-report.json
```

### JSON Format

Each exported JSON file has the following structure:

```json
{
  "_meta": {
    "collection": "collection_name",
    "exportedAt": "2024-01-31T20:00:00.000Z",
    "documentCount": 150,
    "subcollections": [],
    "hasSubCollections": false
  },
  "documents": [
    {
      "_id": "document_id",
      "field1": "value1",
      "field2": "value2",
      "timestampField": "2024-01-31T20:00:00.000Z",
      "referenceField": "/users/abc123"
    }
  ]
}
```

### Subcollection Format

Subcollection files include parent references:

```json
{
  "_meta": {
    "collection": "attendees",
    "parentCollection": "events"
  },
  "documents": [
    {
      "_id": "attendee_id",
      "_parentId": "event_id",
      "_parentCollection": "events",
      "userId": "user_id",
      "timeCheckedIn": "2024-01-31T20:00:00.000Z"
    }
  ]
}
```

### Export Report

The `export-report.json` file contains:

```json
{
  "totalCollections": 15,
  "successfulExports": 15,
  "failedExports": 0,
  "skippedExports": 0,
  "totalDocuments": 5234,
  "totalSubcollectionDocuments": 1234,
  "results": [...],
  "duration": 15234,
  "startTime": "2024-01-31T20:00:00.000Z",
  "endTime": "2024-01-31T20:04:15.234Z",
  "dryRun": false
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FIREBASE_PROJECT_ID` | Yes | Your Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Conditionally* | Service account email |
| `FIREBASE_PRIVATE_KEY` | Conditionally* | Service account private key |
| `GOOGLE_APPLICATION_CREDENTIALS` | Conditionally* | Path to service account JSON file |

* Either `GOOGLE_APPLICATION_CREDENTIALS` OR both `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` must be provided.

## Troubleshooting

### Permission Denied

**Error:** `Error: 7 PERMISSION_DENIED: Missing or insufficient permissions`

**Solution:**
- Ensure your service account has the **Firebase Admin** role
- Verify the service account is enabled in Firebase Console
- Check that the project ID matches your Firebase project

### Invalid Credentials

**Error:** `Error: Could not determine project ID`

**Solution:**
- Verify `FIREBASE_PROJECT_ID` is set correctly
- Check the service account file is valid JSON
- Ensure `FIREBASE_PRIVATE_KEY` is properly formatted with `\n` for newlines

### Collection Not Found

**Error:** `Error: 5 NOT_FOUND: No such collection`

**Solution:**
- The collection may not exist in your Firestore database
- Collection names are case-sensitive
- Run with `--verbose` flag for more details

### Memory Issues with Large Collections

**Solution:**
- The script uses batch processing (500 documents per batch)
- For very large collections, export specific collections one at a time:
  ```bash
  npx tsx scripts/migrate/export-firestore.ts --collection=users
  npx tsx scripts/migrate/export-firestore.ts --collection=events
  ```

### Timeout Errors

**Error:** `Error: 4 DEADLINE_EXCEEDED`

**Solution:**
- Increase timeout by modifying `BATCH_SIZE` in the script (default: 500)
- Export smaller batches using `--collection` flag
- Check your network connection

### Type Errors During Execution

**Error:** Type-related TypeScript errors

**Solution:**
- Ensure you have the latest `firebase-admin` package
- Run with `npx tsx` which handles TypeScript compilation

## Advanced Configuration

### Modifying Batch Size

Edit [`export-firestore.ts`](export-firestore.ts) to change the batch size:

```typescript
const BATCH_SIZE = 500; // Increase for better performance, decrease for memory-constrained environments
```

### Custom Output Directory

Edit the script to change where files are exported:

```typescript
const OUTPUT_DIR = path.join(__dirname, 'custom-export-dir');
```

### Subcollection Export Limit

The script limits subcollection export to 10 parent documents by default. Modify this in the `exportCollection` function:

```typescript
const limit = Math.min(documents.length, 10); // Change 10 to your desired limit
```

## Next Steps

After exporting data:

1. **Transform** the exported JSON for Convex schema compatibility
2. **Import** the transformed data into Convex
3. **Validate** the imported data is accurate
4. **Test** the application with the new Convex data

See the migration documentation in [`docs/convex-schema-mapping.md`](../../docs/convex-schema-mapping.md) for schema transformation details.

## Technical Notes

### Timestamp Conversion

Firebase `Timestamp` objects are automatically converted to ISO 8601 strings:

```typescript
// Firestore Timestamp
{ _seconds: 1706745600, _nanoseconds: 123456000 }

// Exported JSON
"2024-01-31T20:00:00.123Z"
```

### Reference Conversion

Firestore `DocumentReference` objects are converted to path strings:

```typescript
// Firestore Reference
DocumentReference { path: "projects/abc/databases/123/users/xyz" }

// Exported JSON
"/users/xyz"
```

### GeoPoint Conversion

Firestore `GeoPoint` objects are converted to latitude/longitude objects:

```typescript
// Firestore GeoPoint
{ _latitude: 32.8808, _longitude: -117.2340 }

// Exported JSON
{ "latitude": 32.8808, "longitude": -117.2340 }
```

## Related Documentation

- [Firebase Schema](../../docs/firebase-schema.md) - Complete Firebase schema documentation
- [Convex Schema Mapping](../../docs/convex-schema-mapping.md) - Schema transformation guide
- [Migration PRD](../../docs/MIGRATION-PRD.md) - Overall migration project requirements

## File Storage Migration

### Overview

The file migration script migrates binary files from Firebase Storage to Convex blob storage. This includes:
- User avatar images
- User resumes
- Reimbursement receipts
- Fund deposit proofs
- Event files (flyers, documents)
- Link icons
- Any other files stored in Firebase Storage

### Files

- [`file-migration-config.ts`](file-migration-config.ts) - Configuration for file migrations
- [`migrate-files.ts`](migrate-files.ts) - Main file migration script
- [`apps/dashboard/convex/actions/file-migration.ts`](../../apps/dashboard/convex/actions/file-migration.ts) - Convex file storage actions

### Usage

#### Basic Migration

Migrate all files from Firebase Storage to Convex:

```bash
bun run scripts/migrate/migrate-files.ts
```

#### Dry Run

Test the migration without actually transferring files:

```bash
bun run scripts/migrate/migrate-files.ts --dry-run
```

#### Verbose Output

Enable detailed logging during migration:

```bash
bun run scripts/migrate/migrate-files.ts --verbose
```

#### Verify Existing Migrations

Check that previously migrated files are still accessible:

```bash
bun run scripts/migrate/migrate-files.ts --verify
```

#### Migrate Specific Path

Only migrate files under a specific path prefix:

```bash
bun run scripts/migrate/migrate-files.ts --path avatars/
```

#### Force Re-migration

Re-migrate all files, ignoring the checkpoint:

```bash
bun run scripts/migrate/migrate-files.ts --force-remigrate
```

### Migration Steps

The file migration process performs the following steps:

1. **Enumerate Files**: Lists all files in Firebase Storage
2. **Download Files**: Downloads files to temporary storage with checksum calculation
3. **Upload to Convex**: Uploads binary data to Convex blob storage
4. **Update References**: Updates database references from Firebase URLs to blob IDs
5. **Verify**: Verifies files are accessible via Convex
6. **Generate Report**: Creates a detailed migration report

### Resume Capability

The script automatically saves checkpoints to enable resuming interrupted migrations:

- Checkpoint file: `scripts/migrate/file-migration-checkpoint.json`
- Tracks: completed files, blob ID mappings, failed files
- Removed automatically after successful migration

To disable checkpointing:

```bash
bun run scripts/migrate/migrate-files.ts --no-resume
```

### File Reference Updates

The following document fields are automatically updated with blob IDs:

| Collection | Field | Description |
|------------|-------|-------------|
| `users` | `avatarUrl` | User profile image |
| `users` | `resume` | User resume file |
| `reimbursements` | `receipts` | Array of receipt files |
| `fundDeposits` | `receiptFile` | Deposit proof file |
| `events` | `files` | Event-related files |
| `event_requests` | `roomBookingFiles` | Room booking documents |
| `event_requests` | `graphicsFiles` | Graphics files |
| `links` | `iconUrl` | Link icon image |

### Environment Variables

Required environment variables for file migration:

```bash
# Firebase credentials
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET="your-project.appspot.com"  # Optional, defaults to PROJECT_ID.appspot.com

# Convex deployment
VITE_CONVEX_URL="https://your-deployment.convex.cloud"
```

### Output

The migration generates:

1. **Checkpoint File**: Progress tracking during migration
2. **Migration Report**: JSON file with migration statistics
   - Stored at: `scripts/migrate/temp-files/file-migration-report-{timestamp}.json`
   - Includes: success/failure counts, file paths, blob IDs, checksums

### Temporary Files

Temporary files are created during migration and automatically cleaned up:

- Directory: `scripts/migrate/temp-files`
- Contains: Downloaded files, migration reports
- Cleaned up: After successful migration completion

### Error Handling

The migration includes robust error handling:

- **Retry Logic**: Failed uploads are retried up to 3 times (configurable with `--max-retries`)
- **Continue on Error**: By default, the migration continues after individual file failures
- **Checkpoint Recovery**: Resume from last successful checkpoint after interruption
- **Detailed Logging**: Verbose mode provides detailed error information

### Troubleshooting File Migration

#### Firebase Storage Access Denied

**Error:** `Error: 7 PERMISSION_DENIED`

**Solution:**
- Verify Firebase Admin SDK credentials are correct
- Ensure service account has Storage Admin role
- Check `FIREBASE_PROJECT_ID` and `FIREBASE_STORAGE_BUCKET` values

#### Convex Storage Upload Failed

**Error:** `Failed to store file: ...`

**Solution:**
- Verify `VITE_CONVEX_URL` is correct and deployment is active
- Check Convex deployment has sufficient storage capacity
- Ensure Convex schema includes `_storage` (blob storage)

#### Checkpoint File Corrupt

**Error:** `No valid checkpoint found` (when checkpoint exists)

**Solution:**
- Use `--force-remigrate` to ignore the checkpoint
- Or delete the checkpoint file manually:
  ```bash
  rm scripts/migrate/file-migration-checkpoint.json
  ```

#### Large File Timeout

**Error:** `DEADLINE_EXCEEDED` during file upload

**Solution:**
- Files are uploaded individually; large files may take longer
- The script includes automatic retry logic
- Consider migrating files in smaller batches using `--path`

### Advanced Options

| Option | Description | Default |
|--------|-------------|---------|
| `--dry-run` | Simulate migration without actual transfers | false |
| `--verbose` | Enable detailed logging | false |
| `--verify` | Only verify existing migrations | false |
| `--no-resume` | Don't resume from checkpoint | false (resume enabled) |
| `--force-remigrate` | Re-migrate all files | false |
| `--max-retries NUM` | Maximum retry attempts per file | 3 |
| `--path PREFIX` | Only migrate files under path prefix | all files |
| `--collection NAME` | Only migrate files for one collection | all collections |

### File Access After Migration

After migration, files can be accessed through Convex blob storage. The following actions are available in [`apps/dashboard/convex/actions/file-migration.ts`](../../apps/dashboard/convex/actions/file-migration.ts):

- `fileMigration:getFile` - Retrieve any file by blob ID
- `fileMigration:getAvatar` - Get user avatar (public access)
- `fileMigration:getReimbursementReceipt` - Get receipt with access control
- `fileMigration:getFundDepositProof` - Get deposit proof with access control
- `fileMigration:getUserResume` - Get resume with access control
- `fileMigration:getCollectionFileMigrationStatus` - Get migration status for a collection
- `fileMigration:getAllCollectionMigrationStatus` - Get status for all collections

### Migration Status Check

Check migration status for all collections via Convex:

```typescript
const results = await ctx.runMutation(api.fileMigration.getAllCollectionMigrationStatus);
```

This returns migration progress for each collection including:
- Total files
- Migrated files
- Unmigrated files
- Migration progress percentage

## Migration Verification

### Overview

The verification script performs comprehensive data integrity checks to ensure the migration from Firebase to Convex was completed successfully and accurately.

### Verification Checks

The script performs the following verification checks:

1. **Record Count Verification** - Compares document counts between Firebase and Convex for each collection
2. **File Checksum Verification** - Verifies all migrated files have correct checksums
3. **Sampling Verification** - Randomly samples documents and compares field values
4. **Referential Integrity** - Validates all foreign key references point to existing documents
5. **Query Equivalence** - Runs equivalent queries on both systems and compares results
6. **Field Validation** - Verifies required fields are present and have valid values

### Files

- [`verify-migration.ts`](verify-migration.ts) - Main verification script
- [`verify-report.ts`](verify-report.ts) - Report types and generation functions
- [`apps/dashboard/convex/actions/verification.ts`](../../apps/dashboard/convex/actions/verification.ts) - Convex verification actions

### Usage

#### Run All Verification Checks

```bash
npx tsx scripts/migrate/verify-migration.ts
```

#### Run with Verbose Output

```bash
npx tsx scripts/migrate/verify-migration.ts --verbose
```

#### Run Specific Collection Only

```bash
npx tsx scripts/migrate/verify-migration.ts --collection users
```

#### Run Specific Check Type

```bash
npx tsx scripts/migrate/verify-migration.ts --check record_count
npx tsx scripts/migrate/verify-migration.ts --check referential_integrity
```

#### Dry Run (Without Saving Report)

```bash
npx tsx scripts/migrate/verify-migration.ts --dry-run
```

#### Custom Sample Size

```bash
npx tsx scripts/migrate/verify-migration.ts --sample-size 20
```

#### Change Report Format

```bash
npx tsx scripts/migrate/verify-migration.ts --format html
npx tsx scripts/migrate/verify-migration.ts --format txt
```

#### Custom Report Output Path

```bash
npx tsx scripts/migrate/verify-migration.ts --report-path ./my-reports
```

### Available Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--verbose` | `-v` | Enable verbose logging | false |
| `--dry-run` | | Run without saving report | false |
| `--collection` | `-c` | Verify specific collection only | all |
| `--check` | | Run specific check type only | all |
| `--sample-size` | `-s` | Sample size for sampling check | 10 |
| `--format` | | Report format: json, html, txt | json |
| `--report-path` | `-o` | Output directory for reports | ./reports |
| `--force-reverify` | | Re-verify all items | false |
| `--document-id` | | Verify specific document by ID | all |
| `--help` | `-h` | Show help message | - |

### Available Check Types

| Check Type | Description |
|------------|-------------|
| `record_count` | Verify document counts match between Firebase and Convex |
| `file_checksum` | Verify file checksums match between original and migrated files |
| `sampling` | Random sample documents and compare field values |
| `referential_integrity` | Validate all foreign key references point to existing documents |
| `query_equivalence` | Test that equivalent queries produce matching results |
| `field_validation` | Validate required fields are present and have valid values |

### Report Output

The verification generates a detailed report with:

- **Overall Status**: Pass, Fail, Warning, or Skipped
- **Summary Statistics**: Total checks, passed/failed counts, pass rate, issue counts
- **Per-Check Results**: Each check's status, duration, issues, and recommendations
- **Issue Details**: Severity-level breakdown of all found issues
- **Recommendations**: Actionable suggestions for fixing problems

#### Report Formats

**JSON Format** (default):
```json
{
  "metadata": {
    "reportId": "verify-1706697600-abc123",
    "firebaseProjectId": "your-project-id",
    "convexDeploymentUrl": "https://your-deployment.convex.cloud",
    "generatedAt": "2024-01-31T20:00:00.000Z",
    "version": "1.0.0",
    "options": {...}
  },
  "status": "pass",
  "checks": {...},
  "summary": {...}
}
```

**HTML Format**: Interactive web report with Tailwind CSS styling

**Text Format**: Plain text summary for quick review

### Environment Variables

Required environment variables for verification:

```bash
# Firebase credentials
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_CLIENT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Convex deployment
export CONVEX_URL="https://your-deployment.convex.cloud"
# or
export VITE_CONVEX_URL="https://your-deployment.convex.cloud"
```

### Understanding Verification Results

#### Check Status Levels

| Status | Meaning |
|--------|---------|
| **Pass** | Check completed successfully with no issues |
| **Warning** | Check passed but found non-critical issues that should be reviewed |
| **Fail** | Check failed with critical issues that need fixing |
| **Skipped** | Check was not run (e.g., no data to verify) |

#### Issue Severity Levels

| Severity | Meaning |
|----------|---------|
| **Critical** | Must fix before proceeding with production migration |
| **High** | Should fix soon as it affects data integrity |
| **Medium** | Review and fix if time allows |
| **Low** | Minor issues, can be fixed later |
| **Info** | Informational only, no action required |

### Interpreting Common Issues

#### Record Count Mismatch

**Issue**: Document counts differ between Firebase and Convex

**Possible Causes**:
- Some documents failed to import
- Import was interrupted mid-way
- Duplicate or orphaned documents in either system

**Recommendations**:
- Review import logs for failed documents
- Re-run import for affected collections
- Check for and remove duplicate documents

#### Orphaned References

**Issue**: Documents reference other documents that don't exist

**Possible Causes**:
- Referenced documents failed to import
- Import order was incorrect
- Manual edits to data after migration

**Recommendations**:
- Ensure parent documents are imported before child documents
- Re-import missing documents
- Update or remove broken references

#### Sampling Discrepancies

**Issue**: Sampled documents have field differences

**Possible Causes**:
- Transformation rules didn't map all fields correctly
- Data type mismatches during migration
- Fields intentionally excluded during transformation

**Recommendations**:
- Review transformation mapping rules
- Update transformation logic if needed
- Verify differences are acceptable

#### Query Result Mismatches

**Issue**: Equivalent queries return different results

**Possible Causes**:
- Indexes not implemented correctly in Convex
- Query translation logic has bugs
- Data inconsistency between systems

**Recommendations**:
- Verify Convex indexes match Firebase query patterns
- Review query implementation
- Investigate data inconsistency

### Convex Verification Actions

The verification script uses these Convex actions for read-only data access:

#### Collection Operations

- `verification:getCollectionCounts` - Get document counts for all collections
- `verification:getCollectionCount` - Get count for a specific collection
- `verification:getDocumentByOriginalId` - Retrieve document by original Firebase ID
- `verification:getDocumentsByField` - Retrieve documents by field value
- `verification:getDocumentSample` - Get a random sample of documents

#### Integrity Checks

- `verification:getReferentialIntegrity` - Check references for a specific collection
- `verification:getAllOrphanedRecords` - Get all orphaned records across collections

#### Field Validation

- `verification:verifyCollectionFields` - Verify field values for a specific document
- `verification:validateCollectionFields` - Validate required fields in a collection

#### Query Tests

- `verification:queryUsersByEmail` - Test query by email
- `verification:queryUsersByStatus` - Test query by status
- `verification:queryEventsByDateRange` - Test date range query
- `verification:queryReimbursementsByStatus` - Test status filter query

#### File Verification

- `verification:getBlobFileChecksum` - Get checksum of a stored blob
- `verification:verifyBlobChecksums` - Verify multiple blob checksums at once

### Example Workflow

Complete migration and verification workflow:

```bash
# 1. Export from Firebase
npx tsx scripts/migrate/export-firestore.ts

# 2. Transform for Convex
npx tsx scripts/migrate/transform.ts

# 3. Import to Convex
npx tsx scripts/migrate/import-convex.ts

# 4. Migrate files (if applicable)
bun run scripts/migrate/migrate-files.ts

# 5. Verify migration
npx tsx scripts/migrate/verify-migration.ts --verbose --format html
```

### Troubleshooting Verification

#### Firebase Connection Failed

**Error**: `FIREBASE_PROJECT_ID environment variable is required`

**Solution**: Set required Firebase environment variables
```bash
export FIREBASE_PROJECT_ID="your-project-id"
export FIREBASE_CLIENT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
export FIREBASE_PRIVATE_KEY="..."
```

#### Convex Connection Failed

**Error**: `CONVEX_URL or VITE_CONVEX_URL environment variable is required`

**Solution**: Set Convex deployment URL
```bash
export CONVEX_URL="https://your-deployment.convex.cloud"
# or
export VITE_CONVEX_URL="https://your-deployment.convex.cloud"
```

#### Permission Denied Errors

**Error**: `PERMISSION_DENIED: Missing or insufficient permissions`

**Solution**:
- Verify Firebase service account has Admin SDK role
- Check Convex deployment URL is correct
- Ensure both Firebase and Convex environments are accessible

#### Verification Takes Too Long

**Solution**:
- Verify specific collections instead of all: `--collection users`
- Reduce sample size: `--sample-size 5`
- Run specific checks only: `--check record_count`

## Support

For issues or questions related to this migration:

1. Check the troubleshooting section above
2. Review schema documentation
3. Consult Firebase Admin SDK documentation
4. Contact the development team
