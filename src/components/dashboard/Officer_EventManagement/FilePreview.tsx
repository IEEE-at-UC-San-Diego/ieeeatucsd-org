import React, { useEffect, useState, useCallback, useMemo } from 'react';

// Cache for file content
const contentCache = new Map<string, { content: string | 'image' | 'video' | 'pdf', fileType: string, timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
    const [isVisible, setIsVisible] = useState(false);

    // Memoize the truncated filename
    const truncatedFilename = useMemo(() => {
        if (!filename) return '';
        const maxLength = 40;
        if (filename.length <= maxLength) return filename;
        const extension = filename.split('.').pop();
        const name = filename.substring(0, filename.lastIndexOf('.'));
        const truncatedName = name.substring(0, maxLength - 3 - (extension?.length || 0));
        return `${truncatedName}...${extension ? `.${extension}` : ''}`;
    }, [filename]);

    // Intersection Observer callback
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            { threshold: 0.1 }
        );

        const previewElement = document.querySelector('.preview-content');
        if (previewElement) {
            observer.observe(previewElement);
        }

        return () => observer.disconnect();
    }, []);

    const loadContent = useCallback(async () => {
        if (!url || !filename) return;

        console.log('Loading content for:', { url, filename });
        setLoading(true);
        setError(null);

        // Check cache first
        const cacheKey = `${url}_${filename}`;
        const cachedData = contentCache.get(cacheKey);
        if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
            console.log('Using cached content');
            setContent(cachedData.content);
            setFileType(cachedData.fileType);
            setLoading(false);
            return;
        }

        try {
            console.log('Fetching file...');
            const response = await fetch(url);
            const contentType = response.headers.get('content-type');
            console.log('Received content type:', contentType);
            setFileType(contentType);

            let contentValue: string | 'image' | 'video' | 'pdf';
            if (contentType?.startsWith('image/')) {
                contentValue = 'image';
            } else if (contentType?.startsWith('video/')) {
                contentValue = 'video';
            } else if (contentType?.startsWith('application/pdf')) {
                contentValue = 'pdf';
            } else if (contentType?.startsWith('text/')) {
                const text = await response.text();
                contentValue = text.length > 100000
                    ? text.substring(0, 100000) + '\n\n... Content truncated. Please download the file to view the complete content.'
                    : text;
            } else if (filename.toLowerCase().endsWith('.mp4')) {
                contentValue = 'video';
            } else {
                throw new Error(`Unsupported file type (${contentType || 'unknown'})`);
            }

            // Cache the content
            contentCache.set(cacheKey, {
                content: contentValue,
                fileType: contentType || 'unknown',
                timestamp: Date.now()
            });

            setContent(contentValue);
        } catch (err) {
            console.error('Error loading file:', err);
            setError(err instanceof Error ? err.message : 'Failed to load file');
        } finally {
            setLoading(false);
        }
    }, [url, filename]);

    useEffect(() => {
        if (isVisible) {
            loadContent();
        }
    }, [isVisible, loadContent]);

    useEffect(() => {
        console.log('FilePreview component mounted');

        if (isModal) {
            const handleStateChange = (event: CustomEvent<{ url: string; filename: string }>) => {
                console.log('Received state change event:', event.detail);
                const { url: newUrl, filename: newFilename } = event.detail;
                setUrl(newUrl);
                setFilename(newFilename);

                if (!newUrl) {
                    setContent(null);
                    setError(null);
                    setFileType(null);
                    setLoading(false);
                }
            };

            window.addEventListener('filePreviewStateChange', handleStateChange as EventListener);
            return () => {
                window.removeEventListener('filePreviewStateChange', handleStateChange as EventListener);
            };
        } else {
            setUrl(initialUrl);
            setFilename(initialFilename);
        }
    }, [isModal, initialUrl, initialFilename]);

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

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-base-200 p-3 rounded-lg">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="truncate font-medium" title={filename}>{truncatedFilename}</span>
                    {fileType && (
                        <span className="badge badge-sm whitespace-nowrap">{fileType.split('/')[1]}</span>
                    )}
                </div>
                <button
                    onClick={handleDownload}
                    className="btn btn-sm btn-ghost gap-2 whitespace-nowrap"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Download
                </button>
            </div>

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
                        <img
                            src={url}
                            alt={filename}
                            className="max-w-full h-auto rounded-lg"
                            loading="lazy"
                        />
                    </div>
                )}

                {!loading && !error && content === 'video' && (
                    <div className="flex justify-center">
                        <video
                            controls
                            className="max-w-full rounded-lg"
                            style={{ maxHeight: '600px' }}
                            preload="metadata"
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
                            loading="lazy"
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