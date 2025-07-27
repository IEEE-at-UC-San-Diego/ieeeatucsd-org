import React, { useState, useEffect } from 'react';
import { Search, Calendar, Bell, User, Plus, Filter, Edit, Trash2, Clock, CheckCircle, XCircle, Eye, FileText, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, deleteDoc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { app, auth } from '../../../firebase/client';
import { EventManagementStats } from './manage-events/EventManagementStats';
import type { EventStats } from './manage-events/types';
import EventRequestModal from './manage-events/EventRequestModal';
import EventViewModal from './manage-events/EventViewModal';
import FileManagementModal from './manage-events/FileManagementModal';
import BulkActionsModal from './manage-events/BulkActionsModal';
import { PublicProfileService } from '../services/publicProfile';
import { EmailClient } from '../../../scripts/email/EmailClient';
import type { UserRole } from '../types/firestore';

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
    const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
    const [showEventTemplatesModal, setShowEventTemplatesModal] = useState(false);
    const [eventRequests, setEventRequests] = useState<EventRequest[]>([]);
    const [users, setUsers] = useState<Record<string, { name: string; email: string }>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [editingRequest, setEditingRequest] = useState<EventRequest | null>(null);
    const [viewingRequest, setViewingRequest] = useState<EventRequest | null>(null);
    const [managingFilesRequest, setManagingFilesRequest] = useState<EventRequest | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<UserRole>('Member');

    // Filter state
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<string>('date-desc');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const eventsPerPage = 10;

    const db = getFirestore(app);

    useEffect(() => {
        fetchUsers();

        // Fetch current user's role
        const fetchUserRole = async () => {
            try {
                const user = auth.currentUser;
                if (user) {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setCurrentUserRole(userData.role || 'Member');
                    } else {
                        setCurrentUserRole('Member');
                    }
                }
            } catch (error) {
                console.error('Error fetching user role:', error);
                setCurrentUserRole('Member');
            }
        };

        fetchUserRole();

        // Set up real-time listener for event requests
        const eventRequestsRef = collection(db, 'event_requests');
        const q = query(eventRequestsRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventRequestsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as EventRequest[];

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
            // First try to get all public profiles for user names
            const publicProfiles = await PublicProfileService.getLeaderboard();
            const usersMap: Record<string, { name: string; email: string }> = {};

            // Map public profiles to users
            publicProfiles.forEach(profile => {
                usersMap[profile.id] = {
                    name: profile.name || 'Unknown User',
                    email: '' // Email not available in public profiles for privacy
                };
            });

            // For any users not in public profiles, try to get from users collection (officers have access)
            try {
                const usersRef = collection(db, 'users');
                const usersSnapshot = await getDocs(usersRef);

                usersSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    // Only add if not already in public profiles map
                    if (!usersMap[doc.id]) {
                        usersMap[doc.id] = {
                            name: data.name || data.email || 'Unknown User',
                            email: data.email || ''
                        };
                    }
                });
            } catch (fallbackError) {
                console.warn('Could not fetch additional user data from users collection:', fallbackError);
            }

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

            // Get event request data for deletion email before deleting
            const eventRequestDoc = await getDoc(doc(db, 'event_requests', requestId));
            const eventRequestData = eventRequestDoc.exists() ? eventRequestDoc.data() : null;

            // Get user data for deletion email
            let userData = null;
            if (eventRequestData?.requestedUser) {
                const userDoc = await getDoc(doc(db, 'users', eventRequestData.requestedUser));
                userData = userDoc.exists() ? userDoc.data() : null;
            }

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

            // Send deletion email notification
            if (eventRequestData && userData) {
                try {
                    await EmailClient.notifyFirebaseEventDelete(
                        requestId,
                        eventName,
                        eventRequestData.location || '',
                        userData.name || userData.email || 'Unknown User',
                        userData.email || '',
                        eventRequestData.status || 'unknown'
                    );
                } catch (emailError) {
                    console.error('Failed to send deletion email:', emailError);
                    // Don't block the main flow for email failures
                }
            }

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

    const handleTemplateSelection = (template: any) => {
        // Create a new event request with template data
        const templateRequest: EventRequest = {
            id: '', // New event, no ID yet
            name: template.name,
            location: template.defaultLocation,
            startDateTime: null, // User will set this
            endDateTime: null, // User will set this
            eventDescription: template.eventDescription,
            status: 'pending',
            requestedUser: '', // Will be set when creating
            createdAt: null, // Will be set when creating
            needsGraphics: template.needsGraphics,
            needsAsFunding: template.asFundingRequired,
            asFundingRequired: template.asFundingRequired,
            flyersNeeded: template.flyersNeeded,
            photographyNeeded: template.photographyNeeded,
            expectedAttendance: template.expectedAttendance,
            foodDrinksBeingServed: template.foodDrinksBeingServed,
            department: template.department
        };

        setEditingRequest(templateRequest);
        setShowEventRequestModal(true);
    };

    // Filter functionality
    const filteredEventRequests = eventRequests.filter(request => {
        const matchesSearch = searchTerm === '' ||
            request.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            request.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
            getUserName(request.requestedUser).toLowerCase().includes(searchTerm.toLowerCase());

        return matchesSearch;
    });

    // Sort functionality
    const sortedEventRequests = [...filteredEventRequests].sort((a, b) => {
        switch (sortBy) {
            case 'date-desc':
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB.getTime() - dateA.getTime();
            case 'date-asc':
                const dateAsc_A = a.createdAt?.toDate?.() || new Date(0);
                const dateAsc_B = b.createdAt?.toDate?.() || new Date(0);
                return dateAsc_A.getTime() - dateAsc_B.getTime();
            case 'name-asc':
                return a.name.localeCompare(b.name);
            case 'name-desc':
                return b.name.localeCompare(a.name);
            case 'status-asc':
                return a.status.localeCompare(b.status);
            case 'status-desc':
                return b.status.localeCompare(a.status);
            default:
                return 0;
        }
    });

    // Pagination logic
    const totalPages = Math.ceil(sortedEventRequests.length / eventsPerPage);
    const startIndex = (currentPage - 1) * eventsPerPage;
    const endIndex = startIndex + eventsPerPage;
    const paginatedEventRequests = sortedEventRequests.slice(startIndex, endIndex);

    const handleSearch = (term: string) => {
        setSearchTerm(term);
        setCurrentPage(1); // Reset to first page on search
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setSortBy('date-desc');
        setCurrentPage(1);
    };

    const handleSort = (column: string) => {
        let newSortBy = '';

        switch (column) {
            case 'name':
                newSortBy = sortBy === 'name-asc' ? 'name-desc' : 'name-asc';
                break;
            case 'date':
                newSortBy = sortBy === 'date-asc' ? 'date-desc' : 'date-asc';
                break;
            case 'status':
                newSortBy = sortBy === 'status-asc' ? 'status-desc' : 'status-asc';
                break;
            default:
                newSortBy = 'date-desc';
        }

        setSortBy(newSortBy);
        setCurrentPage(1); // Reset to first page when sorting
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [sortBy]);

    const getUserName = (userId: string) => {
        return users[userId]?.name || userId;
    };

    // Permission helper functions
    const canEditEvent = (request: EventRequest) => {
        const currentUser = auth.currentUser;
        if (!currentUser) return false;

        // Administrators can edit any event
        if (currentUserRole === 'Administrator') return true;

        // Executive Officers can edit any event
        if (currentUserRole === 'Executive Officer') return true;

        // General Officers can only edit their own events if not approved yet
        if (currentUserRole === 'General Officer') {
            return request.requestedUser === currentUser.uid &&
                ['submitted', 'pending'].includes(request.status);
        }

        return false;
    };

    const canDeleteEvent = (request: EventRequest) => {
        const currentUser = auth.currentUser;
        if (!currentUser) return false;

        // Administrators can delete any event
        if (currentUserRole === 'Administrator') return true;

        // Executive Officers can delete any event
        if (currentUserRole === 'Executive Officer') return true;

        // General Officers can only delete their own events if not approved yet
        if (currentUserRole === 'General Officer') {
            return request.requestedUser === currentUser.uid &&
                ['submitted', 'pending'].includes(request.status);
        }

        return false;
    };

    const canApproveOrPublish = () => {
        // Only Executive Officers and Administrators can approve, decline, or publish events
        return ['Executive Officer', 'Administrator'].includes(currentUserRole);
    };

    const canCreateEvent = () => {
        // General Officers, Executive Officers, and Administrators can create events
        return ['General Officer', 'Executive Officer', 'Administrator'].includes(currentUserRole);
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

    const handleUpdateEventStatus = async (requestId: string, newStatus: string, declinedReason?: string) => {
        try {
            setError(null);

            // Get current event data for status change email
            const currentEventRequest = eventRequests.find(req => req.id === requestId);
            const previousStatus = currentEventRequest?.status;

            // Update status in event_requests collection
            const updateData: any = {
                status: newStatus,
                updatedAt: new Date()
            };

            if (declinedReason) {
                updateData.declinedReason = declinedReason;
            }

            await updateDoc(doc(db, 'event_requests', requestId), updateData);

            // Automatically publish/unpublish corresponding event based on status
            const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', requestId));
            const eventsSnapshot = await getDocs(eventsQuery);

            if (!eventsSnapshot.empty) {
                const eventDoc = eventsSnapshot.docs[0];
                const shouldPublish = newStatus === 'approved';
                await updateDoc(doc(db, 'events', eventDoc.id), {
                    published: shouldPublish,
                    updatedAt: new Date()
                });
                console.log(`Auto ${shouldPublish ? 'published' : 'unpublished'} event for status: ${newStatus}`);
            }

            // Send email notification for status change
            if (previousStatus && previousStatus !== newStatus) {
                try {
                    console.log(`Sending status change email: ${previousStatus} -> ${newStatus}`);
                    await EmailClient.notifyFirebaseEventRequestStatusChange(
                        requestId,
                        newStatus,
                        previousStatus,
                        undefined, // changedByUserId - could add current user if needed
                        declinedReason
                    );
                } catch (emailError) {
                    console.error('Failed to send status change email:', emailError);
                    // Don't block the main flow for email failures
                }
            }

            setSuccess(`Event request status updated to ${newStatus}${newStatus === 'approved' ? ' and published' : ''}`);

        } catch (error) {
            console.error('Error updating event status:', error);
            setError('Failed to update event status');
        }
    };

    const getStats = async (): Promise<EventStats> => {
        const total = eventRequests.length;
        const published = eventRequests.filter(req => req.status === 'approved').length;
        const drafts = eventRequests.filter(req => req.status === 'submitted' || req.status === 'pending').length;

        // Calculate total attendees from all events
        let totalAttendees = 0;
        try {
            const eventsQuery = query(collection(db, 'events'));
            const eventsSnapshot = await getDocs(eventsQuery);

            for (const eventDoc of eventsSnapshot.docs) {
                const attendeesQuery = query(collection(db, 'events', eventDoc.id, 'attendees'));
                const attendeesSnapshot = await getDocs(attendeesQuery);
                totalAttendees += attendeesSnapshot.docs.length;
            }
        } catch (error) {
            console.error('Error calculating total attendees:', error);
        }

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

    const [stats, setStats] = useState<EventStats>({ total: 0, published: 0, drafts: 0, totalAttendees: 0 });

    // Update stats when event requests change
    useEffect(() => {
        const updateStats = async () => {
            const newStats = await getStats();
            setStats(newStats);
        };

        if (eventRequests.length > 0) {
            updateStats();
        }
    }, [eventRequests, currentUserRole]); // Added currentUserRole dependency



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
                                value={searchTerm}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        {searchTerm && (
                            <button
                                onClick={handleClearFilters}
                                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                Clear
                            </button>
                        )}
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
                            {canCreateEvent() && (
                                <button
                                    onClick={() => setShowEventRequestModal(true)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Request an Event</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <EventManagementStats stats={stats} />

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-700">{error}</p>
                        </div>
                    )}

                    {success && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-green-700">{success}</p>
                        </div>
                    )}

                    {/* Event Requests Table */}
                    <div key={currentUserRole} className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">Event Requests ({sortedEventRequests.length})</h2>
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
                            ) : paginatedEventRequests.length === 0 && sortedEventRequests.length === 0 ? (
                                <div className="p-6 text-center">
                                    <p className="text-gray-500">
                                        {eventRequests.length === 0 ? 'No event requests found' : 'No events match the current filters'}
                                    </p>
                                    {eventRequests.length > 0 && (
                                        <button
                                            onClick={handleClearFilters}
                                            className="mt-2 text-blue-600 hover:text-blue-800 underline"
                                        >
                                            Clear filters
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                                onClick={() => handleSort('name')}
                                            >
                                                <div className="flex items-center space-x-1">
                                                    <span>Event</span>
                                                    {(sortBy === 'name-asc' || sortBy === 'name-desc') && (
                                                        sortBy === 'name-asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                                onClick={() => handleSort('date')}
                                            >
                                                <div className="flex items-center space-x-1">
                                                    <span>Date & Location</span>
                                                    {(sortBy === 'date-asc' || sortBy === 'date-desc') && (
                                                        sortBy === 'date-asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                                onClick={() => handleSort('status')}
                                            >
                                                <div className="flex items-center space-x-1">
                                                    <span>Status</span>
                                                    {(sortBy === 'status-asc' || sortBy === 'status-desc') && (
                                                        sortBy === 'status-asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                                    )}
                                                </div>
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
                                        {paginatedEventRequests.map((request) => (
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
                                                        {canEditEvent(request) && (
                                                            <button
                                                                onClick={() => handleFileManagement(request)}
                                                                className="text-purple-600 hover:text-purple-900"
                                                                title="Manage Files"
                                                            >
                                                                <FileText className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {canEditEvent(request) && (
                                                            <button
                                                                onClick={() => handleEditRequest(request)}
                                                                className="text-blue-600 hover:text-blue-900"
                                                                title="Edit Request"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {canDeleteEvent(request) && (
                                                            <button
                                                                onClick={() => handleDeleteRequest(request.id, request.name)}
                                                                className="text-red-600 hover:text-red-900"
                                                                title="Delete Request"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {canApproveOrPublish() && request.status === 'submitted' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleUpdateEventStatus(request.id, 'approved')}
                                                                    className="text-green-600 hover:text-green-900"
                                                                    title="Approve Event"
                                                                >
                                                                    <CheckCircle className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUpdateEventStatus(request.id, 'rejected')}
                                                                    className="text-red-600 hover:text-red-900"
                                                                    title="Reject Event"
                                                                >
                                                                    <XCircle className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}

                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                    Showing {startIndex + 1} to {Math.min(endIndex, sortedEventRequests.length)} of {sortedEventRequests.length} events
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>

                                    <div className="flex items-center space-x-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => handlePageChange(page)}
                                                className={`px-3 py-2 text-sm font-medium rounded-lg ${currentPage === page
                                                    ? 'bg-blue-600 text-white'
                                                    : 'text-gray-700 hover:bg-gray-50 border border-gray-300'
                                                    }`}
                                            >
                                                {page}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </main >

            {/* Event Request Modal */}
            {
                showEventRequestModal && (
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
                )
            }

            {/* Event View Modal */}
            {
                showEventViewModal && (
                    <EventViewModal
                        request={viewingRequest}
                        users={users}
                        onClose={() => {
                            setShowEventViewModal(false);
                            setViewingRequest(null);
                        }}
                    />
                )
            }

            {/* File Management Modal */}
            {
                showFileManagementModal && (
                    <FileManagementModal
                        request={managingFilesRequest}
                        onClose={() => {
                            setShowFileManagementModal(false);
                            setManagingFilesRequest(null);
                        }}
                    />
                )
            }

            {/* Bulk Actions Modal */}
            {
                showBulkActionsModal && (
                    <BulkActionsModal
                        events={eventRequests}
                        users={users}
                        onClose={() => setShowBulkActionsModal(false)}
                        onSuccess={(message) => setSuccess(message)}
                        onError={(message) => setError(message)}
                    />
                )
            }

        </div >
    );
} 