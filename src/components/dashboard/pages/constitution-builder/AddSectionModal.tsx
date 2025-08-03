import React, { useState } from 'react';
import type { ConstitutionSection } from '../../shar../../shared/types/firestore';

interface AddSectionModalProps {
    onClose: () => void;
    onAddSection: (type: ConstitutionSection['type'], parentId?: string, title?: string, content?: string) => void;
    sections: ConstitutionSection[];
}

const AddSectionModal: React.FC<AddSectionModalProps> = ({
    onClose,
    onAddSection,
    sections
}) => {
    const [selectedType, setSelectedType] = useState<ConstitutionSection['type']>('article');
    const [selectedParent, setSelectedParent] = useState<string>('');
    const [title, setTitle] = useState<string>('');
    const [content, setContent] = useState<string>('');

    // Clear content when article is selected, clear title when preamble is selected
    const handleTypeChange = (newType: ConstitutionSection['type']) => {
        setSelectedType(newType);
        if (newType === 'article') {
            setContent(''); // Articles don't need content
        }
        if (newType === 'preamble') {
            setTitle(''); // Preamble doesn't need title
        }
    };

    const sectionTypes = [
        { value: 'preamble', label: 'Preamble', description: 'Opening statement of purpose' },
        { value: 'article', label: 'Article', description: 'Main constitutional division' },
        { value: 'section', label: 'Section', description: 'Must be under an article' },
        { value: 'subsection', label: 'Subsection', description: 'Subdivision of a section' },
        { value: 'amendment', label: 'Amendment', description: 'Constitutional modification' },
    ] as const;

    const getParentOptions = () => {
        if (selectedType === 'section') {
            return sections.filter(s => s.type === 'article')
                .sort((a, b) => (a.order || 0) - (b.order || 0));
        }
        if (selectedType === 'subsection') {
            return sections.filter(s => s.type === 'section' || s.type === 'subsection')
                .sort((a, b) => (a.order || 0) - (b.order || 0));
        }
        return [];
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validation rules
        if (selectedType === 'article' && !title.trim()) {
            alert('Articles must have a title');
            return;
        }

        if (selectedType === 'preamble' && !content.trim()) {
            alert('Preamble must have content');
            return;
        }

        if (selectedType === 'preamble') {
            // Check if preamble already exists
            const existingPreamble = sections.find(s => s.type === 'preamble');
            if (existingPreamble) {
                alert('Only one preamble is allowed');
                return;
            }
        }

        onAddSection(selectedType, selectedParent || undefined, title || undefined, content || undefined);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Section</h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Section Type
                        </label>
                        <select
                            value={selectedType}
                            onChange={(e) => {
                                const newType = e.target.value as ConstitutionSection['type'];
                                handleTypeChange(newType);
                                // Reset parent selection when changing type
                                setSelectedParent('');
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {sectionTypes.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.label} - {type.description}
                                </option>
                            ))}
                        </select>
                    </div>

                    {getParentOptions().length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Parent Section
                            </label>
                            <select
                                value={selectedParent}
                                onChange={(e) => setSelectedParent(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            >
                                <option value="">Select parent...</option>
                                {getParentOptions().map(section => {
                                    const getDisplayTitle = (section: ConstitutionSection) => {
                                        if (section.type === 'article') {
                                            const articles = sections.filter(s => s.type === 'article').sort((a, b) => (a.order || 0) - (b.order || 0));
                                            const articleIndex = articles.findIndex(a => a.id === section.id) + 1;
                                            return section.title ? `Article ${articleIndex} - ${section.title}` : `Article ${articleIndex}`;
                                        }
                                        if (section.type === 'section') {
                                            // Find the parent article
                                            const parentArticle = sections.find(s => s.id === section.parentId && s.type === 'article');
                                            if (parentArticle) {
                                                const articles = sections.filter(s => s.type === 'article').sort((a, b) => (a.order || 0) - (b.order || 0));
                                                const articleIndex = articles.findIndex(a => a.id === parentArticle.id) + 1;

                                                const siblingSections = sections.filter(s => s.parentId === section.parentId && s.type === 'section').sort((a, b) => (a.order || 0) - (b.order || 0));
                                                const sectionIndex = siblingSections.findIndex(s => s.id === section.id) + 1;

                                                return section.title ? `Article ${articleIndex} Section ${sectionIndex} - ${section.title}` : `Article ${articleIndex} Section ${sectionIndex}`;
                                            }
                                            return section.title ? `Section - ${section.title}` : 'Section';
                                        }
                                        if (section.type === 'subsection') {
                                            // Build full hierarchy path for subsections
                                            const buildHierarchy = (subsectionId: string): string => {
                                                const subsection = sections.find(s => s.id === subsectionId);
                                                if (!subsection) return '';

                                                const parent = sections.find(s => s.id === subsection.parentId);
                                                if (!parent) return '';

                                                if (parent.type === 'section') {
                                                    // Parent is a section, find its article
                                                    const article = sections.find(s => s.id === parent.parentId && s.type === 'article');
                                                    if (article) {
                                                        const articles = sections.filter(s => s.type === 'article').sort((a, b) => (a.order || 0) - (b.order || 0));
                                                        const articleIndex = articles.findIndex(a => a.id === article.id) + 1;

                                                        const siblingSections = sections.filter(s => s.parentId === parent.parentId && s.type === 'section').sort((a, b) => (a.order || 0) - (b.order || 0));
                                                        const sectionIndex = siblingSections.findIndex(s => s.id === parent.id) + 1;

                                                        const siblingSubsections = sections.filter(s => s.parentId === subsection.parentId && s.type === 'subsection').sort((a, b) => (a.order || 0) - (b.order || 0));
                                                        const subsectionIndex = siblingSubsections.findIndex(s => s.id === subsection.id) + 1;

                                                        return `Article ${articleIndex} Section ${sectionIndex} Subsection ${subsectionIndex}`;
                                                    }
                                                } else if (parent.type === 'subsection') {
                                                    // Parent is another subsection, build recursively
                                                    const parentHierarchy = buildHierarchy(parent.id);
                                                    const siblingSubsections = sections.filter(s => s.parentId === subsection.parentId && s.type === 'subsection').sort((a, b) => (a.order || 0) - (b.order || 0));
                                                    const subsectionIndex = siblingSubsections.findIndex(s => s.id === subsection.id) + 1;
                                                    return `${parentHierarchy} Subsection ${subsectionIndex}`;
                                                }

                                                return 'Subsection';
                                            };

                                            const hierarchy = buildHierarchy(section.id);
                                            return section.title ? `${hierarchy} - ${section.title}` : hierarchy;
                                        }
                                        return section.title || `${section.type.charAt(0).toUpperCase() + section.type.slice(1)}`;
                                    };

                                    return (
                                        <option key={section.id} value={section.id}>
                                            {getDisplayTitle(section)}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    )}

                    {/* Title field - hidden for preamble, required for articles */}
                    {selectedType !== 'preamble' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Title {selectedType === 'article' ? '(required)' : '(optional)'}
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Enter section title..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required={selectedType === 'article'}
                            />
                        </div>
                    )}

                    {/* Content field - required for preamble, optional for others */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Content {selectedType === 'preamble' ? '(required)' : selectedType === 'article' ? '(not needed)' : '(optional)'}
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder={selectedType === 'preamble' ? 'Enter preamble content...' : selectedType === 'article' ? 'Articles typically do not have content...' : 'Enter section content...'}
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                            required={selectedType === 'preamble'}
                            disabled={selectedType === 'article'}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={selectedType === 'section' && !selectedParent}
                            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add Section
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddSectionModal; 