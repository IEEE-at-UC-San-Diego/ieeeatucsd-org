import { Authentication } from "./Authentication";

export class FileManager {
  private auth: Authentication;
  private static instance: FileManager;

  private constructor() {
    this.auth = Authentication.getInstance();
  }

  /**
   * Get the singleton instance of FileManager
   */
  public static getInstance(): FileManager {
    if (!FileManager.instance) {
      FileManager.instance = new FileManager();
    }
    return FileManager.instance;
  }

  /**
   * Upload a single file to a record
   * @param collectionName The name of the collection
   * @param recordId The ID of the record to attach the file to
   * @param field The field name for the file
   * @param file The file to upload
   * @returns The updated record
   */
  public async uploadFile<T = any>(
    collectionName: string,
    recordId: string,
    field: string,
    file: File
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to upload files");
    }

    try {
      const pb = this.auth.getPocketBase();
      const formData = new FormData();
      formData.append(field, file);

      return await pb.collection(collectionName).update<T>(recordId, formData);
    } catch (err) {
      console.error(`Failed to upload file to ${collectionName}:`, err);
      throw err;
    }
  }

  /**
   * Upload multiple files to a record
   * @param collectionName The name of the collection
   * @param recordId The ID of the record to attach the files to
   * @param field The field name for the files
   * @param files Array of files to upload
   * @returns The updated record
   */
  public async uploadFiles<T = any>(
    collectionName: string,
    recordId: string,
    field: string,
    files: File[]
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to upload files");
    }

    try {
      const pb = this.auth.getPocketBase();
      const formData = new FormData();
      
      files.forEach(file => {
        formData.append(field, file);
      });

      return await pb.collection(collectionName).update<T>(recordId, formData);
    } catch (err) {
      console.error(`Failed to upload files to ${collectionName}:`, err);
      throw err;
    }
  }

  /**
   * Get the URL for a file
   * @param collectionName The name of the collection
   * @param recordId The ID of the record containing the file
   * @param filename The name of the file
   * @returns The URL to access the file
   */
  public getFileUrl(
    collectionName: string,
    recordId: string,
    filename: string
  ): string {
    const pb = this.auth.getPocketBase();
    return `${pb.baseUrl}/api/files/${collectionName}/${recordId}/${filename}`;
  }

  /**
   * Delete a file from a record
   * @param collectionName The name of the collection
   * @param recordId The ID of the record containing the file
   * @param field The field name of the file to delete
   * @returns The updated record
   */
  public async deleteFile<T = any>(
    collectionName: string,
    recordId: string,
    field: string
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to delete files");
    }

    try {
      const pb = this.auth.getPocketBase();
      const data = { [field]: null };
      return await pb.collection(collectionName).update<T>(recordId, data);
    } catch (err) {
      console.error(`Failed to delete file from ${collectionName}:`, err);
      throw err;
    }
  }

  /**
   * Download a file
   * @param collectionName The name of the collection
   * @param recordId The ID of the record containing the file
   * @param filename The name of the file
   * @returns The file blob
   */
  public async downloadFile(
    collectionName: string,
    recordId: string,
    filename: string
  ): Promise<Blob> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to download files");
    }

    try {
      const url = this.getFileUrl(collectionName, recordId, filename);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.blob();
    } catch (err) {
      console.error(`Failed to download file from ${collectionName}:`, err);
      throw err;
    }
  }
} 