import { convex } from "./config.js";

/**
 * Download a file from a Firebase Storage URL and re-upload it to Convex storage.
 * Returns the new Convex storage URL, or null if the migration fails.
 */
export async function migrateFileUrl(
  firebaseUrl: string,
  dryRun: boolean,
): Promise<string | null> {
  if (!firebaseUrl || typeof firebaseUrl !== "string") return null;

  // Skip non-Firebase URLs (already migrated or external)
  if (!firebaseUrl.includes("firebasestorage") && !firebaseUrl.includes("googleapis.com")) {
    return firebaseUrl;
  }

  if (dryRun) {
    console.log(`    [DRY RUN] Would migrate file: ${firebaseUrl.substring(0, 80)}...`);
    return firebaseUrl;
  }

  try {
    // Step 1: Download the file from Firebase
    const response = await fetch(firebaseUrl);
    if (!response.ok) {
      console.warn(`    ⚠️  Failed to download file: ${response.status} ${firebaseUrl.substring(0, 80)}`);
      return firebaseUrl; // Keep original URL as fallback
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const blob = await response.blob();

    // Step 2: Get an upload URL from Convex (using string-based function reference)
    const uploadUrl = await (convex as any).mutation(
      "migrations:generateUploadUrl" as any,
      {},
    );

    // Step 3: Upload the file to Convex
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: blob,
    });

    if (!uploadResponse.ok) {
      console.warn(`    ⚠️  Failed to upload file to Convex: ${uploadResponse.status}`);
      return firebaseUrl; // Keep original URL as fallback
    }

    const { storageId } = (await uploadResponse.json()) as { storageId: string };

    // Step 4: Get the serving URL
    const servingUrl = await (convex as any).mutation(
      "migrations:getStorageUrl" as any,
      { storageId },
    );

    if (servingUrl) {
      return servingUrl as string;
    }

    return firebaseUrl; // Fallback
  } catch (error) {
    console.warn(`    ⚠️  File migration error: ${error}`);
    return firebaseUrl; // Keep original URL as fallback
  }
}

/**
 * Migrate an array of file URLs.
 */
export async function migrateFileUrls(
  urls: string[],
  dryRun: boolean,
): Promise<string[]> {
  if (!urls || !Array.isArray(urls) || urls.length === 0) return [];

  const results: string[] = [];
  for (const url of urls) {
    const migrated = await migrateFileUrl(url, dryRun);
    if (migrated) {
      results.push(migrated);
    }
  }
  return results;
}
