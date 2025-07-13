import React, { useState, useEffect } from 'react';
import { X, Upload, File, Trash2, Download, Eye, Plus, Image, FileText } from 'lucide-react';
import { getFirestore, collection, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { app } from '../../../../firebase/client';
import { auth } from '../../../../firebase/client';

interface FileManagementModalProps {
    request: {
        id: string;
        name: string;
    } | null;
    onClose: () => void;
}

interface FileItem {
    url: string;
    name: string;
    type: 'event' | 'request';
    uploadedAt: Date;
    uploadedBy: string;
}

export default function FileManagementModal({ request, onClose }: FileManagementModalProps) {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [uploadTarget, setUploadTarget] = useState<'event' | 'request'>('event');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const db = getFirestore(app);
    const storage = getStorage(app);

    if (!request) return null;

    useEffect(() => {
        fetchFiles();
    }, [request]);

    const fetchFiles = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch files from event_request
            const requestFiles: FileItem[] = [];
            // These would be files already in the event request (room booking, invoices, etc.)

            // Fetch files from events collection
            const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', request.id));
            const eventsSnapshot = await getDocs(eventsQuery);

            const eventFiles: FileItem[] = [];
            if (!eventsSnapshot.empty) {
                const eventDoc = eventsSnapshot.docs[0];
                const eventData = eventDoc.data();
                const eventFileUrls = eventData.files || [];

                eventFileUrls.forEach((url: string, index: number) => {
                    eventFiles.push({
                        url,
                        name: `Event File ${index + 1}`,
                        type: 'event',
                        uploadedAt: eventData.createdAt?.toDate() || new Date(),
                        uploadedBy: eventData.requestedUser || 'Unknown'
                    });
                });
            }

            setFiles([...requestFiles, ...eventFiles]);
        } catch (err) {
            console.error('Error fetching files:', err);
            setError('Failed to fetch files');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async () => {
        if (!selectedFiles || selectedFiles.length === 0) {
            setError('Please select files to upload');
            return;
        }

        try {
            setUploading(true);
            setError(null);

            const uploadPromises = Array.from(selectedFiles).map(async (file) => {
                const fileName = `${Date.now()}_${file.name}`;
                const storageRef = ref(storage, `event_files/${auth.currentUser?.uid}/${fileName}`);

                const uploadTask = uploadBytesResumable(storageRef, file);
                await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed', null, reject, () => resolve(uploadTask.snapshot.ref));
                });

                return await getDownloadURL(storageRef);
            });

            const uploadedUrls = await Promise.all(uploadPromises);

            // Update the appropriate collection
            if (uploadTarget === 'event') {
                const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', request.id));
                const eventsSnapshot = await getDocs(eventsQuery);

                if (!eventsSnapshot.empty) {
                    const eventDoc = eventsSnapshot.docs[0];
                    const eventData = eventDoc.data();
                    const currentFiles = eventData.files || [];

                    await updateDoc(doc(db, 'events', eventDoc.id), {
                        files: [...currentFiles, ...uploadedUrls],
                        updatedAt: new Date()
                    });
                }
            } else {
                // For event_request, we'd add to a general files array
                // This would require updating the event_request schema
            }

            setSuccess(`Successfully uploaded ${uploadedUrls.length} file(s)`);
            setSelectedFiles(null);
            fetchFiles(); // Refresh the file list
        } catch (err) {
            console.error('Error uploading files:', err);
            setError('Failed to upload files: ' + (err as Error).message);
        } finally {
            setUploading(false);
        }
    };

    const handleFileDelete = async (fileToDelete: FileItem) => {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            // Remove from storage
            const storageRef = ref(storage, fileToDelete.url);
            await deleteObject(storageRef);

            // Remove from database
            if (fileToDelete.type === 'event') {
                const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', request.id));
                const eventsSnapshot = await getDocs(eventsQuery);

                if (!eventsSnapshot.empty) {
                    const eventDoc = eventsSnapshot.docs[0];
                    const eventData = eventDoc.data();
                    const currentFiles = eventData.files || [];
                    const updatedFiles = currentFiles.filter((url: string) => url !== fileToDelete.url);

                    await updateDoc(doc(db, 'events', eventDoc.id), {
                        files: updatedFiles,
                        updatedAt: new Date()
                    });
                }
            }

            setSuccess('File deleted successfully');
            fetchFiles(); // Refresh the file list
        } catch (err) {
            console.error('Error deleting file:', err);
            setError('Failed to delete file: ' + (err as Error).message);
        }
    };

    const getFileIcon = (filename: string) => {
        const ext = filename.toLowerCase().split('.').pop();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
            return <Image className="w-5 h-5 text-blue-500" />;
        }
        return <FileText className="w-5 h-5 text-gray-500" />;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">File Management</h2>
                        <p className="text-sm text-gray-600">Manage files for {request.name}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {/* Upload Section */}
                    <div className="mb-6 p-4 border border-gray-200 rounded-lg">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload New Files</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Upload to:
                                </label>
                                <div className="flex space-x-4">
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            name="uploadTarget"
                                            value="event"
                                            checked={uploadTarget === 'event'}
                                            onChange={(e) => setUploadTarget(e.target.value as 'event' | 'request')}
                                            className="mr-2"
                                        />
                                        Event Files (Public)
                                    </label>
                                    <label className="flex items-center">
                                        <input
                                            type="radio"
                                            name="uploadTarget"
                                            value="request"
                                            checked={uploadTarget === 'request'}
                                            onChange={(e) => setUploadTarget(e.target.value as 'event' | 'request')}
                                            className="mr-2"
                                        />
                                        Request Files (Private)
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Files
                                </label>
                                <input
                                    type="file"
                                    multiple
                                    onChange={(e) => setSelectedFiles(e.target.files)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <button
                                onClick={handleFileUpload}
                                disabled={!selectedFiles || uploading}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                <Upload className="w-4 h-4" />
                                <span>{uploading ? 'Uploading...' : 'Upload Files'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-700 text-sm">{error}</p>
                            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 ml-2">×</button>
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-green-700 text-sm">{success}</p>
                            <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700 ml-2">×</button>
                        </div>
                    )}

                    {/* Files List */}
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Files</h3>

                        {loading ? (
                            <div className="text-center py-8">
                                <p className="text-gray-500">Loading files...</p>
                            </div>
                        ) : files.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                                <File className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-500">No files uploaded yet</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {files.map((file, index) => (
                                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center space-x-2">
                                                {getFileIcon(file.name)}
                                                <span className="text-sm font-medium text-gray-700 truncate">
                                                    {file.name}
                                                </span>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded ${file.type === 'event'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                {file.type === 'event' ? 'Public' : 'Private'}
                                            </span>
                                        </div>

                                        <div className="text-xs text-gray-500 mb-3">
                                            Uploaded: {file.uploadedAt.toLocaleDateString()}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex space-x-2">
                                                <a
                                                    href={file.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:text-blue-800"
                                                    title="View File"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </a>
                                                <a
                                                    href={file.url}
                                                    download={file.name}
                                                    className="text-green-600 hover:text-green-800"
                                                    title="Download File"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </a>
                                            </div>
                                            <button
                                                onClick={() => handleFileDelete(file)}
                                                className="text-red-600 hover:text-red-800"
                                                title="Delete File"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
} 