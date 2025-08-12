import React, { useState, useEffect, useRef } from 'react';
import {
    ExternalLink,
    Loader2,
    RefreshCw,
    AlertCircle
} from 'lucide-react';
import type { Constitution, ConstitutionSection } from '../../shared/types/firestore';
import { getSectionHierarchy } from './utils/constitutionUtils';



interface PDFPreviewProps {
    constitution: Constitution | null;
    sections: ConstitutionSection[];
    onPrint: () => void;
    currentPage?: number; // Optional since PDF viewer handles navigation
    onPageChange?: (page: number) => void; // Optional since PDF viewer handles navigation
    highlightedSectionId?: string;
}

const PDFPreview: React.FC<PDFPreviewProps> = ({
    constitution,
    sections,
    onPrint: _onPrint, // Unused but kept for interface compatibility
    currentPage: _currentPage, // Unused since PDF viewer handles navigation
    onPageChange: _onPageChange, // Unused since PDF viewer handles navigation
    highlightedSectionId: _highlightedSectionId = '' // Unused in PDF preview
}) => {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const lastSectionsHash = useRef<string>('');

    // Generate a hash of sections to detect changes
    const getSectionsHash = (sections: ConstitutionSection[]) => {
        return JSON.stringify(sections.map(s => ({ id: s.id, content: s.content, order: s.order })));
    };

    // Auto-regenerate PDF when sections or constitution change
    useEffect(() => {
        const sectionsHash = getSectionsHash(sections);
        if (sectionsHash !== lastSectionsHash.current && sections.length > 0) {
            lastSectionsHash.current = sectionsHash;
            // Add a small delay to avoid too frequent regeneration during rapid edits
            const timeoutId = setTimeout(() => {
                generatePDF();
            }, 1000); // 1 second delay

            return () => clearTimeout(timeoutId);
        }
    }, [sections, constitution]);

    const generatePDF = async () => {
        if (!sections.length) return;

        setIsGenerating(true);
        setError(null);

        try {
            // Clean up previous PDF URL
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
                setPdfUrl(null);
            }

            const response = await fetch('/api/export-pdf-puppeteer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    constitution,
                    sections: getSectionHierarchy(sections),
                    options: {
                        printBackground: true,
                        format: 'Letter',
                        margin: {
                            top: "1in",
                            right: "1in",
                            bottom: "1in",
                            left: "1in"
                        }
                    },
                }),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`PDF generation failed: ${response.status} ${errText}`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);

        } catch (err) {
            console.error('PDF generation failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to generate PDF');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRefresh = () => {
        generatePDF();
    };

    const handleOpenInNewTab = () => {
        if (pdfUrl) {
            window.open(pdfUrl, '_blank', 'noopener,noreferrer');
        }
    };

    // Clean up PDF URL on unmount
    useEffect(() => {
        return () => {
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
            }
        };
    }, [pdfUrl]);

    if (isGenerating) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                <p className="text-gray-600">Generating PDF preview...</p>
                <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-red-50 rounded-lg">
                <AlertCircle className="w-8 h-8 text-red-600 mb-4" />
                <p className="text-red-800 font-medium mb-2">Failed to generate PDF preview</p>
                <p className="text-red-600 text-sm mb-4">{error}</p>
                <button
                    onClick={handleRefresh}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                </button>
            </div>
        );
    }

    if (!pdfUrl) {
        return (
            <div className="flex flex-col items-center justify-center h-96 bg-gray-50 rounded-lg">
                <p className="text-gray-600 mb-4">No PDF preview available</p>
                <button
                    onClick={handleRefresh}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Generate Preview
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header with controls */}
            <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
                <div className="flex items-center space-x-4">
                    <h3 className="text-lg font-semibold text-gray-900">PDF Preview</h3>
                    <span className="text-sm text-gray-500">
                        Live preview - updates automatically
                    </span>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleRefresh}
                        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Refresh PDF"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>

                    <button
                        onClick={handleOpenInNewTab}
                        className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open in New Tab
                    </button>
                </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 bg-gray-100">
                <iframe
                    ref={iframeRef}
                    src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                    className="w-full h-full border-0"
                    title="Constitution PDF Preview"
                    loading="lazy"
                />
            </div>
        </div>
    );
};

export default PDFPreview;
