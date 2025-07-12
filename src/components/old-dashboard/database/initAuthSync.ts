import { Authentication } from "../pocketbase/Authentication";

/**
 * Initialize authentication synchronization
 * This function should be called when the application starts
 * to ensure proper data synchronization during authentication flows
 */
export async function initAuthSync(): Promise<void> {
  try {
    // Get Authentication instance
    const auth = Authentication.getInstance();

    // This will trigger the lazy loading of AuthSyncService
    // through the onAuthStateChange mechanism
    auth.onAuthStateChange(() => {
      // console.log('Auth sync initialized and listening for auth state changes');
    });

    // console.log('Auth sync initialization complete');
  } catch (error) {
    console.error("Failed to initialize auth sync:", error);
  }
}

// Export a function to manually trigger a full sync
export async function forceFullSync(): Promise<boolean> {
  try {
    const { AuthSyncService } = await import("./AuthSyncService");
    const authSync = AuthSyncService.getInstance();
    return await authSync.forceSyncAll();
  } catch (error) {
    console.error("Failed to force full sync:", error);
    return false;
  }
}
