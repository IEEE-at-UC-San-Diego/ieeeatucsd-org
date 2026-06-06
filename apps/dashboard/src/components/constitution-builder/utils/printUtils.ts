import type { Constitution, ConstitutionSection } from "../types";
import { getSectionDisplayTitle, toRomanNumeral } from "./constitutionUtils";

// Legacy interface for backward compatibility
export interface TableOfContentsEntry {
	section: ConstitutionSection;
	pageNum: number;
}

// New hierarchical TOC entry interface
export interface TOCEntry {
	section: ConstitutionSection;
	depth: number;
	children: TOCEntry[];
}

/**
 * First Pass: Generate hierarchical TOC structure without page numbers
 * Handles preamble, articles with nested sections/subsections, and amendments
 */
export const generateTOCStructure = (
	sections: ConstitutionSection[],
): TOCEntry[] => {
	const tocEntries: TOCEntry[] = [];

	// Helper function to recursively build subsection hierarchy
	const buildSubsectionHierarchy = (
		parentId: string,
		currentDepth: number,
	): TOCEntry[] => {
		const subsections = sections
			.filter((s) => s.parentId === parentId && s.type === "subsection")
			.sort((a, b) => (a.order || 0) - (b.order || 0));

		return subsections.map((subsection) => ({
			section: subsection,
			depth: currentDepth,
			children: buildSubsectionHierarchy(subsection.id, currentDepth + 1),
		}));
	};

	// Group sections by type for proper ordering
	const preamble = sections.find((s) => s.type === "preamble");
	const articles = sections
		.filter((s) => s.type === "article")
		.sort((a, b) => (a.order || 0) - (b.order || 0));
	const amendments = sections
		.filter((s) => s.type === "amendment")
		.sort((a, b) => (a.order || 0) - (b.order || 0));

	// Add preamble to TOC structure
	if (preamble) {
		tocEntries.push({
			section: preamble,
			depth: 0,
			children: [],
		});
	}

	// Add articles with their sections and subsections
	articles.forEach((article) => {
		const articleSections = sections
			.filter((s) => s.parentId === article.id && s.type === "section")
			.sort((a, b) => (a.order || 0) - (b.order || 0));

		const sectionChildren: TOCEntry[] = articleSections.map((section) => ({
			section,
			depth: 1,
			children: buildSubsectionHierarchy(section.id, 2),
		}));

		tocEntries.push({
			section: article,
			depth: 0,
			children: sectionChildren,
		});
	});

	// Add amendments to TOC structure
	amendments.forEach((amendment) => {
		tocEntries.push({
			section: amendment,
			depth: 0,
			children: [],
		});
	});

	return tocEntries;
};

/**
 * Flatten TOC structure for backward compatibility
 */
export const flattenTOCStructure = (tocStructure: TOCEntry[]): TOCEntry[] => {
	const flattened: TOCEntry[] = [];

	const flatten = (entries: TOCEntry[]) => {
		entries.forEach((entry) => {
			flattened.push(entry);
			if (entry.children.length > 0) {
				flatten(entry.children);
			}
		});
	};

	flatten(tocStructure);
	return flattened;
};

// Helper function to calculate TOC pages needed
const calculateTocPagesNeeded = (sections: ConstitutionSection[]): number => {
	const estimatedTocEntries = sections.filter(
		(s) =>
			s.type === "preamble" ||
			s.type === "article" ||
			s.type === "section" ||
			s.type === "subsection" ||
			s.type === "amendment",
	).length;
	return Math.ceil(estimatedTocEntries / 30); // 30 entries per page to match PDF density
};

// Estimate content height in points (approximate) - matching SectionRenderer styles
const estimateContentHeight = (section: ConstitutionSection): number => {
	let height = 0;

	// Title height based on section type
	switch (section.type) {
		case "preamble":
		case "article":
		case "amendment":
			// 18pt font + marginTop (20px) + marginBottom (8px) = ~46px = ~34pt
			height += 34;
			break;
		case "section":
			// 12pt font + marginTop (12px) + marginBottom (8px) = ~32px = ~24pt
			height += 24;
			break;
		case "subsection":
			// 11pt font + marginTop (10px) + marginBottom (6px) = ~27px = ~20pt
			height += 20;
			break;
	}

	// Content height (if any)
	if (section.content && section.type !== "article") {
		const contentLines = section.content.split("\n").length;
		const wordsPerLine = 12;
		const words = section.content
			.split(/\s+/)
			.filter((word) => word.length > 0).length;
		const estimatedLines = Math.max(
			contentLines,
			Math.ceil(words / wordsPerLine),
		);
		// 11pt font with 1.5 line height = 16.5pt per line, plus extra margin
		height += estimatedLines * 17;
	}

	// Bottom margin
	height += 10;

	return height;
};

export const generateContentPages = (
	sections: ConstitutionSection[],
): ConstitutionSection[][] => {
	const pages: ConstitutionSection[][] = [];
	const PAGE_HEIGHT = 625;
	const SECTION_BREAK_THRESHOLD = 85;

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
		const allSectionsAndSubsections: ConstitutionSection[] = [article];
		articleSections.forEach((section) => {
			allSectionsAndSubsections.push(section);

			const getSubsections = (parentId: string): ConstitutionSection[] => {
				const subsections = sections
					.filter((s) => s.parentId === parentId && s.type === "subsection")
					.sort((a, b) => (a.order || 0) - (b.order || 0));

				const result: ConstitutionSection[] = [];
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

	// Amendment pages (each amendment on its own page)
	amendments.forEach((amendment) => {
		pages.push([amendment]);
	});

	return pages;
};

/**
 * Legacy function: generates flat TOC with real page numbers
 */
export const generateTableOfContents = (
	sections: ConstitutionSection[],
): TableOfContentsEntry[] => {
	const tocStructure = generateTOCStructure(sections);
	const flattenedTOC = flattenTOCStructure(tocStructure);

	const tocPagesNeeded = calculateTocPagesNeeded(sections);
	const contentStartPage = 2 + tocPagesNeeded; // cover + TOC pages

	const contentPages = generateContentPages(sections);
	const sectionToPageMap = new Map<string, number>();

	contentPages.forEach((page, pageIndex) => {
		const actualPageNumber = contentStartPage + pageIndex;
		page.forEach((section) => {
			sectionToPageMap.set(section.id, actualPageNumber);
		});
	});

	const toc: TableOfContentsEntry[] = [];
	flattenedTOC.forEach((entry) => {
		const pageNum = sectionToPageMap.get(entry.section.id);
		if (pageNum) {
			toc.push({ section: entry.section, pageNum });
		}
	});

	return toc;
};

export const calculateTotalPages = (
	sections: ConstitutionSection[],
	showTOC: boolean,
) => {
	let pageCount = 1; // Cover page

	if (showTOC) {
		const tocPagesNeeded = calculateTocPagesNeeded(sections);
		pageCount += tocPagesNeeded;
	}

	const contentPages = generateContentPages(sections);
	pageCount += contentPages.length;

	return pageCount;
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
		case "section": {
			const siblingSections = sections
				.filter((s) => s.parentId === section.parentId && s.type === "section")
				.sort((a, b) => (a.order || 0) - (b.order || 0));
			const sectionIndex =
				siblingSections.findIndex((s) => s.id === section.id) + 1;
			return section.title
				? `Section ${sectionIndex}: ${section.title}`
				: `Section ${sectionIndex}`;
		}
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

// --- Print/PDF HTML generation ---

// Format inline text with bold, italics, etc. for print
const formatInlineTextForPrint = (text: string) => {
	text = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
	text = text.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "<em>$1</em>");
	return text;
};

// Enhanced content parsing for print output
const parseContentForPrint = (content: string) => {
	const parts = content.split(/(\[IMAGE:[^\]]*\])/g);
	let html = "";

	parts.forEach((part) => {
		if (part.match(/^\[IMAGE:[^\]]*\]$/)) {
			const description = part.replace(/^\[IMAGE:/, "").replace(/\]$/, "");
			html += `<div class="image-placeholder">
                <strong>Image:</strong> ${description || "Add image description"}
              </div>`;
		} else if (part.trim()) {
			const paragraphs = part.split("\n\n").filter((p) => p.trim());

			paragraphs.forEach((paragraph) => {
				const trimmed = paragraph.trim();

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
				} else if (/^[-*]\s/.test(trimmed)) {
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
				} else if (trimmed.includes("├──") || trimmed.includes("└──")) {
					const safe = trimmed
						.replace(/&/g, "&amp;")
						.replace(/</g, "&lt;")
						.replace(/>/g, "&gt;");
					html += `<pre class="org-tree-pre">${safe}</pre>`;
				} else {
					html += `<p>${formatInlineTextForPrint(trimmed)}</p>`;
				}
			});
		}
	});

	return html;
};

export const renderSectionContent = (section: ConstitutionSection) => {
	return parseContentForPrint(section.content || "");
};

/**
 * Generate TOC HTML using logical grouping strategy
 */
const generateTOCHTML = (sections: ConstitutionSection[]): string => {
	const tocStructure = generateTOCStructure(sections);
	const contentPages = generateContentPages(sections);
	const tocPagesNeeded = calculateTocPagesNeeded(sections);
	const contentStartPage = 2 + tocPagesNeeded;

	const sectionToPageMap = new Map<string, number>();
	contentPages.forEach((page, pageIndex) => {
		const actualPageNumber = contentStartPage + pageIndex;
		page.forEach((section) => {
			sectionToPageMap.set(section.id, actualPageNumber);
		});
	});

	const renderEntries = (entries: TOCEntry[], depth: number = 0): string => {
		return entries
			.map((entry) => {
				const indentPx = depth * 24;
				let title = "";
				if (entry.section.type === "article") {
					const articles = sections
						.filter((s) => s.type === "article")
						.sort((a, b) => (a.order || 0) - (b.order || 0));
					const articleIndex = articles.findIndex(
						(a) => a.id === entry.section.id,
					);
					title = getSectionPrintTitle(entry.section, articleIndex, sections);
				} else if (entry.section.type === "amendment") {
					const amendments = sections
						.filter((s) => s.type === "amendment")
						.sort((a, b) => (a.order || 0) - (b.order || 0));
					const amendmentIndex = amendments.findIndex(
						(a) => a.id === entry.section.id,
					);
					title = getSectionPrintTitle(entry.section, amendmentIndex, sections);
				} else {
					title = getSectionDisplayTitle(entry.section, sections);
				}

				const pageNum = sectionToPageMap.get(entry.section.id) || "?";

				let html = `<div class="toc-entry" style="padding-left:${indentPx}px;">
          <span style="flex:1;">${title}</span>
          <span style="margin-left: auto;">${pageNum}</span>
        </div>`;

				if (entry.children.length > 0) {
					html += renderEntries(entry.children, depth + 1);
				}

				return html;
			})
			.join("");
	};

	return renderEntries(tocStructure);
};

export const generatePrintContent = (
	_constitution: Constitution | null,
	sections: ConstitutionSection[],
	/** Use absolute URLs (e.g. window.location.origin) so the logo loads in about:blank print windows */
	assetOrigin: string = "",
) => {
	const logoSrc = assetOrigin
		? `${assetOrigin.replace(/\/$/, "")}/logos/blue_logo_only.svg`
		: "/logos/blue_logo_only.svg";
	const preamble = sections.find((s) => s.type === "preamble");
	const articles = sections
		.filter((s) => s.type === "article")
		.sort((a, b) => (a.order || 0) - (b.order || 0));
	const amendments = sections
		.filter((s) => s.type === "amendment")
		.sort((a, b) => (a.order || 0) - (b.order || 0));

	let content = "";

	// Cover Page
	content += `
    <div class="constitution-page cover-page" style="display:flex; flex-direction:column; align-items:center; text-align:center;">
        <div class="logo-container" style="text-align: center; margin: 48px 0; width:100%;">
            <img src="${logoSrc}" alt="IEEE Logo" style="width: 120px; height: 120px; object-fit: contain; margin: 0 auto; display: block;" />
        </div>
        <h1 style="font-size: 28pt; line-height: 1.1; margin-bottom: 24px; text-align:center; width:100%;">IEEE at UC San Diego</h1>
        <h2 class="cover-subtitle" style="font-size: 16pt; line-height: 1.3; margin-bottom: 48px; font-weight: 600; width:100%;">The Institute of Electrical and Electronics Engineers at UC San Diego Constitution</h2>
        <div style="text-align: center; margin-top: 48px; width:100%;">
            <p class="cover-meta" style="font-size: 14pt; margin-bottom: 12px;">
                Last Updated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
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
        ${generateTOCHTML(sections)}
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

		articleSections.forEach((section) => {
			content += `
            <div class="constitution-section" id="section-${section.id}">
                <h3 class="section-title">${getSectionPrintTitle(section, 0, sections)}</h3>
                ${renderSectionContent(section)}
            </div>`;

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
) => {
	const assetOrigin =
		typeof window !== "undefined" && window.location?.origin
			? window.location.origin
			: "";
	const printContent = generatePrintContent(
		constitution,
		sections,
		assetOrigin,
	);

	return `<!DOCTYPE html>
<html>
<head>
    <title>IEEE at UC San Diego Constitution</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { box-sizing: border-box; }

        body {
            font-family: Arial, sans-serif;
            font-size: 12pt;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            color: #444;
            background: white;
        }

        .constitution-page {
            page-break-after: always;
            padding: 1in;
            background: white;
            position: relative;
            margin: 0 auto;
            box-sizing: border-box;
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
            color: #333;
        }

        .cover-page h2.cover-subtitle,
        .cover-page .cover-meta {
            text-align: center !important;
            width: 100% !important;
            margin-left: auto !important;
            margin-right: auto !important;
        }

        h2, h2.article-title {
            font-family: Arial, sans-serif !important;
            font-size: 18pt !important;
            font-weight: bold !important;
            text-align: left !important;
            margin-top: 20px !important;
            margin-bottom: 8px !important;
            page-break-after: avoid !important;
            color: #333 !important;
        }

        h3, h3.section-title {
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

        h4 {
            font-family: Arial, sans-serif;
            font-size: 11pt;
            font-weight: 600;
            text-align: left;
            margin-top: 10px;
            margin-bottom: 6px;
            page-break-after: avoid;
            color: #666;
        }

        p {
            font-family: Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            margin-bottom: 10px;
            text-align: justify;
            text-indent: 0;
            orphans: 2;
            widows: 2;
            color: #444;
        }

        ol.numbered-list, ul.bullet-list {
            font-family: Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            margin-bottom: 10px;
            padding-left: 20px;
            color: #444;
        }

        ol.numbered-list li, ul.bullet-list li {
            margin-bottom: 4px;
            text-align: justify;
        }

        pre.org-tree-pre {
            white-space: pre;
            font-family: "Courier New", Courier, monospace;
            font-size: 11pt;
            line-height: 1.4;
            margin: 12px 0;
            color: #444;
        }

        strong { font-weight: bold; }
        em { font-style: italic; }

        .toc-entry {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
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

        @page {
            size: letter;
            margin: 0.75in;
        }

        body {
            font-family: Arial, sans-serif !important;
            font-size: 12pt !important;
            line-height: 1.6 !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
        }

        .constitution-page {
            page-break-after: always;
            padding: 0 !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            overflow: visible !important;
        }

        .constitution-page:last-child {
            page-break-after: avoid;
        }

        h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        p {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        .constitution-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
    </style>
</head>
<body>
    ${printContent}
</body>
</html>`;
};
