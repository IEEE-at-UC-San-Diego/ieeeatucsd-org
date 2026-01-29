import React from 'react';
import { Bot, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@heroui/react';

interface AIWarningStepProps {
    onNext?: () => void;
}

export default function AIWarningStep({ onNext }: AIWarningStepProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 max-w-2xl mx-auto text-center">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 relative">
                <Bot className="w-10 h-10 text-blue-600" />
                <div className="absolute -bottom-1 -right-1 bg-yellow-100 p-1.5 rounded-full border-2 border-white">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-3">
                AI-Powered Receipt Parsing
            </h2>

            <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                When uploading a receipt, it will be automatically parsed by our AI system.
                While accurate, <span className="font-semibold text-gray-900">it is your responsibility to verify the data</span> and fix any discrepancies.
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-8 text-left w-full">
                <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                        <h4 className="font-semibold text-yellow-800 mb-1">Important Note</h4>
                        <p className="text-yellow-700 text-sm">
                            Please double-check all extracted amounts, dates, and vendor names.
                            <strong>Once submitted, the request cannot be changed.</strong>
                        </p>
                    </div>
                </div>
            </div>

            {onNext && (
                <Button
                    color="primary"
                    onClick={onNext}
                    endContent={<ArrowRight className="w-4 h-4" />}
                    className="bg-blue-600 font-semibold shadow-lg shadow-blue-600/20 px-8 py-6 text-base"
                >
                    I Understand, Continue
                </Button>
            )}
        </div>
    );
}
