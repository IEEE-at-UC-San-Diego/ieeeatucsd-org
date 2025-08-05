import { useState, useCallback } from 'react';
import { Upload, Eye, Download, Trash2, RefreshCw, FileText, Image, AlertCircle, CheckCircle } from 'lucide-react';
import DragDropFileUpload from './DragDropFileUpload';
import { extractFilename, isImageFile, formatFileSize } from '../utils/filenameUtils';

interface ExistingFile {
  url: string;
  filename?: string;
  uploadDate?: string;
  size?: number;
}

interface EnhancedFileUploadManagerProps {
  // File management
  existingFiles: string[] | ExistingFile[];
  newFiles: File[] | File | null;
  onFilesChange: (files: File[] | File | null) => void;
  onRemoveExistingFile: (fileUrl: string) => void;

  // Upload configuration
  allowedTypes?: string[];
  maxSizeInMB?: number;
  maxFiles?: number;
  multiple?: boolean;
  required?: boolean;

  // UI configuration
  title: string;
  description?: string;
  uploadFunction?: (file: File) => Promise<string>;
  disabled?: boolean;
  className?: string;

  // Event tracking
  eventRequestId?: string;
  showAuditLogging?: boolean;
}

export default function EnhancedFileUploadManager({
  existingFiles = [],
  newFiles,
  onFilesChange,
  onRemoveExistingFile,
  allowedTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'],
  maxSizeInMB = 10,
  maxFiles = 5,
  multiple = true,
  required = false,
  title,
  description,
  uploadFunction,
  disabled = false,
  className = '',
  eventRequestId: _eventRequestId,
  showAuditLogging: _showAuditLogging = true
}: EnhancedFileUploadManagerProps) {
  const [showUploadArea, setShowUploadArea] = useState(false);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  // Normalize existing files to consistent format
  const normalizedExistingFiles: ExistingFile[] = existingFiles.map(file =>
    typeof file === 'string'
      ? { url: file, filename: extractFilename(file) }
      : file
  );

  // Convert newFiles to array for consistent handling
  const newFilesArray = newFiles
    ? (Array.isArray(newFiles) ? newFiles : [newFiles])
    : [];

  const hasExistingFiles = normalizedExistingFiles.length > 0;
  const hasNewFiles = newFilesArray.length > 0;
  const hasAnyFiles = hasExistingFiles || hasNewFiles;

  const handleFilesSelected = useCallback((files: File[]) => {
    if (multiple) {
      onFilesChange(files);
    } else {
      onFilesChange(files[0] || null);
    }
    setUploadState('success');
  }, [multiple, onFilesChange]);

  const handleFileUploaded = useCallback((_file: File, _url: string) => {
    setUploadState('success');
  }, []);

  const handleUploadError = useCallback((_file: File, _error: string) => {
    setUploadState('error');
  }, []);

  const removeNewFile = (index: number) => {
    const updatedFiles = newFilesArray.filter((_, i) => i !== index);
    if (multiple) {
      onFilesChange(updatedFiles);
    } else {
      onFilesChange(null);
    }
  };

  const getFileIcon = (filename: string) => {
    if (isImageFile(filename)) {
      return <Image className="w-5 h-5 text-blue-500" />;
    }
    return <FileText className="w-5 h-5 text-gray-500" />;
  };

  const getUploadStateIcon = () => {
    switch (uploadState) {
      case 'uploading':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Upload className="w-4 h-4 text-gray-500" />;
    }
  };

  // Extract error styling to apply to the drag-drop area
  const isErrorState = className.includes('border-red');
  const errorClasses = isErrorState ? 'border-red-300 bg-red-50' : '';

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            {getUploadStateIcon()}
            <label className="text-sm font-medium text-gray-700">
              {title}
              {required && <span className="text-red-500 ml-1">*</span>}
            </label>
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>

        {/* Action buttons when files exist */}
        {hasAnyFiles && !disabled && (
          <div className="flex items-center space-x-2 ml-4">
            {!showUploadArea && (
              <button
                type="button"
                onClick={() => setShowUploadArea(true)}
                className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
              >
                <Upload className="w-4 h-4 mr-1" />
                <span>{hasExistingFiles ? 'Replace' : 'Add More'}</span>
              </button>
            )}
            {showUploadArea && (
              <button
                type="button"
                onClick={() => setShowUploadArea(false)}
                className="inline-flex items-center px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      {/* Existing Files Display */}
      {hasExistingFiles && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <h4 className="text-sm font-medium text-gray-700">Current Files</h4>
          </div>
          <div className="space-y-2">
            {normalizedExistingFiles.map((file, index) => (
              <div key={index} className="group border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {getFileIcon(file.filename || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.filename || 'Unknown file'}
                      </p>
                      <div className="flex items-center space-x-3 mt-1">
                        {file.uploadDate && (
                          <p className="text-xs text-gray-500">
                            Uploaded: {new Date(file.uploadDate).toLocaleDateString()}
                          </p>
                        )}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Uploaded
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-8 h-8 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-md transition-colors"
                      title="View file"
                    >
                      <Eye className="w-4 h-4" />
                    </a>
                    <a
                      href={file.url}
                      download
                      className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => onRemoveExistingFile(file.url)}
                        className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-md transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Files Display */}
      {hasNewFiles && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <h4 className="text-sm font-medium text-gray-700">New Files</h4>
          </div>
          <div className="space-y-2">
            {newFilesArray.map((file, index) => (
              <div key={index} className="group border border-blue-200 rounded-lg p-4 bg-blue-50 hover:bg-blue-100 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {getFileIcon(file.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                      <div className="flex items-center space-x-3 mt-1">
                        <p className="text-xs text-gray-600">
                          {formatFileSize(file.size)}
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Ready to upload
                        </span>
                      </div>
                    </div>
                  </div>

                  {!disabled && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => removeNewFile(index)}
                        className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-md transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Area */}
      {(!hasAnyFiles || showUploadArea) && !disabled && (
        <div className="space-y-3">
          {hasAnyFiles && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              <h4 className="text-sm font-medium text-gray-700">Upload New Files</h4>
            </div>
          )}
          <DragDropFileUpload
            onFilesSelected={handleFilesSelected}
            onFileUploaded={handleFileUploaded}
            onUploadError={handleUploadError}
            allowedTypes={allowedTypes}
            maxSizeInMB={maxSizeInMB}
            maxFiles={maxFiles}
            multiple={multiple}
            disabled={disabled}
            uploadFunction={uploadFunction}
            className={errorClasses}
          />
        </div>
      )}

      {/* File Requirements Info */}
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-center space-x-2">
            <span className="font-medium">Allowed types:</span>
            <span className="uppercase">{allowedTypes.join(', ')}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-medium">Max size:</span>
            <span>{maxSizeInMB}MB per file</span>
          </div>
          {multiple && (
            <div className="flex items-center space-x-2">
              <span className="font-medium">Max files:</span>
              <span>{maxFiles}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
