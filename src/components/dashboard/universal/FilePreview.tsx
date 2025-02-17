import { useEffect, useState, useCallback, useMemo } from 'react';
import { Icon } from "@iconify/react";
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

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
    const [isExpanded, setIsExpanded] = useState(false);
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
        if (isVisible || !isModal) { // Load content immediately if not in modal
            loadContent();
        }
    }, [isVisible, loadContent, isModal]);

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
            default:
                return extension || 'plaintext';
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

    const highlightCode = useCallback((code: string, language: string) => {
        // Skip highlighting for CSV
        if (language === 'csv') {
            return code;
        }

        try {
            return hljs.highlight(code, { language }).value;
        } catch (error) {
            console.warn(`Failed to highlight code for language ${language}:`, error);
            return code;
        }
    }, []);

    const formatCodeWithLineNumbers = useCallback((code: string, language: string) => {
        // Special handling for CSV files
        if (language === 'csv') {
            return renderCSVTable(code);
        }

        const lines = code.split('\n');
        const totalLines = lines.length;
        const linesToShow = Math.min(visibleLines, totalLines);

        let formattedCode = lines
            .slice(0, linesToShow)
            .map((line, index) => {
                const lineNumber = index + 1;
                const highlightedLine = highlightCode(line, language);
                return `<div class="table-row ">
                    <div class="table-cell text-right  pr-4 select-none text-base-content/50 text-sm border-r border-base-content/10">${lineNumber}</div>
                    <div class="table-cell pl-4 whitespace-pre">${highlightedLine || ' '}</div>
                </div>`;
            })
            .join('');

        if (linesToShow < totalLines) {
            formattedCode += `<div class="table-row ">
                <div class="table-cell"></div>
                <div class="table-cell pl-4 pt-2 text-base-content/70">... ${totalLines - linesToShow} more lines</div>
            </div>`;
        }

        return formattedCode;
    }, [highlightCode, visibleLines, renderCSVTable]);

    const handleShowMore = useCallback(() => {
        setVisibleLines(prev => Math.min(prev + CHUNK_SIZE, content?.split('\n').length || 0));
    }, [content]);

    const handleShowLess = useCallback(() => {
        setVisibleLines(INITIAL_LINES_TO_SHOW);
    }, []);

    return (
        <div className="file-preview-container space-y-4">
            {!loading && !error && content === 'image' && (
                <div>
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
                    <div className="flex justify-center bg-base-200 p-4 rounded-b-lg">
                        <img
                            src={url}
                            alt={filename}
                            className="max-w-full h-auto rounded-lg"
                            loading="lazy"
                        />
                    </div>
                </div>
            )}

            {!loading && !error && content === 'video' && (
                <div>
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
                    <div className="flex justify-center bg-base-200 p-4 rounded-b-lg">
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
                </div>
            )}

            {!loading && !error && content === 'pdf' && (
                <div>
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
                    <div className="w-full h-[600px] bg-base-200 p-4 rounded-b-lg">
                        <iframe
                            src={url}
                            className="w-full h-full rounded-lg"
                            title={filename}
                            loading="lazy"
                        ></iframe>
                    </div>
                </div>
            )}

            {!loading && !error && content && !['image', 'video', 'pdf'].includes(content) && (
                <div>
                    <div className="flex justify-between items-center bg-base-200 p-3 rounded-t-lg">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="truncate font-medium" title={filename}>{truncatedFilename}</span>
                            {fileType && (
                                <span className="badge badge-sm whitespace-nowrap">{fileType.split('/')[1]}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {content && content.split('\n').length > visibleLines && (
                                <button
                                    onClick={handleShowMore}
                                    className="btn btn-sm btn-ghost"
                                >
                                    Show More
                                </button>
                            )}
                            {visibleLines > INITIAL_LINES_TO_SHOW && (
                                <button
                                    onClick={handleShowLess}
                                    className="btn btn-sm btn-ghost"
                                >
                                    Show Less
                                </button>
                            )}
                            <button
                                onClick={handleDownload}
                                className="btn btn-sm btn-ghost gap-2 whitespace-nowrap"
                            >
                                <Icon icon="mdi:download" className="h-4 w-4" />
                                Download
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-[600px] bg-base-200">
                        <div className={`p-1 ${filename.toLowerCase().endsWith('.csv') ? 'p-4' : ''}`}>
                            <div
                                className={filename.toLowerCase().endsWith('.csv') ? '' : 'hljs table w-full font-mono text-sm rounded-lg py-4 px-2'}
                                dangerouslySetInnerHTML={{
                                    __html: formatCodeWithLineNumbers(content, getLanguageFromFilename(filename))
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

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
                </div>
            )}
        </div>
    );
} 