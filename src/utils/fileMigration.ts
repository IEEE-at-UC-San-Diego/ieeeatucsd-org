import {
  getFirestore,
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  getStorage,
  ref,
  getDownloadURL,
  uploadBytes,
  deleteObject,
  listAll,
} from "firebase/storage";
import { app } from "../firebase/client";

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
  private db = getFirestore(app);
  private storage = getStorage(app);

  /**
   * Main migration function - migrates all files from user-based to event-based structure
   */
  async migrateAllFiles(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedFiles: 0,
      errors: [],
      skippedFiles: 0,
      updatedDocuments: 0,
    };

    try {
      console.log(
        "Starting file migration from user-based to event-based structure...",
      );

      // Step 1: Identify all files that need migration
      const filesToMigrate = await this.identifyFilesToMigrate();
      console.log(`Found ${filesToMigrate.length} files to migrate`);

      // Step 2: Migrate files in batches
      const batchSize = 10;
      for (let i = 0; i < filesToMigrate.length; i += batchSize) {
        const batch = filesToMigrate.slice(i, i + batchSize);
        const batchResult = await this.migrateBatch(batch);

        result.migratedFiles += batchResult.migratedFiles;
        result.errors.push(...batchResult.errors);
        result.skippedFiles += batchResult.skippedFiles;
        result.updatedDocuments += batchResult.updatedDocuments;

        console.log(
          `Migrated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(filesToMigrate.length / batchSize)}`,
        );
      }

      result.success = result.errors.length === 0;
      console.log("Migration completed:", result);
      return result;
    } catch (error) {
      console.error("Migration failed:", error);
      result.errors.push(`Migration failed: ${error}`);
      return result;
    }
  }

  /**
   * Identify all files that need to be migrated
   */
  private async identifyFilesToMigrate(): Promise<FileToMigrate[]> {
    const filesToMigrate: FileToMigrate[] = [];

    // Get all event requests
    const eventRequestsSnapshot = await getDocs(
      collection(this.db, "event_requests"),
    );

    for (const eventRequestDoc of eventRequestsSnapshot.docs) {
      const eventRequest = eventRequestDoc.data();
      const eventRequestId = eventRequestDoc.id;

      // Process different file types
      await this.processEventRequestFiles(
        eventRequest,
        eventRequestId,
        filesToMigrate,
      );
    }

    // Get all events
    const eventsSnapshot = await getDocs(collection(this.db, "events"));

    for (const eventDoc of eventsSnapshot.docs) {
      const event = eventDoc.data();
      const eventId = eventDoc.id;

      // Process event files
      if (event.files && Array.isArray(event.files)) {
        for (const fileUrl of event.files) {
          if (this.isUserBasedPath(fileUrl)) {
            filesToMigrate.push({
              oldPath: this.extractStoragePathFromUrl(fileUrl),
              newPath: `events/${eventId}/general/${this.extractFilenameFromUrl(fileUrl)}`,
              url: fileUrl,
              eventId: eventId,
              category: "general",
              documentRef: `events/${eventId}`,
              field: "files",
            });
          }
        }
      }
    }

    return filesToMigrate;
  }

  /**
   * Process files from event requests
   */
  private async processEventRequestFiles(
    eventRequest: any,
    eventRequestId: string,
    filesToMigrate: FileToMigrate[],
  ): Promise<void> {
    const fileFields = [
      { field: "roomBookingFiles", category: "room_booking" },
      { field: "invoiceFiles", category: "invoice" },
      { field: "otherLogos", category: "logo" },
      { field: "invoice", category: "invoice" },
    ];

    for (const { field, category } of fileFields) {
      const files = eventRequest[field];
      if (!files) continue;

      const fileUrls = Array.isArray(files) ? files : [files];

      for (const fileUrl of fileUrls) {
        if (typeof fileUrl === "string" && this.isUserBasedPath(fileUrl)) {
          filesToMigrate.push({
            oldPath: this.extractStoragePathFromUrl(fileUrl),
            newPath: `events/${eventRequestId}/${category}/${this.extractFilenameFromUrl(fileUrl)}`,
            url: fileUrl,
            eventId: eventRequestId,
            category: category,
            documentRef: `event_requests/${eventRequestId}`,
            field: field,
          });
        }
      }
    }
  }

  /**
   * Migrate a batch of files
   */
  private async migrateBatch(batch: FileToMigrate[]): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      migratedFiles: 0,
      errors: [],
      skippedFiles: 0,
      updatedDocuments: 0,
    };

    const firestoreBatch = writeBatch(this.db);
    const urlMappings: { [oldUrl: string]: string } = {};

    for (const fileToMigrate of batch) {
      try {
        // Download file from old location
        const oldRef = ref(this.storage, fileToMigrate.oldPath);
        const fileData = await this.downloadFile(oldRef);

        if (!fileData) {
          result.skippedFiles++;
          continue;
        }

        // Upload to new location
        const newRef = ref(this.storage, fileToMigrate.newPath);
        await uploadBytes(newRef, fileData);
        const newUrl = await getDownloadURL(newRef);

        // Store URL mapping for database updates
        urlMappings[fileToMigrate.url] = newUrl;

        // Delete old file
        await deleteObject(oldRef);

        result.migratedFiles++;
      } catch (error) {
        console.error(
          `Failed to migrate file ${fileToMigrate.oldPath}:`,
          error,
        );
        result.errors.push(
          `Failed to migrate ${fileToMigrate.oldPath}: ${error}`,
        );
      }
    }

    // Update database references
    await this.updateDatabaseReferences(batch, urlMappings, firestoreBatch);
    await firestoreBatch.commit();
    result.updatedDocuments = batch.length;

    return result;
  }

  /**
   * Update database references with new URLs
   */
  private async updateDatabaseReferences(
    batch: FileToMigrate[],
    urlMappings: { [oldUrl: string]: string },
    firestoreBatch: any,
  ): Promise<void> {
    const documentUpdates: { [docRef: string]: any } = {};

    // Group updates by document
    for (const fileToMigrate of batch) {
      const newUrl = urlMappings[fileToMigrate.url];
      if (!newUrl) continue;

      if (!documentUpdates[fileToMigrate.documentRef]) {
        documentUpdates[fileToMigrate.documentRef] = {};
      }

      // Handle array fields vs single value fields
      if (
        fileToMigrate.field === "files" ||
        fileToMigrate.field.endsWith("Files")
      ) {
        // Array field - need to replace specific URL
        if (!documentUpdates[fileToMigrate.documentRef][fileToMigrate.field]) {
          documentUpdates[fileToMigrate.documentRef][fileToMigrate.field] = [];
        }
        documentUpdates[fileToMigrate.documentRef][fileToMigrate.field].push({
          oldUrl: fileToMigrate.url,
          newUrl: newUrl,
        });
      } else {
        // Single value field
        documentUpdates[fileToMigrate.documentRef][fileToMigrate.field] =
          newUrl;
      }
    }

    // Apply updates to Firestore batch
    for (const [docRef, updates] of Object.entries(documentUpdates)) {
      const docReference = doc(this.db, docRef);

      // Process array field updates
      const processedUpdates: any = {};
      for (const [field, value] of Object.entries(updates)) {
        if (Array.isArray(value)) {
          // This is an array field update - we need to get current data and update
          processedUpdates[field] = value; // Will be processed separately
        } else {
          processedUpdates[field] = value;
        }
      }

      firestoreBatch.update(docReference, processedUpdates);
    }
  }

  /**
   * Helper methods
   */
  private isUserBasedPath(url: string): boolean {
    // Check if URL contains user-based path patterns
    return (
      /\/(invoices|room_bookings|logos|reimbursements|fund_deposits|graphics)\/[^\/]+\//.test(
        url,
      ) ||
      /\/event_files\/[^\/]+\/[^\/]+\//.test(url) ||
      /\/private_files\/[^\/]+\/[^\/]+\//.test(url)
    );
  }

  private extractStoragePathFromUrl(url: string): string {
    // Extract storage path from Firebase Storage URL
    const match = url.match(/\/o\/(.+?)\?/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  private extractFilenameFromUrl(url: string): string {
    const path = this.extractStoragePathFromUrl(url);
    return path.split("/").pop() || "unknown_file";
  }

  private async downloadFile(storageRef: any): Promise<ArrayBuffer | null> {
    try {
      const directUrl = await getDownloadURL(storageRef);
      const isBrowser = typeof window !== "undefined";
      const url = isBrowser
        ? `/api/storage-proxy?url=${encodeURIComponent(directUrl)}`
        : directUrl;
      const response = await fetch(url);
      return await response.arrayBuffer();
    } catch (error) {
      console.error("Failed to download file:", error);
      return null;
    }
  }

  /**
   * Dry run - preview what would be migrated without actually doing it
   */
  async previewMigration(): Promise<FileToMigrate[]> {
    return await this.identifyFilesToMigrate();
  }

  /**
   * Clean up temporary files created during event request creation
   */
  async cleanupTemporaryFiles(): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedFiles: 0,
      errors: [],
      skippedFiles: 0,
      updatedDocuments: 0,
    };

    try {
      console.log("Cleaning up temporary files...");

      // List all files in the events folder
      const eventsRef = ref(this.storage, "events");
      const eventsList = await listAll(eventsRef);

      for (const eventFolderRef of eventsList.prefixes) {
        const eventId = eventFolderRef.name;

        // Check if this is a temporary event ID
        if (eventId.startsWith("temp_")) {
          console.log(`Found temporary event folder: ${eventId}`);

          // Try to find the corresponding actual event request
          const actualEventId = await this.findActualEventId(eventId);

          if (actualEventId) {
            // Move files from temp to actual location
            await this.moveTemporaryEventFiles(eventId, actualEventId);
            result.migratedFiles++;
          } else {
            // Delete orphaned temporary files
            await this.deleteTemporaryEventFiles(eventId);
            result.skippedFiles++;
          }
        }
      }

      result.success = true;
      console.log("Temporary file cleanup completed:", result);
      return result;
    } catch (error) {
      console.error("Temporary file cleanup failed:", error);
      result.errors.push(`Cleanup failed: ${error}`);
      return result;
    }
  }

  /**
   * Find the actual event ID for a temporary event ID
   */
  private async findActualEventId(tempEventId: string): Promise<string | null> {
    try {
      // Extract timestamp and user ID from temp ID
      const parts = tempEventId.split("_");
      if (parts.length < 3) return null;

      const timestamp = parseInt(parts[1]);
      const userId = parts[2];

      // Look for event requests created around the same time by the same user
      const eventRequestsSnapshot = await getDocs(
        query(
          collection(this.db, "event_requests"),
          where("requestedUser", "==", userId),
        ),
      );

      for (const doc of eventRequestsSnapshot.docs) {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.() || data.createdAt;

        if (createdAt && Math.abs(createdAt.getTime() - timestamp) < 60000) {
          // Within 1 minute
          return doc.id;
        }
      }

      return null;
    } catch (error) {
      console.error("Error finding actual event ID:", error);
      return null;
    }
  }

  /**
   * Move files from temporary event folder to actual event folder
   */
  private async moveTemporaryEventFiles(
    tempEventId: string,
    actualEventId: string,
  ): Promise<void> {
    try {
      const tempFolderRef = ref(this.storage, `events/${tempEventId}`);
      const tempFilesList = await listAll(tempFolderRef);

      // Process all categories in the temp folder
      for (const categoryRef of tempFilesList.prefixes) {
        const categoryName = categoryRef.name;
        const categoryFilesList = await listAll(categoryRef);

        for (const fileRef of categoryFilesList.items) {
          const fileName = fileRef.name;
          const newPath = `events/${actualEventId}/${categoryName}/${fileName}`;

          // Download file
          const fileData = await this.downloadFile(fileRef);
          if (!fileData) continue;

          // Upload to new location
          const newRef = ref(this.storage, newPath);
          await uploadBytes(newRef, fileData);

          // Delete old file
          await deleteObject(fileRef);
        }
      }

      console.log(`Moved files from ${tempEventId} to ${actualEventId}`);
    } catch (error) {
      console.error(`Error moving temporary files for ${tempEventId}:`, error);
      throw error;
    }
  }

  /**
   * Delete orphaned temporary event files
   */
  private async deleteTemporaryEventFiles(tempEventId: string): Promise<void> {
    try {
      const tempFolderRef = ref(this.storage, `events/${tempEventId}`);
      const tempFilesList = await listAll(tempFolderRef);

      // Delete all files in all categories
      for (const categoryRef of tempFilesList.prefixes) {
        const categoryFilesList = await listAll(categoryRef);

        for (const fileRef of categoryFilesList.items) {
          await deleteObject(fileRef);
        }
      }

      console.log(`Deleted orphaned temporary files for ${tempEventId}`);
    } catch (error) {
      console.error(
        `Error deleting temporary files for ${tempEventId}:`,
        error,
      );
    }
  }

  /**
   * Rollback migration (if needed)
   */
  async rollbackMigration(): Promise<MigrationResult> {
    // Implementation for rollback would go here
    // This would reverse the migration process
    throw new Error("Rollback not implemented yet");
  }
}
