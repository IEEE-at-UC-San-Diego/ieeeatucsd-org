import type { APIRoute } from "astro";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { app } from "../../../firebase/server";

const db = getFirestore(app);
const storage = getStorage(app);

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

export const POST: APIRoute = async () => {
  try {
    console.log("Migration API called");

    const result: MigrationResult = {
      success: false,
      migratedFiles: 0,
      errors: [],
      skippedFiles: 0,
      updatedDocuments: 0,
    };

    // Get files to migrate from preview endpoint logic
    const filesToMigrate = await getFilesToMigrate();
    console.log(`Found ${filesToMigrate.length} files to migrate`);

    // Migrate files in batches
    const batchSize = 10;
    for (let i = 0; i < filesToMigrate.length; i += batchSize) {
      const batch = filesToMigrate.slice(i, i + batchSize);
      const batchResult = await migrateBatch(batch);

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

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Migration failed:", error);
    return new Response(
      JSON.stringify({ error: `Migration failed: ${error}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

async function getFilesToMigrate(): Promise<FileToMigrate[]> {
  const filesToMigrate: FileToMigrate[] = [];

  console.log("🔍 Migration: Fetching event requests...");
  // Get all event requests
  const eventRequestsSnapshot = await db.collection("event_requests").get();
  console.log(
    `📊 Migration: Found ${eventRequestsSnapshot.docs.length} event requests`,
  );

  for (const eventRequestDoc of eventRequestsSnapshot.docs) {
    const eventRequest = eventRequestDoc.data();
    const eventRequestId = eventRequestDoc.id;

    await processEventRequestFiles(
      eventRequest,
      eventRequestId,
      filesToMigrate,
    );
  }

  console.log("📋 Migration: Fetching events...");
  // Get all events
  const eventsSnapshot = await db.collection("events").get();
  console.log(`📊 Migration: Found ${eventsSnapshot.docs.length} events`);

  for (const eventDoc of eventsSnapshot.docs) {
    const event = eventDoc.data();
    const eventId = eventDoc.id;

    if (event.files && Array.isArray(event.files)) {
      console.log(
        `📁 Migration: Event ${eventId} has ${event.files.length} files`,
      );
      for (const fileUrl of event.files) {
        if (isUserBasedPath(fileUrl)) {
          console.log(
            `🔄 Migration: Found user-based file in event: ${fileUrl}`,
          );
          filesToMigrate.push({
            oldPath: extractStoragePathFromUrl(fileUrl),
            newPath: `events/${eventId}/general/${extractFilenameFromUrl(fileUrl)}`,
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

  console.log(`✅ Migration: Found ${filesToMigrate.length} files to migrate`);
  return filesToMigrate;
}

async function migrateBatch(batch: FileToMigrate[]): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    migratedFiles: 0,
    errors: [],
    skippedFiles: 0,
    updatedDocuments: 0,
  };

  const firestoreBatch = db.batch();
  const urlMappings: { [oldUrl: string]: string } = {};

  for (const fileToMigrate of batch) {
    try {
      console.log(`🔄 Processing file migration:`);
      console.log(`   Old path: ${fileToMigrate.oldPath}`);
      console.log(`   New path: ${fileToMigrate.newPath}`);
      console.log(`   Original URL: ${fileToMigrate.url}`);

      // Download file from old location using Admin SDK
      const bucket = storage.bucket("ieee-at-uc-san-diego.firebasestorage.app");
      const oldFile = bucket.file(fileToMigrate.oldPath);
      const newFile = bucket.file(fileToMigrate.newPath);

      const [oldExists] = await oldFile.exists();
      console.log(`   Old file exists: ${oldExists}`);

      if (!oldExists) {
        console.log(
          `❌ Skipping: Old file does not exist at ${fileToMigrate.oldPath}`,
        );
        result.skippedFiles++;
        continue;
      }

      const [newExists] = await newFile.exists();
      console.log(`   New file exists: ${newExists}`);

      if (newExists) {
        console.log(
          `⏭️ Skipping: New file already exists at ${fileToMigrate.newPath}`,
        );
        result.skippedFiles++;
        continue;
      }

      console.log(`📥 Downloading file from ${fileToMigrate.oldPath}`);
      const [fileData] = await oldFile.download();

      // Upload to new location
      console.log(`📤 Uploading file to ${fileToMigrate.newPath}`);
      await newFile.save(fileData);

      // Note: Skipping makePublic() due to uniform bucket-level access

      // Get new download URL
      const newUrl = `https://storage.googleapis.com/${bucket.name}/${fileToMigrate.newPath}`;

      // Store URL mapping for database updates
      urlMappings[fileToMigrate.url] = newUrl;

      // Delete old file
      await oldFile.delete();

      result.migratedFiles++;
    } catch (error) {
      console.error(`Failed to migrate file ${fileToMigrate.oldPath}:`, error);
      result.errors.push(
        `Failed to migrate ${fileToMigrate.oldPath}: ${error}`,
      );
    }
  }

  // Update database references
  await updateDatabaseReferences(batch, urlMappings, firestoreBatch);
  await firestoreBatch.commit();
  result.updatedDocuments = batch.length;

  return result;
}

async function updateDatabaseReferences(
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
      documentUpdates[fileToMigrate.documentRef][fileToMigrate.field] = newUrl;
    }
  }

  // Apply updates to Firestore batch
  for (const [docPath, updates] of Object.entries(documentUpdates)) {
    const docRef = db.doc(docPath);

    // Get current document to handle array updates properly
    const docSnapshot = await docRef.get();
    if (docSnapshot.exists) {
      const currentData = docSnapshot.data();
      const updateData: any = {};

      for (const [field, value] of Object.entries(updates)) {
        if (Array.isArray(value)) {
          // Handle array field updates
          const currentArray = currentData?.[field] || [];
          const updatedArray = [...currentArray];

          for (const urlMapping of value as any[]) {
            const index = updatedArray.indexOf(urlMapping.oldUrl);
            if (index !== -1) {
              updatedArray[index] = urlMapping.newUrl;
            }
          }
          updateData[field] = updatedArray;
        } else {
          // Handle single value updates
          updateData[field] = value;
        }
      }

      firestoreBatch.update(docRef, updateData);
    }
  }
}

// Helper functions (same as preview.ts)
async function processEventRequestFiles(
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
      if (typeof fileUrl === "string") {
        console.log(`🔍 Migration: Checking file URL: ${fileUrl}`);
        if (isUserBasedPath(fileUrl)) {
          console.log(
            `🔄 Migration: Found user-based file in event request: ${fileUrl}`,
          );
          filesToMigrate.push({
            oldPath: extractStoragePathFromUrl(fileUrl),
            newPath: `events/${eventRequestId}/${category}/${extractFilenameFromUrl(fileUrl)}`,
            url: fileUrl,
            eventId: eventRequestId,
            category: category,
            documentRef: `event_requests/${eventRequestId}`,
            field: field,
          });
        } else {
          console.log(`✅ Migration: File already event-based: ${fileUrl}`);
        }
      }
    }
  }
}

function isUserBasedPath(url: string): boolean {
  // Check for user-based paths in Firebase Storage URLs
  // These patterns indicate files stored by user ID rather than event ID
  const userBasedPatterns = [
    // URL-encoded patterns (most common)
    "invoices%2F",
    "room_bookings%2F",
    "logos%2F",
    "resumes%2F",
    "fund_deposits%2F",
    "graphics%2F",
    // Non-encoded patterns (fallback)
    "/invoices/",
    "/room_bookings/",
    "/logos/",
    "/resumes/",
    "/fund_deposits/",
    "/graphics/",
  ];

  const hasUserBasedPattern = userBasedPatterns.some((pattern) =>
    url.includes(pattern),
  );

  // Additional check: if it contains a user-based pattern, make sure it's not already event-based
  if (hasUserBasedPattern) {
    // If it contains "events%2F" or "/events/", it's already event-based
    const isAlreadyEventBased =
      url.includes("events%2F") || url.includes("/events/");
    return !isAlreadyEventBased;
  }

  return false;
}

function extractStoragePathFromUrl(url: string): string {
  const match = url.match(/\/o\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function extractFilenameFromUrl(url: string): string {
  const path = extractStoragePathFromUrl(url);
  return path.split("/").pop() || "unknown_file";
}
