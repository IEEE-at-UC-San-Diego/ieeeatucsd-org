import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { auth } from "../../../../../firebase/client";

// Legacy function - kept for backward compatibility during migration
export const uploadFiles = async (
  files: File[],
  path: string,
): Promise<string[]> => {
  const storage = getStorage();
  const uploadPromises = files.map(async (file) => {
    const storageRef = ref(
      storage,
      `${path}/${auth.currentUser?.uid}/${Date.now()}_${file.name}`,
    );
    const uploadTask = uploadBytesResumable(storageRef, file);

    await new Promise((resolve, reject) => {
      uploadTask.on("state_changed", null, reject, () =>
        resolve(uploadTask.snapshot.ref),
      );
    });

    return await getDownloadURL(uploadTask.snapshot.ref);
  });

  return await Promise.all(uploadPromises);
};

// New event-based file upload function
export const uploadFilesForEvent = async (
  files: File[],
  eventId: string,
  category: string = "general",
): Promise<string[]> => {
  const storage = getStorage();
  const uploadPromises = files.map(async (file) => {
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storageRef = ref(
      storage,
      `events/${eventId}/${category}/${timestamp}_${sanitizedFileName}`,
    );
    const uploadTask = uploadBytesResumable(storageRef, file);

    await new Promise((resolve, reject) => {
      uploadTask.on("state_changed", null, reject, () =>
        resolve(uploadTask.snapshot.ref),
      );
    });

    return await getDownloadURL(uploadTask.snapshot.ref);
  });

  return await Promise.all(uploadPromises);
};

// Helper function to generate event-based storage path
export const generateEventFilePath = (
  eventId: string,
  category: string,
  filename: string,
): string => {
  const timestamp = Date.now();
  const sanitizedFileName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `events/${eventId}/${category}/${timestamp}_${sanitizedFileName}`;
};

// Helper function to extract event ID from file path
export const extractEventIdFromPath = (filePath: string): string | null => {
  const match = filePath.match(/^events\/([^\/]+)\//);
  return match ? match[1] : null;
};

// Helper function to extract category from file path
export const extractCategoryFromPath = (filePath: string): string | null => {
  const match = filePath.match(/^events\/[^\/]+\/([^\/]+)\//);
  return match ? match[1] : null;
};

// Function to move files from temporary event ID to actual event ID
export const moveFilesToActualEventId = async (
  tempEventId: string,
  actualEventId: string,
  fileUrls: string[],
): Promise<string[]> => {
  const storage = getStorage();
  const newUrls: string[] = [];

  for (const url of fileUrls) {
    try {
      // Extract the file path from the URL
      const urlParts = url.split("/o/")[1]?.split("?")[0];
      if (!urlParts) continue;

      const decodedPath = decodeURIComponent(urlParts);

      // Check if this is a temp file that needs moving
      if (decodedPath.includes(`events/${tempEventId}/`)) {
        // Create new path with actual event ID
        const newPath = decodedPath.replace(
          `events/${tempEventId}/`,
          `events/${actualEventId}/`,
        );

        // Download the file from old location
        const oldRef = ref(storage, decodedPath);
        const response = await fetch(url);
        const fileData = await response.arrayBuffer();

        // Upload to new location
        const newRef = ref(storage, newPath);
        await uploadBytesResumable(newRef, new Uint8Array(fileData));
        const newUrl = await getDownloadURL(newRef);

        // Delete old file
        await deleteObject(oldRef);

        newUrls.push(newUrl);
      } else {
        // File doesn't need moving
        newUrls.push(url);
      }
    } catch (error) {
      console.error("Error moving file:", url, error);
      // Keep original URL if moving fails
      newUrls.push(url);
    }
  }

  return newUrls;
};

export const validateFileSize = (
  file: File,
  maxSizeMB: number = 1,
): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

export const validateFileType = (
  file: File,
  allowedTypes: string[],
): boolean => {
  return allowedTypes.some(
    (type) =>
      file.type.includes(type) || file.name.toLowerCase().endsWith(type),
  );
};

export const getFileExtension = (filename: string): string => {
  return filename.toLowerCase().split(".").pop() || "";
};

export const isImageFile = (filename: string): boolean => {
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
  const ext = getFileExtension(filename);
  return imageExtensions.includes(ext);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Helper function to determine if a file URL is using the new event-based structure
export const isEventBasedFileUrl = (url: string): boolean => {
  return url.includes("/events/") && !url.includes("/temp_");
};

// Helper function to determine if a file URL is using the legacy user-based structure
export const isLegacyFileUrl = (url: string): boolean => {
  const legacyPatterns = [
    "/invoices/",
    "/room_bookings/",
    "/logos/",
    "/reimbursements/",
    "/fund_deposits/",
    "/graphics/",
    "/event_files/",
    "/private_files/",
  ];

  return legacyPatterns.some((pattern) => url.includes(pattern));
};

// Helper function to extract file metadata from URL
export const extractFileMetadata = (url: string) => {
  const metadata = {
    isEventBased: isEventBasedFileUrl(url),
    isLegacy: isLegacyFileUrl(url),
    eventId: null as string | null,
    category: null as string | null,
    filename: null as string | null,
    userId: null as string | null,
  };

  try {
    // Extract storage path from URL
    const urlParts = url.split("/o/")[1]?.split("?")[0];
    if (!urlParts) return metadata;

    const decodedPath = decodeURIComponent(urlParts);
    const pathParts = decodedPath.split("/");

    if (metadata.isEventBased) {
      // events/{eventId}/{category}/{filename}
      if (pathParts.length >= 4 && pathParts[0] === "events") {
        metadata.eventId = pathParts[1];
        metadata.category = pathParts[2];
        metadata.filename = pathParts[3];
      }
    } else if (metadata.isLegacy) {
      // {category}/{userId}/{filename}
      if (pathParts.length >= 3) {
        metadata.category = pathParts[0];
        metadata.userId = pathParts[1];
        metadata.filename = pathParts[2];
      }
    }
  } catch (error) {
    console.error("Error extracting file metadata:", error);
  }

  return metadata;
};
