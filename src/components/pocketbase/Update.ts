import { Authentication } from "./Authentication";

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
    value: any
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to update records");
    }

    try {
      const pb = this.auth.getPocketBase();
      const data = { [field]: value };
      return await pb.collection(collectionName).update<T>(recordId, data);
    } catch (err) {
      console.error(`Failed to update ${field} in ${collectionName}:`, err);
      throw err;
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
    updates: Record<string, any>
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to update records");
    }

    try {
      const pb = this.auth.getPocketBase();
      return await pb.collection(collectionName).update<T>(recordId, updates);
    } catch (err) {
      console.error(`Failed to update fields in ${collectionName}:`, err);
      throw err;
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
    value: any
  ): Promise<T[]> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to update records");
    }

    try {
      const pb = this.auth.getPocketBase();
      const data = { [field]: value };
      
      const updates = recordIds.map(id => 
        pb.collection(collectionName).update<T>(id, data)
      );
      
      return await Promise.all(updates);
    } catch (err) {
      console.error(`Failed to batch update ${field} in ${collectionName}:`, err);
      throw err;
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
    updates: Array<{ id: string; data: Record<string, any> }>
  ): Promise<T[]> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to update records");
    }

    try {
      const pb = this.auth.getPocketBase();
      
      const updatePromises = updates.map(({ id, data }) => 
        pb.collection(collectionName).update<T>(id, data)
      );
      
      return await Promise.all(updatePromises);
    } catch (err) {
      console.error(`Failed to batch update fields in ${collectionName}:`, err);
      throw err;
    }
  }
} 