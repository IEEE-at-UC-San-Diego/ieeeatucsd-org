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
import SafariBrowserBlock from '../components/SafariBrowserBlock';
import { useSafariDetection } from '../hooks/useBrowserDetection';

interface ConstitutionBuilderContentProps { }

const ConstitutionBuilderContent: React.FC<ConstitutionBuilderContentProps> = () => {
    const { isSafari, isLoading: browserLoading } = useSafariDetection();
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

    // Block Safari users completely
    if (!browserLoading && isSafari) {
        return (
            <div className="w-full max-w-none p-4 md:p-6">
                <SafariBrowserBlock />
            </div>
        );
    }

    return (
        <div className="w-full max-w-none p-4 md:p-6">
            <div className="max-w-7xl mx-auto">
                <ConstitutionHeader
                    saveStatus={saveStatus}
                    lastSaved={lastSaved}
                    currentView={currentView}
                    onViewChange={setCurrentView}
                    onPrint={handlePrint}
                />

                {/* Version Editor */}
                <div className="mb-4 flex justify-center md:justify-end">
                    <VersionEditor
                        constitution={constitution}
                        onUpdateVersion={updateConstitutionVersion}
                    />
                </div>
            </div>

            <div className="max-w-7xl mx-auto">
                {/* Conditional layout based on current view */}
                {currentView === 'editor' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
                        {/* Document Structure Sidebar - Only shown in editor view */}
                        <div className="lg:col-span-3">
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
                        </div>

                        {/* Editor Content */}
                        <div className="lg:col-span-9">
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
                        </div>
                    </div>
                ) : (
                    /* Full-width layout for preview and audit views - better spacing on larger screens */
                    <div className="w-full">
                        {currentView === 'preview' ? (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                                <ConstitutionPreview
                                    constitution={constitution}
                                    sections={getSectionHierarchy(sections)}
                                    onPrint={handlePrint}
                                    currentPage={currentPage}
                                    onPageChange={setCurrentPage}
                                />
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
                                <ConstitutionAuditLog
                                    constitutionId={constitutionId}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConstitutionBuilderContent; 