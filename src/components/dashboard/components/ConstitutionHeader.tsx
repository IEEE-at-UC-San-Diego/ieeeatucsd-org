import React, { useState } from 'react';
import {
    FileText,
    Users,
    Check,
    Clock,
    AlertCircle,
    Edit3,
    Eye,
    Download,
    History,
    ChevronDown,
    Zap,
    Settings
} from 'lucide-react';

// Export Dropdown Component
interface ExportDropdownProps {
    exportMethod: 'standard' | 'enhanced';
    onExportMethodChange?: (method: 'standard' | 'enhanced') => void;
    onExport: () => void;
}

const ExportDropdown: React.FC<ExportDropdownProps> = ({
    exportMethod,
    onExportMethodChange,
    onExport
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleExport = () => {
        setIsOpen(false);
        onExport();
    };

    const handleMethodChange = (method: 'standard' | 'enhanced') => {
        if (onExportMethodChange) {
            onExportMethodChange(method);
        }
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <div className="flex">
                <button
                    onClick={handleExport}
                    className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-l-md hover:bg-gray-700 transition-colors"
                >
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                    {exportMethod === 'enhanced' && (
                        <Zap className="h-3 w-3 ml-1 text-yellow-300" />
                    )}
                </button>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="px-2 py-2 bg-gray-600 text-white rounded-r-md hover:bg-gray-700 transition-colors border-l border-gray-500"
                >
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="p-2">
                        <div className="text-xs text-gray-500 font-medium mb-2 px-2">Export Method</div>

                        <button
                            onClick={() => handleMethodChange('enhanced')}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${exportMethod === 'enhanced'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'hover:bg-gray-50 text-gray-700'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-yellow-500" />
                                <div>
                                    <div className="font-medium">Enhanced Capture</div>
                                    <div className="text-xs text-gray-500">
                                        Pixel-perfect quality with advanced rendering
                                    </div>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => handleMethodChange('standard')}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors mt-1 ${exportMethod === 'standard'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'hover:bg-gray-50 text-gray-700'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Settings className="h-4 w-4 text-gray-500" />
                                <div>
                                    <div className="font-medium">Standard Export</div>
                                    <div className="text-xs text-gray-500">
                                        Traditional HTML-to-PDF conversion
                                    </div>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </div>
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
    exportMethod?: 'standard' | 'enhanced';
    onExportMethodChange?: (method: 'standard' | 'enhanced') => void;
}

const ConstitutionHeader: React.FC<ConstitutionHeaderProps> = ({
    saveStatus,
    lastSaved,
    activeCollaborators,
    currentView,
    onViewChange,
    onExport,
    exportProgress,
    exportMethod = 'enhanced',
    onExportMethodChange
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
                                <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
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

                    {/* Active Collaborators */}
                    {activeCollaborators.length > 0 && (
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
                    )}

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
                                <Clock className="h-4 w-4 animate-pulse" />
                                <span className="text-sm font-medium">{exportProgress.status}</span>
                            </div>
                            {exportProgress.progress > 0 && (
                                <div className="flex items-center gap-2">
                                    <div className="w-24 bg-blue-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${exportProgress.progress}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-blue-600 font-medium">
                                        {Math.round(exportProgress.progress)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <ExportDropdown
                            exportMethod={exportMethod}
                            onExportMethodChange={onExportMethodChange}
                            onExport={onExport}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConstitutionHeader; 