import React, { useState, useEffect } from 'react';
import { X, Upload, File, Trash2, Download, Eye, Plus, Image, FileText, FolderOpen, Lock, Globe, Receipt, Calendar, Archive } from 'lucide-react';
import { getFirestore, collection, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { getStorage, ref, deleteObject } from 'firebase/storage';
import { app } from '../../../../firebase/client';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { Alert, AlertDescription } from '../../../ui/alert';
import { Separator } from '../../../ui/separator';
import { Label } from '../../../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../ui/dialog';
import { uploadFilesForEvent } from './utils/fileUploadUtils';

interface FileManagementModalProps {
    request: {
        id: string;
        name: string;
        roomBookingFiles?: string[];
        invoiceFiles?: string[];
        invoice?: string;
        otherLogos?: string[];
    } | null;
    onClose: () => void;
}

interface FileItem {
    url: string;
    name: string;
    type: 'public' | 'private';
    category: 'invoice' | 'room-booking' | 'logo' | 'event' | 'other';
    uploadedAt: Date;
    uploadedBy: string;
    size?: number;
}

export default function FileManagementModal({ request, onClose }: FileManagementModalProps) {
    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [uploadTarget, setUploadTarget] = useState<'public' | 'private'>('private');
    const [uploadCategory, setUploadCategory] = useState<'invoice' | 'room-booking' | 'logo' | 'event' | 'other'>('other');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

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
            const allFiles: FileItem[] = [];

            // Fetch files from event_request (private files)
            const requestFiles = [
                ...(request.roomBookingFiles || []).map(url => ({
                    url,
                    name: extractFileName(url, 'Room Booking'),
                    type: 'private' as const,
                    category: 'room-booking' as const,
                    uploadedAt: new Date(),
                    uploadedBy: 'User'
                })),
                ...(request.invoiceFiles || []).map(url => ({
                    url,
                    name: extractFileName(url, 'Invoice'),
                    type: 'private' as const,
                    category: 'invoice' as const,
                    uploadedAt: new Date(),
                    uploadedBy: 'User'
                })),
                ...(request.otherLogos || []).map(url => ({
                    url,
                    name: extractFileName(url, 'Logo'),
                    type: 'private' as const,
                    category: 'logo' as const,
                    uploadedAt: new Date(),
                    uploadedBy: 'User'
                }))
            ];

            if (request.invoice) {
                requestFiles.push({
                    url: request.invoice,
                    name: extractFileName(request.invoice, 'Main Invoice'),
                    type: 'private' as const,
                    category: 'invoice' as const,
                    uploadedAt: new Date(),
                    uploadedBy: 'User'
                });
            }

            // Fetch files from events collection (public files)
            const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', request.id));
            const eventsSnapshot = await getDocs(eventsQuery);

            if (!eventsSnapshot.empty) {
                const eventDoc = eventsSnapshot.docs[0];
                const eventData = eventDoc.data();
                const eventFileUrls = eventData.files || [];

                eventFileUrls.forEach((url: string, index: number) => {
                    allFiles.push({
                        url,
                        name: extractFileName(url, `Event File ${index + 1}`),
                        type: 'public',
                        category: 'event',
                        uploadedAt: eventData.createdAt?.toDate() || new Date(),
                        uploadedBy: eventData.requestedUser || 'Unknown'
                    });
                });
            }

            allFiles.push(...requestFiles);
            setFiles(allFiles);
        } catch (err) {
            console.error('Error fetching files:', err);
            setError('Failed to fetch files');
        } finally {
            setLoading(false);
        }
    };

    const extractFileName = (url: string, fallback: string) => {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const filename = pathname.split('/').pop();
            if (filename && filename.includes('_')) {
                return filename.substring(filename.indexOf('_') + 1);
            }
            return filename || fallback;
        } catch {
            return fallback;
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

            // Use the new event-based upload system
            const category = uploadTarget === 'public' ? 'public' : uploadCategory;
            const uploadedUrls = await uploadFilesForEvent(
                Array.from(selectedFiles),
                request.id,
                category
            );

            // Update the appropriate collection
            if (uploadTarget === 'public') {
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
                // Update event_request with private files based on category
                const updateData: any = { updatedAt: new Date() };

                if (uploadCategory === 'invoice') {
                    updateData.invoiceFiles = [...(request.invoiceFiles || []), ...uploadedUrls];
                } else if (uploadCategory === 'room-booking') {
                    updateData.roomBookingFiles = [...(request.roomBookingFiles || []), ...uploadedUrls];
                } else if (uploadCategory === 'logo') {
                    updateData.otherLogos = [...(request.otherLogos || []), ...uploadedUrls];
                }

                await updateDoc(doc(db, 'event_requests', request.id), updateData);
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
        try {
            // Remove from storage
            const storageRef = ref(storage, fileToDelete.url);
            await deleteObject(storageRef);

            // Remove from database
            if (fileToDelete.type === 'public') {
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
            } else {
                // Remove from event_request based on category
                const updateData: any = { updatedAt: new Date() };

                if (fileToDelete.category === 'invoice') {
                    if (request.invoice === fileToDelete.url) {
                        updateData.invoice = null;
                    } else {
                        updateData.invoiceFiles = (request.invoiceFiles || []).filter(url => url !== fileToDelete.url);
                    }
                } else if (fileToDelete.category === 'room-booking') {
                    updateData.roomBookingFiles = (request.roomBookingFiles || []).filter(url => url !== fileToDelete.url);
                } else if (fileToDelete.category === 'logo') {
                    updateData.otherLogos = (request.otherLogos || []).filter(url => url !== fileToDelete.url);
                }

                await updateDoc(doc(db, 'event_requests', request.id), updateData);
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
        } else if (['pdf'].includes(ext || '')) {
            return <FileText className="w-5 h-5 text-red-500" />;
        }
        return <File className="w-5 h-5 text-gray-500" />;
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'invoice':
                return <Receipt className="w-4 h-4" />;
            case 'room-booking':
                return <Calendar className="w-4 h-4" />;
            case 'logo':
                return <Image className="w-4 h-4" />;
            case 'event':
                return <FolderOpen className="w-4 h-4" />;
            default:
                return <Archive className="w-4 h-4" />;
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'invoice':
                return 'bg-green-100 text-green-800';
            case 'room-booking':
                return 'bg-blue-100 text-blue-800';
            case 'logo':
                return 'bg-purple-100 text-purple-800';
            case 'event':
                return 'bg-indigo-100 text-indigo-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const groupedFiles = files.reduce((acc, file) => {
        const key = `${file.type}_${file.category}`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(file);
        return acc;
    }, {} as Record<string, FileItem[]>);

    const renderFileCard = (file: FileItem) => (
        <Card key={file.url} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                        {getFileIcon(file.name)}
                        <span className="text-sm font-medium text-gray-700 truncate" title={file.name}>
                            {file.name}
                        </span>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                        <Badge className={getCategoryColor(file.category)}>
                            <div className="flex items-center space-x-1">
                                {getCategoryIcon(file.category)}
                                <span className="text-xs">{file.category}</span>
                            </div>
                        </Badge>
                        <Badge variant={file.type === 'public' ? 'default' : 'secondary'}>
                            {file.type === 'public' ? <Globe className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                            {file.type === 'public' ? 'Public' : 'Private'}
                        </Badge>
                    </div>
                </div>

                <div className="text-xs text-gray-500 mb-3">
                    Uploaded: {file.uploadedAt.toLocaleDateString()}
                </div>

                <div className="flex space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewFile(file)}
                        className="text-blue-600 hover:text-blue-800"
                    >
                        <Eye className="w-4 h-4 mr-1" />
                        Preview
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFileDelete(file)}
                        className="text-red-600 hover:text-red-800"
                    >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                    </Button>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">File Management</h2>
                            <p className="text-sm text-gray-600">Manage files for {request.name}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
                        <div className="p-6 space-y-6">
                            {/* Upload Section */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center space-x-2">
                                        <Upload className="w-5 h-5" />
                                        <span>Upload New Files</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-sm font-medium">File Type</Label>
                                            <div className="flex space-x-4 mt-2">
                                                <label className="flex items-center space-x-2">
                                                    <input
                                                        type="radio"
                                                        name="uploadTarget"
                                                        value="public"
                                                        checked={uploadTarget === 'public'}
                                                        onChange={(e) => setUploadTarget(e.target.value as 'public' | 'private')}
                                                        className="w-4 h-4 text-blue-600"
                                                    />
                                                    <Globe className="w-4 h-4 text-blue-600" />
                                                    <span className="text-sm">Public Files</span>
                                                </label>
                                                <label className="flex items-center space-x-2">
                                                    <input
                                                        type="radio"
                                                        name="uploadTarget"
                                                        value="private"
                                                        checked={uploadTarget === 'private'}
                                                        onChange={(e) => setUploadTarget(e.target.value as 'public' | 'private')}
                                                        className="w-4 h-4 text-blue-600"
                                                    />
                                                    <Lock className="w-4 h-4 text-gray-600" />
                                                    <span className="text-sm">Private Files</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div>
                                            <Label className="text-sm font-medium">Category</Label>
                                            <select
                                                value={uploadCategory}
                                                onChange={(e) => setUploadCategory(e.target.value as typeof uploadCategory)}
                                                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="invoice">Invoice</option>
                                                <option value="room-booking">Room Booking</option>
                                                <option value="logo">Logo</option>
                                                <option value="event">Event File</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <Label className="text-sm font-medium">Select Files</Label>
                                        <input
                                            type="file"
                                            multiple
                                            onChange={(e) => setSelectedFiles(e.target.files)}
                                            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                    </div>

                                    <Button
                                        onClick={handleFileUpload}
                                        disabled={uploading || !selectedFiles || selectedFiles.length === 0}
                                        className="w-full"
                                    >
                                        <Upload className="w-4 h-4 mr-2" />
                                        {uploading ? 'Uploading...' : 'Upload Files'}
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Status Messages */}
                            {error && (
                                <Alert className="border-red-200 bg-red-50">
                                    <AlertDescription className="text-red-800">{error}</AlertDescription>
                                </Alert>
                            )}
                            {success && (
                                <Alert className="border-green-200 bg-green-50">
                                    <AlertDescription className="text-green-800">{success}</AlertDescription>
                                </Alert>
                            )}

                            {/* Files Section */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center space-x-2">
                                        <FolderOpen className="w-5 h-5" />
                                        <span>File Library</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <div className="text-center py-8">
                                            <p className="text-gray-500">Loading files...</p>
                                        </div>
                                    ) : files.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-gray-500">No files uploaded yet</p>
                                        </div>
                                    ) : (
                                        <Tabs defaultValue="all" className="w-full">
                                            <TabsList className="grid w-full grid-cols-3">
                                                <TabsTrigger value="all">All Files</TabsTrigger>
                                                <TabsTrigger value="public">Public Files</TabsTrigger>
                                                <TabsTrigger value="private">Private Files</TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="all" className="space-y-4">
                                                {Object.entries(groupedFiles).map(([key, groupFiles]) => {
                                                    const [type, category] = key.split('_');
                                                    return (
                                                        <div key={key}>
                                                            <div className="flex items-center space-x-2 mb-3">
                                                                {type === 'public' ? <Globe className="w-4 h-4 text-blue-600" /> : <Lock className="w-4 h-4 text-gray-600" />}
                                                                <h3 className="font-medium text-gray-900 capitalize">
                                                                    {type} {category.replace('-', ' ')} Files
                                                                </h3>
                                                                <Badge variant="outline">
                                                                    {groupFiles.length}
                                                                </Badge>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                                {groupFiles.map(renderFileCard)}
                                                            </div>
                                                            <Separator className="my-4" />
                                                        </div>
                                                    );
                                                })}
                                            </TabsContent>

                                            <TabsContent value="public">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {files.filter(f => f.type === 'public').map(renderFileCard)}
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="private">
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {files.filter(f => f.type === 'private').map(renderFileCard)}
                                                </div>
                                            </TabsContent>
                                        </Tabs>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {previewFile && (
                <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
                    <DialogContent className="max-w-4xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center space-x-2">
                                {getFileIcon(previewFile.name)}
                                <span>{previewFile.name}</span>
                                <Badge className={getCategoryColor(previewFile.category)}>
                                    {previewFile.category}
                                </Badge>
                            </DialogTitle>
                        </DialogHeader>
                        <div className="max-h-[70vh] overflow-auto">
                            {previewFile.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                                <img
                                    src={previewFile.url}
                                    alt={previewFile.name}
                                    className="w-full h-auto rounded-lg"
                                />
                            ) : previewFile.name.match(/\.pdf$/i) ? (
                                <iframe
                                    src={previewFile.url}
                                    className="w-full h-96 rounded-lg"
                                    title={previewFile.name}
                                />
                            ) : (
                                <div className="text-center py-8">
                                    <File className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                                    <p className="text-gray-600">Preview not available for this file type</p>
                                    <Button className="mt-4" asChild>
                                        <a href={previewFile.url} download={previewFile.name}>
                                            <Download className="w-4 h-4 mr-2" />
                                            Download File
                                        </a>
                                    </Button>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setPreviewFile(null)}>
                                Close
                            </Button>
                            <Button asChild>
                                <a href={previewFile.url} download={previewFile.name}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                </a>
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
} 