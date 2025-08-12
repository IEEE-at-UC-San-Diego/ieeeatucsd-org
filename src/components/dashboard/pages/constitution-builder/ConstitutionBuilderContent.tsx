import React, { useState, useEffect } from 'react';
import type { ConstitutionSection } from '../../shared/types/firestore';
import { useConstitutionData } from './hooks/useConstitutionData';
import { getSectionHierarchy } from './utils/constitutionUtils';
import ConstitutionHeader from './ConstitutionHeader';
import ConstitutionSidebar from './ConstitutionSidebar';
import ConstitutionEditor from './ConstitutionEditor';
import ConstitutionPreview from './ConstitutionPreview';
import { ConstitutionAuditLog } from './ConstitutionAuditLog';

import SafariBrowserBlock from './SafariBrowserBlock';
import { useSafariDetection } from './hooks/useBrowserDetection';
import { Skeleton } from '../../../ui/skeleton';

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

        constitutionId,
        user
    } = useConstitutionData();

    const [currentView, setCurrentView] = useState<'editor' | 'preview' | 'audit'>('editor');
    const [selectedSection, setSelectedSection] = useState<string | null>(null);
    const [editingSection, setEditingSection] = useState<string | null>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [highlightedSectionId, setHighlightedSectionId] = useState<string>('');

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

    const handleViewPDF = async () => {
        try {
            const response = await fetch('/api/export-pdf-puppeteer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    constitution,
                    sections: getSectionHierarchy(sections),
                    options: { printBackground: true, format: 'Letter' },
                }),
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Export failed: ${response.status} ${errText}`);
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            // Open in new tab/window for viewing
            window.open(url, '_blank', 'noopener');
            // Revoke after a short delay to allow loading
            setTimeout(() => URL.revokeObjectURL(url), 300_000);
        } catch (err) {
            console.error('PDF view failed', err);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            const response = await fetch('/api/export-pdf-puppeteer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    constitution,
                    sections: getSectionHierarchy(sections),
                    options: { printBackground: true, format: 'Letter', scale: 2, dpi: 300 },
                }),
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Export failed: ${response.status} ${errText}`);
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const filename = `IEEE_UCSD_Constitution_${new Date().toISOString().split('T')[0]}_v${constitution?.version || 1}.pdf`;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
        } catch (err) {
            console.error('PDF download failed', err);
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
            <div className="flex h-screen bg-gray-50">
                {/* Sidebar Skeleton */}
                <div className="w-80 bg-white border-r border-gray-200 p-6">
                    <Skeleton className="h-8 w-48 mb-6" />
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-6 w-full" />
                                <div className="ml-4 space-y-1">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content Skeleton */}
                <div className="flex-1 flex flex-col">
                    {/* Header */}
                    <div className="bg-white border-b border-gray-200 p-6">
                        <Skeleton className="h-8 w-64 mb-2" />
                        <Skeleton className="h-4 w-96" />
                    </div>

                    {/* Editor Area */}
                    <div className="flex-1 p-6">
                        <div className="bg-white rounded-lg border border-gray-200 p-6 h-full">
                            <Skeleton className="h-6 w-48 mb-4" />
                            <div className="space-y-4">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-5/6" />
                                <Skeleton className="h-4 w-4/5" />
                                <Skeleton className="h-32 w-full" />
                                <div className="flex space-x-2">
                                    <Skeleton className="h-10 w-20" />
                                    <Skeleton className="h-10 w-20" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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
                    onViewPdf={handleViewPDF}
                    onDownload={handleDownloadPDF}
                    sections={sections}
                    onSelectSection={(sectionId, pageNumber) => {
                        setSelectedSection(sectionId);

                        if (pageNumber && currentView === 'preview') {
                            // If we're in preview mode and have a page number, navigate to that page
                            setCurrentPage(pageNumber);
                            // Highlight the selected section temporarily
                            setHighlightedSectionId(sectionId);
                            setTimeout(() => setHighlightedSectionId(''), 3000); // Clear after 3 seconds
                        } else {
                            // Otherwise, switch to editor view
                            setCurrentView('editor');

                            // Auto-expand parent sections in sidebar
                            const section = sections.find(s => s.id === sectionId);
                            if (section) {
                                const newExpandedSections = new Set(expandedSections);

                                // Find all parent sections and expand them
                                let currentParentId = section.parentId;
                                while (currentParentId) {
                                    newExpandedSections.add(currentParentId);
                                    const parentSection = sections.find(s => s.id === currentParentId);
                                    currentParentId = parentSection?.parentId;
                                }

                                setExpandedSections(newExpandedSections);
                            }
                        }
                    }}
                    onSearchTermChange={() => { }} // No longer need to track search term
                />


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
                                    currentPage={currentPage}
                                    onPageChange={setCurrentPage}
                                    highlightedSectionId={highlightedSectionId}
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