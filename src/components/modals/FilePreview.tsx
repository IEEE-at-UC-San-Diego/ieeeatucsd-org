import React from 'react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

interface FilePreviewProps {
    url: string;
    filename: string;
    id?: string;
}

type JSXElement = React.ReactElement;

const FilePreview: React.FC<FilePreviewProps> = ({ url: initialUrl, filename: initialFilename, id }) => {
    const [url, setUrl] = React.useState(initialUrl);
    const [filename, setFilename] = React.useState(initialFilename);
    const [visibleLines, setVisibleLines] = React.useState(20);
    const elementRef = React.useRef<HTMLDivElement>(null);

    // Constants for text preview
    const INITIAL_LINES = 20;
    const INCREMENT_LINES = 50;
    const MAX_CHARS_PER_LINE = 120;
    const TRUNCATION_MESSAGE = '...';

    // Determine file type from extension
    const fileExtension = filename.split('.').pop()?.toLowerCase() || '';

    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension);
    const isPDF = fileExtension === 'pdf';
    const isCode = [
        'py', 'js', 'jsx', 'ts', 'tsx', 'html', 'htm', 'css', 'scss',
        'java', 'c', 'cpp', 'cs', 'go', 'rs', 'sql', 'php', 'rb',
        'swift', 'kt', 'sh', 'bash', 'yaml', 'yml', 'json', 'md',
        'astro', 'vue', 'svelte', 'xml', 'toml', 'ini', 'env',
        'graphql', 'prisma', 'dockerfile', 'nginx'
    ].includes(fileExtension);
    const isText = isCode || ['txt', 'log', 'csv'].includes(fileExtension);
    const isVideo = ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(fileExtension);
    const isAudio = ['mp3', 'wav', 'm4a', 'ogg'].includes(fileExtension);

    // Function to highlight code using highlight.js
    const highlightCode = (code: string, language?: string): string => {
        if (!language) return code;
        try {
            return hljs.highlight(code, { language }).value;
        } catch (error) {
            console.warn(`Failed to highlight code for language ${language}:`, error);
            return code;
        }
    };

    // Function to get the appropriate language for highlight.js
    const getHighlightLanguage = (ext: string): string | undefined => {
        // Map file extensions to highlight.js languages
        const languageMap: { [key: string]: string } = {
            'py': 'python',
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'html': 'html',
            'htm': 'html',
            'css': 'css',
            'scss': 'scss',
            'java': 'java',
            'c': 'c',
            'cpp': 'cpp',
            'cs': 'csharp',
            'go': 'go',
            'rs': 'rust',
            'sql': 'sql',
            'php': 'php',
            'rb': 'ruby',
            'swift': 'swift',
            'kt': 'kotlin',
            'sh': 'bash',
            'bash': 'bash',
            'yaml': 'yaml',
            'yml': 'yaml',
            'json': 'json',
            'md': 'markdown',
            'xml': 'xml',
            'toml': 'ini',
            'ini': 'ini',
            'dockerfile': 'dockerfile',
            'prisma': 'prisma',
            'graphql': 'graphql'
        };
        return languageMap[ext];
    };

    // Function to truncate text content
    const truncateContent = (text: string, maxLines: number): string => {
        const lines = text.split('\n');
        if (lines.length <= maxLines) return text;

        const truncatedLines = lines.slice(0, maxLines).map(line =>
            line.length > MAX_CHARS_PER_LINE
                ? line.slice(0, MAX_CHARS_PER_LINE) + '...'
                : line
        );
        return truncatedLines.join('\n') + '\n' + TRUNCATION_MESSAGE;
    };

    // Reset visible lines when file changes
    React.useEffect(() => {
        setVisibleLines(INITIAL_LINES);
    }, [url]);

    // Function to show more lines
    const showMoreLines = () => {
        setVisibleLines(prev => prev + INCREMENT_LINES);
    };

    // Function to reset to initial view
    const resetView = () => {
        setVisibleLines(INITIAL_LINES);
    };

    // Listen for custom events to update the preview
    React.useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const handleUpdatePreview = (e: CustomEvent<{ url: string; filename: string }>) => {
            setUrl(e.detail.url);
            setFilename(e.detail.filename);
        };

        element.addEventListener('updateFilePreview', handleUpdatePreview as EventListener);
        return () => {
            element.removeEventListener('updateFilePreview', handleUpdatePreview as EventListener);
        };
    }, []);

    // Update state when props change
    React.useEffect(() => {
        setUrl(initialUrl);
        setFilename(initialFilename);
    }, [initialUrl, initialFilename]);

    // For text files, we need to fetch and display the content
    const [textContent, setTextContent] = React.useState<string>('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        async function fetchTextContent() {
            if (!isText) return;

            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(url);
                const text = await response.text();
                setTextContent(text);
            } catch (err) {
                setError('Failed to load text content');
                console.error('Error fetching text content:', err);
            } finally {
                setIsLoading(false);
            }
        }

        if (isText) {
            fetchTextContent();
        }
    }, [url, isText]);

    // Function to parse CSV text into array
    const parseCSV = (text: string): string[][] => {
        const rows = text.split(/\r?\n/).filter(row => row.trim());
        return rows.map(row => {
            // Handle both quoted and unquoted CSV
            const matches = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
            return matches.map(cell => cell.replace(/^"|"$/g, '').trim());
        });
    };

    // Function to format JSON with syntax highlighting
    const formatJSON = (text: string): string => {
        try {
            const parsed = JSON.parse(text);
            return highlightCode(JSON.stringify(parsed, null, 2), 'json');
        } catch {
            return text; // Return original text if not valid JSON
        }
    };

    // Function to render CSV as table
    const renderCSVTable = (csvData: string[][]): JSXElement => {
        if (csvData.length === 0) return <p>No data</p>;

        const headers = csvData[0];
        const allRows = csvData.slice(1);
        const rows = allRows.slice(0, visibleLines);
        const remainingRows = allRows.length - visibleLines;
        const hasMore = remainingRows > 0;

        return (
            <div className="space-y-4">
                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                    <table className="table table-zebra w-full">
                        <thead className="sticky top-0 z-10">
                            <tr>
                                {headers.map((header, i) => (
                                    <th key={i} className="bg-base-200">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={i}>
                                    {row.map((cell, j) => (
                                        <td key={j}>{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="text-center space-y-2">
                    {hasMore && (
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={showMoreLines}
                        >
                            Show More ({Math.min(remainingRows, INCREMENT_LINES)} of {remainingRows} rows)
                        </button>
                    )}
                    {visibleLines > INITIAL_LINES && (
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={resetView}
                        >
                            Reset View
                        </button>
                    )}
                </div>
            </div>
        );
    };

    // Function to render text content based on file type
    const renderTextContent = (): JSXElement => {
        if (!textContent) return <p>No content</p>;

        if (fileExtension === 'csv') {
            const csvData = parseCSV(textContent);
            return renderCSVTable(csvData);
        }

        const lines = textContent.split('\n');
        const content = truncateContent(textContent, visibleLines);
        const remainingLines = lines.length - visibleLines;
        const hasMore = remainingLines > 0;

        const renderContent = () => {
            if (isCode) {
                const language = getHighlightLanguage(fileExtension);
                const highlightedCode = highlightCode(content, language);
                return (
                    <code
                        className="text-sm font-mono"
                        dangerouslySetInnerHTML={{ __html: highlightedCode }}
                    />
                );
            }

            return <code className="text-sm font-mono">{content}</code>;
        };

        return (
            <div className="space-y-4">
                <div className="max-h-[60vh] overflow-y-auto">
                    <pre className="whitespace-pre-wrap bg-base-200 p-4 rounded-lg overflow-x-auto">
                        {renderContent()}
                    </pre>
                </div>
                <div className="text-center space-y-2">
                    {hasMore && (
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={showMoreLines}
                        >
                            Show More ({Math.min(remainingLines, INCREMENT_LINES)} of {remainingLines} lines)
                        </button>
                    )}
                    {visibleLines > INITIAL_LINES && (
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={resetView}
                        >
                            Reset View
                        </button>
                    )}
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div ref={elementRef} id={id} className="flex justify-center items-center p-8">
                <span className="loading loading-spinner loading-lg"></span>
            </div>
        );
    }

    if (error) {
        return (
            <div ref={elementRef} id={id} className="alert alert-error">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
            </div>
        );
    }

    if (isImage) {
        return (
            <div ref={elementRef} id={id} className="relative w-full max-h-[60vh] overflow-y-auto">
                <img
                    src={url}
                    alt={filename}
                    className="max-w-full h-auto rounded-lg"
                    onError={() => setError('Failed to load image')}
                />
            </div>
        );
    }

    if (isPDF) {
        return (
            <div ref={elementRef} id={id} className="relative w-full h-[60vh]">
                <iframe
                    src={url}
                    className="w-full h-full rounded-lg"
                    title={filename}
                />
            </div>
        );
    }

    if (isVideo) {
        return (
            <div ref={elementRef} id={id} className="relative w-full max-h-[60vh]">
                <video
                    controls
                    className="w-full rounded-lg"
                    onError={() => setError('Failed to load video')}
                >
                    <source src={url} type={`video/${fileExtension}`} />
                    Your browser does not support the video tag.
                </video>
            </div>
        );
    }

    if (isAudio) {
        return (
            <div ref={elementRef} id={id} className="relative w-full">
                <audio
                    controls
                    className="w-full"
                    onError={() => setError('Failed to load audio')}
                >
                    <source src={url} type={`audio/${fileExtension}`} />
                    Your browser does not support the audio tag.
                </audio>
            </div>
        );
    }

    if (isText) {
        return (
            <div ref={elementRef} id={id} className="relative w-full">
                {renderTextContent()}
            </div>
        );
    }

    // Default case for unsupported file types
    return (
        <div ref={elementRef} id={id} className="text-center py-8">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 mx-auto mb-4 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
            </svg>
            <p className="text-base-content/70">Preview not available for this file type</p>
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm mt-4"
            >
                Download File
            </a>
        </div>
    );
};

export default FilePreview;
