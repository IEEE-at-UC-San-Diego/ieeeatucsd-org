import React from 'react';
import { X } from 'lucide-react';

interface ReviewFeedbackModalProps {
    isOpen: boolean;
    feedback: string;
    onFeedbackChange: (value: string) => void;
    onCancel: () => void;
    onSubmit: () => void;
}

export default function ReviewFeedbackModal({
    isOpen,
    feedback,
    onFeedbackChange,
    onCancel,
    onSubmit
}: ReviewFeedbackModalProps) {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">Request Review</h3>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-4">
                            Please provide specific feedback about what needs to be addressed before this event can be approved.
                        </p>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Review Feedback <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={feedback}
                            onChange={(e) => onFeedbackChange(e.target.value)}
                            placeholder="Describe what needs to be changed or clarified..."
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                    </div>

                    <div className="flex space-x-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onSubmit}
                            className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
                        >
                            Submit Review
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
