import React, { useState, useEffect } from 'react';

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
        // Listen for custom events to open/close modal and set files
        const handleShowFiles = (event: CustomEvent) => {
            const { files } = event.detail;
            setFiles(Array.isArray(files) ? files : [files]);
            setIsOpen(true);
        };

        // Add event listeners
        window.addEventListener('showFileViewer' as any, handleShowFiles);

        // Cleanup
        return () => {
            window.removeEventListener('showFileViewer' as any, handleShowFiles);
        };
    }, []);

    const handleClose = () => {
        setIsOpen(false);
    };

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

    const fileArray = Array.isArray(files) ? files : [files];

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
            // Only set loading if the file is previewable
            if (selectedFile && isPreviewableType(selectedFile.type)) {
                setLoading(true);
            } else {
                setLoading(false);
            }
            setError(null);
            // If single file, show preview directly
            if (!Array.isArray(files)) {
                setSelectedFile(files);
                setShowPreview(true);
            } else {
                setShowPreview(false);
                setSelectedFile(null);
            }
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
        // Only set loading if the file is previewable
        setLoading(isPreviewableType(file.type));
        setError(null);
    };

    const handleBackToList = () => {
        setShowPreview(false);
        setSelectedFile(null);
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

        // Fallback for unsupported file types
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
                <h3 className="font-bold text-lg mb-4">Files ({fileArray.length})</h3>
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

    // Clone the modal with a new ID
    const cloneModal = () => {
        const newModalId = `${modalId}-${Date.now()}`;
        return (
            <FileViewerModal
                isOpen={isOpen}
                onClose={onClose}
                files={files}
                modalId={newModalId}
            />
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
            <div className="modal">
                <div className="modal-box max-w-4xl">
                    <div className="flex justify-between items-center mb-4">
                        {showPreview && selectedFile ? (
                            <>
                                <div className="flex items-center gap-3">
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={handleBackToList}
                                        style={{ display: Array.isArray(files) ? 'block' : 'none' }}
                                    >
                                        ← Back
                                    </button>
                                    <h3 className="font-bold text-lg truncate">{selectedFile.name}</h3>
                                </div>
                            </>
                        ) : (
                            <h3 className="font-bold text-lg">File Browser</h3>
                        )}
                        <div className="flex gap-2">
                            <button
                                className="btn btn-circle btn-ghost"
                                onClick={cloneModal}
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
                                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                </svg>
                            </button>
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