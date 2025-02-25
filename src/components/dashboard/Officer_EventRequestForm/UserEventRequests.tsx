import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Get } from '../../../scripts/pocketbase/Get';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import toast from 'react-hot-toast';

// Define the event request interface
interface EventRequest {
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
    status?: string; // Status might not be in the schema yet
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

    // Auto refresh on component mount
    useEffect(() => {
        refreshEventRequests();
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
                return 'badge-success';
            case 'rejected':
                return 'badge-error';
            case 'pending':
                return 'badge-warning';
            case 'in progress':
                return 'badge-info';
            default:
                return 'badge-warning';
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
                                        {request.status || 'Pending'}
                                    </span>
                                </td>
                                <td>
                                    <button
                                        className="btn btn-ghost btn-xs"
                                        onClick={() => openDetailModal(request)}
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

            {/* Event Request Detail Modal */}
            {isModalOpen && selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-base-200 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
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
                                                    {selectedRequest.invoice_data.vendor || 'Not specified'}
                                                </p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-sm text-gray-400">Itemized Invoice</p>
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

                            <div className="mt-8 pt-4 border-t border-base-content/20">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-sm text-gray-400">Submission Date</p>
                                        <p className="font-medium">{formatDate(selectedRequest.created)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-400">Status</p>
                                        <span className={`badge ${getStatusBadge(selectedRequest.status)}`}>
                                            {selectedRequest.status || 'Pending'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
};

export default UserEventRequests; 