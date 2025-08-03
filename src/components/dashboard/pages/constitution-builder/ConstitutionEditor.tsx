import React, { useState, useEffect } from 'react';
import {
    Edit3,
    Trash2,
    Save,
    BookOpen,
    Image,
    Plus,
    FileText
} from 'lucide-react';
import type { ConstitutionSection } from '../../shar../../shared/types/firestore';

interface ConstitutionEditorProps {
    sections: ConstitutionSection[];
    selectedSection: string | null;
    editingSection: string | null;
    onSelectSection: (id: string) => void;
    onEditSection: (id: string | null) => void;
    onUpdateSection: (id: string, updates: Partial<ConstitutionSection>) => void;
    onDeleteSection: (id: string) => void;
    onAddSection: (type: ConstitutionSection['type'], parentId?: string, title?: string, content?: string) => void;
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

        // For articles, only save the title (no content)
        const updates: Partial<ConstitutionSection> = {
            title: editTitle
        };

        // Only include content for non-article sections
        if (currentSection?.type !== 'article') {
            updates.content = editContent;
        }

        onUpdateSection(selectedSection, updates);

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
            <div className="bg-white rounded-lg border border-gray-200 p-8 lg:p-12">
                <div className="text-center max-w-2xl mx-auto">
                    <div className="bg-blue-50 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-blue-600" />
                    </div>
                    <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">
                        Welcome to the Constitution Builder
                    </h3>
                    <p className="text-gray-600 mb-8 text-base lg:text-lg leading-relaxed">
                        {sections.length === 0
                            ? "Start by adding your first section to begin building your organization's constitution. Choose from a preamble or your first article to get started."
                            : "Select a section from the sidebar to view and edit its content. Changes are automatically saved as you type, making collaboration seamless and efficient."
                        }
                    </p>
                    {sections.length === 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto">
                            <button
                                onClick={() => onAddSection('preamble')}
                                className="flex flex-col items-center p-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors min-h-[120px] justify-center group"
                            >
                                <div className="bg-blue-500 rounded-full p-3 mb-3 group-hover:bg-blue-600 transition-colors">
                                    <FileText className="h-6 w-6" />
                                </div>
                                <span className="font-medium text-base">Start with Preamble</span>
                                <span className="text-blue-100 text-sm mt-1">Introduction & purpose</span>
                            </button>
                            <button
                                onClick={() => onAddSection('article')}
                                className="flex flex-col items-center p-6 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors min-h-[120px] justify-center group"
                            >
                                <div className="bg-gray-500 rounded-full p-3 mb-3 group-hover:bg-gray-600 transition-colors">
                                    <Plus className="h-6 w-6" />
                                </div>
                                <span className="font-medium text-base">Start with Article I</span>
                                <span className="text-gray-100 text-sm mt-1">Main content sections</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const isCurrentlyEditing = editingSection === selectedSection;

    return (
        <div className="bg-white rounded-lg border border-gray-200">
            {/* Section Header */}
            <div className="border-b border-gray-200 p-4 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 leading-tight mb-1">
                            {currentSection.title}
                        </h2>
                        <p className="text-sm text-gray-600 capitalize font-medium">
                            {currentSection.type}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:gap-2 lg:flex-shrink-0">
                        {!isCurrentlyEditing && (
                            <>
                                <button
                                    onClick={() => onEditSection(selectedSection)}
                                    className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium min-h-[44px] lg:min-h-[40px]"
                                >
                                    <Edit3 className="h-4 w-4 mr-2" />
                                    Edit Section
                                </button>
                                <button
                                    onClick={() => onDeleteSection(selectedSection)}
                                    className="inline-flex items-center justify-center px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium min-h-[44px] lg:min-h-[40px]"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Section
                                </button>
                            </>
                        )}

                        {isCurrentlyEditing && (
                            <>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <button
                                        onClick={handleSave}
                                        disabled={!hasUnsavedChanges}
                                        className={`inline-flex items-center justify-center px-4 py-2.5 rounded-lg transition-colors text-sm font-medium min-h-[44px] lg:min-h-[40px] ${hasUnsavedChanges
                                            ? 'bg-green-600 text-white hover:bg-green-700'
                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            }`}
                                    >
                                        <Save className="h-4 w-4 mr-2" />
                                        {hasUnsavedChanges ? 'Save Changes' : 'No Changes'}
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        className="inline-flex items-center justify-center px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium min-h-[44px] lg:min-h-[40px]"
                                    >
                                        {hasUnsavedChanges ? 'Discard Changes' : 'Cancel'}
                                    </button>
                                </div>
                                {hasUnsavedChanges && (
                                    <div className="flex items-center justify-center sm:justify-start lg:justify-end">
                                        <span className="text-sm text-orange-600 font-medium bg-orange-50 px-3 py-1.5 rounded-md border border-orange-200">
                                            You have unsaved changes
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Section Content */}
            <div className="p-4 lg:p-6">
                {isCurrentlyEditing ? (
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                Section Title
                            </label>
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => {
                                    setEditTitle(e.target.value);
                                }}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-base font-medium"
                                placeholder="Enter section title..."
                            />
                        </div>

                        {/* Only show content editing for non-article sections */}
                        {currentSection.type !== 'article' && (
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Section Content
                                    </label>
                                    <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                                        {editContent.length} characters
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <textarea
                                        value={editContent}
                                        onChange={(e) => {
                                            setEditContent(e.target.value);
                                        }}
                                        rows={14}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm leading-relaxed transition-colors resize-y min-h-[300px]"
                                        placeholder="Enter the section content...

Tip: Use double line breaks to separate paragraphs.
To add an image: [IMAGE:description]
For tree structures, use characters like ├── └── │ for proper alignment."
                                    />
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <button
                                            type="button"
                                            className="inline-flex items-center justify-center px-4 py-2.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium min-h-[44px]"
                                            onClick={() => {
                                                const imageText = "[IMAGE:Add image description here]";
                                                const newContent = editContent + (editContent ? "\n\n" : "") + imageText;
                                                setEditContent(newContent);
                                            }}
                                        >
                                            <Image className="h-4 w-4 mr-2" />
                                            Add Image Placeholder
                                        </button>
                                        <p className="text-xs text-gray-500 text-center sm:text-right max-w-md">
                                            <strong>Tip:</strong> Use [IMAGE:description] syntax to add image placeholders
                                        </p>
                                    </div>
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p className="text-xs text-blue-700 leading-relaxed">
                                            <strong>Writing Tips:</strong> Changes are automatically saved as you type. Use formal constitutional language for professional results. Double line breaks create new paragraphs.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="prose max-w-none">
                        {currentSection.type === 'article' ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                                <div className="text-blue-600 mb-2">
                                    <BookOpen className="h-8 w-8 mx-auto mb-3" />
                                </div>
                                <h3 className="text-lg font-medium text-blue-900 mb-2">Article Container</h3>
                                <p className="text-blue-700 leading-relaxed">
                                    Articles serve as organizational containers and only require a title.
                                    Content should be added to sections within this article.
                                </p>
                            </div>
                        ) : currentSection.content ? (
                            <div className="bg-white border border-gray-200 rounded-lg p-6">
                                <div className="whitespace-pre-wrap text-gray-900 leading-relaxed text-base">
                                    {renderContentWithImages(currentSection.content)}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                                <div className="text-gray-400 mb-3">
                                    <Edit3 className="h-8 w-8 mx-auto" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-600 mb-2">No Content Yet</h3>
                                <p className="text-gray-500 mb-4">
                                    This section is empty. Click the Edit button above to add content.
                                </p>
                                <button
                                    onClick={() => onEditSection(selectedSection)}
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                >
                                    <Edit3 className="h-4 w-4 mr-2" />
                                    Start Editing
                                </button>
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
                <div key={index} className="my-8">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 lg:p-8 bg-gray-50 text-center">
                        <div className="bg-gray-200 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                            <Image className="h-8 w-8 text-gray-400" />
                        </div>
                        <h4 className="text-sm font-medium text-gray-700 mb-1">Image Placeholder</h4>
                        <p className="text-sm text-gray-500">
                            {description || 'Add image description'}
                        </p>
                    </div>
                </div>
            );
        } else if (part.trim()) {
            return part.split('\n\n').map((paragraph, pIndex) => {
                if (paragraph.trim()) {
                    // Check if this looks like a tree structure
                    const treeChars = /[├└│┌┐┘┌┬┴┼─]/;
                    if (treeChars.test(paragraph)) {
                        return (
                            <pre key={`${index}-${pIndex}`} className="mb-6 text-sm leading-tight font-mono bg-gray-50 p-4 rounded-lg border overflow-auto">
                                {paragraph}
                            </pre>
                        );
                    } else {
                        return (
                            <p key={`${index}-${pIndex}`} className="mb-6 text-base leading-relaxed whitespace-pre-wrap">
                                {paragraph}
                            </p>
                        );
                    }
                }
                return null;
            });
        }
        return null;
    }).filter(Boolean);
};

export default ConstitutionEditor; 