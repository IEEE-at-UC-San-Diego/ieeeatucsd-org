import React, { useState, useEffect } from 'react';
import type { ConstitutionSection } from '../types/firestore';
import { useConstitutionData } from '../hooks/useConstitutionData';
import { exportToPDF } from '../utils/printUtils';
import { getSectionHierarchy } from '../utils/constitutionUtils';
import ConstitutionHeader from '../components/ConstitutionHeader';
import ConstitutionSidebar from '../components/ConstitutionSidebar';
import ConstitutionEditor from '../components/ConstitutionEditor';
import ConstitutionPreview from '../components/ConstitutionPreview';

interface ConstitutionBuilderContentProps { }

const ConstitutionBuilderContent: React.FC<ConstitutionBuilderContentProps> = () => {
    const {
        constitution,
        sections,
        activeCollaborators,
        autoSaveStatus,
        lastSaved,
        unsavedChanges,
        isLoading,
        addSection,
        updateSection,
        debouncedAutoSave,
        deleteSection,
        updateUserPresence,
        user
    } = useConstitutionData();

    const [currentView, setCurrentView] = useState<'editor' | 'preview'>('editor');
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [editingSection, setEditingSection] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);

    // Update user presence when selected section changes
    useEffect(() => {
        if (user) {
            const presenceTimeout = setTimeout(() => {
                updateUserPresence(selectedSection);
            }, 1000); // Debounce presence updates

            return () => clearTimeout(presenceTimeout);
        }
    }, [selectedSection, user, updateUserPresence]);

    const toggleSectionExpansion = (sectionId: string) => {
        const newExpanded = new Set(expandedSections);
        if (newExpanded.has(sectionId)) {
            newExpanded.delete(sectionId);
        } else {
            newExpanded.add(sectionId);
        }
        setExpandedSections(newExpanded);
    };

    const handlePrint = () => {
        exportToPDF(constitution, sections);
    };

    const handleDeleteSection = async (sectionId: string) => {
        await deleteSection(sectionId);

        if (selectedSection === sectionId) {
            setSelectedSection(null);
        }
        if (editingSection === sectionId) {
            setEditingSection(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            <ConstitutionHeader
                autoSaveStatus={autoSaveStatus}
                lastSaved={lastSaved}
                unsavedChanges={unsavedChanges}
                activeCollaborators={activeCollaborators}
                currentView={currentView}
                onViewChange={setCurrentView}
                onExport={handlePrint}
            />

            <div className="grid grid-cols-12 gap-6">
                <ConstitutionSidebar
                    sections={sections}
                    selectedSection={selectedSection}
                    expandedSections={expandedSections}
                    activeCollaborators={activeCollaborators}
                    onSelectSection={setSelectedSection}
                    onToggleExpand={toggleSectionExpansion}
                    onAddSection={addSection}
                    updateSection={updateSection}
                    currentUserId={user?.uid}
                />

                {/* Main Content */}
                <div className="col-span-9">
                    {currentView === 'editor' ? (
                        <ConstitutionEditor
                            sections={sections}
                            selectedSection={selectedSection}
                            editingSection={editingSection}
                            onSelectSection={setSelectedSection}
                            onEditSection={setEditingSection}
                            onUpdateSection={updateSection}
                            onDeleteSection={handleDeleteSection}
                            onAddSection={addSection}
                            activeCollaborators={activeCollaborators}
                            debouncedAutoSave={debouncedAutoSave}
                            currentUserId={user?.uid}
                        />
                    ) : (
                        <ConstitutionPreview
                            constitution={constitution}
                            sections={getSectionHierarchy(sections)}
                            onPrint={handlePrint}
                            currentPage={currentPage}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConstitutionBuilderContent; 