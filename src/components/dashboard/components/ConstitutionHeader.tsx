import React from 'react';
import {
    FileText,
    Users,
    Check,
    Clock,
    AlertCircle,
    Edit3,
    Eye,
    Download
} from 'lucide-react';

interface ConstitutionHeaderProps {
    autoSaveStatus: 'saved' | 'saving' | 'error';
    lastSaved: Date | null;
    unsavedChanges: boolean;
    activeCollaborators: Array<{ userId: string, userName: string, currentSection?: string }>;
    currentView: 'editor' | 'preview';
    onViewChange: (view: 'editor' | 'preview') => void;
    onExport: () => void;
}

const ConstitutionHeader: React.FC<ConstitutionHeaderProps> = ({
    autoSaveStatus,
    lastSaved,
    unsavedChanges,
    activeCollaborators,
    currentView,
    onViewChange,
    onExport
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
                    {/* Auto-save Status */}
                    <div className="flex items-center gap-2 text-sm">
                        {autoSaveStatus === 'saving' && (
                            <>
                                <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
                                <span className="text-yellow-600">Saving...</span>
                            </>
                        )}
                        {autoSaveStatus === 'saved' && !unsavedChanges && (
                            <>
                                <Check className="h-4 w-4 text-green-500" />
                                <span className="text-green-600">
                                    Saved {lastSaved && new Intl.DateTimeFormat('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit'
                                    }).format(lastSaved)}
                                </span>
                            </>
                        )}
                        {autoSaveStatus === 'error' && (
                            <>
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                <span className="text-red-600">Save failed</span>
                            </>
                        )}
                        {unsavedChanges && autoSaveStatus !== 'saving' && (
                            <>
                                <Clock className="h-4 w-4 text-gray-500" />
                                <span className="text-gray-600">Unsaved changes</span>
                            </>
                        )}
                    </div>

                    {/* Active Collaborators */}
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                            {activeCollaborators.length} active
                        </span>
                        <div className="flex -space-x-2">
                            {activeCollaborators.slice(0, 3).map((collab, index) => (
                                <div
                                    key={collab.userId}
                                    className="h-8 w-8 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center border-2 border-white"
                                    title={collab.userName}
                                >
                                    {collab.userName.charAt(0).toUpperCase()}
                                </div>
                            ))}
                            {activeCollaborators.length > 3 && (
                                <div className="h-8 w-8 rounded-full bg-gray-400 text-white text-xs flex items-center justify-center border-2 border-white">
                                    +{activeCollaborators.length - 3}
                                </div>
                            )}
                        </div>
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
                    </div>

                    {/* Export Button */}
                    <button
                        onClick={onExport}
                        className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Export PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConstitutionHeader; 