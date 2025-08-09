// Client-side service that calls server-side migration APIs
// This eliminates CORS issues by using Firebase Admin SDK on the server

interface MigrationResult {
  success: boolean;
  migratedFiles: number;
  errors: string[];
  skippedFiles: number;
  updatedDocuments: number;
}

interface FileToMigrate {
  oldPath: string;
  newPath: string;
  url: string;
  eventId: string;
  category: string;
  documentRef: string;
  field: string;
}

export class FileMigrationService {
  /**
   * Main migration function - migrates all files from user-based to event-based structure
   * Now uses server-side APIs with Firebase Admin SDK
   */
  async migrateAllFiles(): Promise<MigrationResult> {
    try {
      const response = await fetch("/api/migration/migrate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Migration API failed: ${response.statusText}`);
      }

      const result: MigrationResult = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        migratedFiles: 0,
        errors: [`Migration failed: ${error}`],
        skippedFiles: 0,
        updatedDocuments: 0,
      };
    }
  }

  /**
   * Preview migration - shows what files would be migrated without actually doing it
   * Now uses server-side API
   */
  async previewMigration(): Promise<FileToMigrate[]> {
    try {
      const response = await fetch("/api/migration/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Preview API failed: ${response.statusText}`);
      }

      const filesToMigrate: FileToMigrate[] = await response.json();
      return filesToMigrate;
    } catch (error) {
      return [];
    }
  }

  /**
   * Clean up temporary files and move them to proper event locations
   * Now uses server-side API
   */
  async cleanupTemporaryFiles(): Promise<MigrationResult> {
    try {
      const response = await fetch("/api/migration/cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Cleanup API failed: ${response.statusText}`);
      }

      const result: MigrationResult = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        migratedFiles: 0,
        errors: [`Cleanup failed: ${error}`],
        skippedFiles: 0,
        updatedDocuments: 0,
      };
    }
  }
}
