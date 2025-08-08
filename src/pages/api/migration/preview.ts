import type { APIRoute } from "astro";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { app } from "../../../firebase/server";

const db = getFirestore(app);
const storage = getStorage(app);

interface FileToMigrate {
  oldPath: string;
  newPath: string;
  url: string;
  eventId: string;
  category: string;
  documentRef: string;
  field: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log("🔍 Migration preview API called");

    const filesToMigrate: FileToMigrate[] = [];

    // Get all event requests
    console.log("📋 Fetching event requests...");
    const eventRequestsSnapshot = await db.collection("event_requests").get();
    console.log(`📊 Found ${eventRequestsSnapshot.docs.length} event requests`);

    for (const eventRequestDoc of eventRequestsSnapshot.docs) {
      const eventRequest = eventRequestDoc.data();
      const eventRequestId = eventRequestDoc.id;

      // Log file fields for debugging
      const fileFields = [
        "roomBookingFiles",
        "invoiceFiles",
        "otherLogos",
        "invoice",
      ];
      const hasFiles = fileFields.some((field) => eventRequest[field]);
      if (hasFiles) {
        console.log(`📁 Event request ${eventRequestId} has files:`, {
          roomBookingFiles: eventRequest.roomBookingFiles
            ? Array.isArray(eventRequest.roomBookingFiles)
              ? eventRequest.roomBookingFiles.length
              : 1
            : 0,
          invoiceFiles: eventRequest.invoiceFiles
            ? Array.isArray(eventRequest.invoiceFiles)
              ? eventRequest.invoiceFiles.length
              : 1
            : 0,
          otherLogos: eventRequest.otherLogos
            ? Array.isArray(eventRequest.otherLogos)
              ? eventRequest.otherLogos.length
              : 1
            : 0,
          invoice: eventRequest.invoice ? 1 : 0,
        });
      }

      // Process different file types
      await processEventRequestFiles(
        eventRequest,
        eventRequestId,
        filesToMigrate,
      );
    }

    // Get all events
    console.log("📋 Fetching events...");
    const eventsSnapshot = await db.collection("events").get();
    console.log(`📊 Found ${eventsSnapshot.docs.length} events`);

    for (const eventDoc of eventsSnapshot.docs) {
      const event = eventDoc.data();
      const eventId = eventDoc.id;

      // Process event files
      if (event.files && Array.isArray(event.files)) {
        console.log(`📁 Event ${eventId} has ${event.files.length} files`);
        for (const fileUrl of event.files) {
          if (isUserBasedPath(fileUrl)) {
            console.log(`🔄 Found user-based file in event: ${fileUrl}`);
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

    console.log(
      `✅ Migration preview complete: ${filesToMigrate.length} files to migrate`,
    );
    return new Response(JSON.stringify(filesToMigrate), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Migration preview failed:", error);
    return new Response(
      JSON.stringify({ error: `Migration preview failed: ${error}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

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
      if (typeof fileUrl === "string" && isUserBasedPath(fileUrl)) {
        filesToMigrate.push({
          oldPath: extractStoragePathFromUrl(fileUrl),
          newPath: `events/${eventRequestId}/${category}/${extractFilenameFromUrl(fileUrl)}`,
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

  // If it has a user-based pattern, it needs migration UNLESS it's already in events structure
  if (hasUserBasedPattern) {
    // If it contains "events%2F" or "/events/", it's already event-based
    const isAlreadyEventBased =
      url.includes("events%2F") || url.includes("/events/");

    // Return true if it has user-based pattern AND is NOT already event-based
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
