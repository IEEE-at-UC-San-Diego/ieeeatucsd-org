import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { DataSyncService } from '../../../scripts/database/DataSyncService';
import { Collections } from '../../../schemas/pocketbase/schema';
import type { EventRequest as SchemaEventRequest } from '../../../schemas/pocketbase';

// Declare the global window interface to include our custom function
declare global {
    interface Window {
        showEventRequestFormPreview?: (formData: any) => void;
    }
}

// Extended EventRequest interface with additional properties needed for this component
export interface EventRequest extends SchemaEventRequest {
    invoice_data?: any;
}

interface UserEventRequestsProps {
    eventRequests: EventRequest[];
}

const UserEventRequests: React.FC<UserEventRequestsProps> = ({ eventRequests: initialEventRequests }) => {
    const [eventRequests, setEventRequests] = useState<EventRequest[]>(initialEventRequests);
    const [selectedRequest, setSelectedRequest] = useState<EventRequest | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
    const dataSync = DataSyncService.getInstance();

    // Refresh event requests
    const refreshEventRequests = async () => {
        setIsRefreshing(true);

        try {
            const auth = Authentication.getInstance();

            if (!auth.isAuthenticated()) {
                return;
            }

            const userId = auth.getUserId();
            if (!userId) {
                return;
            }

            // Use DataSyncService to get data from IndexedDB with forced sync
            const updatedRequests = await dataSync.getData<EventRequest>(
                Collections.EVENT_REQUESTS,
                true, // Force sync
                `requested_user="${userId}"`,
                '-created'
            );

            setEventRequests(updatedRequests);
        } catch (err) {
            console.error('Failed to refresh event requests:', err);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Auto refresh on component mount
    useEffect(() => {
        refreshEventRequests();
    }, []);

    // Listen for tab visibility changes and refresh data when tab becomes visible
    useEffect(() => {
        const handleTabVisible = () => {
            console.log("Tab became visible, refreshing event requests...");
            refreshEventRequests();
        };

        // Add event listener for custom dashboardTabVisible event
        document.addEventListener("dashboardTabVisible", handleTabVisible);

        // Clean up event listener on component unmount
        return () => {
            document.removeEventListener("dashboardTabVisible", handleTabVisible);
        };
    }, []);

    // Format date for display
    const formatDate = (dateString: string) => {
        if (!dateString) return 'Not specified';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateString;
        }
    };

    // Get status badge class based on status
    const getStatusBadge = (status?: string) => {
        if (!status) return 'badge-warning';

        switch (status.toLowerCase()) {
            case 'approved':
            case 'completed':
                return 'badge-success text-white';
            case 'rejected':
            case 'declined':
                return 'badge-error text-white';
            case 'pending':
                return 'badge-warning text-black';
            case 'submitted':
                return 'badge-info text-white';
            default:
                return 'badge-warning text-black';
        }
    };

    // Get card border class based on status
    const getCardBorderClass = (status?: string) => {
        if (!status) return 'border-l-warning';

        switch (status.toLowerCase()) {
            case 'approved':
            case 'completed':
                return 'border-l-success';
            case 'rejected':
            case 'declined':
                return 'border-l-error';
            case 'pending':
                return 'border-l-warning';
            case 'submitted':
                return 'border-l-info';
            default:
                return 'border-l-warning';
        }
    };

    // Open modal with event request details
    const openDetailModal = (request: EventRequest) => {
        setSelectedRequest(request);
        setIsModalOpen(true);
    };

    // Close modal
    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedRequest(null);
    };

    if (eventRequests.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-base-200 rounded-xl p-8 text-center shadow-sm"
            >
                <div className="flex flex-col items-center justify-center py-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-base-content/30 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3 className="text-xl font-semibold mb-3">No Event Requests Found</h3>
                    <p className="text-base-content/60 mb-6 max-w-md">You haven't submitted any event requests yet. Use the form above to submit a new event request.</p>
                    <button
                        className="btn btn-outline btn-sm gap-2"
                        onClick={refreshEventRequests}
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? (
                            <>
                                <span className="loading loading-spinner loading-xs"></span>
                                Refreshing...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h3 className="text-lg font-semibold">Your Submissions</h3>
                <div className="flex items-center gap-3">
                    <div className="join">
                        <button
                            className={`join-item btn btn-sm ${viewMode === 'table' ? 'btn-active' : ''}`}
                            onClick={() => setViewMode('table')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                        </button>
                        <button
                            className={`join-item btn btn-sm ${viewMode === 'cards' ? 'btn-active' : ''}`}
                            onClick={() => setViewMode('cards')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </button>
                    </div>
                    <button
                        className="btn btn-outline btn-sm gap-2"
                        onClick={refreshEventRequests}
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? (
                            <>
                                <span className="loading loading-spinner loading-xs"></span>
                                Refreshing...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Refresh
                            </>
                        )}
                    </button>
                </div>
            </div>

            {viewMode === 'table' ? (
                <div className="overflow-x-auto rounded-xl shadow-sm">
                    <table className="table table-zebra w-full">
                        <thead className="bg-base-300/50">
                            <tr>
                                <th>Event Name</th>
                                <th>Date</th>
                                <th>Location</th>
                                <th>PR Materials</th>
                                <th>AS Funding</th>
                                <th>Submitted</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {eventRequests.map((request) => (
                                <tr key={request.id} className={`hover border-l-4 ${getCardBorderClass(request.status)}`}>
                                    <td className="font-medium">{request.name}</td>
                                    <td>{formatDate(request.start_date_time)}</td>
                                    <td>{request.location}</td>
                                    <td>
                                        {request.flyers_needed ? (
                                            <span className="badge badge-success badge-sm">Yes</span>
                                        ) : (
                                            <span className="badge badge-ghost badge-sm">No</span>
                                        )}
                                    </td>
                                    <td>
                                        {request.as_funding_required ? (
                                            <span className="badge badge-success badge-sm">Yes</span>
                                        ) : (
                                            <span className="badge badge-ghost badge-sm">No</span>
                                        )}
                                    </td>
                                    <td>{formatDate(request.created)}</td>
                                    <td>
                                        <span className={`badge ${getStatusBadge(request.status)} badge-sm`}>
                                            {request.status || 'Submitted'}
                                        </span>
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn-ghost btn-sm rounded-full"
                                            onClick={() => openDetailModal(request)}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {eventRequests.map((request) => (
                        <motion.div
                            key={request.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className={`card bg-base-200 shadow-sm hover:shadow-md transition-shadow border-l-4 ${getCardBorderClass(request.status)}`}
                        >
                            <div className="card-body p-5">
                                <div className="flex justify-between items-start">
                                    <h3 className="card-title text-base">{request.name}</h3>
                                    <span className={`badge ${getStatusBadge(request.status)}`}>
                                        {request.status || 'Pending'}
                                    </span>
                                </div>
                                <div className="space-y-2 mt-2 text-sm">
                                    <div className="flex items-start gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/60 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span>{formatDate(request.start_date_time)}</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/60 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span>{request.location}</span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {request.flyers_needed && (
                                        <span className="badge badge-outline badge-sm">PR Materials</span>
                                    )}
                                    {request.as_funding_required && (
                                        <span className="badge badge-outline badge-sm">AS Funding</span>
                                    )}
                                    {request.photography_needed && (
                                        <span className="badge badge-outline badge-sm">Photography</span>
                                    )}
                                </div>
                                <div className="card-actions justify-end mt-4">
                                    <button
                                        className="btn btn-primary btn-sm"
                                        onClick={() => openDetailModal(request)}
                                    >
                                        View Details
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            <div className="bg-base-300/30 p-5 rounded-xl text-sm shadow-sm">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    About Your Submissions
                </h3>
                <ul className="space-y-2 ml-2">
                    <li className="flex items-start gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/60 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Event requests are typically reviewed within 1-2 business days.
                    </li>
                    <li className="flex items-start gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/60 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        You'll receive email notifications when your request status changes.
                    </li>
                    <li className="flex items-start gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-base-content/60 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        For urgent inquiries, please contact the PR team or coordinators in the #-events Slack channel.
                    </li>
                </ul>
            </div>

            {/* Event Request Detail Modal */}
            <AnimatePresence>
                {isModalOpen && selectedRequest && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm"
                        onClick={closeModal}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="bg-base-100 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="sticky top-0 z-10 bg-base-100 px-6 py-4 border-b border-base-300 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold">{selectedRequest.name}</h2>
                                    <span className={`badge ${getStatusBadge(selectedRequest.status)}`}>
                                        {selectedRequest.status || 'Pending'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        className="btn btn-sm btn-primary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            console.log('Full Preview button clicked', selectedRequest);
                                            try {
                                                // Direct call to the global function
                                                if (typeof window.showEventRequestFormPreview === 'function') {
                                                    window.showEventRequestFormPreview(selectedRequest);
                                                } else {
                                                    console.error('showEventRequestFormPreview is not a function', window.showEventRequestFormPreview);
                                                    // Fallback to event dispatch if function is not available
                                                    const event = new CustomEvent("showEventRequestPreviewModal", {
                                                        detail: { formData: selectedRequest }
                                                    });
                                                    document.dispatchEvent(event);
                                                    console.log('Fallback: showEventRequestPreviewModal event dispatched');
                                                }
                                            } catch (error) {
                                                console.error('Error showing full preview:', error);
                                            }
                                        }}
                                    >
                                        Full Preview
                                    </button>
                                    <button
                                        className="btn btn-sm btn-circle btn-ghost"
                                        onClick={closeModal}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            <div className="p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                                    <div>
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-primary">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            Event Details
                                        </h3>
                                        <div className="space-y-4 bg-base-200/50 p-4 rounded-lg">
                                            <div>
                                                <p className="text-sm text-base-content/60">Event Name</p>
                                                <p className="font-medium">{selectedRequest.name}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-base-content/60">Location</p>
                                                <p className="font-medium">{selectedRequest.location}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-base-content/60">Start Date & Time</p>
                                                <p className="font-medium">{formatDate(selectedRequest.start_date_time)}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-base-content/60">End Date & Time</p>
                                                <p className="font-medium">{formatDate(selectedRequest.end_date_time)}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-base-content/60">Room Booking</p>
                                                <p className="font-medium">{selectedRequest.will_or_have_room_booking ? 'Yes' : 'No'}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-base-content/60">Expected Attendance</p>
                                                <p className="font-medium">{selectedRequest.expected_attendance || 'Not specified'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-primary">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Event Description
                                        </h3>
                                        <div className="bg-base-200/50 p-4 rounded-lg h-full">
                                            <p className="whitespace-pre-line">{selectedRequest.event_description}</p>
                                        </div>
                                    </div>
                                </div>

                                {selectedRequest.flyers_needed && (
                                    <div className="mb-8">
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-primary">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            PR Materials
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-base-200/50 p-4 rounded-lg">
                                            <div>
                                                <p className="text-sm text-base-content/60">Flyer Types</p>
                                                <p className="font-medium">
                                                    {selectedRequest.flyer_type?.join(', ') || 'Not specified'}
                                                    {selectedRequest.other_flyer_type && ` (${selectedRequest.other_flyer_type})`}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-base-content/60">Advertising Start Date</p>
                                                <p className="font-medium">
                                                    {selectedRequest.flyer_advertising_start_date
                                                        ? formatDate(selectedRequest.flyer_advertising_start_date)
                                                        : 'Not specified'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-base-content/60">Required Logos</p>
                                                <p className="font-medium">
                                                    {selectedRequest.required_logos?.join(', ') || 'None'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-base-content/60">Advertising Format</p>
                                                <p className="font-medium">{selectedRequest.advertising_format || 'Not specified'}</p>
                                            </div>
                                            <div className="md:col-span-2">
                                                <p className="text-sm text-base-content/60">Additional Requests</p>
                                                <p className="font-medium whitespace-pre-line">
                                                    {selectedRequest.flyer_additional_requests || 'None'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {selectedRequest.as_funding_required && (
                                    <div className="mb-8">
                                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-primary">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            AS Funding Details
                                        </h3>
                                        <div className="space-y-4 bg-base-200/50 p-4 rounded-lg">
                                            <div>
                                                <p className="text-sm text-base-content/60">Food/Drinks Being Served</p>
                                                <p className="font-medium">
                                                    {selectedRequest.food_drinks_being_served ? 'Yes' : 'No'}
                                                </p>
                                            </div>
                                            {selectedRequest.invoice_data && (
                                                <div>
                                                    <p className="text-sm text-base-content/60">Vendor</p>
                                                    <p className="font-medium">
                                                        {selectedRequest.invoice_data.vendor || 'Not specified'}
                                                    </p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-sm text-base-content/60">Itemized Invoice</p>
                                                {(() => {
                                                    try {
                                                        let invoiceData: any = null;

                                                        // Parse the invoice data if it's a string, or use it directly if it's an object
                                                        if (typeof selectedRequest.itemized_invoice === 'string') {
                                                            try {
                                                                invoiceData = JSON.parse(selectedRequest.itemized_invoice);
                                                            } catch (e) {
                                                                console.error('Failed to parse invoice JSON:', e);
                                                                return (
                                                                    <pre className="bg-base-300 p-3 rounded-lg text-xs overflow-x-auto mt-2">
                                                                        {selectedRequest.itemized_invoice || 'Not provided'}
                                                                    </pre>
                                                                );
                                                            }
                                                        } else if (typeof selectedRequest.itemized_invoice === 'object') {
                                                            invoiceData = selectedRequest.itemized_invoice;
                                                        }

                                                        // If we have valid invoice data with items
                                                        if (invoiceData && Array.isArray(invoiceData.items) && invoiceData.items.length > 0) {
                                                            // Calculate total from items if not provided or if NaN
                                                            let calculatedTotal = 0;

                                                            // Try to use the provided total first
                                                            if (invoiceData.total !== undefined) {
                                                                const parsedTotal = typeof invoiceData.total === 'string'
                                                                    ? parseFloat(invoiceData.total)
                                                                    : invoiceData.total;

                                                                if (!isNaN(parsedTotal)) {
                                                                    calculatedTotal = parsedTotal;
                                                                }
                                                            }

                                                            // If total is NaN or not provided, calculate from items
                                                            if (calculatedTotal === 0 || isNaN(calculatedTotal)) {
                                                                calculatedTotal = invoiceData.items.reduce((sum: number, item: any) => {
                                                                    const quantity = typeof item.quantity === 'string'
                                                                        ? parseFloat(item.quantity)
                                                                        : (item.quantity || 1);

                                                                    const unitPrice = typeof item.unit_price === 'string'
                                                                        ? parseFloat(item.unit_price)
                                                                        : (item.unit_price || 0);

                                                                    const itemTotal = !isNaN(quantity) && !isNaN(unitPrice)
                                                                        ? quantity * unitPrice
                                                                        : 0;

                                                                    return sum + itemTotal;
                                                                }, 0);

                                                                // Add tax and tip if available
                                                                if (invoiceData.tax && !isNaN(parseFloat(invoiceData.tax))) {
                                                                    calculatedTotal += parseFloat(invoiceData.tax);
                                                                }

                                                                if (invoiceData.tip && !isNaN(parseFloat(invoiceData.tip))) {
                                                                    calculatedTotal += parseFloat(invoiceData.tip);
                                                                }
                                                            }

                                                            return (
                                                                <div className="bg-base-300 p-3 rounded-lg overflow-x-auto mt-2">
                                                                    <table className="table w-full">
                                                                        <thead>
                                                                            <tr>
                                                                                <th>Item</th>
                                                                                <th className="text-right">Qty</th>
                                                                                <th className="text-right">Price</th>
                                                                                <th className="text-right">Total</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {invoiceData.items.map((item: any, index: number) => {
                                                                                const quantity = typeof item.quantity === 'string'
                                                                                    ? parseFloat(item.quantity)
                                                                                    : (item.quantity || 1);

                                                                                const unitPrice = typeof item.unit_price === 'string'
                                                                                    ? parseFloat(item.unit_price)
                                                                                    : (item.unit_price || 0);

                                                                                const itemTotal = !isNaN(quantity) && !isNaN(unitPrice)
                                                                                    ? quantity * unitPrice
                                                                                    : 0;

                                                                                return (
                                                                                    <tr key={index}>
                                                                                        <td>{item.item || 'Unnamed item'}</td>
                                                                                        <td className="text-right">{!isNaN(quantity) ? quantity : 1}</td>
                                                                                        <td className="text-right">${!isNaN(unitPrice) ? unitPrice.toFixed(2) : '0.00'}</td>
                                                                                        <td className="text-right">${!isNaN(itemTotal) ? itemTotal.toFixed(2) : '0.00'}</td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                        <tfoot>
                                                                            {invoiceData.tax !== undefined && (
                                                                                <tr>
                                                                                    <td colSpan={3} className="text-right font-medium">Tax:</td>
                                                                                    <td className="text-right">
                                                                                        ${typeof invoiceData.tax === 'string'
                                                                                            ? (parseFloat(invoiceData.tax) || 0).toFixed(2)
                                                                                            : (invoiceData.tax || 0).toFixed(2)}
                                                                                    </td>
                                                                                </tr>
                                                                            )}
                                                                            {invoiceData.tip !== undefined && (
                                                                                <tr>
                                                                                    <td colSpan={3} className="text-right font-medium">Tip:</td>
                                                                                    <td className="text-right">
                                                                                        ${typeof invoiceData.tip === 'string'
                                                                                            ? (parseFloat(invoiceData.tip) || 0).toFixed(2)
                                                                                            : (invoiceData.tip || 0).toFixed(2)}
                                                                                    </td>
                                                                                </tr>
                                                                            )}
                                                                            <tr>
                                                                                <td colSpan={3} className="text-right font-bold">Total:</td>
                                                                                <td className="text-right font-bold">
                                                                                    ${!isNaN(calculatedTotal) ? calculatedTotal.toFixed(2) : '0.00'}
                                                                                </td>
                                                                            </tr>
                                                                        </tfoot>
                                                                    </table>
                                                                    {invoiceData.vendor && (
                                                                        <div className="mt-3 text-sm">
                                                                            <span className="font-medium">Vendor:</span> {invoiceData.vendor}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        } else if (invoiceData && typeof invoiceData.total !== 'undefined') {
                                                            // If we have a total but no items, show a simplified view
                                                            const total = typeof invoiceData.total === 'string'
                                                                ? parseFloat(invoiceData.total)
                                                                : invoiceData.total;

                                                            return (
                                                                <div className="bg-base-300 p-3 rounded-lg mt-2">
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="font-medium">Total Amount:</span>
                                                                        <span className="font-bold">${!isNaN(total) ? total.toFixed(2) : '0.00'}</span>
                                                                    </div>
                                                                    {invoiceData.vendor && (
                                                                        <div className="mt-2">
                                                                            <span className="font-medium">Vendor:</span> {invoiceData.vendor}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        } else {
                                                            // Fallback to display the JSON in a readable format
                                                            return (
                                                                <pre className="bg-base-300 p-3 rounded-lg text-xs overflow-x-auto mt-2">
                                                                    {typeof selectedRequest.itemized_invoice === 'object'
                                                                        ? JSON.stringify(selectedRequest.itemized_invoice, null, 2)
                                                                        : (selectedRequest.itemized_invoice || 'Not provided')}
                                                                </pre>
                                                            );
                                                        }
                                                    } catch (error) {
                                                        console.error('Error rendering invoice:', error);
                                                        return (
                                                            <pre className="bg-base-300 p-3 rounded-lg text-xs overflow-x-auto mt-2">
                                                                Error displaying invoice. Please check the console for details.
                                                            </pre>
                                                        );
                                                    }
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-8 pt-4 border-t border-base-300">
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                        <div>
                                            <p className="text-sm text-base-content/60">Submission Date</p>
                                            <p className="font-medium">{formatDate(selectedRequest.created)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm text-base-content/60">Status:</p>
                                            <span className={`badge ${getStatusBadge(selectedRequest.status)} badge-lg`}>
                                                {selectedRequest.status || 'Pending'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default UserEventRequests; 