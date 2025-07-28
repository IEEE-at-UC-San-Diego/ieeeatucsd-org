import React, { useState, useEffect } from 'react';
import {
    Edit3,
    Trash2,
    Save,
    BookOpen,
    Image,
    Lock,
    Plus
} from 'lucide-react';
import type { ConstitutionSection } from '../types/firestore';
import { Button } from '../../ui/button';

interface ConstitutionEditorProps {
    sections: ConstitutionSection[];
    selectedSection: string | null;
    editingSection: string | null;
    onSelectSection: (id: string) => void;
    onEditSection: (id: string | null) => void;
    onUpdateSection: (id: string, updates: Partial<ConstitutionSection>) => void;
    onDeleteSection: (id: string) => void;
    onAddSection: (type: ConstitutionSection['type'], parentId?: string) => void;
    activeCollaborators: Array<{ userId: string, userName: string, currentSection?: string }>;
    currentUserId?: string;
}

const ConstitutionEditor: React.FC<ConstitutionEditorProps> = ({
    sections,
    selectedSection,
    editingSection,
    onSelectSection,
    onEditSection,
    onUpdateSection,
    onDeleteSection,
    onAddSection,
    activeCollaborators,
    currentUserId
}) => {
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [originalTitle, setOriginalTitle] = useState('');
    const [originalContent, setOriginalContent] = useState('');

    const currentSection = sections.find(s => s.id === selectedSection);

    useEffect(() => {
        if (currentSection && editingSection === currentSection.id) {
            setEditTitle(currentSection.title);
            setEditContent(currentSection.content);
            setOriginalTitle(currentSection.title);
            setOriginalContent(currentSection.content);
            setHasUnsavedChanges(false);
        }
    }, [currentSection, editingSection]);

    // Track if there are unsaved changes
    useEffect(() => {
        const titleChanged = editTitle !== originalTitle;
        const contentChanged = editContent !== originalContent;
        setHasUnsavedChanges(titleChanged || contentChanged);
    }, [editTitle, editContent, originalTitle, originalContent]);

    const handleSave = () => {
        if (!selectedSection || !editingSection) return;

        onUpdateSection(selectedSection, {
            title: editTitle,
            content: editContent
        });

        // Update original values to new saved values
        setOriginalTitle(editTitle);
        setOriginalContent(editContent);
        setHasUnsavedChanges(false);
        onEditSection(null);
    };

    const handleCancel = () => {
        // Revert to original values
        setEditTitle(originalTitle);
        setEditContent(originalContent);
        setHasUnsavedChanges(false);
        onEditSection(null);
        if (currentSection) {
            setEditTitle(currentSection.title);
            setEditContent(currentSection.content);
        }
    };

    if (!selectedSection || !currentSection) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-8">
                <div className="text-center">
                    <BookOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Welcome to the Constitution Builder
                    </h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        {sections.length === 0
                            ? "Start by adding your first section to begin building your organization's constitution."
                            : "Select a section from the sidebar to view and edit its content. Changes are automatically saved as you type."
                        }
                    </p>
                    {sections.length === 0 && (
                        <div className="space-y-3">
                            <button
                                onClick={() => onAddSection('preamble')}
                                className="block w-full max-w-xs mx-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                            >
                                Start with Preamble
                            </button>
                            <button
                                onClick={() => onAddSection('article')}
                                className="block w-full max-w-xs mx-auto px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                            >
                                Start with Article I
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const isCurrentlyEditing = editingSection === selectedSection;
    const editingCollaborator = activeCollaborators.find(c => c.currentSection === selectedSection);
    const isLockedByOtherUser = editingCollaborator && editingCollaborator.userId !== currentUserId;

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            {/* Section Header */}
            <div className="border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            {currentSection.title}
                        </h2>
                        <p className="text-sm text-gray-600 capitalize">
                            {currentSection.type}
                            {isLockedByOtherUser && (
                                <span className="ml-2 inline-flex items-center gap-1 text-yellow-600">
                                    <Lock className="h-3 w-3" />
                                    Being edited by {editingCollaborator.userName}
                                </span>
                            )}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {!isCurrentlyEditing && (
                            <>
                                <button
                                    onClick={() => onEditSection(selectedSection)}
                                    disabled={isLockedByOtherUser}
                                    className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Edit3 className="h-4 w-4 mr-2" />
                                    Edit
                                </button>
                                <button
                                    onClick={() => onDeleteSection(selectedSection)}
                                    className="inline-flex items-center px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </button>
                            </>
                        )}

                        {isCurrentlyEditing && (
                            <>
                                <button
                                    onClick={handleSave}
                                    disabled={!hasUnsavedChanges}
                                    className={`inline-flex items-center px-3 py-2 rounded-md transition-colors ${hasUnsavedChanges
                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        }`}
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    {hasUnsavedChanges ? 'Save Changes' : 'No Changes'}
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className="inline-flex items-center px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                                >
                                    {hasUnsavedChanges ? 'Discard Changes' : 'Cancel'}
                                </button>
                                {hasUnsavedChanges && (
                                    <span className="text-sm text-orange-600 font-medium ml-2">
                                        You have unsaved changes
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Section Content */}
            <div className="p-6">
                {isCurrentlyEditing ? (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Section Title
                            </label>
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => {
                                    setEditTitle(e.target.value);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                placeholder="Enter section title..."
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">
                                    Content
                                </label>
                                <div className="text-xs text-gray-500">
                                    {editContent.length} characters
                                </div>
                            </div>
                            <div className="space-y-3">
                                <textarea
                                    value={editContent}
                                    onChange={(e) => {
                                        setEditContent(e.target.value);
                                    }}
                                    rows={15}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-serif text-sm leading-relaxed transition-colors"
                                    placeholder="Enter the section content... 

Tip: Use double line breaks to separate paragraphs.
To add an image: [IMAGE:description]"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                                        onClick={() => {
                                            const imageText = "[IMAGE:Add image description here]";
                                            const newContent = editContent + (editContent ? "\n\n" : "") + imageText;
                                            setEditContent(newContent);
                                        }}
                                    >
                                        <Image className="h-4 w-4 mr-2" />
                                        Add Image Placeholder
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500">
                                    Changes are automatically saved as you type. Use formal constitutional language for professional results.
                                    <br />
                                    <strong>Image syntax:</strong> [IMAGE:description] - Replace "description" with your image description.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="prose max-w-none">
                        {currentSection.content ? (
                            <div className="whitespace-pre-wrap text-gray-900 leading-relaxed">
                                {renderContentWithImages(currentSection.content)}
                            </div>
                        ) : (
                            <div className="text-gray-500 italic">
                                No content yet. Click Edit to add content.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper function to render content with image placeholders
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
                    <p key={`${index}-${pIndex}`} className="mb-4">
                        {paragraph.trim()}
                    </p>
                )
            ));
        }
        return null;
    }).filter(Boolean);
};

export default ConstitutionEditor; 