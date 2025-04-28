import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EventRequestFormData } from './EventRequestForm';
import type { InvoiceItem } from './InvoiceBuilder';
import type { EventRequest } from '../../../schemas/pocketbase';
import { FlyerTypes, LogoOptions, EventRequestStatus } from '../../../schemas/pocketbase';
import CustomAlert from '../universal/CustomAlert';
import { Icon } from '@iconify/react';
import axios from 'axios';

// Define modal props interface
interface EventRequestFormPreviewModalProps {
    formData: EventRequestFormData;
    closeModal: () => void;
}

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1,
            duration: 0.3
        }
    },
    exit: {
        opacity: 0,
        transition: { duration: 0.2 }
    }
};

const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 0.8
        }
    }
};

const modalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: {
            duration: 0.3,
            ease: [0.19, 1.0, 0.22, 1.0] // Ease out expo
        }
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        transition: {
            duration: 0.2,
            ease: "easeIn"
        }
    }
};

// Extended version of InvoiceItem to handle multiple property names
interface ExtendedInvoiceItem {
    id?: string;
    description?: string;
    item?: string;
    name?: string;
    quantity: number;
    unitPrice?: number;
    unit_price?: number;
    price?: number;
    amount?: number;
    [key: string]: any; // Allow any additional properties
}

// Helper function to normalize EventRequest to match EventRequestFormData structure
const normalizeFormData = (data: EventRequestFormData | (EventRequest & {
    invoiceData?: any;
    needs_as_funding?: boolean;
})): EventRequestFormData => {
    // If it's already EventRequestFormData, return it
    if ('needs_as_funding' in data && data.needs_as_funding !== undefined && 'invoiceData' in data) {
        return data as EventRequestFormData;
    }

    // Convert EventRequest to EventRequestFormData format
    const eventRequest = data as EventRequest & {
        invoiceData?: any;
        needs_as_funding?: boolean;
    };

    try {
        // Parse invoice data
        let invoiceData: {
            vendor?: string;
            items: any[];
            subtotal: number;
            taxAmount: number;
            tipAmount: number;
            total: number;
        } = {
            items: [],
            subtotal: 0,
            taxAmount: 0,
            tipAmount: 0,
            total: 0
        };

        // Parse existing invoice data if available
        if (eventRequest.itemized_invoice) {
            if (typeof eventRequest.itemized_invoice === 'string') {
                try {
                    const parsed = JSON.parse(eventRequest.itemized_invoice || '{}');
                    if (parsed && typeof parsed === 'object') {
                        invoiceData = {
                            ...invoiceData,
                            ...(parsed as any),
                            items: Array.isArray((parsed as any).items) ? (parsed as any).items : [],
                            // Normalize tax/tip fields
                            taxAmount: Number(parsed.taxAmount ?? parsed.tax ?? 0),
                            tipAmount: Number(parsed.tipAmount ?? parsed.tip ?? 0)
                        };

                        // Normalize item property names
                        invoiceData.items = invoiceData.items.map(item => {
                            // Create a normalized item with all possible property names
                            return {
                                id: item.id || `item-${Math.random().toString(36).substr(2, 9)}`,
                                description: item.description || item.item || item.name || 'Item',
                                quantity: parseFloat(item.quantity) || 1,
                                unitPrice: parseFloat(item.unitPrice || item.unit_price || item.price || 0),
                                unit_price: parseFloat(item.unitPrice || item.unit_price || item.price || 0),
                                price: parseFloat(item.unitPrice || item.unit_price || item.price || 0),
                                amount: parseFloat(item.amount) ||
                                    (parseFloat(item.quantity) || 1) *
                                    parseFloat(item.unitPrice || item.unit_price || item.price || 0)
                            };
                        });
                    }
                } catch (e) {
                    console.error('Error parsing itemized_invoice:', e);
                }
            } else if (typeof eventRequest.itemized_invoice === 'object' && eventRequest.itemized_invoice !== null) {
                const parsed = eventRequest.itemized_invoice as any;
                invoiceData = {
                    ...invoiceData,
                    ...parsed,
                    items: Array.isArray(parsed.items) ? parsed.items : [],
                    // Normalize tax/tip fields
                    taxAmount: Number(parsed.taxAmount ?? parsed.tax ?? 0),
                    tipAmount: Number(parsed.tipAmount ?? parsed.tip ?? 0)
                };

                // Normalize item property names
                invoiceData.items = invoiceData.items.map(item => {
                    return {
                        id: item.id || `item-${Math.random().toString(36).substr(2, 9)}`,
                        description: item.description || item.item || item.name || 'Item',
                        quantity: parseFloat(item.quantity) || 1,
                        unitPrice: parseFloat(item.unitPrice || item.unit_price || item.price || 0),
                        unit_price: parseFloat(item.unitPrice || item.unit_price || item.price || 0),
                        price: parseFloat(item.unitPrice || item.unit_price || item.price || 0),
                        amount: parseFloat(item.amount) ||
                            (parseFloat(item.quantity) || 1) *
                            parseFloat(item.unitPrice || item.unit_price || item.price || 0)
                    };
                });
            }
        } else if (eventRequest.invoiceData) {
            const parsed = eventRequest.invoiceData as any;
            if (parsed && typeof parsed === 'object') {
                invoiceData = {
                    ...invoiceData,
                    ...parsed,
                    items: Array.isArray(parsed.items) ? parsed.items : [],
                    // Normalize tax/tip fields
                    taxAmount: Number(parsed.taxAmount ?? parsed.tax ?? 0),
                    tipAmount: Number(parsed.tipAmount ?? parsed.tip ?? 0)
                };

                // Normalize item property names
                invoiceData.items = invoiceData.items.map(item => {
                    return {
                        id: item.id || `item-${Math.random().toString(36).substr(2, 9)}`,
                        description: item.description || item.item || item.name || 'Item',
                        quantity: parseFloat(item.quantity) || 1,
                        unitPrice: parseFloat(item.unitPrice || item.unit_price || item.price || 0),
                        unit_price: parseFloat(item.unitPrice || item.unit_price || item.price || 0),
                        price: parseFloat(item.unitPrice || item.unit_price || item.price || 0),
                        amount: parseFloat(item.amount) ||
                            (parseFloat(item.quantity) || 1) *
                            parseFloat(item.unitPrice || item.unit_price || item.price || 0)
                    };
                });
            }
        }

        // Calculate subtotal if not set
        if (typeof invoiceData.subtotal !== 'number' || isNaN(invoiceData.subtotal)) {
            invoiceData.subtotal = invoiceData.items.reduce((sum: number, item: any) => {
                const amount = typeof item.amount === 'number' ? item.amount : 0;
                return sum + amount;
            }, 0);
        }

        // Ensure tax and tip amounts are numbers
        if (typeof invoiceData.taxAmount !== 'number' || isNaN(invoiceData.taxAmount)) {
            invoiceData.taxAmount = 0;
        }

        if (typeof invoiceData.tipAmount !== 'number' || isNaN(invoiceData.tipAmount)) {
            invoiceData.tipAmount = 0;
        }

        // Calculate total if not set
        if (typeof invoiceData.total !== 'number' || isNaN(invoiceData.total)) {
            invoiceData.total = invoiceData.subtotal + invoiceData.taxAmount + invoiceData.tipAmount;
        }

        // Create a normalized object that implements the EventRequestFormData interface
        const normalized = {
            name: eventRequest.name,
            location: eventRequest.location,
            start_date_time: eventRequest.start_date_time,
            end_date_time: eventRequest.end_date_time,
            event_description: eventRequest.event_description || '',
            flyers_needed: eventRequest.flyers_needed || false,
            photography_needed: eventRequest.photography_needed || false,
            flyer_type: eventRequest.flyer_type || [],
            other_flyer_type: eventRequest.other_flyer_type || '',
            flyer_advertising_start_date: eventRequest.flyer_advertising_start_date || '',
            advertising_format: eventRequest.advertising_format || '',
            required_logos: eventRequest.required_logos || [],
            other_logos: [] as File[], // EventRequest has this as strings but we need File[]
            flyer_additional_requests: eventRequest.flyer_additional_requests || '',
            will_or_have_room_booking: eventRequest.will_or_have_room_booking || false,
            room_booking: null,
            room_booking_confirmation: [] as File[],
            expected_attendance: eventRequest.expected_attendance || 0,
            food_drinks_being_served: eventRequest.food_drinks_being_served || false,
            needs_as_funding: eventRequest.needs_as_funding ?? eventRequest.as_funding_required ?? false,
            as_funding_required: eventRequest.as_funding_required || false,
            invoice: null,
            invoice_files: [] as File[],
            invoiceData: invoiceData,
            needs_graphics: eventRequest.needs_graphics ?? eventRequest.flyers_needed ?? false,
            status: eventRequest.status || '',
            created_by: eventRequest.requested_user || '',
            id: eventRequest.id || '',
            created: eventRequest.created || '',
            updated: eventRequest.updated || '',
            itemized_invoice: eventRequest.itemized_invoice || ''
        };

        return normalized as unknown as EventRequestFormData;
    } catch (error) {
        console.error("Error normalizing form data:", error);
        // Return a minimal valid object to prevent rendering errors
        return {
            name: eventRequest.name || 'Unknown Event',
            location: eventRequest.location || '',
            start_date_time: eventRequest.start_date_time || new Date().toISOString(),
            end_date_time: eventRequest.end_date_time || new Date().toISOString(),
            event_description: eventRequest.event_description || '',
            flyers_needed: false,
            photography_needed: false,
            as_funding_required: false,
            food_drinks_being_served: false,
            flyer_type: [],
            other_flyer_type: '',
            flyer_advertising_start_date: '',
            flyer_additional_requests: '',
            required_logos: [],
            other_logos: [] as File[],
            advertising_format: '',
            will_or_have_room_booking: false,
            expected_attendance: 0,
            room_booking: null,
            invoice: null,
            invoice_files: [] as File[],
            invoiceData: {
                items: [],
                subtotal: 0,
                taxAmount: 0,
                tipAmount: 0,
                total: 0
            },
            needs_graphics: false
        } as unknown as EventRequestFormData;
    }
};

// Create a standalone component that can be used to show the preview as a modal
export const EventRequestFormPreviewModal = ({ formData, closeModal }: EventRequestFormPreviewModalProps) => {
    console.log("EventRequestFormPreviewModal rendered with formData:", formData);

    // Normalize the form data to ensure it's in the correct format
    const normalizedFormData = normalizeFormData(formData);
    console.log("Normalized formData:", normalizedFormData);

    useEffect(() => {
        console.log("Modal opened with styles applied");
        const body = document.body;
        body.style.overflow = 'hidden'; // Prevent background scrolling

        return () => {
            body.style.overflow = ''; // Restore scrolling when modal closes
        };
    }, []);

    return (
        <div
            id="event-request-preview-modal-overlay"
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-999999 overflow-y-auto p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    closeModal();
                }
            }}
        >
            <div
                className="bg-base-100 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-base-100 z-10 p-4 flex justify-between items-center border-b">
                    <h2 className="text-xl font-bold text-base-content">Event Request Preview</h2>
                    <button
                        onClick={closeModal}
                        className="btn btn-sm btn-circle btn-ghost"
                    >
                        <Icon icon="heroicons:x-mark" width={20} height={20} />
                    </button>
                </div>
                <div className="p-6">
                    <EventRequestFormPreview
                        formData={normalizedFormData}
                        isModal={true}
                        onClose={closeModal}
                    />
                </div>
            </div>
        </div>
    );
};

// Define the interface for the EventRequestFormPreview component
interface EventRequestFormPreviewProps {
    formData?: EventRequestFormData | (EventRequest & {
        invoiceData?: any;
        needs_as_funding?: boolean;
    }); // Accept both form data and event request types
    isOpen?: boolean; // Control whether the modal is open
    onClose?: () => void; // Callback when modal is closed
    isModal: boolean; // Whether to render as a modal or inline component
}

// Define the main EventRequestFormPreview component
const EventRequestFormPreview: React.FC<EventRequestFormPreviewProps> = ({
    formData: propFormData,
    isOpen = true,
    onClose = () => { },
    isModal = false
}) => {
    console.log("EventRequestFormPreview received props:", { propFormData, isOpen, isModal });

    const [formData, setFormData] = useState<EventRequestFormData | null>(
        propFormData ? normalizeFormData(propFormData) : null
    );
    const [loading, setLoading] = useState(propFormData ? false : true);

    // Log whenever formData changes for debugging
    useEffect(() => {
        console.log("EventRequestFormPreview formData state:", formData);
    }, [formData]);

    // Load form data from local storage if not provided via props
    useEffect(() => {
        if (propFormData) {
            setFormData(normalizeFormData(propFormData));
            setLoading(false);
        } else {
            loadFormData();
        }

        // Listen for form data updates
        document.addEventListener('eventRequestFormDataUpdated', handleFormDataUpdate as EventListener);

        return () => {
            document.removeEventListener('eventRequestFormDataUpdated', handleFormDataUpdate as EventListener);
        };
    }, [propFormData]);

    // Load form data from local storage
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

    // Handle form data updates
    const handleFormDataUpdate = (event: CustomEvent) => {
        if (event.detail && event.detail.formData) {
            setFormData(event.detail.formData);
        }
    };

    // Format date and time
    const formatDateTime = (dateTimeString: string) => {
        if (!dateTimeString) return 'Not specified';

        try {
            const date = new Date(dateTimeString);
            const options: Intl.DateTimeFormatOptions = {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            };
            return date.toLocaleDateString('en-US', options);
        } catch (e) {
            return dateTimeString;
        }
    };

    // Handle backdrop click for modal
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isModal && e.target === e.currentTarget) {
            onClose();
        }
    };

    // Map badge colors for status
    const getStatusBadge = (status?: string) => {
        if (!status) return null;

        const statusMap: { [key: string]: string } = {
            'submitted': 'badge-info',
            'pending': 'badge-warning',
            'completed': 'badge-success',
            'declined': 'badge-error'
        };

        return (
            <span className={`badge ${statusMap[status] || 'badge-neutral'} ml-2`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    // Render the content of the preview
    const renderContent = () => {
        console.log("renderContent called, loading:", loading, "formData:", formData);

        if (loading) {
            console.log("Rendering loading state");
            return (
                <motion.div
                    className="flex justify-center items-center h-64"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <div className="loading loading-spinner loading-lg text-primary"></div>
                </motion.div>
            );
        }

        if (!formData) {
            console.log("Rendering no form data state");
            return (
                <motion.div
                    className="text-center py-16 border-2 border-dashed border-base-300 rounded-lg"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                >
                    <Icon icon="heroicons:document-text" className="w-16 h-16 mx-auto text-base-300 mb-4" />
                    <h3 className="text-xl font-bold mb-2">No Form Data Available</h3>
                    <p className="text-base-content/60">Please fill out the form to see a preview.</p>
                </motion.div>
            );
        }

        // Content layout to display the form data
        return (
            <motion.div
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={containerVariants}
                className="space-y-8"
            >
                {/* Only show the review header when in modal view */}
                {isModal && (
                    <motion.div
                        variants={sectionVariants}
                        className="bg-base-200/60 p-6 rounded-xl"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <Icon icon="heroicons:information-circle" className="text-primary w-5 h-5" />
                            <h2 className="text-lg font-semibold">
                                Review Your Event Request
                                {getStatusBadge(formData.status)}
                            </h2>
                        </div>
                        <p className="text-base-content/70">
                            Please review all information to make sure it is correct. Please contact the event coordinator any issues occur
                        </p>
                    </motion.div>
                )}

                {/* Event Details Section */}
                <motion.div
                    variants={sectionVariants}
                    className="bg-base-100 rounded-xl border border-base-300 shadow-xs overflow-hidden"
                >
                    <div className="bg-linear-to-r from-primary/10 to-primary/5 p-4 flex items-center">
                        <Icon icon="heroicons:calendar" className="text-primary w-5 h-5 mr-2" />
                        <h3 className="text-lg font-semibold text-base-content">
                            Event Details
                        </h3>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            <div className="col-span-full mb-4">
                                <h4 className="text-xl font-bold mb-1 text-base-content">
                                    {formData.name || 'Untitled Event'}
                                </h4>
                                <p className="text-base-content/70 whitespace-pre-line">
                                    {formData.event_description || 'No description provided.'}
                                </p>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center text-base-content/60">
                                    <Icon icon="heroicons:map-pin" className="w-4 h-4 mr-1" />
                                    <span className="text-sm">Location</span>
                                </div>
                                <p className="font-medium text-base-content">{formData.location || 'Not specified'}</p>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center text-base-content/60">
                                    <Icon icon="heroicons:users" className="w-4 h-4 mr-1" />
                                    <span className="text-sm">Expected Attendance</span>
                                </div>
                                <p className="font-medium text-base-content">{formData.expected_attendance || 'Not specified'}</p>
                                {formData.expected_attendance > 0 && (
                                    <p className="text-xs text-primary">
                                        Budget limit: ${Math.min(formData.expected_attendance * 10, 5000)} (max $5,000)
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center text-base-content/60">
                                    <Icon icon="heroicons:calendar" className="w-4 h-4 mr-1" />
                                    <span className="text-sm">Date & Time</span>
                                </div>
                                <p className="font-medium text-base-content">{formatDateTime(formData.start_date_time)}</p>
                                <p className="text-xs text-base-content/60">
                                    Note: Multi-day events require separate submissions for each day.
                                </p>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center text-base-content/60">
                                    <Icon icon="heroicons:building-office-2" className="w-4 h-4 mr-1" />
                                    <span className="text-sm">Room Booking</span>
                                </div>
                                <p className="font-medium text-base-content">
                                    {formData.will_or_have_room_booking ? 'Yes' : 'No'}
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* PR Materials Section - Only show if flyers are needed */}
                {formData.flyers_needed && (
                    <motion.div
                        variants={sectionVariants}
                        className="bg-base-100 rounded-xl border border-base-300 shadow-xs overflow-hidden"
                    >
                        <div className="bg-linear-to-r from-primary/10 to-primary/5 p-4 flex items-center">
                            <Icon icon="heroicons:document-duplicate" className="text-primary w-5 h-5 mr-2" />
                            <h3 className="text-lg font-semibold text-base-content">
                                PR Materials
                            </h3>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                <div className="space-y-1">
                                    <div className="flex items-center text-base-content/60">
                                        <Icon icon="heroicons:document" className="w-4 h-4 mr-1" />
                                        <span className="text-sm">Flyer Types</span>
                                    </div>
                                    <p className="font-medium text-base-content">
                                        {formData.flyer_type?.length
                                            ? formData.flyer_type.map(type => {
                                                switch (type) {
                                                    case 'digital_with_social': return 'Digital (with social media)';
                                                    case 'digital_no_social': return 'Digital (no social media)';
                                                    case 'physical_with_advertising': return 'Physical (with advertising)';
                                                    case 'physical_no_advertising': return 'Physical (no advertising)';
                                                    case 'newsletter': return 'Newsletter';
                                                    case 'other': return formData.other_flyer_type || 'Other';
                                                    default: return type;
                                                }
                                            }).join(', ')
                                            : 'None specified'
                                        }
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center text-base-content/60">
                                        <Icon icon="heroicons:calendar" className="w-4 h-4 mr-1" />
                                        <span className="text-sm">Advertising Start Date</span>
                                    </div>
                                    <p className="font-medium text-base-content">
                                        {formData.flyer_advertising_start_date
                                            ? formatDateTime(formData.flyer_advertising_start_date)
                                            : 'Not specified'
                                        }
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center text-base-content/60">
                                        <Icon icon="heroicons:photo" className="w-4 h-4 mr-1" />
                                        <span className="text-sm">Required Logos</span>
                                    </div>
                                    <p className="font-medium text-base-content">
                                        {formData.required_logos?.length
                                            ? formData.required_logos.join(', ')
                                            : 'None required'
                                        }
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <div className="flex items-center text-base-content/60">
                                        <Icon icon="heroicons:presentation-chart-bar" className="w-4 h-4 mr-1" />
                                        <span className="text-sm">Advertising Format</span>
                                    </div>
                                    <p className="font-medium text-base-content">
                                        {formData.advertising_format || 'Not specified'}
                                    </p>
                                </div>

                                {formData.flyer_additional_requests && (
                                    <div className="col-span-full space-y-1">
                                        <div className="flex items-center text-base-content/60">
                                            <Icon icon="heroicons:chat-bubble-left-right" className="w-4 h-4 mr-1" />
                                            <span className="text-sm">Additional Requests</span>
                                        </div>
                                        <p className="font-medium text-base-content whitespace-pre-line">
                                            {formData.flyer_additional_requests}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* TAP Form Section */}
                <motion.div
                    variants={sectionVariants}
                    className="bg-base-100 rounded-xl border border-base-300 shadow-xs overflow-hidden"
                >
                    <div className="bg-linear-to-r from-accent/10 to-accent/5 p-4 flex items-center">
                        <Icon icon="heroicons:building-office-2" className="text-accent w-5 h-5 mr-2" />
                        <h3 className="text-lg font-semibold text-base-content">
                            TAP Information
                        </h3>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-medium mb-1 flex items-center">
                                    <Icon icon="heroicons:building-office" className="w-4 h-4 mr-1" />
                                    Room Booking Status
                                </h4>
                                <div className="flex items-center">
                                    <span className={`badge ${formData.will_or_have_room_booking ? 'badge-success' : 'badge-neutral'}`}>
                                        {formData.will_or_have_room_booking ? 'Room Booking Confirmed' : 'No Booking Needed'}
                                    </span>

                                    {formData.will_or_have_room_booking && formData.room_booking && (
                                        <span className="badge badge-info ml-2">File Uploaded</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h4 className="font-medium mb-1 flex items-center">
                                    <Icon icon="heroicons:cake" className="w-4 h-4 mr-1" />
                                    Food and Drinks
                                </h4>
                                <span className={`badge ${formData.food_drinks_being_served ? 'badge-success' : 'badge-neutral'}`}>
                                    {formData.food_drinks_being_served ? 'Being Served' : 'Not Being Served'}
                                </span>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* AS Funding Section - Only show if needed */}
                {formData.needs_as_funding && (
                    <motion.div
                        variants={sectionVariants}
                        className="bg-base-100 rounded-xl border border-base-300 shadow-xs overflow-hidden"
                    >
                        <div className="bg-linear-to-r from-primary/10 to-primary/5 p-4 flex items-center">
                            <Icon icon="heroicons:currency-dollar" className="text-primary w-5 h-5 mr-2" />
                            <h3 className="text-lg font-semibold text-base-content">
                                AS Funding
                            </h3>
                        </div>

                        <div className="p-6">
                            {formData.invoiceData && formData.invoiceData.items && formData.invoiceData.items.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <h4 className="font-medium mb-2 flex items-center text-base-content">
                                        <Icon icon="heroicons:receipt-percent" className="w-4 h-4 mr-1" />
                                        Invoice from {formData.invoiceData.vendor || 'Unknown Vendor'}
                                    </h4>

                                    <table className="table table-zebra w-full text-sm border-collapse overflow-hidden rounded-lg">
                                        <thead className="bg-base-200/70">
                                            <tr>
                                                <th className="py-3 text-base-content">Item</th>
                                                <th className="py-3 text-right text-base-content">Qty</th>
                                                <th className="py-3 text-right text-base-content">Unit Price</th>
                                                <th className="py-3 text-right text-base-content">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {formData.invoiceData.items.map((item: ExtendedInvoiceItem, index: number) => (
                                                <tr key={item.id || index} className="border-t border-base-300">
                                                    <td className="py-2 font-medium text-base-content">{item.description || item.item || item.name || 'Item'}</td>
                                                    <td className="py-2 text-right text-base-content">{item.quantity || 1}</td>
                                                    <td className="py-2 text-right text-base-content">${(item.unitPrice || item.unit_price || item.price || 0).toFixed(2)}</td>
                                                    <td className="py-2 text-right font-medium text-base-content">${(item.amount || (item.quantity * (item.unitPrice || item.unit_price || item.price || 0)) || 0).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-base-200/40">
                                            <tr className="border-t border-base-300">
                                                <td colSpan={3} className="py-2 text-right font-medium text-base-content">Subtotal:</td>
                                                <td className="py-2 text-right font-medium text-base-content">${(formData.invoiceData.subtotal || 0).toFixed(2)}</td>
                                            </tr>
                                            <tr className="border-t border-base-300">
                                                <td colSpan={3} className="py-2 text-right font-medium text-base-content">Tax:</td>
                                                <td className="py-2 text-right font-medium text-base-content">${(formData.invoiceData.taxAmount || 0).toFixed(2)}</td>
                                            </tr>
                                            <tr className="border-t border-base-300">
                                                <td colSpan={3} className="py-2 text-right font-medium text-base-content">Tip:</td>
                                                <td className="py-2 text-right font-medium text-base-content">${(formData.invoiceData.tipAmount || 0).toFixed(2)}</td>
                                            </tr>
                                            <tr className="bg-primary/5">
                                                <td colSpan={3} className="py-2 text-right font-bold text-primary">Total:</td>
                                                <td className="py-2 text-right font-bold text-primary">${(formData.invoiceData.total || 0).toFixed(2)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-base-content">No itemized invoice available.</p>
                            )}
                        </div>
                    </motion.div>
                )}


            </motion.div>
        );
    };

    // Render the whole component
    return (
        <div
            className={`event-request-preview ${isModal ? 'modal-preview' : 'inline-preview'}`}
            onClick={isModal ? handleBackdropClick : undefined}
        >
            {renderContent()}
        </div>
    );
};

// Ensure the modal always appears properly by adding global styles
const modalStyles = `
    /* Global styles for event request preview modal */
    #event-request-preview-modal-overlay,
    .fixed[id="event-request-preview-modal-overlay"] {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        z-index: 999999 !important;
        margin: 0 !important;
        padding: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        overflow: auto !important;
        background-color: rgba(0, 0, 0, 0.6) !important;
        backdrop-filter: blur(4px) !important;
    }
`;

// Add the styles to the document head
if (typeof document !== 'undefined') {
    const styleElement = document.createElement('style');
    styleElement.textContent = modalStyles;
    document.head.appendChild(styleElement);
}

// Create a wrapper component that listens for the custom event
export const EventRequestFormPreviewModalWrapper: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState<EventRequestFormData | null>(null);

    useEffect(() => {
        // Define the event handler
        const handleShowModal = (event: CustomEvent) => {
            console.log("showEventRequestPreviewModal event received:", event.detail);
            if (event.detail && event.detail.formData) {
                console.log("Setting formData from event:", event.detail.formData);
                setFormData(event.detail.formData);
                setIsOpen(true);
            }
        };

        // Add event listener
        document.addEventListener('showEventRequestPreviewModal', handleShowModal as EventListener);

        // Clean up
        return () => {
            document.removeEventListener('showEventRequestPreviewModal', handleShowModal as EventListener);
        };
    }, []);

    const closeModal = () => {
        console.log("Closing modal");
        setIsOpen(false);
        // Dispatch custom event to notify modal has closed
        document.dispatchEvent(new CustomEvent('modalClosed'));
    };

    console.log("EventRequestFormPreviewModalWrapper state:", { isOpen, hasFormData: !!formData });

    if (!isOpen || !formData) return null;

    return (
        <EventRequestFormPreviewModal
            formData={formData}
            closeModal={closeModal}
        />
    );
};

// Export the EventRequestFormPreview component as a named export
export { EventRequestFormPreview };

// Export the wrapper component as default
export default EventRequestFormPreviewModalWrapper; 