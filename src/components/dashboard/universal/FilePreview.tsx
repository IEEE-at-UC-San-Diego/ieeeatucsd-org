import { useEffect, useState, useCallback, useMemo } from 'react';
import { Icon } from "@iconify/react";
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { Authentication } from '../../../scripts/pocketbase/Authentication';

// Cache for file content
const contentCache = new Map<string, { content: string | 'image' | 'video' | 'pdf', fileType: string, timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface FilePreviewProps {
    url?: string;
    filename?: string;
    isModal?: boolean;
}

export default function FilePreview({ url: initialUrl = '', filename: initialFilename = '', isModal = false }: FilePreviewProps) {
    const [url, setUrl] = useState(initialUrl);
    const [filename, setFilename] = useState(initialFilename);
    const [content, setContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [fileType, setFileType] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [visibleLines, setVisibleLines] = useState(20);
    const CHUNK_SIZE = 50; // Number of additional lines to show when expanding
    const INITIAL_LINES_TO_SHOW = 20;

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

    // Update URL and filename when props change
    useEffect(() => {
        console.log('FilePreview props changed:', { initialUrl, initialFilename });
        if (initialUrl !== url) {
            console.log('URL changed from props:', initialUrl);
            setUrl(initialUrl);
        }
        if (initialFilename !== filename) {
            console.log('Filename changed from props:', initialFilename);
            setFilename(initialFilename);
        }
    }, [initialUrl, initialFilename, url, filename]);

    // Intersection Observer callback
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            { threshold: 0.1 }
        );

        // Target the entire component instead of just preview-content
        const previewElement = document.querySelector('.file-preview-container');
        if (previewElement) {
            observer.observe(previewElement);
        }

        return () => observer.disconnect();
    }, []);

    const loadContent = useCallback(async () => {
        if (!url) {
            // Don't log a warning if URL is empty during initial component mount
            // This is a normal state before the URL is set
            setError('No file URL provided');
            setLoading(false);
            return;
        }

        if (!filename) {
            console.warn('Cannot load content: Filename is empty');
            setError('No filename provided');
            setLoading(false);
            return;
        }

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

        // Check if it's likely an image based on filename extension
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
        const fileExtension = filename.split('.').pop()?.toLowerCase() || '';
        const isProbablyImage = imageExtensions.includes(fileExtension);

        if (isProbablyImage) {
            // Try loading as an image first to bypass CORS issues
            try {
                console.log('Trying to load as image:', url);
                const img = new Image();
                img.crossOrigin = 'anonymous'; // Try anonymous mode first

                // Create a promise to handle image loading
                const imageLoaded = new Promise((resolve, reject) => {
                    img.onload = () => resolve('image');
                    img.onerror = (e) => reject(new Error('Failed to load image'));
                });

                img.src = url;

                // Wait for image to load
                await imageLoaded;

                // If we get here, image loaded successfully
                setContent('image');
                setFileType('image/' + fileExtension);

                // Cache the content
                contentCache.set(cacheKey, {
                    content: 'image',
                    fileType: 'image/' + fileExtension,
                    timestamp: Date.now()
                });

                setLoading(false);
                return;
            } catch (imgError) {
                console.warn('Failed to load as image, falling back to fetch:', imgError);
                // Continue to fetch method
            }
        }

        try {
            console.log('Fetching file from URL:', url);
            const response = await fetch(url, {
                headers: {
                    'Cache-Control': 'no-cache', // Bypass cache
                }
            });

            if (!response.ok) {
                console.error('File fetch failed with status:', response.status, response.statusText);
                throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
            }

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
                contentValue = text;
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
        // Only attempt to load content if URL is not empty
        if ((isVisible || !isModal) && url) {
            loadContent();
        }
    }, [isVisible, loadContent, isModal, url]);

    useEffect(() => {
        console.log('FilePreview component mounted or updated with URL:', url);
        console.log('Filename:', filename);

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

    // Add a new effect to handle URL changes
    useEffect(() => {
        if (url && isVisible) {
            console.log('URL changed, loading content:', url);
            loadContent();
        }
    }, [url, isVisible, loadContent]);

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

    const getLanguageFromFilename = (filename: string): string => {
        const extension = filename.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'js':
            case 'jsx':
                return 'javascript';
            case 'ts':
            case 'tsx':
                return 'typescript';
            case 'py':
                return 'python';
            case 'html':
                return 'html';
            case 'css':
                return 'css';
            case 'json':
                return 'json';
            case 'md':
                return 'markdown';
            case 'yml':
            case 'yaml':
                return 'yaml';
            case 'csv':
                return 'csv';
            case 'txt':
                return 'plaintext';
            default:
                // If no extension or unrecognized extension, default to plaintext
                return 'plaintext';
        }
    };

    const parseCSV = useCallback((csvContent: string) => {
        const lines = csvContent.split('\n').map(line =>
            line.split(',').map(cell =>
                cell.trim().replace(/^["'](.*)["']$/, '$1')
            )
        );
        const headers = lines[0];
        const dataRows = lines.slice(1).filter(row => row.some(cell => cell.length > 0)); // Skip empty rows

        // Remove the truncation message if it exists
        const lastRow = dataRows[dataRows.length - 1];
        if (lastRow && lastRow[0] && lastRow[0].includes('Content truncated')) {
            dataRows.pop();
        }

        return { headers, rows: dataRows };
    }, []);

    const renderCSVTable = useCallback((csvContent: string) => {
        const { headers, rows } = parseCSV(csvContent);
        const totalRows = rows.length;
        const rowsToShow = Math.min(visibleLines, totalRows);
        const displayedRows = rows.slice(0, rowsToShow);

        return `
            <div class="overflow-x-auto">
                <table class="table w-full">
                    <thead>
                        <tr class="bg-base-200">
                            ${headers.map(header => `<th class="px-4 py-2 text-left font-medium">${header}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${displayedRows.map((row, rowIndex) => `
                            <tr class="${rowIndex % 2 === 0 ? 'bg-base-100' : 'bg-base-200/50'}">
                                ${row.map(cell => `<td class="px-4 py-2 border-t border-base-300">${cell}</td>`).join('')}
                            </tr>
                        `).join('')}
                        ${rowsToShow < totalRows ? `
                            <tr>
                                <td colspan="${headers.length}" class="px-4 py-3 text-base-content/70 bg-base-200/30 border-t border-base-300">
                                    ... ${totalRows - rowsToShow} more rows
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        `;
    }, [visibleLines]);

    const formatCodeWithLineNumbers = useCallback((code: string, language: string) => {
        try {
            // Use highlight.js to highlight the code
            const highlighted = hljs.highlight(code, { language }).value;
            const lines = highlighted.split('\n');

            return lines.map((line, i) =>
                `<div class="code-line">
                    <span class="line-number">${i + 1}</span>
                    <span class="line-content">${line || ' '}</span>
                </div>`
            ).join('');
        } catch (error) {
            console.warn(`Failed to highlight code as ${language}, falling back to plaintext`);
            const plaintext = hljs.highlight(code, { language: 'plaintext' }).value;
            const lines = plaintext.split('\n');

            return lines.map((line, i) =>
                `<div class="code-line">
                    <span class="line-number">${i + 1}</span>
                    <span class="line-content">${line || ' '}</span>
                </div>`
            ).join('');
        }
    }, []);

    const highlightCode = useCallback((code: string, language: string) => {
        // Skip highlighting for CSV
        if (language === 'csv') {
            return code;
        }

        return code; // Just return the code, formatting is handled in formatCodeWithLineNumbers
    }, []);

    const handleShowMore = useCallback(() => {
        setVisibleLines(prev => Math.min(prev + CHUNK_SIZE, content?.split('\n').length || 0));
    }, [content]);

    const handleShowLess = useCallback(() => {
        setVisibleLines(INITIAL_LINES_TO_SHOW);
    }, []);

    // If URL is empty, show a message
    if (!url) {
        return (
            <div className="file-preview-container bg-base-100 rounded-lg shadow-md overflow-hidden">
                <div className="p-6 flex flex-col items-center justify-center text-center">
                    <Icon icon="heroicons:exclamation-triangle" className="h-12 w-12 text-warning mb-3" />
                    <h3 className="text-lg font-semibold mb-2">No File URL Provided</h3>
                    <p className="text-base-content/70">Please check if the file exists or if you have the necessary permissions.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="file-preview-container space-y-4">
            <div className="flex justify-between items-center bg-base-200 p-3 rounded-t-lg">
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
                    <Icon icon="mdi:download" className="h-4 w-4" />
                    Download
                </button>
            </div>

            <div className="preview-content overflow-auto border border-base-300 rounded-lg bg-base-200/50 relative">
                {loading && (
                    <div className="flex justify-center items-center p-8">
                        <span className="loading loading-spinner loading-lg"></span>
                    </div>
                )}

                {error && (
                    <div className="flex flex-col items-center justify-center p-8 bg-base-200 rounded-lg text-center space-y-4">
                        <div className="bg-warning/20 p-4 rounded-full">
                            <Icon icon="mdi:alert" className="h-12 w-12 text-warning" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold">Preview Unavailable</h3>
                            <p className="text-base-content/70 max-w-md">{error}</p>
                        </div>
                        <button
                            onClick={handleDownload}
                            className="btn btn-warning btn-sm gap-2 mt-4"
                        >
                            <Icon icon="mdi:download" className="h-4 w-4" />
                            Download File Instead
                        </button>
                        <button
                            className="btn btn-sm btn-outline btn-error mt-4"
                            onClick={loadContent}
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {!loading && !error && content === 'image' && (
                    <div className="flex justify-center bg-base-200 p-4 rounded-b-lg">
                        <img
                            src={url}
                            alt={filename}
                            className="max-w-full h-auto rounded-lg"
                            loading="lazy"
                            onError={(e) => {
                                console.error('Image failed to load:', e);
                                setError('Failed to load image. This might be due to permission issues or the file may not exist.');

                                // Log additional details
                                console.log('Image URL that failed:', url);
                                console.log('Current auth status:',
                                    Authentication.getInstance().isAuthenticated() ? 'Authenticated' : 'Not authenticated'
                                );
                            }}
                        />
                    </div>
                )}

                {!loading && !error && content === 'video' && (
                    <div className="flex justify-center bg-base-200 p-4 rounded-b-lg">
                        <video
                            controls
                            className="max-w-full h-auto rounded-lg"
                            preload="metadata"
                        >
                            <source src={url} type={fileType || 'video/mp4'} />
                            Your browser does not support the video tag.
                        </video>
                    </div>
                )}

                {!loading && !error && content === 'pdf' && (
                    <div className="w-full h-[600px] bg-base-200 p-4 rounded-b-lg">
                        <iframe
                            src={url}
                            className="w-full h-full rounded-lg"
                            title={filename}
                            loading="lazy"
                        ></iframe>
                    </div>
                )}

                {!loading && !error && content && !['image', 'video', 'pdf'].includes(content) && (
                    <div className="overflow-x-auto max-h-[600px] bg-base-200">
                        <div className={`p-1 ${filename.toLowerCase().endsWith('.csv') ? 'p-4' : ''}`}>
                            {filename.toLowerCase().endsWith('.csv') ? (
                                <div dangerouslySetInnerHTML={{ __html: renderCSVTable(content) }} />
                            ) : (
                                <>
                                    <div className="file-preview-code-container text-sm">
                                        <style>
                                            {`
                                            .file-preview-code-container {
                                                font-family: monospace;
                                            }
                                            .file-preview-code-container .code-line {
                                                display: flex;
                                                white-space: pre;
                                            }
                                            .file-preview-code-container .line-number {
                                                user-select: none;
                                                text-align: right;
                                                color: rgba(115, 115, 115, 0.6);
                                                min-width: 40px;
                                                padding-right: 12px;
                                                display: inline-block;
                                            }
                                            .file-preview-code-container .line-content {
                                                flex: 1;
                                                white-space: pre-wrap;
                                                word-break: break-word;
                                            }
                                            `}
                                        </style>
                                        <div
                                            dangerouslySetInnerHTML={{
                                                __html: formatCodeWithLineNumbers(
                                                    content.split('\n').slice(0, visibleLines).join('\n'),
                                                    getLanguageFromFilename(filename)
                                                )
                                            }}
                                        />
                                    </div>
                                    {content.split('\n').length > visibleLines && (
                                        <div className="flex justify-center p-2 border-t border-base-300 bg-base-200/50">
                                            {visibleLines < content.split('\n').length && (
                                                <button
                                                    className="btn btn-sm btn-ghost gap-1"
                                                    onClick={handleShowMore}
                                                >
                                                    <Icon icon="mdi:chevron-down" className="h-4 w-4" />
                                                    Show {Math.min(CHUNK_SIZE, content.split('\n').length - visibleLines)} more lines
                                                </button>
                                            )}
                                            {visibleLines > INITIAL_LINES_TO_SHOW && (
                                                <button
                                                    className="btn btn-sm btn-ghost gap-1 ml-2"
                                                    onClick={handleShowLess}
                                                >
                                                    <Icon icon="mdi:chevron-up" className="h-4 w-4" />
                                                    Show less
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 