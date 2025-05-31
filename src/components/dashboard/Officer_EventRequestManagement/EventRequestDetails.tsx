import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Collections } from '../../../schemas/pocketbase/schema';
import type { EventRequest as SchemaEventRequest } from '../../../schemas/pocketbase/schema';
import { Icon } from "@iconify/react";
import CustomAlert from '../universal/CustomAlert';
import UniversalFilePreview from '../universal/FilePreview';
import { Authentication } from '../../../scripts/pocketbase/Authentication';

// Extended EventRequest interface with additional properties needed for this component
interface ExtendedEventRequest extends SchemaEventRequest {
    requested_user_expand?: {
        name: string;
        email: string;
    };
    expand?: {
        requested_user?: {
            id: string;
            name: string;
            email: string;
            emailVisibility?: boolean;
            [key: string]: any;
        };
        [key: string]: any;
    };
    invoice_data?: string | any;
    invoice_files?: string[]; // Array of invoice file IDs
    flyer_files?: string[]; // Add this for PR-related files
    files?: string[]; // Generic files field
    will_or_have_room_booking?: boolean;
    room_booking_files?: string[]; // CHANGED: Multiple room booking files instead of single
    room_reservation_needed?: boolean; // Keep for backward compatibility
    additional_notes?: string;
    flyers_completed?: boolean; // Track if flyers have been completed by PR team
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
    const [fileType, setFileType] = useState<string>('');

    useEffect(() => {
        if (!isOpen) return;

        const loadFile = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Construct the secure file URL
                const auth = Authentication.getInstance();
                const token = auth.getAuthToken();

                // Use hardcoded PocketBase URL
                const secureUrl = `https://pocketbase.ieeeucsd.org/api/files/${collectionName}/${recordId}/${fileName}?token=${token}`;

                setFileUrl(secureUrl);

                // Determine file type from extension
                const extension = (typeof fileName === 'string' ? fileName.split('.').pop()?.toLowerCase() : '') || '';
                setFileType(extension);

                setIsLoading(false);
            } catch (err) {
                console.error('Error loading file:', err);
                setError('Failed to load file. Please try again.');
                setIsLoading(false);
            }
        };

        loadFile();
    }, [isOpen, collectionName, recordId, fileName]);

    const handleDownload = async () => {
        try {
            // Create a temporary link element
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = displayName || fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error downloading file:', err);
            setError('Failed to download file. Please try again.');
        }
    };

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[300] flex items-center justify-center p-4 overflow-y-auto"
        >
            <div className="bg-base-300 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden relative">
                <div className="p-4 flex justify-between items-center border-b border-base-200">
                    <h3 className="text-lg font-bold truncate">{displayName || fileName}</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handleDownload}
                            className="btn btn-sm btn-ghost"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                        </button>
                        <button
                            onClick={onClose}
                            className="btn btn-sm btn-ghost"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="p-4 overflow-auto max-h-[70vh]">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="loading loading-spinner loading-lg"></div>
                        </div>
                    ) : error ? (
                        <div className="bg-error/10 text-error p-4 rounded-lg">
                            <p>{error}</p>
                        </div>
                    ) : (
                        <>
                            {(fileType === 'jpg' || fileType === 'jpeg' || fileType === 'png' || fileType === 'gif') ? (
                                <div className="flex justify-center">
                                    <img
                                        src={fileUrl}
                                        alt={displayName || fileName}
                                        className="max-w-full max-h-[60vh] object-contain rounded-lg"
                                        onError={() => setError('Failed to load image.')}
                                    />
                                </div>
                            ) : fileType === 'pdf' ? (
                                <iframe
                                    src={`${fileUrl}#view=FitH`}
                                    className="w-full h-[60vh] rounded-lg"
                                    title={displayName || fileName}
                                ></iframe>
                            ) : (
                                <div className="bg-base-200 p-6 rounded-lg text-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <h4 className="text-lg font-semibold mb-2">File Preview Not Available</h4>
                                    <p className="text-base-content/70 mb-4">
                                        This file type ({fileType}) cannot be previewed in the browser.
                                    </p>
                                    <button
                                        onClick={handleDownload}
                                        className="btn btn-primary btn-sm"
                                    >
                                        Download File
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </motion.div>
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
                            <Icon className="h-5 w-5 text-warning" icon="heroicons:book-open" />
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
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-base-100/10 p-6 rounded-lg border border-base-100/10"
            >
                <div className="text-center py-8">
                    <Icon icon="mdi:cash-off" className="h-16 w-16 mx-auto text-gray-500 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No AS Funding Required</h3>
                    <p className="text-gray-400">This event does not require AS funding.</p>
                </div>
            </motion.div>
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
        <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="flex flex-col md:flex-row gap-6">
                {/* Funding Status Card */}
                <motion.div
                    className="bg-base-100/10 p-5 rounded-lg border border-base-100/10 flex-1"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-success/20 p-3 rounded-full">
                            <Icon icon="mdi:cash-multiple" className="h-6 w-6 text-success" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">AS Funding Status</h3>
                            <p className="text-sm text-gray-400">Funding has been requested for this event</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <div className="bg-base-200/30 p-3 rounded-lg">
                            <span className="text-xs text-gray-400 block mb-1">Funding Status</span>
                            <div className="flex items-center gap-2">
                                <div className="badge badge-success">Required</div>
                            </div>
                        </div>

                        <div className="bg-base-200/30 p-3 rounded-lg">
                            <span className="text-xs text-gray-400 block mb-1">Food & Drinks</span>
                            <div className="flex items-center gap-2">
                                {request.food_drinks_being_served ? (
                                    <div className="badge badge-success">Yes</div>
                                ) : (
                                    <div className="badge badge-ghost">No</div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Invoice Summary Card (if available) */}
                {invoiceData && (
                    <motion.div
                        className="bg-base-100/10 p-5 rounded-lg border border-base-100/10 flex-1"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="flex items-center gap-4 mb-4">
                            <div className="bg-primary/20 p-3 rounded-full">
                                <Icon icon="mdi:file-document-outline" className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">Invoice Summary</h3>
                                <p className="text-sm text-gray-400">Quick overview of funding details</p>
                            </div>
                        </div>

                        <div className="mt-4">
                            {typeof invoiceData === 'object' && invoiceData !== null && (
                                <div className="space-y-2">
                                    {/* Calculate total from invoiceData */}
                                    {(() => {
                                        let total = 0;
                                        let items = [];

                                        if (invoiceData.items && Array.isArray(invoiceData.items)) {
                                            items = invoiceData.items;
                                        } else if (Array.isArray(invoiceData)) {
                                            items = invoiceData;
                                        }

                                        if (items.length > 0) {
                                            total = items.reduce((sum: number, item: any) => {
                                                const quantity = parseFloat(item?.quantity || 1);
                                                const price = parseFloat(item?.unit_price || item?.price || 0);
                                                return sum + (quantity * price);
                                            }, 0);
                                        }

                                        // If we have a total in the invoice data, use that instead
                                        if (invoiceData.total) {
                                            total = parseFloat(invoiceData.total);
                                        }

                                        return (
                                            <div className="flex flex-col space-y-3">
                                                <div className="flex justify-between items-center bg-base-200/30 p-3 rounded-lg">
                                                    <span className="text-sm">Total Amount:</span>
                                                    <span className="text-lg font-bold">${total.toFixed(2)}</span>
                                                </div>

                                                {invoiceData.vendor && (
                                                    <div className="flex justify-between items-center bg-base-200/30 p-3 rounded-lg">
                                                        <span className="text-sm">Vendor:</span>
                                                        <span className="font-medium">{invoiceData.vendor}</span>
                                                    </div>
                                                )}

                                                <div className="flex justify-between items-center bg-base-200/30 p-3 rounded-lg">
                                                    <span className="text-sm">Items:</span>
                                                    <span className="font-medium">{items.length} items</span>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Invoice Files Section */}
            {hasInvoiceFiles ? (
                <motion.div
                    className="bg-base-100/10 p-5 rounded-lg border border-base-100/10"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-info/20 p-3 rounded-full">
                            <Icon icon="mdi:file-multiple-outline" className="h-6 w-6 text-info" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Invoice Files</h3>
                            <p className="text-sm text-gray-400">Attached documentation for the funding request</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        {/* Display invoice_files array if available */}
                        {request.invoice_files && request.invoice_files.map((fileId, index) => {
                            const extension = getFileExtension(fileId);
                            const displayName = getFriendlyFileName(fileId, 25);

                            return (
                                <motion.div
                                    key={`file-${index}`}
                                    className="border rounded-lg overflow-hidden bg-base-300/30 hover:bg-base-300/50 transition-colors cursor-pointer shadow-sm"
                                    onClick={() => openFilePreview(fileId, displayName)}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 + (index * 0.05) }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <div className="p-4 flex items-center gap-3">
                                        {isImageFile(fileId) ? (
                                            <Icon icon="mdi:image" className="h-8 w-8 text-primary" />
                                        ) : isPdfFile(fileId) ? (
                                            <Icon icon="mdi:file-pdf-box" className="h-8 w-8 text-error" />
                                        ) : (
                                            <Icon icon="mdi:file-document" className="h-8 w-8 text-secondary" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate" title={fileId}>
                                                {displayName}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {extension ? extension.toUpperCase() : 'FILE'}
                                            </p>
                                        </div>
                                        <Icon icon="mdi:eye" className="h-5 w-5" />
                                    </div>
                                </motion.div>
                            );
                        })}

                        {/* Display single invoice file if available */}
                        {request.invoice && (
                            <motion.div
                                key="invoice"
                                className="border rounded-lg overflow-hidden bg-base-300/30 hover:bg-base-300/50 transition-colors cursor-pointer shadow-sm"
                                onClick={() => {
                                    const invoiceFile = request.invoice || '';
                                    openFilePreview(invoiceFile, getFriendlyFileName(invoiceFile, 25));
                                }}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + ((request.invoice_files?.length || 0) * 0.05) }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="p-4 flex items-center gap-3">
                                    {isImageFile(request.invoice) ? (
                                        <Icon icon="mdi:image" className="h-8 w-8 text-primary" />
                                    ) : isPdfFile(request.invoice) ? (
                                        <Icon icon="mdi:file-pdf-box" className="h-8 w-8 text-error" />
                                    ) : (
                                        <Icon icon="mdi:file-document" className="h-8 w-8 text-secondary" />
                                    )}
                                    <div className="flex-grow">
                                        <p className="font-medium truncate" title={request.invoice}>
                                            {getFriendlyFileName(request.invoice, 25)}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {getFileExtension(request.invoice) ? getFileExtension(request.invoice).toUpperCase() : 'FILE'}
                                        </p>
                                    </div>
                                    <Icon icon="mdi:eye" className="h-5 w-5" />
                                </div>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <CustomAlert
                        type="info"
                        title="No Invoice Files"
                        message="No invoice files have been uploaded for this funding request."
                        icon="heroicons:information-circle"
                    />
                </motion.div>
            )}

            {/* Invoice Data Table */}
            <motion.div
                className="bg-base-100/10 p-5 rounded-lg border border-base-100/10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
            >
                <div className="flex items-center gap-4 mb-4">
                    <div className="bg-secondary/20 p-3 rounded-full">
                        <Icon icon="mdi:table-large" className="h-6 w-6 text-secondary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Invoice Details</h3>
                        <p className="text-sm text-gray-400">Itemized breakdown of the funding request</p>
                    </div>
                </div>

                <div className="mt-4">
                    <InvoiceTable invoiceData={invoiceData} expectedAttendance={request.expected_attendance} />
                </div>
            </motion.div>

            {/* Copyable Invoice Format */}
            <motion.div
                className="bg-base-100/10 p-5 rounded-lg border border-base-100/10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
            >
                <div className="flex items-center gap-4 mb-4">
                    <div className="bg-info/20 p-3 rounded-full">
                        <Icon icon="mdi:content-copy" className="h-6 w-6 text-info" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Copyable Format</h3>
                        <p className="text-sm text-gray-400">Copy formatted invoice data for easy sharing</p>
                    </div>
                </div>

                <div className="mt-4">
                    <CopyableInvoiceFormat invoiceData={invoiceData} />
                </div>
            </motion.div>

            {/* File Preview Modal */}
            <FilePreviewModal
                isOpen={isPreviewModalOpen}
                onClose={closeFilePreview}
                collectionName={Collections.EVENT_REQUESTS}
                recordId={request.id}
                fileName={selectedFile.name}
                displayName={selectedFile.displayName}
            />
        </motion.div>
    );
};

// Component for copyable invoice format
const CopyableInvoiceFormat: React.FC<{ invoiceData: any }> = ({ invoiceData }) => {
    const [copied, setCopied] = useState(false);
    const [formattedText, setFormattedText] = useState<string>('');

    useEffect(() => {
        if (!invoiceData) {
            setFormattedText('No invoice data available');
            return;
        }

        try {
            // Parse invoice data if it's a string
            let parsedInvoice = null;

            if (typeof invoiceData === 'string') {
                try {
                    parsedInvoice = JSON.parse(invoiceData);
                } catch (e) {
                    console.error('Failed to parse invoice data string:', e);
                    setFormattedText('Invalid invoice data format');
                    return;
                }
            } else if (typeof invoiceData === 'object' && invoiceData !== null) {
                parsedInvoice = invoiceData;
            } else {
                setFormattedText('No structured invoice data available');
                return;
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

            // Format the items into the required string format
            const formattedItems = items.map((item: any) => {
                const quantity = parseFloat(item?.quantity || 1);
                const itemName = typeof item?.item === 'object'
                    ? JSON.stringify(item.item)
                    : (item?.item || item?.description || item?.name || 'N/A');
                const unitPrice = parseFloat(item?.unit_price || item?.unitPrice || item?.price || 0);

                return `${quantity} ${itemName} x${unitPrice.toFixed(2)} each`;
            }).join(' | ');

            // Get tax, tip and total
            const tax = parseFloat(parsedInvoice.tax || parsedInvoice.taxAmount || 0);
            const tip = parseFloat(parsedInvoice.tip || parsedInvoice.tipAmount || 0);
            const total = parseFloat(parsedInvoice.total || 0) ||
                items.reduce((sum: number, item: any) => {
                    const quantity = parseFloat(item?.quantity || 1);
                    const price = parseFloat(item?.unit_price || item?.unitPrice || item?.price || 0);
                    return sum + (quantity * price);
                }, 0) + tax + tip;

            // Get vendor/location
            const location = parsedInvoice.vendor || parsedInvoice.location || 'Unknown Vendor';

            // Build the final formatted string
            let result = formattedItems;

            if (tax > 0) {
                result += ` | Tax = ${tax.toFixed(2)}`;
            }

            if (tip > 0) {
                result += ` | Tip = ${tip.toFixed(2)}`;
            }

            result += ` | Total = ${total.toFixed(2)} from ${location}`;

            setFormattedText(result);
        } catch (error) {
            console.error('Error formatting invoice data:', error);
            setFormattedText('Error formatting invoice data');
        }
    }, [invoiceData]);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(formattedText)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
                toast.success('Copied to clipboard!');
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                toast.error('Failed to copy text');
            });
    };

    return (
        <div className="space-y-4">
            <div className="bg-base-200/30 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                    <label className="text-sm font-medium text-gray-400">Formatted Invoice Data</label>
                    <button
                        onClick={copyToClipboard}
                        className="btn btn-sm btn-primary gap-2"
                        disabled={!formattedText || formattedText.includes('No') || formattedText.includes('Error')}
                    >
                        {copied ? (
                            <>
                                <Icon icon="mdi:check" className="h-4 w-4" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Icon icon="mdi:content-copy" className="h-4 w-4" />
                                Copy
                            </>
                        )}
                    </button>
                </div>
                <div className="bg-base-300/50 p-3 rounded-lg mt-2 whitespace-pre-wrap break-words text-sm">
                    {formattedText}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    Format: N_1 {'{item_1}'} x{'{cost_1}'} each | N_2 {'{item_2}'} x{'{cost_2}'} each | Tax = {'{tax}'} | Tip = {'{tip}'} | Total = {'{total}'} from {'{location}'}
                </p>
            </div>
        </div>
    );
};

// Separate component for invoice table
const InvoiceTable: React.FC<{ invoiceData: any, expectedAttendance?: number }> = ({ invoiceData, expectedAttendance }) => {
    // If no invoice data is provided, show a message
    if (!invoiceData) {
        return (
            <CustomAlert
                type="info"
                title="No Invoice Data"
                message="No invoice data available."
                icon="heroicons:information-circle"
            />
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
                    <CustomAlert
                        type="warning"
                        title="Invalid Format"
                        message="Invalid invoice data format."
                        icon="heroicons:exclamation-triangle"
                    />
                );
            }
        } else if (typeof invoiceData === 'object' && invoiceData !== null) {
            parsedInvoice = invoiceData;
        }

        // Check if we have valid invoice data
        if (!parsedInvoice || typeof parsedInvoice !== 'object') {
            return (
                <CustomAlert
                    type="info"
                    title="No Structured Data"
                    message="No structured invoice data available."
                    icon="heroicons:information-circle"
                />
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
                <CustomAlert
                    type="info"
                    title="No Invoice Items"
                    message="No invoice items found in the data."
                    icon="heroicons:information-circle"
                />
            );
        }

        // Calculate subtotal from items
        const subtotal = items.reduce((sum: number, item: any) => {
            const quantity = parseFloat(item?.quantity || 1);
            const price = parseFloat(item?.unit_price || item?.unitPrice || item?.price || 0);
            return sum + (quantity * price);
        }, 0);

        // Get tax, tip and total
        const tax = parseFloat(parsedInvoice.tax || parsedInvoice.taxAmount || 0);
        const tip = parseFloat(parsedInvoice.tip || parsedInvoice.tipAmount || 0);
        const total = parseFloat(parsedInvoice.total || 0) || (subtotal + tax + tip);

        // Calculate budget limit if expected attendance is provided
        const budgetLimit = expectedAttendance ? Math.min(expectedAttendance * 10, 5000) : null;
        const isOverBudget = budgetLimit !== null && total > budgetLimit;

        // Render the invoice table
        return (
            <div className="overflow-x-auto">
                {budgetLimit !== null && (
                    <div className={`mb-4 p-3 rounded-lg ${isOverBudget ? 'bg-error/20' : 'bg-success/20'}`}>
                        <p className="text-sm font-medium">
                            Budget Limit: ${budgetLimit.toFixed(2)} (based on {expectedAttendance} attendees)
                        </p>
                        {isOverBudget && (
                            <p className="text-sm font-bold text-error mt-1">
                                WARNING: This invoice exceeds the budget limit by ${(total - budgetLimit).toFixed(2)}
                            </p>
                        )}
                    </div>
                )}

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
                            const unitPrice = parseFloat(item?.unit_price || item?.unitPrice || item?.price || 0);
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
                        <tr>
                            <td colSpan={3} className="text-right font-medium">Tax:</td>
                            <td>${tax.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td colSpan={3} className="text-right font-medium">Tip:</td>
                            <td>${tip.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td colSpan={3} className="text-right font-bold">Total:</td>
                            <td className={`font-bold ${isOverBudget ? 'text-error' : ''}`}>${total.toFixed(2)}</td>
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
            <CustomAlert
                type="error"
                title="Error"
                message="An error occurred while processing the invoice data."
                icon="heroicons:exclamation-circle"
            />
        );
    }
};

// Now, add a new component for the PR Materials tab
const PRMaterialsTab: React.FC<{ request: ExtendedEventRequest }> = ({ request }) => {
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
    const [selectedFile, setSelectedFile] = useState<{ name: string, displayName: string }>({ name: '', displayName: '' });
    const [flyersCompleted, setFlyersCompleted] = useState<boolean>(request.flyers_completed || false);
    const [isUpdating, setIsUpdating] = useState<boolean>(false);

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

    // Handle flyers completed checkbox change
    const handleFlyersCompletedChange = async (completed: boolean) => {
        setIsUpdating(true);
        try {
            const { Update } = await import('../../../scripts/pocketbase/Update');
            const update = Update.getInstance();
            
            await update.updateField("event_request", request.id, "flyers_completed", completed);
            
            setFlyersCompleted(completed);
            toast.success(`Flyers completion status updated to ${completed ? 'completed' : 'not completed'}`);
        } catch (error) {
            console.error('Failed to update flyers completed status:', error);
            toast.error('Failed to update flyers completion status');
        } finally {
            setIsUpdating(false);
        }
    };

    // Sync local state with request prop changes
    useEffect(() => {
        setFlyersCompleted(request.flyers_completed || false);
    }, [request.flyers_completed]);

    // Use the same utility functions as in the ASFundingTab
    const getFileExtension = (filename: string): string => {
        if (!filename || typeof filename !== 'string') return '';
        const parts = filename.split('.');
        return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
    };

    const isImageFile = (filename: string): boolean => {
        const extension = getFileExtension(filename);
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension);
    };

    const isPdfFile = (filename: string): boolean => {
        return getFileExtension(filename) === 'pdf';
    };

    const getFriendlyFileName = (filename: string, maxLength: number = 20): string => {
        if (!filename || typeof filename !== 'string') return 'Unknown File';
        const basename = filename.split('/').pop() || filename;
        if (basename.length <= maxLength) return basename;
        const extension = getFileExtension(basename);
        const name = basename.substring(0, basename.length - extension.length - 1);
        const truncatedName = name.substring(0, maxLength - 3 - extension.length) + '...';
        return extension ? `${truncatedName}.${extension}` : truncatedName;
    };

    // Check if we have any PR-related files (flyer_files or related files)
    const hasFiles = (
        request.flyer_files && request.flyer_files.length > 0 ||
        request.files && request.files.length > 0 ||
        request.other_logos && request.other_logos.length > 0
    );

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
        <motion.div
            className="space-y-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="bg-base-300/20 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-400 mb-1">Flyers Needed</h4>
                        <div className="flex items-center gap-2">
                            {request.flyers_needed ? (
                                <span className="badge badge-success">Yes</span>
                            ) : (
                                <span className="badge badge-ghost">No</span>
                            )}
                        </div>
                    </div>

                    {/* Flyers Completed Checkbox - Only show if flyers are needed */}
                    {request.flyers_needed && (
                        <motion.div
                            className="bg-base-300/20 p-4 rounded-lg"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.05 }}
                        >
                            <h4 className="text-sm font-medium text-gray-400 mb-3">Completion Status</h4>
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={flyersCompleted}
                                    onChange={(e) => handleFlyersCompletedChange(e.target.checked)}
                                    disabled={isUpdating}
                                    className="checkbox checkbox-primary"
                                />
                                <label className="text-sm font-medium">
                                    Flyers completed by PR team
                                </label>
                                {isUpdating && (
                                    <div className="loading loading-spinner loading-sm"></div>
                                )}
                            </div>
                            <div className="mt-2">
                                {flyersCompleted ? (
                                    <span className="badge badge-success gap-1">
                                        <Icon icon="mdi:check-circle" className="h-3 w-3" />
                                        Completed
                                    </span>
                                ) : (
                                    <span className="badge badge-warning gap-1">
                                        <Icon icon="mdi:clock" className="h-3 w-3" />
                                        Pending
                                    </span>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {request.flyers_needed && (
                        <motion.div
                            className="space-y-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                        >
                            <div className="bg-base-300/20 p-4 rounded-lg">
                                <h4 className="text-sm font-medium text-gray-400 mb-1">Flyer Types</h4>
                                <ul className="space-y-1 mt-2">
                                    {request.flyer_type?.map((type, index) => (
                                        <motion.li
                                            key={index}
                                            className="flex items-center gap-2"
                                            initial={{ opacity: 0, x: -5 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.1 + (index * 0.05) }}
                                        >
                                            <Icon icon="mdi:check" className="h-4 w-4 text-success" />
                                            <span>{type}</span>
                                        </motion.li>
                                    ))}
                                    {request.other_flyer_type && (
                                        <motion.li
                                            className="flex items-center gap-2"
                                            initial={{ opacity: 0, x: -5 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.1 + ((request.flyer_type?.length || 0) * 0.05) }}
                                        >
                                            <Icon icon="mdi:check" className="h-4 w-4 text-success" />
                                            <span>{request.other_flyer_type}</span>
                                        </motion.li>
                                    )}
                                </ul>
                            </div>

                            <div className="bg-base-300/20 p-4 rounded-lg">
                                <h4 className="text-sm font-medium text-gray-400 mb-1">Advertising Start Date</h4>
                                <p>{formatDate(request.flyer_advertising_start_date || '')}</p>
                            </div>

                            <div className="bg-base-300/20 p-4 rounded-lg">
                                <h4 className="text-sm font-medium text-gray-400 mb-1">Advertising Format</h4>
                                <p>{request.advertising_format || 'Not specified'}</p>
                            </div>
                        </motion.div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="bg-base-300/20 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-400 mb-1">Photography Needed</h4>
                        <div className="flex items-center gap-2">
                            {request.photography_needed ? (
                                <span className="badge badge-success">Yes</span>
                            ) : (
                                <span className="badge badge-ghost">No</span>
                            )}
                        </div>
                    </div>

                    {/* Logo Requirements Section */}
                    <motion.div
                        className="bg-base-300/20 p-4 rounded-lg"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <h4 className="text-sm font-medium text-gray-400 mb-1">Required Logos</h4>
                        <ul className="space-y-1 mt-2">
                            {request.required_logos?.map((logo, index) => (
                                <motion.li
                                    key={index}
                                    className="flex items-center gap-2"
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 + (index * 0.05) }}
                                >
                                    <Icon icon="mdi:check" className="h-4 w-4 text-success" />
                                    <span>{logo}</span>
                                </motion.li>
                            ))}
                            {(!request.required_logos || request.required_logos.length === 0) && (
                                <motion.li
                                    className="flex items-center gap-2"
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                >
                                    <Icon icon="mdi:information" className="h-4 w-4 text-info" />
                                    <span>No specific logos required</span>
                                </motion.li>
                            )}
                        </ul>
                    </motion.div>

                    {/* Display custom logos if available */}
                    {request.other_logos && request.other_logos.length > 0 && (
                        <motion.div
                            className="bg-base-300/20 p-4 rounded-lg"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h4 className="text-sm font-medium text-gray-400 mb-1">Custom Logos</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                                {request.other_logos.map((logoId, index) => {
                                    const displayName = getFriendlyFileName(logoId, 15);

                                    return (
                                        <motion.div
                                            key={`logo-${index}`}
                                            className="border rounded-lg overflow-hidden bg-base-300/30 hover:bg-base-300/50 transition-colors cursor-pointer shadow-sm"
                                            onClick={() => openFilePreview(logoId, displayName)}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 + (index * 0.05) }}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <div className="p-3 flex items-center gap-2">
                                                {isImageFile(logoId) ? (
                                                    <Icon icon="mdi:image" className="h-5 w-5 text-primary" />
                                                ) : (
                                                    <Icon icon="mdi:file-document" className="h-5 w-5 text-secondary" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm truncate" title={logoId}>
                                                        {displayName}
                                                    </p>
                                                </div>
                                                <Icon icon="mdi:eye" className="h-4 w-4" />
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}

                    <div className="bg-base-300/20 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-400 mb-1">Additional Requests</h4>
                        <p className="whitespace-pre-line">{request.flyer_additional_requests || 'None'}</p>
                    </div>
                </div>
            </div>

            {/* Display PR-related files if available */}
            {hasFiles && (
                <motion.div
                    className="mt-6"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <h4 className="text-sm font-medium text-gray-400 mb-1">Related Files</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                        {/* Display flyer_files if available */}
                        {request.flyer_files && request.flyer_files.map((fileId, index) => {
                            const extension = getFileExtension(fileId);
                            const displayName = getFriendlyFileName(fileId, 25);

                            return (
                                <motion.div
                                    key={`flyer-file-${index}`}
                                    className="border rounded-lg overflow-hidden bg-base-300/30 hover:bg-base-300/50 transition-colors cursor-pointer shadow-sm"
                                    onClick={() => openFilePreview(fileId, displayName)}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + (index * 0.05) }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <div className="p-4 flex items-center gap-3">
                                        {isImageFile(fileId) ? (
                                            <Icon icon="mdi:image" className="h-8 w-8 text-primary" />
                                        ) : isPdfFile(fileId) ? (
                                            <Icon icon="mdi:file-pdf-box" className="h-8 w-8 text-error" />
                                        ) : (
                                            <Icon icon="mdi:file-document" className="h-8 w-8 text-secondary" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate" title={fileId}>
                                                {displayName}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {extension ? extension.toUpperCase() : 'FILE'}
                                            </p>
                                        </div>
                                        <Icon icon="mdi:eye" className="h-5 w-5" />
                                    </div>
                                </motion.div>
                            );
                        })}

                        {/* Display general files if available */}
                        {request.files && request.files.map((fileId, index) => {
                            const extension = getFileExtension(fileId);
                            const displayName = getFriendlyFileName(fileId, 25);

                            return (
                                <motion.div
                                    key={`general-file-${index}`}
                                    className="border rounded-lg overflow-hidden bg-base-300/30 hover:bg-base-300/50 transition-colors cursor-pointer shadow-sm"
                                    onClick={() => openFilePreview(fileId, displayName)}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + ((request.flyer_files?.length || 0) + index) * 0.05 }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <div className="p-4 flex items-center gap-3">
                                        {isImageFile(fileId) ? (
                                            <Icon icon="mdi:image" className="h-8 w-8 text-primary" />
                                        ) : isPdfFile(fileId) ? (
                                            <Icon icon="mdi:file-pdf-box" className="h-8 w-8 text-error" />
                                        ) : (
                                            <Icon icon="mdi:file-document" className="h-8 w-8 text-secondary" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate" title={fileId}>
                                                {displayName}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {extension ? extension.toUpperCase() : 'FILE'}
                                            </p>
                                        </div>
                                        <Icon icon="mdi:eye" className="h-5 w-5" />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* No files message */}
            {
                !hasFiles && (
                    <motion.div
                        className="mt-4"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <CustomAlert
                            type="info"
                            title="No PR Files"
                            message="No PR-related files have been uploaded."
                            icon="heroicons:information-circle"
                        />
                    </motion.div>
                )
            }

            {/* File Preview Modal */}
            <FilePreviewModal
                isOpen={isPreviewModalOpen}
                onClose={closeFilePreview}
                collectionName={Collections.EVENT_REQUESTS}
                recordId={request.id}
                fileName={selectedFile.name}
                displayName={selectedFile.displayName}
            />
        </motion.div>
    );
};

// Now, update the EventRequestDetails component to use the new PRMaterialsTab
const EventRequestDetails = ({
    request,
    onClose,
    onStatusChange
}: EventRequestDetailsProps): React.ReactNode => {
    const [activeTab, setActiveTab] = useState('details');
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [newStatus, setNewStatus] = useState<"submitted" | "pending" | "completed" | "declined">("pending");
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Add state for decline reason modal
    const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
    const [declineReason, setDeclineReason] = useState<string>('');
    const [alertInfo, setAlertInfo] = useState<{ show: boolean; type: "success" | "error" | "warning" | "info"; message: string }>({
        show: false,
        type: "info",
        message: ""
    });

    const formatDate = (dateString: string) => {
        if (!dateString) return "Not specified";
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    };

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

    const handleStatusChange = async (newStatus: "submitted" | "pending" | "completed" | "declined") => {
        if (newStatus === 'declined') {
            // Open decline reason modal instead of immediate confirmation
            setDeclineReason('');
            setIsDeclineModalOpen(true);
        } else {
            setNewStatus(newStatus);
            setIsConfirmModalOpen(true);
        }
    };

    const confirmStatusChange = async () => {
        setIsSubmitting(true);
        setAlertInfo({ show: false, type: "info", message: "" });

        try {
            await onStatusChange(request.id, newStatus);
            setAlertInfo({
                show: true,
                type: "success",
                message: `Status successfully changed to ${newStatus}.`
            });
        } catch (error) {
            setAlertInfo({
                show: true,
                type: "error",
                message: `Failed to update status: ${error}`
            });
        } finally {
            setIsSubmitting(false);
            setIsConfirmModalOpen(false);
        }
    };

    // Handle decline with reason
    const handleDeclineWithReason = async () => {
        if (!declineReason.trim()) {
            toast.error('Please provide a reason for declining');
            return;
        }

        setIsSubmitting(true);
        try {
            // Use Update service to update both status and decline reason
            const { Update } = await import('../../../scripts/pocketbase/Update');
            const update = Update.getInstance();
            
            await update.updateFields("event_request", request.id, {
                status: 'declined',
                declined_reason: declineReason
            });

            // Send email notifications
            const { EmailClient } = await import('../../../scripts/email/EmailClient');
            const auth = Authentication.getInstance();
            const changedByUserId = auth.getUserId();

            await EmailClient.notifyEventRequestStatusChange(
                request.id,
                request.status,
                'declined',
                changedByUserId || undefined,
                declineReason
            );

            // Send design team notification if PR materials were needed
            if (request.flyers_needed) {
                await EmailClient.notifyDesignTeam(request.id, 'declined');
            }

            setAlertInfo({
                show: true,
                type: "success",
                message: "Event request has been declined successfully."
            });

            setIsDeclineModalOpen(false);
            setDeclineReason('');

            // Call the parent's onStatusChange if needed for UI updates
            await onStatusChange(request.id, 'declined');

        } catch (error) {
            console.error('Error declining request:', error);
            setAlertInfo({
                show: true,
                type: "error",
                message: "Failed to decline event request. Please try again."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Cancel decline action
    const cancelDecline = () => {
        setIsDeclineModalOpen(false);
        setDeclineReason('');
    };

    return (
        <div className="bg-transparent w-full">
            {/* Tabs navigation */}
            <div className="px-6 pt-2 mb-4">
                <div className="flex flex-wrap gap-2 border-b border-base-100/20">
                    <button
                        className={`px-4 py-2 font-medium transition-all rounded-t-lg ${activeTab === 'details' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'hover:bg-base-100/10 text-gray-300'}`}
                        onClick={() => setActiveTab('details')}
                    >
                        <div className="flex items-center gap-2">
                            <Icon icon="mdi:information-outline" className="h-4 w-4" />
                            Event Details
                        </div>
                    </button>
                    {request.as_funding_required && (
                        <button
                            className={`px-4 py-2 font-medium transition-all rounded-t-lg ${activeTab === 'funding' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'hover:bg-base-100/10 text-gray-300'}`}
                            onClick={() => setActiveTab('funding')}
                        >
                            <div className="flex items-center gap-2">
                                <Icon icon="mdi:cash-multiple" className="h-4 w-4" />
                                AS Funding
                            </div>
                        </button>
                    )}
                    {request.flyers_needed && (
                        <button
                            className={`px-4 py-2 font-medium transition-all rounded-t-lg ${activeTab === 'pr' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'hover:bg-base-100/10 text-gray-300'}`}
                            onClick={() => setActiveTab('pr')}
                        >
                            <div className="flex items-center gap-2">
                                <Icon icon="mdi:image-outline" className="h-4 w-4" />
                                PR Materials
                            </div>
                        </button>
                    )}
                </div>
            </div>

            {/* Alert for status updates */}
            {alertInfo.show && (
                <div className="px-6 mb-4">
                    <CustomAlert
                        type={alertInfo.type}
                        title={alertInfo.type.charAt(0).toUpperCase() + alertInfo.type.slice(1)}
                        message={alertInfo.message}
                        onClose={() => setAlertInfo({ ...alertInfo, show: false })}
                    />
                </div>
            )}

            {/* Status bar */}
            <div className="mb-6 px-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-base-100/10 rounded-lg border border-base-100/10">
                    <div className="space-y-1">
                        <div className="text-sm text-gray-400">
                            Requested by: <span className="text-white">
                                {request.requested_user_expand?.name ||
                                    (request.expand?.requested_user?.name) ||
                                    'Unknown'}
                            </span>
                            {" - "}
                            <span className="text-white">
                                {request.requested_user_expand?.email ||
                                    (request.expand?.requested_user?.email) ||
                                    'No email available'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`badge ${getStatusBadge(request.status)}`}>
                                {request.status?.charAt(0).toUpperCase() + request.status?.slice(1) || 'Pending'}
                            </span>
                            <span className="text-xs text-gray-400">
                                Submitted on {formatDate(request.created)}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="dropdown dropdown-end">
                            <label tabIndex={0} className="btn btn-sm">
                                Update Status
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </label>
                            <ul tabIndex={0} className="dropdown-content z-[101] menu p-2 shadow bg-base-200 rounded-lg w-52">
                                <li>
                                    <button
                                        className={`flex items-center ${request.status === 'pending' ? 'bg-warning/20 text-warning' : ''}`}
                                        onClick={() => handleStatusChange('pending')}
                                        disabled={request.status === 'pending'}
                                    >
                                        <div className="w-2 h-2 rounded-full bg-warning mr-2"></div>
                                        Pending
                                    </button>
                                </li>
                                <li>
                                    <button
                                        className={`flex items-center ${request.status === 'completed' ? 'bg-success/20 text-success' : ''}`}
                                        onClick={() => handleStatusChange('completed')}
                                        disabled={request.status === 'completed'}
                                    >
                                        <div className="w-2 h-2 rounded-full bg-success mr-2"></div>
                                        Completed
                                    </button>
                                </li>
                                <li>
                                    <button
                                        className={`flex items-center ${request.status === 'declined' ? 'bg-error/20 text-error' : ''}`}
                                        onClick={() => handleStatusChange('declined')}
                                        disabled={request.status === 'declined'}
                                    >
                                        <div className="w-2 h-2 rounded-full bg-error mr-2"></div>
                                        Declined
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab content */}
            <div className="px-6 pb-6">
                {activeTab === 'details' && (
                    <div className="space-y-6">
                        <div className="bg-base-100/10 p-5 rounded-lg border border-base-100/10">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                                <Icon icon="mdi:information-outline" className="h-5 w-5 mr-2 text-primary" />
                                Event Information
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div>
                                    <label className="text-xs text-gray-400">Event Name</label>
                                    <p className="text-white font-medium">{request.name}</p>
                                </div>

                                <div className="md:row-span-2">
                                    <label className="text-xs text-gray-400">Event Description</label>
                                    <p className="text-white">{request.event_description}</p>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-400">Location</label>
                                    <p className="text-white">{request.location}</p>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-400">Start Date & Time</label>
                                    <p className="text-white">{formatDate(request.start_date_time)}</p>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-400">End Date & Time</label>
                                    <p className="text-white">{formatDate(request.end_date_time)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-base-100/10 p-5 rounded-lg border border-base-100/10">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                                    <Icon icon="mdi:check-decagram-outline" className="h-5 w-5 mr-2 text-primary" />
                                    Requirements & Special Requests
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between bg-base-200/30 p-3 rounded-lg">
                                        <p className="text-white">AS Funding Required</p>
                                        <div className={`badge ${request.as_funding_required ? 'badge-success' : 'badge-ghost'}`}>
                                            {request.as_funding_required ? 'Yes' : 'No'}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between bg-base-200/30 p-3 rounded-lg">
                                        <p className="text-white">PR Materials Needed</p>
                                        <div className={`badge ${request.flyers_needed ? 'badge-success' : 'badge-ghost'}`}>
                                            {request.flyers_needed ? 'Yes' : 'No'}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between bg-base-200/30 p-3 rounded-lg">
                                        <p className="text-white">Room Reservation Needed</p>
                                        <div className={`badge ${request.will_or_have_room_booking ? 'badge-success' : 'badge-ghost'}`}>
                                            {request.will_or_have_room_booking ? 'Yes' : 'No'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {request.will_or_have_room_booking ? (
                                <div className="bg-base-100/10 p-5 rounded-lg border border-base-100/10">
                                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                                        <Icon icon="mdi:map-marker-outline" className="h-5 w-5 mr-2 text-primary" />
                                        Room Reservation Details
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="bg-base-200/30 p-3 rounded-lg">
                                            <label className="text-xs text-gray-400 block mb-1">Room/Location</label>
                                            <p className="text-white font-medium">{request.location || 'Not specified'}</p>
                                        </div>
                                        <div className="bg-base-200/30 p-3 rounded-lg">
                                            <label className="text-xs text-gray-400 block mb-1">Confirmation Status</label>
                                            <div className="flex items-center gap-2">
                                                <div className={`badge ${request.room_booking_files && request.room_booking_files.length > 0 ? 'badge-success' : 'badge-warning'}`}>
                                                    {request.room_booking_files && request.room_booking_files.length > 0 ? 'Booking Files Uploaded' : 'No Booking Files'}
                                                </div>
                                                {request.room_booking_files && request.room_booking_files.length > 0 && (
                                                    <div className="flex gap-2">
                                                        {request.room_booking_files.map((fileId, index) => (
                                                            <button
                                                                key={index}
                                                                onClick={() => {
                                                                    // Dispatch event to update file preview modal
                                                                    const event = new CustomEvent('filePreviewStateChange', {
                                                                        detail: {
                                                                            url: `https://pocketbase.ieeeucsd.org/api/files/event_request/${request.id}/${fileId}`,
                                                                            filename: fileId
                                                                        }
                                                                    });
                                                                    window.dispatchEvent(event);

                                                                    // Open the modal
                                                                    const modal = document.getElementById('file-preview-modal') as HTMLDialogElement;
                                                                    if (modal) modal.showModal();
                                                                }}
                                                                className="btn btn-xs btn-primary"
                                                            >
                                                                View File {index + 1}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                request.files && request.files.length > 0 && (
                                    <div className="bg-base-100/10 p-5 rounded-lg border border-base-100/10">
                                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                                            <Icon icon="mdi:file-document-outline" className="h-5 w-5 mr-2 text-primary" />
                                            Event Files
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {request.files.map((file, index) => (
                                                <FilePreview
                                                    key={index}
                                                    fileUrl={`https://pocketbase.ieeeucsd.org/api/files/event_requests/${request.id}/${file}`}
                                                    fileName={file}
                                                    collectionName="event_requests"
                                                    recordId={request.id}
                                                    originalFileName={file}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )
                            )}
                        </div>

                        {/* Display event files if available and not shown above */}
                        {!request.room_reservation_needed && request.files && request.files.length > 0 && (
                            <div className="bg-base-100/10 p-5 rounded-lg border border-base-100/10">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                                    <Icon icon="mdi:file-document-outline" className="h-5 w-5 mr-2 text-primary" />
                                    Event Files
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {request.files.map((file, index) => (
                                        <FilePreview
                                            key={index}
                                            fileUrl={`https://pocketbase.ieeeucsd.org/api/files/event_requests/${request.id}/${file}`}
                                            fileName={file}
                                            collectionName="event_requests"
                                            recordId={request.id}
                                            originalFileName={file}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'funding' && request.as_funding_required && <ASFundingTab request={request} />}
                {activeTab === 'pr' && request.flyers_needed && <PRMaterialsTab request={request} />}
            </div>

            {/* Confirmation modal */}
            {isConfirmModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
                    <div className="bg-base-300 rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">Confirm Status Change</h3>
                        <p className="mb-4">
                            Are you sure you want to change the status to <span className="font-bold text-primary">{newStatus}</span>?
                        </p>
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                className="btn btn-ghost"
                                onClick={() => setIsConfirmModalOpen(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={confirmStatusChange}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="loading loading-spinner loading-xs"></span>
                                        Updating...
                                    </>
                                ) : (
                                    'Confirm'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Decline Reason Modal */}
            {isDeclineModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-base-300 rounded-lg p-6 w-full max-w-md"
                    >
                        <h3 className="text-lg font-bold mb-4">Decline Event Request</h3>
                        <p className="text-gray-300 mb-4">
                            Please provide a reason for declining "{request.name}". This will be sent to the submitter and they will need to resubmit with proper information.
                        </p>
                        <textarea
                            className="textarea textarea-bordered w-full h-32 bg-base-100 text-white border-base-300 focus:border-primary"
                            placeholder="Enter decline reason (required)..."
                            value={declineReason}
                            onChange={(e) => setDeclineReason(e.target.value)}
                            maxLength={500}
                        />
                        <div className="text-xs text-gray-400 mb-4">
                            {declineReason.length}/500 characters
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                className="btn btn-ghost"
                                onClick={cancelDecline}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-error"
                                onClick={handleDeclineWithReason}
                                disabled={!declineReason.trim() || isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="loading loading-spinner loading-xs"></span>
                                        Declining...
                                    </>
                                ) : (
                                    'Decline Request'
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* File Preview Modal */}
            <dialog id="file-preview-modal" className="modal modal-bottom sm:modal-middle">
                <div className="modal-box bg-base-200 p-0 overflow-hidden max-w-4xl">
                    <div className="p-4">
                        <UniversalFilePreview isModal={true} />
                    </div>
                    <div className="modal-action mt-0 p-4 border-t border-base-300">
                        <form method="dialog">
                            <button className="btn btn-sm">Close</button>
                        </form>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button>close</button>
                </form>
            </dialog>
        </div>
    );
};

export default EventRequestDetails;