import { Authentication } from "../pocketbase/Authentication";
import { DataSyncService } from "./DataSyncService";
import { DexieService } from "./DexieService";
import { Collections } from "../../schemas/pocketbase/schema";
import { SendLog } from "../pocketbase/SendLog";

// Define the window interface to include the toast function
declare global {
  interface Window {
    toast?: (
      message: string,
      options?: { type: "info" | "success" | "warning" | "error" },
    ) => void;
  }
}

// Check if we're in a browser environment
const isBrowser =
  typeof window !== "undefined" && typeof window.indexedDB !== "undefined";

/**
 * Service to handle data synchronization during authentication flows
 */
export class AuthSyncService {
  private static instance: AuthSyncService;
  private auth: Authentication;
  private dataSync: DataSyncService;
  private dexieService: DexieService;
  private logger: SendLog;
  private isSyncing: boolean = false;
  private syncErrors: Record<string, Error> = {};
  private syncQueue: string[] = [];
  private syncPromise: Promise<void> | null = null;

  // Collections to sync on login
  private readonly collectionsToSync = [
    Collections.USERS,
    Collections.EVENTS,
    Collections.EVENT_REQUESTS,
    Collections.LOGS,
    Collections.OFFICERS,
    Collections.REIMBURSEMENTS,
    Collections.RECEIPTS,
    Collections.SPONSORS,
  ];

  private constructor() {
    this.auth = Authentication.getInstance();
    this.dataSync = DataSyncService.getInstance();
    this.dexieService = DexieService.getInstance();
    this.logger = SendLog.getInstance();

    // Listen for auth state changes only in browser
    if (isBrowser) {
      this.auth.onAuthStateChange(this.handleAuthStateChange.bind(this));
    }
  }

  /**
   * Get the singleton instance of AuthSyncService
   */
  public static getInstance(): AuthSyncService {
    if (!AuthSyncService.instance) {
      AuthSyncService.instance = new AuthSyncService();
    }
    return AuthSyncService.instance;
  }

  /**
   * Handle authentication state changes
   */
  private async handleAuthStateChange(isAuthenticated: boolean): Promise<void> {
    if (!isBrowser) return;

    if (isAuthenticated) {
      // User just logged in
      await this.handleLogin();
    } else {
      // User just logged out
      await this.handleLogout();
    }
  }

  /**
   * Handle login by syncing user data
   */
  public async handleLogin(): Promise<boolean> {
    if (!isBrowser) return true;

    if (this.isSyncing) {
      // console.log("Sync already in progress, queueing login sync");
      if (this.syncPromise) {
        this.syncPromise = this.syncPromise.then(() => this.performLoginSync());
      } else {
        this.syncPromise = this.performLoginSync();
      }
      return true;
    }

    this.syncPromise = this.performLoginSync();
    return this.syncPromise.then(
      () => Object.keys(this.syncErrors).length === 0,
    );
  }

  /**
   * Perform the actual login sync
   */
  private async performLoginSync(): Promise<void> {
    if (!isBrowser) return;

    if (!this.auth.isAuthenticated()) {
      // console.log("Not authenticated, skipping login sync");
      return;
    }

    this.isSyncing = true;
    this.syncErrors = {};

    try {
      // console.log("Starting login sync process...");

      // Display sync notification if in browser environment
      this.showSyncNotification("Syncing your data...");

      // Sync user-specific data first
      const userId = this.auth.getUserId();
      if (userId) {
        // First sync the current user's data
        await this.dataSync.syncCollection(
          Collections.USERS,
          `id = "${userId}"`,
        );

        // Log the sync operation
        // console.log("User data synchronized on login");
      }

      // Sync all collections in parallel with conflict resolution
      await Promise.all(
        this.collectionsToSync.map(async (collection) => {
          try {
            await this.dataSync.syncCollection(collection);
            // console.log(`Successfully synced ${collection}`);
          } catch (error) {
            // console.error(`Error syncing ${collection}:`, error);
            this.syncErrors[collection] = error as Error;
          }
        }),
      );

      // SECURITY FIX: Purge any event codes that might have been synced
      await this.dataSync.purgeEventCodes();

      // Verify sync was successful
      const syncVerification = await this.verifySyncSuccess();

      if (syncVerification.success) {
        // console.log("Login sync completed successfully");
        this.showSyncNotification("Data sync complete!", "success");
      } else {
        // console.warn(
        //   "Login sync completed with issues:",
        //   syncVerification.errors,
        // );
        this.showSyncNotification("Some data could not be synced", "warning");
      }
    } catch (error) {
      // console.error("Error during login sync:", error);
      this.showSyncNotification("Failed to sync data", "error");
    } finally {
      this.isSyncing = false;

      // Process any queued sync operations
      if (this.syncQueue.length > 0) {
        const nextSync = this.syncQueue.shift();
        if (nextSync === "login") {
          this.handleLogin();
        } else if (nextSync === "logout") {
          this.handleLogout();
        }
      }
    }
  }

  /**
   * Handle logout by clearing user data
   */
  public async handleLogout(): Promise<boolean> {
    if (!isBrowser) return true;

    if (this.isSyncing) {
      // console.log("Sync already in progress, queueing logout cleanup");
      this.syncQueue.push("logout");
      return true;
    }

    this.isSyncing = true;

    try {
      // console.log("Starting logout cleanup process...");

      // Ensure any pending changes are synced before logout
      await this.syncPendingChanges();

      // Clear all data from IndexedDB
      await this.dexieService.clearAllData();

      // console.log("Logout cleanup completed successfully");
      return true;
    } catch (error) {
      // console.error("Error during logout cleanup:", error);
      return false;
    } finally {
      this.isSyncing = false;

      // Process any queued sync operations
      if (this.syncQueue.length > 0) {
        const nextSync = this.syncQueue.shift();
        if (nextSync === "login") {
          this.handleLogin();
        } else if (nextSync === "logout") {
          this.handleLogout();
        }
      }
    }
  }

  /**
   * Sync any pending changes before logout
   */
  private async syncPendingChanges(): Promise<void> {
    if (!isBrowser) return;

    // This would be implemented if we had offline capabilities
    // For now, we just log that we would sync pending changes
    // console.log("Checking for pending changes to sync before logout...");
    // In a real implementation, this would sync any offline changes
  }

  /**
   * Verify that sync was successful by checking data in IndexedDB
   */
  private async verifySyncSuccess(): Promise<{
    success: boolean;
    errors: Record<string, string>;
  }> {
    if (!isBrowser) return { success: true, errors: {} };

    const errors: Record<string, string> = {};

    // Check each collection that had errors
    for (const [collection, error] of Object.entries(this.syncErrors)) {
      errors[collection] = error.message;
    }

    // Check if user data was synced properly
    const userId = this.auth.getUserId();
    if (userId) {
      try {
        const user = await this.dataSync.getItem(
          Collections.USERS,
          userId,
          false,
        );
        if (!user) {
          errors["user_verification"] =
            "User data not found in IndexedDB after sync";
        }
      } catch (error) {
        errors["user_verification"] =
          `Error verifying user data: ${(error as Error).message}`;
      }
    }

    return {
      success: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Show a notification to the user about sync status
   */
  private showSyncNotification(
    message: string,
    type: "info" | "success" | "warning" | "error" = "info",
  ): void {
    // Only run in browser environment
    if (!isBrowser) return;

    // Don't show notifications if user is not authenticated and on the dashboard page
    if (
      !this.auth.isAuthenticated() &&
      window.location.pathname.includes("/dashboard")
    ) {
      return;
    }

    // Check if toast function exists (from react-hot-toast or similar)
    if (typeof window.toast === "function") {
      window.toast(message, { type });
    } else {
      // Fallback to console
      // console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Force a sync of all collections
   */
  public async forceSyncAll(): Promise<boolean> {
    if (this.isSyncing) {
      // console.log("Sync already in progress, queueing full sync");
      this.syncQueue.push("login"); // Reuse login sync logic
      return true;
    }

    return this.handleLogin();
  }

  /**
   * Check if a sync is currently in progress
   */
  public isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Get any errors from the last sync operation
   */
  public getSyncErrors(): Record<string, Error> {
    return { ...this.syncErrors };
  }
}
