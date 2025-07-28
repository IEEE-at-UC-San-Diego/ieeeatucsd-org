import React from 'react';
import { Monitor, FileText } from 'lucide-react';

interface PreviewModeToggleProps {
    pdfCaptureMode: boolean;
    onToggle: (mode: boolean) => void;
    className?: string;
}

const PreviewModeToggle: React.FC<PreviewModeToggleProps> = ({
    pdfCaptureMode,
    onToggle,
    className = ''
}) => {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <span className="text-sm text-gray-600 font-medium">Preview Mode:</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                    onClick={() => onToggle(false)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                        !pdfCaptureMode
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="Screen preview with visual enhancements"
                >
                    <Monitor className="h-4 w-4" />
                    Screen
                </button>
                <button
                    onClick={() => onToggle(true)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                        pdfCaptureMode
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                    }`}
                    title="PDF-accurate preview (exactly as it will appear in exported PDF)"
                >
                    <FileText className="h-4 w-4" />
                    PDF
                </button>
            </div>
            <div className="text-xs text-gray-500 max-w-xs">
                {pdfCaptureMode 
                    ? "Showing exactly how the PDF will look" 
                    : "Showing enhanced screen preview"
                }
            </div>
        </div>
    );
};

export default PreviewModeToggle;
