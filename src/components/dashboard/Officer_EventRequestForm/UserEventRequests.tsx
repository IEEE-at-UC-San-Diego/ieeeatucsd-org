import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Get } from '../../../scripts/pocketbase/Get';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';

// Define the event request interface
export interface EventRequest {
    id: string;
    name: string;
    location: string;
    start_date_time: string;
    end_date_time: string;
    event_description: string;
    flyers_needed: boolean;
    photography_needed: boolean;
    as_funding_required: boolean;
    food_drinks_being_served: boolean;
    created: string;
    updated: string;
    status: string; // Status field from PocketBase: submitted, pending, completed, declined
    flyer_type?: string[];
    other_flyer_type?: string;
    flyer_advertising_start_date?: string;
    flyer_additional_requests?: string;
    required_logos?: string[];
    advertising_format?: string;
    will_or_have_room_booking?: boolean;
    expected_attendance?: number;
    itemized_invoice?: string;
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
    const [isMounted, setIsMounted] = useState<boolean>(false);

    // Set mounted state when component mounts
    useEffect(() => {
        setIsMounted(true);
        return () => {
            setIsMounted(false);
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
    const getStatusBadge = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed':
                return 'badge-success';
            case 'declined':
                return 'badge-error';
            case 'pending':
                return 'badge-warning';
            case 'submitted':
                return 'badge-info';
            default:
                return 'badge-warning'; // Default to warning for unknown status
        }
    };

    // Format status for display
    const formatStatus = (status: string) => {
        if (!status) return 'Pending';

        // Capitalize first letter
        return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    };

    // Open modal with event request details
    const openDetailModal = (request: EventRequest) => {
        console.log('Opening modal for request:', request.id, request.name);
        setSelectedRequest(request);
        setIsModalOpen(true);
    };

    // Close modal
    const closeModal = () => {
        console.log('Closing modal');
        setIsModalOpen(false);
        setSelectedRequest(null);
    };

    // Refresh event requests
    const refreshEventRequests = async () => {
        setIsRefreshing(true);
        const refreshToast = toast.loading('Refreshing submissions...');

        try {
            const get = Get.getInstance();
            const auth = Authentication.getInstance();

            if (!auth.isAuthenticated()) {
                toast.error('You must be logged in to refresh submissions', { id: refreshToast });
                return;
            }

            const userId = auth.getUserId();
            if (!userId) {
                toast.error('User ID not found', { id: refreshToast });
                return;
            }

            const updatedRequests = await get.getAll<EventRequest>(
                'event_request',
                `requested_user="${userId}"`,
                '-created'
            );

            setEventRequests(updatedRequests);
            toast.success('Submissions refreshed successfully', { id: refreshToast });
        } catch (err) {
            console.error('Failed to refresh event requests:', err);
            toast.error('Failed to refresh submissions. Please try again.', { id: refreshToast });
        } finally {
            setIsRefreshing(false);
        }
    };

    // Auto-refresh when component mounts and when refreshSubmissions event is triggered
    useEffect(() => {
        // Refresh on mount
        refreshEventRequests();

        // Listen for refreshSubmissions event
        const handleRefreshEvent = () => {
            refreshEventRequests();
        };

        document.addEventListener('refreshSubmissions', handleRefreshEvent);

        // Clean up event listener
        return () => {
            document.removeEventListener('refreshSubmissions', handleRefreshEvent);
        };
    }, []);

    // Function to render the modal using a portal
    const renderModal = () => {
        if (!isModalOpen || !selectedRequest || !isMounted) {
            console.log('Modal not rendered - conditions not met:', { isModalOpen, hasSelectedRequest: !!selectedRequest, isMounted });
            return null;
        }

        console.log('Rendering modal for:', selectedRequest.name);

        // Check if document.body is available (important for SSR environments)
        if (typeof document === 'undefined' || !document.body) {
            console.error('document.body is not available');

            // Fallback to direct rendering if portal can't be used
            return (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-base-200 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">{selectedRequest.name}</h2>
                            <button
                                className="btn btn-sm btn-circle btn-ghost"
                                onClick={closeModal}
                            >
                                ✕
                            </button>
                        </div>
                        <p>Event details are available. Please close and try again if content is not displaying properly.</p>
                    </div>
                </div>
            );
        }

        // Use try-catch to handle any potential errors during portal creation
        try {
            return createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50" onClick={(e) => {
                    // Close modal when clicking outside the modal content
                    if (e.target === e.currentTarget) {
                        closeModal();
                    }
                }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-base-200 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()} // Prevent clicks inside the modal from closing it
                    >
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold">{selectedRequest.name}</h2>
                                <button
                                    className="btn btn-sm btn-circle btn-ghost"
                                    onClick={closeModal}
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 border-b border-base-content/20 pb-2">
                                        Event Details
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-sm text-gray-400">Event Name</p>
                                            <p className="font-medium">{selectedRequest.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">Location</p>
                                            <p className="font-medium">{selectedRequest.location}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">Start Date & Time</p>
                                            <p className="font-medium">{formatDate(selectedRequest.start_date_time)}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">End Date & Time</p>
                                            <p className="font-medium">{formatDate(selectedRequest.end_date_time)}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">Room Booking</p>
                                            <p className="font-medium">{selectedRequest.will_or_have_room_booking ? 'Yes' : 'No'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">Expected Attendance</p>
                                            <p className="font-medium">{selectedRequest.expected_attendance || 'Not specified'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-semibold mb-4 border-b border-base-content/20 pb-2">
                                        Event Description
                                    </h3>
                                    <p className="whitespace-pre-line">{selectedRequest.event_description}</p>
                                </div>
                            </div>

                            {selectedRequest.flyers_needed && (
                                <div className="mb-6">
                                    <h3 className="text-lg font-semibold mb-4 border-b border-base-content/20 pb-2">
                                        PR Materials
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-400">Flyer Types</p>
                                            <p className="font-medium">
                                                {selectedRequest.flyer_type?.join(', ') || 'Not specified'}
                                                {selectedRequest.other_flyer_type && ` (${selectedRequest.other_flyer_type})`}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">Advertising Start Date</p>
                                            <p className="font-medium">
                                                {selectedRequest.flyer_advertising_start_date
                                                    ? formatDate(selectedRequest.flyer_advertising_start_date)
                                                    : 'Not specified'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">Required Logos</p>
                                            <p className="font-medium">
                                                {selectedRequest.required_logos?.join(', ') || 'None'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">Advertising Format</p>
                                            <p className="font-medium">{selectedRequest.advertising_format || 'Not specified'}</p>
                                        </div>
                                        <div className="md:col-span-2">
                                            <p className="text-sm text-gray-400">Additional Requests</p>
                                            <p className="font-medium whitespace-pre-line">
                                                {selectedRequest.flyer_additional_requests || 'None'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedRequest.as_funding_required && (
                                <div className="mb-6">
                                    <h3 className="text-lg font-semibold mb-4 border-b border-base-content/20 pb-2">
                                        AS Funding Details
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm text-gray-400">Food/Drinks Being Served</p>
                                            <p className="font-medium">
                                                {selectedRequest.food_drinks_being_served ? 'Yes' : 'No'}
                                            </p>
                                        </div>
                                        {selectedRequest.invoice_data && (
                                            <div>
                                                <p className="text-sm text-gray-400">Vendor</p>
                                                <p className="font-medium">
                                                    {(() => {
                                                        try {
                                                            if (typeof selectedRequest.invoice_data === 'string') {
                                                                return JSON.parse(selectedRequest.invoice_data).vendor || 'Not specified';
                                                            } else if (typeof selectedRequest.invoice_data === 'object') {
                                                                return selectedRequest.invoice_data.vendor || 'Not specified';
                                                            }
                                                            return 'Not specified';
                                                        } catch (error) {
                                                            console.error('Error parsing invoice data:', error);
                                                            return 'Not specified (Error parsing data)';
                                                        }
                                                    })()}
                                                </p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-sm text-gray-400">Itemized Invoice</p>
                                            <pre className="bg-base-300 p-3 rounded-lg text-xs overflow-x-auto mt-2">
                                                {(() => {
                                                    try {
                                                        if (typeof selectedRequest.itemized_invoice === 'object') {
                                                            return JSON.stringify(selectedRequest.itemized_invoice, null, 2);
                                                        } else if (typeof selectedRequest.itemized_invoice === 'string') {
                                                            // Try to parse it as JSON to pretty-print it
                                                            try {
                                                                const parsed = JSON.parse(selectedRequest.itemized_invoice);
                                                                return JSON.stringify(parsed, null, 2);
                                                            } catch {
                                                                // If it's not valid JSON, just return the string
                                                                return selectedRequest.itemized_invoice;
                                                            }
                                                        }
                                                        return 'Not provided';
                                                    } catch (error) {
                                                        console.error('Error displaying itemized invoice:', error);
                                                        return 'Error displaying invoice data';
                                                    }
                                                })()}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 pt-4 border-t border-base-content/20">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-sm text-gray-400">Submission Date</p>
                                        <p className="font-medium">{formatDate(selectedRequest.created)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-400">Status</p>
                                        <span className={`badge ${getStatusBadge(selectedRequest.status)}`}>
                                            {formatStatus(selectedRequest.status)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>,
                document.body
            );
        } catch (error) {
            console.error('Error rendering modal:', error);
            return (
                <div className="alert alert-error">
                    <p>Error rendering modal. Please try again.</p>
                </div>
            );
        }
    };

    if (eventRequests.length === 0) {
        return (
            <div className="bg-base-200 rounded-lg p-8 text-center">
                <h3 className="text-xl font-semibold mb-4">No Event Requests Found</h3>
                <p className="text-gray-400 mb-6">You haven't submitted any event requests yet.</p>
                <p className="text-sm">Use the form above to submit a new event request.</p>
                <button
                    className="btn btn-outline btn-sm mt-4"
                    onClick={refreshEventRequests}
                    disabled={isRefreshing}
                >
                    {isRefreshing ? (
                        <>
                            <span className="loading loading-spinner loading-xs mr-2"></span>
                            Refreshing...
                        </>
                    ) : (
                        <>Refresh</>
                    )}
                </button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
        >
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Your Submissions</h3>
                <button
                    className="btn btn-outline btn-sm"
                    onClick={refreshEventRequests}
                    disabled={isRefreshing}
                >
                    {isRefreshing ? (
                        <>
                            <span className="loading loading-spinner loading-xs mr-2"></span>
                            Refreshing...
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh
                        </>
                    )}
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                    <thead>
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
                            <tr key={request.id} className="hover">
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
                                        {formatStatus(request.status)}
                                    </span>
                                </td>
                                <td>
                                    <button
                                        className="btn btn-ghost btn-xs"
                                        onClick={() => openDetailModal(request)}
                                        aria-label={`View details for ${request.name}`}
                                        type="button"
                                    >
                                        View
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="bg-base-300/50 p-4 rounded-lg text-sm">
                <h3 className="font-semibold mb-2">About Your Submissions</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Event requests are typically reviewed within 1-2 business days.</li>
                    <li>You'll receive email notifications when your request status changes.</li>
                    <li>For urgent inquiries, please contact the PR team or coordinators in the #-events Slack channel.</li>
                </ul>
            </div>

            {/* Render the modal using the portal */}
            {renderModal()}

            {/* Fallback modal implementation (rendered directly in the DOM) */}
            {isModalOpen && selectedRequest && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <div className="bg-base-200 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold">{selectedRequest.name}</h2>
                                <button
                                    className="btn btn-sm btn-circle btn-ghost"
                                    onClick={closeModal}
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="space-y-2">
                                <p><span className="font-medium">Event:</span> {selectedRequest.name}</p>
                                <p><span className="font-medium">Location:</span> {selectedRequest.location}</p>
                                <p><span className="font-medium">Date:</span> {formatDate(selectedRequest.start_date_time)}</p>
                                <p><span className="font-medium">Status:</span> <span className={`badge ${getStatusBadge(selectedRequest.status)}`}>{formatStatus(selectedRequest.status)}</span></p>
                                <p className="text-sm text-gray-400 mt-4">This is a simplified view. Please check the console for any errors if the detailed view is not working.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
};

export default UserEventRequests; 