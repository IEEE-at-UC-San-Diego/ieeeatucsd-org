import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Icon } from "@iconify/react";
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { Authentication } from '../../../scripts/pocketbase/Authentication';

// Image component with fallback handling
interface ImageWithFallbackProps {
    url: string;
    filename: string;
    onError: (message: string) => void;
}

const ImageWithFallback = ({ url, filename, onError }: ImageWithFallbackProps) => {
    const [imgSrc, setImgSrc] = useState<string>(url);
    const [isObjectUrl, setIsObjectUrl] = useState<boolean>(false);
    const [errorCount, setErrorCount] = useState<number>(0);
    const maxRetries = 2;

    // Clean up object URL when component unmounts
    useEffect(() => {
        return () => {
            if (isObjectUrl && imgSrc !== url) {
                URL.revokeObjectURL(imgSrc);
            }
        };
    }, [imgSrc, url, isObjectUrl]);

    // Reset when URL changes
    useEffect(() => {
        setImgSrc(url);
        setIsObjectUrl(false);
        setErrorCount(0);
    }, [url]);

    // Special handling for blob URLs
    useEffect(() => {
        const handleBlobUrl = async () => {
            if (url.startsWith('blob:') && !isObjectUrl) {
                try {
                    // For blob URLs, we don't need to fetch again, just set directly
                    setImgSrc(url);
                } catch (error) {
                    console.error('Error with blob URL:', error);
                }
            }
        };

        handleBlobUrl();
    }, [url, isObjectUrl]);

    const handleError = async () => {
        // Prevent infinite retry loops
        if (errorCount >= maxRetries) {
            console.error(`Image failed to load after ${maxRetries} attempts:`, url);
            onError('Failed to load image after multiple attempts. The file may be corrupted or unsupported.');
            return;
        }

        setErrorCount(prev => prev + 1);
        console.error(`Image failed to load (attempt ${errorCount + 1}):`, url);

        try {
            // Skip fetch for blob URLs that already failed
            if (url.startsWith('blob:')) {
                throw new Error('Blob URL failed to load directly');
            }

            // Try to fetch the image as a blob and create an object URL
            const response = await fetch(url, {
                mode: 'cors',
                cache: 'no-cache' // Avoid caching issues
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);

            // Update the image source with the object URL
            setImgSrc(objectUrl);
            setIsObjectUrl(true);
        } catch (fetchError) {
            console.error('Error fetching image as blob:', fetchError);

            // Only show error to user on final retry
            if (errorCount >= maxRetries - 1) {
                onError('Failed to load image. This might be due to permission issues or the file may not exist.');
            }
        }
    };

    return (
        <img
            src={imgSrc}
            alt={filename || 'Image preview'}
            className="max-w-full h-auto rounded-lg"
            loading="lazy"
            onError={handleError}
        />
    );
};

// Cache for file content
const contentCache = new Map<string, { content: string | 'image' | 'video' | 'pdf', fileType: string, timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface FilePreviewProps {
    url?: string;
    filename?: string;
    isModal?: boolean;
}

export default function FilePreview({ url: initialUrl = '', filename: initialFilename = '', isModal = false }: FilePreviewProps) {
    // Constants
    const CHUNK_SIZE = 50;
    const INITIAL_LINES_TO_SHOW = 20;

    // Consolidate state management with useRef for latest values
    const latestPropsRef = useRef({ url: initialUrl, filename: initialFilename });
    const loadingRef = useRef(false); // Add a ref to track loading state
    const [state, setState] = useState({
        url: initialUrl,
        filename: initialFilename,
        content: null as string | 'image' | 'video' | 'pdf' | null,
        error: null as string | null,
        loading: false,
        fileType: null as string | null,
        isVisible: false,
        visibleLines: INITIAL_LINES_TO_SHOW
    });

    // Memoize the truncated filename
    const truncatedFilename = useMemo(() => {
        if (!state.filename) return '';
        const maxLength = 40;
        if (state.filename.length <= maxLength) return state.filename;
        const extension = state.filename.split('.').pop();
        const name = state.filename.substring(0, state.filename.lastIndexOf('.'));
        const truncatedName = name.substring(0, maxLength - 3 - (extension?.length || 0));
        return `${truncatedName}...${extension ? `.${extension}` : ''}`;
    }, [state.filename]);

    // Update ref when props change
    useEffect(() => {
        latestPropsRef.current = { url: initialUrl, filename: initialFilename };
        loadingRef.current = false; // Reset loading ref
        // Clear state when URL changes
        setState(prev => ({
            ...prev,
            url: initialUrl,
            filename: initialFilename,
            content: null,
            error: null,
            fileType: null,
            loading: false
        }));
    }, [initialUrl, initialFilename]);

    // Single effect for modal event handling
    useEffect(() => {
        if (isModal) {
            const handleStateChange = (event: CustomEvent<{ url: string; filename: string }>) => {
                const { url: newUrl, filename: newFilename } = event.detail;

                // Force clear cache for PDFs to prevent stale content
                if (newUrl.endsWith('.pdf')) {
                    contentCache.delete(`${newUrl}_${newFilename}`);
                }

                setState(prev => ({
                    ...prev,
                    url: newUrl,
                    filename: newFilename,
                    content: null,
                    error: null,
                    fileType: null,
                    loading: true
                }));
            };

            window.addEventListener('filePreviewStateChange', handleStateChange as EventListener);
            return () => {
                window.removeEventListener('filePreviewStateChange', handleStateChange as EventListener);
            };
        }
    }, [isModal]);

    // Consolidated content loading effect
    const loadContent = useCallback(async () => {
        if (!state.url) {
            setState(prev => ({ ...prev, error: 'No file URL provided', loading: false }));
            return;
        }

        // Prevent duplicate loading
        if (loadingRef.current) {
            return;
        }

        loadingRef.current = true;
        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            // Check cache first
            const cacheKey = `${state.url}_${state.filename}`;
            const cachedData = contentCache.get(cacheKey);

            if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
                // Use cached data
                setState(prev => ({
                    ...prev,
                    content: cachedData.content,
                    fileType: cachedData.fileType,
                    loading: false
                }));
                loadingRef.current = false;
                return;
            }

            // Special handling for PDFs
            if (state.url.endsWith('.pdf')) {
                setState(prev => ({
                    ...prev,
                    content: 'pdf',
                    fileType: 'application/pdf',
                    loading: false
                }));

                // Cache the result
                contentCache.set(cacheKey, {
                    content: 'pdf',
                    fileType: 'application/pdf',
                    timestamp: Date.now()
                });

                loadingRef.current = false;
                return;
            }

            // Handle image files
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
            if (imageExtensions.some(ext => state.url.toLowerCase().endsWith(ext) ||
                (state.filename && state.filename.toLowerCase().endsWith(ext)))) {
                setState(prev => ({
                    ...prev,
                    content: 'image',
                    fileType: 'image/' + (state.url.split('.').pop() || 'jpeg'),
                    loading: false
                }));

                // Cache the result
                contentCache.set(cacheKey, {
                    content: 'image',
                    fileType: 'image/' + (state.url.split('.').pop() || 'jpeg'),
                    timestamp: Date.now()
                });

                loadingRef.current = false;
                return;
            }

            // Handle video files
            const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
            if (videoExtensions.some(ext => state.url.toLowerCase().endsWith(ext) ||
                (state.filename && state.filename.toLowerCase().endsWith(ext)))) {
                setState(prev => ({
                    ...prev,
                    content: 'video',
                    fileType: 'video/' + (state.url.split('.').pop() || 'mp4'),
                    loading: false
                }));

                // Cache the result
                contentCache.set(cacheKey, {
                    content: 'video',
                    fileType: 'video/' + (state.url.split('.').pop() || 'mp4'),
                    timestamp: Date.now()
                });

                loadingRef.current = false;
                return;
            }

            // For other file types, try to fetch the content
            // Handle blob URLs (for local file previews)
            if (state.url.startsWith('blob:')) {
                try {
                    // Determine file type from filename if available
                    let fileType = '';
                    if (state.filename) {
                        const extension = state.filename.split('.').pop()?.toLowerCase();
                        if (extension) {
                            switch (extension) {
                                case 'jpg':
                                case 'jpeg':
                                case 'png':
                                case 'gif':
                                case 'webp':
                                case 'bmp':
                                case 'svg':
                                    fileType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
                                    break;
                                case 'mp4':
                                case 'webm':
                                case 'ogg':
                                case 'mov':
                                    fileType = `video/${extension}`;
                                    break;
                                case 'pdf':
                                    fileType = 'application/pdf';
                                    break;
                                case 'doc':
                                    fileType = 'application/msword';
                                    break;
                                case 'docx':
                                    fileType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                                    break;
                                case 'xls':
                                    fileType = 'application/vnd.ms-excel';
                                    break;
                                case 'xlsx':
                                    fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                                    break;
                                case 'ppt':
                                    fileType = 'application/vnd.ms-powerpoint';
                                    break;
                                case 'pptx':
                                    fileType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
                                    break;
                                case 'txt':
                                case 'md':
                                case 'js':
                                case 'jsx':
                                case 'ts':
                                case 'tsx':
                                case 'html':
                                case 'css':
                                case 'json':
                                case 'yml':
                                case 'yaml':
                                case 'csv':
                                    fileType = 'text/plain';
                                    break;
                                default:
                                    fileType = 'application/octet-stream';
                            }
                        }
                    }

                    // Try to fetch the blob
                    const response = await fetch(state.url);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch blob: ${response.status}`);
                    }

                    const blob = await response.blob();

                    // If we couldn't determine file type from filename, use the blob type
                    if (!fileType && blob.type) {
                        fileType = blob.type;
                    }

                    // Handle different file types
                    if (fileType.startsWith('image/') ||
                        (state.filename && /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(state.filename))) {
                        setState(prev => ({
                            ...prev,
                            content: 'image',
                            fileType: fileType || 'image/jpeg',
                            loading: false
                        }));

                        // Cache the result
                        contentCache.set(cacheKey, {
                            content: 'image',
                            fileType: fileType || 'image/jpeg',
                            timestamp: Date.now()
                        });
                    } else if (fileType.startsWith('video/') ||
                        (state.filename && /\.(mp4|webm|ogg|mov|avi)$/i.test(state.filename))) {
                        setState(prev => ({
                            ...prev,
                            content: 'video',
                            fileType: fileType || 'video/mp4',
                            loading: false
                        }));

                        // Cache the result
                        contentCache.set(cacheKey, {
                            content: 'video',
                            fileType: fileType || 'video/mp4',
                            timestamp: Date.now()
                        });
                    } else if (fileType === 'application/pdf' ||
                        (state.filename && /\.pdf$/i.test(state.filename))) {
                        setState(prev => ({
                            ...prev,
                            content: 'pdf',
                            fileType: 'application/pdf',
                            loading: false
                        }));

                        // Cache the result
                        contentCache.set(cacheKey, {
                            content: 'pdf',
                            fileType: 'application/pdf',
                            timestamp: Date.now()
                        });
                    } else if (
                        fileType === 'application/msword' ||
                        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                        fileType === 'application/vnd.ms-excel' ||
                        fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                        fileType === 'application/vnd.ms-powerpoint' ||
                        fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                        (state.filename && /\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(state.filename))
                    ) {
                        // Handle Office documents with a document icon and download option
                        const extension = state.filename?.split('.').pop()?.toLowerCase() || '';
                        let documentType = 'document';

                        if (['xls', 'xlsx'].includes(extension)) {
                            documentType = 'spreadsheet';
                        } else if (['ppt', 'pptx'].includes(extension)) {
                            documentType = 'presentation';
                        }

                        setState(prev => ({
                            ...prev,
                            content: `document-${documentType}`,
                            fileType: fileType || `application/${documentType}`,
                            loading: false
                        }));

                        // Cache the result
                        contentCache.set(cacheKey, {
                            content: `document-${documentType}`,
                            fileType: fileType || `application/${documentType}`,
                            timestamp: Date.now()
                        });
                    } else {
                        // For text files, read the content
                        try {
                            const text = await blob.text();
                            setState(prev => ({
                                ...prev,
                                content: text,
                                fileType: fileType || 'text/plain',
                                loading: false
                            }));

                            // Cache the result
                            contentCache.set(cacheKey, {
                                content: text,
                                fileType: fileType || 'text/plain',
                                timestamp: Date.now()
                            });
                        } catch (textError) {
                            console.error('Error reading blob as text:', textError);
                            throw new Error('Failed to read file content');
                        }
                    }

                    loadingRef.current = false;
                    return;
                } catch (error) {
                    console.error('Error processing blob URL:', error);
                    setState(prev => ({
                        ...prev,
                        error: 'Failed to load file preview. Please try again or proceed with upload.',
                        loading: false
                    }));
                    loadingRef.current = false;
                    return;
                }
            }

            // For remote files
            const response = await fetch(state.url);
            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type') || '';

            if (contentType.startsWith('image/')) {
                setState(prev => ({
                    ...prev,
                    content: 'image',
                    fileType: contentType,
                    loading: false
                }));

                // Cache the result
                contentCache.set(cacheKey, {
                    content: 'image',
                    fileType: contentType,
                    timestamp: Date.now()
                });
            } else if (contentType.startsWith('video/')) {
                setState(prev => ({
                    ...prev,
                    content: 'video',
                    fileType: contentType,
                    loading: false
                }));

                // Cache the result
                contentCache.set(cacheKey, {
                    content: 'video',
                    fileType: contentType,
                    timestamp: Date.now()
                });
            } else if (contentType === 'application/pdf') {
                setState(prev => ({
                    ...prev,
                    content: 'pdf',
                    fileType: contentType,
                    loading: false
                }));

                // Cache the result
                contentCache.set(cacheKey, {
                    content: 'pdf',
                    fileType: contentType,
                    timestamp: Date.now()
                });
            } else if (
                contentType === 'application/msword' ||
                contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                (state.filename && /\.(doc|docx)$/i.test(state.filename))
            ) {
                setState(prev => ({
                    ...prev,
                    content: 'document-document',
                    fileType: contentType || 'application/document',
                    loading: false
                }));

                // Cache the result
                contentCache.set(cacheKey, {
                    content: 'document-document',
                    fileType: contentType || 'application/document',
                    timestamp: Date.now()
                });
            } else if (
                contentType === 'application/vnd.ms-excel' ||
                contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                (state.filename && /\.(xls|xlsx)$/i.test(state.filename))
            ) {
                setState(prev => ({
                    ...prev,
                    content: 'document-spreadsheet',
                    fileType: contentType || 'application/spreadsheet',
                    loading: false
                }));

                // Cache the result
                contentCache.set(cacheKey, {
                    content: 'document-spreadsheet',
                    fileType: contentType || 'application/spreadsheet',
                    timestamp: Date.now()
                });
            } else if (
                contentType === 'application/vnd.ms-powerpoint' ||
                contentType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                (state.filename && /\.(ppt|pptx)$/i.test(state.filename))
            ) {
                setState(prev => ({
                    ...prev,
                    content: 'document-presentation',
                    fileType: contentType || 'application/presentation',
                    loading: false
                }));

                // Cache the result
                contentCache.set(cacheKey, {
                    content: 'document-presentation',
                    fileType: contentType || 'application/presentation',
                    timestamp: Date.now()
                });
            } else {
                // For text files, read the content
                const text = await response.text();
                setState(prev => ({
                    ...prev,
                    content: text,
                    fileType: contentType,
                    loading: false
                }));

                // Cache the result
                contentCache.set(cacheKey, {
                    content: text,
                    fileType: contentType,
                    timestamp: Date.now()
                });
            }
        } catch (err) {
            console.error('Error loading content:', err);
            setState(prev => ({
                ...prev,
                error: err instanceof Error ? err.message : 'Failed to load file',
                loading: false
            }));
            loadingRef.current = false;
        }
    }, [state.url]);

    useEffect(() => {
        if (!state.url) return;

        // For modal, only load when visible
        if (isModal && !state.isVisible) return;

        // Reset loading state when URL changes
        loadingRef.current = false;

        // Small timeout to ensure state updates are processed
        const timer = setTimeout(() => {
            loadContent();
        }, 50);

        return () => clearTimeout(timer);
    }, [state.url, state.isVisible, isModal, loadContent]);

    // Intersection observer effect
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setState(prev => ({ ...prev, isVisible: entry.isIntersecting }));
            },
            { threshold: 0.1 }
        );

        const previewElement = document.querySelector('.file-preview-container');
        if (previewElement) {
            observer.observe(previewElement);
        }

        return () => observer.disconnect();
    }, []);

    const handleDownload = async () => {
        try {
            const response = await fetch(state.url);
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = state.filename;
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
        const rowsToShow = Math.min(state.visibleLines, totalRows);
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
    }, [state.visibleLines]);

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
        setState(prev => ({
            ...prev,
            visibleLines: Math.min(prev.visibleLines + CHUNK_SIZE, (prev.content as string).split('\n').length)
        }));
    }, []);

    const handleShowLess = useCallback(() => {
        setState(prev => ({ ...prev, visibleLines: INITIAL_LINES_TO_SHOW }));
    }, []);

    // Update the Try Again button handler
    const handleTryAgain = useCallback(() => {
        loadingRef.current = false; // Reset loading ref
        setState(prev => ({
            ...prev,
            error: null,
            loading: true
        }));
        setTimeout(() => {
            loadContent();
        }, 100); // Small delay to ensure state is updated
    }, [loadContent]);

    // If URL is empty, show a message
    if (!state.url) {
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
                    <span className="truncate font-medium" title={state.filename}>{truncatedFilename}</span>
                    {state.fileType && (
                        <span className="badge badge-sm whitespace-nowrap">{state.fileType.split('/')[1]}</span>
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
                {/* Initial loading state - show immediately when URL is provided but content hasn't loaded yet */}
                {state.url && !state.loading && !state.error && state.content === null && (
                    <div className="flex justify-center items-center p-8">
                        <span className="loading loading-spinner loading-lg"></span>
                    </div>
                )}

                {state.loading && (
                    <div className="flex justify-center items-center p-8">
                        <span className="loading loading-spinner loading-lg"></span>
                    </div>
                )}

                {state.error && (
                    <div className="flex flex-col items-center justify-center p-8 bg-base-200 rounded-lg text-center space-y-4">
                        <div className="bg-warning/20 p-4 rounded-full">
                            <Icon icon="mdi:alert" className="h-12 w-12 text-warning" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold">Preview Unavailable</h3>
                            <p className="text-base-content/70 max-w-md">{state.error}</p>
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
                            onClick={handleTryAgain}
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {!state.loading && !state.error && state.content === 'image' && (
                    <div className="flex justify-center bg-base-200 p-4 rounded-b-lg">
                        <ImageWithFallback
                            url={state.url}
                            filename={state.filename}
                            onError={(message) => setState(prev => ({ ...prev, error: message }))}
                        />
                    </div>
                )}

                {!state.loading && !state.error && state.content === 'video' && (
                    <div className="flex justify-center bg-base-200 p-4 rounded-b-lg">
                        <div className="w-full max-w-2xl">
                            <video
                                controls
                                className="max-w-full h-auto rounded-lg"
                                preload="metadata"
                                src={state.url}
                                onError={(e) => {
                                    console.error('Video failed to load:', e);

                                    // For blob URLs, try a different approach
                                    if (state.url.startsWith('blob:')) {
                                        const videoElement = e.target as HTMLVideoElement;

                                        // Try to set the src directly
                                        try {
                                            videoElement.src = state.url;
                                            videoElement.load();
                                            return;
                                        } catch (directError) {
                                            console.error('Direct src assignment failed:', directError);
                                        }
                                    }

                                    setState(prev => ({
                                        ...prev,
                                        error: 'Failed to load video. This might be due to permission issues or the file may not exist.'
                                    }));
                                }}
                            >
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    </div>
                )}

                {!state.loading && !state.error && state.content === 'pdf' && (
                    <div className="w-full h-[600px] bg-base-200 p-4 rounded-b-lg">
                        <div className="w-full h-full rounded-lg overflow-hidden">
                            {/* Use object tag instead of iframe for better PDF support */}
                            <object
                                data={state.url}
                                type="application/pdf"
                                className="w-full h-full rounded-lg"
                                onError={(e) => {
                                    console.error('PDF object failed to load:', e);

                                    // Create a fallback div with a download link
                                    const obj = e.target as HTMLObjectElement;
                                    const container = obj.parentElement;

                                    if (container) {
                                        container.innerHTML = `
                                            <div class="flex flex-col items-center justify-center h-full bg-base-200 p-6 text-center">
                                                <div class="bg-warning/20 p-4 rounded-full mb-4">
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                </div>
                                                <h3 class="text-lg font-semibold mb-2">PDF Preview Unavailable</h3>
                                                <p class="text-base-content/70 mb-4">The PDF cannot be displayed in the browser due to security restrictions.</p>
                                                <a href="${state.url}" download="${state.filename}" class="btn btn-primary gap-2">
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                    Download PDF Instead
                                                </a>
                                            </div>
                                        `;
                                    }
                                }}
                            >
                                <div className="flex flex-col items-center justify-center h-full bg-base-200 p-6 text-center">
                                    <div className="bg-warning/20 p-4 rounded-full mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold mb-2">PDF Preview Unavailable</h3>
                                    <p className="text-base-content/70 mb-4">Your browser cannot display this PDF or it failed to load.</p>
                                    <a href={state.url} download={state.filename} className="btn btn-primary gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Download PDF Instead
                                    </a>
                                </div>
                            </object>
                        </div>
                    </div>
                )}

                {!state.loading && !state.error && state.content && state.content.startsWith('document-') && (
                    <div className="flex flex-col items-center justify-center bg-base-200 p-8 rounded-b-lg">
                        <div className="bg-primary/10 p-6 rounded-full mb-6">
                            <Icon
                                icon={
                                    state.content === 'document-spreadsheet'
                                        ? "mdi:file-excel"
                                        : state.content === 'document-presentation'
                                            ? "mdi:file-powerpoint"
                                            : "mdi:file-word"
                                }
                                className="h-16 w-16 text-primary"
                            />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">{state.filename}</h3>
                        <p className="text-base-content/70 mb-6 text-center max-w-md">
                            This document cannot be previewed in the browser. Please download it to view its contents.
                        </p>
                        <a
                            href={state.url}
                            download={state.filename}
                            className="btn btn-primary btn-lg gap-2"
                        >
                            <Icon icon="mdi:download" className="h-5 w-5" />
                            Download {
                                state.content === 'document-spreadsheet'
                                    ? 'Spreadsheet'
                                    : state.content === 'document-presentation'
                                        ? 'Presentation'
                                        : 'Document'
                            }
                        </a>
                    </div>
                )}

                {!state.loading && !state.error && state.content && !['image', 'video', 'pdf'].includes(state.content) && (
                    <div className="overflow-x-auto max-h-[600px] bg-base-200">
                        <div className={`p-1 ${state.filename.toLowerCase().endsWith('.csv') ? 'p-4' : ''}`}>
                            {state.filename.toLowerCase().endsWith('.csv') ? (
                                <div dangerouslySetInnerHTML={{ __html: renderCSVTable(state.content) }} />
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
                                                    state.content.split('\n').slice(0, state.visibleLines).join('\n'),
                                                    getLanguageFromFilename(state.filename)
                                                )
                                            }}
                                        />
                                    </div>
                                    {state.content.split('\n').length > state.visibleLines && (
                                        <div className="flex justify-center p-2 border-t border-base-300 bg-base-200/50">
                                            {state.visibleLines < state.content.split('\n').length && (
                                                <button
                                                    className="btn btn-sm btn-ghost gap-1"
                                                    onClick={handleShowMore}
                                                >
                                                    <Icon icon="mdi:chevron-down" className="h-4 w-4" />
                                                    Show {Math.min(CHUNK_SIZE, state.content.split('\n').length - state.visibleLines)} more lines
                                                </button>
                                            )}
                                            {state.visibleLines > INITIAL_LINES_TO_SHOW && (
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