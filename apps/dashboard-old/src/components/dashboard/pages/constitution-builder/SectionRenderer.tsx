import React from 'react';
import type { ConstitutionSection } from '../../shared/types/firestore';
import { getSectionDisplayTitle, getSubsectionIndentLevel, toRomanNumeral } from './utils/constitutionUtils';

interface SectionRendererProps {
    section: ConstitutionSection;
    allSections: ConstitutionSection[];
    highlightedSectionId?: string;
}

// Enhanced content parsing function to handle markdown-like formatting
const parseContent = (content: string) => {
    // Split content by image markers first
    const parts = content.split(/(\[IMAGE:[^\]]*\])/g);

    return parts.map((part, partIndex) => {
        if (part.match(/^\[IMAGE:[^\]]*\]$/)) {
            const description = part.replace(/^\[IMAGE:/, '').replace(/\]$/, '');
            return {
                type: 'image',
                content: description || 'Add image description',
                key: `image-${partIndex}`
            };
        } else if (part.trim()) {
            // Split by double newlines to get paragraphs/list groups, but preserve spacing
            const paragraphs = part.split('\n\n').filter(p => p.trim());

            return paragraphs.map((paragraph, pIndex) => {
                // Don't trim here to preserve leading/trailing whitespace
                const content = paragraph;

                // Check if this is a numbered list
                if (/^\d+\.\s/.test(content.trim())) {
                    const listItems = content.split('\n').filter((line: string) => line.trim());
                    return {
                        type: 'numbered-list',
                        items: listItems.map((item: string) => {
                            const match = item.match(/^(\d+)\.\s(.+)$/);
                            if (match) {
                                return {
                                    number: match[1],
                                    content: formatInlineText(match[2])
                                };
                            }
                            return { number: '', content: formatInlineText(item) };
                        }),
                        key: `list-${partIndex}-${pIndex}`
                    };
                }

                // Check if this is a bullet list
                if (/^[-*]\s/.test(content.trim())) {
                    const listItems = content.split('\n').filter((line: string) => line.trim());
                    return {
                        type: 'bullet-list',
                        items: listItems.map((item: string) => {
                            const match = item.match(/^[-*]\s(.+)$/);
                            if (match) {
                                return formatInlineText(match[1]);
                            }
                            return formatInlineText(item);
                        }),
                        key: `bullet-${partIndex}-${pIndex}`
                    };
                }

                // Check if this looks like a tree structure (contains tree characters)
                const treeChars = /[├└│┌┐┘┌┬┴┼─]/;
                if (treeChars.test(content)) {
                    return {
                        type: 'tree-structure',
                        content: formatInlineText(content),
                        key: `tree-${partIndex}-${pIndex}`
                    };
                }

                // Regular paragraph
                return {
                    type: 'paragraph',
                    content: formatInlineText(content),
                    key: `para-${partIndex}-${pIndex}`
                };
            });
        }
        return null;
    }).filter(Boolean).flat();
};

// Format inline text with bold, italics, etc.
const formatInlineText = (text: string) => {
    // Handle bold text **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Handle italic text *text* (but not if it's part of **)
    text = text.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');

    return text;
};

const SectionRenderer: React.FC<SectionRendererProps> = ({ section, allSections, highlightedSectionId = '' }) => {
    const getDisplayTitle = () => {
        // Use the same title generation logic as PDF for consistency
        switch (section.type) {
            case 'preamble':
                return 'PREAMBLE';
            case 'article':
                const articles = allSections.filter(s => s.type === 'article').sort((a, b) => (a.order || 0) - (b.order || 0));
                const articleIndex = articles.findIndex(a => a.id === section.id) + 1;
                return section.title ? `Article ${toRomanNumeral(articleIndex)}: ${section.title}` : `Article ${toRomanNumeral(articleIndex)}`;
            case 'section':
                const siblingSections = allSections
                    .filter(s => s.parentId === section.parentId && s.type === 'section')
                    .sort((a, b) => (a.order || 0) - (b.order || 0));
                const sectionIndex = siblingSections.findIndex(s => s.id === section.id) + 1;
                return section.title ? `Section ${sectionIndex}: ${section.title}` : `Section ${sectionIndex}`;
            case 'subsection':
                return getSectionDisplayTitle(section, allSections);
            case 'amendment':
                const amendments = allSections.filter(s => s.type === 'amendment').sort((a, b) => (a.order || 0) - (b.order || 0));
                const amendmentIndex = amendments.findIndex(a => a.id === section.id) + 1;
                return section.title ? `AMENDMENT ${amendmentIndex}: ${section.title.toUpperCase()}` : `AMENDMENT ${amendmentIndex}`;
            default:
                return section.title || 'Untitled Section';
        }
    };

    const getTitleStyle = () => {
        const baseStyle = {
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold' as const,
            pageBreakAfter: 'avoid' as const,
            color: '#333'  // Default color for articles and main sections
        };

        switch (section.type) {
            case 'preamble':
                return {
                    ...baseStyle,
                    fontSize: '18pt',
                    textAlign: 'center' as const,
                    marginBottom: '8px',   // Match PDF exactly
                    marginTop: '20px',     // Match PDF exactly
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1px'
                };
            case 'article':
                return {
                    ...baseStyle,
                    fontSize: '18pt',
                    textAlign: 'left' as const,
                    marginBottom: '8px',   // Match PDF exactly
                    marginTop: '20px'      // Match PDF exactly
                };
            case 'section':
                return {
                    ...baseStyle,
                    fontSize: '12pt',
                    textAlign: 'left' as const,
                    marginBottom: '8px',   // Match PDF exactly
                    marginTop: '12px',     // Match PDF exactly
                    color: '#555'
                };
            case 'subsection':
                return {
                    ...baseStyle,
                    fontSize: '11pt',
                    fontWeight: '600' as const,
                    marginBottom: '6px',   // Match PDF exactly
                    marginTop: '10px',     // Match PDF exactly
                    color: '#666'
                };
            case 'amendment':
                return {
                    ...baseStyle,
                    fontSize: '18pt',
                    textAlign: 'center' as const,
                    marginBottom: '8px',   // Match PDF exactly
                    marginTop: '20px'      // Match PDF exactly
                };
            default:
                return {
                    ...baseStyle,
                    fontSize: '11pt',
                    fontWeight: '600' as const,
                    marginBottom: '6px',
                    marginTop: '10px'
                };
        }
    };

    const getContentStyle = () => {
        return {
            fontFamily: 'Arial, sans-serif',
            fontSize: '11pt',
            lineHeight: '1.5',    // Updated to match PDF exactly (1.5)
            color: '#444',
            textAlign: 'justify' as const
        };
    };

    const getIndentStyle = () => {
        if (section.type === 'subsection') {
            const indentLevel = getSubsectionIndentLevel(section, allSections);
            return { marginLeft: `${indentLevel * 24}px` };
        }
        return {};
    };

    const renderParsedContent = (content: string) => {
        const parsedContent = parseContent(content);

        return parsedContent.map((item: any) => {
            switch (item.type) {
                case 'image':
                    return (
                        <div key={item.key} style={{
                            border: '2px dashed #ccc',
                            padding: '24px',
                            textAlign: 'center',
                            margin: '16px 0',
                            background: '#f9f9f9',
                            pageBreakInside: 'avoid',
                            fontFamily: 'Arial, sans-serif'
                        }}>
                            <strong>Image:</strong> {item.content}
                        </div>
                    );

                case 'numbered-list':
                    return (
                        <ol key={item.key} style={{
                            fontFamily: 'Arial, sans-serif',
                            fontSize: '11pt',     // Reduced from 12pt to 11pt
                            lineHeight: '1.5',    // Slightly tighter
                            marginBottom: '10px',
                            paddingLeft: '20px',  // Slightly less padding
                            color: '#444'         // Softer dark gray
                        }}>
                            {item.items.map((listItem: any, idx: number) => (
                                <li key={idx} style={{
                                    marginBottom: '4px',  // Reduced spacing
                                    textAlign: 'justify',
                                    whiteSpace: 'pre-wrap' // Preserve whitespace
                                }}>
                                    <span dangerouslySetInnerHTML={{ __html: listItem.content }} />
                                </li>
                            ))}
                        </ol>
                    );

                case 'bullet-list':
                    return (
                        <ul key={item.key} style={{
                            fontFamily: 'Arial, sans-serif',
                            fontSize: '11pt',     // Reduced from 12pt to 11pt
                            lineHeight: '1.5',    // Slightly tighter
                            marginBottom: '10px',
                            paddingLeft: '20px',  // Slightly less padding
                            color: '#444'         // Softer dark gray
                        }}>
                            {item.items.map((listItem: any, idx: number) => (
                                <li key={idx} style={{
                                    marginBottom: '4px',  // Reduced spacing
                                    textAlign: 'justify',
                                    whiteSpace: 'pre-wrap' // Preserve whitespace
                                }}>
                                    <span dangerouslySetInnerHTML={{ __html: listItem }} />
                                </li>
                            ))}
                        </ul>
                    );

                case 'tree-structure':
                    return (
                        <pre key={item.key} style={{
                            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                            fontSize: '10pt',     // Slightly smaller for better alignment
                            lineHeight: '1.4',    // Tighter for tree structures
                            marginBottom: '10px',
                            textAlign: 'left',    // Left align for tree structures
                            textIndent: '0',
                            orphans: 2,
                            widows: 2,
                            color: '#444',
                            whiteSpace: 'pre',    // Preserve exact spacing
                            overflow: 'auto',     // Handle long lines
                            background: '#f8f9fa', // Light background for distinction
                            padding: '8px',
                            borderRadius: '4px',
                            border: '1px solid #e9ecef'
                        }}>
                            <span dangerouslySetInnerHTML={{ __html: item.content }} />
                        </pre>
                    );

                case 'paragraph':
                default:
                    return (
                        <p key={item.key} style={{
                            fontFamily: 'Arial, sans-serif',
                            fontSize: '11pt',     // Reduced from 12pt to 11pt
                            lineHeight: '1.5',    // Slightly tighter
                            marginBottom: '10px', // Reduced spacing
                            textAlign: 'justify',
                            textIndent: '0',      // Remove text indentation
                            orphans: 2,
                            widows: 2,
                            color: '#444',        // Softer dark gray
                            whiteSpace: 'pre-wrap' // Preserve whitespace and line breaks
                        }}>
                            <span dangerouslySetInnerHTML={{ __html: item.content }} />
                        </p>
                    );
            }
        });
    };

    // Determine the correct HTML tag based on section type
    const getHeadingTag = () => {
        switch (section.type) {
            case 'preamble':
            case 'article':
            case 'amendment':
                return 'h2';  // Articles, preambles, and amendments use h2
            case 'section':
                return 'h3';  // Sections use h3
            case 'subsection':
                return 'h4';  // Subsections use h4
            default:
                return 'h4';  // Default to h4 for other types
        }
    };

    const HeadingTag = getHeadingTag() as keyof React.JSX.IntrinsicElements;

    // Check if this section should be highlighted
    const isHighlighted = highlightedSectionId === section.id;

    return (
        <div
            id={`section-${section.id}`}
            style={{
                marginBottom: section.type === 'article' ? '8px' : '14px',  // Reduced spacing for better density
                ...getIndentStyle(),
                ...(isHighlighted && {
                    backgroundColor: '#fef08a',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '2px solid #f59e0b',
                    animation: 'section-highlight-fade 3s ease-out'
                })
            }}
        >
            <HeadingTag style={getTitleStyle()}>
                {getDisplayTitle()}
            </HeadingTag>

            {/* Articles should not render content, only title */}
            {section.content && section.type !== 'article' && (
                <div style={getContentStyle()}>
                    {renderParsedContent(section.content)}
                </div>
            )}
        </div>
    );
};

export default SectionRenderer;