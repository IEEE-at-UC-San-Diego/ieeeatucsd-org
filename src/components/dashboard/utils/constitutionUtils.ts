import type { ConstitutionSection } from '../types/firestore';

export const toRomanNumeral = (num: number): string => {
    const romanNumerals = [
        { value: 1000, symbol: 'M' },
        { value: 900, symbol: 'CM' },
        { value: 500, symbol: 'D' },
        { value: 400, symbol: 'CD' },
        { value: 100, symbol: 'C' },
        { value: 90, symbol: 'XC' },
        { value: 50, symbol: 'L' },
        { value: 40, symbol: 'XL' },
        { value: 10, symbol: 'X' },
        { value: 9, symbol: 'IX' },
        { value: 5, symbol: 'V' },
        { value: 4, symbol: 'IV' },
        { value: 1, symbol: 'I' }
    ];

    let result = '';
    for (const { value, symbol } of romanNumerals) {
        while (num >= value) {
            result += symbol;
            num -= value;
        }
    }
    return result;
};

export const getSectionHierarchy = (sections: ConstitutionSection[]) => {
    const hierarchy: ConstitutionSection[] = [];
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);

    sortedSections.forEach(section => {
        hierarchy.push(section);
    });

    return hierarchy;
};

export const getSectionDisplayTitle = (section: ConstitutionSection, allSections: ConstitutionSection[]) => {
    switch (section.type) {
        case 'preamble':
            return 'Preamble';
        case 'article':
            const articles = allSections.filter(s => s.type === 'article').sort((a, b) => a.order - b.order);
            const articleIndex = articles.findIndex(a => a.id === section.id) + 1;
            return section.title ? `Article ${toRomanNumeral(articleIndex)} - ${section.title}` : `Article ${toRomanNumeral(articleIndex)}`;
        case 'section':
            const siblingSections = allSections.filter(s => s.parentId === section.parentId && s.type === 'section').sort((a, b) => a.order - b.order);
            const sectionIndex = siblingSections.findIndex(s => s.id === section.id) + 1;
            return section.title ? `Section ${sectionIndex} - ${section.title}` : `Section ${sectionIndex}`;
        case 'subsection':
            return getSubsectionDisplayTitle(section, allSections);
        case 'amendment':
            const amendments = allSections.filter(s => s.type === 'amendment').sort((a, b) => a.order - b.order);
            const amendmentIndex = amendments.findIndex(a => a.id === section.id) + 1;
            return section.title ? `Amendment ${amendmentIndex} - ${section.title}` : `Amendment ${amendmentIndex}`;
        default:
            return section.title || 'Untitled Section';
    }
};

export const getSubsectionDisplayTitle = (section: ConstitutionSection, allSections: ConstitutionSection[]): string => {
    // Find the root section by traversing up the hierarchy
    const findRootSection = (currentSection: ConstitutionSection): ConstitutionSection | null => {
        if (currentSection.type === 'section') {
            return currentSection;
        }

        if (currentSection.parentId) {
            const parent = allSections.find(s => s.id === currentSection.parentId);
            if (parent) {
                return findRootSection(parent);
            }
        }

        return null;
    };

    const rootSection = findRootSection(section);
    if (!rootSection) return `Subsection - ${section.title}`;

    // Get section number by finding its position among sibling sections
    const articleSections = allSections
        .filter(s => s.parentId === rootSection.parentId && s.type === 'section')
        .sort((a, b) => a.order - b.order);
    const sectionNumber = articleSections.findIndex(s => s.id === rootSection.id) + 1;

    // Build subsection hierarchy
    const buildHierarchy = (currentSection: ConstitutionSection): string => {
        const parent = allSections.find(s => s.id === currentSection.parentId);
        if (!parent) return '';

        const siblings = allSections
            .filter(s => s.parentId === currentSection.parentId && s.type === 'subsection')
            .sort((a, b) => a.order - b.order);
        const index = siblings.findIndex(s => s.id === currentSection.id) + 1;

        if (parent.type === 'section') {
            return `${sectionNumber}.${index}`;
        } else if (parent.type === 'subsection') {
            const parentNumber = buildHierarchy(parent);
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            return `${parentNumber}${letters[index - 1] || index}`;
        }

        return '';
    };

    const subsectionNumber = buildHierarchy(section);
    return section.title ? `Subsection ${subsectionNumber} - ${section.title}` : `Subsection ${subsectionNumber}`;
};

export const getSubsectionIndentLevel = (section: ConstitutionSection, allSections: ConstitutionSection[]): number => {
    if (section.type === 'preamble') return 0;
    if (section.type === 'article') return 0;
    if (section.type === 'amendment') return 0;
    if (section.type === 'section') return 1;

    if (section.type === 'subsection') {
        // Calculate nesting depth for subsections
        let depth = 2;
        let currentParentId = section.parentId;

        while (currentParentId) {
            const parent = allSections.find(s => s.id === currentParentId);
            if (parent && parent.type === 'subsection') {
                depth++;
                currentParentId = parent.parentId;
            } else {
                break;
            }
        }
        return depth;
    }

    return 0;
};

export const validateSectionMove = (
    movedSection: ConstitutionSection,
    destinationIndex: number,
    hierarchy: ConstitutionSection[]
): { isValid: boolean; newParentId?: string; message?: string } => {
    if (movedSection.type === 'preamble' || movedSection.type === 'amendment') {
        return { isValid: true }; // These don't have parents
    }

    if (movedSection.type === 'article') {
        return { isValid: true }; // Articles don't have parents
    }

    if (movedSection.type === 'section') {
        // Find the nearest article before destination
        for (let i = destinationIndex - 1; i >= 0; i--) {
            if (hierarchy[i].type === 'article') {
                return { isValid: true, newParentId: hierarchy[i].id };
            }
        }
        return { isValid: false, message: 'Sections must be placed under an article' };
    }

    if (movedSection.type === 'subsection') {
        // Find the nearest section or subsection before destination
        for (let i = destinationIndex - 1; i >= 0; i--) {
            if (hierarchy[i].type === 'section' || hierarchy[i].type === 'subsection') {
                return { isValid: true, newParentId: hierarchy[i].id };
            }
        }
        return { isValid: false, message: 'Subsections must be placed under a section or another subsection' };
    }

    return { isValid: false, message: 'Invalid section type' };
};

export const getAllSectionDescendants = (parentId: string, allSections: ConstitutionSection[]): ConstitutionSection[] => {
    const getChildren = (id: string): ConstitutionSection[] => {
        return allSections.filter(s => s.parentId === id);
    };

    const children = getChildren(parentId);
    const descendants = [...children];
    
    children.forEach(child => {
        descendants.push(...getAllSectionDescendants(child.id, allSections));
    });
    
    return descendants;
}; 