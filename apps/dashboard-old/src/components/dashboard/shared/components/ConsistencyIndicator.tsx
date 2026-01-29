import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, Info } from 'lucide-react';
import type { Constitution, ConstitutionSection } from '../types/firestore';
import { validateConstitutionConsistency, type ValidationResult } from '../../pages/constitution-builder/utils/previewPdfValidator';

interface ConsistencyIndicatorProps {
    constitution: Constitution | null;
    sections: ConstitutionSection[];
    className?: string;
}

const ConsistencyIndicator: React.FC<ConsistencyIndicatorProps> = ({
    constitution,
    sections,
    className = ''
}) => {
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        if (constitution && sections.length > 0) {
            const result = validateConstitutionConsistency(constitution, sections);
            setValidation(result);
        }
    }, [constitution, sections]);

    if (!validation) {
        return null;
    }

    const getStatusIcon = () => {
        if (validation.isValid && validation.warnings.length === 0) {
            return <CheckCircle className="h-5 w-5 text-green-500" />;
        } else if (validation.isValid && validation.warnings.length > 0) {
            return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
        } else {
            return <AlertTriangle className="h-5 w-5 text-red-500" />;
        }
    };

    const getStatusText = () => {
        if (validation.isValid && validation.warnings.length === 0) {
            return 'Preview matches PDF perfectly';
        } else if (validation.isValid && validation.warnings.length > 0) {
            return `Preview matches PDF (${validation.warnings.length} warnings)`;
        } else {
            return `Issues found (${validation.errors.length} errors)`;
        }
    };

    const getStatusColor = () => {
        if (validation.isValid && validation.warnings.length === 0) {
            return 'text-green-700 bg-green-50 border-green-200';
        } else if (validation.isValid && validation.warnings.length > 0) {
            return 'text-yellow-700 bg-yellow-50 border-yellow-200';
        } else {
            return 'text-red-700 bg-red-50 border-red-200';
        }
    };

    return (
        <div className={`${className}`}>
            <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors hover:opacity-80 ${getStatusColor()}`}
                onClick={() => setShowDetails(!showDetails)}
            >
                {getStatusIcon()}
                <span className="text-sm font-medium">{getStatusText()}</span>
                <Info className="h-4 w-4 ml-auto opacity-60" />
            </div>

            {showDetails && (
                <div className={`mt-2 p-3 rounded-lg border text-sm ${getStatusColor()}`}>
                    <div className="font-medium mb-2">Consistency Report:</div>

                    {validation.errors.length > 0 && (
                        <div className="mb-2">
                            <div className="font-medium text-red-700 mb-1">Errors:</div>
                            <ul className="list-disc list-inside space-y-1">
                                {validation.errors.map((error, index) => (
                                    <li key={index} className="text-red-600">{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {validation.warnings.length > 0 && (
                        <div className="mb-2">
                            <div className="font-medium text-yellow-700 mb-1">Warnings:</div>
                            <ul className="list-disc list-inside space-y-1">
                                {validation.warnings.map((warning, index) => (
                                    <li key={index} className="text-yellow-600">{warning}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {validation.suggestions.length > 0 && (
                        <div className="mb-2">
                            <div className="font-medium text-blue-700 mb-1">Suggestions:</div>
                            <ul className="list-disc list-inside space-y-1">
                                {validation.suggestions.map((suggestion, index) => (
                                    <li key={index} className="text-blue-600">{suggestion}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {validation.isValid && validation.warnings.length === 0 && validation.suggestions.length === 0 && (
                        <div className="text-green-600">
                            ✅ Your constitution is properly formatted and the preview will match the PDF output exactly.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ConsistencyIndicator;
