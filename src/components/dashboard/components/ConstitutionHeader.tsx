import React from 'react';
import {
    FileText,
    Check,
    Clock,
    AlertCircle,
    Edit3,
    Eye,
    Printer,
    History
} from 'lucide-react';
import type { Constitution, ConstitutionSection } from '../types/firestore';
import ConstitutionSearch from './ConstitutionSearch';

// Simple Print Button Component
interface PrintButtonProps {
    onPrint: () => void;
}

const PrintButton: React.FC<PrintButtonProps> = ({ onPrint }) => {
    return (
        <button
            onClick={onPrint}
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
            <Printer className="h-4 w-4 mr-2" />
            Print PDF
        </button>
    );
};

interface ConstitutionHeaderProps {
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    lastSaved: Date | null;
    currentView: 'editor' | 'preview' | 'audit';
    onViewChange: (view: 'editor' | 'preview' | 'audit') => void;
    onPrint: () => void;
    sections: ConstitutionSection[];
    onSelectSection: (sectionId: string, pageNumber?: number) => void;
    onSearchTermChange?: (term: string) => void;
}

const ConstitutionHeader: React.FC<ConstitutionHeaderProps> = ({
    saveStatus,
    lastSaved,
    currentView,
    onViewChange,
    onPrint,
    sections,
    onSelectSection,
    onSearchTermChange
}) => {
    return (
        <div className="mb-4 md:mb-6 lg:mb-8">
            {/* Mobile Layout - Stack vertically */}
            <div className="md:hidden space-y-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="h-6 w-6 text-blue-600" />
                        Constitution Builder
                    </h1>
                    <p className="text-sm text-gray-600 mt-1 mb-3">
                        Build and manage the organization's constitution
                    </p>
                    <ConstitutionSearch
                        sections={sections}
                        onSelectSection={onSelectSection}
                        onSearchTermChange={onSearchTermChange}
                    />
                </div>

                {/* Save Status - Mobile */}
                <div className="flex items-center gap-2 text-sm">
                    {saveStatus === 'saving' && (
                        <>
                            <Clock className="h-4 w-4 text-yellow-500" />
                            <span className="text-yellow-600">Saving...</span>
                        </>
                    )}
                    {saveStatus === 'saved' && lastSaved && (
                        <>
                            <Check className="h-4 w-4 text-green-500" />
                            <span className="text-green-600">
                                Last edited {new Intl.DateTimeFormat('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                }).format(lastSaved)}
                            </span>
                        </>
                    )}
                    {saveStatus === 'error' && (
                        <>
                            <AlertCircle className="h-4 w-4 text-red-500" />
                            <span className="text-red-600">Save failed</span>
                        </>
                    )}
                    {saveStatus === 'idle' && (
                        <>
                            <FileText className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-600">Ready to edit</span>
                        </>
                    )}
                </div>

                {/* View Toggle - Mobile */}
                <div className="flex bg-gray-100 rounded-lg p-1 w-full">
                    <button
                        onClick={() => onViewChange('editor')}
                        className={`flex-1 px-2 py-2 rounded-md text-xs font-medium transition-colors ${currentView === 'editor'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <Edit3 className="h-3 w-3 inline mr-1" />
                        Editor
                    </button>
                    <button
                        onClick={() => onViewChange('preview')}
                        className={`flex-1 px-2 py-2 rounded-md text-xs font-medium transition-colors ${currentView === 'preview'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <Eye className="h-3 w-3 inline mr-1" />
                        Preview
                    </button>
                    <button
                        onClick={() => onViewChange('audit')}
                        className={`flex-1 px-2 py-2 rounded-md text-xs font-medium transition-colors ${currentView === 'audit'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        <History className="h-3 w-3 inline mr-1" />
                        Audit
                    </button>
                </div>

                {/* Print Button - Mobile */}
                <button
                    onClick={onPrint}
                    className="w-full inline-flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors min-h-[44px]"
                >
                    <Printer className="h-4 w-4 mr-2" />
                    Print PDF
                </button>
            </div>

            {/* Tablet Layout - Compact horizontal layout */}
            <div className="hidden md:flex lg:hidden flex-col space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <FileText className="h-6 w-6 text-blue-600" />
                            Constitution Builder
                        </h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Build and manage the organization's constitution
                        </p>
                    </div>

                    {/* Save Status - Tablet */}
                    <div className="flex items-center gap-2 text-sm">
                        {saveStatus === 'saving' && (
                            <>
                                <Clock className="h-4 w-4 text-yellow-500" />
                                <span className="text-yellow-600">Saving...</span>
                            </>
                        )}
                        {saveStatus === 'saved' && lastSaved && (
                            <>
                                <Check className="h-4 w-4 text-green-500" />
                                <span className="text-green-600">
                                    Last edited {new Intl.DateTimeFormat('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit'
                                    }).format(lastSaved)}
                                </span>
                            </>
                        )}
                        {saveStatus === 'error' && (
                            <>
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                <span className="text-red-600">Save failed</span>
                            </>
                        )}
                        {saveStatus === 'idle' && (
                            <>
                                <FileText className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-600">Ready to edit</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Search - Tablet */}
                <div className="max-w-md">
                    <ConstitutionSearch
                        sections={sections}
                        onSelectSection={onSelectSection}
                        onSearchTermChange={onSearchTermChange}
                    />
                </div>

                <div className="flex items-center justify-between gap-4">
                    {/* View Toggle - Tablet */}
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => onViewChange('editor')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[40px] ${currentView === 'editor'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <Edit3 className="h-4 w-4 inline mr-1" />
                            Editor
                        </button>
                        <button
                            onClick={() => onViewChange('preview')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[40px] ${currentView === 'preview'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <Eye className="h-4 w-4 inline mr-1" />
                            Preview
                        </button>
                        <button
                            onClick={() => onViewChange('audit')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[40px] ${currentView === 'audit'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <History className="h-4 w-4 inline mr-1" />
                            Audit
                        </button>
                    </div>

                    {/* Print Button - Tablet */}
                    <button
                        onClick={onPrint}
                        className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors min-h-[40px]"
                    >
                        <Printer className="h-4 w-4 mr-2" />
                        Print PDF
                    </button>
                </div>
            </div>

            {/* Desktop Layout - Original horizontal layout */}
            <div className="hidden lg:flex items-center justify-between">
                <div className="flex-1 mr-8">
                    <h1 className="text-2xl xl:text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <FileText className="h-7 w-7 xl:h-8 xl:w-8 text-blue-600" />
                        Constitution Builder
                    </h1>
                    <p className="text-gray-600 mt-2 mb-4">
                        Collaboratively build and manage the organization's constitution
                    </p>
                    <div className="max-w-md">
                        <ConstitutionSearch
                            sections={sections}
                            onSelectSection={onSelectSection}
                            onSearchTermChange={onSearchTermChange}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Save Status - Desktop */}
                    <div className="flex items-center gap-2 text-sm">
                        {saveStatus === 'saving' && (
                            <>
                                <Clock className="h-4 w-4 text-yellow-500" />
                                <span className="text-yellow-600">Saving...</span>
                            </>
                        )}
                        {saveStatus === 'saved' && lastSaved && (
                            <>
                                <Check className="h-4 w-4 text-green-500" />
                                <span className="text-green-600">
                                    Last edited {new Intl.DateTimeFormat('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit'
                                    }).format(lastSaved)}
                                </span>
                            </>
                        )}
                        {saveStatus === 'error' && (
                            <>
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                <span className="text-red-600">Save failed</span>
                            </>
                        )}
                        {saveStatus === 'idle' && (
                            <>
                                <FileText className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-600">Ready to edit</span>
                            </>
                        )}
                    </div>

                    {/* View Toggle - Desktop */}
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => onViewChange('editor')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] ${currentView === 'editor'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <Edit3 className="h-4 w-4 inline mr-2" />
                            Editor
                        </button>
                        <button
                            onClick={() => onViewChange('preview')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] ${currentView === 'preview'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <Eye className="h-4 w-4 inline mr-2" />
                            Preview
                        </button>
                        <button
                            onClick={() => onViewChange('audit')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] ${currentView === 'audit'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <History className="h-4 w-4 inline mr-2" />
                            Audit Log
                        </button>
                    </div>

                    {/* Print Section - Desktop */}
                    <button
                        onClick={onPrint}
                        className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors min-h-[44px]"
                    >
                        <Printer className="h-4 w-4 mr-2" />
                        Print PDF
                    </button>
                </div>
            </div>


        </div>
    );
};

export default ConstitutionHeader; 