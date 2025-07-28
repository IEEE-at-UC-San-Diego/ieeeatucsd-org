import React, { useState, useEffect } from 'react';
import type { ConstitutionSection } from '../types/firestore';
import { useConstitutionData } from '../hooks/useConstitutionData';
import { exportConstitutionToPDF } from '../utils/pdfExportUtils';
import {
    exportWithEnhancedPDF,
    exportWithHighResScreenshots,
    exportWithProgressiveEnhancement,
    PDFQualityPresets,
    type EnhancedPDFOptions
} from '../utils/enhancedPdfExport';
import { getSectionHierarchy } from '../utils/constitutionUtils';
import ConstitutionHeader from '../components/ConstitutionHeader';
import ConstitutionSidebar from '../components/ConstitutionSidebar';
import ConstitutionEditor from '../components/ConstitutionEditor';
import ConstitutionPreview from '../components/ConstitutionPreview';
import { ConstitutionAuditLog } from '../components/ConstitutionAuditLog';

interface ConstitutionBuilderContentProps { }

const ConstitutionBuilderContent: React.FC<ConstitutionBuilderContentProps> = () => {
    const {
        constitution,
        sections,
        activeCollaborators,
        saveStatus,
        lastSaved,
        isLoading,
        addSection,
        updateSection,
        deleteSection,
        updateUserPresence,
        constitutionId,
        user
    } = useConstitutionData();

    const [currentView, setCurrentView] = useState<'editor' | 'preview' | 'audit'>('editor');
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [editingSection, setEditingSection] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [exportProgress, setExportProgress] = useState<{ progress: number; status: string } | null>(null);
    const [exportMethod, setExportMethod] = useState<'standard' | 'enhanced'>('enhanced');

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

    const handlePrint = async () => {
        try {
            setExportProgress({ progress: 0, status: 'Preparing enhanced PDF export...' });

            const progressCallback = (progress: number, status: string) => {
                setExportProgress({ progress, status });
            };

            if (exportMethod === 'enhanced') {
                // Use the new Puppeteer-based enhanced PDF export with high-resolution screenshots
                setExportProgress({ progress: 5, status: 'Launching high-resolution browser...' });

                await exportWithHighResScreenshots(
                    constitution,
                    sections,
                    {
                        ...PDFQualityPresets.premium,
                        format: 'Letter',
                        margin: {
                            top: '1in',
                            right: '1in',
                            bottom: '1in',
                            left: '1in'
                        },
                        printBackground: true
                    },
                    progressCallback
                );
            } else {
                // Use the new Puppeteer-based native PDF export
                await exportWithEnhancedPDF(
                    constitution,
                    sections,
                    {
                        ...PDFQualityPresets.high,
                        format: 'Letter',
                        margin: {
                            top: '1in',
                            right: '1in',
                            bottom: '1in',
                            left: '1in'
                        },
                        printBackground: true
                    },
                    progressCallback
                );
            }

            // Clear progress after successful export
            setTimeout(() => {
                setExportProgress(null);
            }, 2000);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('PDF export failed:', error);
            setExportProgress({ progress: 0, status: `Export failed: ${errorMessage}` });

            // Clear error message after delay
            setTimeout(() => {
                setExportProgress(null);
            }, 3000);
        }
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
                activeCollaborators={activeCollaborators}
                currentView={currentView}
                onViewChange={setCurrentView}
                onExport={handlePrint}
                exportProgress={exportProgress}
                exportMethod={exportMethod}
                onExportMethodChange={setExportMethod}
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
                            activeCollaborators={activeCollaborators}
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