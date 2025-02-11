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
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();
      const formData = new FormData();
      formData.append(field, file);

      const result = await pb.collection(collectionName).update<T>(recordId, formData);
      return result;
    } catch (err) {
      console.error(`Failed to upload file to ${collectionName}:`, err);
      throw err;
    } finally {
      this.auth.setUpdating(false);
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
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();
      const formData = new FormData();
      
      files.forEach(file => {
        formData.append(field, file);
      });

      const result = await pb.collection(collectionName).update<T>(recordId, formData);
      return result;
    } catch (err) {
      console.error(`Failed to upload files to ${collectionName}:`, err);
      throw err;
    } finally {
      this.auth.setUpdating(false);
    }
  }

  /**
   * Append multiple files to a record without overriding existing ones
   * @param collectionName The name of the collection
   * @param recordId The ID of the record to attach the files to
   * @param field The field name for the files
   * @param files Array of files to upload
   * @returns The updated record
   */
  public async appendFiles<T = any>(
    collectionName: string,
    recordId: string,
    field: string,
    files: File[]
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to upload files");
    }

    try {
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();
      
      // First, get the current record to check existing files
      const record = await pb.collection(collectionName).getOne<T>(recordId);
      
      // Create FormData with existing files
      const formData = new FormData();

      // Get existing files from the record
      const existingFiles = (record as any)[field] || [];

      // For each existing file, we need to fetch it and add it to the FormData
      for (const existingFile of existingFiles) {
        try {
          const response = await fetch(this.getFileUrl(collectionName, recordId, existingFile));
          const blob = await response.blob();
          const file = new File([blob], existingFile, { type: blob.type });
          formData.append(field, file);
        } catch (error) {
          console.warn(`Failed to fetch existing file ${existingFile}:`, error);
        }
      }
      
      // Append new files
      files.forEach(file => {
        formData.append(field, file);
      });

      const result = await pb.collection(collectionName).update<T>(recordId, formData);
      return result;
    } catch (err) {
      console.error(`Failed to append files to ${collectionName}:`, err);
      throw err;
    } finally {
      this.auth.setUpdating(false);
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
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();
      const data = { [field]: null };
      const result = await pb.collection(collectionName).update<T>(recordId, data);
      return result;
    } catch (err) {
      console.error(`Failed to delete file from ${collectionName}:`, err);
      throw err;
    } finally {
      this.auth.setUpdating(false);
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
      this.auth.setUpdating(true);
      const url = this.getFileUrl(collectionName, recordId, filename);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.blob();
      return result;
    } catch (err) {
      console.error(`Failed to download file from ${collectionName}:`, err);
      throw err;
    } finally {
      this.auth.setUpdating(false);
    }
  }
} 