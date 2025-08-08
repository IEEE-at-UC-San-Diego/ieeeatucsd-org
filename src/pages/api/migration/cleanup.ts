import type { APIRoute } from "astro";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { app } from "../../../firebase/server";

const db = getFirestore(app);
const storage = getStorage(app);

interface CleanupResult {
  success: boolean;
  migratedFiles: number;
  errors: string[];
  skippedFiles: number;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log("Migration cleanup API called");

    const result: CleanupResult = {
      success: false,
      migratedFiles: 0,
      errors: [],
      skippedFiles: 0,
    };

    const bucket = storage.bucket();
    
    // List all files in the events folder to find temporary event folders
    const [files] = await bucket.getFiles({ prefix: "events/" });
    
    // Group files by event folder
    const eventFolders = new Set<string>();
    for (const file of files) {
      const pathParts = file.name.split("/");
      if (pathParts.length >= 2 && pathParts[0] === "events") {
        eventFolders.add(pathParts[1]);
      }
    }

    for (const eventId of eventFolders) {
      if (eventId.startsWith("temp_")) {
        console.log(`Found temporary event folder: ${eventId}`);

        // Try to find the corresponding actual event request
        const actualEventId = await findActualEventId(eventId);

        if (actualEventId) {
          // Move files from temp to actual location
          await moveTemporaryEventFiles(eventId, actualEventId);
          result.migratedFiles++;
        } else {
          // Delete orphaned temporary files
          await deleteTemporaryEventFiles(eventId);
          result.skippedFiles++;
        }
      }
    }

    result.success = result.errors.length === 0;
    console.log("Cleanup completed:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Cleanup failed:", error);
    return new Response(
      JSON.stringify({ error: `Cleanup failed: ${error}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

async function findActualEventId(tempEventId: string): Promise<string | null> {
  try {
    // Look for event request with matching temporary ID in metadata
    const eventRequestsSnapshot = await db
      .collection("event_requests")
      .where("tempEventId", "==", tempEventId)
      .get();

    if (!eventRequestsSnapshot.empty) {
      return eventRequestsSnapshot.docs[0].id;
    }

    // Fallback: look for similar event names or other identifying data
    // This would need to be customized based on your specific data structure
    return null;
  } catch (error) {
    console.error(`Error finding actual event ID for ${tempEventId}:`, error);
    return null;
  }
}

async function moveTemporaryEventFiles(
  tempEventId: string,
  actualEventId: string,
): Promise<void> {
  try {
    const bucket = storage.bucket();
    const tempPrefix = `events/${tempEventId}/`;
    
    // List all files in the temporary event folder
    const [tempFiles] = await bucket.getFiles({ prefix: tempPrefix });

    for (const tempFile of tempFiles) {
      try {
        // Calculate new path
        const relativePath = tempFile.name.substring(tempPrefix.length);
        const newPath = `events/${actualEventId}/${relativePath}`;

        // Download file data
        const [fileData] = await tempFile.download();

        // Upload to new location
        const newFile = bucket.file(newPath);
        await newFile.save(fileData);

        // Copy metadata if needed
        const [metadata] = await tempFile.getMetadata();
        if (metadata.contentType) {
          await newFile.setMetadata({
            contentType: metadata.contentType,
          });
        }

        // Delete old file
        await tempFile.delete();

        console.log(`Moved ${tempFile.name} to ${newPath}`);
      } catch (error) {
        console.error(`Failed to move file ${tempFile.name}:`, error);
        throw error;
      }
    }
  } catch (error) {
    console.error(
      `Error moving temporary event files from ${tempEventId} to ${actualEventId}:`,
      error,
    );
    throw error;
  }
}

async function deleteTemporaryEventFiles(tempEventId: string): Promise<void> {
  try {
    const bucket = storage.bucket();
    const tempPrefix = `events/${tempEventId}/`;
    
    // List all files in the temporary event folder
    const [tempFiles] = await bucket.getFiles({ prefix: tempPrefix });

    for (const tempFile of tempFiles) {
      try {
        await tempFile.delete();
        console.log(`Deleted orphaned file: ${tempFile.name}`);
      } catch (error) {
        console.error(`Failed to delete file ${tempFile.name}:`, error);
        // Continue with other files even if one fails
      }
    }

    console.log(`Cleaned up temporary event folder: ${tempEventId}`);
  } catch (error) {
    console.error(`Error deleting temporary event files for ${tempEventId}:`, error);
    throw error;
  }
}
