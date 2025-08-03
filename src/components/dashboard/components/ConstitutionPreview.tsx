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
    printMode?: boolean;
    highlightedSectionId?: string;
}

const ConstitutionPreview: React.FC<ConstitutionPreviewProps> = ({
    constitution,
    sections,
    onPrint,
    currentPage,
    onPageChange,
    pdfCaptureMode = false,
    enableExportOptimizations = false,
    printMode = false,
    highlightedSectionId = ''
}) => {
    const [showTableOfContents, setShowTableOfContents] = useState(true);
    const [internalPdfCaptureMode, setInternalPdfCaptureMode] = useState(pdfCaptureMode);
    const previewRef = useRef<HTMLDivElement>(null);

    // Use internal state if pdfCaptureMode prop is not controlled externally
    const effectivePdfCaptureMode = pdfCaptureMode !== undefined ? pdfCaptureMode : internalPdfCaptureMode;

    // Get the actual last modified date from constitution and sections
    const getLastModifiedDate = (): Date => {
        const timestamps: Date[] = [];

        // Add constitution's lastModified if it exists
        if (constitution?.lastModified) {
            timestamps.push(constitution.lastModified.toDate());
        }

        // Add all sections' lastModified timestamps
        sections.forEach(section => {
            if (section.lastModified) {
                timestamps.push(section.lastModified.toDate());
            }
        });

        // Return the most recent timestamp, or current date as fallback
        if (timestamps.length > 0) {
            return new Date(Math.max(...timestamps.map(date => date.getTime())));
        }

        return new Date(); // Fallback to current date if no timestamps found
    };

    // Local implementation of calculateTotalPages as fallback
    const calculateTotalPages = (sections: ConstitutionSection[], showTOC: boolean) => {
        let pageCount = 1; // Cover page

        if (showTOC) {
            // Calculate actual TOC pages needed
            const tableOfContents = generateTableOfContents(sections);
            const tocPagesNeeded = Math.ceil(tableOfContents.length / 25);
            pageCount += tocPagesNeeded;
        }

        // Content pages - use the actual page generation logic
        const contentPages = generateContentPages(sections);
        pageCount += contentPages.length;

        return pageCount;
    };

    const totalPages = calculateTotalPages(sections, showTableOfContents);

    const renderCurrentPage = () => {
        if (currentPage === 1) {
            return renderCoverPage();
        } else if (showTableOfContents) {
            // Calculate TOC pages needed
            const tableOfContents = generateTableOfContents(sections);
            const tocPagesNeeded = Math.ceil(tableOfContents.length / 25);

            if (currentPage >= 2 && currentPage <= 1 + tocPagesNeeded) {
                // This is a TOC page
                const tocPages = renderTableOfContentsPages();
                const tocPageIndex = currentPage - 2;
                return tocPages[tocPageIndex] || <div>TOC Page not found</div>;
            } else {
                // This is a content page
                const contentPageIndex = currentPage - 2 - tocPagesNeeded;
                return renderContentPage(contentPageIndex);
            }
        } else {
            const contentPageIndex = currentPage - 2;
            return renderContentPage(contentPageIndex);
        }
    };

    const renderAllPages = () => {
        const pages = [];

        // Cover page
        pages.push(
            <div key="cover-page">
                {renderCoverPage()}
            </div>
        );

        // Table of contents pages
        if (showTableOfContents) {
            const tocPages = renderTableOfContentsPages();
            tocPages.forEach((tocPage, index) => {
                pages.push(
                    <div key={`toc-page-${index}`}>
                        {tocPage}
                    </div>
                );
            });
        }

        // Content pages
        const contentPages = generateContentPages(sections);
        contentPages.forEach((page, index) => {
            pages.push(
                <div key={`content-page-${index}`}>
                    <div className="constitution-page" style={{ position: 'relative' }}>
                        {page.map((section) => (
                            <SectionRenderer
                                key={section.id}
                                section={section}
                                allSections={sections}
                                highlightedSectionId={highlightedSectionId}
                            />
                        ))}
                    </div>
                </div>
            );
        });

        return pages;
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
                marginBottom: '24px'
            }}>
                The Institute of Electrical and Electronics Engineers at UC San Diego Constitution
            </h2>

            <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <p style={{
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '14pt',
                    textAlign: 'center',
                    textIndent: '0',
                    marginBottom: '12px',
                    color: '#000'
                }}>
                    Last Updated: {getLastModifiedDate().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}
                </p>

                <p style={{
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '11pt',
                    textAlign: 'center',
                    textIndent: '0',
                    color: '#888',
                    marginTop: '8px'
                }}>
                    Adopted since September 2006
                </p>
            </div>
        </div>
    );

    const renderTableOfContentsPages = () => {
        const tableOfContents = generateTableOfContents(sections);
        const entriesPerPage = 25;
        const tocPages = [];

        for (let i = 0; i < tableOfContents.length; i += entriesPerPage) {
            const pageEntries = tableOfContents.slice(i, i + entriesPerPage);
            const pageNumber = Math.floor(i / entriesPerPage) + 1;
            const isFirstPage = pageNumber === 1;

            tocPages.push(
                <div key={`toc-page-${pageNumber}`} className="constitution-page p-12 relative">
                    {isFirstPage && (
                        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center" style={{ fontFamily: 'Arial, sans-serif', fontSize: '18pt' }}>
                            Table of Contents
                        </h2>
                    )}

                    {!isFirstPage && (
                        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center" style={{ fontFamily: 'Arial, sans-serif', fontSize: '18pt' }}>
                            Table of Contents (continued)
                        </h2>
                    )}

                    <div className="space-y-2" style={{ fontSize: '12pt' }}>
                        {pageEntries.map(({ section, pageNum }, index) => {
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
                                        <button
                                            onClick={() => onPageChange(pageNum)}
                                            className="text-left text-gray-900 hover:text-blue-600 hover:underline transition-colors cursor-pointer bg-transparent border-none p-0 font-inherit"
                                            style={{ fontSize: 'inherit', fontFamily: 'inherit' }}
                                        >
                                            {getDisplayTitle(section)}
                                        </button>
                                    </div>
                                    <div className="flex-shrink-0 ml-4">
                                        <button
                                            onClick={() => onPageChange(pageNum)}
                                            className="text-gray-700 hover:text-blue-600 hover:underline transition-colors cursor-pointer bg-transparent border-none p-0 font-inherit"
                                            style={{ fontSize: 'inherit', fontFamily: 'inherit' }}
                                        >
                                            {pageNum}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        return tocPages;
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
                        highlightedSectionId={highlightedSectionId}
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
                        max-height: 11in;
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
                        overflow: hidden; /* Prevent content overflow */
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
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    /* Prevent orphaned headings */
                    h1, h2, h3, h4, h5, h6 {
                        page-break-after: avoid;
                        break-after: avoid;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    /* Ensure paragraphs don't break awkwardly */
                    p {
                        orphans: 2;
                        widows: 2;
                        page-break-inside: avoid;
                        break-inside: avoid;
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
                        text-indent: 0;      /* Remove text indentation */
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
                        /* Hide all page elements except constitution content when in print mode */
                        body.constitution-print-mode * {
                            visibility: hidden !important;
                        }

                        body.constitution-print-mode .constitution-document,
                        body.constitution-print-mode .constitution-document *,
                        body.constitution-print-mode .print-only,
                        body.constitution-print-mode .print-only * {
                            visibility: visible !important;
                        }

                        body.constitution-print-mode {
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                        }

                        body.constitution-print-mode .constitution-document {
                            position: absolute !important;
                            top: 0 !important;
                            left: 0 !important;
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                        }

                        .no-print { display: none !important; }
                        .page-indicator { display: none !important; }
                        .print-only { display: block !important; }
                        .screen-only { display: none !important; }

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

                        /* Article titles (h2) - larger font size */
                        h1 { font-size: 28pt !important; font-family: Arial, sans-serif !important; }
                        h2 { font-size: 18pt !important; font-family: Arial, sans-serif !important; }

                        /* Section titles (h3) - smaller font size */
                        h3 { font-size: 12pt !important; font-family: Arial, sans-serif !important; }

                        /* Subsection titles (h4) - smallest font size */
                        h4 { font-size: 11pt !important; font-family: Arial, sans-serif !important; }

                        /* Body text */
                        p { font-size: 11pt !important; font-family: Arial, sans-serif !important; }
                    }

                    .print-only { display: none; }
                    .screen-only { display: block; }

                    @keyframes section-highlight-fade {
                        0% {
                            background-color: #fef08a;
                            border-color: #f59e0b;
                        }
                        100% {
                            background-color: transparent;
                            border-color: transparent;
                        }
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

            {/* Screen Content - Current Page Only */}
            <div className="relative screen-only">
                {!pdfCaptureMode && <div className="page-indicator no-print">Page {currentPage}</div>}
                {renderCurrentPage()}
            </div>

            {/* Print Content - All Pages */}
            <div className="print-only">
                {renderAllPages()}
            </div>

            {/* Page Navigation Footer */}
            {!pdfCaptureMode && (
                <div className="no-print bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-center">
                    <div className="flex items-center gap-2">
                        {/* Previous button */}
                        <button
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-200 text-gray-700 hover:bg-gray-300"
                        >
                            ‹
                        </button>

                        {/* Page numbers with smart truncation */}
                        {(() => {
                            const maxVisiblePages = 10;
                            const pages = [];

                            if (totalPages <= maxVisiblePages) {
                                // Show all pages if total is small
                                for (let i = 1; i <= totalPages; i++) {
                                    pages.push(i);
                                }
                            } else {
                                // Smart pagination with ellipsis
                                const startPage = Math.max(1, currentPage - 4);
                                const endPage = Math.min(totalPages, currentPage + 4);

                                if (startPage > 1) {
                                    pages.push(1);
                                    if (startPage > 2) pages.push('...');
                                }

                                for (let i = startPage; i <= endPage; i++) {
                                    pages.push(i);
                                }

                                if (endPage < totalPages) {
                                    if (endPage < totalPages - 1) pages.push('...');
                                    pages.push(totalPages);
                                }
                            }

                            return pages.map((pageNum, index) => {
                                if (pageNum === '...') {
                                    return (
                                        <span key={`ellipsis-${index}`} className="px-2 py-1 text-gray-500">
                                            ...
                                        </span>
                                    );
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => onPageChange(pageNum as number)}
                                        className={`w-8 h-8 rounded text-sm font-medium transition-colors ${pageNum === currentPage
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            });
                        })()}

                        {/* Next button */}
                        <button
                            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gray-200 text-gray-700 hover:bg-gray-300"
                        >
                            ›
                        </button>

                        {/* Page info */}
                        <span className="ml-4 text-sm text-gray-600">
                            Page {currentPage} of {totalPages}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConstitutionPreview; 