import React, { useState } from 'react';
import {
    Plus,
    FileText,
    ChevronDown,
    ChevronRight,
    Lock,
    ChevronUp,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import type { ConstitutionSection } from '../types/firestore';
import { getSectionHierarchy, getSectionDisplayTitle, getSubsectionIndentLevel } from '../utils/constitutionUtils';
import AddSectionModal from './AddSectionModal';

interface ConstitutionSidebarProps {
    sections: ConstitutionSection[];
    selectedSection: string | null;
    expandedSections: Set<string>;
    activeCollaborators: Array<{ userId: string, userName: string, currentSection?: string }>;
    onSelectSection: (id: string) => void;
    onToggleExpand: (id: string) => void;
    onAddSection: (type: ConstitutionSection['type'], parentId?: string) => void;
    updateSection: (sectionId: string, updates: Partial<ConstitutionSection>) => void;
    currentUserId?: string;
}

const ConstitutionSidebar: React.FC<ConstitutionSidebarProps> = ({
    sections,
    selectedSection,
    expandedSections,
    activeCollaborators,
    onSelectSection,
    onToggleExpand,
    onAddSection,
    updateSection,
    currentUserId
}) => {
    const [showAddSection, setShowAddSection] = useState(false);

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
                                collaborators={activeCollaborators}
                                allSections={sections}
                                currentUserId={currentUserId}
                                onMoveUp={() => moveSection(section.id, 'up')}
                                onMoveDown={() => moveSection(section.id, 'down')}
                                canMoveUp={index > 0}
                                canMoveDown={index < childSections.length - 1}
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
        <div className="col-span-3">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900">Document Structure</h2>
                    <button
                        onClick={() => setShowAddSection(true)}
                        className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm shadow-sm"
                        title="Add new section"
                    >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Section
                    </button>
                </div>

                {sections.length === 0 ? (
                    <div className="text-center py-8">
                        <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-sm font-medium text-gray-900 mb-2">
                            No sections yet
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Start building your constitution by adding a preamble or first article.
                        </p>
                        <button
                            onClick={() => setShowAddSection(true)}
                            className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
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

            {/* Add Section Modal */}
            {showAddSection && (
                <AddSectionModal
                    onClose={() => setShowAddSection(false)}
                    onAddSection={(type, parentId) => {
                        onAddSection(type, parentId);
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
    collaborators: Array<{ userId: string, userName: string, currentSection?: string }>;
    allSections: ConstitutionSection[];
    currentUserId?: string;
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp: boolean;
    canMoveDown: boolean;
}> = ({
    section,
    isSelected,
    isExpanded,
    onSelect,
    onToggleExpand,
    collaborators,
    allSections,
    currentUserId,
    onMoveUp,
    onMoveDown,
    canMoveUp,
    canMoveDown
}) => {
        const hasChildren = allSections.some(s => s.parentId === section.id);
        const isBeingEdited = collaborators.some(c => c.currentSection === section.id && c.userId !== currentUserId);

        // Indentation is now handled by parent component nesting

        const getDisplayTitle = () => {
            return getSectionDisplayTitle(section, allSections);
        };

        return (
            <div
                className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
                onClick={() => onSelect(section.id)}
            >
                <div className="flex flex-col">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onMoveUp();
                        }}
                        disabled={!canMoveUp}
                        className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
                        className="p-1 hover:bg-gray-200 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
                        className="p-1 hover:bg-gray-200 rounded"
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                        ) : (
                            <ChevronRight className="h-3 w-3" />
                        )}
                    </button>
                )}

                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{getDisplayTitle()}</div>
                    <div className="text-xs text-gray-500 capitalize">{section.type}</div>
                </div>

                {isBeingEdited && (
                    <div className="flex items-center gap-1">
                        <Lock className="h-3 w-3 text-orange-500" />
                        <div className="h-2 w-2 bg-orange-500 rounded-full" title="Being edited by someone else" />
                    </div>
                )}
            </div>
        );
    };

export default ConstitutionSidebar; 