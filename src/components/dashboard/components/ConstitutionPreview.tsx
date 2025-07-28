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
    const previewRef = useRef<HTMLDivElement>(null);

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
        <div className="constitution-page min-h-screen p-12 text-center flex flex-col justify-center relative">
            {/* Logo */}
            <div className="mb-12">
                <img
                    src="/logos/blue_logo_only.png"
                    alt="IEEE Logo"
                    className="w-32 h-32 mx-auto"
                    onError={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                    }}
                />
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center hidden">
                    <span className="text-white font-bold text-2xl">IEEE</span>
                </div>
            </div>

            <h1 className="text-5xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Arial, sans-serif', fontSize: '28pt', textAlign: 'center', lineHeight: '1.1' }}>
                IEEE at UC San Diego
            </h1>

            <h2 className="text-2xl font-semibold text-gray-700 mb-8" style={{ fontFamily: 'Arial, sans-serif', fontSize: '16pt', textAlign: 'center', lineHeight: '1.3' }}>
                The Institute of Electrical and Electronics Engineers at UC San Diego Constitution
            </h2>

            <div className="mt-8" style={{ textAlign: 'center' }}>
                <p className="text-lg text-gray-600 mb-2" style={{ fontFamily: 'Arial, sans-serif', fontSize: '14pt', textAlign: 'center', textIndent: '0' }}>
                    Last Updated: {new Date().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}
                </p>
                <p className="text-sm text-gray-500" style={{ fontFamily: 'Arial, sans-serif', fontSize: '12pt', textAlign: 'center', textIndent: '0' }}>
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
                <div className="constitution-page p-12 text-center">
                    <div className="text-gray-500">Page not found</div>
                </div>
            );
        }

        return (
            <div className="constitution-page p-12 relative">
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
        <div className={`bg-white constitution-document ${pdfCaptureMode ? 'pdf-capture-mode' : 'shadow-lg'}`} style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: '12pt',
            lineHeight: '1.6',
            width: '8.5in',
            margin: pdfCaptureMode ? '0' : '0 auto'
        }}>
            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                    .constitution-page {
                        width: 8.5in;
                        min-height: 11in;
                        height: 11in;
                        padding: 1in;
                        margin: ${pdfCaptureMode ? '0' : '0 auto 20px auto'};
                        background: white;
                        box-shadow: ${pdfCaptureMode ? 'none' : '0 4px 6px rgba(0, 0, 0, 0.1)'};
                        position: relative;
                        font-family: Arial, sans-serif;
                        font-size: 12pt;
                        line-height: 1.6;
                        box-sizing: border-box;
                        page-break-inside: avoid;
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
                        font-size: 24pt;
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
                    
                    .toc-entry.indent-1 {
                        margin-left: 24px;
                    }
                    
                    .toc-dots {
                        flex: 1;
                        border-bottom: 1px dotted #333;
                        margin: 0 8px;
                        height: 1em;
                    }
                    
                    .image-placeholder {
                        border: 2px dashed #ccc;
                        padding: 24px;
                        text-align: center;
                        margin: 16px 0;
                        background: #f9f9f9;
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
                    
                    @media print {
                        .no-print { display: none !important; }
                        .constitution-page { 
                            page-break-after: always; 
                            margin: 0;
                            box-shadow: none;
                        }
                        .constitution-page:last-child { page-break-after: avoid; }
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
                        .page-indicator { display: none; }
                    }
                `
            }} />

            {/* Page Navigation Header */}
            {!pdfCaptureMode && (
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