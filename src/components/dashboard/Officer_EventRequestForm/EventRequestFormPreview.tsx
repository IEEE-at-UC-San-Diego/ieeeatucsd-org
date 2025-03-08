import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EventRequestFormData } from './EventRequestForm';
import type { InvoiceItem } from './InvoiceBuilder';
import type { EventRequest } from '../../../schemas/pocketbase';
import { FlyerTypes, LogoOptions, EventRequestStatus } from '../../../schemas/pocketbase';

// Create a standalone component that can be used to show the preview as a modal
export const EventRequestFormPreviewModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState<EventRequestFormData | null>(null);

    // Function to handle showing the modal
    const showModal = (data: any) => {
        console.log('showModal called with data', data);
        setFormData(data);
        setIsOpen(true);
    };

    // Add the global function to the window object directly from the component
    useEffect(() => {
        // Store the original function if it exists
        const originalFunction = window.showEventRequestFormPreview;

        // Define the global function
        window.showEventRequestFormPreview = (data: any) => {
            console.log('Global showEventRequestFormPreview called with data', data);
            showModal(data);
        };

        // Listen for the custom event as a fallback
        const handleShowModal = (event: CustomEvent) => {
            console.log('Received showEventRequestPreviewModal event', event.detail);
            if (event.detail && event.detail.formData) {
                showModal(event.detail.formData);
            } else {
                console.error('Event detail or formData is missing', event.detail);
            }
        };

        // Add event listener
        document.addEventListener('showEventRequestPreviewModal', handleShowModal as EventListener);
        console.log('Event listener for showEventRequestPreviewModal added');

        // Clean up
        return () => {
            // Restore the original function if it existed
            if (originalFunction) {
                window.showEventRequestFormPreview = originalFunction;
            } else {
                // Otherwise delete our function
                delete window.showEventRequestFormPreview;
            }

            document.removeEventListener('showEventRequestPreviewModal', handleShowModal as EventListener);
            console.log('Event listener for showEventRequestPreviewModal removed');
        };
    }, []); // Empty dependency array - only run once on mount

    const handleClose = () => {
        console.log('Modal closed');
        setIsOpen(false);
    };

    // Force the modal to be in the document body to avoid nesting issues
    return (
        <div
            id="event-request-preview-modal-container"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 99999,
                pointerEvents: isOpen ? 'auto' : 'none'
            }}
        >
            <EventRequestFormPreview
                formData={formData || undefined}
                isOpen={isOpen}
                onClose={handleClose}
                isModal={true}
            />
        </div>
    );
};

interface EventRequestFormPreviewProps {
    formData?: EventRequestFormData; // Optional prop to directly pass form data
    isOpen?: boolean; // Control whether the modal is open
    onClose?: () => void; // Callback when modal is closed
    isModal?: boolean; // Whether to render as a modal or inline component
}

const EventRequestFormPreview: React.FC<EventRequestFormPreviewProps> = ({
    formData: propFormData,
    isOpen = true,
    onClose = () => { },
    isModal = false
}) => {
    const [formData, setFormData] = useState<EventRequestFormData | null>(propFormData || null);
    const [loading, setLoading] = useState<boolean>(!propFormData);

    // Load form data from localStorage on initial load and when updated
    useEffect(() => {
        // If formData is provided as a prop, use it directly
        if (propFormData) {
            setFormData(propFormData);
            setLoading(false);
            return;
        }

        const loadFormData = () => {
            setLoading(true);
            const savedData = localStorage.getItem('eventRequestFormData');
            if (savedData) {
                try {
                    const parsedData = JSON.parse(savedData);
                    setFormData(parsedData);
                } catch (e) {
                    console.error('Error parsing saved form data:', e);
                }
            }
            setLoading(false);
        };

        // Load initial data
        loadFormData();

        // Listen for form data updates
        const handleFormDataUpdate = (event: CustomEvent) => {
            if (event.detail && event.detail.formData) {
                setFormData(event.detail.formData);
            }
        };

        window.addEventListener('formDataUpdated', handleFormDataUpdate as EventListener);
        document.addEventListener('updatePreview', loadFormData);

        return () => {
            window.removeEventListener('formDataUpdated', handleFormDataUpdate as EventListener);
            document.removeEventListener('updatePreview', loadFormData);
        };
    }, [propFormData]);

    // Format date and time for display
    const formatDateTime = (dateTimeString: string) => {
        if (!dateTimeString) return 'Not specified';

        try {
            const date = new Date(dateTimeString);
            return date.toLocaleString();
        } catch (e) {
            return dateTimeString;
        }
    };

    // Handle click on the backdrop to close the modal
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Render the content of the preview
    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex justify-center items-center h-64">
                    <div className="loading loading-spinner loading-lg"></div>
                </div>
            );
        }

        if (!formData) {
            return (
                <div className="text-center py-12">
                    <h3 className="text-xl font-bold mb-4">No Form Data Available</h3>
                    <p className="text-gray-400">Please fill out the form to see a preview.</p>
                </div>
            );
        }

        return (
            <div className="space-y-8">
                <div className={`${isModal ? 'bg-base-300' : ''} p-6 rounded-lg`}>
                    {isModal && (
                        <>
                            <h2 className="text-2xl font-bold mb-4">Event Request Preview</h2>
                            <p className="text-sm text-gray-400 mb-6">
                                This is a preview of your event request. Please review all information before submitting.
                            </p>
                        </>
                    )}

                    {/* Event Details Section */}
                    <div className="mb-8">
                        <h3 className="text-xl font-semibold mb-4 border-b border-base-content/20 pb-2">
                            Event Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-400">Event Name</p>
                                <p className="font-medium">{formData.name || 'Not specified'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Location</p>
                                <p className="font-medium">{formData.location || 'Not specified'}</p>
                            </div>
                            <div className="md:col-span-2">
                                <p className="text-sm text-gray-400">Event Description</p>
                                <p className="font-medium whitespace-pre-line">{formData.event_description || 'Not specified'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Start Date & Time</p>
                                <p className="font-medium">{formatDateTime(formData.start_date_time)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">End Date & Time</p>
                                <p className="font-medium">{formatDateTime(formData.end_date_time)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Room Booking</p>
                                <p className="font-medium">{formData.will_or_have_room_booking ? 'Yes' : 'No'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Expected Attendance</p>
                                <p className="font-medium">{formData.expected_attendance || 'Not specified'}</p>
                            </div>
                        </div>
                    </div>

                    {/* PR Materials Section */}
                    {formData.flyers_needed && (
                        <div className="mb-8">
                            <h3 className="text-xl font-semibold mb-4 border-b border-base-content/20 pb-2">
                                PR Materials
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm text-gray-400">Flyer Types</p>
                                    <ul className="list-disc list-inside">
                                        {formData.flyer_type.map((type, index) => (
                                            <li key={index} className="font-medium">
                                                {type === 'digital_with_social' && 'Digital flyer with social media advertising'}
                                                {type === 'digital_no_social' && 'Digital flyer without social media advertising'}
                                                {type === 'physical_with_advertising' && 'Physical flyer with advertising'}
                                                {type === 'physical_no_advertising' && 'Physical flyer without advertising'}
                                                {type === 'newsletter' && 'Newsletter'}
                                                {type === 'other' && 'Other: ' + formData.other_flyer_type}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Advertising Start Date</p>
                                    <p className="font-medium">{formData.flyer_advertising_start_date || 'Not specified'}</p>
                                </div>
                                <div className="md:col-span-2">
                                    <p className="text-sm text-gray-400">Required Logos</p>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {formData.required_logos.map((logo, index) => (
                                            <span key={index} className="badge badge-primary">{logo}</span>
                                        ))}
                                        {formData.required_logos.length === 0 && <p className="font-medium">None specified</p>}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Advertising Format</p>
                                    <p className="font-medium">
                                        {formData.advertising_format === 'pdf' && 'PDF'}
                                        {formData.advertising_format === 'jpeg' && 'JPEG'}
                                        {formData.advertising_format === 'png' && 'PNG'}
                                        {formData.advertising_format === 'does_not_matter' && 'Does not matter'}
                                        {!formData.advertising_format && 'Not specified'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Photography Needed</p>
                                    <p className="font-medium">{formData.photography_needed ? 'Yes' : 'No'}</p>
                                </div>
                                {formData.flyer_additional_requests && (
                                    <div className="md:col-span-2">
                                        <p className="text-sm text-gray-400">Additional Requests</p>
                                        <p className="font-medium whitespace-pre-line">{formData.flyer_additional_requests}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAP Form Section */}
                    <div className="mb-8">
                        <h3 className="text-xl font-semibold mb-4 border-b border-base-content/20 pb-2">
                            TAP Form Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-400">Expected Attendance</p>
                                <p className="font-medium">{formData.expected_attendance || 'Not specified'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Room Booking</p>
                                <p className="font-medium">
                                    {formData.room_booking ? formData.room_booking.name : 'No file uploaded'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">AS Funding Required</p>
                                <p className="font-medium">{formData.as_funding_required ? 'Yes' : 'No'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-400">Food/Drinks Being Served</p>
                                <p className="font-medium">{formData.food_drinks_being_served ? 'Yes' : 'No'}</p>
                            </div>
                        </div>
                    </div>

                    {/* AS Funding Section */}
                    {formData.as_funding_required && (
                        <div className="mb-8">
                            <h3 className="text-xl font-semibold mb-4 border-b border-base-content/20 pb-2">
                                AS Funding Details
                            </h3>

                            <div className="grid grid-cols-1 gap-4 mb-4">
                                <div>
                                    <p className="text-sm text-gray-400">Vendor</p>
                                    <p className="font-medium">{formData.invoiceData.vendor || 'Not specified'}</p>
                                </div>
                            </div>

                            {formData.invoiceData.items.length > 0 ? (
                                <div className="overflow-x-auto mb-4">
                                    <table className="table w-full">
                                        <thead>
                                            <tr>
                                                <th>Description</th>
                                                <th className="text-right">Qty</th>
                                                <th className="text-right">Unit Price</th>
                                                <th className="text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.invoiceData.items.map((item: InvoiceItem) => (
                                                <tr key={item.id}>
                                                    <td>{item.description}</td>
                                                    <td className="text-right">{item.quantity}</td>
                                                    <td className="text-right">${item.unitPrice.toFixed(2)}</td>
                                                    <td className="text-right">${item.amount.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr>
                                                <td colSpan={3} className="text-right font-medium">Subtotal:</td>
                                                <td className="text-right">${formData.invoiceData.subtotal.toFixed(2)}</td>
                                            </tr>
                                            <tr>
                                                <td colSpan={3} className="text-right font-medium">Tax ({formData.invoiceData.taxRate}%):</td>
                                                <td className="text-right">${formData.invoiceData.taxAmount.toFixed(2)}</td>
                                            </tr>
                                            <tr>
                                                <td colSpan={3} className="text-right font-medium">Tip ({formData.invoiceData.tipPercentage}%):</td>
                                                <td className="text-right">${formData.invoiceData.tipAmount.toFixed(2)}</td>
                                            </tr>
                                            <tr>
                                                <td colSpan={3} className="text-right font-bold">Total:</td>
                                                <td className="text-right font-bold">${formData.invoiceData.total.toFixed(2)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <div className="alert alert-info mb-4">
                                    <div>No invoice items have been added yet.</div>
                                </div>
                            )}

                            <div className="mt-4 mb-4">
                                <p className="text-sm text-gray-400 mb-2">JSON Format (For Submission):</p>
                                <pre className="bg-base-300 p-4 rounded-lg overflow-x-auto text-xs">
                                    {JSON.stringify({
                                        items: formData.invoiceData.items.map(item => ({
                                            item: item.description,
                                            quantity: item.quantity,
                                            unit_price: item.unitPrice
                                        })),
                                        tax: formData.invoiceData.taxAmount,
                                        tip: formData.invoiceData.tipAmount,
                                        total: formData.invoiceData.total,
                                        vendor: formData.invoiceData.vendor
                                    }, null, 2)}
                                </pre>
                                <p className="text-xs text-gray-400 mt-2">
                                    This is the structured format that will be submitted to our database.
                                    It ensures that your invoice data is properly organized and can be
                                    processed correctly by our system.
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-gray-400">Invoice Files</p>
                                {formData.invoice_files && formData.invoice_files.length > 0 ? (
                                    <div className="mt-2 space-y-1">
                                        {formData.invoice_files.map((file, index) => (
                                            <p key={index} className="font-medium">{file.name}</p>
                                        ))}
                                    </div>
                                ) : formData.invoice ? (
                                    <p className="font-medium">{formData.invoice.name}</p>
                                ) : (
                                    <p className="font-medium">No files uploaded</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // If not a modal, render the content directly
    if (!isModal) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full"
            >
                {renderContent()}
            </motion.div>
        );
    }

    // If it's a modal, render with the modal wrapper
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md overflow-hidden"
                    onClick={handleBackdropClick}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 99999,
                        width: '100vw',
                        height: '100vh',
                        margin: 0,
                        padding: 0
                    }}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="bg-base-100 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto m-4"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'relative',
                            zIndex: 100000
                        }}
                    >
                        <div className="sticky top-0 z-10 bg-base-100 px-6 py-4 border-b border-base-300 flex justify-between items-center">
                            <h2 className="text-xl font-bold">Event Request Preview</h2>
                            <button
                                className="btn btn-sm btn-circle btn-ghost"
                                onClick={onClose}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6">
                            {renderContent()}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default EventRequestFormPreview; 