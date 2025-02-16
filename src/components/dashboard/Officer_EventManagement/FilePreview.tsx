import React, { useEffect, useState } from 'react';

interface FilePreviewProps {
    url?: string;
    filename?: string;
    isModal?: boolean;
}

const FilePreview: React.FC<FilePreviewProps> = ({ url: initialUrl = '', filename: initialFilename = '', isModal = false }) => {
    const [url, setUrl] = useState(initialUrl);
    const [filename, setFilename] = useState(initialFilename);
    const [content, setContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [fileType, setFileType] = useState<string | null>(null);

    useEffect(() => {
        console.log('FilePreview component mounted');

        if (isModal) {
            const handleStateChange = (event: CustomEvent<{ url: string; filename: string }>) => {
                console.log('Received state change event:', event.detail);
                const { url: newUrl, filename: newFilename } = event.detail;
                setUrl(newUrl);
                setFilename(newFilename);

                // Reset state when url is empty (modal closing)
                if (!newUrl) {
                    setContent(null);
                    setError(null);
                    setFileType(null);
                    setLoading(false);
                }
            };

            // Add event listener only for modal mode
            window.addEventListener('filePreviewStateChange', handleStateChange as EventListener);

            // Cleanup
            return () => {
                window.removeEventListener('filePreviewStateChange', handleStateChange as EventListener);
            };
        } else {
            // For integrated preview, use props directly
            setUrl(initialUrl);
            setFilename(initialFilename);
        }
    }, [isModal, initialUrl, initialFilename]);

    useEffect(() => {
        console.log('FilePreview state updated:', { url, filename });

        if (!url || !filename) {
            console.log('No URL or filename, resetting state');
            setContent(null);
            setError(null);
            setFileType(null);
            return;
        }

        const loadContent = async () => {
            console.log('Loading content for:', { url, filename });
            setLoading(true);
            setError(null);

            try {
                console.log('Fetching file...');
                const response = await fetch(url);
                const contentType = response.headers.get('content-type');
                console.log('Received content type:', contentType);
                setFileType(contentType);

                if (contentType?.startsWith('image/')) {
                    console.log('Setting content type as image');
                    setContent('image');
                } else if (contentType?.startsWith('video/')) {
                    console.log('Setting content type as video');
                    setContent('video');
                } else if (contentType?.startsWith('application/pdf')) {
                    console.log('Setting content type as pdf');
                    setContent('pdf');
                } else if (contentType?.startsWith('text/')) {
                    console.log('Loading text content');
                    const text = await response.text();
                    if (text.length > 100000) {
                        console.log('Text content truncated due to length');
                        setContent(text.substring(0, 100000) + '\n\n... Content truncated. Please download the file to view the complete content.');
                    } else {
                        setContent(text);
                    }
                } else if (filename.toLowerCase().endsWith('.mp4')) {
                    console.log('Fallback to video for .mp4 file');
                    setContent('video');
                } else {
                    console.log('Unsupported file type');
                    setError(`This file type (${contentType || 'unknown'}) is not supported for preview. Please download the file to view it.`);
                }
            } catch (err) {
                console.error('Error loading file:', err);
                setError('Failed to load file');
            } finally {
                console.log('Finished loading content');
                setLoading(false);
            }
        };

        loadContent();
    }, [url, filename]);

    const handleDownload = async () => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error('Error downloading file:', err);
            alert('Failed to download file. Please try again.');
        }
    };

    console.log('Rendering FilePreview with:', { content, error, loading, fileType });

    return (
        <div className="space-y-4">
            {/* Header with filename and download button */}
            <div className="flex justify-between items-center bg-base-200 p-3 rounded-lg">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="truncate font-medium">{filename}</span>
                    {fileType && (
                        <span className="badge badge-sm">{fileType.split('/')[1]}</span>
                    )}
                </div>
                <button
                    onClick={handleDownload}
                    className="btn btn-sm btn-ghost gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Download
                </button>
            </div>

            {/* Preview content */}
            <div className="preview-content">
                {loading && (
                    <div className="flex justify-center items-center p-8">
                        <span className="loading loading-spinner loading-lg"></span>
                    </div>
                )}

                {error && (
                    <div className="flex flex-col items-center justify-center p-8 bg-base-200 rounded-lg text-center space-y-4">
                        <div className="bg-warning/20 p-4 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold">Preview Unavailable</h3>
                            <p className="text-base-content/70 max-w-md">{error}</p>
                        </div>
                        <button
                            onClick={handleDownload}
                            className="btn btn-warning btn-sm gap-2 mt-4"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            Download File Instead
                        </button>
                    </div>
                )}

                {!loading && !error && content === 'image' && (
                    <div className="flex justify-center">
                        <img src={url} alt={filename} className="max-w-full h-auto rounded-lg" />
                    </div>
                )}

                {!loading && !error && content === 'video' && (
                    <div className="flex justify-center">
                        <video
                            controls
                            className="max-w-full rounded-lg"
                            style={{ maxHeight: '600px' }}
                        >
                            <source src={url} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    </div>
                )}

                {!loading && !error && content === 'pdf' && (
                    <div className="w-full h-[600px]">
                        <iframe
                            src={url}
                            className="w-full h-full rounded-lg"
                            title={filename}
                        ></iframe>
                    </div>
                )}

                {!loading && !error && content && !['image', 'video', 'pdf'].includes(content) && (
                    <div className="mockup-code bg-base-200 text-base-content overflow-x-auto max-h-[600px]">
                        <pre className="p-4"><code>{content}</code></pre>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FilePreview; 