import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { DataSyncService } from '../../../scripts/database/DataSyncService';
import { Collections } from '../../../schemas/pocketbase/schema';
import type { EventRequest as SchemaEventRequest } from '../../../schemas/pocketbase';
import { EventRequestFormPreview } from './EventRequestFormPreview';
import type { EventRequestFormData } from './EventRequestForm';

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

// Helper function to convert EventRequest to EventRequestFormData
const convertToFormData = (request: EventRequest): EventRequestFormData => {
    try {
        // Parse itemized_invoice if it's a string
        let invoiceData = {};
        try {
            if (request.itemized_invoice) {
                if (typeof request.itemized_invoice === 'string') {
                    invoiceData = JSON.parse(request.itemized_invoice);
                } else {
                    invoiceData = request.itemized_invoice;
                }
            } else if (request.invoice_data) {
                invoiceData = request.invoice_data;
            }
        } catch (e) {
            console.error('Error parsing invoice data:', e);
        }

        // Cast to unknown first, then to EventRequestFormData to avoid type checking
        return {
            name: request.name,
            location: request.location,
            start_date_time: request.start_date_time,
            end_date_time: request.end_date_time,
            event_description: request.event_description || '',
            flyers_needed: request.flyers_needed || false,
            photography_needed: request.photography_needed || false,
            flyer_type: request.flyer_type || [],
            other_flyer_type: request.other_flyer_type || '',
            flyer_advertising_start_date: request.flyer_advertising_start_date || '',
            advertising_format: request.advertising_format || '',
            required_logos: request.required_logos || [],
            other_logos: [] as File[], // EventRequest doesn't have this as files
            flyer_additional_requests: request.flyer_additional_requests || '',
            will_or_have_room_booking: request.will_or_have_room_booking || false,
            room_booking: null,
            room_booking_confirmation: [] as File[], // EventRequest doesn't have this as files
            expected_attendance: request.expected_attendance || 0,
            food_drinks_being_served: request.food_drinks_being_served || false,
            needs_as_funding: request.as_funding_required || false,
            as_funding_required: request.as_funding_required || false,
            invoice: null,
            invoice_files: [],
            invoiceData: invoiceData,
            needs_graphics: request.flyers_needed || false,
            status: request.status || '',
            created_by: request.requested_user || '',
            id: request.id || '',
            created: request.created || '',
            updated: request.updated || '',
            itemized_invoice: request.itemized_invoice || '',
        } as unknown as EventRequestFormData;
    } catch (error) {
        console.error("Error converting EventRequest to EventRequestFormData:", error);

        // Return a minimal valid object to prevent rendering errors
        return {
            name: request?.name || "Unknown Event",
            location: request?.location || "",
            start_date_time: request?.start_date_time || new Date().toISOString(),
            end_date_time: request?.end_date_time || new Date().toISOString(),
            event_description: request?.event_description || "",
            flyers_needed: false,
            photography_needed: false,
            flyer_type: [],
            other_flyer_type: "",
            flyer_advertising_start_date: "",
            advertising_format: "",
            required_logos: [],
            other_logos: [] as File[],
            flyer_additional_requests: "",
            will_or_have_room_booking: false,
            room_booking: null,
            room_booking_confirmation: [] as File[],
            expected_attendance: 0,
            food_drinks_being_served: false,
            needs_as_funding: false,
            as_funding_required: false,
            invoice: null,
            invoice_files: [],
            invoiceData: {},
            needs_graphics: false,
            status: request?.status || "",
            created_by: "",
            id: request?.id || "",
            created: request?.created || "",
            updated: request?.updated || "",
            itemized_invoice: ""
        } as unknown as EventRequestFormData;
    }
};

interface UserEventRequestsProps {
    eventRequests: EventRequest[];
}

// Create a portal component for the modal to ensure it's rendered at the root level
const EventRequestModal: React.FC<{ isOpen: boolean, onClose: () => void, children: React.ReactNode }> = ({
    isOpen,
    onClose,
    children
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999]"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                margin: 0,
                overflow: 'auto'
            }}
            onClick={onClose}
        >
            <div
                className="bg-base-100 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                style={{
                    position: 'relative',
                    margin: 'auto',
                    zIndex: 100000
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
};

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
            // console.log("Tab became visible, refreshing event requests...");
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
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
                                        <div className="flex gap-2">
                                            <button
                                                className="btn btn-sm btn-outline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openDetailModal(request);
                                                }}
                                            >
                                                View Details
                                            </button>
                                        </div>
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
                                    <div className="flex gap-2">
                                        <button
                                            className="btn btn-sm btn-outline"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openDetailModal(request);
                                            }}
                                        >
                                            View Details
                                        </button>
                                    </div>
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

            {/* Use the new portal component for the modal */}
            {isModalOpen && selectedRequest && (
                <EventRequestModal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                >
                    <div className="sticky top-0 z-10 bg-base-100 px-6 py-4 border-b border-base-300 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-base-content">{selectedRequest.name}</h2>
                            <span className={`badge ${getStatusBadge(selectedRequest.status)}`}>
                                {selectedRequest.status || 'Pending'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                className="btn btn-sm btn-circle"
                                onClick={closeModal}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="p-6">
                        {selectedRequest ? (
                            <EventRequestFormPreview
                                formData={convertToFormData(selectedRequest)}
                                isModal={true}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-64">
                                <div className="loading loading-spinner loading-lg text-primary"></div>
                            </div>
                        )}
                    </div>
                </EventRequestModal>
            )}
        </motion.div>
    );
};

export default UserEventRequests; 