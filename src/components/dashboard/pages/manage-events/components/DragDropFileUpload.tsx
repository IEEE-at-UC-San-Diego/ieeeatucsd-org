import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, CheckCircle, AlertCircle, FileText, Image } from 'lucide-react';
import { truncateFilename, formatFileSize, isFileTypeAllowed, isFileSizeValid, isImageFile, isPdfFile } from '../utils/filenameUtils';

interface FileUploadProgress {
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
  url?: string;
}

interface DragDropFileUploadProps {
  onFilesSelected: (files: File[]) => void;
  onFileUploaded?: (file: File, url: string) => void;
  onUploadProgress?: (file: File, progress: number) => void;
  onUploadError?: (file: File, error: string) => void;
  allowedTypes?: string[];
  maxSizeInMB?: number;
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  uploadFunction?: (file: File) => Promise<string>;
}

export default function DragDropFileUpload({
  onFilesSelected,
  onFileUploaded,
  onUploadProgress,
  onUploadError,
  allowedTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'],
  maxSizeInMB = 10,
  maxFiles = 5,
  multiple = true,
  disabled = false,
  className = '',
  uploadFunction
}: DragDropFileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (!isFileTypeAllowed(file.name, allowedTypes)) {
      return `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`;
    }
    
    if (!isFileSizeValid(file.size, maxSizeInMB)) {
      return `File size too large. Maximum size: ${maxSizeInMB}MB`;
    }
    
    return null;
  };

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Validate files
    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        validFiles.push(file);
      }
    }

    // Check max files limit
    if (validFiles.length > maxFiles) {
      errors.push(`Too many files. Maximum allowed: ${maxFiles}`);
      return;
    }

    // Show validation errors
    if (errors.length > 0) {
      errors.forEach(error => {
        onUploadError?.(validFiles[0] || new File([], 'unknown'), error);
      });
      return;
    }

    if (validFiles.length === 0) return;

    // Initialize upload progress
    const initialProgress: FileUploadProgress[] = validFiles.map(file => ({
      file,
      progress: 0,
      status: 'uploading' as const
    }));
    
    setUploadProgress(prev => [...prev, ...initialProgress]);
    onFilesSelected(validFiles);

    // Start uploads if upload function is provided
    if (uploadFunction) {
      validFiles.forEach(async (file, index) => {
        try {
          // Simulate progress updates
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => prev.map(item => 
              item.file === file && item.status === 'uploading'
                ? { ...item, progress: Math.min(item.progress + 10, 90) }
                : item
            ));
          }, 200);

          const url = await uploadFunction(file);
          
          clearInterval(progressInterval);
          
          setUploadProgress(prev => prev.map(item => 
            item.file === file 
              ? { ...item, progress: 100, status: 'completed', url }
              : item
          ));
          
          onFileUploaded?.(file, url);
        } catch (error) {
          setUploadProgress(prev => prev.map(item => 
            item.file === file 
              ? { ...item, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
              : item
          ));
          
          onUploadError?.(file, error instanceof Error ? error.message : 'Upload failed');
        }
      });
    }
  }, [allowedTypes, maxSizeInMB, maxFiles, onFilesSelected, onFileUploaded, onUploadError, uploadFunction]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [disabled, handleFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFiles]);

  const removeUploadItem = (file: File) => {
    setUploadProgress(prev => prev.filter(item => item.file !== file));
  };

  const getFileIcon = (filename: string) => {
    if (isImageFile(filename)) {
      return <Image className="w-5 h-5 text-blue-500" />;
    } else if (isPdfFile(filename)) {
      return <FileText className="w-5 h-5 text-red-500" />;
    } else {
      return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${isDragOver 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={allowedTypes.map(type => `.${type}`).join(',')}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />
        
        <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
        
        <p className="text-sm font-medium text-gray-700 mb-1">
          {isDragOver ? 'Drop files here' : 'Click to upload or drag and drop'}
        </p>
        
        <p className="text-xs text-gray-500">
          {allowedTypes.join(', ').toUpperCase()} up to {maxSizeInMB}MB each
          {maxFiles > 1 && ` (max ${maxFiles} files)`}
        </p>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Upload Progress</h4>
          {uploadProgress.map((item, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-3 border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  {getFileIcon(item.file.name)}
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {truncateFilename(item.file.name)}
                  </span>
                  <span className="text-xs text-gray-500 flex-shrink-0">
                    {formatFileSize(item.file.size)}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {item.status === 'completed' && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                  {item.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <button
                    onClick={() => removeUploadItem(item.file)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {item.status === 'uploading' && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
              
              {item.status === 'error' && item.error && (
                <p className="text-xs text-red-600 mt-1">{item.error}</p>
              )}
              
              {item.status === 'completed' && (
                <p className="text-xs text-green-600 mt-1">Upload completed successfully</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
