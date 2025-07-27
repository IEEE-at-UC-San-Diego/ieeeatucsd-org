import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, User, Clock, DollarSign, Image, FileText, Eye, Download, Users, Camera, Megaphone, AlertTriangle, Settings, Lock, Copy, Check, ExternalLink } from 'lucide-react';
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
        eventCode?: string;
        pointsToReward?: number;
        department?: string;
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
        hasRoomBooking?: boolean;
        expectedAttendance?: number;
        roomBookingFiles?: string[];
        asFundingRequired?: boolean;
        foodDrinksBeingServed?: boolean;
        servingFoodDrinks?: boolean;
        // New multi-invoice format
        invoices?: {
            id: string;
            vendor: string;
            items: { description: string; quantity: number; unitPrice: number; total: number; }[];
            tax: number;
            tip: number;
            invoiceFile?: string;

            subtotal: number;
            total: number;
        }[];
        // Legacy single invoice format (for backward compatibility)
        itemizedInvoice?: { description: string; quantity: number; unitPrice: number; total: number; }[];
        invoice?: string;
        invoiceFiles?: string[];
        declinedReason?: string;
        published?: boolean;
        invoiceTax?: number;
        invoiceTip?: number;
        invoiceVendor?: string;
    } | null;
    users: Record<string, { name: string; email: string }>;
    onClose: () => void;
}

export default function EventViewModal({ request, users, onClose }: EventViewModalProps) {
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [publishStatus, setPublishStatus] = useState(request?.published || false);
    const [updating, setUpdating] = useState(false);
    const [eventFiles, setEventFiles] = useState<string[]>([]);
    const [privateFiles, setPrivateFiles] = useState<string[]>([]);
    const [loadingEventFiles, setLoadingEventFiles] = useState(true);
    const [eventCode, setEventCode] = useState<string>('');
    const [pointsToReward, setPointsToReward] = useState<number>(0);
    const [attendees, setAttendees] = useState<any[]>([]);
    const [loadingAttendees, setLoadingAttendees] = useState(true);
    const [eventId, setEventId] = useState<string>('');
    const [copiedInvoice, setCopiedInvoice] = useState(false);
    const [attendeeSearch, setAttendeeSearch] = useState('');

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
                    setPrivateFiles(eventData.privateFiles || []);
                    setEventCode(eventData.eventCode || '');
                    setPointsToReward(eventData.pointsToReward || 0);
                    setEventId(eventDoc.id);
                    // Sync the publish status with the actual event data
                    setPublishStatus(eventData.published || false);

                    // Fetch attendees
                    try {
                        const attendeesQuery = query(collection(db, 'events', eventDoc.id, 'attendees'));
                        const attendeesSnapshot = await getDocs(attendeesQuery);
                        const attendeesData = attendeesSnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));
                        setAttendees(attendeesData);
                    } catch (error) {
                        console.error('Error fetching attendees:', error);
                        setAttendees([]);
                    }
                } else {
                    console.log('No corresponding event found for request:', request.id);
                    // Fallback to event request data if available
                    setEventCode(request.eventCode || '');
                    setPointsToReward(request.pointsToReward || 0);
                    setAttendees([]);
                }
            } catch (error) {
                console.error('Error fetching event files:', error);
            } finally {
                setLoadingEventFiles(false);
                setLoadingAttendees(false);
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
        if (request.status !== 'approved') {
            alert('Events can only be published when their status is "Approved"');
            return;
        }

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

    const formatInvoiceData = (invoiceIndex?: number) => {
        if (!request) {
            return 'No invoice data available';
        }

        try {
            // Check for new multi-invoice format first
            if (request.invoices && request.invoices.length > 0) {
                // If specific invoice index is provided, format only that invoice
                if (invoiceIndex !== undefined && invoiceIndex >= 0 && invoiceIndex < request.invoices.length) {
                    const invoice = request.invoices[invoiceIndex];
                    const itemStrings = invoice.items.map((item: any) => {
                        return `${item.quantity} ${item.description} x${item.unitPrice.toFixed(2)} each`;
                    });

                    const subtotal = invoice.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
                    const total = subtotal + (invoice.tax || 0) + (invoice.tip || 0);

                    let invoiceString = itemStrings.join(' | ');

                    if (invoice.tax > 0) {
                        invoiceString += ` | Tax = ${invoice.tax.toFixed(2)}`;
                    }

                    if (invoice.tip > 0) {
                        invoiceString += ` | Tip = ${invoice.tip.toFixed(2)}`;
                    }

                    invoiceString += ` | Total = ${total.toFixed(2)} from ${invoice.vendor}`;

                    return invoiceString;
                }

                // Format all invoices separately
                const invoiceStrings = request.invoices.map((invoice: any, index: number) => {
                    const itemStrings = invoice.items.map((item: any) => {
                        return `${item.quantity} ${item.description} x${item.unitPrice.toFixed(2)} each`;
                    });

                    const subtotal = invoice.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);
                    const total = subtotal + (invoice.tax || 0) + (invoice.tip || 0);

                    let invoiceString = `Invoice ${index + 1}: ${itemStrings.join(' | ')}`;

                    if (invoice.tax > 0) {
                        invoiceString += ` | Tax = ${invoice.tax.toFixed(2)}`;
                    }

                    if (invoice.tip > 0) {
                        invoiceString += ` | Tip = ${invoice.tip.toFixed(2)}`;
                    }

                    invoiceString += ` | Total = ${total.toFixed(2)} from ${invoice.vendor}`;

                    return invoiceString;
                });

                // Return all invoices as separate lines
                return invoiceStrings.join('\n\n');
            }

            // Fallback to legacy single invoice format
            if (!request.itemizedInvoice || request.itemizedInvoice.length === 0) {
                return 'No itemized invoice data available';
            }

            const items = request.itemizedInvoice;

            // Format items: "N_1 {item_1} x{cost_1} each"
            const itemStrings = items.map((item: any) => {
                return `${item.quantity} ${item.description} x${item.unitPrice.toFixed(2)} each`;
            });

            // Calculate subtotal
            const subtotal = items.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);

            // Get tax and tip from request fields, default to 0 if not specified
            const tax = request.invoiceTax || 0;
            const tip = request.invoiceTip || 0;

            // Calculate total
            const total = subtotal + tax + tip;

            // Get vendor/location from invoiceVendor field or fallback
            const vendor = request.invoiceVendor || 'Unknown Location';

            // Build the formatted string: "N_1 {item_1} x{cost_1} each | N_2 {item_2} x{cost_2} each | Tax = {tax} | Tip = {tip} | Total = {total} from {location}"
            let invoiceString = itemStrings.join(' | ');

            // Add tax if specified
            if (tax > 0) {
                invoiceString += ` | Tax = ${tax.toFixed(2)}`;
            }

            // Add tip if specified
            if (tip > 0) {
                invoiceString += ` | Tip = ${tip.toFixed(2)}`;
            }

            // Add total and vendor
            invoiceString += ` | Total = ${total.toFixed(2)} from ${vendor}`;

            return invoiceString;
        } catch (error) {
            console.error('Invoice formatting error:', error);
            return 'Error formatting invoice data';
        }
    };

    const copyInvoiceData = async (invoiceIndex?: number) => {
        try {
            const invoiceData = formatInvoiceData(invoiceIndex);
            await navigator.clipboard.writeText(invoiceData);
            setCopiedInvoice(true);
            setTimeout(() => setCopiedInvoice(false), 2000);
        } catch (error) {
            console.error('Failed to copy invoice data:', error);
            alert('Failed to copy invoice data to clipboard');
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        try {
            let declinedReason: string | undefined;

            if (newStatus === 'declined') {
                const reason = prompt('Please provide a reason for declining this event:');
                if (!reason) {
                    return; // Don't change status if no reason provided
                }
                declinedReason = reason;

                // Update the event request with declined status and reason
                const requestRef = doc(db, 'event_requests', request.id);
                await updateDoc(requestRef, {
                    status: newStatus,
                    declinedReason: reason
                });

                // Find and unpublish the corresponding event
                const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', request.id));
                const eventsSnapshot = await getDocs(eventsQuery);

                if (!eventsSnapshot.empty) {
                    const eventDoc = eventsSnapshot.docs[0];
                    await updateDoc(doc(db, 'events', eventDoc.id), { published: false });
                    setPublishStatus(false);
                }
            } else {
                // Update the event request status
                const requestRef = doc(db, 'event_requests', request.id);
                await updateDoc(requestRef, {
                    status: newStatus,
                    declinedReason: null // Clear declined reason if changing from declined
                });

                // Update the corresponding event's published status based on new status
                const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', request.id));
                const eventsSnapshot = await getDocs(eventsQuery);

                if (!eventsSnapshot.empty) {
                    const eventDoc = eventsSnapshot.docs[0];
                    const shouldBePublished = newStatus === 'approved' ? publishStatus : false;
                    await updateDoc(doc(db, 'events', eventDoc.id), { published: shouldBePublished });
                }
            }

            // Send email notification for status change
            try {
                console.log(`Sending status change email: ${request.status} -> ${newStatus}`);
                const { EmailClient } = await import('../../../../scripts/email/EmailClient');
                await EmailClient.notifyFirebaseEventRequestStatusChange(
                    request.id,
                    newStatus,
                    request.status,
                    undefined, // changedByUserId - could add current user if needed
                    declinedReason
                );
            } catch (emailError) {
                console.error('Failed to send status change email:', emailError);
                // Don't block the main flow for email failures
            }

            // Refresh the page or update the request object
            window.location.reload();
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status: ' + (error as Error).message);
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
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:text-purple-800"
                            title="Open in New Tab"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </a>
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
                    <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-20">
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
                                            <label className="text-sm font-medium text-gray-700">Department</label>
                                            <p className="text-gray-900">{request.department || 'General'}</p>
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
                                        <div>
                                            <label className="text-sm font-medium text-gray-700 block">Event Code</label>
                                            <p className="text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded mt-1 block">
                                                {eventCode || 'Not specified'}
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-gray-700">Points to Reward</label>
                                            <p className="text-gray-900 flex items-center">
                                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                                                    {pointsToReward} points
                                                </span>
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
                                            <label className="text-sm font-medium text-gray-700 block">Status</label>
                                            <div className="mt-1">
                                                <select
                                                    value={request.status}
                                                    onChange={(e) => handleStatusChange(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="submitted">Submitted</option>
                                                    <option value="approved">Approved</option>
                                                    <option value="declined">Declined</option>
                                                </select>
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
                                                {request.status !== 'approved' && (
                                                    <p className="text-xs text-amber-600 mt-1">
                                                        ⚠️ Publishing is only available for approved events
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={handlePublishToggle}
                                                disabled={updating || request.status !== 'approved'}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 z-10 ${publishStatus ? 'bg-blue-600' : 'bg-gray-200'
                                                    } ${(updating || request.status !== 'approved') ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                            <div className={`w-3 h-3 rounded-full ${request.flyersNeeded || (request.flyerType && request.flyerType.length > 0) ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                            <span className="text-sm">Flyers Needed</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-3 h-3 rounded-full ${request.photographyNeeded ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                            <span className="text-sm">Photography Needed</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-3 h-3 rounded-full ${(request.hasRoomBooking ?? request.willOrHaveRoomBooking) &&
                                                (request.roomBookingFiles && request.roomBookingFiles.length > 0)
                                                ? 'bg-green-500' : 'bg-gray-300'
                                                }`}></div>
                                            <span className="text-sm">Room Booking</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-3 h-3 rounded-full ${request.servingFoodDrinks ?? request.foodDrinksBeingServed ? 'bg-green-500' : 'bg-gray-300'}`}></div>
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
                        {!(request.hasRoomBooking ?? request.willOrHaveRoomBooking) && (
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
                        {(request.asFundingRequired || request.needsAsFunding || (request.invoices?.length || 0) > 0 || (request.itemizedInvoice?.length || 0) > 0 || request.invoice || (request.invoiceFiles?.length || 0) > 0) && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                    <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                                    Funding & Invoice Information
                                </h3>
                                <div className="space-y-4">
                                    {/* Formatted Invoice Data per invoice */}
                                    {request.invoices && request.invoices.length > 0 ? (
                                        <div className="space-y-3">
                                            <h4 className="font-medium text-green-900">Formatted Invoice Data (Copyable)</h4>
                                            {request.invoices.map((invoice, index) => (
                                                <div key={invoice.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h5 className="font-medium text-green-800">Invoice #{index + 1} - {invoice.vendor}</h5>
                                                        <button
                                                            onClick={() => copyInvoiceData(index)}
                                                            className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                                                            title="Copy this invoice data to clipboard"
                                                        >
                                                            {copiedInvoice ? (
                                                                <>
                                                                    <Check className="w-4 h-4" />
                                                                    <span>Copied!</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Copy className="w-4 h-4" />
                                                                    <span>Copy</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                    <p className="text-green-800 font-mono text-sm bg-white p-3 rounded border break-words">
                                                        {formatInvoiceData(index)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        /* Legacy single invoice format */
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-medium text-green-900">Formatted Invoice Data (Copyable)</h4>
                                                <button
                                                    onClick={() => copyInvoiceData()}
                                                    className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                                                    title="Copy invoice data to clipboard"
                                                >
                                                    {copiedInvoice ? (
                                                        <>
                                                            <Check className="w-4 h-4" />
                                                            <span>Copied!</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-4 h-4" />
                                                            <span>Copy</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            <p className="text-green-800 font-mono text-sm bg-white p-3 rounded border break-words">
                                                {formatInvoiceData()}
                                            </p>
                                        </div>
                                    )}

                                    {/* New multi-invoice display */}
                                    {request.invoices && request.invoices.length > 0 && (
                                        <div>
                                            <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                                                <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
                                                Invoice Details ({request.invoices.length} invoice{request.invoices.length !== 1 ? 's' : ''})
                                            </h4>
                                            <div className="space-y-6">
                                                {request.invoices.map((invoice, index) => (
                                                    <div key={invoice.id} className="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                                                        {/* Header */}
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="flex items-center space-x-3">
                                                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                                    <span className="text-blue-600 font-semibold">#{index + 1}</span>
                                                                </div>
                                                                <div>
                                                                    <h5 className="font-semibold text-gray-900 text-lg">{invoice.vendor}</h5>
                                                                    <p className="text-sm text-gray-500">{invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-2xl font-bold text-green-600">${invoice.total.toFixed(2)}</div>
                                                                <div className="text-sm text-gray-500">Total</div>
                                                            </div>
                                                        </div>

                                                        {/* Items breakdown */}
                                                        <div className="mb-4">
                                                            <h6 className="font-medium text-gray-700 mb-3 flex items-center">
                                                                <FileText className="w-4 h-4 mr-1" />
                                                                Items Breakdown
                                                            </h6>
                                                            <div className="bg-white rounded-lg border border-gray-200">
                                                                {invoice.items.map((item, itemIndex) => (
                                                                    <div key={itemIndex} className={`flex justify-between items-start p-3 gap-4 ${itemIndex !== invoice.items.length - 1 ? 'border-b border-gray-100' : ''}`}>
                                                                        <div className="flex items-start space-x-3 flex-1 min-w-0">
                                                                            <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                                                                                <span className="text-xs font-medium text-blue-600">{item.quantity}</span>
                                                                            </div>
                                                                            <div className="min-w-0 flex-1">
                                                                                <p className="font-medium text-gray-900 break-words">{item.description}</p>
                                                                                <p className="text-sm text-gray-500">${item.unitPrice.toFixed(2)} each</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right flex-shrink-0">
                                                                            <div className="font-semibold text-gray-900">${item.total.toFixed(2)}</div>
                                                                            <div className="text-xs text-gray-500 whitespace-nowrap">{item.quantity} × ${item.unitPrice.toFixed(2)}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Invoice file */}
                                                        {invoice.invoiceFile && (
                                                            <div className="mb-4">
                                                                <h6 className="font-medium text-gray-700 mb-3 flex items-center">
                                                                    <FileText className="w-4 h-4 mr-1" />
                                                                    Invoice File
                                                                </h6>
                                                                <div className="bg-white border border-gray-200 rounded-lg p-3">
                                                                    <FileViewer url={invoice.invoiceFile} filename="Invoice" />
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Invoice totals */}
                                                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                                                            <h6 className="font-medium text-gray-700 mb-3">Cost Breakdown</h6>
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between text-sm">
                                                                    <span className="text-gray-600">Subtotal:</span>
                                                                    <span className="font-medium">${invoice.subtotal.toFixed(2)}</span>
                                                                </div>
                                                                {invoice.tax > 0 && (
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-gray-600">Tax:</span>
                                                                        <span className="font-medium">${invoice.tax.toFixed(2)}</span>
                                                                    </div>
                                                                )}
                                                                {invoice.tip > 0 && (
                                                                    <div className="flex justify-between text-sm">
                                                                        <span className="text-gray-600">Tip:</span>
                                                                        <span className="font-medium">${invoice.tip.toFixed(2)}</span>
                                                                    </div>
                                                                )}
                                                                <div className="border-t border-gray-200 pt-2">
                                                                    <div className="flex justify-between">
                                                                        <span className="font-semibold text-gray-900">Invoice Total:</span>
                                                                        <span className="font-bold text-lg text-green-600">${invoice.total.toFixed(2)}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Grand total */}
                                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6">
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center space-x-3">
                                                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                                                <DollarSign className="w-6 h-6 text-blue-600" />
                                                            </div>
                                                            <div>
                                                                <h5 className="font-bold text-blue-900 text-lg">Grand Total</h5>
                                                                <p className="text-sm text-blue-700">All {request.invoices.length} invoice{request.invoices.length !== 1 ? 's' : ''} combined</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-3xl font-bold text-blue-900">
                                                                ${request.invoices.reduce((total, invoice) => total + invoice.total, 0).toFixed(2)}
                                                            </div>
                                                            <div className="text-sm text-blue-600">Total Funding Request</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Legacy single invoice display (for backward compatibility) */}
                                    {(!request.invoices || request.invoices.length === 0) && request.invoiceFiles && request.invoiceFiles.length > 0 && (
                                        <div>
                                            <h4 className="font-medium text-gray-900 mb-3">Invoice Files (Legacy)</h4>
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
                                Public Event Files
                            </h3>
                            {loadingEventFiles ? (
                                <div className="text-center py-4">
                                    <p className="text-gray-500">Loading event files...</p>
                                </div>
                            ) : eventFiles.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {eventFiles.map((file, index) => (
                                        <FileViewer key={index} url={file} filename={`Public File ${index + 1}`} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-gray-500">No public event files available</p>
                                </div>
                            )}
                        </div>

                        {/* Private Files from Events Collection and Request */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <Lock className="w-5 h-5 mr-2 text-red-600" />
                                Private Event Files
                            </h3>
                            {loadingEventFiles ? (
                                <div className="text-center py-4">
                                    <p className="text-gray-500">Loading private files...</p>
                                </div>
                            ) : (() => {
                                // Combine all private files from both events collection and request
                                const allPrivateFiles = [
                                    ...privateFiles.map((file, index) => ({ url: file, name: `Private File ${index + 1}`, type: 'events' })),
                                    ...(request.invoiceFiles || []).map((file, index) => ({ url: file, name: `Invoice ${index + 1}`, type: 'invoice' })),
                                    ...(request.roomBookingFiles || []).map((file, index) => ({ url: file, name: `Room Booking ${index + 1}`, type: 'room-booking' }))
                                ];

                                // Add main invoice file if it exists
                                if (request.invoice) {
                                    allPrivateFiles.push({ url: request.invoice, name: 'Main Invoice', type: 'main-invoice' });
                                }

                                return allPrivateFiles.length > 0 ? (
                                    <div className="space-y-4">
                                        {/* Group files by type */}
                                        {request.invoiceFiles && request.invoiceFiles.length > 0 && (
                                            <div>
                                                <h4 className="font-medium text-gray-900 mb-2">Invoice Files</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {request.invoiceFiles.map((file, index) => (
                                                        <FileViewer key={`invoice-${index}`} url={file} filename={`Invoice ${index + 1}`} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {request.invoice && (
                                            <div>
                                                <h4 className="font-medium text-gray-900 mb-2">Main Invoice</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    <FileViewer url={request.invoice} filename={(() => {
                                                        try {
                                                            const urlObj = new URL(request.invoice);
                                                            const pathname = urlObj.pathname;
                                                            const filename = pathname.split('/').pop();
                                                            if (filename && filename.includes('_')) {
                                                                return filename.substring(filename.indexOf('_') + 1);
                                                            }
                                                            return filename || 'Main Invoice File';
                                                        } catch {
                                                            return 'Main Invoice File';
                                                        }
                                                    })()} />
                                                </div>
                                            </div>
                                        )}

                                        {request.roomBookingFiles && request.roomBookingFiles.length > 0 && (
                                            <div>
                                                <h4 className="font-medium text-gray-900 mb-2">Room Booking Files</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {request.roomBookingFiles.map((file, index) => (
                                                        <FileViewer key={`room-${index}`} url={file} filename={`Room Booking ${index + 1}`} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {privateFiles.length > 0 && (
                                            <div>
                                                <h4 className="font-medium text-gray-900 mb-2">Other Private Files</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {privateFiles.map((file, index) => (
                                                        <FileViewer key={`private-${index}`} url={file} filename={`Private File ${index + 1}`} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                                        <p className="text-gray-500">No private event files available</p>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Attendees Section */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                    <Users className="w-5 h-5 mr-2 text-purple-600" />
                                    Event Attendees ({attendees.filter(attendee => {
                                        if (!attendeeSearch) return true;
                                        const searchTerm = attendeeSearch.toLowerCase();
                                        const userId = (attendee.userId || attendee.id || '').toLowerCase();
                                        const userName = (getUserName(attendee.userId || attendee.id) || '').toLowerCase();
                                        const food = (attendee.food || '').toLowerCase();
                                        return userId.includes(searchTerm) || userName.includes(searchTerm) || food.includes(searchTerm);
                                    }).length})
                                </h3>
                                {attendees.length > 0 && (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Search attendees..."
                                            value={attendeeSearch}
                                            onChange={(e) => setAttendeeSearch(e.target.value)}
                                            className="pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                                        />
                                        <Users className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    </div>
                                )}
                            </div>
                            {loadingAttendees ? (
                                <div className="text-center py-4">
                                    <p className="text-gray-500">Loading attendees...</p>
                                </div>
                            ) : attendees.length > 0 ? (
                                <div className="space-y-4">
                                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                            <div>
                                                <span className="font-medium text-purple-800">Total Attendees:</span>
                                                <p className="text-purple-700">{attendees.length}</p>
                                            </div>
                                            <div>
                                                <span className="font-medium text-purple-800">Total Points Awarded:</span>
                                                <p className="text-purple-700">{attendees.reduce((sum, attendee) => sum + (attendee.pointsEarned || 0), 0)}</p>
                                            </div>
                                            <div>
                                                <span className="font-medium text-purple-800">Food Preferences:</span>
                                                <p className="text-purple-700">
                                                    {attendees.filter(a => a.food).length} specified
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {attendees.filter(attendee => {
                                            if (!attendeeSearch) return true;
                                            const searchTerm = attendeeSearch.toLowerCase();
                                            const userId = (attendee.userId || attendee.id || '').toLowerCase();
                                            const userName = (getUserName(attendee.userId || attendee.id) || '').toLowerCase();
                                            const food = (attendee.food || '').toLowerCase();
                                            return userId.includes(searchTerm) || userName.includes(searchTerm) || food.includes(searchTerm);
                                        }).map((attendee, index) => (
                                            <div key={attendee.id || index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                                <div className="space-y-2">
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-700">Name:</span>
                                                        <p className="text-gray-900 text-sm font-medium">{getUserName(attendee.userId || attendee.id)}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-700">User ID:</span>
                                                        <p className="text-gray-900 text-xs font-mono text-gray-600">{attendee.userId || attendee.id}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-700">Check-in Time:</span>
                                                        <p className="text-gray-900 text-sm">
                                                            {attendee.timeCheckedIn ?
                                                                new Date(attendee.timeCheckedIn.toDate ? attendee.timeCheckedIn.toDate() : attendee.timeCheckedIn).toLocaleString() :
                                                                'Not specified'
                                                            }
                                                        </p>
                                                    </div>
                                                    {attendee.food && (
                                                        <div>
                                                            <span className="text-sm font-medium text-gray-700">Food Preference:</span>
                                                            <p className="text-gray-900 text-sm">{attendee.food}</p>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-700">Points Earned:</span>
                                                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium ml-2">
                                                            {attendee.pointsEarned || 0} points
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {attendees.filter(attendee => {
                                        if (!attendeeSearch) return true;
                                        const searchTerm = attendeeSearch.toLowerCase();
                                        const userId = (attendee.userId || attendee.id || '').toLowerCase();
                                        const userName = (getUserName(attendee.userId || attendee.id) || '').toLowerCase();
                                        const food = (attendee.food || '').toLowerCase();
                                        return userId.includes(searchTerm) || userName.includes(searchTerm) || food.includes(searchTerm);
                                    }).length === 0 && attendeeSearch && (
                                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                                                <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                                <p className="text-gray-500">No attendees match your search</p>
                                                <button
                                                    onClick={() => setAttendeeSearch('')}
                                                    className="mt-2 text-purple-600 hover:text-purple-800 underline text-sm"
                                                >
                                                    Clear search
                                                </button>
                                            </div>
                                        )}
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                    <p className="text-gray-500">No attendees have checked in yet</p>
                                </div>
                            )}
                        </div>

                        {/* Summary of All Files */}
                        {(
                            (request.roomBookingFiles && request.roomBookingFiles.length > 0) ||
                            (request.invoiceFiles && request.invoiceFiles.length > 0) ||
                            (request.invoices && request.invoices.some(inv => inv.invoiceFile)) ||
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
                                            <p className="text-blue-700">{
                                                ((request.invoiceFiles?.length || 0) +
                                                    (request.invoices?.filter(inv => inv.invoiceFile).length || 0))
                                            } files</p>
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
            </div >

            {/* File Preview Modal */}
            {
                selectedFile && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
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
                )
            }
        </>
    );
} 