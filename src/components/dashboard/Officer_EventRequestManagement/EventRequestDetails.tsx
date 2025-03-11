import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { DataSyncService } from '../../../scripts/database/DataSyncService';
import { Collections } from '../../../schemas/pocketbase/schema';
import type { EventRequest as SchemaEventRequest } from '../../../schemas/pocketbase/schema';
import { FileManager } from '../../../scripts/pocketbase/FileManager';

// Extended EventRequest interface with additional properties needed for this component
interface ExtendedEventRequest extends SchemaEventRequest {
    requested_user_expand?: {
        name: string;
        email: string;
    };
    invoice_data?: string | any;
    invoice_files?: string[]; // Array of invoice file IDs
}

interface EventRequestDetailsProps {
    request: ExtendedEventRequest;
    onClose: () => void;
    onStatusChange: (id: string, status: "submitted" | "pending" | "completed" | "declined") => Promise<void>;
}

// File preview modal component
interface FilePreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    collectionName: string;
    recordId: string;
    fileName: string;
    displayName: string;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
    isOpen,
    onClose,
    collectionName,
    recordId,
    fileName,
    displayName
}) => {
    const [fileUrl, setFileUrl] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [fileType, setFileType] = useState<'image' | 'pdf' | 'other'>('other');

    useEffect(() => {
        const loadFile = async () => {
            if (!isOpen) return;

            setIsLoading(true);
            setError(null);

            try {
                const fileManager = FileManager.getInstance();

                // Get file URL with token for secure access
                const url = await fileManager.getFileUrlWithToken(
                    collectionName,
                    recordId,
                    fileName,
                    true // Use token for secure access
                );

                setFileUrl(url);

                // Determine file type based on extension
                const extension = fileName.split('.').pop()?.toLowerCase() || '';
                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
                    setFileType('image');
                } else if (extension === 'pdf') {
                    setFileType('pdf');
                } else {
                    setFileType('other');
                }
            } catch (err) {
                console.error('Error loading file:', err);
                setError('Failed to load file. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };

        loadFile();
    }, [isOpen, collectionName, recordId, fileName]);

    const handleDownload = async () => {
        try {
            const fileManager = FileManager.getInstance();
            const blob = await fileManager.downloadFile(collectionName, recordId, fileName);

            // Create a download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = displayName || fileName;
            document.body.appendChild(a);
            a.click();

            // Clean up
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success('File downloaded successfully');
        } catch (err) {
            console.error('Error downloading file:', err);
            toast.error('Failed to download file');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="bg-base-200 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="bg-base-300 p-4 flex justify-between items-center">
                    <h3 className="text-xl font-bold truncate max-w-[80%]">{displayName || fileName}</h3>
                    <div className="flex items-center gap-2">
                        <button
                            className="btn btn-sm btn-outline"
                            onClick={handleDownload}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                        </button>
                        <button
                            className="btn btn-sm btn-circle"
                            onClick={onClose}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-auto p-4 flex items-center justify-center bg-base-300/30">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-8">
                            <div className="loading loading-spinner loading-lg"></div>
                            <p className="mt-4">Loading file...</p>
                        </div>
                    ) : error ? (
                        <div className="alert alert-error">
                            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    ) : (
                        <>
                            {fileType === 'image' && (
                                <div className="max-h-full max-w-full">
                                    <img
                                        src={fileUrl}
                                        alt={displayName || fileName}
                                        className="max-h-[70vh] max-w-full object-contain"
                                        onError={() => setError('Failed to load image')}
                                    />
                                </div>
                            )}

                            {fileType === 'pdf' && (
                                <iframe
                                    src={`${fileUrl}#toolbar=0`}
                                    className="w-full h-[70vh]"
                                    title={displayName || fileName}
                                ></iframe>
                            )}

                            {fileType === 'other' && (
                                <div className="flex flex-col items-center justify-center p-8 text-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="mb-4">This file type cannot be previewed directly.</p>
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleDownload}
                                    >
                                        Download File
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

// File preview component
const FilePreview: React.FC<{
    fileUrl: string,
    fileName: string,
    collectionName: string,
    recordId: string,
    originalFileName: string
}> = ({
    fileUrl,
    fileName,
    collectionName,
    recordId,
    originalFileName
}) => {
        const [isImage, setIsImage] = useState<boolean>(false);
        const [displayName, setDisplayName] = useState<string>(fileName);
        const [error, setError] = useState<boolean>(false);
        const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

        useEffect(() => {
            // Reset error state when fileUrl changes
            setError(false);

            // Check if the file is an image based on extension
            const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            const extension = fileUrl.split('.').pop()?.toLowerCase() || '';
            setIsImage(imageExtensions.includes(extension));

            // Try to extract a better file name from the URL
            try {
                // Extract the file name from the URL path
                const urlParts = fileUrl.split('/');
                const lastPart = urlParts[urlParts.length - 1];

                // If the last part contains a query string, remove it
                const cleanName = lastPart.split('?')[0];

                // Try to decode the URL to get a readable name
                const decodedName = decodeURIComponent(cleanName);

                // If we have a valid name that's different from the ID, use it
                if (decodedName && decodedName.length > 0 && decodedName !== fileName) {
                    setDisplayName(decodedName);
                }
            } catch (e) {
                // If anything goes wrong, just use the provided fileName
                console.error('Error parsing file name:', e);
            }
        }, [fileUrl, fileName]);

        // Handle image load error
        const handleImageError = () => {
            setIsImage(false);
            setError(true);
        };

        // Open the file preview modal
        const openModal = () => {
            setIsModalOpen(true);
        };

        // Close the file preview modal
        const closeModal = () => {
            setIsModalOpen(false);
        };

        // If there's an error with the file, show a fallback
        if (error) {
            return (
                <div className="border rounded-lg overflow-hidden bg-base-300/30 p-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="text-sm truncate max-w-[80%]">{displayName}</span>
                        </div>
                        <button
                            onClick={openModal}
                            className="btn btn-xs btn-ghost"
                        >
                            View
                        </button>
                    </div>

                    {/* File Preview Modal */}
                    <FilePreviewModal
                        isOpen={isModalOpen}
                        onClose={closeModal}
                        collectionName={collectionName}
                        recordId={recordId}
                        fileName={originalFileName}
                        displayName={displayName}
                    />
                </div>
            );
        }

        return (
            <div className="border rounded-lg overflow-hidden bg-base-300/30">
                {isImage ? (
                    <div className="flex flex-col">
                        <div className="relative aspect-video cursor-pointer" onClick={openModal}>
                            <img
                                src={fileUrl}
                                alt={displayName}
                                className="object-contain w-full h-full"
                                onError={handleImageError} // Fallback if not an image
                            />
                        </div>
                        <div className="p-2 flex justify-between items-center">
                            <span className="text-sm truncate max-w-[80%]" title={displayName}>{displayName}</span>
                            <button
                                onClick={openModal}
                                className="btn btn-xs btn-ghost"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-3 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm truncate max-w-[80%]" title={displayName}>{displayName}</span>
                        </div>
                        <button
                            onClick={openModal}
                            className="btn btn-xs btn-ghost"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>
                    </div>
                )}

                {/* File Preview Modal */}
                <FilePreviewModal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    collectionName={collectionName}
                    recordId={recordId}
                    fileName={originalFileName}
                    displayName={displayName}
                />
            </div>
        );
    };

// Separate component for AS Funding tab to isolate any issues
const ASFundingTab: React.FC<{ request: ExtendedEventRequest }> = ({ request }) => {
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
    const [selectedFile, setSelectedFile] = useState<{ name: string, displayName: string }>({ name: '', displayName: '' });

    // Helper function to safely get file extension
    const getFileExtension = (filename: string): string => {
        if (!filename || typeof filename !== 'string') return '';
        const parts = filename.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    };

    // Helper function to check if a file is an image
    const isImageFile = (filename: string): boolean => {
        const ext = getFileExtension(filename);
        return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    };

    // Helper function to check if a file is a PDF
    const isPdfFile = (filename: string): boolean => {
        return getFileExtension(filename) === 'pdf';
    };

    // Helper function to get a friendly display name from a filename
    const getFriendlyFileName = (filename: string, maxLength: number = 20): string => {
        if (!filename || typeof filename !== 'string') return 'Unknown File';

        // Remove any path information if present
        let name = filename;
        if (name.includes('/')) {
            name = name.split('/').pop() || name;
        }

        // Remove any URL parameters if present
        if (name.includes('?')) {
            name = name.split('?')[0];
        }

        // Try to decode the filename if it's URL encoded
        try {
            name = decodeURIComponent(name);
        } catch (e) {
            // If decoding fails, just use the original name
        }

        // If the name is too long, truncate it and add ellipsis
        if (name.length > maxLength) {
            // Get the extension
            const ext = getFileExtension(name);
            if (ext) {
                // Keep the extension and truncate the name
                const nameWithoutExt = name.substring(0, name.length - ext.length - 1);
                const truncatedName = nameWithoutExt.substring(0, maxLength - ext.length - 4); // -4 for the ellipsis and dot
                return `${truncatedName}...${ext}`;
            } else {
                // No extension, just truncate
                return `${name.substring(0, maxLength - 3)}...`;
            }
        }

        return name;
    };

    if (!request.as_funding_required) {
        return (
            <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">AS Funding Required</h4>
                <p>No</p>
            </div>
        );
    }

    // Process invoice data for display
    let invoiceData = request.invoice_data;

    // If invoice_data is not available, try to parse itemized_invoice
    if (!invoiceData && request.itemized_invoice) {
        try {
            if (typeof request.itemized_invoice === 'string') {
                invoiceData = JSON.parse(request.itemized_invoice);
            } else if (typeof request.itemized_invoice === 'object') {
                invoiceData = request.itemized_invoice;
            }
        } catch (e) {
            console.error('Failed to parse itemized_invoice:', e);
        }
    }

    // Check if we have any invoice files
    const hasInvoiceFiles = (request.invoice_files && request.invoice_files.length > 0) || request.invoice;

    // Use hardcoded PocketBase URL instead of environment variable
    const pocketbaseUrl = "https://pocketbase.ieeeucsd.org";

    // Open file preview modal
    const openFilePreview = (fileName: string, displayName: string) => {
        setSelectedFile({ name: fileName, displayName });
        setIsPreviewModalOpen(true);
    };

    // Close file preview modal
    const closeFilePreview = () => {
        setIsPreviewModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">AS Funding Required</h4>
                <p>Yes</p>
            </div>

            {request.food_drinks_being_served && (
                <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-1">Food/Drinks Being Served</h4>
                    <p>Yes</p>
                </div>
            )}

            {/* Display invoice files if available */}
            {hasInvoiceFiles ? (
                <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-1">Invoice Files</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                        {/* Display invoice_files array if available */}
                        {request.invoice_files && request.invoice_files.map((fileId, index) => {
                            const extension = getFileExtension(fileId);
                            const displayName = getFriendlyFileName(fileId, 25);

                            return (
                                <div
                                    key={`file-${index}`}
                                    className="border rounded-lg overflow-hidden bg-base-300/30 hover:bg-base-300/50 transition-colors cursor-pointer"
                                    onClick={() => openFilePreview(fileId, displayName)}
                                >
                                    <div className="p-4 flex items-center gap-3">
                                        {isImageFile(fileId) ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        ) : isPdfFile(fileId) ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        )}
                                        <div className="flex-grow">
                                            <p className="font-medium truncate" title={fileId}>{displayName}</p>
                                            <p className="text-xs text-gray-400">
                                                {extension ? extension.toUpperCase() : 'FILE'}
                                            </p>
                                        </div>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Display single invoice file if available */}
                        {request.invoice && (
                            <div
                                key="invoice"
                                className="border rounded-lg overflow-hidden bg-base-300/30 hover:bg-base-300/50 transition-colors cursor-pointer"
                                onClick={() => {
                                    const invoiceFile = request.invoice || '';
                                    openFilePreview(invoiceFile, getFriendlyFileName(invoiceFile, 25));
                                }}
                            >
                                <div className="p-4 flex items-center gap-3">
                                    {isImageFile(request.invoice) ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    ) : isPdfFile(request.invoice) ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    )}
                                    <div className="flex-grow">
                                        <p className="font-medium truncate" title={request.invoice}>
                                            {getFriendlyFileName(request.invoice, 25)}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {getFileExtension(request.invoice) ? getFileExtension(request.invoice).toUpperCase() : 'FILE'}
                                        </p>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="alert alert-info">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>No invoice files have been uploaded.</span>
                </div>
            )}

            {/* Display invoice data if available */}
            <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">Invoice Data</h4>
                <InvoiceTable invoiceData={invoiceData} />
            </div>

            {/* File Preview Modal */}
            <FilePreviewModal
                isOpen={isPreviewModalOpen}
                onClose={closeFilePreview}
                collectionName={Collections.EVENT_REQUESTS}
                recordId={request.id}
                fileName={selectedFile.name}
                displayName={selectedFile.displayName}
            />
        </div>
    );
};

// Separate component for invoice table
const InvoiceTable: React.FC<{ invoiceData: any }> = ({ invoiceData }) => {
    // If no invoice data is provided, show a message
    if (!invoiceData) {
        return (
            <div className="alert alert-info">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>No invoice data available.</span>
            </div>
        );
    }

    try {
        // Parse invoice data if it's a string
        let parsedInvoice = null;

        if (typeof invoiceData === 'string') {
            try {
                parsedInvoice = JSON.parse(invoiceData);
            } catch (e) {
                console.error('Failed to parse invoice data string:', e);
                return (
                    <div className="alert alert-warning">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span>Invalid invoice data format.</span>
                    </div>
                );
            }
        } else if (typeof invoiceData === 'object' && invoiceData !== null) {
            parsedInvoice = invoiceData;
        }

        // Check if we have valid invoice data
        if (!parsedInvoice || typeof parsedInvoice !== 'object') {
            return (
                <div className="alert alert-info">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>No structured invoice data available.</span>
                </div>
            );
        }

        // Extract items array
        let items = [];
        if (parsedInvoice.items && Array.isArray(parsedInvoice.items)) {
            items = parsedInvoice.items;
        } else if (Array.isArray(parsedInvoice)) {
            items = parsedInvoice;
        } else if (parsedInvoice.items && typeof parsedInvoice.items === 'object') {
            items = [parsedInvoice.items]; // Wrap single item in array
        } else {
            // Try to find any array in the object
            for (const key in parsedInvoice) {
                if (Array.isArray(parsedInvoice[key])) {
                    items = parsedInvoice[key];
                    break;
                }
            }
        }

        // If we still don't have items, check if the object itself looks like an item
        if (items.length === 0 && (parsedInvoice.item || parsedInvoice.description || parsedInvoice.name)) {
            items = [parsedInvoice];
        }

        // If we still don't have items, show a message
        if (items.length === 0) {
            return (
                <div className="alert alert-info">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>No invoice items found in the data.</span>
                </div>
            );
        }

        // Calculate subtotal from items
        const subtotal = items.reduce((sum: number, item: any) => {
            const quantity = parseFloat(item?.quantity || 1);
            const price = parseFloat(item?.unit_price || item?.price || 0);
            return sum + (quantity * price);
        }, 0);

        // Get tax, tip and total
        const tax = parseFloat(parsedInvoice.tax || parsedInvoice.taxAmount || 0);
        const tip = parseFloat(parsedInvoice.tip || parsedInvoice.tipAmount || 0);
        const total = parseFloat(parsedInvoice.total || 0) || (subtotal + tax + tip);

        // Render the invoice table
        return (
            <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item: any, index: number) => {
                            // Ensure we're not trying to render an object directly
                            const itemName = typeof item?.item === 'object'
                                ? JSON.stringify(item.item)
                                : (item?.item || item?.description || item?.name || 'N/A');

                            const quantity = parseFloat(item?.quantity || 1);
                            const unitPrice = parseFloat(item?.unit_price || item?.price || 0);
                            const itemTotal = quantity * unitPrice;

                            return (
                                <tr key={index}>
                                    <td>{itemName}</td>
                                    <td>{quantity}</td>
                                    <td>${unitPrice.toFixed(2)}</td>
                                    <td>${itemTotal.toFixed(2)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={3} className="text-right font-medium">Subtotal:</td>
                            <td>${subtotal.toFixed(2)}</td>
                        </tr>
                        {tax > 0 && (
                            <tr>
                                <td colSpan={3} className="text-right font-medium">Tax:</td>
                                <td>${tax.toFixed(2)}</td>
                            </tr>
                        )}
                        {tip > 0 && (
                            <tr>
                                <td colSpan={3} className="text-right font-medium">Tip:</td>
                                <td>${tip.toFixed(2)}</td>
                            </tr>
                        )}
                        <tr>
                            <td colSpan={3} className="text-right font-bold">Total:</td>
                            <td className="font-bold">${total.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                {parsedInvoice.vendor && (
                    <div className="mt-3">
                        <span className="font-medium">Vendor:</span> {parsedInvoice.vendor}
                    </div>
                )}
            </div>
        );
    } catch (error) {
        console.error('Error rendering invoice table:', error);
        return (
            <div className="alert alert-error">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span>An unexpected error occurred while processing the invoice.</span>
            </div>
        );
    }
};

const EventRequestDetails = ({
    request,
    onClose,
    onStatusChange
}: EventRequestDetailsProps): React.ReactNode => {
    const [activeTab, setActiveTab] = useState<'details' | 'pr' | 'funding'>('details');
    const [status, setStatus] = useState<"submitted" | "pending" | "completed" | "declined">(request.status);
    const [isStatusChanging, setIsStatusChanging] = useState(false);

    // Format date for display
    const formatDate = (dateString: string) => {
        if (!dateString) return 'Not specified';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    };

    // Get status badge class based on status
    const getStatusBadge = (status?: "submitted" | "pending" | "completed" | "declined") => {
        if (!status) return 'badge-warning';

        switch (status) {
            case 'completed':
                return 'badge-success';
            case 'declined':
                return 'badge-error';
            case 'pending':
                return 'badge-warning';
            case 'submitted':
                return 'badge-info';
            default:
                return 'badge-warning';
        }
    };

    // Handle status change
    const handleStatusChange = async (newStatus: "submitted" | "pending" | "completed" | "declined") => {
        setIsStatusChanging(true);
        await onStatusChange(request.id, newStatus);
        setStatus(newStatus);
        setIsStatusChanging(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="bg-base-200 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="bg-base-300 p-4 flex justify-between items-center">
                    <h3 className="text-xl font-bold">{request.name}</h3>
                    <button
                        className="btn btn-sm btn-circle"
                        onClick={onClose}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Status and controls */}
                <div className="bg-base-300/50 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">Status:</span>
                            <span className={`badge ${getStatusBadge(status)}`}>
                                {status || 'Pending'}
                            </span>
                        </div>
                        <div className="text-sm text-gray-400">
                            Requested by: <span className="text-white">{request.requested_user_expand?.name || request.requested_user || 'Unknown'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="dropdown dropdown-end">
                            <label tabIndex={0} className="btn btn-sm">
                                Update Status
                            </label>
                            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52">
                                <li><a onClick={() => handleStatusChange('pending')}>Pending</a></li>
                                <li><a onClick={() => handleStatusChange('completed')}>Completed</a></li>
                                <li><a onClick={() => handleStatusChange('declined')}>Declined</a></li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="tabs tabs-boxed bg-base-300/30 px-4 pt-4">
                    <a
                        className={`tab ${activeTab === 'details' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('details')}
                    >
                        Event Details
                    </a>
                    <a
                        className={`tab ${activeTab === 'pr' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('pr')}
                    >
                        PR Materials
                    </a>
                    <a
                        className={`tab ${activeTab === 'funding' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('funding')}
                    >
                        AS Funding
                    </a>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-grow">
                    {/* Event Details Tab */}
                    {activeTab === 'details' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Event Name</h4>
                                        <p className="text-lg">{request.name}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Location</h4>
                                        <p>{request.location || 'Not specified'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Start Date & Time</h4>
                                        <p>{formatDate(request.start_date_time)}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">End Date & Time</h4>
                                        <p>{formatDate(request.end_date_time)}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Expected Attendance</h4>
                                        <p>{request.expected_attendance || 'Not specified'}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Event Description</h4>
                                        <p className="whitespace-pre-line">{request.event_description || 'No description provided'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Room Booking</h4>
                                        <p>{request.will_or_have_room_booking ? 'Yes' : 'No'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Food/Drinks Served</h4>
                                        <p>{request.food_drinks_being_served ? 'Yes' : 'No'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Submission Date</h4>
                                        <p>{formatDate(request.created)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PR Materials Tab */}
                    {activeTab === 'pr' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Flyers Needed</h4>
                                        <p>{request.flyers_needed ? 'Yes' : 'No'}</p>
                                    </div>
                                    {request.flyers_needed && (
                                        <>
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-400 mb-1">Flyer Types</h4>
                                                <ul className="list-disc list-inside">
                                                    {request.flyer_type?.map((type, index) => (
                                                        <li key={index}>{type}</li>
                                                    ))}
                                                    {request.other_flyer_type && <li>{request.other_flyer_type}</li>}
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-400 mb-1">Advertising Start Date</h4>
                                                <p>{formatDate(request.flyer_advertising_start_date || '')}</p>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-400 mb-1">Advertising Format</h4>
                                                <p>{request.advertising_format || 'Not specified'}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Photography Needed</h4>
                                        <p>{request.photography_needed ? 'Yes' : 'No'}</p>
                                    </div>
                                    {request.flyers_needed && (
                                        <>
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-400 mb-1">Required Logos</h4>
                                                <ul className="list-disc list-inside">
                                                    {request.required_logos?.map((logo, index) => (
                                                        <li key={index}>{logo}</li>
                                                    ))}
                                                    {(!request.required_logos || request.required_logos.length === 0) &&
                                                        <li>No specific logos required</li>
                                                    }
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-400 mb-1">Additional Requests</h4>
                                                <p className="whitespace-pre-line">{request.flyer_additional_requests || 'None'}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* AS Funding Tab */}
                    {activeTab === 'funding' && (
                        <ASFundingTab request={request} />
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default EventRequestDetails; 