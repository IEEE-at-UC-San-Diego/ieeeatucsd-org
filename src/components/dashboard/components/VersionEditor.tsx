import React, { useState } from 'react';
import { Edit3, Check, X } from 'lucide-react';
import type { Constitution } from '../types/firestore';

interface VersionEditorProps {
    constitution: Constitution | null;
    onUpdateVersion: (version: number) => void;
    className?: string;
}

const VersionEditor: React.FC<VersionEditorProps> = ({
    constitution,
    onUpdateVersion,
    className = ''
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editVersion, setEditVersion] = useState(constitution?.version || 1);

    const handleStartEdit = () => {
        setEditVersion(constitution?.version || 1);
        setIsEditing(true);
    };

    const handleSave = () => {
        if (editVersion > 0) {
            onUpdateVersion(editVersion);
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setEditVersion(constitution?.version || 1);
        setIsEditing(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <span className="text-sm text-gray-600 font-medium">Version:</span>
            
            {isEditing ? (
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min="1"
                        value={editVersion}
                        onChange={(e) => setEditVersion(parseInt(e.target.value) || 1)}
                        onKeyDown={handleKeyPress}
                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                    />
                    <button
                        onClick={handleSave}
                        className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                        title="Save version"
                    >
                        <Check className="h-4 w-4" />
                    </button>
                    <button
                        onClick={handleCancel}
                        className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
                        title="Cancel"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                        {constitution?.version || 1}
                    </span>
                    <button
                        onClick={handleStartEdit}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
                        title="Edit version number"
                    >
                        <Edit3 className="h-3 w-3" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default VersionEditor;
