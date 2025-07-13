import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, User, Clock, DollarSign, Image, FileText, Eye, Download, Users, Camera, Megaphone, AlertTriangle, Settings } from 'lucide-react';
import { getFirestore, collection, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { app } from '../../../../firebase/client';

interface EventViewModalProps {
    request: {
        id: string;
        name: string;
        location: string;
        startDateTime: any;
        endDateTime: any;
        eventDescription: string;
        status: string;
        requestedUser: string;
        createdAt: any;
        needsGraphics?: boolean;
        needsAsFunding?: boolean;
        flyersNeeded?: boolean;
        flyerType?: string[];
        otherFlyerType?: string;
        flyerAdvertisingStartDate?: any;
        flyerAdditionalRequests?: string;
        flyersCompleted?: boolean;
        photographyNeeded?: boolean;
        requiredLogos?: string[];
        otherLogos?: string[];
        advertisingFormat?: string;
        willOrHaveRoomBooking?: boolean;
        expectedAttendance?: number;
        roomBookingFiles?: string[];
        asFundingRequired?: boolean;
        foodDrinksBeingServed?: boolean;
        itemizedInvoice?: { description: string; quantity: number; unitPrice: number; total: number; }[];
        invoice?: string;
        invoiceFiles?: string[];
        declinedReason?: string;
        published?: boolean;
    } | null;
    users: Record<string, { name: string; email: string }>;
    onClose: () => void;
}

export default function EventViewModal({ request, users, onClose }: EventViewModalProps) {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [publishStatus, setPublishStatus] = useState(request?.published || false);
    const [updating, setUpdating] = useState(false);
    const [eventFiles, setEventFiles] = useState<string[]>([]);
    const [loadingEventFiles, setLoadingEventFiles] = useState(true);

    const db = getFirestore(app);

    if (!request) return null;

    useEffect(() => {
        const fetchEventFiles = async () => {
            try {
                setLoadingEventFiles(true);
                // Find the corresponding event in events collection
                const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', request.id));
                const eventsSnapshot = await getDocs(eventsQuery);

                if (!eventsSnapshot.empty) {
                    const eventDoc = eventsSnapshot.docs[0];
                    const eventData = eventDoc.data();
                    setEventFiles(eventData.files || []);
                    // Sync the publish status with the actual event data
                    setPublishStatus(eventData.published || false);
                } else {
                    console.log('No corresponding event found for request:', request.id);
                }
            } catch (error) {
                console.error('Error fetching event files:', error);
            } finally {
                setLoadingEventFiles(false);
            }
        };

        if (request) {
            fetchEventFiles();
        }
    }, [request, db]);

    const getUserName = (userId: string) => {
        return users[userId]?.name || userId;
    };

    const handlePublishToggle = async () => {
        try {
            setUpdating(true);
            const newStatus = !publishStatus;

            // Update the event in events collection
            const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', request.id));
            const eventsSnapshot = await getDocs(eventsQuery);

            if (!eventsSnapshot.empty) {
                const eventDoc = eventsSnapshot.docs[0];
                console.log('Updating event publish status:', eventDoc.id, 'to:', newStatus);
                await updateDoc(doc(db, 'events', eventDoc.id), {
                    published: newStatus,
                    updatedAt: new Date()
                });
                setPublishStatus(newStatus);
                console.log('Successfully updated publish status');
            } else {
                console.error('No event found to update for request:', request.id);
                alert('Error: No corresponding event found to update');
            }
        } catch (error) {
            console.error('Error updating publish status:', error);
            alert('Error updating publish status: ' + (error as Error).message);
        } finally {
            setUpdating(false);
        }
    };

    const formatDateTime = (timestamp: any) => {
        if (!timestamp) return 'Not specified';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } catch (error) {
            return 'Invalid date';
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Not specified';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            return 'Invalid date';
        }
    };

    const formatInvoiceData = () => {
        if (!request.itemizedInvoice || request.itemizedInvoice.length === 0) {
            return 'No invoice data available';
        }

        try {
            const items = request.itemizedInvoice;
            let subtotal = 0;
            let total = 0;

            // Calculate subtotal from items
            items.forEach(item => {
                subtotal += item.quantity * item.unitPrice;
            });

            // Format items
            const itemStrings = items.map(item => {
                return `${item.quantity} ${item.description} x${item.unitPrice.toFixed(2)} each`;
            });

            // Try to extract tax and tip from the total vs subtotal difference
            // This is an approximation since we don't have explicit tax/tip fields
            const extraCharges = items.reduce((acc, item) => acc + (item.total || 0), 0) - subtotal;
            total = subtotal + extraCharges;

            // If no explicit total in items, use subtotal
            if (total === subtotal) {
                total = items.reduce((acc, item) => acc + (item.total || item.quantity * item.unitPrice), 0);
            }

            const location = request.invoice || 'Unknown Location';

            let invoiceString = itemStrings.join(' | ');

            // Add tax and tip if there are extra charges
            if (extraCharges > 0) {
                // Assume some portion is tax (estimate 8% tax rate for calculation display)
                const estimatedTax = subtotal * 0.08;
                const estimatedTip = extraCharges - estimatedTax;

                if (estimatedTax > 0) invoiceString += ` | Tax = ${estimatedTax.toFixed(2)}`;
                if (estimatedTip > 0) invoiceString += ` | Tip = ${estimatedTip.toFixed(2)}`;
            }

            invoiceString += ` | Total = ${total.toFixed(2)} from ${location}`;

            return invoiceString;
        } catch (error) {
            console.error('Invoice formatting error:', error);
            return 'Error formatting invoice data';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'declined':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'submitted':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const FileViewer = ({ url, filename }: { url: string; filename: string }) => {
        const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename);
        const isPdf = /\.pdf$/i.test(filename);

        return (
            <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 truncate">{filename}</span>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setSelectedFile(url)}
                            className="text-blue-600 hover:text-blue-800"
                            title="View File"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                        <a
                            href={url}
                            download={filename}
                            className="text-green-600 hover:text-green-800"
                            title="Download File"
                        >
                            <Download className="w-4 h-4" />
                        </a>
                    </div>
                </div>
                {isImage && (
                    <img
                        src={url}
                        alt={filename}
                        className="w-full h-32 object-cover rounded cursor-pointer"
                        onClick={() => setSelectedFile(url)}
                    />
                )}
                {isPdf && (
                    <div className="w-full h-32 bg-red-100 rounded flex items-center justify-center cursor-pointer"
                        onClick={() => setSelectedFile(url)}>
                        <FileText className="w-8 h-8 text-red-600" />
                        <span className="ml-2 text-red-600 font-medium">PDF Document</span>
                    </div>
                )}
                {!isImage && !isPdf && (
                    <div className="w-full h-32 bg-gray-200 rounded flex items-center justify-center cursor-pointer"
                        onClick={() => setSelectedFile(url)}>
                        <FileText className="w-8 h-8 text-gray-600" />
                        <span className="ml-2 text-gray-600 font-medium">File</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">{request.name}</h2>
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border mt-2 ${getStatusColor(request.status)}`}>
                                <span className="capitalize">{request.status}</span>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 p-2"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-6 space-y-8">
                        {/* Basic Event Information */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                                        Event Details
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">Event Name</label>
                                            <p className="text-gray-900">{request.name}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">Description</label>
                                            <p className="text-gray-900">{request.eventDescription}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">Location</label>
                                            <p className="text-gray-900 flex items-center">
                                                <MapPin className="w-4 h-4 mr-1 text-gray-500" />
                                                {request.location}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">Expected Attendance</label>
                                            <p className="text-gray-900 flex items-center">
                                                <Users className="w-4 h-4 mr-1 text-gray-500" />
                                                {request.expectedAttendance || 'Not specified'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <Clock className="w-5 h-5 mr-2 text-green-600" />
                                        Schedule
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">Start Date & Time</label>
                                            <p className="text-gray-900">{formatDateTime(request.startDateTime)}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">End Date & Time</label>
                                            <p className="text-gray-900">{formatDateTime(request.endDateTime)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <User className="w-5 h-5 mr-2 text-purple-600" />
                                        Request Information
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">Requested By</label>
                                            <p className="text-gray-900">{getUserName(request.requestedUser)}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">Submitted On</label>
                                            <p className="text-gray-900">{formatDate(request.createdAt)}</p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">Status</label>
                                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(request.status)}`}>
                                                <span className="capitalize">{request.status}</span>
                                            </div>
                                        </div>
                                        {request.declinedReason && (
                                            <div>
                                                <label className="text-sm font-medium text-red-700">Declined Reason</label>
                                                <p className="text-red-900 bg-red-50 p-2 rounded border border-red-200">{request.declinedReason}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <Settings className="w-5 h-5 mr-2 text-gray-600" />
                                        Publication Settings
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                            <div>
                                                <label className="text-sm font-medium text-gray-700">Event Published</label>
                                                <p className="text-xs text-gray-500">
                                                    {publishStatus ? 'Event is visible to members' : 'Event is hidden from members'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={handlePublishToggle}
                                                disabled={updating}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${publishStatus ? 'bg-blue-600' : 'bg-gray-200'
                                                    } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${publishStatus ? 'translate-x-6' : 'translate-x-1'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Requirements & Services</h3>
                                    <div className="space-y-2">
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-3 h-3 rounded-full ${request.needsGraphics ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                            <span className="text-sm">Graphics Required</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-3 h-3 rounded-full ${request.needsAsFunding ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                            <span className="text-sm">AS Funding Required</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-3 h-3 rounded-full ${request.flyersNeeded ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                            <span className="text-sm">Flyers Needed</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-3 h-3 rounded-full ${request.photographyNeeded ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                            <span className="text-sm">Photography Needed</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-3 h-3 rounded-full ${request.willOrHaveRoomBooking ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                            <span className="text-sm">Room Booking</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-3 h-3 rounded-full ${request.foodDrinksBeingServed ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                            <span className="text-sm">Food & Drinks Served</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Graphics & Marketing */}
                        {(request.flyersNeeded || request.photographyNeeded || request.needsGraphics) && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                    <Megaphone className="w-5 h-5 mr-2 text-pink-600" />
                                    Graphics & Marketing
                                </h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {request.flyersNeeded && (
                                        <div>
                                            <h4 className="font-medium text-gray-900 mb-2">Flyer Information</h4>
                                            <div className="space-y-2 text-sm">
                                                <p><strong>Types:</strong> {request.flyerType?.join(', ') || 'Not specified'}</p>
                                                {request.otherFlyerType && <p><strong>Other Type:</strong> {request.otherFlyerType}</p>}
                                                <p><strong>Advertising Start:</strong> {formatDate(request.flyerAdvertisingStartDate)}</p>
                                                {request.flyerAdditionalRequests && <p><strong>Additional Requests:</strong> {request.flyerAdditionalRequests}</p>}
                                                <p><strong>Status:</strong> {request.flyersCompleted ? 'Completed' : 'Pending'}</p>
                                            </div>
                                        </div>
                                    )}
                                    {request.photographyNeeded && (
                                        <div>
                                            <h4 className="font-medium text-gray-900 mb-2">Photography</h4>
                                            <div className="space-y-2 text-sm">
                                                <p><strong>Required Logos:</strong> {request.requiredLogos?.join(', ') || 'None specified'}</p>
                                                {request.otherLogos && request.otherLogos.length > 0 && (
                                                    <p><strong>Other Logos:</strong> {request.otherLogos.join(', ')}</p>
                                                )}
                                                {request.advertisingFormat && <p><strong>Format:</strong> {request.advertisingFormat}</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Room Booking Warning */}
                        {!request.willOrHaveRoomBooking && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <div className="flex items-start">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 mr-2 mt-0.5" />
                                    <div>
                                        <h4 className="text-amber-800 font-medium">No Room Booking</h4>
                                        <p className="text-amber-700 text-sm mt-1">
                                            This event does not have room booking arranged. Please ensure venue arrangements are confirmed.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Room Booking Files */}
                        {request.roomBookingFiles && request.roomBookingFiles.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Room Booking Files</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {request.roomBookingFiles.map((file, index) => (
                                        <FileViewer key={index} url={file} filename={`Room Booking ${index + 1}`} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Funding & Invoice Information */}
                        {request.asFundingRequired && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                    <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                                    Funding & Invoice Information
                                </h3>
                                <div className="space-y-4">
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                        <h4 className="font-medium text-green-900 mb-2">Invoice Details</h4>
                                        <p className="text-green-800 font-mono text-sm bg-white p-3 rounded border">
                                            {formatInvoiceData()}
                                        </p>
                                    </div>

                                    {request.invoiceFiles && request.invoiceFiles.length > 0 && (
                                        <div>
                                            <h4 className="font-medium text-gray-900 mb-3">Invoice Files</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {request.invoiceFiles.map((file, index) => (
                                                    <FileViewer key={index} url={file} filename={`Invoice ${index + 1}`} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Event Files from Events Collection */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                                Event Files
                            </h3>
                            {loadingEventFiles ? (
                                <div className="text-center py-4">
                                    <p className="text-gray-500">Loading event files...</p>
                                </div>
                            ) : eventFiles.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {eventFiles.map((file, index) => (
                                        <FileViewer key={index} url={file} filename={`Event File ${index + 1}`} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-gray-500">No additional event files available</p>
                                </div>
                            )}
                        </div>

                        {/* Summary of All Files */}
                        {(
                            (request.roomBookingFiles && request.roomBookingFiles.length > 0) ||
                            (request.invoiceFiles && request.invoiceFiles.length > 0) ||
                            eventFiles.length > 0
                        ) && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h4 className="font-medium text-blue-900 mb-2">File Summary</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                        <div>
                                            <span className="font-medium text-blue-800">Room Booking Files:</span>
                                            <p className="text-blue-700">{request.roomBookingFiles?.length || 0} files</p>
                                        </div>
                                        <div>
                                            <span className="font-medium text-blue-800">Invoice Files:</span>
                                            <p className="text-blue-700">{request.invoiceFiles?.length || 0} files</p>
                                        </div>
                                        <div>
                                            <span className="font-medium text-blue-800">Event Files:</span>
                                            <p className="text-blue-700">{eventFiles.length} files</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                    </div>
                </div>
            </div>

            {/* File Preview Modal */}
            {selectedFile && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60 p-4">
                    <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
                        <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center">
                            <h3 className="text-lg font-semibold">File Preview</h3>
                            <button
                                onClick={() => setSelectedFile(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-4">
                            {selectedFile.toLowerCase().includes('.pdf') ? (
                                <iframe
                                    src={selectedFile}
                                    className="w-full h-96"
                                    title="PDF Preview"
                                />
                            ) : (
                                <img
                                    src={selectedFile}
                                    alt="File preview"
                                    className="max-w-full h-auto"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
} 