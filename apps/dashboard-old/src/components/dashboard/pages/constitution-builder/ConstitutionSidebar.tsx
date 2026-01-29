import React, { useState, useEffect, useRef } from 'react';
import {
    Plus,
    FileText,
    ChevronDown,
    ChevronRight,
    ChevronUp,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import type { ConstitutionSection } from '../../shared/types/firestore';
import { getSectionHierarchy, getSectionDisplayTitle, getSubsectionIndentLevel } from './utils/constitutionUtils';
import AddSectionModal from './AddSectionModal';

interface ConstitutionSidebarProps {
    sections: ConstitutionSection[];
    selectedSection: string | null;
    expandedSections: Set<string>;
    onSelectSection: (id: string) => void;
    onToggleExpand: (id: string) => void;
    onAddSection: (type: ConstitutionSection['type'], parentId?: string, title?: string, content?: string) => void;
    updateSection: (sectionId: string, updates: Partial<ConstitutionSection>) => void;
    currentUserId?: string;

}

const ConstitutionSidebar: React.FC<ConstitutionSidebarProps> = ({
    sections,
    selectedSection,
    expandedSections,
    onSelectSection,
    onToggleExpand,
    onAddSection,
    updateSection,
    currentUserId
}) => {
    const [showAddSection, setShowAddSection] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const selectedSectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Auto-scroll to selected section
    useEffect(() => {
        if (selectedSection && scrollContainerRef.current) {
            const selectedElement = selectedSectionRefs.current.get(selectedSection);
            if (selectedElement) {
                selectedElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }
        }
    }, [selectedSection]);

    const moveSection = async (sectionId: string, direction: 'up' | 'down') => {
        const currentSection = sections.find(s => s.id === sectionId);
        if (!currentSection) return;

        // Get sibling sections (same parent)
        const siblings = sections
            .filter(s => (currentSection.parentId ? s.parentId === currentSection.parentId : !s.parentId))
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        const currentIndex = siblings.findIndex(s => s.id === sectionId);
        if (currentIndex === -1) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= siblings.length) return;

        // Swap the order values with the sibling
        const targetSection = siblings[newIndex];

        await Promise.all([
            updateSection(currentSection.id, { order: targetSection.order }),
            updateSection(targetSection.id, { order: currentSection.order })
        ]);
    };

    const renderSectionHierarchy = (allSections: ConstitutionSection[], parentId: string | null, depth: number): React.ReactNode => {
        const childSections = allSections
            .filter(s => (parentId === null ? !s.parentId : s.parentId === parentId))
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        return (
            <>
                {childSections.map((section, index) => {
                    const isExpanded = expandedSections.has(section.id);
                    const hasChildren = allSections.some(s => s.parentId === section.id);

                    return (
                        <div key={section.id}>
                            <SectionNavigationItem
                                section={section}
                                isSelected={selectedSection === section.id}
                                isExpanded={isExpanded}
                                onSelect={onSelectSection}
                                onToggleExpand={onToggleExpand}
                                allSections={sections}
                                currentUserId={currentUserId}
                                onMoveUp={() => moveSection(section.id, 'up')}
                                onMoveDown={() => moveSection(section.id, 'down')}
                                canMoveUp={index > 0}
                                canMoveDown={index < childSections.length - 1}
                                sectionRefs={selectedSectionRefs}
                            />
                            {hasChildren && isExpanded && (
                                <div className="ml-4">
                                    {renderSectionHierarchy(allSections, section.id, depth + 1)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </>
        );
    };

    return (
        <div className="flex flex-col">
            <div className="bg-white rounded-lg border border-gray-200 flex flex-col max-h-[500px] md:max-h-[450px] lg:max-h-[600px] min-h-[350px]">
                {/* Fixed header */}
                <div className="flex flex-col gap-3 p-3 md:p-4 border-b border-gray-200 flex-shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-3">
                        <div className="min-w-0 flex-1">
                            <h2 className="font-semibold text-gray-900 text-sm md:text-base">Document Structure</h2>
                            <p className="text-xs text-gray-400 hidden md:block">Adopted since September 2006</p>
                        </div>
                        {/* Add Section button - hidden on desktop (lg+), shown on mobile/tablet */}
                        <button
                            onClick={() => setShowAddSection(true)}
                            className="lg:hidden inline-flex items-center justify-center px-2 md:px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm shadow-sm min-h-[40px] md:min-h-[44px] w-full sm:w-auto"
                            title="Add new section"
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Add Section</span>
                            <span className="sm:hidden">Add</span>
                        </button>
                    </div>

                    {/* Add Block button - shown only on desktop (lg+) below the title */}
                    <div className="hidden lg:block">
                        <button
                            onClick={() => setShowAddSection(true)}
                            className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm min-h-[44px]"
                            title="Add new block"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Block
                        </button>
                    </div>
                </div>

                {/* Scrollable content area */}
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-3 md:p-4 constitution-sidebar-scroll">
                    {sections.length === 0 ? (
                        <div className="text-center py-6 md:py-8">
                            <FileText className="h-10 w-10 md:h-12 md:w-12 text-gray-300 mx-auto mb-3 md:mb-4" />
                            <h3 className="text-sm font-medium text-gray-900 mb-2">
                                No sections yet
                            </h3>
                            <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4">
                                Start building your constitution by adding a preamble or first article.
                            </p>
                            <button
                                onClick={() => setShowAddSection(true)}
                                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm min-h-[40px]"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add First Section
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {renderSectionHierarchy(sections, null, 0)}
                        </div>
                    )}
                </div>

            </div>

            {/* Add Section Modal */}
            {showAddSection && (
                <AddSectionModal
                    onClose={() => setShowAddSection(false)}
                    onAddSection={(type, parentId, title, content) => {
                        onAddSection(type, parentId, title, content);
                        setShowAddSection(false);
                    }}
                    sections={sections}
                />
            )}
        </div>
    );
};

// Section Navigation Item Component
const SectionNavigationItem: React.FC<{
    section: ConstitutionSection;
    isSelected: boolean;
    isExpanded: boolean;
    onSelect: (id: string) => void;
    onToggleExpand: (id: string) => void;
    allSections: ConstitutionSection[];
    currentUserId?: string;
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
    sectionRefs: { current: Map<string, HTMLDivElement> };
}> = ({
    section,
    isSelected,
    isExpanded,
    onSelect,
    onToggleExpand,
    allSections,
    currentUserId,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown,
    sectionRefs
}) => {
        const hasChildren = allSections.some(s => s.parentId === section.id);

        // Indentation is now handled by parent component nesting

        const getDisplayTitle = () => {
            return getSectionDisplayTitle(section, allSections);
        };

        return (
            <div
                ref={(el) => {
                    if (el) {
                        sectionRefs.current.set(section.id, el);
                    } else {
                        sectionRefs.current.delete(section.id);
                    }
                }}
                className={`flex items-center gap-1 md:gap-2 p-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
                onClick={() => onSelect(section.id)}
            >
                <div className="flex flex-col">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onMoveUp();
                        }}
                        disabled={!canMoveUp}
                        className="p-0.5 md:p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-h-[24px] min-w-[24px] flex items-center justify-center"
                        title="Move up"
                    >
                        <ArrowUp className="h-3 w-3 text-gray-600" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onMoveDown();
                        }}
                        disabled={!canMoveDown}
                        className="p-0.5 md:p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-h-[24px] min-w-[24px] flex items-center justify-center"
                        title="Move down"
                    >
                        <ArrowDown className="h-3 w-3 text-gray-600" />
                    </button>
                </div>

                {hasChildren && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(section.id);
                        }}
                        className="p-0.5 md:p-1 hover:bg-gray-200 rounded min-h-[24px] min-w-[24px] flex items-center justify-center"
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                        ) : (
                            <ChevronRight className="h-3 w-3" />
                        )}
                    </button>
                )}

                <div className="flex-1 min-w-0">
                    <div className="text-xs md:text-sm font-medium truncate">{getDisplayTitle()}</div>
                    <div className="text-xs text-gray-500 capitalize">{section.type}</div>
                </div>
            </div>
        );
    };

export default ConstitutionSidebar; 