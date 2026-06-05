import { useState, useCallback } from "react";
import { Upload, X, Eye, Lock, Unlock, File, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { EventFile } from "../types";

interface FileManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId?: string;
  files: EventFile[];
  onUpload: (files: FileList) => void;
  onDelete: (fileId: string) => void;
  onToggleVisibility?: (fileId: string, isPublic: boolean) => void;
}

export function FileManagerModal({
  isOpen,
  onClose,
  eventId: _eventId,
  files,
  onUpload,
  onDelete,
  onToggleVisibility,
}: FileManagerModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        setSelectedFiles(e.dataTransfer.files);
      }
    },
    []
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(e.target.files);
    }
  };

  const handleUpload = () => {
    if (selectedFiles) {
      onUpload(selectedFiles);
      setSelectedFiles(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>File Manager</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-2">
              Drag and drop files here, or{" "}
              <label className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium">
                browse
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </p>
            <p className="text-xs text-gray-400">
              Supports images, documents, and PDFs up to 50MB
            </p>
          </div>

          {selectedFiles && selectedFiles.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-900">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""}{" "}
                  selected
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFiles(null)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                  <Button size="sm" onClick={handleUpload}>
                    <Upload className="h-4 w-4 mr-1" />
                    Upload
                  </Button>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {Array.from(selectedFiles).map((file, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-blue-700 flex items-center gap-2"
                  >
                    <File className="h-3 w-3" />
                    {file.name} ({formatFileSize(file.size)})
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b text-xs font-medium text-gray-500 uppercase">
              {files.length} file{files.length !== 1 ? "s" : ""}
            </div>

            {files.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <File className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No files uploaded yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Upload files to share with event attendees
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {files.map((file) => (
                  <div
                    key={file._id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <File className="h-8 w-8 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>Uploaded {formatDate(file.uploadedAt)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            {file.isPublic ? (
                              <>
                                <Unlock className="h-3 w-3" />
                                Public
                              </>
                            ) : (
                              <>
                                <Lock className="h-3 w-3" />
                                Private
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => window.open(file.url, "_blank")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {onToggleVisibility && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            onToggleVisibility(file._id, !file.isPublic)
                          }
                          title={
                            file.isPublic ? "Make private" : "Make public"
                          }
                        >
                          {file.isPublic ? (
                            <Unlock className="h-4 w-4" />
                          ) : (
                            <Lock className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => onDelete(file._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
