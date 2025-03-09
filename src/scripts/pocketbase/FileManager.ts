import { Authentication } from "./Authentication";

export class FileManager {
  private auth: Authentication;
  private static instance: FileManager;
  private static UNSUPPORTED_EXTENSIONS = ["afdesign", "psd", "ai", "sketch"];

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
   * Validates if a file type is supported
   * @param file The file to validate
   * @returns Object with validation result and reason if invalid
   */
  public validateFileType(file: File): { valid: boolean; reason?: string } {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (
      fileExtension &&
      FileManager.UNSUPPORTED_EXTENSIONS.includes(fileExtension)
    ) {
      return {
        valid: false,
        reason: `File type .${fileExtension} is not supported. Please convert to PDF or image format.`,
      };
    }

    return { valid: true };
  }

  /**
   * Upload a single file to a record
   * @param collectionName The name of the collection
   * @param recordId The ID of the record to attach the file to
   * @param field The field name for the file
   * @param file The file to upload
   * @param append Whether to append the file to existing files (default: false)
   * @returns The updated record
   */
  public async uploadFile<T = any>(
    collectionName: string,
    recordId: string,
    field: string,
    file: File,
    append: boolean = false,
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to upload files");
    }

    try {
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();

      // Validate file size
      const maxSize = 200 * 1024 * 1024; // 200MB
      if (file.size > maxSize) {
        throw new Error(
          `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds 200MB limit`,
        );
      }

      // Check for potentially problematic file types
      const fileExtension = file.name.split(".").pop()?.toLowerCase();

      // Validate file type
      const validation = this.validateFileType(file);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      // Log upload attempt
      // console.log('Attempting file upload:', {
      //   name: file.name,
      //   size: file.size,
      //   type: file.type,
      //   extension: fileExtension,
      //   collection: collectionName,
      //   recordId: recordId,
      //   field: field,
      //   append: append
      // });

      // Create FormData for the upload
      const formData = new FormData();

      // Use the + prefix for the field name if append is true
      const fieldName = append ? `${field}+` : field;

      // Get existing record to preserve existing files
      let existingRecord: any = null;
      let existingFiles: string[] = [];

      try {
        if (recordId) {
          existingRecord = await pb.collection(collectionName).getOne(recordId);
          existingFiles = existingRecord[field] || [];
        }
      } catch (error) {
        // console.warn('Could not fetch existing record:', error);
      }

      // Check if the file already exists
      const fileExists = existingFiles.some(
        (existingFile) =>
          existingFile.toLowerCase() === file.name.toLowerCase(),
      );

      if (fileExists) {
        // console.warn(`File with name ${file.name} already exists. Renaming to avoid conflicts.`);
        const timestamp = new Date().getTime();
        const nameParts = file.name.split(".");
        const extension = nameParts.pop();
        const baseName = nameParts.join(".");
        const newFileName = `${baseName}_${timestamp}.${extension}`;

        // Create a new file with the modified name
        const newFile = new File([file], newFileName, { type: file.type });
        formData.append(fieldName, newFile);
      } else {
        formData.append(fieldName, file);
      }

      try {
        const result = await pb
          .collection(collectionName)
          .update<T>(recordId, formData);
        // console.log('Upload successful:', {
        //   result,
        //   fileInfo: {
        //     name: file.name,
        //     size: file.size,
        //     type: file.type
        //   },
        //   collection: collectionName,
        //   recordId: recordId
        // });

        // Verify the file was actually added to the record
        try {
          const updatedRecord = await pb
            .collection(collectionName)
            .getOne(recordId);
          // console.log('Updated record files:', {
          //   files: updatedRecord.files,
          //   recordId: recordId
          // });
        } catch (verifyError) {
          // console.warn('Could not verify file upload:', verifyError);
        }

        return result;
      } catch (pbError: any) {
        // Log detailed PocketBase error
        // console.error('PocketBase upload error:', {
        //   status: pbError?.status,
        //   response: pbError?.response,
        //   data: pbError?.data,
        //   message: pbError?.message
        // });

        // More specific error message based on file type
        if (
          fileExtension &&
          FileManager.UNSUPPORTED_EXTENSIONS.includes(fileExtension)
        ) {
          throw new Error(
            `Upload failed: File type .${fileExtension} is not supported. Please convert to PDF or image format.`,
          );
        }

        throw new Error(
          `Upload failed: ${pbError?.message || "Unknown PocketBase error"}`,
        );
      }
    } catch (err) {
      // console.error(`Failed to upload file to ${collectionName}:`, {
      //   error: err,
      //   fileInfo: {
      //     name: file.name,
      //     size: file.size,
      //     type: file.type
      //   },
      //   auth: {
      //     isAuthenticated: this.auth.isAuthenticated(),
      //     userId: this.auth.getUserId()
      //   }
      // });

      if (err instanceof Error) {
        throw err;
      }
      throw new Error(`Upload failed: ${err}`);
    } finally {
      this.auth.setUpdating(false);
    }
  }

  /**
   * Upload multiple files to a record with chunked upload support
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
    files: File[],
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to upload files");
    }

    try {
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();

      const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file limit
      const MAX_BATCH_SIZE = 25 * 1024 * 1024; // 25MB per batch

      // Validate file types and sizes first
      for (const file of files) {
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(
            `File ${file.name} is too large. Maximum size is 50MB.`,
          );
        }

        // Validate file type
        const validation = this.validateFileType(file);
        if (!validation.valid) {
          throw new Error(`File ${file.name}: ${validation.reason}`);
        }
      }

      // Get existing record if updating
      let existingFiles: string[] = [];
      if (recordId) {
        try {
          const record = await pb
            .collection(collectionName)
            .getOne<T>(recordId);
          existingFiles = (record as any)[field] || [];
        } catch (error) {
          // console.warn("Failed to fetch existing record:", error);
        }
      }

      // Process files in batches
      let currentBatchSize = 0;
      let currentBatch: File[] = [];
      let allProcessedFiles: File[] = [];

      // Process each file
      for (const file of files) {
        let processedFile = file;

        try {
          // Try to compress image files if needed
          if (file.type.startsWith("image/")) {
            processedFile = await this.compressImageIfNeeded(file, 50); // 50MB max size
          }
        } catch (error) {
          // console.warn(`Failed to process file ${file.name}:`, error);
          processedFile = file; // Use original file if processing fails
        }

        // Check if adding this file would exceed batch size
        if (currentBatchSize + processedFile.size > MAX_BATCH_SIZE) {
          // Upload current batch
          if (currentBatch.length > 0) {
            await this.uploadBatch(
              collectionName,
              recordId,
              field,
              currentBatch,
            );
            allProcessedFiles.push(...currentBatch);
          }
          // Reset batch
          currentBatch = [processedFile];
          currentBatchSize = processedFile.size;
        } else {
          // Add to current batch
          currentBatch.push(processedFile);
          currentBatchSize += processedFile.size;
        }
      }

      // Upload any remaining files
      if (currentBatch.length > 0) {
        await this.uploadBatch(collectionName, recordId, field, currentBatch);
        allProcessedFiles.push(...currentBatch);
      }

      // Get the final record state
      const finalRecord = await pb
        .collection(collectionName)
        .getOne<T>(recordId);
      return finalRecord;
    } catch (err) {
      // console.error(`Failed to upload files to ${collectionName}:`, err);
      throw err;
    } finally {
      this.auth.setUpdating(false);
    }
  }

  /**
   * Upload a batch of files
   * @private
   */
  private async uploadBatch<T = any>(
    collectionName: string,
    recordId: string,
    field: string,
    files: File[],
  ): Promise<void> {
    const pb = this.auth.getPocketBase();
    const formData = new FormData();

    // Get existing files to check for duplicates
    let existingFiles: string[] = [];
    try {
      const record = await pb.collection(collectionName).getOne(recordId);
      existingFiles = record[field] || [];
    } catch (error) {
      // console.warn("Failed to fetch existing record for duplicate check:", error);
    }

    // Add new files, renaming duplicates if needed
    for (const file of files) {
      let fileToUpload = file;

      // Check if filename already exists
      if (Array.isArray(existingFiles) && existingFiles.includes(file.name)) {
        const timestamp = new Date().getTime();
        const nameParts = file.name.split(".");
        const extension = nameParts.pop();
        const baseName = nameParts.join(".");
        const newFileName = `${baseName}_${timestamp}.${extension}`;

        // Create a new file with the modified name
        fileToUpload = new File([file], newFileName, { type: file.type });

        // console.log(`Renamed duplicate file from ${file.name} to ${newFileName}`);
      }

      formData.append(field, fileToUpload);
    }

    // Tell PocketBase to keep existing files
    if (existingFiles.length > 0) {
      formData.append(`${field}@`, ""); // This tells PocketBase to keep existing files
    }

    try {
      await pb.collection(collectionName).update(recordId, formData);
    } catch (error: any) {
      if (error.status === 413) {
        throw new Error(
          `Upload failed: Batch size too large. Please try uploading smaller files.`,
        );
      }
      throw error;
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
    files: File[],
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to upload files");
    }

    try {
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();

      // First, get the current record to check existing files
      const record = await pb.collection(collectionName).getOne<T>(recordId);

      // Get existing files from the record
      const existingFiles = (record as any)[field] || [];
      const existingFilenames = new Set(existingFiles);

      // Create FormData for the new files only
      const formData = new FormData();

      // Tell PocketBase to keep existing files
      formData.append(`${field}@`, "");

      // Append new files, renaming if needed to avoid duplicates
      for (const file of files) {
        let fileToUpload = file;

        // Check if filename already exists
        if (existingFilenames.has(file.name)) {
          const timestamp = new Date().getTime();
          const nameParts = file.name.split(".");
          const extension = nameParts.pop();
          const baseName = nameParts.join(".");
          const newFileName = `${baseName}_${timestamp}.${extension}`;

          // Create a new file with the modified name
          fileToUpload = new File([file], newFileName, { type: file.type });

          // console.log(`Renamed duplicate file from ${file.name} to ${newFileName}`);
        }

        formData.append(field, fileToUpload);
      }

      const result = await pb
        .collection(collectionName)
        .update<T>(recordId, formData);
      return result;
    } catch (err) {
      // console.error(`Failed to append files to ${collectionName}:`, err);
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
    filename: string,
  ): string {
    const pb = this.auth.getPocketBase();
    return pb.files.getURL(
      { id: recordId, collectionId: collectionName },
      filename,
    );
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
    field: string,
  ): Promise<T> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to delete files");
    }

    try {
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();
      const data = { [field]: null };
      const result = await pb
        .collection(collectionName)
        .update<T>(recordId, data);
      return result;
    } catch (err) {
      // console.error(`Failed to delete file from ${collectionName}:`, err);
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
    filename: string,
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
      // console.error(`Failed to download file from ${collectionName}:`, err);
      throw err;
    } finally {
      this.auth.setUpdating(false);
    }
  }

  /**
   * Get multiple files from a record
   * @param collectionName The name of the collection
   * @param recordId The ID of the record containing the files
   * @param field The field name containing the files
   * @returns Array of file URLs
   */
  public async getFiles(
    collectionName: string,
    recordId: string,
    field: string,
  ): Promise<string[]> {
    if (!this.auth.isAuthenticated()) {
      throw new Error("User must be authenticated to get files");
    }

    try {
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();

      // Get the record to retrieve the filenames
      const record = await pb.collection(collectionName).getOne(recordId);

      // Get the filenames from the specified field
      const filenames = record[field] || [];

      // Convert filenames to URLs
      const fileUrls = filenames.map((filename: string) =>
        this.getFileUrl(collectionName, recordId, filename),
      );

      return fileUrls;
    } catch (err) {
      // console.error(`Failed to get files from ${collectionName}:`, err);
      throw err;
    } finally {
      this.auth.setUpdating(false);
    }
  }

  /**
   * Compress an image file if it's too large
   * @param file The image file to compress
   * @param maxSizeInMB Maximum size in MB
   * @returns Promise<File> The compressed file
   */
  public async compressImageIfNeeded(
    file: File,
    maxSizeInMB: number = 50,
  ): Promise<File> {
    if (!file.type.startsWith("image/")) {
      return file;
    }

    const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
    if (file.size <= maxSizeInBytes) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;

        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions while maintaining aspect ratio
          const maxDimension = 3840; // Higher quality for larger files
          if (width > height && width > maxDimension) {
            height *= maxDimension / width;
            width = maxDimension;
          } else if (height > maxDimension) {
            width *= maxDimension / height;
            height = maxDimension;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          // Convert to blob with higher quality for larger files
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to compress image"));
                return;
              }
              resolve(
                new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                }),
              );
            },
            "image/jpeg",
            0.85, // Higher quality setting for larger files
          );
        };

        img.onerror = () => {
          reject(new Error("Failed to load image for compression"));
        };
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file for compression"));
      };
    });
  }

  /**
   * Get a file token for accessing protected files
   * @returns Promise<string> The file token
   */
  public async getFileToken(): Promise<string> {
    // Check authentication status
    if (!this.auth.isAuthenticated()) {
      // console.warn("User is not authenticated when trying to get file token");

      // Try to refresh the auth if possible
      try {
        const pb = this.auth.getPocketBase();
        if (pb.authStore.isValid) {
          // console.log(
          //   "Auth store is valid, but auth check failed. Trying to refresh token.",
          // );
          await pb.collection("users").authRefresh();
          // console.log("Auth refreshed successfully");
        } else {
          throw new Error("User must be authenticated to get a file token");
        }
      } catch (refreshError) {
        // console.error("Failed to refresh authentication:", refreshError);
        throw new Error("User must be authenticated to get a file token");
      }
    }

    try {
      this.auth.setUpdating(true);
      const pb = this.auth.getPocketBase();

      // Log auth status
      // console.log("Auth status before getting token:", {
      //   isValid: pb.authStore.isValid,
      //   token: pb.authStore.token
      //     ? pb.authStore.token.substring(0, 10) + "..."
      //     : "none",
      //   model: pb.authStore.model ? pb.authStore.model.id : "none",
      // });

      const result = await pb.files.getToken();
      // console.log("Got file token:", result.substring(0, 10) + "...");
      return result;
    } catch (err) {
      // console.error("Failed to get file token:", err);
      throw err;
    } finally {
      this.auth.setUpdating(false);
    }
  }

  /**
   * Get a file URL with an optional token for protected files
   * @param collectionName The name of the collection
   * @param recordId The ID of the record containing the file
   * @param filename The name of the file
   * @param useToken Whether to include a token for protected files
   * @returns Promise<string> The file URL with token if requested
   */
  public async getFileUrlWithToken(
    collectionName: string,
    recordId: string,
    filename: string,
    useToken: boolean = false,
  ): Promise<string> {
    const pb = this.auth.getPocketBase();

    // Check if filename is empty
    if (!filename) {
      // console.error(
      //   `Empty filename provided for ${collectionName}/${recordId}`,
      // );
      return "";
    }

    // Check if user is authenticated
    if (!this.auth.isAuthenticated()) {
      // console.warn("User is not authenticated when trying to get file URL");
    }

    // Always try to use token for protected files
    if (useToken) {
      try {
        // console.log(
        //   `Getting file token for ${collectionName}/${recordId}/${filename}`,
        // );
        const token = await this.getFileToken();
        // console.log(`Got token: ${token.substring(0, 10)}...`);

        // Make sure to pass the token as a query parameter
        const url = pb.files.getURL(
          { id: recordId, collectionId: collectionName },
          filename,
          { token },
        );
        // console.log(`Generated URL with token: ${url.substring(0, 50)}...`);
        return url;
      } catch (error) {
        // console.error("Error getting file token:", error);
        // Fall back to URL without token
        const url = pb.files.getURL(
          { id: recordId, collectionId: collectionName },
          filename,
        );
        // console.log(`Fallback URL without token: ${url.substring(0, 50)}...`);
        return url;
      }
    }

    // If not using token
    const url = pb.files.getURL(
      { id: recordId, collectionId: collectionName },
      filename,
    );
    // console.log(`Generated URL without token: ${url.substring(0, 50)}...`);
    return url;
  }
}
