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
      throw new Error("User must be authenticated to retrieve records");
    }

    try {
      const pb = this.auth.getPocketBase();
      const requestOptions = {
        ...(options?.fields && { fields: options.fields.join(",") }),
        ...(options?.disableAutoCancellation && { requestKey: null }),
      };
      return await pb
        .collection(collectionName)
        .getOne<T>(recordId, requestOptions);
    } catch (err) {
      console.error(`Failed to get record from ${collectionName}:`, err);
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
      throw new Error("User must be authenticated to retrieve records");
    }

    try {
      const pb = this.auth.getPocketBase();
      const filter = `id ?~ "${recordIds.join("|")}"`;
      const requestOptions = {
        filter,
        ...(options?.fields && { fields: options.fields.join(",") }),
        ...(options?.disableAutoCancellation && { requestKey: null }),
      };

      const result = await pb
        .collection(collectionName)
        .getFullList<T>(requestOptions);

      // Sort results to match the order of requested IDs
      const recordMap = new Map(result.map((record) => [record.id, record]));
      return recordIds.map((id) => recordMap.get(id)).filter(Boolean) as T[];
    } catch (err) {
      console.error(`Failed to get records from ${collectionName}:`, err);
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
      const requestOptions = {
        ...(filter && { filter }),
        ...(sort && { sort }),
        ...(options?.fields && { fields: options.fields.join(",") }),
        ...(options?.disableAutoCancellation && { requestKey: null }),
      };

      const result = await pb
        .collection(collectionName)
        .getList<T>(page, perPage, requestOptions);

      return {
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        items: result.items,
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
      throw new Error("User must be authenticated to retrieve records");
    }

    try {
      const pb = this.auth.getPocketBase();
      const requestOptions = {
        ...(filter && { filter }),
        ...(sort && { sort }),
        ...(options?.fields && { fields: options.fields.join(",") }),
        ...(options?.disableAutoCancellation && { requestKey: null }),
      };

      return await pb.collection(collectionName).getFullList<T>(requestOptions);
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
      return result.items.length > 0 ? result.items[0] : null;
    } catch (err) {
      console.error(`Failed to get first record from ${collectionName}:`, err);
      throw err;
    }
  }
}
