import React, { useState } from 'react';
import { X, Upload, Trash2, CheckCircle } from 'lucide-react';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { app, auth } from '../../../../firebase/client';
import { EventAuditService } from '../../shared/services/eventAuditService';
import type { EventFileChange } from '../../shared/types/firestore';

interface GraphicsUploadModalProps {
    request: any;
    onClose: () => void;
    onSuccess: () => void;
}

export default function GraphicsUploadModal({ request, onClose, onSuccess }: GraphicsUploadModalProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCompleted, setIsCompleted] = useState(request?.graphicsCompleted || false);
    const [prRequirementsConfirmed, setPrRequirementsConfirmed] = useState(false);

    const db = getFirestore(app);
    const storage = getStorage(app);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            setFiles(prevFiles => [...prevFiles, ...selectedFiles]);
        }
    };

    const removeFile = (index: number) => {
        setFiles(files.filter((_, i) => i !== index));
    };

    const uploadFiles = async (filesToUpload: File[]): Promise<string[]> => {
        const uploadPromises = filesToUpload.map(async (file) => {
            const storageRef = ref(storage, `graphics/${auth.currentUser?.uid}/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);
            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', null, reject, () => resolve(uploadTask.snapshot.ref));
            });
            return await getDownloadURL(storageRef);
        });
        return await Promise.all(uploadPromises);
    };

    const handleSubmit = async () => {
        setUploading(true);
        setError(null);

        // Validate PR requirements confirmation if uploading files
        if (files.length > 0 && !prRequirementsConfirmed) {
            setError('Please confirm that you have reviewed the PR requirements before uploading files');
            setUploading(false);
            return;
        }

        try {
            let uploadedUrls: string[] = [];

            // Upload new files if any are selected
            if (files.length > 0) {
                uploadedUrls = await uploadFiles(files);
            }

            // Update event request with completion status and file URLs
            const existingGraphicsFiles = request.graphicsFiles || [];
            const updateData: any = {
                graphicsCompleted: isCompleted,
                updatedAt: new Date()
            };

            // Only update files if new files were uploaded
            if (uploadedUrls.length > 0) {
                updateData.graphicsFiles = [...existingGraphicsFiles, ...uploadedUrls];
            }

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
                        graphicsCompleted: isCompleted,
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
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
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

                    {/* Graphics Completion Status */}
                    <div className="mb-6">
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={isCompleted}
                                onChange={(e) => setIsCompleted(e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-sm font-medium text-gray-700">
                                Mark graphics as completed
                            </span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                            Check this box to indicate that all graphics work for this event is finished.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    )}

                    {/* PR Requirements Section */}
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h5 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            PR Requirements - Please Review Before Uploading
                        </h5>
                        <div className="text-sm text-blue-800 space-y-2">
                            <p className="font-medium">Before uploading graphics files, ensure you have:</p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Created a Pull Request (PR) in the graphics repository</li>
                                <li>Followed the IEEE@UCSD branding guidelines</li>
                                <li>Used approved fonts and color schemes</li>
                                <li>Included all required logos and sponsor acknowledgments</li>
                                <li>Verified all text content for accuracy and spelling</li>
                                <li>Exported files in the correct formats and resolutions</li>
                                <li>Named files according to the naming convention: [EventCode]_[Type]_[Version]</li>
                            </ul>
                            <p className="text-xs text-blue-700 mt-3 italic">
                                Graphics that don't meet these requirements may be rejected and require revision.
                            </p>
                        </div>
                    </div>

                    {/* PR Requirements Confirmation Checkbox */}
                    <div className="mb-6">
                        <label className="flex items-start space-x-3">
                            <input
                                type="checkbox"
                                checked={prRequirementsConfirmed}
                                onChange={(e) => setPrRequirementsConfirmed(e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                            />
                            <span className="text-sm text-gray-700">
                                <span className="font-medium text-red-600">*</span> I confirm that I have reviewed and followed all PR requirements listed above before uploading graphics files.
                            </span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1 ml-7">
                            This confirmation is required to upload files.
                        </p>
                    </div>

                    {/* File Upload Section */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Graphics Files
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
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Previously Uploaded Files:</h5>
                            <div className="space-y-2">
                                {request.graphicsFiles.map((fileUrl: string, index: number) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                            <CheckCircle className="w-4 h-4 text-green-500" />
                                            <span className="text-sm text-gray-700">
                                                {fileUrl.split('/').pop()?.split('_').slice(1).join('_') || 'Graphics file'}
                                            </span>
                                        </div>
                                        <a
                                            href={fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 text-sm"
                                        >
                                            View
                                        </a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                        <button
                            onClick={handleSubmit}
                            disabled={uploading}
                            className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                            {uploading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    <span>Updating...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Update Graphics Status</span>
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