# File Storage Migration Guide

## Overview

This guide documents the migration from user-based file organization to event-based file organization in Firebase Storage. The new system organizes files by event ID instead of user ID, making file management more logical for event-centric workflows.

## Migration Summary

### Before (User-Based Structure)

```
/invoices/{userId}/{filename}
/room_bookings/{userId}/{filename}
/logos/{userId}/{filename}
/reimbursements/{userId}/{filename}
/fund_deposits/{userId}/{filename}
/graphics/{userId}/{filename}
```

### After (Event-Based Structure)

```
/events/{eventId}/invoice/{filename}
/events/{eventId}/room_booking/{filename}
/events/{eventId}/logo/{filename}
/events/{eventId}/graphics/{filename}
/events/{eventId}/general/{filename}
```

## Key Changes

### 1. File Upload Utilities

- **New Function**: `uploadFilesForEvent(files, eventId, category)`
- **Legacy Function**: `uploadFiles()` (kept for backward compatibility)
- **Helper Functions**:
  - `generateEventFilePath()`
  - `extractEventIdFromPath()`
  - `extractCategoryFromPath()`
  - `moveFilesToActualEventId()`

### 2. Updated Components

- `FileManagementModal.tsx` - Now uses event-based uploads
- `EventRequestModal.tsx` - Handles temporary IDs for new requests
- `GraphicsUploadModal.tsx` - Uses event ID when available
- `ReimbursementRequestModal.tsx` - Kept user-based (not event-specific)
- `FundDepositsContent.tsx` - Kept user-based (not event-specific)

### 3. Firebase Storage Rules

- Added new rules for `/events/{eventId}/{category}/` paths
- Maintained legacy rules during migration period
- Added helper functions for event ownership and public access

### 4. Migration Script

- **Location**: `src/utils/fileMigration.ts`
- **Runner**: `src/scripts/runFileMigration.ts`
- **Features**:
  - Preview migration without changes
  - Batch file migration with error handling
  - Temporary file cleanup
  - Database reference updates

## Migration Process

### Step 1: Preview Migration

```bash
npm run migration:preview
# or
node src/scripts/runFileMigration.js preview
```

This will show:

- Number of files to migrate
- Events affected
- Files by category
- Sample migration paths

### Step 2: Run Migration

```bash
npm run migration:migrate
# or
node src/scripts/runFileMigration.js migrate
```

This will:

- Move files from user-based to event-based structure
- Update database references
- Maintain file integrity
- Provide detailed progress reports

### Step 3: Clean Up Temporary Files

```bash
npm run migration:cleanup
# or
node src/scripts/runFileMigration.js cleanup
```

This will:

- Find temporary event folders (temp_xxx)
- Move files to actual event IDs
- Delete orphaned temporary files

## File Categories

| Category       | Description                | Used For                               |
| -------------- | -------------------------- | -------------------------------------- |
| `invoice`      | Invoice files and receipts | Event invoices, payment documentation  |
| `room_booking` | Room booking confirmations | Venue reservations, space bookings     |
| `logo`         | Logo and branding files    | Event logos, sponsor logos             |
| `graphics`     | Graphics and design files  | Flyers, posters, promotional materials |
| `general`      | General event files        | Miscellaneous event-related documents  |

## Handling New Event Requests

When creating new event requests, the system:

1. **Generates Temporary ID**: `temp_{timestamp}_{userId}`
2. **Uploads Files**: Files are uploaded to temporary location
3. **Creates Event Request**: Database document is created
4. **Moves Files**: Files are moved from temp to actual event ID
5. **Updates References**: Database references are updated with new URLs

## Error Handling

The migration system includes comprehensive error handling:

- **File Download Failures**: Skipped with logging
- **Upload Failures**: Retried with exponential backoff
- **Database Update Failures**: Rolled back with error reporting
- **Partial Migrations**: Can be resumed from where they left off

## Rollback Strategy

If migration issues occur:

1. **Stop Migration**: Cancel any running migration processes
2. **Restore Backup**: Restore Firebase Storage from backup
3. **Reset Database**: Revert database references to original URLs
4. **Investigate**: Review error logs and fix issues
5. **Retry**: Run migration again with fixes

## Testing

### Before Migration

1. Create test event requests with files
2. Verify file uploads work correctly
3. Test file retrieval and display
4. Check file permissions

### After Migration

1. Verify all files are accessible
2. Test new file uploads use event-based structure
3. Confirm old URLs still work (during transition)
4. Validate file permissions are maintained

## Monitoring

Monitor the following during and after migration:

- **Storage Usage**: Check for duplicate files
- **Error Rates**: Monitor file upload/download errors
- **Performance**: Measure file access times
- **User Reports**: Track user-reported file issues

## Support

For issues during migration:

1. Check migration logs for specific errors
2. Verify Firebase Storage rules are deployed
3. Ensure user permissions are correct
4. Contact development team with error details

## Timeline

- **Phase 1**: Deploy new upload utilities (✅ Complete)
- **Phase 2**: Update Firebase Storage rules (✅ Complete)
- **Phase 3**: Update file upload components (✅ Complete)
- **Phase 4**: Run migration script (⏳ Ready)
- **Phase 5**: Update file retrieval logic (🔄 In Progress)
- **Phase 6**: Clean up legacy code (📋 Planned)
- **Phase 7**: Remove legacy storage rules (📋 Planned)
