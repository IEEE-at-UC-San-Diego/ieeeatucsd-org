import PocketBase from "pocketbase";
import { StoreAuth } from "./StoreAuth";

// Log interface
interface LogData {
  user_id: string;
  type: string;  // Standard types: "error", "update", "delete", "create", "login", "logout"
  part: string;  // The specific part/section being logged (can be multiple words, e.g., "profile settings", "resume upload")
  message: string;
}

export class SendLog {
  private pb: PocketBase;

  constructor() {
    // Use the same PocketBase instance as StoreAuth to maintain authentication
    const auth = new StoreAuth();
    this.pb = auth["pb"];
  }

  /**
   * Gets the current authenticated user's ID
   * @returns The user ID or null if not authenticated
   */
  private getCurrentUserId(): string | null {
    return this.pb.authStore.model?.id || null;
  }

  /**
   * Sends a log entry to PocketBase
   * @param type The type of log entry. Standard types:
   *   - "error": For error conditions
   *   - "update": For successful updates/uploads
   *   - "delete": For deletion operations
   *   - "create": For creation operations
   *   - "login": For login events
   *   - "logout": For logout events
   * @param part The specific part/section being logged. Can be multiple words:
   *   - "profile settings": Profile settings changes
   *   - "resume upload": Resume file operations
   *   - "notification settings": Notification preference changes
   *   - "user authentication": Auth-related actions
   *   - "event check in": Event attendance tracking
   *   - "loyalty points": Points updates from events/activities
   *   - "event management": Event creation/modification
   *   - "event attendance": Overall event attendance status
   * @param message The log message
   * @param overrideUserId Optional user ID to override the current user (for admin/system logs)
   * @returns Promise that resolves when the log is created
   */
  public async send(type: string, part: string, message: string, overrideUserId?: string) {
    try {
      const userId = overrideUserId || this.getCurrentUserId();
      
      if (!userId) {
        throw new Error("No user ID available. User must be authenticated to create logs.");
      }

      const logData: LogData = {
        user_id: userId,
        type,
        part,
        message
      };

      // Create the log entry in PocketBase
      await this.pb.collection("logs").create(logData);
    } catch (error) {
      console.error("Failed to send log:", error);
      throw error;
    }
  }
} 