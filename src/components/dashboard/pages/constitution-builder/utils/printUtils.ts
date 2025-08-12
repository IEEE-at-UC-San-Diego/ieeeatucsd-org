import type {
  Constitution,
  ConstitutionSection,
} from "../../../shared/types/firestore";
import { toRomanNumeral, getSectionDisplayTitle } from "./constitutionUtils";

export interface TableOfContentsEntry {
  section: ConstitutionSection;
  pageNum: number;
}

export const generateTableOfContents = (
  sections: ConstitutionSection[],
): TableOfContentsEntry[] => {
  const toc: TableOfContentsEntry[] = [];

  // Generate the actual content pages to get accurate page numbers
  const contentPages = generateContentPages(sections);

  let tocStartPage = 2; // TOC starts on page 2 (after cover page)

  // Calculate how many TOC pages we need
  const estimatedTocEntries = sections.filter(
    (s) =>
      s.type === "preamble" ||
      s.type === "article" ||
      s.type === "section" ||
      s.type === "subsection" ||
      s.type === "amendment",
  ).length;
  const tocPagesNeeded = Math.ceil(estimatedTocEntries / 25); // ~25 entries per page

  let contentStartPage = tocStartPage + tocPagesNeeded; // Content starts after TOC pages

  // Map sections to their actual page numbers
  const sectionToPageMap = new Map<string, number>();

  contentPages.forEach((page, pageIndex) => {
    const actualPageNum = contentStartPage + pageIndex;
    page.forEach((section) => {
      if (!sectionToPageMap.has(section.id)) {
        sectionToPageMap.set(section.id, actualPageNum);
      }
    });
  });

  // Helper function to add subsections recursively to TOC
  const addSubsectionsToTOC = (parentId: string): void => {
    const subsections = sections
      .filter((s) => s.parentId === parentId && s.type === "subsection")
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    subsections.forEach((subsection) => {
      const pageNum = sectionToPageMap.get(subsection.id) || contentStartPage;
      toc.push({ section: subsection, pageNum });

      // Recursively add nested subsections
      addSubsectionsToTOC(subsection.id);
    });
  };

  // Preamble
  const preamble = sections.find((s) => s.type === "preamble");
  if (preamble) {
    const pageNum = sectionToPageMap.get(preamble.id) || contentStartPage;
    toc.push({ section: preamble, pageNum });
  }

  // Articles
  const articles = sections
    .filter((s) => s.type === "article")
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  articles.forEach((article) => {
    const pageNum = sectionToPageMap.get(article.id) || contentStartPage;
    toc.push({ section: article, pageNum });

    // Sections within this article
    const articleSections = sections
      .filter((s) => s.parentId === article.id && s.type === "section")
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    articleSections.forEach((section) => {
      const sectionPageNum = sectionToPageMap.get(section.id) || pageNum;
      toc.push({ section, pageNum: sectionPageNum });

      // Add all subsections for this section
      addSubsectionsToTOC(section.id);
    });
  });

  // Amendments
  const amendments = sections
    .filter((s) => s.type === "amendment")
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  amendments.forEach((amendment) => {
    const pageNum = sectionToPageMap.get(amendment.id) || contentStartPage;
    toc.push({ section: amendment, pageNum });
  });

  return toc;
};

export const calculateTotalPages = (
  sections: ConstitutionSection[],
  showTOC: boolean,
) => {
  let pageCount = 1; // Cover page

  if (showTOC) {
    // Calculate TOC pages needed
    const estimatedTocEntries = sections.filter(
      (s) =>
        s.type === "preamble" ||
        s.type === "article" ||
        s.type === "section" ||
        s.type === "subsection" ||
        s.type === "amendment",
    ).length;
    const tocPagesNeeded = Math.ceil(estimatedTocEntries / 25); // ~25 entries per page
    pageCount += tocPagesNeeded;
  }

  // Content pages - use the actual page generation logic
  const contentPages = generateContentPages(sections);
  pageCount += contentPages.length;

  return pageCount;
};

// Estimate content height in points (approximate)
const estimateContentHeight = (section: ConstitutionSection): number => {
  let height = 0;

  // Title height based on section type
  switch (section.type) {
    case "preamble":
    case "article":
    case "amendment":
      height += 30; // h2 title + margins (18pt + margins)
      break;
    case "section":
      height += 24; // h3 title + margins (12pt + margins)
      break;
    case "subsection":
      height += 20; // h4 title + margins (11pt + margins)
      break;
  }

  // Content height (if any)
  if (section.content && section.type !== "article") {
    const contentLines = section.content.split("\n").length;
    const wordsPerLine = 12; // Approximate words per line at 11pt
    const words = section.content.split(/\s+/).length;
    const estimatedLines = Math.max(
      contentLines,
      Math.ceil(words / wordsPerLine),
    );
    height += estimatedLines * 16.5; // 11pt font with 1.5 line height
  }

  // Add bottom margin
  height += section.type === "article" ? 12 : 20;

  return height;
};

export const generateContentPages = (
  sections: ConstitutionSection[],
): ConstitutionSection[][] => {
  const pages: ConstitutionSection[][] = [];
  const PAGE_HEIGHT = 648; // 11in - 2in margins = 9in * 72pt/in = 648pt
  const SECTION_BREAK_THRESHOLD = 100; // Don't break if less than this space left

  // Group sections by type for proper page breaks
  const preamble = sections.find((s) => s.type === "preamble");
  const articles = sections
    .filter((s) => s.type === "article")
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const amendments = sections
    .filter((s) => s.type === "amendment")
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Preamble page
  if (preamble) {
    pages.push([preamble]);
  }

  // Process articles with dynamic page breaks
  articles.forEach((article) => {
    const articleSections = sections
      .filter((s) => s.parentId === article.id && s.type === "section")
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    // Collect all sections and subsections in order
    const allSectionsAndSubsections = [article];
    articleSections.forEach((section) => {
      allSectionsAndSubsections.push(section);

      const getSubsections = (parentId: string): ConstitutionSection[] => {
        const subsections = sections
          .filter((s) => s.parentId === parentId && s.type === "subsection")
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        let result: ConstitutionSection[] = [];
        subsections.forEach((subsection) => {
          result.push(subsection);
          result.push(...getSubsections(subsection.id));
        });
        return result;
      };

      allSectionsAndSubsections.push(...getSubsections(section.id));
    });

    // Split into pages based on estimated height
    let currentPage: ConstitutionSection[] = [];
    let currentPageHeight = 0;

    allSectionsAndSubsections.forEach((section) => {
      const sectionHeight = estimateContentHeight(section);

      // Check if we need a new page
      if (
        currentPage.length > 0 &&
        (currentPageHeight + sectionHeight > PAGE_HEIGHT ||
          (section.type === "section" &&
            currentPageHeight > PAGE_HEIGHT - SECTION_BREAK_THRESHOLD))
      ) {
        // Start new page
        pages.push(currentPage);
        currentPage = [section];
        currentPageHeight = sectionHeight;
      } else {
        // Add to current page
        currentPage.push(section);
        currentPageHeight += sectionHeight;
      }
    });

    // Add the last page if it has content
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }
  });

  // Amendment pages (each amendment on its own page for now)
  amendments.forEach((amendment) => {
    pages.push([amendment]);
  });

  return pages;
};

// Enhanced content parsing for print output
const parseContentForPrint = (content: string) => {
  // Split content by image markers first
  const parts = content.split(/(\[IMAGE:[^\]]*\])/g);

  let html = "";

  parts.forEach((part) => {
    if (part.match(/^\[IMAGE:[^\]]*\]$/)) {
      const description = part.replace(/^\[IMAGE:/, "").replace(/\]$/, "");
      html += `<div class="image-placeholder">
                <strong>Image:</strong> ${description || "Add image description"}
              </div>`;
    } else if (part.trim()) {
      // Split by double newlines to get paragraphs/list groups
      const paragraphs = part.split("\n\n").filter((p) => p.trim());

      paragraphs.forEach((paragraph) => {
        const trimmed = paragraph.trim();

        // Check if this is a numbered list
        if (/^\d+\.\s/.test(trimmed)) {
          const listItems = trimmed.split("\n").filter((line) => line.trim());
          html += '<ol class="numbered-list">';
          listItems.forEach((item) => {
            const match = item.match(/^(\d+)\.\s(.+)$/);
            if (match) {
              html += `<li>${formatInlineTextForPrint(match[2])}</li>`;
            } else {
              html += `<li>${formatInlineTextForPrint(item)}</li>`;
            }
          });
          html += "</ol>";
        }
        // Check if this is a bullet list
        else if (/^[-*]\s/.test(trimmed)) {
          const listItems = trimmed.split("\n").filter((line) => line.trim());
          html += '<ul class="bullet-list">';
          listItems.forEach((item) => {
            const match = item.match(/^[-*]\s(.+)$/);
            if (match) {
              html += `<li>${formatInlineTextForPrint(match[1])}</li>`;
            } else {
              html += `<li>${formatInlineTextForPrint(item)}</li>`;
            }
          });
          html += "</ul>";
        }
        // Tree-like org structure: render exact text block in monospace to preserve alignment
        else if (trimmed.includes("├──") || trimmed.includes("└──")) {
          const safe = trimmed
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          html += `<pre class="org-tree-pre">${safe}</pre>`;
        }
        // Regular paragraph
        else {
          html += `<p>${formatInlineTextForPrint(trimmed)}</p>`;
        }
      });
    }
  });

  return html;
};

// Format inline text with bold, italics, etc. for print
const formatInlineTextForPrint = (text: string) => {
  // Handle bold text **text**
  text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Handle italic text *text* (but not if it's part of **)
  text = text.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>");

  return text;
};

export const renderSectionContent = (section: ConstitutionSection) => {
  return parseContentForPrint(section.content || "");
};

export const getSectionPrintTitle = (
  section: ConstitutionSection,
  index: number,
  sections: ConstitutionSection[],
) => {
  switch (section.type) {
    case "preamble":
      return "PREAMBLE";
    case "article":
      return section.title
        ? `Article ${toRomanNumeral(index + 1)}: ${section.title}`
        : `Article ${toRomanNumeral(index + 1)}`;
    case "section":
      const siblingSections = sections
        .filter((s) => s.parentId === section.parentId && s.type === "section")
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      const sectionIndex =
        siblingSections.findIndex((s) => s.id === section.id) + 1;
      return section.title
        ? `Section ${sectionIndex}: ${section.title}`
        : `Section ${sectionIndex}`;
    case "subsection":
      return getSectionDisplayTitle(section, sections);
    case "amendment":
      return section.title
        ? `AMENDMENT ${index + 1}: ${section.title.toUpperCase()}`
        : `AMENDMENT ${index + 1}`;
    default:
      return section.title || "Untitled Section";
  }
};

export const generatePrintContent = (
  constitution: Constitution | null,
  sections: ConstitutionSection[],
  baseUrl?: string,
) => {
  // Get the actual last modified date from constitution and sections
  const getLastModifiedDate = (): Date => {
    const toDateSafe = (value: any): Date | null => {
      if (!value) return null;
      // Firestore Timestamp-like object
      if (typeof value.toDate === "function") {
        try {
          return value.toDate();
        } catch {
          /* noop */
        }
      }
      // Firestore Timestamp plain object { seconds, nanoseconds }
      if (typeof value.seconds === "number") {
        const ms =
          value.seconds * 1000 +
          (typeof value.nanoseconds === "number"
            ? Math.floor(value.nanoseconds / 1e6)
            : 0);
        const d = new Date(ms);
        return isNaN(d.getTime()) ? null : d;
      }
      // ISO string or epoch ms
      if (typeof value === "string" || typeof value === "number") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
      }
      // Already a Date
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
      }
      return null;
    };

    const timestamps: Date[] = [];

    // Add constitution's lastModified if it exists
    const cDate = toDateSafe(constitution?.lastModified);
    if (cDate) timestamps.push(cDate);

    // Add all sections' lastModified timestamps
    sections.forEach((section) => {
      const sDate = toDateSafe(section.lastModified as any);
      if (sDate) timestamps.push(sDate);
    });

    // Return the most recent timestamp, or current date as fallback
    if (timestamps.length > 0) {
      return new Date(Math.max(...timestamps.map((date) => date.getTime())));
    }

    return new Date(); // Fallback to current date if no timestamps found
  };

  const preamble = sections.find((s) => s.type === "preamble");
  const articles = sections
    .filter((s) => s.type === "article")
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const amendments = sections
    .filter((s) => s.type === "amendment")
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Generate table of contents
  const generateTOC = () => {
    const toc = generateTableOfContents(sections);
    return toc
      .map(({ section, pageNum }) => {
        const getIndentPx = (section: ConstitutionSection) => {
          if (section.type === "section") return 24; // 1 level in
          if (section.type === "subsection") {
            // Calculate nesting depth for subsections
            let depth = 1; // base indent
            let currentParentId = section.parentId;
            while (currentParentId) {
              const parent = sections.find((s) => s.id === currentParentId);
              if (parent && parent.type === "subsection") {
                depth++;
                currentParentId = parent.parentId;
              } else {
                break;
              }
            }
            return Math.min((depth + 1) * 24, 144); // cap deep nesting
          }
          return 0;
        };

        // Get the correct title based on section type
        let title = "";
        if (section.type === "article") {
          const articles = sections
            .filter((s) => s.type === "article")
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          const articleIndex = articles.findIndex((a) => a.id === section.id);
          title = getSectionPrintTitle(section, articleIndex, sections);
        } else if (section.type === "amendment") {
          const amendments = sections
            .filter((s) => s.type === "amendment")
            .sort((a, b) => (a.order || 0) - (b.order || 0));
          const amendmentIndex = amendments.findIndex(
            (a) => a.id === section.id,
          );
          title = getSectionPrintTitle(section, amendmentIndex, sections);
        } else {
          title = getSectionDisplayTitle(section, sections);
        }

        return `<div class="toc-entry" style="padding-left:${getIndentPx(section)}px;">
                <a href="#section-${section.id}" style="text-decoration: none; color: inherit; display: flex; justify-content: space-between; width: 100%; gap:12px;">
                    <span style="flex:1;">${title}</span>
                    <span style="margin-left: auto;">${pageNum}</span>
                </a>
            </div>`;
      })
      .join("");
  };

  let content = "";

  // IEEE Logo as base64 (embedded to ensure it loads in PDF)
  const ieeeLogoBase64 =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="; // Placeholder - will be replaced with actual logo

  // Cover Page
  content += `
    <div class="constitution-page cover-page" style="display:flex; flex-direction:column; align-items:center; text-align:center;">
        <div class="logo-container" style="text-align: center; margin: 48px 0; width:100%;">
            <img src="${baseUrl}/blue_logo_only.png" alt="IEEE Logo" style="width: 120px; height: 120px; object-fit: contain; margin: 0 auto; display: block;" />
        </div>
        <h1 style="font-size: 28pt; line-height: 1.1; margin-bottom: 24px; text-align:center; width:100%;">IEEE at UC San Diego</h1>
        <h2 class="cover-subtitle" style="font-size: 16pt; line-height: 1.3; margin-bottom: 48px; font-weight: 600; width:100%;">The Institute of Electrical and Electronics Engineers at UC San Diego Constitution</h2>
        <div style="text-align: center; margin-top: 48px; width:100%;">
            <p class="cover-meta" style="font-size: 14pt; margin-bottom: 12px;">
                Last Updated: ${getLastModifiedDate().toLocaleDateString(
                  "en-US",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  },
                )}
            </p>

            <p class="cover-meta" style="font-size: 11pt; color: #888; margin-top: 8px;">
                Adopted since September 2006
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
            <div class="constitution-section" id="section-${preamble.id}">
                <h2 class="article-title">${getSectionPrintTitle(preamble, 0, sections)}</h2>
                ${renderSectionContent(preamble)}
            </div>
        </div>`;
  }

  // Articles
  articles.forEach((article, index) => {
    const articleSections = sections
      .filter((s) => s.parentId === article.id && s.type === "section")
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    content += `
        <div class="constitution-page">
            <div class="constitution-section" id="section-${article.id}">
                <h2 class="article-title">${getSectionPrintTitle(article, index, sections)}</h2>
            </div>`;

    articleSections.forEach((section, secIndex) => {
      content += `
            <div class="constitution-section" id="section-${section.id}">
                <h3 class="section-title">${getSectionPrintTitle(section, secIndex, sections)}</h3>
                ${renderSectionContent(section)}
            </div>`;

      // Add subsections for this section
      const renderSubsections = (parentId: string, indentLevel: number = 0) => {
        const subsections = sections
          .filter((s) => s.parentId === parentId && s.type === "subsection")
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        subsections.forEach((subsection) => {
          const indentStyle =
            indentLevel > 0 ? `margin-left: ${indentLevel * 24}px;` : "";
          content += `
            <div class="constitution-section" id="section-${subsection.id}" style="${indentStyle}">
                <h4 class="subsection-title">${getSectionPrintTitle(subsection, 0, sections)}</h4>
                ${renderSectionContent(subsection)}
            </div>`;

          // Recursively render nested subsections
          renderSubsections(subsection.id, indentLevel + 1);
        });
      };

      renderSubsections(section.id, 1);
    });

    content += `</div>`;
  });

  // Amendments
  amendments.forEach((amendment, index) => {
    content += `
        <div class="constitution-page">
            <div class="constitution-section" id="section-${amendment.id}">
                <h2 class="article-title">${getSectionPrintTitle(amendment, index, sections)}</h2>
                ${renderSectionContent(amendment)}
            </div>
        </div>`;
  });

  return content;
};

export const generatePrintHTML = (
  constitution: Constitution | null,
  sections: ConstitutionSection[],
  baseUrl?: string,
) => {
  const printContent = generatePrintContent(constitution, sections, baseUrl);

  return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>IEEE at UC San Diego Constitution</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            ${baseUrl ? `<base href="${baseUrl}/" />` : ""}
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
                    color: #444;  // Softer dark gray
                    background: white;
                }
                
                .constitution-page {
                    page-break-after: always;
                    /* Let content flow naturally; use padding for margins */
                    padding: 1in;
                    background: white;
                    position: relative;
                    margin: 0 auto;
                    box-sizing: border-box;
                    /* Allow content to paginate instead of being clipped */
                    overflow: visible;
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
                    color: #333;  // Softer dark gray for headings
                }

                /* Cover page strict centering */
                .cover-page h2.cover-subtitle,
                .cover-page .cover-meta {
                    text-align: center !important;
                    width: 100% !important;
                    margin-left: auto !important;
                    margin-right: auto !important;
                }

                /* Article titles (h2) - larger font size - FORCE OVERRIDE */
                h2, h2.article-title {
                    font-family: Arial, sans-serif !important;
                    font-size: 18pt !important;
                    font-weight: bold !important;
                    text-align: left !important;
                    margin-top: 20px !important;
                    margin-bottom: 8px !important;
                    page-break-after: avoid !important;
                    color: #333 !important;  /* Softer dark gray for headings */
                }

                /* Section titles (h3) - smaller font size - FORCE OVERRIDE */
                h3, h3.section-title {
                    font-family: Arial, sans-serif !important;
                    font-size: 12pt !important;
                    font-weight: bold !important;
                    text-align: left !important;
                    margin-top: 12px !important;
                    margin-bottom: 8px !important;
                    page-break-after: avoid !important;
                    color: #555 !important;  /* Lighter color for sections to differentiate */
                }

                /* Specific classes for better control */
                .article-title {
                    font-family: Arial, sans-serif !important;
                    font-size: 18pt !important;
                    font-weight: bold !important;
                    text-align: left !important;
                    margin-top: 20px !important;
                    margin-bottom: 8px !important;
                    page-break-after: avoid !important;
                    color: #333 !important;
                }

                .section-title {
                    font-family: Arial, sans-serif !important;
                    font-size: 12pt !important;
                    font-weight: bold !important;
                    text-align: left !important;
                    margin-top: 12px !important;
                    margin-bottom: 8px !important;
                    page-break-after: avoid !important;
                    color: #555 !important;
                }

                .subsection-title {
                    font-family: Arial, sans-serif !important;
                    font-size: 11pt !important;
                    font-weight: 600 !important;
                    text-align: left !important;
                    margin-top: 10px !important;
                    margin-bottom: 6px !important;
                    page-break-after: avoid !important;
                    color: #666 !important;
                }

                /* Subsection titles (h4) - smallest font size */
                h4 {
                    font-family: Arial, sans-serif;
                    font-size: 11pt;
                    font-weight: 600;
                    text-align: left;
                    margin-top: 10px;
                    margin-bottom: 6px;
                    page-break-after: avoid;
                    color: #666;  /* Even lighter color for subsections */
                }

                h5, h6 {
                    font-family: Arial, sans-serif;
                    font-size: 10pt;
                    font-weight: 600;
                    margin-top: 8px;
                    margin-bottom: 4px;
                    page-break-after: avoid;
                    color: #777;  /* Lightest color for deeper nesting */
                }

                p {
                    font-family: Arial, sans-serif;
                    font-size: 11pt;
                    line-height: 1.5;
                    margin-bottom: 10px;
                    text-align: justify;
                    text-indent: 0;      /* Remove text indentation */
                    orphans: 2;
                    widows: 2;
                    color: #444;  /* Softer dark gray for body text */
                }

                /* Slightly emphasize Last Updated on cover */
                .cover-page .cover-meta:first-of-type {
                    font-weight: 600 !important;
                    font-size: 15pt !important;
                }

                ol.numbered-list, ul.bullet-list {
                    font-family: Arial, sans-serif;
                    font-size: 11pt;
                    line-height: 1.5;
                    margin-bottom: 10px;
                    padding-left: 20px;
                    color: #444;  // Softer dark gray for lists
                }

                ol.numbered-list li, ul.bullet-list li {
                    margin-bottom: 4px;
                    text-align: justify;
                }

                /* Org tree block preserves alignment */
                pre.org-tree-pre {
                    white-space: pre; /* exact spacing */
                    font-family: "Courier New", Courier, monospace;
                    font-size: 11pt;
                    line-height: 1.4;
                    margin: 12px 0;
                    color: #444;
                }

                strong {
                    font-weight: bold;
                }

                em {
                    font-style: italic;
                }
                
                                 .toc-entry {
                     display: flex;
                     justify-content: space-between;
                     align-items: center;
                     gap: 12px;
                     margin-bottom: 6px;
                     text-indent: 0;
                     font-family: Arial, sans-serif;
                 }
                 .toc-entry a span:first-child { flex: 1; }

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
                    margin: 0.75in;
                }
                
                /* Force print styles to apply in all contexts, including PDF generation */
                /* Apply styles universally - no media query restrictions */
                    body {
                        font-family: Arial, sans-serif !important;
                        font-size: 12pt !important;
                        line-height: 1.6 !important;
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }

                    .constitution-page {
                        page-break-after: always;
                        /* No fixed height — let browser paginate */
                        padding: 0 !important; /* Use @page margins for print */
                        margin: 0 !important;
                        box-sizing: border-box !important;
                        overflow: visible !important;
                    }

                    .constitution-page:last-child {
                        page-break-after: avoid;
                    }

                    /* Article titles (h2) - larger font size */
                    h1 {
                        font-size: 28pt !important;
                        font-family: Arial, sans-serif !important;
                        font-weight: bold !important;
                        text-align: center !important;
                        margin-bottom: 24px !important;
                        page-break-after: avoid !important;
                        color: #333 !important;
                    }

                    /* Article titles (h2) - larger font size */
                    h2 {
                        font-size: 18pt !important;
                        font-family: Arial, sans-serif !important;
                        font-weight: bold !important;
                        text-align: left !important;
                        margin-top: 20px !important;
                        margin-bottom: 8px !important;
                        page-break-after: avoid !important;
                        color: #333 !important;
                    }

                    /* Section titles (h3) - smaller font size */
                    h3 {
                        font-size: 12pt !important;
                        font-family: Arial, sans-serif !important;
                        font-weight: bold !important;
                        text-align: left !important;
                        margin-top: 12px !important;
                        margin-bottom: 8px !important;
                        page-break-after: avoid !important;
                        color: #555 !important;
                    }

                    /* Subsection titles (h4) - smallest font size */
                    h4 {
                        font-size: 11pt !important;
                        font-family: Arial, sans-serif !important;
                        font-weight: 600 !important;
                        text-align: left !important;
                        margin-top: 10px !important;
                        margin-bottom: 6px !important;
                        page-break-after: avoid !important;
                        color: #666 !important;
                    }

                    /* Body text */
                    p {
                        font-size: 11pt !important;
                        font-family: Arial, sans-serif !important;
                        line-height: 1.5 !important;
                        margin-bottom: 10px !important;
                        text-align: justify !important;
                        text-indent: 0 !important;      /* Remove text indentation */
                        orphans: 2 !important;
                        widows: 2 !important;
                        color: #444 !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }

                    /* Section break rules */
                    .constitution-section {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }

                    /* Prevent orphaned headings */
                    h1, h2, h3, h4, h5, h6 {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                }

                /* Additional universal font size enforcement */
                body h2.article-title,
                body .constitution-page h2.article-title,
                body .constitution-section h2.article-title {
                    font-size: 18pt !important;
                    font-weight: bold !important;
                    color: #333 !important;
                }

                body h3.section-title,
                body .constitution-page h3.section-title,
                body .constitution-section h3.section-title {
                    font-size: 12pt !important;
                    font-weight: bold !important;
                    color: #555 !important;
                }

                body h4.subsection-title,
                body .constitution-page h4.subsection-title,
                body .constitution-section h4.subsection-title {
                    font-size: 11pt !important;
                    font-weight: 600 !important;
                    color: #666 !important;
                }
            </style>
            
        </head>
        <body>
            ${printContent}
        </body>
        </html>
    `;
};

export const exportToPDF = (
  constitution: Constitution | null,
  sections: ConstitutionSection[],
) => {
  // Store original page content
  const originalContent = document.body.innerHTML;
  const originalTitle = document.title;

  // Set title for PDF
  document.title = `IEEE_UCSD_Constitution_${new Date().toISOString().split("T")[0]}`;

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
                /* Article titles (h2) - larger font size */
                h2 { font-size: 18pt !important; text-align: left !important; margin: 24px 0 16px 0 !important; }
                /* Section titles (h3) - smaller font size */
                h3 { font-size: 12pt !important; margin: 16px 0 12px 0 !important; }
                /* Subsection titles (h4) - smallest font size */
                h4 { font-size: 11pt !important; margin: 12px 0 8px 0 !important; }
                /* Body text */
                p { font-size: 11pt !important; margin-bottom: 12px !important; text-align: justify !important; text-indent: 0 !important; }
                
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
