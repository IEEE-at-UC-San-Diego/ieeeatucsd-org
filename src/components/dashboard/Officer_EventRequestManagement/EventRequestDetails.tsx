import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { DataSyncService } from '../../../scripts/database/DataSyncService';
import { Collections } from '../../../schemas/pocketbase/schema';
import type { EventRequest as SchemaEventRequest } from '../../../schemas/pocketbase/schema';

// Extended EventRequest interface with additional properties needed for this component
interface ExtendedEventRequest extends SchemaEventRequest {
    requested_user_expand?: {
        name: string;
        email: string;
    };
    invoice_data?: string | any;
    feedback?: string;
}

interface EventRequestDetailsProps {
    request: ExtendedEventRequest;
    onClose: () => void;
    onStatusChange: (id: string, status: "submitted" | "pending" | "completed" | "declined") => Promise<void>;
    onFeedbackChange: (id: string, feedback: string) => Promise<boolean>;
}

// Separate component for AS Funding tab to isolate any issues
const ASFundingTab: React.FC<{ request: ExtendedEventRequest }> = ({ request }) => {
    if (!request.as_funding_required) {
        return (
            <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">AS Funding Required</h4>
                <p>No</p>
            </div>
        );
    }

    // Process invoice data for display
    let invoiceData = request.invoice_data;

    // If invoice_data is not available, try to parse itemized_invoice
    if (!invoiceData && request.itemized_invoice) {
        try {
            if (typeof request.itemized_invoice === 'string') {
                invoiceData = JSON.parse(request.itemized_invoice);
            } else if (typeof request.itemized_invoice === 'object') {
                invoiceData = request.itemized_invoice;
            }
        } catch (e) {
            console.error('Failed to parse itemized_invoice:', e);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">AS Funding Required</h4>
                <p>Yes</p>
            </div>

            {request.food_drinks_being_served && (
                <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-1">Food/Drinks Being Served</h4>
                    <p>Yes</p>
                </div>
            )}

            <div>
                <h4 className="text-sm font-medium text-gray-400 mb-1">Invoice Data</h4>
                <InvoiceTable invoiceData={invoiceData} />
            </div>
        </div>
    );
};

// Separate component for invoice table
const InvoiceTable: React.FC<{ invoiceData: any }> = ({ invoiceData }) => {
    try {
        // Parse invoice data if it's a string
        let parsedInvoice = null;

        if (typeof invoiceData === 'string') {
            try {
                parsedInvoice = JSON.parse(invoiceData);
            } catch (e) {
                console.error('Failed to parse invoice data string:', e);
                return (
                    <div className="alert alert-warning">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <span>Invalid invoice data format.</span>
                    </div>
                );
            }
        } else if (typeof invoiceData === 'object' && invoiceData !== null) {
            parsedInvoice = invoiceData;
        }

        // Check if we have valid invoice data
        if (!parsedInvoice || typeof parsedInvoice !== 'object') {
            return (
                <div className="alert alert-info">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>No structured invoice data available.</span>
                </div>
            );
        }

        // Extract items array
        let items = [];
        if (parsedInvoice.items && Array.isArray(parsedInvoice.items)) {
            items = parsedInvoice.items;
        } else if (Array.isArray(parsedInvoice)) {
            items = parsedInvoice;
        } else if (parsedInvoice.items && typeof parsedInvoice.items === 'object') {
            items = [parsedInvoice.items]; // Wrap single item in array
        } else {
            // Try to find any array in the object
            for (const key in parsedInvoice) {
                if (Array.isArray(parsedInvoice[key])) {
                    items = parsedInvoice[key];
                    break;
                }
            }
        }

        // If we still don't have items, check if the object itself looks like an item
        if (items.length === 0 && parsedInvoice.item || parsedInvoice.description || parsedInvoice.name) {
            items = [parsedInvoice];
        }

        // If we still don't have items, show a message
        if (items.length === 0) {
            return (
                <div className="alert alert-info">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span>No invoice items found in the data.</span>
                </div>
            );
        }

        // Calculate subtotal from items
        const subtotal = items.reduce((sum: number, item: any) => {
            const quantity = parseFloat(item?.quantity || 1);
            const price = parseFloat(item?.unit_price || item?.price || 0);
            return sum + (quantity * price);
        }, 0);

        // Get tax, tip and total
        const tax = parseFloat(parsedInvoice.tax || parsedInvoice.taxAmount || 0);
        const tip = parseFloat(parsedInvoice.tip || parsedInvoice.tipAmount || 0);
        const total = parseFloat(parsedInvoice.total || 0) || (subtotal + tax + tip);

        // Render the invoice table
        return (
            <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Quantity</th>
                            <th>Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item: any, index: number) => {
                            // Ensure we're not trying to render an object directly
                            const itemName = typeof item?.item === 'object'
                                ? JSON.stringify(item.item)
                                : (item?.item || item?.description || item?.name || 'N/A');

                            const quantity = parseFloat(item?.quantity || 1);
                            const unitPrice = parseFloat(item?.unit_price || item?.price || 0);
                            const itemTotal = quantity * unitPrice;

                            return (
                                <tr key={index}>
                                    <td>{itemName}</td>
                                    <td>{quantity}</td>
                                    <td>${unitPrice.toFixed(2)}</td>
                                    <td>${itemTotal.toFixed(2)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={3} className="text-right font-medium">Subtotal:</td>
                            <td>${subtotal.toFixed(2)}</td>
                        </tr>
                        {tax > 0 && (
                            <tr>
                                <td colSpan={3} className="text-right font-medium">Tax:</td>
                                <td>${tax.toFixed(2)}</td>
                            </tr>
                        )}
                        {tip > 0 && (
                            <tr>
                                <td colSpan={3} className="text-right font-medium">Tip:</td>
                                <td>${tip.toFixed(2)}</td>
                            </tr>
                        )}
                        <tr>
                            <td colSpan={3} className="text-right font-bold">Total:</td>
                            <td className="font-bold">${total.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
                {parsedInvoice.vendor && (
                    <div className="mt-3">
                        <span className="font-medium">Vendor:</span> {parsedInvoice.vendor}
                    </div>
                )}
            </div>
        );
    } catch (error) {
        console.error('Error rendering invoice table:', error);
        return (
            <div className="alert alert-error">
                <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span>An unexpected error occurred while processing the invoice.</span>
            </div>
        );
    }
};

const EventRequestDetails = ({
    request,
    onClose,
    onStatusChange,
    onFeedbackChange
}: EventRequestDetailsProps): React.ReactNode => {
    const [feedback, setFeedback] = useState<string>(request.feedback || '');
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'details' | 'pr' | 'funding'>('details');
    const [status, setStatus] = useState<"submitted" | "pending" | "completed" | "declined">(request.status);
    const [isStatusChanging, setIsStatusChanging] = useState(false);

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
    const getStatusBadge = (status?: "submitted" | "pending" | "completed" | "declined") => {
        if (!status) return 'badge-warning';

        switch (status) {
            case 'completed':
                return 'badge-success';
            case 'declined':
                return 'badge-error';
            case 'pending':
                return 'badge-warning';
            case 'submitted':
                return 'badge-info';
            default:
                return 'badge-warning';
        }
    };

    // Handle saving feedback
    const handleSaveFeedback = async () => {
        if (feedback === request.feedback) {
            toast('No changes to save', { icon: 'ℹ️' });
            return;
        }

        setIsSaving(true);
        const success = await onFeedbackChange(request.id, feedback);
        setIsSaving(false);

        if (success) {
            toast.success('Feedback saved successfully');
        }
    };

    // Handle status change
    const handleStatusChange = async (newStatus: "submitted" | "pending" | "completed" | "declined") => {
        setIsStatusChanging(true);
        await onStatusChange(request.id, newStatus);
        setStatus(newStatus);
        setIsStatusChanging(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="bg-base-200 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="bg-base-300 p-4 flex justify-between items-center">
                    <h3 className="text-xl font-bold">{request.name}</h3>
                    <button
                        className="btn btn-sm btn-circle"
                        onClick={onClose}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Status and controls */}
                <div className="bg-base-300/50 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">Status:</span>
                            <span className={`badge ${getStatusBadge(status)}`}>
                                {status || 'Pending'}
                            </span>
                        </div>
                        <div className="text-sm text-gray-400">
                            Requested by: <span className="text-white">{request.requested_user_expand?.name || request.requested_user || 'Unknown'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="dropdown dropdown-end">
                            <label tabIndex={0} className="btn btn-sm">
                                Update Status
                            </label>
                            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52">
                                <li><a onClick={() => handleStatusChange('pending')}>Pending</a></li>
                                <li><a onClick={() => handleStatusChange('completed')}>Completed</a></li>
                                <li><a onClick={() => handleStatusChange('declined')}>Declined</a></li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="tabs tabs-boxed bg-base-300/30 px-4 pt-4">
                    <a
                        className={`tab ${activeTab === 'details' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('details')}
                    >
                        Event Details
                    </a>
                    <a
                        className={`tab ${activeTab === 'pr' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('pr')}
                    >
                        PR Materials
                    </a>
                    <a
                        className={`tab ${activeTab === 'funding' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('funding')}
                    >
                        AS Funding
                    </a>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-grow">
                    {/* Event Details Tab */}
                    {activeTab === 'details' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Event Name</h4>
                                        <p className="text-lg">{request.name}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Location</h4>
                                        <p>{request.location || 'Not specified'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Start Date & Time</h4>
                                        <p>{formatDate(request.start_date_time)}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">End Date & Time</h4>
                                        <p>{formatDate(request.end_date_time)}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Expected Attendance</h4>
                                        <p>{request.expected_attendance || 'Not specified'}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Event Description</h4>
                                        <p className="whitespace-pre-line">{request.event_description || 'No description provided'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Room Booking</h4>
                                        <p>{request.will_or_have_room_booking ? 'Yes' : 'No'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Food/Drinks Served</h4>
                                        <p>{request.food_drinks_being_served ? 'Yes' : 'No'}</p>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Submission Date</h4>
                                        <p>{formatDate(request.created)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PR Materials Tab */}
                    {activeTab === 'pr' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Flyers Needed</h4>
                                        <p>{request.flyers_needed ? 'Yes' : 'No'}</p>
                                    </div>
                                    {request.flyers_needed && (
                                        <>
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-400 mb-1">Flyer Types</h4>
                                                <ul className="list-disc list-inside">
                                                    {request.flyer_type?.map((type, index) => (
                                                        <li key={index}>{type}</li>
                                                    ))}
                                                    {request.other_flyer_type && <li>{request.other_flyer_type}</li>}
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-400 mb-1">Advertising Start Date</h4>
                                                <p>{formatDate(request.flyer_advertising_start_date || '')}</p>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-400 mb-1">Advertising Format</h4>
                                                <p>{request.advertising_format || 'Not specified'}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <h4 className="text-sm font-medium text-gray-400 mb-1">Photography Needed</h4>
                                        <p>{request.photography_needed ? 'Yes' : 'No'}</p>
                                    </div>
                                    {request.flyers_needed && (
                                        <>
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-400 mb-1">Required Logos</h4>
                                                <ul className="list-disc list-inside">
                                                    {request.required_logos?.map((logo, index) => (
                                                        <li key={index}>{logo}</li>
                                                    ))}
                                                    {(!request.required_logos || request.required_logos.length === 0) &&
                                                        <li>No specific logos required</li>
                                                    }
                                                </ul>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-gray-400 mb-1">Additional Requests</h4>
                                                <p className="whitespace-pre-line">{request.flyer_additional_requests || 'None'}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* AS Funding Tab */}
                    {activeTab === 'funding' && (
                        <ASFundingTab request={request} />
                    )}
                </div>

                {/* Feedback section */}
                <div className="p-4 border-t border-base-300">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Feedback for Requester</h4>
                    <div className="flex flex-col gap-3">
                        <textarea
                            className="textarea textarea-bordered w-full"
                            placeholder="Add feedback or notes for the event requester..."
                            rows={3}
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                        ></textarea>
                        <div className="flex justify-end">
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleSaveFeedback}
                                disabled={isSaving || feedback === request.feedback}
                            >
                                {isSaving ? (
                                    <>
                                        <span className="loading loading-spinner loading-xs"></span>
                                        Saving...
                                    </>
                                ) : (
                                    'Save Feedback'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default EventRequestDetails; 