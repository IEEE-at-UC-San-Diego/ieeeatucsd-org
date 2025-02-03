import { Authentication } from "./Authentication";

// Base interface for PocketBase records
interface BaseRecord {
  id: string;
  [key: string]: any;
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
   * @param fields Optional array of fields to select
   * @returns The requested record
   */
  public async getOne<T extends BaseRecord>(
    collectionName: string,
    recordId: string,
    fields?: string[]
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to retrieve records");
    }

    try {
      const pb = this.auth.getPocketBase();
      const options = fields ? { fields: fields.join(",") } : undefined;
      return await pb.collection(collectionName).getOne<T>(recordId, options);
    } catch (err) {
      console.error(`Failed to get record from ${collectionName}:`, err);
      throw err;
    }
  }

  /**
   * Get multiple records by their IDs
   * @param collectionName The name of the collection
   * @param recordIds Array of record IDs to retrieve
   * @param fields Optional array of fields to select
   * @returns Array of requested records
   */
  public async getMany<T extends BaseRecord>(
    collectionName: string,
    recordIds: string[],
    fields?: string[]
  ): Promise<T[]> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to retrieve records");
    }

    try {
      const pb = this.auth.getPocketBase();
      const filter = `id ?~ "${recordIds.join("|")}"`;
      const options = {
        filter,
        ...(fields && { fields: fields.join(",") })
      };
      
      const result = await pb.collection(collectionName).getFullList<T>(options);
      
      // Sort results to match the order of requested IDs
      const recordMap = new Map(result.map(record => [record.id, record]));
      return recordIds.map(id => recordMap.get(id)).filter(Boolean) as T[];
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
   * @param fields Optional array of fields to select
   * @returns Paginated list of records
   */
  public async getList<T extends BaseRecord>(
    collectionName: string,
    page: number = 1,
    perPage: number = 20,
    filter?: string,
    sort?: string,
    fields?: string[]
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
      const options = {
        ...(filter && { filter }),
        ...(sort && { sort }),
        ...(fields && { fields: fields.join(",") })
      };
      
      const result = await pb.collection(collectionName).getList<T>(page, perPage, options);
      
      return {
        page: result.page,
        perPage: result.perPage,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
        items: result.items
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
   * @param fields Optional array of fields to select
   * @returns Array of all matching records
   */
  public async getAll<T extends BaseRecord>(
    collectionName: string,
    filter?: string,
    sort?: string,
    fields?: string[]
  ): Promise<T[]> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to retrieve records");
    }

    try {
      const pb = this.auth.getPocketBase();
      const options = {
        ...(filter && { filter }),
        ...(sort && { sort }),
        ...(fields && { fields: fields.join(",") })
      };
      
      return await pb.collection(collectionName).getFullList<T>(options);
    } catch (err) {
      console.error(`Failed to get all records from ${collectionName}:`, err);
      throw err;
    }
  }

  /**
   * Get the first record that matches a filter
   * @param collectionName The name of the collection
   * @param filter Filter string
   * @param fields Optional array of fields to select
   * @returns The first matching record or null if none found
   */
  public async getFirst<T extends BaseRecord>(
    collectionName: string,
    filter: string,
    fields?: string[]
  ): Promise<T | null> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to retrieve records");
    }

    try {
      const pb = this.auth.getPocketBase();
      const options = {
        filter,
        ...(fields && { fields: fields.join(",") }),
        sort: "created",
        perPage: 1
      };
      
      const result = await pb.collection(collectionName).getList<T>(1, 1, options);
      return result.items.length > 0 ? result.items[0] : null;
    } catch (err) {
      console.error(`Failed to get first record from ${collectionName}:`, err);
      throw err;
    }
  }
} 