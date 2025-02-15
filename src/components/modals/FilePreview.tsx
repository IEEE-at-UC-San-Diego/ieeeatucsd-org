import { useState, useEffect } from "react";
import { FileManager } from "../pocketbase/FileManager";

interface FilePreviewProps {
    url: string;
    filename: string;
    onClose?: () => void;
}

export default function FilePreview({ url, filename, onClose }: FilePreviewProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fileType, setFileType] = useState<string | null>(null);
    const [modalElement, setModalElement] = useState<HTMLDialogElement | null>(null);

    useEffect(() => {
        const modal = document.getElementById('filePreviewModal') as HTMLDialogElement;
        setModalElement(modal);

        const initializeViewer = async () => {
            try {
                setLoading(true);
                setError(null);
                setFileContent(null);

                // Determine file type from extension
                const extension = filename.split('.').pop()?.toLowerCase() || '';
                const type = getFileType(extension);
                setFileType(type);

                // If it's a code file, fetch its content
                if (type === 'code') {
                    await fetchCodeContent(url);
                }

                setLoading(false);
            } catch (err) {
                setError("Failed to load file preview");
                setLoading(false);
            }
        };

        // Only initialize if we have both url and filename
        if (url && filename) {
            initializeViewer();
            if (modal && !modal.open) {
                modal.showModal();
            }
        }

        // Cleanup function
        return () => {
            if (modal?.open) {
                modal.close();
            }
            setFileContent(null);
        };
    }, [url, filename]);

    const handleClose = () => {
        if (modalElement?.open) {
            modalElement.close();
        }
        onClose?.();
    };

    const [fileContent, setFileContent] = useState<string | null>(null);

    const getFileType = (extension: string): string => {
        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
        const videoTypes = ['mp4', 'webm', 'ogg', 'mov'];
        const documentTypes = ['pdf', 'doc', 'docx', 'txt', 'md'];
        const spreadsheetTypes = ['xls', 'xlsx', 'csv'];
        const presentationTypes = ['ppt', 'pptx'];
        const codeTypes = ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'java', 'cpp', 'h', 'c', 'cs', 'php', 'rb', 'swift', 'go', 'rs'];

        if (imageTypes.includes(extension)) return 'image';
        if (videoTypes.includes(extension)) return 'video';
        if (documentTypes.includes(extension)) return 'document';
        if (spreadsheetTypes.includes(extension)) return 'spreadsheet';
        if (presentationTypes.includes(extension)) return 'presentation';
        if (codeTypes.includes(extension)) return 'code';
        return 'other';
    };

    // Function to fetch and set code content
    const fetchCodeContent = async (url: string) => {
        try {
            const response = await fetch(url);
            const text = await response.text();
            setFileContent(text);
        } catch (err) {
            console.error('Failed to fetch code content:', err);
            setError('Failed to load code content');
        }
    };

    const renderFileIcon = () => {
        switch (fileType) {
            case 'image':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                );
            case 'video':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                );
            case 'document':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                );
            case 'code':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                );
            case 'spreadsheet':
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                );
            default:
                return (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                );
        }
    };

    const renderPreview = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-96">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-96 text-error">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p>{error}</p>
                </div>
            );
        }

        switch (fileType) {
            case 'image':
                return (
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="relative group">
                            <img
                                src={url}
                                alt={filename}
                                className="max-w-full max-h-[calc(100vh-16rem)] object-contain rounded-lg"
                                onError={() => setError("Failed to load image")}
                            />
                            <a
                                href={url}
                                download
                                className="btn btn-sm btn-primary absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Download
                            </a>
                        </div>
                    </div>
                );
            case 'video':
                return (
                    <div className="flex flex-col items-center justify-center gap-4">
                        <video
                            controls
                            className="max-w-full max-h-[calc(100vh-16rem)] rounded-lg"
                            onError={() => setError("Failed to load video")}
                        >
                            <source src={url} type={`video/${filename.split('.').pop()}`} />
                            Your browser does not support the video tag.
                        </video>
                        <a
                            href={url}
                            download
                            className="btn btn-primary btn-sm"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Download Video
                        </a>
                    </div>
                );
            case 'code':
                if (fileContent !== null) {
                    return (
                        <div className="bg-base-200 rounded-lg p-4 overflow-x-auto">
                            <pre className="text-sm">
                                <code>{fileContent}</code>
                            </pre>
                            <div className="mt-4 flex justify-end">
                                <a
                                    href={url}
                                    download
                                    className="btn btn-primary btn-sm"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Download Source
                                </a>
                            </div>
                        </div>
                    );
                }
                return (
                    <div className="flex flex-col items-center justify-center h-96 gap-4">
                        {renderFileIcon()}
                        <p className="text-lg font-semibold text-center max-w-full truncate px-4">{filename}</p>
                        <div className="loading loading-spinner loading-md"></div>
                    </div>
                );
            case 'document':
                if (filename.toLowerCase().endsWith('.pdf')) {
                    return (
                        <div className="flex flex-col gap-4">
                            <iframe
                                src={url}
                                className="w-full h-[calc(100vh-16rem)] rounded-lg"
                                title={filename}
                            />
                            <div className="flex justify-end">
                                <a
                                    href={url}
                                    download
                                    className="btn btn-primary btn-sm"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Download PDF
                                </a>
                            </div>
                        </div>
                    );
                }
                // For other document types, show download button
                return (
                    <div className="flex flex-col items-center justify-center h-96 gap-4">
                        {renderFileIcon()}
                        <p className="text-lg font-semibold text-center max-w-full truncate px-4">{filename}</p>
                        <a
                            href={url}
                            download
                            className="btn btn-primary"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Download File
                        </a>
                    </div>
                );
            default:
                return (
                    <div className="flex flex-col items-center justify-center h-96 gap-4">
                        {renderFileIcon()}
                        <p className="text-lg font-semibold text-center max-w-full truncate px-4">{filename}</p>
                        <a
                            href={url}
                            download
                            className="btn btn-primary"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Download File
                        </a>
                    </div>
                );
        }
    };

    // Only render if we have both url and filename
    if (!url || !filename) return null;

    return (
        <dialog id="filePreviewModal" className="modal">
            <div className="modal-box max-w-4xl w-full">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                            className="btn btn-ghost btn-sm flex-shrink-0"
                            onClick={handleClose}
                        >
                            ← Back
                        </button>
                        <h3 className="font-bold text-lg truncate">
                            {filename}
                        </h3>
                    </div>
                </div>
                <div className="overflow-auto">
                    {renderPreview()}
                </div>
            </div>
            <form method="dialog" className="modal-backdrop">
                <button onClick={handleClose}>close</button>
            </form>
        </dialog>
    );
}