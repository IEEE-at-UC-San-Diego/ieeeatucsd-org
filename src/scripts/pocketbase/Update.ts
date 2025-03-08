import { Authentication } from "./Authentication";

// Utility function to check if a value is a date string
function isLocalDateString(value: any): boolean {
  if (typeof value !== "string") return false;
  // Match ISO format without the Z suffix (local time)
  const isoDateRegex =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:(?:-|\+)\d{2}:\d{2})?$/;
  return isoDateRegex.test(value);
}

// Utility function to convert local time to UTC
function convertLocalToUTC<T>(data: T): T {
  if (!data || typeof data !== "object") return data;

  const converted = { ...data };
  for (const [key, value] of Object.entries(converted)) {
    // Special handling for event date fields to ensure proper UTC conversion
    if (
      (key === "start_date" ||
        key === "end_date" ||
        key === "time_checked_in") &&
      typeof value === "string"
    ) {
      // Ensure we're converting to UTC
      const date = new Date(value);
      (converted as any)[key] = date.toISOString();
    }
    // Special handling for invoice_data to ensure it's a proper JSON object
    else if (key === "invoice_data") {
      if (typeof value === "string") {
        try {
          // If it's a string representation of JSON, parse it
          const parsedValue = JSON.parse(value);
          (converted as any)[key] = parsedValue;
        } catch (e) {
          // If it's not valid JSON, keep it as is
          console.warn("Failed to parse invoice_data as JSON:", e);
        }
      } else if (typeof value === "object" && value !== null) {
        // If it's already an object, keep it as is
        (converted as any)[key] = value;
      }
    } else if (isLocalDateString(value)) {
      // Convert local date string to UTC
      const date = new Date(value);
      (converted as any)[key] = date.toISOString();
    } else if (Array.isArray(value)) {
      (converted as any)[key] = value.map((item) => convertLocalToUTC(item));
    } else if (typeof value === "object" && value !== null) {
      (converted as any)[key] = convertLocalToUTC(value);
    }
  }
  return converted;
}

export class Update {
  private auth: Authentication;
  private static instance: Update;

  private constructor() {
    this.auth = Authentication.getInstance();
  }

  /**
   * Get the singleton instance of Update
   */
  public static getInstance(): Update {
    if (!Update.instance) {
      Update.instance = new Update();
    }
    return Update.instance;
  }

  /**
   * Convert local time to UTC
   * @param data The data to convert
   * @returns The converted data
   */
  public static convertLocalToUTC<T>(data: T): T {
    return convertLocalToUTC(data);
  }

  /**
   * Create a new record
   * @param collectionName The name of the collection
   * @param data The data for the new record
   * @returns The created record
   */
  public async create<T = any>(
    collectionName: string,
    data: Record<string, any>,
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to create records");
    }

    try {
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();
      const convertedData = convertLocalToUTC(data);
      const result = await pb
        .collection(collectionName)
        .create<T>(convertedData);
      return result;
    } catch (err) {
      console.error(`Failed to create record in ${collectionName}:`, err);
      throw err;
    } finally {
      this.auth.setUpdating(false);
    }
  }

  /**
   * Update a single field in a record
   * @param collectionName The name of the collection
   * @param recordId The ID of the record to update
   * @param field The field to update
   * @param value The new value for the field
   * @returns The updated record
   */
  public async updateField<T = any>(
    collectionName: string,
    recordId: string,
    field: string,
    value: any,
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to update records");
    }

    try {
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();
      const data = { [field]: value };
      const convertedData = convertLocalToUTC(data);
      const result = await pb
        .collection(collectionName)
        .update<T>(recordId, convertedData);
      return result;
    } catch (err) {
      console.error(`Failed to update ${field} in ${collectionName}:`, err);
      throw err;
    } finally {
      this.auth.setUpdating(false);
    }
  }

  /**
   * Update multiple fields in a record
   * @param collectionName The name of the collection
   * @param recordId The ID of the record to update
   * @param updates Object containing field-value pairs to update
   * @returns The updated record
   */
  public async updateFields<T = any>(
    collectionName: string,
    recordId: string,
    updates: Record<string, any>,
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to update records");
    }

    try {
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();
      const convertedUpdates = convertLocalToUTC(updates);

      // If recordId is empty, create a new record instead of updating
      if (!recordId) {
        return this.create<T>(collectionName, convertedUpdates);
      }

      const result = await pb
        .collection(collectionName)
        .update<T>(recordId, convertedUpdates);
      return result;
    } catch (err) {
      console.error(`Failed to update fields in ${collectionName}:`, err);
      throw err;
    } finally {
      this.auth.setUpdating(false);
    }
  }

  /**
   * Update a field for multiple records
   * @param collectionName The name of the collection
   * @param recordIds Array of record IDs to update
   * @param field The field to update
   * @param value The new value for the field
   * @returns Array of updated records
   */
  public async batchUpdateField<T = any>(
    collectionName: string,
    recordIds: string[],
    field: string,
    value: any,
  ): Promise<T[]> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to update records");
    }

    try {
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();
      const data = { [field]: value };
      const convertedData = convertLocalToUTC(data);

      const updates = recordIds.map((id) =>
        pb.collection(collectionName).update<T>(id, convertedData),
      );

      const results = await Promise.all(updates);
      return results;
    } catch (err) {
      console.error(
        `Failed to batch update ${field} in ${collectionName}:`,
        err,
      );
      throw err;
    } finally {
      this.auth.setUpdating(false);
    }
  }

  /**
   * Update multiple fields for multiple records
   * @param collectionName The name of the collection
   * @param updates Array of objects containing record ID and updates
   * @returns Array of updated records
   */
  public async batchUpdateFields<T = any>(
    collectionName: string,
    updates: Array<{ id: string; data: Record<string, any> }>,
  ): Promise<T[]> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to update records");
    }

    try {
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();

      const updatePromises = updates.map(({ id, data }) =>
        pb.collection(collectionName).update<T>(id, convertLocalToUTC(data)),
      );

      const results = await Promise.all(updatePromises);
      return results;
    } catch (err) {
      console.error(`Failed to batch update fields in ${collectionName}:`, err);
      throw err;
    } finally {
      this.auth.setUpdating(false);
    }
  }

  /**
   * Update a record with file appends
   * This method properly handles appending files to existing records
   * @param collectionName The name of the collection
   * @param recordId The ID of the record to update
   * @param data Regular fields to update
   * @param files Object mapping field names to arrays of files to append
   * @returns The updated record
   */
  public async updateWithFileAppends<T = any>(
    collectionName: string,
    recordId: string,
    data: Record<string, any> = {},
    files: Record<string, File[]> = {}
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to update records");
    }

    try {
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();
      
      // Convert regular data fields
      const convertedData = convertLocalToUTC(data);
      
      // Create FormData for the update
      const formData = new FormData();
      
      // Add regular fields
      Object.entries(convertedData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formData.append(key, value.toString());
        }
      });
      
      // Add files with the + prefix to append them
      Object.entries(files).forEach(([fieldName, fieldFiles]) => {
        fieldFiles.forEach(file => {
          formData.append(`${fieldName}+`, file);
        });
      });
      
      // Perform the update
      const result = await pb
        .collection(collectionName)
        .update<T>(recordId, formData);
        
      return result;
    } catch (err) {
      console.error(`Failed to update with file appends in ${collectionName}:`, err);
      throw err;
    } finally {
      this.auth.setUpdating(false);
    }
  }
}
