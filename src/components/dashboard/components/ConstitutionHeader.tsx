import React from 'react';
import {
    FileText,
    Check,
    Clock,
    AlertCircle,
    Edit3,
    Eye,
    Download,
    History
} from 'lucide-react';
import type { Constitution, ConstitutionSection } from '../types/firestore';

// Simple Export Button Component
interface ExportButtonProps {
    onExport: () => void;
}

const ExportButton: React.FC<ExportButtonProps> = ({ onExport }) => {
    return (
        <button
            onClick={onExport}
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
        >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
        </button>
    );
};

interface ConstitutionHeaderProps {
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    lastSaved: Date | null;
    activeCollaborators: Array<{ userId: string, userName: string, currentSection?: string }>;
    currentView: 'editor' | 'preview' | 'audit';
    onViewChange: (view: 'editor' | 'preview' | 'audit') => void;
    onExport: () => void;
    exportProgress?: { progress: number; status: string } | null;
}

const ConstitutionHeader: React.FC<ConstitutionHeaderProps> = ({
    saveStatus,
    lastSaved,
    activeCollaborators,
    currentView,
    onViewChange,
    onExport,
    exportProgress
}) => {
    return (
        <div className="mb-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <FileText className="h-8 w-8 text-blue-600" />
                        Constitution Builder
                    </h1>
                    <p className="text-gray-600 mt-2">
                        Collaboratively build and manage the organization's constitution
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Save Status */}
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
                                    Saved {new Intl.DateTimeFormat('en-US', {
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



                    {/* View Toggle */}
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            onClick={() => onViewChange('editor')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'editor'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <Edit3 className="h-4 w-4 inline mr-2" />
                            Editor
                        </button>
                        <button
                            onClick={() => onViewChange('preview')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'preview'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <Eye className="h-4 w-4 inline mr-2" />
                            Preview
                        </button>
                        <button
                            onClick={() => onViewChange('audit')}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === 'audit'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                                }`}
                        >
                            <History className="h-4 w-4 inline mr-2" />
                            Audit Log
                        </button>
                    </div>

                    {/* Export Section */}
                    {exportProgress ? (
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md">
                            <div className="flex items-center gap-2 text-blue-700">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                                <span className="text-sm font-medium">Exporting PDF...</span>
                            </div>
                        </div>
                    ) : (
                        <ExportButton onExport={onExport} />
                    )}
                </div>
            </div>


        </div>
    );
};

export default ConstitutionHeader; 