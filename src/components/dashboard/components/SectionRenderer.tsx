import React from 'react';
import { Image } from 'lucide-react';
import type { ConstitutionSection } from '../types/firestore';
import { getSectionDisplayTitle, getSubsectionIndentLevel } from '../utils/constitutionUtils';

interface SectionRendererProps {
    section: ConstitutionSection;
    allSections: ConstitutionSection[];
}

const SectionRenderer: React.FC<SectionRendererProps> = ({ section, allSections }) => {
    const getDisplayTitle = () => {
        return getSectionDisplayTitle(section, allSections);
    };

    const getTextClass = () => {
        switch (section.type) {
            case 'preamble':
                return 'text-lg font-bold text-center mb-4 uppercase tracking-wide';
            case 'article':
                return 'text-xl font-bold mb-4 text-center';
            case 'section':
                return 'text-base font-bold mb-3 mt-6';
            case 'subsection':
                return 'text-base font-semibold mb-2';
            case 'amendment':
                return 'text-xl font-bold text-center mb-4';
            default:
                return 'text-base font-semibold mb-3';
        }
    };

    const getContentClass = () => {
        switch (section.type) {
            case 'preamble':
                return 'text-base leading-relaxed text-justify mb-8';
            case 'article':
                return 'text-base leading-relaxed mb-6';
            case 'section':
                return 'text-base leading-relaxed mb-4 text-justify';
            case 'subsection':
                return 'text-base leading-relaxed mb-3 text-justify';
            case 'amendment':
                return 'text-base leading-relaxed mb-6 text-justify';
            default:
                return 'text-base leading-relaxed mb-4 text-justify';
        }
    };

    const getIndentStyle = () => {
        if (section.type === 'subsection') {
            const indentLevel = getSubsectionIndentLevel(section, allSections);
            return { marginLeft: `${indentLevel * 24}px` };
        }
        return {};
    };

    const renderContentWithImages = (content: string) => {
        // Split content by image markers and render accordingly
        const parts = content.split(/(\[IMAGE:[^\]]*\])/g);

        return parts.map((part, index) => {
            if (part.match(/^\[IMAGE:[^\]]*\]$/)) {
                const description = part.replace(/^\[IMAGE:/, '').replace(/\]$/, '');
                return (
                    <div key={index} className="my-6 text-center">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 bg-gray-50">
                            <Image className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500 italic">
                                Image: {description || 'Add image description'}
                            </p>
                        </div>
                    </div>
                );
            } else if (part.trim()) {
                return part.split('\n\n').map((paragraph, pIndex) => (
                    paragraph.trim() && (
                        <p key={`${index}-${pIndex}`} className="mb-4" style={{ textIndent: '0.5in' }}>
                            {paragraph.trim()}
                        </p>
                    )
                ));
            }
            return null;
        }).filter(Boolean);
    };

    return (
        <div className="constitution-section mb-8" style={getIndentStyle()}>
            <h3 className={getTextClass()} style={{
                fontFamily: 'Arial, sans-serif',
                fontSize: section.type === 'article' ? '18pt' : section.type === 'section' ? '14pt' : '12pt'
            }}>
                {getDisplayTitle()}
            </h3>

            {section.content && (
                <div className={getContentClass()} style={{
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '12pt',
                    lineHeight: '1.6'
                }}>
                    {renderContentWithImages(section.content)}
                </div>
            )}
        </div>
    );
};

export default SectionRenderer; 