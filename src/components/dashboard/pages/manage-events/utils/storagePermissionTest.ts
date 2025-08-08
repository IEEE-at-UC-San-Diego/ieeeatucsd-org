import { getStorage, ref, getDownloadURL } from "firebase/storage";
import {
  logFirebaseDebugInfo,
  checkStoragePermissions,
} from "./firebaseDebugUtils";

/**
 * Test function to check if a user can access a specific file in Firebase Storage
 * This helps diagnose permission issues without uploading files
 */
export const testStoragePermissions = async (
  eventId: string,
  category: string,
  fileName: string,
): Promise<{
  canAccess: boolean;
  error?: string;
  debugInfo: any;
}> => {
  try {
    console.log(
      `🧪 Testing storage permissions for: events/${eventId}/${category}/${fileName}`,
    );

    // Get debug info
    const debugInfo = await logFirebaseDebugInfo(eventId, "Permission Test");
    const hasPermission = checkStoragePermissions(debugInfo);

    if (!hasPermission) {
      return {
        canAccess: false,
        error:
          "User does not have required permissions based on Firestore rules",
        debugInfo,
      };
    }

    // Try to get download URL for the file (this tests read permissions)
    const storage = getStorage();
    const storageRef = ref(
      storage,
      `events/${eventId}/${category}/${fileName}`,
    );

    try {
      await getDownloadURL(storageRef);
      console.log("✅ Successfully accessed file - permissions are working");
      return {
        canAccess: true,
        debugInfo,
      };
    } catch (error: any) {
      console.error("❌ Failed to access file:", error);
      return {
        canAccess: false,
        error: `Firebase Storage error: ${error.message} (Code: ${error.code})`,
        debugInfo,
      };
    }
  } catch (error: any) {
    console.error("❌ Permission test failed:", error);
    return {
      canAccess: false,
      error: `Test failed: ${error.message}`,
      debugInfo: null,
    };
  }
};

/**
 * Quick test for the specific file mentioned in the error
 */
export const testSpecificFile = () => {
  return testStoragePermissions(
    "r8MB50zWi1nFFFOvwteL",
    "room_booking",
    "1754621676542_REPLACE_ME.jpg",
  );
};

/**
 * Test the current failing event ID
 */
export const testCurrentFailingEvent = () => {
  return testStoragePermissions(
    "r8MB50zWi1nFFFOvwteL",
    "room_booking",
    "test_file.png",
  );
};

/**
 * Test permissions for a temporary event ID
 */
export const testTempEventPermissions = async (userId: string) => {
  const tempEventId = `temp_${Date.now()}_${userId}`;
  return testStoragePermissions(tempEventId, "room_booking", "test_file.jpg");
};

// Export for console debugging
if (typeof window !== "undefined") {
  (window as any).testStoragePermissions = testStoragePermissions;
  (window as any).testSpecificFile = testSpecificFile;
  (window as any).testTempEventPermissions = testTempEventPermissions;
}
