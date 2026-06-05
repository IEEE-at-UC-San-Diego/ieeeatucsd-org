import { useState, useRef } from "react";
import {
  Upload,
  X,
  FileText,
  Image,
  File,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface MultiFileUploadProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  existingFiles?: string[];
  onRemoveExistingFile?: (fileUrl: string) => void;
  accept?: string;
  maxFiles?: number;
  maxSizeInMB?: number;
  label?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
}

export function MultiFileUpload({
  files,
  onFilesChange,
  existingFiles = [],
  onRemoveExistingFile,
  accept = ".pdf,.jpg,.jpeg,.png,.doc,.docx",
  maxFiles = 10,
  maxSizeInMB = 10,
  label = "Upload Files",
  description = "Drag and drop files here, or click to browse",
  required = false,
  disabled = false,
}: MultiFileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext && ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      return <Image className="w-5 h-5" />;
    } else if (ext === "pdf") {
      return <FileText className="w-5 h-5" />;
    }
    return <File className="w-5 h-5" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const validateFile = (file: File): string | null => {
    const MAX_SAFE_FILE_SIZE = 100 * 1024 * 1024; // 100MB hard limit
    const effectiveMaxSize = Math.min(maxSizeInMB * 1024 * 1024, MAX_SAFE_FILE_SIZE);

    if (file.size > effectiveMaxSize) {
      if (file.size > MAX_SAFE_FILE_SIZE) {
        return `File "${file.name}" is too large (${formatFileSize(file.size)}). Maximum file size is 100MB. Please compress or split the file.`;
      }
      return `File "${file.name}" exceeds ${maxSizeInMB}MB limit`;
    }

    const acceptedTypes = accept.split(",").map((t) => t.trim());
    const fileParts = file.name.split(".");
    const fileExt =
      fileParts.length > 1 ? "." + fileParts.pop()?.toLowerCase() : "";

    if (!fileExt) {
      return `File must have an extension. Allowed: ${accept}`;
    }
    if (!acceptedTypes.includes(fileExt)) {
      return `File type not accepted. Allowed: ${accept}`;
    }

    return null;
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles || disabled) return;

    setErrorMessage("");

    const fileArray = Array.from(newFiles);
    const totalFiles = files.length + existingFiles.length + fileArray.length;

    if (totalFiles > maxFiles) {
      setErrorMessage(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const validFiles: File[] = [];
    const errors: string[] = [];

    fileArray.forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    if (errors.length > 0) {
      setErrorMessage(errors.join("; "));
    }

    if (validFiles.length > 0) {
      onFilesChange([...files, ...validFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  const handlePreview = (fileUrl: string) => {
    try {
      const url = new URL(fileUrl);
      if (!["http:", "https:", "blob:"].includes(url.protocol)) {
        setErrorMessage("Invalid file URL protocol");
        return;
      }
      window.open(fileUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage("Invalid file URL");
    }
  };

  const totalFileCount = files.length + existingFiles.length;
  const canAddMore = totalFileCount < maxFiles;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>

      {errorMessage && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-destructive hover:text-destructive"
            onClick={() => setErrorMessage("")}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Existing Files:
          </p>
          <div className="grid grid-cols-1 gap-2">
            {existingFiles.map((fileUrl, index) => {
              const fileName =
                fileUrl.split("/").pop()?.split("?")[0] || `File ${index + 1}`;
              let decodedName = fileName;
              try {
                decodedName = decodeURIComponent(fileName);
              } catch (error) {
                console.warn("Failed to decode filename:", fileName, error);
              }

              return (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-primary flex-shrink-0">
                      {getFileIcon(decodedName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {decodedName}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        Uploaded
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePreview(fileUrl)}
                    >
                      <FileText className="w-4 h-4" />
                    </Button>
                    {onRemoveExistingFile && !disabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemoveExistingFile(fileUrl)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            New Files to Upload:
          </p>
          <div className="grid grid-cols-1 gap-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="text-muted-foreground flex-shrink-0">
                    {getFileIcon(file.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  disabled={disabled}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {canAddMore && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (!disabled && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          tabIndex={disabled ? -1 : 0}
          role="button"
          aria-label="Upload files by clicking or using drag and drop"
          className={`
            relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
            ${isDragOver
              ? "border-primary bg-primary/5"
              : "border-input hover:border-primary/50 hover:bg-muted/50"
            }
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={accept}
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled}
          />

          <Upload
            className={`w-10 h-10 mx-auto mb-3 ${
              isDragOver ? "text-primary" : "text-muted-foreground"
            }`}
          />

          <p className="text-sm font-medium mb-1">{description}</p>

          <p className="text-xs text-muted-foreground">
            {`${accept.split(",").join(", ").toUpperCase()} • up to ${Math.min(maxSizeInMB, 100)}MB`}
          </p>

          {totalFileCount > 0 && (
            <div className="mt-3">
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
                {totalFileCount} / {maxFiles} files
              </span>
            </div>
          )}
        </div>
      )}

      {!canAddMore && (
        <div className="text-center p-4 bg-muted rounded-lg border">
          <p className="text-sm text-muted-foreground">
            Maximum file limit reached ({maxFiles} files)
          </p>
        </div>
      )}
    </div>
  );
}
