import React, { useState, useRef } from 'react';
import { Upload, X, FileText, Image as ImageIcon, File, Eye, AlertCircle } from 'lucide-react';
import { Card, CardBody, Button, Chip } from '@heroui/react';

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

export default function MultiFileUpload({
    files,
    onFilesChange,
    existingFiles = [],
    onRemoveExistingFile,
    accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx',
    maxFiles = 10,
    maxSizeInMB = 10,
    label = 'Upload Files',
    description = 'Drag and drop files here, or click to browse',
    required = false,
    disabled = false
}: MultiFileUploadProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getFileIcon = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            return <ImageIcon className="w-5 h-5" />;
        } else if (ext === 'pdf') {
            return <FileText className="w-5 h-5" />;
        }
        return <File className="w-5 h-5" />;
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const clampedIndex = Math.min(i, sizes.length - 1);
        return Math.round((bytes / Math.pow(k, clampedIndex)) * 100) / 100 + ' ' + sizes[clampedIndex];
    };

    const validateFile = (file: File): string | null => {
        // Check file size - use the more restrictive of maxSizeInMB or 100MB hard limit
        const MAX_SAFE_FILE_SIZE = 100 * 1024 * 1024; // 100MB hard limit
        const effectiveMaxSize = Math.min(maxSizeInMB * 1024 * 1024, MAX_SAFE_FILE_SIZE);

        if (file.size > effectiveMaxSize) {
            if (file.size > MAX_SAFE_FILE_SIZE) {
                return `File "${file.name}" is too large (${formatFileSize(file.size)}). Maximum file size is 100MB. Please compress or split the file.`;
            }
            return `File "${file.name}" exceeds ${maxSizeInMB}MB limit`;
        }

        // Check file type - both extension and MIME type validation
        const acceptedTypes = accept.split(',').map(t => t.trim());
        const fileParts = file.name.split('.');
        const fileExt = fileParts.length > 1 ? '.' + fileParts.pop()?.toLowerCase() : '';
        const mimeType = file.type.toLowerCase();

        // Define MIME type mappings for safety (expanded coverage)
        const mimeTypeMap: Record<string, string[]> = {
            '.pdf': ['application/pdf'],
            '.jpg': ['image/jpeg'],
            '.jpeg': ['image/jpeg'],
            '.png': ['image/png'],
            '.gif': ['image/gif'],
            '.webp': ['image/webp'],
            '.svg': ['image/svg+xml'],
            '.heic': ['image/heic', 'image/heif'],
            '.heif': ['image/heif'],
            '.doc': ['application/msword'],
            '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            '.txt': ['text/plain'],
            '.csv': ['text/csv', 'application/vnd.ms-excel'],
            '.xls': ['application/vnd.ms-excel', 'application/xls'],
            '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
            '.ppt': ['application/vnd.ms-powerpoint'],
            '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
            '.zip': ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'],
            '.json': ['application/json'],
            '.md': ['text/markdown', 'text/plain']
        };

        if (!fileExt) {
            return `File must have an extension. Allowed: ${accept}`;
        }
        if (!acceptedTypes.includes(fileExt)) {
            return `File type not accepted. Allowed: ${accept}`;
        }

        // Additional MIME type validation for security
        const allowedMimeTypes = mimeTypeMap[fileExt];
        if (allowedMimeTypes && !allowedMimeTypes.includes(mimeType)) {
            return `File MIME type "${mimeType}" does not match expected type for ${fileExt.toUpperCase()} files. This may indicate a corrupted or malicious file.`;
        }

        return null;
    };

    const handleFiles = (newFiles: FileList | null) => {
        if (!newFiles || disabled) return;

        // Clear previous errors
        setErrorMessage('');

        const fileArray = Array.from(newFiles);
        const totalFiles = files.length + existingFiles.length + fileArray.length;

        if (totalFiles > maxFiles) {
            setErrorMessage(`Maximum ${maxFiles} files allowed`);
            return;
        }

        const validFiles: File[] = [];
        const errors: string[] = [];

        fileArray.forEach(file => {
            const error = validateFile(file);
            if (error) {
                errors.push(error);
            } else {
                validFiles.push(file);
            }
        });

        if (errors.length > 0) {
            setErrorMessage(errors.join('; '));
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
        // Reset input to allow selecting the same file again
        e.target.value = '';
    };

    const removeFile = (index: number) => {
        const newFiles = files.filter((_, i) => i !== index);
        onFilesChange(newFiles);
    };

    const handlePreview = (fileUrl: string) => {
        // Validate URL before opening to prevent XSS
        try {
            const url = new URL(fileUrl);
            // Only allow http, https, and blob protocols
            if (!['http:', 'https:', 'blob:'].includes(url.protocol)) {
                setErrorMessage('Invalid file URL protocol');
                return;
            }
            window.open(fileUrl, '_blank', 'noopener,noreferrer');
        } catch (error) {
            setErrorMessage('Invalid file URL');
        }
    };

    const totalFileCount = files.length + existingFiles.length;
    const canAddMore = totalFileCount < maxFiles;

    return (
        <div className="space-y-3">
            {/* Label */}
            <label className="block text-sm font-medium text-gray-700">
                {label}
                {required && <span className="text-red-600 ml-1">*</span>}
            </label>

            {/* Error Message */}
            {errorMessage && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-sm text-red-800">{errorMessage}</p>
                    </div>
                    <button
                        onClick={() => setErrorMessage('')}
                        className="text-red-600 hover:text-red-800 flex-shrink-0"
                        aria-label="Dismiss error"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Existing Files */}
            {existingFiles.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600">Existing Files:</p>
                    <div className="grid grid-cols-1 gap-2">
                        {existingFiles.map((fileUrl, index) => {
                            const fileName = fileUrl.split('/').pop()?.split('?')[0] || `File ${index + 1}`;
                            let decodedName = fileName;
                            try {
                                decodedName = decodeURIComponent(fileName);
                            } catch (error) {
                                // If decodeURIComponent fails, use the original filename
                                console.warn('Failed to decode filename:', fileName, error);
                            }

                            return (
                                <Card key={index} className="border border-gray-200">
                                    <CardBody className="p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="text-blue-600 flex-shrink-0">
                                                    {getFileIcon(decodedName)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">
                                                        {decodedName}
                                                    </p>
                                                    <Chip size="sm" color="success" variant="flat" className="mt-1">
                                                        Uploaded
                                                    </Chip>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    color="primary"
                                                    onPress={() => handlePreview(fileUrl)}
                                                    title="View file"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                {onRemoveExistingFile && !disabled && (
                                                    <Button
                                                        isIconOnly
                                                        size="sm"
                                                        variant="light"
                                                        color="danger"
                                                        onPress={() => onRemoveExistingFile(fileUrl)}
                                                        title="Remove file"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardBody>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* New Files */}
            {files.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-600">New Files to Upload:</p>
                    <div className="grid grid-cols-1 gap-2">
                        {files.map((file, index) => (
                            <Card key={index} className="border border-gray-200">
                                <CardBody className="p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="text-gray-600 flex-shrink-0">
                                                {getFileIcon(file.name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {file.name}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {formatFileSize(file.size)}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            isIconOnly
                                            size="sm"
                                            variant="light"
                                            color="danger"
                                            onPress={() => removeFile(index)}
                                            isDisabled={disabled}
                                            title="Remove file"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Upload Area */}
            {canAddMore && (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => !disabled && fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            fileInputRef.current?.click();
                        }
                    }}
                    tabIndex={disabled ? -1 : 0}
                    role="button"
                    aria-label="Upload files by clicking or using drag and drop"
                    className={`
                        relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
                        ${isDragOver
                            ? 'border-blue-500 bg-blue-50 scale-[1.02]'
                            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50'
                        }
                        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
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

                    <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />

                    <p className="text-sm font-medium text-gray-700 mb-1">
                        {description}
                    </p>

                    <p className="text-xs text-gray-500">
                        {`${accept.split(',').join(', ').toUpperCase()} • up to ${Math.min(maxSizeInMB, 100)}MB (100MB hard limit enforced)`}
                    </p>

                    {totalFileCount > 0 && (
                        <div className="mt-3">
                            <Chip size="sm" color="primary" variant="flat">
                                {totalFileCount} / {maxFiles} files
                            </Chip>
                        </div>
                    )}
                </div>
            )}

            {/* File count limit reached */}
            {!canAddMore && (
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600">
                        Maximum file limit reached ({maxFiles} files)
                    </p>
                </div>
            )}
        </div>
    );
}
