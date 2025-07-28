import type { Constitution, ConstitutionSection } from '../types/firestore';
import { toRomanNumeral, getSectionDisplayTitle } from './constitutionUtils';

export interface TableOfContentsEntry {
    section: ConstitutionSection;
    pageNum: number;
}

export const generateTableOfContents = (sections: ConstitutionSection[]): TableOfContentsEntry[] => {
    const toc: TableOfContentsEntry[] = [];
    let currentPageNum = 3; // Start after title page and TOC

    // Helper function to calculate content length for a section and all its children
    const getTotalContentLength = (sectionId: string): number => {
        const section = sections.find(s => s.id === sectionId);
        if (!section) return 0;
        
        let totalLength = section.content?.length || 0;
        
        // Add length of all child sections recursively
        const children = sections.filter(s => s.parentId === sectionId);
        children.forEach(child => {
            totalLength += getTotalContentLength(child.id);
        });
        
        return totalLength;
    };

    // Helper function to add subsections recursively to TOC
    const addSubsectionsToTOC = (parentId: string, currentPage: number): number => {
        const subsections = sections
            .filter(s => s.parentId === parentId && s.type === 'subsection')
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        subsections.forEach(subsection => {
            toc.push({ section: subsection, pageNum: currentPage });
            
            // Recursively add nested subsections
            currentPage = addSubsectionsToTOC(subsection.id, currentPage);
        });
        
        return currentPage;
    };

    // Preamble
    const preamble = sections.find(s => s.type === 'preamble');
    if (preamble) {
        toc.push({ section: preamble, pageNum: currentPageNum });
        currentPageNum++;
    }

    // Articles (each starts on new page)
    const articles = sections.filter(s => s.type === 'article').sort((a, b) => (a.order || 0) - (b.order || 0));
    articles.forEach(article => {
        toc.push({ section: article, pageNum: currentPageNum });

        // Sections within this article
        const articleSections = sections
            .filter(s => s.parentId === article.id && s.type === 'section')
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        articleSections.forEach(section => {
            toc.push({ section, pageNum: currentPageNum });
            
            // Add all subsections for this section
            addSubsectionsToTOC(section.id, currentPageNum);
        });

        // Calculate if this article needs multiple pages based on total content
        const totalArticleContent = getTotalContentLength(article.id);
        const estimatedPages = Math.ceil(totalArticleContent / 2000); // ~2000 chars per page
        currentPageNum += Math.max(1, estimatedPages);
    });

    // Amendments
    const amendments = sections.filter(s => s.type === 'amendment').sort((a, b) => (a.order || 0) - (b.order || 0));
    amendments.forEach(amendment => {
        toc.push({ section: amendment, pageNum: currentPageNum });
        
        // Each amendment gets its own page, but check if it needs multiple pages
        const contentLength = amendment.content?.length || 0;
        const estimatedPages = Math.ceil(contentLength / 2000);
        currentPageNum += Math.max(1, estimatedPages);
    });

    return toc;
};

export const calculateTotalPages = (sections: ConstitutionSection[], showTOC: boolean) => {
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

export const generateContentPages = (sections: ConstitutionSection[]): ConstitutionSection[][] => {
    const pages: ConstitutionSection[][] = [];

    // Group sections by type for proper page breaks
    const preamble = sections.find(s => s.type === 'preamble');
    const articles = sections.filter(s => s.type === 'article').sort((a, b) => (a.order || 0) - (b.order || 0));
    const amendments = sections.filter(s => s.type === 'amendment').sort((a, b) => (a.order || 0) - (b.order || 0));

    // Preamble page
    if (preamble) {
        pages.push([preamble]);
    }

    // Article pages (each article starts new page)
    articles.forEach(article => {
        const articleSections = sections
            .filter(s => s.parentId === article.id && s.type === 'section')
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        // Collect all subsections for each section
        const allSectionsAndSubsections = [article];
        articleSections.forEach(section => {
            allSectionsAndSubsections.push(section);

            const getSubsections = (parentId: string): ConstitutionSection[] => {
                const subsections = sections
                    .filter(s => s.parentId === parentId && s.type === 'subsection')
                    .sort((a, b) => (a.order || 0) - (b.order || 0));

                let result: ConstitutionSection[] = [];
                subsections.forEach(subsection => {
                    result.push(subsection);
                    result.push(...getSubsections(subsection.id));
                });
                return result;
            };

            allSectionsAndSubsections.push(...getSubsections(section.id));
        });

        pages.push(allSectionsAndSubsections);
    });

    // Amendment pages
    amendments.forEach(amendment => {
        pages.push([amendment]);
    });

    return pages;
};

export const renderSectionContent = (section: ConstitutionSection) => {
    let content = section.content || '';

    // Handle image placeholders
    content = content.replace(/\[IMAGE:([^\]]*)\]/g, (match, description) => {
        return `<div class="image-placeholder">
            <strong>Image:</strong> ${description || 'Add image description'}
        </div>`;
    });

    // Convert paragraphs
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    return paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
};

export const getSectionPrintTitle = (section: ConstitutionSection, index: number, sections: ConstitutionSection[]) => {
    switch (section.type) {
        case 'preamble':
            return 'PREAMBLE';
        case 'article':
            return section.title ? `ARTICLE ${toRomanNumeral(index + 1)} - ${section.title.toUpperCase()}` : `ARTICLE ${toRomanNumeral(index + 1)}`;
        case 'section':
            const siblingSections = sections
                .filter(s => s.parentId === section.parentId && s.type === 'section')
                .sort((a, b) => (a.order || 0) - (b.order || 0));
            const sectionIndex = siblingSections.findIndex(s => s.id === section.id) + 1;
            return section.title ? `Section ${sectionIndex} - ${section.title}` : `Section ${sectionIndex}`;
        case 'subsection':
            return getSectionDisplayTitle(section, sections);
        case 'amendment':
            return section.title ? `AMENDMENT ${index + 1} - ${section.title.toUpperCase()}` : `AMENDMENT ${index + 1}`;
        default:
            return section.title || 'Untitled Section';
    }
};

export const generatePrintContent = (constitution: Constitution | null, sections: ConstitutionSection[], baseUrl?: string) => {
    const preamble = sections.find(s => s.type === 'preamble');
    const articles = sections.filter(s => s.type === 'article').sort((a, b) => (a.order || 0) - (b.order || 0));
    const amendments = sections.filter(s => s.type === 'amendment').sort((a, b) => (a.order || 0) - (b.order || 0));

    // Generate table of contents
    const generateTOC = () => {
        const toc = generateTableOfContents(sections);
        return toc.map(({ section, pageNum }) => {
            const getIndentClass = (section: ConstitutionSection) => {
                if (section.type === 'section') return 'ml-6';
                if (section.type === 'subsection') {
                    // Calculate nesting depth for subsections
                    let depth = 2;
                    let currentParentId = section.parentId;

                    while (currentParentId) {
                        const parent = sections.find(s => s.id === currentParentId);
                        if (parent && parent.type === 'subsection') {
                            depth++;
                            currentParentId = parent.parentId;
                        } else {
                            break;
                        }
                    }
                    return `ml-${Math.min(depth * 6, 24)}`;
                }
                return '';
            };

            return `<div class="toc-entry ${getIndentClass(section)}">
                <span>${getSectionDisplayTitle(section, sections)}</span>
                <span style="margin-left: auto;">${pageNum}</span>
            </div>`;
        }).join('');
    };

    let content = '';

    // Cover Page
    content += `
    <div class="constitution-page">
        <div class="logo-container">
            <img src="${baseUrl ? baseUrl + '/logos/blue_logo_only.png' : '/logos/blue_logo_only.png'}" alt="IEEE Logo" style="width: 120px; height: 120px; display: block; margin: 0 auto;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';" />
            <div class="logo-fallback" style="display: none;">IEEE</div>
        </div>
        <h1 style="font-size: 28pt; line-height: 1.1; margin-bottom: 24px;">IEEE at UC San Diego</h1>
        <h2 style="font-size: 16pt; line-height: 1.3; margin-bottom: 48px; font-weight: 600;">The Institute of Electrical and Electronics Engineers at UC San Diego Constitution</h2>
        <div style="text-align: center; margin-top: 48px;">
            <p style="font-size: 14pt; text-indent: 0; margin-bottom: 12px; text-align: center;">
                Last Updated: ${new Date().toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}
            </p>
            <p style="font-size: 12pt; text-indent: 0; color: #666; text-align: center;">
                Version ${constitution?.version || 1}
            </p>
        </div>
    </div>`;

    // Table of Contents
    content += `
    <div class="constitution-page">
        <h2>TABLE OF CONTENTS</h2>
        ${generateTOC()}
    </div>`;

    // Preamble
    if (preamble) {
        content += `
        <div class="constitution-page">
            <div class="constitution-section">
                <h2>${getSectionPrintTitle(preamble, 0, sections)}</h2>
                ${renderSectionContent(preamble)}
            </div>
        </div>`;
    }

    // Articles
    articles.forEach((article, index) => {
        const articleSections = sections
            .filter(s => s.parentId === article.id && s.type === 'section')
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        content += `
        <div class="constitution-page">
            <div class="constitution-section">
                <h2>${getSectionPrintTitle(article, index, sections)}</h2>
                ${renderSectionContent(article)}
            </div>`;

        articleSections.forEach((section, secIndex) => {
            content += `
            <div class="constitution-section">
                <h3>${getSectionPrintTitle(section, secIndex, sections)}</h3>
                ${renderSectionContent(section)}
            </div>`;
        });

        content += `</div>`;
    });

    // Amendments
    amendments.forEach((amendment, index) => {
        content += `
        <div class="constitution-page">
            <div class="constitution-section">
                <h2>${getSectionPrintTitle(amendment, index, sections)}</h2>
                ${renderSectionContent(amendment)}
            </div>
        </div>`;
    });

    return content;
};

export const generatePrintHTML = (constitution: Constitution | null, sections: ConstitutionSection[], baseUrl?: string) => {
    const printContent = generatePrintContent(constitution, sections, baseUrl);

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>IEEE at UC San Diego Constitution</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                * {
                    box-sizing: border-box;
                }
                
                body {
                    font-family: Arial, sans-serif;
                    font-size: 12pt;
                    line-height: 1.6;
                    margin: 0;
                    padding: 0;
                    color: #000;
                    background: white;
                }
                
                .constitution-page {
                    page-break-after: always;
                    width: 8.5in;
                    height: 11in;
                    min-height: 11in;
                    padding: 1in;
                    background: white;
                    position: relative;
                    margin: 0 auto;
                    box-sizing: border-box;
                }
                
                .constitution-page:last-child {
                    page-break-after: avoid;
                }
                
                .constitution-section {
                    margin-bottom: 24px;
                }
                
                h1 {
                    font-family: Arial, sans-serif;
                    font-size: 28pt;
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: 24px;
                    page-break-after: avoid;
                }
                
                h2 {
                    font-family: Arial, sans-serif;
                    font-size: 18pt;
                    font-weight: bold;
                    text-align: center;
                    margin-top: 24px;
                    margin-bottom: 16px;
                    page-break-after: avoid;
                }
                
                h3 {
                    font-family: Arial, sans-serif;
                    font-size: 14pt;
                    font-weight: bold;
                    margin-top: 16px;
                    margin-bottom: 12px;
                    page-break-after: avoid;
                }
                
                h4, h5, h6 {
                    font-family: Arial, sans-serif;
                    font-size: 12pt;
                    font-weight: bold;
                    margin-top: 12px;
                    margin-bottom: 8px;
                    page-break-after: avoid;
                }
                
                p {
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
                
                @page {
                    size: letter;
                    margin: 1in;
                }
                
                @media print {
                    body {
                        font-family: Arial, sans-serif !important;
                        font-size: 12pt !important;
                        line-height: 1.6 !important;
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    
                    .constitution-page {
                        page-break-after: always;
                        width: 8.5in !important;
                        height: 11in !important;
                        min-height: 11in !important;
                        padding: 1in !important;
                        margin: 0 !important;
                        box-sizing: border-box !important;
                    }
                    
                    .constitution-page:last-child {
                        page-break-after: avoid;
                    }
                    
                    h1 { font-size: 28pt !important; font-family: Arial, sans-serif !important; }
                    h2 { font-size: 18pt !important; font-family: Arial, sans-serif !important; }
                    h3 { font-size: 14pt !important; font-family: Arial, sans-serif !important; }
                    p { font-size: 12pt !important; font-family: Arial, sans-serif !important; }
                }
            </style>
            
        </head>
        <body>
            ${printContent}
        </body>
        </html>
    `;
};

export const exportToPDF = (constitution: Constitution | null, sections: ConstitutionSection[]) => {
    // Store original page content
    const originalContent = document.body.innerHTML;
    const originalTitle = document.title;
    
    // Set title for PDF
    document.title = `IEEE_UCSD_Constitution_${new Date().toISOString().split('T')[0]}`;
    
    // Replace page content with print content
    document.body.innerHTML = `
        <style>
            @media print {
                body {
                    font-family: Arial, sans-serif !important;
                    font-size: 12pt !important;
                    line-height: 1.6 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                .constitution-page {
                    page-break-after: always;
                    width: 8.5in !important;
                    height: 11in !important;
                    padding: 1in !important;
                    margin: 0 !important;
                    box-sizing: border-box !important;
                }
                
                .constitution-page:last-child { page-break-after: avoid; }
                h1 { font-size: 28pt !important; text-align: center !important; margin-bottom: 24px !important; }
                h2 { font-size: 18pt !important; text-align: center !important; margin: 24px 0 16px 0 !important; }
                h3 { font-size: 14pt !important; margin: 16px 0 12px 0 !important; }
                p { font-size: 12pt !important; margin-bottom: 12px !important; text-align: justify !important; text-indent: 0.5in !important; }
                
                .toc-entry {
                    display: flex !important;
                    justify-content: space-between !important;
                    margin-bottom: 6px !important;
                    font-size: 14pt !important;
                }
            }
            
            @media screen {
                body { margin: 20px; }
            }
        </style>
        ${generatePrintContent(constitution, sections)}
    `;
    
    // Trigger print
    setTimeout(() => {
        window.print();
        
        // Restore original content after a delay
        setTimeout(() => {
            document.body.innerHTML = originalContent;
            document.title = originalTitle;
            // Trigger a page reload to restore React functionality
            window.location.reload();
        }, 1000);
    }, 100);
}; 