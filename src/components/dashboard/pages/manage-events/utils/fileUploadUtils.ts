import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { auth } from "../../../../../firebase/client";

export const uploadFiles = async (
  files: File[],
  path: string,
): Promise<string[]> => {
  const storage = getStorage();
  const uploadPromises = files.map(async (file) => {
    const storageRef = ref(
      storage,
      `${path}/${auth.currentUser?.uid}/${Date.now()}_${file.name}`,
    );
    const uploadTask = uploadBytesResumable(storageRef, file);

    await new Promise((resolve, reject) => {
      uploadTask.on("state_changed", null, reject, () =>
        resolve(uploadTask.snapshot.ref),
      );
    });

    return await getDownloadURL(uploadTask.snapshot.ref);
  });

  return await Promise.all(uploadPromises);
};

export const validateFileSize = (
  file: File,
  maxSizeMB: number = 1,
): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

export const validateFileType = (
  file: File,
  allowedTypes: string[],
): boolean => {
  return allowedTypes.some(
    (type) =>
      file.type.includes(type) || file.name.toLowerCase().endsWith(type),
  );
};

export const getFileExtension = (filename: string): string => {
  return filename.toLowerCase().split(".").pop() || "";
};

export const isImageFile = (filename: string): boolean => {
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
  const ext = getFileExtension(filename);
  return imageExtensions.includes(ext);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
