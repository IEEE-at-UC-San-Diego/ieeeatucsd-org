import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw, ExternalLink, RefreshCw, FileText, Image as ImageIcon } from 'lucide-react';
import { Button, Chip } from '@heroui/react';

interface ReceiptViewerProps {
    url: string;
    type?: string; // 'image/...' or 'application/pdf'
    fileName?: string;
    className?: string;
}

export default function ReceiptViewer({ url, type, fileName, className = '' }: ReceiptViewerProps) {
    const [zoomLevel, setZoomLevel] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [imageError, setImageError] = useState(false);

    const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
    const handleRotate = () => setRotation(prev => (prev + 90) % 360);
    const resetView = () => {
        setZoomLevel(1);
        setRotation(0);
    };

    // Enhanced PDF detection - check type prop, file extension, and URL path
    const isPdf = type?.includes('pdf') ||
        url?.toLowerCase().endsWith('.pdf') ||
        url?.toLowerCase().includes('.pdf?') || // Firebase Storage URLs with query params
        url?.toLowerCase().includes('/pdf/') ||
        url?.toLowerCase().includes('_pdf_') ||
        url?.toLowerCase().includes('%2Fpdf%2F'); // URL-encoded path

    if (!url) {
        return (
            <div className={`flex flex-col items-center justify-center p-8 bg-gray-100 rounded-xl border border-gray-200 text-gray-400 h-full min-h-[300px] ${className}`}>
                <FileText className="w-12 h-12 mb-3 opacity-50" />
                <p>No receipt file available</p>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full bg-gray-900 rounded-xl overflow-hidden border border-gray-800 ${className}`}>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
                <div className="flex items-center gap-2 overflow-hidden">
                    {isPdf ? (
                        <FileText className="w-4 h-4 text-red-400 flex-shrink-0" />
                    ) : (
                        <ImageIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    )}
                    <span className="text-gray-300 text-xs font-medium truncate max-w-[150px]" title={fileName}>
                        {fileName || 'Receipt Preview'}
                    </span>
                    <Chip size="sm" variant="flat" className="text-[10px] h-5 ml-2">
                        {isPdf ? 'PDF' : 'Image'}
                    </Chip>
                </div>
                <div className="flex items-center gap-1">
                    {!isPdf && (
                        <>
                            <Button isIconOnly size="sm" variant="light" className="text-gray-400 hover:text-white" onClick={handleZoomOut}>
                                <ZoomOut className="w-4 h-4" />
                            </Button>
                            <span className="text-gray-500 text-xs w-8 text-center">{Math.round(zoomLevel * 100)}%</span>
                            <Button isIconOnly size="sm" variant="light" className="text-gray-400 hover:text-white" onClick={handleZoomIn}>
                                <ZoomIn className="w-4 h-4" />
                            </Button>
                            <Button isIconOnly size="sm" variant="light" className="text-gray-400 hover:text-white" onClick={handleRotate}>
                                <RotateCw className="w-4 h-4" />
                            </Button>
                            <Button isIconOnly size="sm" variant="light" className="text-gray-400 hover:text-white" onClick={resetView} title="Reset View">
                                <RefreshCw className="w-3 h-3" />
                            </Button>
                        </>
                    )}
                    <div className="w-px h-4 bg-gray-700 mx-1" />
                    <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="text-gray-400 hover:text-blue-400"
                        onClick={() => window.open(url, '_blank')}
                        title="Open in new tab"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Content Viewer */}
            <div className="flex-1 overflow-hidden relative bg-gray-900/50 flex items-center justify-center">
                {isPdf ? (
                    <div className="w-full h-full relative">
                        <iframe
                            src={url}
                            className="w-full h-full border-0"
                            title="PDF Receipt"
                        />
                    </div>
                ) : (
                    <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
                        {!imageError ? (
                            <img
                                src={url}
                                alt="Receipt"
                                className="max-w-full max-h-full object-contain shadow-lg transition-transform duration-200 ease-out origin-center block"
                                style={{
                                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`
                                }}
                                onError={() => setImageError(true)}
                            />
                        ) : (
                            <div className="text-center text-gray-400 flex flex-col items-center gap-4">
                                <ImageIcon className="w-12 h-12 opacity-50" />
                                <div>
                                    <p className="mb-2">Failed to load image.</p>
                                    <Button
                                        size="sm"
                                        variant="flat"
                                        color="primary"
                                        onClick={() => window.open(url, '_blank')}
                                    >
                                        Try opening directly
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
