import { Authentication } from "./Authentication";

// Base interface for PocketBase records
interface BaseRecord {
  id: string;
  [key: string]: any;
}

// Interface for request options
interface RequestOptions {
  fields?: string[];
  disableAutoCancellation?: boolean;
  expand?: string[] | string;
}

// Utility function to check if a value is a UTC date string
function isUTCDateString(value: any): boolean {
  if (typeof value !== "string") return false;
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
  return isoDateRegex.test(value);
}

// Utility function to format a date to local ISO-like string
function formatLocalDate(date: Date, includeSeconds: boolean = true): string {
  const pad = (num: number) => num.toString().padStart(2, "0");

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  // Format for datetime-local input (YYYY-MM-DDThh:mm)
  if (!includeSeconds) {
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

// Utility function to convert UTC date strings to local time
function convertUTCToLocal<T>(data: T): T {
  if (!data || typeof data !== "object") return data;

  const converted = { ...data };
  for (const [key, value] of Object.entries(converted)) {
    // Special handling for event date fields
    if (
      (key === "start_date" ||
        key === "end_date" ||
        key === "time_checked_in") &&
      isUTCDateString(value)
    ) {
      // Convert UTC date string to local date string
      const date = new Date(value);
      (converted as any)[key] = formatLocalDate(date, false);
    } else if (isUTCDateString(value)) {
      // Convert UTC date string to local date string
      const date = new Date(value);
      (converted as any)[key] = formatLocalDate(date);
    } else if (Array.isArray(value)) {
      (converted as any)[key] = value.map((item) => convertUTCToLocal(item));
    } else if (typeof value === "object" && value !== null) {
      (converted as any)[key] = convertUTCToLocal(value);
    }
  }
  return converted;
}

export class Get {
  private auth: Authentication;
  private static instance: Get;

  private constructor() {
    this.auth = Authentication.getInstance();
  }

  /**
   * Get the singleton instance of Get
   */
  public static getInstance(): Get {
    if (!Get.instance) {
      Get.instance = new Get();
    }
    return Get.instance;
  }

  /**
   * Convert UTC date strings to local time
   * @param data The data to convert
   * @returns The converted data
   */
  public static convertUTCToLocal<T>(data: T): T {
    return convertUTCToLocal(data);
  }

  /**
   * Check if a value is a UTC date string
   * @param value The value to check
   * @returns True if the value is a UTC date string
   */
  public static isUTCDateString(value: any): boolean {
    return isUTCDateString(value);
  }

  /**
   * Format a date to local ISO-like string
   * @param date The date to format
   * @param includeSeconds Whether to include seconds in the formatted string
   * @returns The formatted date string
   */
  public static formatLocalDate(
    date: Date,
    includeSeconds: boolean = true,
  ): string {
    return formatLocalDate(date, includeSeconds);
  }

  /**
   * Get a single record by ID
   * @param collectionName The name of the collection
   * @param recordId The ID of the record to retrieve
   * @param options Optional request options including fields to select and auto-cancellation control
   * @returns The requested record
   */
  public async getOne<T extends BaseRecord>(
    collectionName: string,
    recordId: string,
    options?: RequestOptions,
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      console.warn(
        `User not authenticated, but attempting to get record from ${collectionName} anyway`,
      );
    }

    try {
      const pb = this.auth.getPocketBase();

      // Handle expand parameter
      let expandString: string | undefined;
      if (options?.expand) {
        if (Array.isArray(options.expand)) {
          expandString = options.expand.join(",");
        } else if (typeof options.expand === "string") {
          expandString = options.expand;
        }
      }

      const requestOptions = {
        ...(options?.fields && { fields: options.fields.join(",") }),
        ...(expandString && { expand: expandString }),
        ...(options?.disableAutoCancellation && { requestKey: null }),
        emailVisibility: true,
      };

      const result = await pb
        .collection(collectionName)
        .getOne<T>(recordId, requestOptions);
      return convertUTCToLocal(result);
    } catch (err) {
      console.error(
        `Failed to get record ${recordId} from ${collectionName}:`,
        err,
      );
      throw err;
    }
  }

  /**
   * Get multiple records by their IDs
   * @param collectionName The name of the collection
   * @param recordIds Array of record IDs to retrieve
   * @param options Optional request options including fields to select and auto-cancellation control
   * @returns Array of requested records
   */
  public async getMany<T extends BaseRecord>(
    collectionName: string,
    recordIds: string[],
    options?: RequestOptions,
  ): Promise<T[]> {
    if (!this.auth.isAuthenticated()) {
      console.warn(
        `User not authenticated, but attempting to get records from ${collectionName} anyway`,
      );
    }

    try {
      // Build filter for multiple IDs
      const filter = recordIds.map((id) => `id="${id}"`).join(" || ");

      const pb = this.auth.getPocketBase();

      // Handle expand parameter
      let expandString: string | undefined;
      if (options?.expand) {
        if (Array.isArray(options.expand)) {
          expandString = options.expand.join(",");
        } else if (typeof options.expand === "string") {
          expandString = options.expand;
        }
      }

      const requestOptions = {
        filter,
        ...(options?.fields && { fields: options.fields.join(",") }),
        ...(expandString && { expand: expandString }),
        ...(options?.disableAutoCancellation && { requestKey: null }),
        emailVisibility: true,
      };

      const result = await pb
        .collection(collectionName)
        .getList<T>(1, recordIds.length, requestOptions);
      return result.items.map((item) => convertUTCToLocal(item));
    } catch (err) {
      console.error(
        `Failed to get records ${recordIds.join(", ")} from ${collectionName}:`,
        err,
      );
      throw err;
    }
  }

  /**
   * Get records with pagination
   * @param collectionName The name of the collection
   * @param page Page number (1-based)
   * @param perPage Number of items per page
   * @param filter Optional filter string
   * @param sort Optional sort string
   * @param options Optional request options including fields to select and auto-cancellation control
   * @returns Paginated list of records
   */
  public async getList<T extends BaseRecord>(
    collectionName: string,
    page: number = 1,
    perPage: number = 20,
    filter?: string,
    sort?: string,
    options?: RequestOptions,
  ): Promise<{
    page: number;
    perPage: number;
    totalItems: number;
    totalPages: number;
    items: T[];
  }> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to retrieve records");
    }

    try {
      const pb = this.auth.getPocketBase();

      // Handle expand parameter
      let expandString: string | undefined;
      if (options?.expand) {
        if (Array.isArray(options.expand)) {
          expandString = options.expand.join(",");
        } else if (typeof options.expand === "string") {
          expandString = options.expand;
        }
      }

      const requestOptions = {
        ...(filter && { filter }),
        ...(sort && { sort }),
        ...(options?.fields && { fields: options.fields.join(",") }),
        ...(expandString && { expand: expandString }),
        ...(options?.disableAutoCancellation && { requestKey: null }),
        emailVisibility: true,
      };

      const result = await pb
        .collection(collectionName)
        .getList<T>(page, perPage, requestOptions);

      return {
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        items: result.items.map((item) => convertUTCToLocal(item)),
      };
    } catch (err) {
      console.error(`Failed to get list from ${collectionName}:`, err);
      throw err;
    }
  }

  /**
   * Get all records from a collection
   * @param collectionName The name of the collection
   * @param filter Optional filter string
   * @param sort Optional sort string
   * @param options Optional request options including fields to select and auto-cancellation control
   * @returns Array of all matching records
   */
  public async getAll<T extends BaseRecord>(
    collectionName: string,
    filter?: string,
    sort?: string,
    options?: RequestOptions,
  ): Promise<T[]> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to retrieve all records");
    }

    try {
      const pb = this.auth.getPocketBase();

      // Handle expand parameter
      let expandString: string | undefined;
      if (options?.expand) {
        if (Array.isArray(options.expand)) {
          expandString = options.expand.join(",");
        } else if (typeof options.expand === "string") {
          expandString = options.expand;
        }
      }

      const requestOptions = {
        ...(filter && { filter }),
        ...(sort && { sort }),
        ...(options?.fields && { fields: options.fields.join(",") }),
        ...(expandString && { expand: expandString }),
        ...(options?.disableAutoCancellation && { requestKey: null }),
        emailVisibility: true,
      };

      // Get all items (will handle pagination automatically)
      const result = await pb
        .collection(collectionName)
        .getFullList<T>(requestOptions);

      return result.map((item) => convertUTCToLocal(item));
    } catch (err) {
      console.error(`Failed to get all records from ${collectionName}:`, err);
      throw err;
    }
  }

  /**
   * Get the first record that matches a filter
   * @param collectionName The name of the collection
   * @param filter Filter string
   * @param options Optional request options including fields to select and auto-cancellation control
   * @returns The first matching record or null if none found
   */
  public async getFirst<T extends BaseRecord>(
    collectionName: string,
    filter: string,
    options?: RequestOptions,
  ): Promise<T | null> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to retrieve records");
    }

    try {
      const pb = this.auth.getPocketBase();
      const requestOptions = {
        filter,
        ...(options?.fields && { fields: options.fields.join(",") }),
        ...(options?.disableAutoCancellation && { requestKey: null }),
        sort: "created",
        perPage: 1,
      };

      const result = await pb
        .collection(collectionName)
        .getList<T>(1, 1, requestOptions);
      return result.items.length > 0
        ? convertUTCToLocal(result.items[0])
        : null;
    } catch (err) {
      console.error(`Failed to get first record from ${collectionName}:`, err);
      throw err;
    }
  }
}
