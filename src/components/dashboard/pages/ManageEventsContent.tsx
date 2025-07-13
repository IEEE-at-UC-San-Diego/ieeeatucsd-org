import React, { useState, useEffect } from 'react';
import { Search, Calendar, Bell, User, Plus, Filter, Edit, Trash2, Clock, CheckCircle, XCircle, Eye, FileText, EyeOff } from 'lucide-react';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { app } from '../../../firebase/client';
import { EventManagementStats } from './manage-events/EventManagementStats';
import type { EventStats } from './manage-events/types';
import EventRequestModal from './manage-events/EventRequestModal';
import EventViewModal from './manage-events/EventViewModal';
import FileManagementModal from './manage-events/FileManagementModal';

interface EventRequest {
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
}

export default function ManageEventsContent() {
    const [showEventRequestModal, setShowEventRequestModal] = useState(false);
    const [showEventViewModal, setShowEventViewModal] = useState(false);
    const [showFileManagementModal, setShowFileManagementModal] = useState(false);
    const [eventRequests, setEventRequests] = useState<EventRequest[]>([]);
    const [users, setUsers] = useState<Record<string, { name: string; email: string }>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [editingRequest, setEditingRequest] = useState<EventRequest | null>(null);
    const [viewingRequest, setViewingRequest] = useState<EventRequest | null>(null);
    const [managingFilesRequest, setManagingFilesRequest] = useState<EventRequest | null>(null);

    const db = getFirestore(app);

    useEffect(() => {
        fetchUsers();

        // Set up real-time listener for event requests
        const eventRequestsRef = collection(db, 'event_requests');
        const q = query(eventRequestsRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventRequestsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as EventRequest[];

            console.log('Real-time update: Fetched event requests:', eventRequestsData.length);
            setEventRequests(eventRequestsData);
            setLoading(false);
        }, (error) => {
            console.error('Error in real-time listener:', error);
            setError('Failed to fetch event requests: ' + error.message);
            setLoading(false);
        });

        // Cleanup listener on unmount
        return () => unsubscribe();
    }, [db]);

    const fetchEventRequests = async () => {
        try {
            setLoading(true);
            setError(null);

            const eventRequestsRef = collection(db, 'event_requests');
            const eventRequestsSnapshot = await getDocs(query(eventRequestsRef, orderBy('createdAt', 'desc')));

            const eventRequestsData = eventRequestsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as EventRequest[];

            console.log('Fetched event requests:', eventRequestsData.length, eventRequestsData);
            setEventRequests(eventRequestsData);
        } catch (error) {
            console.error('Error fetching event requests:', error);
            setError('Failed to fetch event requests');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const usersRef = collection(db, 'users');
            const usersSnapshot = await getDocs(usersRef);

            const usersMap: Record<string, { name: string; email: string }> = {};
            usersSnapshot.docs.forEach(doc => {
                const data = doc.data();
                usersMap[doc.id] = {
                    name: data.name || data.email || 'Unknown User',
                    email: data.email || ''
                };
            });

            setUsers(usersMap);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const handleDeleteRequest = async (requestId: string, eventName: string) => {
        if (!confirm(`Are you sure you want to delete the event request "${eventName}"? This will also delete any corresponding published event.`)) {
            return;
        }

        try {
            setError(null);

            // Delete from event_requests collection
            await deleteDoc(doc(db, 'event_requests', requestId));

            // Find and delete corresponding event from events collection
            const eventsRef = collection(db, 'events');
            const eventsQuery = query(eventsRef, where('eventName', '==', eventName));
            const eventsSnapshot = await getDocs(eventsQuery);

            // Delete all matching events (there should typically be only one or none)
            const deletePromises = eventsSnapshot.docs.map(eventDoc =>
                deleteDoc(doc(db, 'events', eventDoc.id))
            );
            await Promise.all(deletePromises);

            setSuccess(`Event request "${eventName}" deleted successfully`);
            fetchEventRequests(); // Refresh the list

        } catch (error) {
            console.error('Error deleting event request:', error);
            setError('Failed to delete event request');
        }
    };

    const handleEditRequest = (request: EventRequest) => {
        setEditingRequest(request);
        setShowEventRequestModal(true);
    };

    const handleViewRequest = (request: EventRequest) => {
        setViewingRequest(request);
        setShowEventViewModal(true);
    };

    const handleFileManagement = (request: EventRequest) => {
        setManagingFilesRequest(request);
        setShowFileManagementModal(true);
    };

    const getUserName = (userId: string) => {
        return users[userId]?.name || userId;
    };

    const handlePublishToggle = async (requestId: string, currentStatus: boolean) => {
        try {
            // Find and update the corresponding event in events collection
            const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', requestId));
            const eventsSnapshot = await getDocs(eventsQuery);

            if (!eventsSnapshot.empty) {
                const eventDoc = eventsSnapshot.docs[0];
                await updateDoc(doc(db, 'events', eventDoc.id), {
                    published: !currentStatus,
                    updatedAt: new Date()
                });

                // Update local state
                setEventRequests(prev =>
                    prev.map(request =>
                        request.id === requestId
                            ? { ...request, published: !currentStatus }
                            : request
                    )
                );

                setSuccess(`Event ${!currentStatus ? 'published' : 'unpublished'} successfully`);
            }
        } catch (error) {
            console.error('Error updating publish status:', error);
            setError('Failed to update publish status');
        }
    };

    const handleUpdateEventStatus = async (requestId: string, newStatus: string) => {
        try {
            setError(null);

            // Update status in event_requests collection
            await updateDoc(doc(db, 'event_requests', requestId), {
                status: newStatus,
                updatedAt: new Date()
            });

            setSuccess(`Event request status updated to ${newStatus}`);
            fetchEventRequests(); // Refresh the list

        } catch (error) {
            console.error('Error updating event status:', error);
            setError('Failed to update event status');
        }
    };

    const getStats = (): EventStats => {
        const total = eventRequests.length;
        const published = eventRequests.filter(req => req.status === 'approved').length;
        const drafts = eventRequests.filter(req => req.status === 'submitted' || req.status === 'pending').length;
        const totalAttendees = 0; // This would need to be calculated from actual events

        return { total, published, drafts, totalAttendees };
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved':
                return 'bg-green-100 text-green-800';
            case 'submitted':
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'rejected':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved':
                return <CheckCircle className="w-4 h-4" />;
            case 'submitted':
            case 'pending':
                return <Clock className="w-4 h-4" />;
            case 'rejected':
                return <XCircle className="w-4 h-4" />;
            default:
                return <Clock className="w-4 h-4" />;
        }
    };

    const stats = getStats();

    return (
        <div className="flex-1 overflow-auto">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search events..."
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                            Search
                        </button>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Calendar className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Bell className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <User className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Manage Events Content */}
            <main className="p-6">
                <div className="grid grid-cols-1 gap-6">
                    {/* Page Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Manage Events</h1>
                            <p className="text-gray-600">Create, edit, and manage IEEE UCSD events</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                <Filter className="w-4 h-4" />
                                <span>Filter</span>
                            </button>
                            <button
                                onClick={() => setShowEventRequestModal(true)}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Create Event</span>
                            </button>
                        </div>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-700">{error}</p>
                            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 ml-2">×</button>
                        </div>
                    )}
                    {success && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-green-700">{success}</p>
                            <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700 ml-2">×</button>
                        </div>
                    )}

                    {/* Event Management Stats */}
                    <EventManagementStats stats={stats} />

                    {/* Event Requests Table */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">Event Requests ({eventRequests.length})</h2>
                        </div>
                        <div className="overflow-x-auto">
                            {loading ? (
                                <div className="p-6 text-center">
                                    <p className="text-gray-500">Loading event requests...</p>
                                </div>
                            ) : error ? (
                                <div className="p-6 text-center">
                                    <p className="text-red-500">{error}</p>
                                </div>
                            ) : eventRequests.length === 0 ? (
                                <div className="p-6 text-center">
                                    <p className="text-gray-500">No event requests found</p>
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Event
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Date & Location
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Requirements
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Submitted By & Date
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {eventRequests.map((request) => (
                                            <tr key={request.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{request.name}</div>
                                                        <div className="text-sm text-gray-500 truncate max-w-xs">
                                                            {request.eventDescription}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-sm text-gray-900">
                                                            {request.startDateTime?.toDate?.()?.toLocaleDateString() || 'No date'}
                                                        </div>
                                                        <div className="text-sm text-gray-500">{request.location}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className={`inline-flex items-center space-x-1 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
                                                        {getStatusIcon(request.status)}
                                                        <span className="capitalize">{request.status}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex space-x-2">
                                                        {request.needsGraphics && (
                                                            <span className="inline-flex px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                                                                Graphics
                                                            </span>
                                                        )}
                                                        {request.needsAsFunding && (
                                                            <span className="inline-flex px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                                                                Funding
                                                            </span>
                                                        )}
                                                        {!request.needsGraphics && !request.needsAsFunding && (
                                                            <span className="text-xs text-gray-400">None</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {getUserName(request.requestedUser)}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {request.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        <button
                                                            onClick={() => handleViewRequest(request)}
                                                            className="text-green-600 hover:text-green-900"
                                                            title="View Request"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleFileManagement(request)}
                                                            className="text-purple-600 hover:text-purple-900"
                                                            title="Manage Files"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditRequest(request)}
                                                            className="text-blue-600 hover:text-blue-900"
                                                            title="Edit Request"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteRequest(request.id, request.name)}
                                                            className="text-red-600 hover:text-red-900"
                                                            title="Delete Request"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button
                                onClick={() => setShowEventRequestModal(true)}
                                className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Plus className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">Create Event</p>
                                    <p className="text-sm text-gray-500">Set up a new IEEE event</p>
                                </div>
                            </button>
                            <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">Event Templates</p>
                                    <p className="text-sm text-gray-500">Use pre-built event templates</p>
                                </div>
                            </button>
                            <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <User className="w-5 h-5 text-purple-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">Bulk Actions</p>
                                    <p className="text-sm text-gray-500">Manage multiple events</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Event Request Modal */}
            {showEventRequestModal && (
                <EventRequestModal
                    onClose={() => {
                        setShowEventRequestModal(false);
                        setEditingRequest(null);
                    }}
                    editingRequest={editingRequest}
                    onSuccess={() => {
                        // Real-time updates will handle the refresh automatically
                        setSuccess(editingRequest ? 'Event request updated successfully' : 'Event request created successfully');
                    }}
                />
            )}

            {/* Event View Modal */}
            {showEventViewModal && (
                <EventViewModal
                    request={viewingRequest}
                    users={users}
                    onClose={() => {
                        setShowEventViewModal(false);
                        setViewingRequest(null);
                    }}
                />
            )}

            {/* File Management Modal */}
            {showFileManagementModal && (
                <FileManagementModal
                    request={managingFilesRequest}
                    onClose={() => {
                        setShowFileManagementModal(false);
                        setManagingFilesRequest(null);
                    }}
                />
            )}
        </div>
    );
} 