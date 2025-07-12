import { Authentication } from "./Authentication";
import { Collections } from "../../schemas/pocketbase";
import type { Log } from "../../schemas/pocketbase";

// Log data interface for creating new logs
interface LogData {
  user: string; // Relation to User
  type: string; // Standard types: "error", "update", "delete", "create", "login", "logout"
  part: string; // The specific part/section being logged
  message: string;
}

export class SendLog {
  private auth: Authentication;
  private static instance: SendLog;
  private readonly COLLECTION_NAME = Collections.LOGS;

  private constructor() {
    this.auth = Authentication.getInstance();
  }

  /**
   * Get the singleton instance of SendLog
   */
  public static getInstance(): SendLog {
    if (!SendLog.instance) {
      SendLog.instance = new SendLog();
    }
    return SendLog.instance;
  }

  /**
   * Gets the current authenticated user's ID
   * @returns The user ID or null if not authenticated
   */
  private getCurrentUserId(): string | null {
    const user = this.auth.getCurrentUser();
    if (!user) {
      console.debug("SendLog: No current user found");
      return null;
    }
    console.debug("SendLog: Current user ID:", user.id);
    return user.id;
  }

  /**
   * Sends a log entry to PocketBase
   * @param type The type of log entry
   * @param part The specific part/section being logged
   * @param message The log message
   * @param overrideUserId Optional user ID to override the current user
   * @returns Promise that resolves when the log is created
   */
  public async send(
    type: string,
    part: string,
    message: string,
    overrideUserId?: string,
  ): Promise<void> {
    try {
      // Check authentication first
      if (!this.auth.isAuthenticated()) {
        console.error("SendLog: User not authenticated");
        throw new Error("User must be authenticated to create logs");
      }

      // Get user ID
      const userId = overrideUserId || this.getCurrentUserId();
      if (!userId) {
        console.error("SendLog: No user ID available");
        throw new Error(
          "No user ID available. User must be authenticated to create logs.",
        );
      }

      // Prepare log data
      const logData: LogData = {
        user: userId,
        type,
        part,
        message,
      };

      console.debug("SendLog: Preparing to send log:", {
        collection: this.COLLECTION_NAME,
        data: logData,
        authValid: this.auth.isAuthenticated(),
        userId,
      });

      // Get PocketBase instance
      const pb = this.auth.getPocketBase();

      // Create the log entry
      await pb.collection(this.COLLECTION_NAME).create(logData);

      console.debug("SendLog: Log created successfully");
    } catch (error) {
      // Enhanced error logging
      if (error instanceof Error) {
        console.error("SendLog: Failed to send log:", {
          error: error.message,
          stack: error.stack,
          type,
          part,
          message,
        });
      } else {
        console.error("SendLog: Unknown error:", error);
      }
      throw error;
    }
  }

  /**
   * Get logs for a specific user
   * @param userId The ID of the user to get logs for
   * @param type Optional log type to filter by
   * @param part Optional part/section to filter by
   * @returns Array of log entries
   */
  public async getUserLogs(
    userId: string,
    type?: string,
    part?: string,
  ): Promise<Log[]> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to retrieve logs");
    }

    try {
      let filter = `user = "${userId}"`;
      if (type) filter += ` && type = "${type}"`;
      if (part) filter += ` && part = "${part}"`;

      const result = await this.auth
        .getPocketBase()
        .collection(this.COLLECTION_NAME)
        .getFullList<Log>({
          filter,
          sort: "-created",
        });

      return result;
    } catch (error) {
      console.error("SendLog: Failed to get user logs:", error);
      throw error;
    }
  }

  /**
   * Get recent logs for the current user
   * @param limit Maximum number of logs to retrieve
   * @param type Optional log type to filter by
   * @param part Optional part/section to filter by
   * @returns Array of recent log entries
   */
  public async getRecentLogs(
    limit: number = 10,
    type?: string,
    part?: string,
  ): Promise<Log[]> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to retrieve logs");
    }

    try {
      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error("No user ID available");
      }

      let filter = `user = "${userId}"`;
      if (type) filter += ` && type = "${type}"`;
      if (part) filter += ` && part = "${part}"`;

      const result = await this.auth
        .getPocketBase()
        .collection(this.COLLECTION_NAME)
        .getList<Log>(1, limit, {
          filter,
          sort: "-created",
        });

      return result.items;
    } catch (error) {
      console.error("SendLog: Failed to get recent logs:", error);
      throw error;
    }
  }
}
