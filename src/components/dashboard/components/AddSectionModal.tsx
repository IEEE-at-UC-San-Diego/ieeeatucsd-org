import React, { useState } from 'react';
import type { ConstitutionSection } from '../types/firestore';

interface AddSectionModalProps {
    onClose: () => void;
    onAddSection: (type: ConstitutionSection['type'], parentId?: string) => void;
    sections: ConstitutionSection[];
}

const AddSectionModal: React.FC<AddSectionModalProps> = ({
    onClose,
    onAddSection,
    sections
}) => {
    const [selectedType, setSelectedType] = useState<ConstitutionSection['type']>('article');
    const [selectedParent, setSelectedParent] = useState<string>('');

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
        onAddSection(selectedType, selectedParent || undefined);
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
                                setSelectedType(newType);
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
                                            return `Article ${articleIndex} - ${section.title}`;
                                        }
                                        if (section.type === 'section') {
                                            const siblingSections = sections.filter(s => s.parentId === section.parentId && s.type === 'section').sort((a, b) => (a.order || 0) - (b.order || 0));
                                            const sectionIndex = siblingSections.findIndex(s => s.id === section.id) + 1;
                                            return `Section ${sectionIndex} - ${section.title}`;
                                        }
                                        if (section.type === 'subsection') {
                                            // Show nested hierarchy for subsections
                                            let depth = 0;
                                            let currentParentId = section.parentId;
                                            while (currentParentId) {
                                                const parent = sections.find(s => s.id === currentParentId);
                                                if (parent && parent.type === 'subsection') {
                                                    depth++;
                                                    currentParentId = parent.parentId;
                                                } else {
                                                    break;
                                                }
                                            }
                                            const indent = '  '.repeat(depth);
                                            return `${indent}Subsection - ${section.title}`;
                                        }
                                        return section.title;
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