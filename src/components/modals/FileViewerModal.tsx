import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';

interface FileType {
    url: string;
    type: string;
    name: string;
}

interface FileViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    files: FileType | FileType[];
    modalId?: string;
}

// Create a wrapper component that listens to custom events
export const FileViewerModalWrapper: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [files, setFiles] = useState<FileType[]>([]);

    useEffect(() => {
        let mounted = true;

        // Listen for custom events to open/close modal and set files
        const handleShowFiles = (event: CustomEvent) => {
            if (mounted) {
                const { files } = event.detail;
                setFiles(Array.isArray(files) ? files : [files]);
                setIsOpen(true);
            }
        };

        // Add event listeners
        window.addEventListener('showFileViewer' as any, handleShowFiles);

        // Cleanup
        return () => {
            mounted = false;
            window.removeEventListener('showFileViewer' as any, handleShowFiles);
            // Reset state on unmount
            setIsOpen(false);
            setFiles([]);
        };
    }, []);

    // Handle tab visibility changes
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                setIsOpen(false);
                setFiles([]);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const handleClose = () => {
        setIsOpen(false);
        setFiles([]);
    };

    // Only render the modal if we have files and it should be open
    if (!isOpen || files.length === 0) return null;

    return (
        <FileViewerModal
            isOpen={isOpen}
            onClose={handleClose}
            files={files}
            modalId="file-viewer"
        />
    );
};

const FileViewerModal: React.FC<FileViewerModalProps> = ({ isOpen, onClose, files, modalId = 'file-viewer' }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<FileType | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [downloadingAll, setDownloadingAll] = useState(false);

    const fileArray = Array.isArray(files) ? files : [files];

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setLoading(true);
            setError(null);
            setSelectedFile(null);
            setShowPreview(false);
        }
    }, [isOpen]);

    // Helper function to check if file type is previewable
    const isPreviewableType = (fileType: string): boolean => {
        return (
            fileType.startsWith('image/') ||
            fileType.startsWith('video/') ||
            fileType.startsWith('audio/') ||
            fileType === 'application/pdf' ||
            fileType.startsWith('text/') ||
            fileType === 'application/json'
        );
    };

    useEffect(() => {
        if (isOpen) {
            // Only show file directly if there's exactly one file
            if (fileArray.length === 1) {
                const fileToShow = fileArray[0];
                setSelectedFile(fileToShow);
                setShowPreview(true);
                setLoading(isPreviewableType(fileToShow.type));
            } else {
                // For multiple files, show the file browser
                setShowPreview(false);
                setSelectedFile(null);
                setLoading(false);
            }
            setError(null);
        }
    }, [isOpen, files]);

    const handleLoadSuccess = () => {
        setLoading(false);
    };

    const handleLoadError = () => {
        setLoading(false);
        setError('Failed to load file');
    };

    const handleFileSelect = (file: FileType) => {
        setSelectedFile(file);
        setShowPreview(true);
        setLoading(isPreviewableType(file.type));
        setError(null);
    };

    const handleBackToList = () => {
        setShowPreview(false);
        setSelectedFile(null);
    };

    // Function to download all files as zip
    const downloadAllFiles = async () => {
        if (fileArray.length === 0) return;

        setDownloadingAll(true);
        const zip = new JSZip();

        try {
            // Download all files
            const filePromises = fileArray.map(async (file) => {
                const response = await fetch(file.url);
                const blob = await response.blob();
                zip.file(file.name, blob);
            });

            await Promise.all(filePromises);

            // Generate and download zip
            const content = await zip.generateAsync({ type: "blob" });
            const zipUrl = URL.createObjectURL(content);

            const link = document.createElement('a');
            link.href = zipUrl;
            link.download = 'files.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(zipUrl);
        } catch (err) {
            console.error('Failed to download files:', err);
            setError('Failed to download files');
        } finally {
            setDownloadingAll(false);
        }
    };

    const renderFileContent = (file: FileType) => {
        const fileType = file.type.toLowerCase();

        // If not a previewable type, don't show loading state
        if (!isPreviewableType(fileType)) {
            return (
                <div className="flex flex-col items-center justify-center p-8">
                    <div className="text-4xl mb-4">📄</div>
                    <p className="text-center">
                        This file type ({file.type}) cannot be previewed.
                        <br />
                        <a
                            href={file.url}
                            download={file.name}
                            className="btn btn-primary mt-4"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open in New Tab
                        </a>
                    </p>
                </div>
            );
        }

        if (fileType.startsWith('image/')) {
            return (
                <img
                    src={file.url}
                    alt={file.name}
                    className="max-w-full max-h-[70vh] object-contain"
                    onLoad={handleLoadSuccess}
                    onError={handleLoadError}
                />
            );
        }

        if (fileType.startsWith('video/')) {
            return (
                <video
                    controls
                    className="max-w-full max-h-[70vh]"
                    onLoadedData={handleLoadSuccess}
                    onError={handleLoadError}
                >
                    <source src={file.url} type={file.type} />
                    Your browser does not support the video tag.
                </video>
            );
        }

        if (fileType === 'application/pdf') {
            return (
                <iframe
                    src={file.url}
                    className="w-full h-[70vh]"
                    onLoad={handleLoadSuccess}
                    onError={handleLoadError}
                />
            );
        }

        if (fileType.startsWith('text/') || fileType === 'application/json') {
            return (
                <iframe
                    src={file.url}
                    className="w-full h-[70vh] font-mono"
                    onLoad={handleLoadSuccess}
                    onError={handleLoadError}
                />
            );
        }

        if (fileType.startsWith('audio/')) {
            return (
                <audio
                    controls
                    className="w-full"
                    onLoadedData={handleLoadSuccess}
                    onError={handleLoadError}
                >
                    <source src={file.url} type={file.type} />
                    Your browser does not support the audio element.
                </audio>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center p-8">
                <div className="text-4xl mb-4">📄</div>
                <p className="text-center">
                    This file type ({file.type}) cannot be previewed.
                    <br />
                    <a
                        href={file.url}
                        download={file.name}
                        className="btn btn-primary mt-4"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Open in New Tab
                    </a>
                </p>
            </div>
        );
    };

    const renderFileList = () => {
        return (
            <div className="w-full">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg">Files ({fileArray.length})</h3>
                    {fileArray.length > 1 && (
                        <button
                            className={`btn btn-primary btn-sm ${downloadingAll ? 'loading' : ''}`}
                            onClick={downloadAllFiles}
                            disabled={downloadingAll}
                        >
                            {!downloadingAll && (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-4 w-4 mr-2"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                                    />
                                </svg>
                            )}
                            {downloadingAll ? 'Preparing Download...' : 'Download All'}
                        </button>
                    )}
                </div>
                <div className="overflow-y-auto max-h-[60vh]">
                    {fileArray.map((file, index) => (
                        <div
                            key={`${file.name}-${index}`}
                            className="flex items-center justify-between p-4 hover:bg-base-200 rounded-lg cursor-pointer mb-2"
                            onClick={() => handleFileSelect(file)}
                        >
                            <div className="flex items-center gap-3">
                                <div className="text-2xl">
                                    {file.type.startsWith('image/') ? '🖼️' :
                                        file.type.startsWith('video/') ? '🎥' :
                                            file.type.startsWith('audio/') ? '🎵' :
                                                file.type === 'application/pdf' ? '📄' :
                                                    file.type.startsWith('text/') ? '📝' : '📎'}
                                </div>
                                <div>
                                    <div className="font-semibold">{file.name}</div>
                                    <div className="text-sm opacity-70">{file.type}</div>
                                </div>
                            </div>
                            <button className="btn btn-ghost btn-sm">
                                Preview
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    return (
        <>
            <input
                type="checkbox"
                id={modalId}
                className="modal-toggle"
                checked={isOpen}
                onChange={onClose}
            />
            <div className="modal ">
                <div className="modal-box  max-w-4xl">
                    <div className="flex justify-between items-center mb-4">
                        {showPreview && selectedFile ? (
                            <>
                                <div className="flex items-center gap-3">
                                    {fileArray.length > 1 && (
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={handleBackToList}
                                        >
                                            ← Back
                                        </button>
                                    )}
                                    <h3 className="font-bold text-lg truncate">{selectedFile.name}</h3>
                                </div>
                            </>
                        ) : (
                            <h3 className="font-bold text-lg">File Browser</h3>
                        )}
                        <div className="flex gap-2">
                            <button
                                className="btn btn-circle btn-ghost"
                                onClick={onClose}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-6 w-6"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        {loading && showPreview && (
                            <div className="absolute inset-0 flex items-center justify-center bg-base-200 bg-opacity-50">
                                <span className="loading loading-spinner loading-lg"></span>
                            </div>
                        )}
                        {error ? (
                            <div className="alert alert-error">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="stroke-current shrink-0 h-6 w-6"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <span>{error}</span>
                            </div>
                        ) : showPreview && selectedFile ? (
                            renderFileContent(selectedFile)
                        ) : (
                            renderFileList()
                        )}
                    </div>
                </div>
                <label className="modal-backdrop" htmlFor={modalId}>
                    Close
                </label>
            </div>
        </>
    );
};

export default FileViewerModalWrapper; 