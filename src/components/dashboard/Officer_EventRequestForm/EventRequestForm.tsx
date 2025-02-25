import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Update } from '../../../scripts/pocketbase/Update';
import { FileManager } from '../../../scripts/pocketbase/FileManager';
import { Get } from '../../../scripts/pocketbase/Get';

// Form sections
import PRSection from './PRSection';
import EventDetailsSection from './EventDetailsSection';
import TAPFormSection from './TAPFormSection';
import ASFundingSection from './ASFundingSection';
import EventRequestFormPreview from './EventRequestFormPreview';
import InvoiceBuilder from './InvoiceBuilder';
import type { InvoiceData, InvoiceItem } from './InvoiceBuilder';

// Animation variants
const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            stiffness: 300,
            damping: 30,
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            stiffness: 300,
            damping: 24
        }
    }
};

// Form data interface
export interface EventRequestFormData {
    name: string;
    location: string;
    start_date_time: string;
    end_date_time: string;
    event_description: string;
    flyers_needed: boolean;
    flyer_type: string[];
    other_flyer_type: string;
    flyer_advertising_start_date: string;
    flyer_additional_requests: string;
    photography_needed: boolean;
    required_logos: string[];
    other_logos: File[];
    advertising_format: string;
    will_or_have_room_booking: boolean;
    expected_attendance: number;
    room_booking: File | null;
    as_funding_required: boolean;
    food_drinks_being_served: boolean;
    itemized_invoice: string;
    invoice: File | null;
    invoice_files: File[]; // Support for multiple invoice files
    needs_graphics: boolean | null;
    needs_as_funding: boolean;
    invoiceData: InvoiceData;
    formReviewed: boolean; // New field to track if the form has been reviewed
}

const EventRequestForm: React.FC = () => {
    const [currentStep, setCurrentStep] = useState<number>(1);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Initialize form data
    const [formData, setFormData] = useState<EventRequestFormData>({
        name: '',
        location: '',
        start_date_time: '',
        end_date_time: '',
        event_description: '',
        flyers_needed: false,
        flyer_type: [],
        other_flyer_type: '',
        flyer_advertising_start_date: '',
        flyer_additional_requests: '',
        photography_needed: false,
        required_logos: [],
        other_logos: [],
        advertising_format: '',
        will_or_have_room_booking: false,
        expected_attendance: 0,
        room_booking: null,
        as_funding_required: false,
        food_drinks_being_served: false,
        itemized_invoice: '',
        invoice: null,
        invoice_files: [], // Initialize empty array for multiple invoice files
        needs_graphics: null,
        needs_as_funding: false,
        invoiceData: {
            items: [],
            subtotal: 0,
            taxRate: 7.75, // Default tax rate for San Diego
            taxAmount: 0,
            tipPercentage: 15, // Default tip percentage
            tipAmount: 0,
            total: 0,
            vendor: ''
        },
        formReviewed: false // Initialize as false
    });

    // Save form data to localStorage
    useEffect(() => {
        const formDataToSave = { ...formData };
        // Remove file objects before saving to localStorage
        const dataToStore = {
            ...formDataToSave,
            other_logos: [],
            room_booking: null,
            invoice: null,
            invoice_files: []
        };

        localStorage.setItem('eventRequestFormData', JSON.stringify(dataToStore));

        // Also update the preview data
        window.dispatchEvent(new CustomEvent('formDataUpdated', {
            detail: { formData: formDataToSave }
        }));
    }, [formData]);

    // Load form data from localStorage on initial load
    useEffect(() => {
        const savedData = localStorage.getItem('eventRequestFormData');
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                setFormData(prevData => ({
                    ...prevData,
                    ...parsedData
                }));
            } catch (e) {
                console.error('Error parsing saved form data:', e);
            }
        }
    }, []);

    // Handle form section data changes
    const handleSectionDataChange = (sectionData: Partial<EventRequestFormData>) => {
        setFormData(prevData => ({
            ...prevData,
            ...sectionData
        }));
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Check if the form has been reviewed
        if (!formData.formReviewed) {
            toast.error('Please review your form before submitting');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        // Show initial submitting toast
        const submittingToast = toast.loading('Preparing to submit your event request...');

        try {
            const auth = Authentication.getInstance();
            const update = Update.getInstance();
            const fileManager = FileManager.getInstance();

            if (!auth.isAuthenticated()) {
                toast.error('You must be logged in to submit an event request', { id: submittingToast });
                throw new Error('You must be logged in to submit an event request');
            }

            // Create the event request record
            const userId = auth.getUserId();
            if (!userId) {
                toast.error('User ID not found', { id: submittingToast });
                throw new Error('User ID not found');
            }

            // Prepare data for submission
            const submissionData = {
                requested_user: userId,
                name: formData.name,
                location: formData.location,
                start_date_time: new Date(formData.start_date_time).toISOString(),
                end_date_time: new Date(formData.end_date_time).toISOString(),
                event_description: formData.event_description,
                flyers_needed: formData.flyers_needed,
                flyer_type: formData.flyer_type,
                other_flyer_type: formData.other_flyer_type,
                flyer_advertising_start_date: formData.flyer_advertising_start_date ? new Date(formData.flyer_advertising_start_date).toISOString() : '',
                flyer_additional_requests: formData.flyer_additional_requests,
                photography_needed: formData.photography_needed,
                required_logos: formData.required_logos,
                advertising_format: formData.advertising_format,
                will_or_have_room_booking: formData.will_or_have_room_booking,
                expected_attendance: formData.expected_attendance,
                as_funding_required: formData.as_funding_required,
                food_drinks_being_served: formData.food_drinks_being_served,
                // Store the itemized_invoice as a string for backward compatibility
                itemized_invoice: formData.itemized_invoice,
                // Store the invoice data as a properly formatted JSON object
                invoice_data: {
                    items: formData.invoiceData.items.map(item => ({
                        item: item.description,
                        quantity: item.quantity,
                        unit_price: item.unitPrice
                    })),
                    tax: formData.invoiceData.taxAmount,
                    tip: formData.invoiceData.tipAmount,
                    total: formData.invoiceData.total,
                    vendor: formData.invoiceData.vendor
                },
            };

            toast.loading('Creating event request record...', { id: submittingToast });

            try {
                // Create the record
                const record = await update.create('event_request', submissionData);

                // Upload files if they exist
                if (formData.other_logos.length > 0) {
                    toast.loading('Uploading logo files...', { id: submittingToast });
                    await fileManager.uploadFiles('event_request', record.id, 'other_logos', formData.other_logos);
                }

                if (formData.room_booking) {
                    toast.loading('Uploading room booking confirmation...', { id: submittingToast });
                    await fileManager.uploadFile('event_request', record.id, 'room_booking', formData.room_booking);
                }

                // Upload multiple invoice files
                if (formData.invoice_files && formData.invoice_files.length > 0) {
                    toast.loading('Uploading invoice files...', { id: submittingToast });

                    // Use appendFiles instead of uploadFiles to ensure we're adding files, not replacing them
                    await fileManager.appendFiles('event_request', record.id, 'invoice_files', formData.invoice_files);

                    // For backward compatibility, also upload the first file as the main invoice
                    if (formData.invoice || formData.invoice_files[0]) {
                        const mainInvoice = formData.invoice || formData.invoice_files[0];
                        await fileManager.uploadFile('event_request', record.id, 'invoice', mainInvoice);
                    }
                } else if (formData.invoice) {
                    // If there are no invoice_files but there is a main invoice, upload it
                    toast.loading('Uploading invoice file...', { id: submittingToast });
                    await fileManager.uploadFile('event_request', record.id, 'invoice', formData.invoice);
                }

                // Clear form data from localStorage
                localStorage.removeItem('eventRequestFormData');

                // Show success message
                toast.success('Event request submitted successfully!', { id: submittingToast });

                // Reset form
                setFormData({
                    name: '',
                    location: '',
                    start_date_time: '',
                    end_date_time: '',
                    event_description: '',
                    flyers_needed: false,
                    flyer_type: [],
                    other_flyer_type: '',
                    flyer_advertising_start_date: '',
                    flyer_additional_requests: '',
                    photography_needed: false,
                    required_logos: [],
                    other_logos: [],
                    advertising_format: '',
                    will_or_have_room_booking: false,
                    expected_attendance: 0,
                    room_booking: null,
                    as_funding_required: false,
                    food_drinks_being_served: false,
                    itemized_invoice: '',
                    invoice: null,
                    invoice_files: [], // Reset multiple invoice files
                    needs_graphics: null,
                    needs_as_funding: false,
                    invoiceData: {
                        items: [],
                        subtotal: 0,
                        taxRate: 7.75, // Default tax rate for San Diego
                        taxAmount: 0,
                        tipPercentage: 15, // Default tip percentage
                        tipAmount: 0,
                        total: 0,
                        vendor: ''
                    },
                    formReviewed: false // Reset review status
                });

                // Reset to first step
                setCurrentStep(1);
            } catch (uploadErr: any) {
                console.error('Error during file upload:', uploadErr);
                toast.error(`Error during file upload: ${uploadErr.message || 'Unknown error'}`, { id: submittingToast });
                throw uploadErr;
            }

        } catch (err: any) {
            console.error('Error submitting event request:', err);
            setError(err.message || 'An error occurred while submitting your request');
            toast.error(err.message || 'An error occurred while submitting your request', { id: submittingToast });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Validate PR Section
    const validatePRSection = () => {
        if (formData.flyer_type.length === 0) {
            toast.error('Please select at least one flyer type');
            return false;
        }

        if (formData.flyer_type.includes('other') && !formData.other_flyer_type) {
            toast.error('Please specify the other flyer type');
            return false;
        }

        if (formData.flyer_type.some(type =>
            type === 'digital_with_social' ||
            type === 'physical_with_advertising' ||
            type === 'newsletter'
        ) && !formData.flyer_advertising_start_date) {
            toast.error('Please specify when to start advertising');
            return false;
        }

        if (formData.required_logos.includes('OTHER') && (!formData.other_logos || formData.other_logos.length === 0)) {
            toast.error('Please upload your logo files');
            return false;
        }

        if (!formData.advertising_format) {
            toast.error('Please select a format');
            return false;
        }

        if (formData.photography_needed === null || formData.photography_needed === undefined) {
            toast.error('Please specify if photography is needed');
            return false;
        }

        return true;
    };

    // Validate Event Details Section
    const validateEventDetailsSection = () => {
        if (!formData.name) {
            toast.error('Please enter an event name');
            return false;
        }

        if (!formData.event_description) {
            toast.error('Please enter an event description');
            return false;
        }

        if (!formData.start_date_time) {
            toast.error('Please enter a start date and time');
            return false;
        }

        if (!formData.end_date_time) {
            toast.error('Please enter an end date and time');
            return false;
        }

        if (!formData.location) {
            toast.error('Please enter an event location');
            return false;
        }

        if (formData.will_or_have_room_booking === null || formData.will_or_have_room_booking === undefined) {
            toast.error('Please specify if you have a room booking');
            return false;
        }

        return true;
    };

    // Validate TAP Form Section
    const validateTAPFormSection = () => {
        if (!formData.expected_attendance) {
            toast.error('Please enter the expected attendance');
            return false;
        }

        if (!formData.room_booking && formData.will_or_have_room_booking) {
            toast.error('Please upload your room booking confirmation');
            return false;
        }

        if (formData.food_drinks_being_served === null || formData.food_drinks_being_served === undefined) {
            toast.error('Please specify if food/drinks will be served');
            return false;
        }

        return true;
    };

    // Validate AS Funding Section
    const validateASFundingSection = () => {
        if (formData.needs_as_funding) {
            // Check if vendor is provided
            if (!formData.invoiceData.vendor) {
                toast.error('Please enter the vendor/restaurant name');
                return false;
            }

            // Check if there are items in the invoice
            if (formData.invoiceData.items.length === 0) {
                toast.error('Please add at least one item to the invoice');
                return false;
            }

            // Check if at least one invoice file is uploaded
            if (!formData.invoice && (!formData.invoice_files || formData.invoice_files.length === 0)) {
                toast.error('Please upload at least one invoice file');
                return false;
            }
        }

        return true;
    };

    // Validate all sections before submission
    const validateAllSections = () => {
        // Validate Event Details
        if (!validateEventDetailsSection()) {
            return false;
        }

        // Validate TAP Form
        if (!validateTAPFormSection()) {
            return false;
        }

        // Validate PR Section if needed
        if (formData.needs_graphics && !validatePRSection()) {
            return false;
        }

        // Validate AS Funding if needed
        if (formData.food_drinks_being_served && formData.needs_as_funding && !validateASFundingSection()) {
            return false;
        }

        return true;
    };

    // Handle next button click with validation
    const handleNextStep = (nextStep: number) => {
        let isValid = true;

        // Validate current section before proceeding
        if (currentStep === 2 && formData.needs_graphics) {
            isValid = validatePRSection();
        } else if (currentStep === 3) {
            isValid = validateEventDetailsSection();
        } else if (currentStep === 4) {
            isValid = validateTAPFormSection();
        } else if (currentStep === 5 && formData.food_drinks_being_served && formData.needs_as_funding) {
            isValid = validateASFundingSection();
        }

        if (isValid) {
            // Set the current step
            setCurrentStep(nextStep);

            // If moving to the review step, mark the form as reviewed
            // but don't submit it automatically
            if (nextStep === 6) {
                setFormData(prevData => ({
                    ...prevData,
                    formReviewed: true
                }));
            }
        }
    };

    // Handle form submission with validation
    const handleSubmitWithValidation = (e: React.FormEvent) => {
        e.preventDefault();

        // If we're on the review step, we've already validated all sections
        // Only submit if the user explicitly clicks the submit button
        if (currentStep === 6 && formData.formReviewed) {
            handleSubmit(e);
            return;
        }

        // Otherwise, validate all sections before proceeding to the review step
        if (validateAllSections()) {
            // If we're not on the review step, go to the review step instead of submitting
            handleNextStep(6);
        }
    };

    // Render the current step
    const renderCurrentSection = () => {
        // Step 1: Ask if they need graphics from the design team
        if (currentStep === 1) {
            return (
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="space-y-6"
                >
                    <h2 className="text-2xl font-bold mb-4 text-primary">Event Request Form</h2>

                    <div className="bg-base-300/50 p-4 rounded-lg mb-6">
                        <p className="text-sm">
                            Welcome to the IEEE UCSD Event Request Form. This form will help you request PR materials,
                            provide event details, and request AS funding if needed.
                        </p>
                    </div>

                    <div className="bg-base-200/50 p-6 rounded-lg">
                        <h3 className="text-xl font-semibold mb-4">Do you need graphics from the design team?</h3>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <button
                                className={`btn btn-lg ${formData.needs_graphics ? 'btn-primary' : 'btn-outline'} flex-1`}
                                onClick={() => {
                                    setFormData({ ...formData, needs_graphics: true, flyers_needed: true });
                                    setCurrentStep(2);
                                }}
                            >
                                Yes
                            </button>
                            <button
                                className={`btn btn-lg ${!formData.needs_graphics && formData.needs_graphics !== null ? 'btn-primary' : 'btn-outline'} flex-1`}
                                onClick={() => {
                                    setFormData({ ...formData, needs_graphics: false, flyers_needed: false });
                                    setCurrentStep(3);
                                }}
                            >
                                No
                            </button>
                        </div>
                    </div>
                </motion.div>
            );
        }

        // Step 2: PR Section (if they need graphics)
        if (currentStep === 2) {
            return (
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="space-y-6"
                >
                    <PRSection formData={formData} onDataChange={handleSectionDataChange} />

                    <div className="flex justify-between mt-8">
                        <button className="btn btn-outline" onClick={() => setCurrentStep(1)}>
                            Back
                        </button>
                        <button className="btn btn-primary" onClick={() => handleNextStep(3)}>
                            Next
                        </button>
                    </div>
                </motion.div>
            );
        }

        // Step 3: Event Details Section
        if (currentStep === 3) {
            return (
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="space-y-6"
                >
                    <EventDetailsSection formData={formData} onDataChange={handleSectionDataChange} />

                    <div className="flex justify-between mt-8">
                        <button className="btn btn-outline" onClick={() => setCurrentStep(formData.needs_graphics ? 2 : 1)}>
                            Back
                        </button>
                        <button className="btn btn-primary" onClick={() => handleNextStep(4)}>
                            Next
                        </button>
                    </div>
                </motion.div>
            );
        }

        // Step 4: TAP Form Section
        if (currentStep === 4) {
            return (
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="space-y-6"
                >
                    <TAPFormSection formData={formData} onDataChange={handleSectionDataChange} />

                    <div className="flex justify-between mt-8">
                        <button className="btn btn-outline" onClick={() => setCurrentStep(3)}>
                            Back
                        </button>
                        <button className="btn btn-primary" onClick={() => handleNextStep(5)}>
                            Next
                        </button>
                    </div>
                </motion.div>
            );
        }

        // Step 5: AS Funding Section
        if (currentStep === 5) {
            return (
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="space-y-6"
                >
                    {formData.food_drinks_being_served && (
                        <div className="bg-base-200/50 p-6 rounded-lg mb-6">
                            <h3 className="text-xl font-semibold mb-4">Do you need AS funding for this event?</h3>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    className={`btn btn-lg ${formData.needs_as_funding ? 'btn-primary' : 'btn-outline'} flex-1`}
                                    onClick={() => {
                                        setFormData({ ...formData, needs_as_funding: true, as_funding_required: true });
                                    }}
                                >
                                    Yes
                                </button>
                                <button
                                    className={`btn btn-lg ${!formData.needs_as_funding && formData.needs_as_funding !== null ? 'btn-primary' : 'btn-outline'} flex-1`}
                                    onClick={() => {
                                        setFormData({ ...formData, needs_as_funding: false, as_funding_required: false });
                                    }}
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    )}

                    {!formData.food_drinks_being_served && (
                        <div className="bg-base-200/50 p-6 rounded-lg mb-6">
                            <h3 className="text-xl font-semibold mb-4">AS Funding Information</h3>
                            <p className="mb-4">Since you're not serving food or drinks, AS funding is not applicable for this event.</p>
                            <div className="alert alert-info">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="h-5 w-5 stroke-current">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <div>
                                    <p>If you need to request AS funding for other purposes, please contact the AS office directly.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {formData.needs_as_funding && formData.food_drinks_being_served && (
                        <ASFundingSection formData={formData} onDataChange={handleSectionDataChange} />
                    )}

                    <div className="flex justify-between mt-8">
                        <button className="btn btn-outline" onClick={() => setCurrentStep(4)}>
                            Back
                        </button>
                        <button className="btn btn-primary" onClick={() => handleNextStep(6)}>
                            Review Form
                        </button>
                    </div>
                </motion.div>
            );
        }

        // Step 6: Review Form
        if (currentStep === 6) {
            return (
                <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={containerVariants}
                    className="space-y-6"
                >
                    <h2 className="text-2xl font-bold mb-4 text-primary">Review Your Event Request</h2>

                    <div className="bg-base-300/50 p-4 rounded-lg mb-6">
                        <p className="text-sm">
                            Please review all information carefully before submitting. You can go back to any section to make changes if needed.
                        </p>
                    </div>

                    <div className="bg-base-200/50 p-6 rounded-lg">
                        <EventRequestFormPreview formData={formData} />

                        <div className="divider my-6">Ready to Submit?</div>

                        <div className="alert alert-info mb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="h-5 w-5 stroke-current">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <div>
                                <p>Once submitted, you'll need to notify PR and/or Coordinators in the #-events Slack channel.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between mt-8">
                        <button className="btn btn-outline" onClick={() => setCurrentStep(5)}>
                            Back
                        </button>
                        <button
                            type="button"
                            className="btn btn-success btn-lg"
                            onClick={handleSubmitWithValidation}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="loading loading-spinner"></span>
                                    Submitting...
                                </>
                            ) : (
                                'Submit Event Request'
                            )}
                        </button>
                    </div>
                </motion.div>
            );
        }

        return null;
    };

    return (
        <>
            <Toaster
                position="top-right"
                toastOptions={{
                    duration: 4000,
                    style: {
                        background: '#333',
                        color: '#fff',
                    },
                    success: {
                        duration: 3000,
                        style: {
                            background: 'green',
                        },
                    },
                    error: {
                        duration: 5000,
                        style: {
                            background: 'red',
                        },
                    },
                }}
            />
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="max-w-4xl mx-auto"
            >
                <form
                    onSubmit={(e) => {
                        // Prevent default form submission behavior
                        e.preventDefault();
                        // Only submit if the user explicitly clicks the submit button
                        // The actual submission is handled by handleSubmitWithValidation
                    }}
                    className="space-y-6"
                >
                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                className="alert alert-error shadow-lg"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 stroke-current" fill="none" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>{error}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Progress indicator */}
                    <div className="w-full mb-6">
                        <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium">Step {currentStep} of 6</span>
                            <span className="text-sm font-medium">{Math.min(Math.round((currentStep / 6) * 100), 100)}% complete</span>
                        </div>
                        <div className="w-full bg-base-300 rounded-full h-2.5">
                            <div
                                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min((currentStep / 6) * 100, 100)}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Current section */}
                    <AnimatePresence mode="wait">
                        {renderCurrentSection()}
                    </AnimatePresence>
                </form>
            </motion.div>
        </>
    );
};

export default EventRequestForm; 