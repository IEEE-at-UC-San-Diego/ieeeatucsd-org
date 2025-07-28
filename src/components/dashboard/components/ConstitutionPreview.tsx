import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import type { Constitution, ConstitutionSection } from '../types/firestore';
import { generateContentPages, generateTableOfContents } from '../utils/printUtils';
import { getSectionDisplayTitle, toRomanNumeral } from '../utils/constitutionUtils';
import SectionRenderer from './SectionRenderer';
import PageNavigationHandler from './PageNavigationHandler';
import PreviewModeToggle from './PreviewModeToggle';

interface ConstitutionPreviewProps {
    constitution: Constitution | null;
    sections: ConstitutionSection[];
    onPrint: () => void;
    currentPage: number;
    onPageChange: (page: number) => void;
    pdfCaptureMode?: boolean;
    enableExportOptimizations?: boolean;
}

const ConstitutionPreview: React.FC<ConstitutionPreviewProps> = ({
    constitution,
    sections,
    onPrint,
    currentPage,
    onPageChange,
    pdfCaptureMode = false,
    enableExportOptimizations = false
}) => {
    const [showTableOfContents, setShowTableOfContents] = useState(true);
    const [internalPdfCaptureMode, setInternalPdfCaptureMode] = useState(pdfCaptureMode);
    const previewRef = useRef<HTMLDivElement>(null);

    // Use internal state if pdfCaptureMode prop is not controlled externally
    const effectivePdfCaptureMode = pdfCaptureMode !== undefined ? pdfCaptureMode : internalPdfCaptureMode;

    // Local implementation of calculateTotalPages as fallback
    const calculateTotalPages = (sections: ConstitutionSection[], showTOC: boolean) => {
        let pageCount = 1; // Cover page
        if (showTOC) pageCount++; // TOC page

        // Content pages
        const preamble = sections.find(s => s.type === 'preamble');
        if (preamble) pageCount++;

        const articles = sections.filter(s => s.type === 'article');
        pageCount += articles.length;

        const amendments = sections.filter(s => s.type === 'amendment');
        pageCount += amendments.length;

        return pageCount;
    };

    const totalPages = calculateTotalPages(sections, showTableOfContents);

    const renderCurrentPage = () => {
        if (currentPage === 1) {
            return renderCoverPage();
        } else if (currentPage === 2 && showTableOfContents) {
            return renderTableOfContentsPage();
        } else {
            const contentPageIndex = showTableOfContents ? currentPage - 3 : currentPage - 2;
            return renderContentPage(contentPageIndex);
        }
    };

    const renderCoverPage = () => (
        <div className="constitution-page" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'center',
            position: 'relative'
        }}>
            {/* Logo */}
            <div style={{ margin: '48px 0', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
                <img
                    src="/blue_logo_only.png"
                    alt="IEEE Logo"
                    style={{
                        width: '120px',
                        height: '120px',
                        objectFit: 'contain',
                        display: 'block',
                        margin: '0 auto'
                    }}
                />
            </div>

            <h1 style={{
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '28pt',
                textAlign: 'center',
                lineHeight: '1.1',
                fontWeight: 'bold',
                color: '#000',
                marginBottom: '24px'
            }}>
                IEEE at UC San Diego
            </h1>

            <h2 style={{
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '16pt',
                textAlign: 'center',
                lineHeight: '1.3',
                fontWeight: '600',
                color: '#000',
                marginBottom: '48px'
            }}>
                The Institute of Electrical and Electronics Engineers at UC San Diego Constitution
            </h2>

            <div style={{ textAlign: 'center', marginTop: '48px' }}>
                <p style={{
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '14pt',
                    textAlign: 'center',
                    textIndent: '0',
                    marginBottom: '12px',
                    color: '#000'
                }}>
                    Last Updated: {new Date().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}
                </p>
                <p style={{
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '12pt',
                    textAlign: 'center',
                    textIndent: '0',
                    color: '#666'
                }}>
                    Version {constitution?.version || 1}
                </p>
            </div>
        </div>
    );

    const renderTableOfContentsPage = () => {
        const tableOfContents = generateTableOfContents(sections);

        return (
            <div className="constitution-page p-12 relative">
                <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center" style={{ fontFamily: 'Arial, sans-serif', fontSize: '18pt' }}>
                    Table of Contents
                </h2>

                <div className="space-y-2" style={{ fontSize: '14pt' }}>
                    {tableOfContents.map(({ section, pageNum }, index) => {
                        const getIndentClass = (section: ConstitutionSection) => {
                            if (section.type === 'section') return 'ml-6';
                            if (section.type === 'subsection') {
                                // Calculate nesting depth for subsections
                                let depth = 1; // Start at 1 for first level subsections
                                let currentParentId = section.parentId;

                                while (currentParentId) {
                                    const parent = sections.find(s => s.id === currentParentId);
                                    if (parent && parent.type === 'subsection') {
                                        depth++;
                                        currentParentId = parent.parentId;
                                    } else if (parent && parent.type === 'section') {
                                        depth++; // Add one more for being under a section
                                        break;
                                    } else {
                                        break;
                                    }
                                }
                                // Use predefined Tailwind classes based on depth
                                const indentClasses = ['ml-6', 'ml-12', 'ml-16', 'ml-20', 'ml-24'];
                                return indentClasses[Math.min(depth, indentClasses.length - 1)] || 'ml-24';
                            }
                            return '';
                        };

                        const getDisplayTitle = (section: ConstitutionSection) => {
                            if (section.type === 'preamble') return 'Preamble';
                            if (section.type === 'article') {
                                const articles = sections.filter(s => s.type === 'article').sort((a, b) => (a.order || 0) - (b.order || 0));
                                const articleIndex = articles.findIndex(a => a.id === section.id) + 1;
                                return `Article ${toRomanNumeral(articleIndex)} - ${section.title}`;
                            }
                            if (section.type === 'section') {
                                const siblingSections = sections.filter(s => s.parentId === section.parentId && s.type === 'section').sort((a, b) => (a.order || 0) - (b.order || 0));
                                const sectionIndex = siblingSections.findIndex(s => s.id === section.id) + 1;
                                return `Section ${sectionIndex} - ${section.title}`;
                            }
                            if (section.type === 'amendment') {
                                const amendments = sections.filter(s => s.type === 'amendment').sort((a, b) => (a.order || 0) - (b.order || 0));
                                const amendmentIndex = amendments.findIndex(a => a.id === section.id) + 1;
                                return `Amendment ${amendmentIndex}`;
                            }
                            return getSectionDisplayTitle(section, sections);
                        };

                        return (
                            <div key={section.id} className="flex justify-between items-start">
                                <div className={`flex-1 ${getIndentClass(section)}`}>
                                    <span className="text-gray-900">
                                        {getDisplayTitle(section)}
                                    </span>
                                </div>
                                <div className="flex-shrink-0 ml-4">
                                    <span className="text-gray-700">{pageNum}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderContentPage = (pageIndex: number) => {
        const contentPages = generateContentPages(sections);
        const page = contentPages[pageIndex];

        if (!page) {
            return (
                <div className="constitution-page" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center'
                }}>
                    <div style={{ color: '#666', fontFamily: 'Arial, sans-serif', fontSize: '12pt' }}>
                        Page not found
                    </div>
                </div>
            );
        }

        return (
            <div className="constitution-page" style={{ position: 'relative' }}>
                {page.map((section, index) => (
                    <SectionRenderer
                        key={section.id}
                        section={section}
                        allSections={sections}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className={`bg-white constitution-document ${effectivePdfCaptureMode ? 'pdf-capture-mode' : 'shadow-lg'}`} style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: '11pt',
            lineHeight: '1.5',
            width: '8.5in',
            margin: effectivePdfCaptureMode ? '0' : '0 auto'
        }}>
            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                    * {
                        box-sizing: border-box;
                    }
                    
                    .constitution-page {
                        page-break-after: always;
                        width: 8.5in;
                        height: 11in;
                        min-height: 11in;
                        padding: 1in;
                        margin: ${effectivePdfCaptureMode ? '0' : '0 auto 20px auto'};
                        background: white;
                        box-shadow: ${effectivePdfCaptureMode ? 'none' : '0 4px 6px rgba(0, 0, 0, 0.1)'};
                        position: relative;
                        font-family: Arial, sans-serif;
                        font-size: 11pt;
                        line-height: 1.5;
                        color: #444;  /* Softer dark gray */
                        box-sizing: border-box;
                    }
                    
                    .constitution-page:last-child {
                        page-break-after: avoid;
                    }
                    
                    .pdf-capture-mode .no-print {
                        display: none !important;
                    }
                    
                    .pdf-capture-mode .page-indicator {
                        display: none !important;
                    }
                    
                    .constitution-section {
                        margin-bottom: 24px;
                    }
                    
                    .constitution-page h1 {
                        font-family: Arial, sans-serif;
                        font-size: 28pt;
                        font-weight: bold;
                        text-align: center;
                        margin-bottom: 24px;
                        page-break-after: avoid;
                    }
                    
                    .constitution-page h2 {
                        font-family: Arial, sans-serif;
                        font-size: 18pt;
                        font-weight: bold;
                        text-align: center;
                        margin-top: 24px;
                        margin-bottom: 16px;
                        page-break-after: avoid;
                    }
                    
                    .constitution-page h3 {
                        font-family: Arial, sans-serif;
                        font-size: 14pt;
                        font-weight: bold;
                        margin-top: 16px;
                        margin-bottom: 12px;
                        page-break-after: avoid;
                    }
                    
                    .constitution-page h4, .constitution-page h5, .constitution-page h6 {
                        font-family: Arial, sans-serif;
                        font-size: 12pt;
                        font-weight: bold;
                        margin-top: 12px;
                        margin-bottom: 8px;
                        page-break-after: avoid;
                    }
                    
                    .constitution-page p {
                        font-family: Arial, sans-serif;
                        font-size: 12pt;
                        line-height: 1.6;
                        margin-bottom: 12px;
                        text-align: justify;
                        text-indent: 0.5in;
                        orphans: 2;
                        widows: 2;
                    }
                    
                    .toc-entry {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 6px;
                        text-indent: 0;
                        font-family: Arial, sans-serif;
                    }
                    
                    .image-placeholder {
                        border: 2px dashed #ccc;
                        padding: 24px;
                        text-align: center;
                        margin: 16px 0;
                        background: #f9f9f9;
                        page-break-inside: avoid;
                        font-family: Arial, sans-serif;
                    }
                    
                    .logo-container {
                        text-align: center;
                        margin: 48px 0;
                    }
                    
                    .logo-fallback {
                        width: 120px;
                        height: 120px;
                        background: linear-gradient(135deg, #1e40af, #3b82f6);
                        border-radius: 8px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 24pt;
                        font-weight: bold;
                        margin: 0 auto;
                        font-family: Arial, sans-serif;
                    }
                    
                    .page-indicator {
                        position: absolute;
                        top: 10px;
                        right: 20px;
                        background: #3b82f6;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 4px;
                        font-size: 10pt;
                        font-family: Arial, sans-serif;
                    }
                    
                    @media print {
                        .no-print { display: none !important; }
                        .page-indicator { display: none !important; }
                        .constitution-page {
                            page-break-after: always;
                            margin: 0 !important;
                            box-shadow: none !important;
                            width: 8.5in !important;
                            height: 11in !important;
                            min-height: 11in !important;
                            padding: 1in !important;
                            box-sizing: border-box !important;
                        }
                        .constitution-page:last-child { page-break-after: avoid; }
                        
                        body {
                            font-family: Arial, sans-serif !important;
                            font-size: 12pt !important;
                            line-height: 1.6 !important;
                            -webkit-print-color-adjust: exact !important;
                            color-adjust: exact !important;
                        }
                        
                        h1 { font-size: 28pt !important; font-family: Arial, sans-serif !important; }
                        h2 { font-size: 18pt !important; font-family: Arial, sans-serif !important; }
                        h3 { font-size: 14pt !important; font-family: Arial, sans-serif !important; }
                        p { font-size: 12pt !important; font-family: Arial, sans-serif !important; }
                    }
                `
            }} />

            {/* Page Navigation Header */}
            {!effectivePdfCaptureMode && (
                <div className="no-print bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                        </button>

                        <span className="text-sm text-gray-600">
                            Page {currentPage} of {totalPages}
                        </span>

                        <button
                            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </button>
                    </div>

                    {/* Preview Mode Toggle - only show if not externally controlled */}
                    {pdfCaptureMode === undefined && (
                        <PreviewModeToggle
                            pdfCaptureMode={internalPdfCaptureMode}
                            onToggle={setInternalPdfCaptureMode}
                        />
                    )}
                </div>
            )}

            {/* Current Page Content */}
            <div className="relative">
                {!pdfCaptureMode && <div className="page-indicator no-print">Page {currentPage}</div>}
                {renderCurrentPage()}
            </div>

            {/* Page Navigation Footer */}
            {!pdfCaptureMode && (
                <div className="no-print bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-center">
                    <div className="flex items-center gap-2">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                            <button
                                key={pageNum}
                                onClick={() => onPageChange(pageNum)}
                                className={`w-8 h-8 rounded text-sm font-medium transition-colors ${pageNum === currentPage
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                            >
                                {pageNum}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConstitutionPreview; 