import React, { useState, useEffect } from 'react';
import type { ConstitutionSection } from '../types/firestore';
import { useConstitutionData } from '../hooks/useConstitutionData';
import { getSectionHierarchy } from '../utils/constitutionUtils';
import ConstitutionHeader from '../components/ConstitutionHeader';
import ConstitutionSidebar from '../components/ConstitutionSidebar';
import ConstitutionEditor from '../components/ConstitutionEditor';
import ConstitutionPreview from '../components/ConstitutionPreview';
import { ConstitutionAuditLog } from '../components/ConstitutionAuditLog';
import VersionEditor from '../components/VersionEditor';

interface ConstitutionBuilderContentProps { }

const ConstitutionBuilderContent: React.FC<ConstitutionBuilderContentProps> = () => {
    const {
        constitution,
        sections,
        saveStatus,
        lastSaved,
        isLoading,
        addSection,
        updateSection,
        deleteSection,
        updateConstitutionVersion,
        constitutionId,
        user
    } = useConstitutionData();

    const [currentView, setCurrentView] = useState<'editor' | 'preview' | 'audit'>('editor');
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [editingSection, setEditingSection] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);

    // Removed collaboration functionality

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
        // Set the preview to PDF capture mode for optimal printing
        setCurrentView('preview');

        // Add print class to body to trigger print-only styles
        document.body.classList.add('constitution-print-mode');

        // Small delay to ensure the preview is rendered properly
        setTimeout(() => {
            // Trigger the browser's native print dialog
            window.print();

            // Remove print class after printing (when dialog closes)
            // Use a longer timeout to ensure print dialog has time to capture the styles
            setTimeout(() => {
                document.body.classList.remove('constitution-print-mode');
            }, 1000);
        }, 100);
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
                saveStatus={saveStatus}
                lastSaved={lastSaved}
                currentView={currentView}
                onViewChange={setCurrentView}
                onPrint={handlePrint}
            />

            {/* Version Editor */}
            <div className="mb-4 flex justify-end">
                <VersionEditor
                    constitution={constitution}
                    onUpdateVersion={updateConstitutionVersion}
                />
            </div>

            <div className="grid grid-cols-12 gap-6">
                <ConstitutionSidebar
                    sections={sections}
                    selectedSection={selectedSection}
                    expandedSections={expandedSections}
                    onSelectSection={setSelectedSection}
                    onToggleExpand={toggleSectionExpansion}
                    onAddSection={addSection}
                    updateSection={updateSection}
                    currentUserId={user?.uid}
                    constitutionVersion={constitution?.version}
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
                            currentUserId={user?.uid}
                        />
                    ) : currentView === 'preview' ? (
                        <ConstitutionPreview
                            constitution={constitution}
                            sections={getSectionHierarchy(sections)}
                            onPrint={handlePrint}
                            currentPage={currentPage}
                            onPageChange={setCurrentPage}
                        />
                    ) : (
                        <ConstitutionAuditLog
                            constitutionId={constitutionId}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConstitutionBuilderContent; 