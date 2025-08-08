import React, { useState } from 'react';
import { X, Upload, Trash2 } from 'lucide-react';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { app, auth } from '../../../../firebase/client';
import { EventAuditService } from '../../shared/services/eventAuditService';
import type { EventFileChange } from '../../shared/types/firestore';
import EnhancedFileViewer from './components/EnhancedFileViewer';
import { extractPRRequirements } from './utils/prRequirementsUtils';
import { uploadFilesForEvent } from './utils/fileUploadUtils';

interface GraphicsUploadModalProps {
    request: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function GraphicsUploadModal({ request, onClose, onSuccess }: GraphicsUploadModalProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [prRequirementsConfirmed, setPrRequirementsConfirmed] = useState(false);

    const db = getFirestore(app);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
    };



    const handleSubmit = async () => {
        setUploading(true);
        setError(null);

        // Validate that at least one file is selected
        if (files.length === 0) {
            setError('Please select at least one file to upload before submitting');
            setUploading(false);
            return;
        }

        // Validate PR requirements confirmation
        if (!prRequirementsConfirmed) {
            setError('Please confirm that your graphics files meet all the event-specific PR requirements before uploading');
            setUploading(false);
            return;
        }

        try {
            // Upload the selected files using event-based structure
            const uploadedUrls = await uploadFilesForEvent(files, request.id, 'graphics');

            // Update event request with new file URLs
            const existingGraphicsFiles = request.graphicsFiles || [];
            const updateData: any = {
                graphicsFiles: [...existingGraphicsFiles, ...uploadedUrls],
                updatedAt: new Date()
            };

            await updateDoc(doc(db, 'event_requests', request.id), updateData);

            // Log graphics update
            try {
                const userName = await EventAuditService.getUserName(auth.currentUser?.uid || '');
                const fileChanges: EventFileChange[] = files.map(file => ({
                    action: 'added',
                    fileName: file.name,
                    fileType: 'graphics'
                }));

                await EventAuditService.logGraphicsUpdate(
                    request.id,
                    auth.currentUser?.uid || '',
                    userName,
                    fileChanges.length > 0 ? fileChanges : undefined,
                    {
                        eventName: request.name,
                        filesUploaded: files.length
                    }
                );
            } catch (auditError) {
                console.error('Failed to log graphics update:', auditError);
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error updating graphics:', error);
            setError('Failed to update graphics');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                        Upload Graphics Files
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="mb-4">
                        <h4 className="font-medium text-gray-900 mb-2">Event: {request.name}</h4>
                        <p className="text-sm text-gray-600">
                            Update graphics completion status and upload files as needed.
                        </p>
                    </div>



                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Event-Specific PR Requirements Section */}
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h5 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            Event PR Requirements - Please Review Before Uploading
                        </h5>
                        <div className="text-sm text-blue-800 space-y-3">
                            <p className="font-medium">Ensure your graphics meet the following event-specific requirements:</p>

                            {/* Event-specific requirements */}
                            <div className="space-y-3 bg-white p-3 rounded border">
                                {request.flyerType && request.flyerType.length > 0 && (
                                    <div>
                                        <span className="font-medium text-blue-800">Flyer Type Required:</span>
                                        <ul className="list-disc list-inside ml-2 mt-1 text-blue-700">
                                            {request.flyerType.map((type: string, index: number) => (
                                                <li key={index}>{type}</li>
                                            ))}
                                        </ul>
                                        {request.otherFlyerType && (
                                            <div className="ml-2 mt-1 text-blue-700">
                                                <span className="font-medium">Other:</span> {request.otherFlyerType}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {request.requiredLogos && request.requiredLogos.length > 0 && (
                                    <div>
                                        <span className="font-medium text-blue-800">Required Logos:</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {request.requiredLogos.map((logo: string, index: number) => (
                                                <span key={index} className="bg-blue-200 text-blue-800 px-2 py-1 rounded text-xs">
                                                    {logo}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {request.advertisingFormat && (
                                    <div>
                                        <span className="font-medium text-blue-800">Required Format:</span>
                                        <span className="ml-2 text-blue-700">{request.advertisingFormat}</span>
                                    </div>
                                )}

                                {request.additionalSpecifications && (
                                    <div>
                                        <span className="font-medium text-blue-800">Additional Specifications:</span>
                                        <div className="mt-1 text-blue-700 bg-gray-50 p-2 rounded border">
                                            {request.additionalSpecifications}
                                        </div>
                                    </div>
                                )}

                                {request.flyerAdditionalRequests && (
                                    <div>
                                        <span className="font-medium text-blue-800">Additional Requests:</span>
                                        <div className="mt-1 text-blue-700 bg-gray-50 p-2 rounded border">
                                            {request.flyerAdditionalRequests}
                                        </div>
                                    </div>
                                )}
                            </div>



                            <p className="text-xs text-blue-700 mt-3 italic">
                                Graphics that don't meet these requirements may be rejected and require revision.
                            </p>
                        </div>
                    </div>

                    {/* PR Requirements Confirmation Checkbox */}
                    <div className="mb-6">
                        <label className={`flex items-start space-x-3 ${files.length === 0 ? 'opacity-50' : ''}`}>
                            <input
                                type="checkbox"
                                checked={prRequirementsConfirmed}
                                onChange={(e) => setPrRequirementsConfirmed(e.target.checked)}
                                disabled={files.length === 0}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5 disabled:opacity-50"
                            />
                            <span className="text-sm text-gray-700">
                                <span className="font-medium text-red-600">*</span> I confirm that the graphics files I'm uploading meet all the event-specific PR requirements listed above (flyer type, logos, format, specifications, etc.).
                            </span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1 ml-7">
                            {files.length === 0
                                ? 'Please select files first before confirming requirements.'
                                : 'This confirmation ensures the uploaded files match what the event organizer requested.'
                            }
                        </p>
                    </div>

                    {/* File Upload Section */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <span className="font-medium text-red-600">*</span> Select Graphics Files (Required)
                        </label>
                        <input
                            type="file"
                            multiple
                            accept=".png,.jpg,.jpeg,.svg,.pdf,.ai,.psd"
                            onChange={handleFileChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Accepted formats: PNG, JPG, SVG, PDF, AI, PSD
                            {files.length > 0 && (
                                <span className="ml-2 text-blue-600 font-medium">
                                    • {files.length} file{files.length !== 1 ? 's' : ''} selected
                                </span>
                            )}
                        </p>
                    </div>

                    {/* Selected Files Preview */}
                    {files.length > 0 && (
                        <div className="mb-6">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Selected Files:</h5>
                            <div className="space-y-2">
                                {files.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                            <Upload className="w-4 h-4 text-gray-500" />
                                            <span className="text-sm text-gray-700 truncate">{file.name}</span>
                                            <span className="text-xs text-gray-500">
                                                ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => removeFile(index)}
                                            className="text-red-600 hover:text-red-800"
                                            title="Remove file"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Existing Graphics Files */}
                    {request.graphicsFiles && request.graphicsFiles.length > 0 && (
                        <div className="mb-6">
                            <h5 className="text-sm font-medium text-gray-700 mb-3">Previously Uploaded Graphics Files:</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {request.graphicsFiles.map((fileUrl: string, index: number) => (
                                    <EnhancedFileViewer
                                        key={index}
                                        url={fileUrl}
                                        filename={fileUrl.split('/').pop()?.split('_').slice(1).join('_') || `Graphics File ${index + 1}`}
                                        eventRequestId={request.id}
                                        showPRRequirements={true}
                                        prRequirements={extractPRRequirements(request)}
                                        className="bg-green-50 border-green-200"
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                        <button
                            onClick={handleSubmit}
                            disabled={uploading || files.length === 0 || !prRequirementsConfirmed}
                            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                            {uploading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Uploading...</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4" />
                                    <span>Upload Graphics Files</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            disabled={uploading}
                            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
} 