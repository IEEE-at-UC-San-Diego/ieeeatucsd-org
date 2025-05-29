import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Update } from '../../../scripts/pocketbase/Update';
import { FileManager } from '../../../scripts/pocketbase/FileManager';
import { DataSyncService } from '../../../scripts/database/DataSyncService';
import { Collections } from '../../../schemas/pocketbase/schema';
import { EventRequestStatus } from '../../../schemas/pocketbase';
import { EmailClient } from '../../../scripts/email/EmailClient';

// Form sections
import PRSection from './PRSection';
import EventDetailsSection from './EventDetailsSection';
import TAPFormSection from './TAPFormSection';
import ASFundingSection from './ASFundingSection';
import { EventRequestFormPreview } from './EventRequestFormPreview';
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

// Form data interface - based on the schema EventRequest but with form-specific fields
export interface EventRequestFormData {
    // Fields from EventRequest
    name: string;
    location: string;
    start_date_time: string;
    end_date_time: string;
    event_description: string;
    flyers_needed: boolean;
    photography_needed: boolean;
    as_funding_required: boolean;
    food_drinks_being_served: boolean;
    itemized_invoice?: string;
    status?: string;
    created_by?: string;
    id?: string;
    created?: string;
    updated?: string;

    // Additional form-specific fields
    flyer_type: string[];
    other_flyer_type: string;
    flyer_advertising_start_date: string;
    flyer_additional_requests: string;
    required_logos: string[];
    other_logos: File[]; // Form uses File objects, schema uses strings
    advertising_format: string;
    will_or_have_room_booking: boolean;
    expected_attendance: number;
    room_booking: File | null;
    invoice: File | null;
    invoice_files: File[];
    invoiceData: InvoiceData;
    needs_graphics?: boolean | null;
    needs_as_funding?: boolean | null;
    formReviewed?: boolean; // Track if the form has been reviewed
}

// Add CustomAlert import
import CustomAlert from '../universal/CustomAlert';

const EventRequestForm: React.FC = () => {
    const [currentStep, setCurrentStep] = useState<number>(1);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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
            taxAmount: 0,
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
        // Ensure both needs_graphics and flyers_needed are synchronized
        if (sectionData.flyers_needed !== undefined && sectionData.needs_graphics === undefined) {
            sectionData.needs_graphics = sectionData.flyers_needed ? true : false;
        }

        // Ensure both needs_as_funding and as_funding_required are synchronized
        if (sectionData.needs_as_funding !== undefined && sectionData.as_funding_required === undefined) {
            sectionData.as_funding_required = sectionData.needs_as_funding ? true : false;
        }

        setFormData(prevData => {
            const updatedData = { ...prevData, ...sectionData };
            
            // Save to localStorage
            try {
                const dataToStore = {
                    ...updatedData,
                    // Remove file objects before saving to localStorage
                    other_logos: [],
                    room_booking: null,
                    invoice: null,
                    invoice_files: []
                };
                localStorage.setItem('eventRequestFormData', JSON.stringify(dataToStore));
                
                // Also update the preview data
                window.dispatchEvent(new CustomEvent('formDataUpdated', {
                    detail: { formData: updatedData }
                }));
            } catch (error) {
                console.error('Error saving form data to localStorage:', error);
            }
            
            return updatedData;
        });
    };

    // Add this function before the handleSubmit function
    const resetForm = () => {
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
            room_booking: null, // No room booking by default
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
                taxAmount: 0,
                tipAmount: 0,
                total: 0,
                vendor: ''
            },
            formReviewed: false // Reset review status
        });

        // Reset to first step
        setCurrentStep(1);
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

        try {
            const auth = Authentication.getInstance();
            const update = Update.getInstance();
            const fileManager = FileManager.getInstance();
            const dataSync = DataSyncService.getInstance();

            if (!auth.isAuthenticated()) {
                // Don't show error toast on dashboard page for unauthenticated users
                if (!window.location.pathname.includes('/dashboard')) {
                    toast.error('You must be logged in to submit an event request');
                }
                throw new Error('You must be logged in to submit an event request');
            }

            // Create the event request record
            const userId = auth.getUserId();
            if (!userId) {
                // Don't show error toast on dashboard page for unauthenticated users
                if (auth.isAuthenticated() || !window.location.pathname.includes('/dashboard')) {
                    toast.error('User ID not found');
                }
                throw new Error('User ID not found');
            }

            // Prepare data for submission
            const submissionData = {
                requested_user: userId,
                name: formData.name,
                location: formData.location,
                start_date_time: (() => {
                    try {
                        const startDate = new Date(formData.start_date_time);
                        if (isNaN(startDate.getTime())) {
                            throw new Error('Invalid start date');
                        }
                        return startDate.toISOString();
                    } catch (e) {
                        throw new Error('Invalid start date format');
                    }
                })(),
                end_date_time: (() => {
                    try {
                        if (formData.end_date_time) {
                            const endDate = new Date(formData.end_date_time);
                            if (isNaN(endDate.getTime())) {
                                throw new Error('Invalid end date');
                            }
                            return endDate.toISOString();
                        } else {
                            // Fallback to start date if no end date (should not happen with validation)
                            const startDate = new Date(formData.start_date_time);
                            return startDate.toISOString();
                        }
                    } catch (e) {
                        // Fallback to start date
                        const startDate = new Date(formData.start_date_time);
                        return startDate.toISOString();
                    }
                })(),
                event_description: formData.event_description,
                flyers_needed: formData.flyers_needed,
                photography_needed: formData.photography_needed,
                as_funding_required: formData.needs_as_funding,
                food_drinks_being_served: formData.food_drinks_being_served,
                itemized_invoice: formData.itemized_invoice,
                flyer_type: formData.flyer_type,
                other_flyer_type: formData.other_flyer_type,
                flyer_advertising_start_date: formData.flyer_advertising_start_date ? (() => {
                    try {
                        const advertDate = new Date(formData.flyer_advertising_start_date);
                        return isNaN(advertDate.getTime()) ? '' : advertDate.toISOString();
                    } catch (e) {
                        return '';
                    }
                })() : '',
                flyer_additional_requests: formData.flyer_additional_requests,
                required_logos: formData.required_logos,
                advertising_format: formData.advertising_format,
                will_or_have_room_booking: formData.will_or_have_room_booking,
                expected_attendance: formData.expected_attendance,
                needs_graphics: formData.needs_graphics,
                needs_as_funding: formData.needs_as_funding,
                invoice_data: {
                    items: formData.invoiceData.items.map(item => ({
                        item: item.description,
                        quantity: item.quantity,
                        unit_price: item.unitPrice
                    })),
                    taxAmount: formData.invoiceData.taxAmount,
                    tipAmount: formData.invoiceData.tipAmount,
                    total: formData.invoiceData.total,
                    vendor: formData.invoiceData.vendor
                },
            };

            // Create the record using the Update service
            // This will send the data to the server
            const record = await update.create('event_request', submissionData);

            // Force sync the event requests collection to update IndexedDB
            await dataSync.syncCollection(Collections.EVENT_REQUESTS);

            console.log('Event request record created:', record.id);

            // Upload files if they exist - handle each file type separately
            const fileUploadErrors: string[] = [];

            // Upload other logos
            if (formData.other_logos.length > 0) {
                try {
                    console.log('Uploading other logos:', formData.other_logos.length, 'files');
                    console.log('Other logos files:', formData.other_logos.map(f => ({ name: f.name, size: f.size, type: f.type })));
                    await fileManager.uploadFiles('event_request', record.id, 'other_logos', formData.other_logos);
                    console.log('Other logos uploaded successfully');
                } catch (error) {
                    console.error('Failed to upload other logos:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    fileUploadErrors.push(`Failed to upload custom logo files: ${errorMessage}`);
                }
            }

            // Upload room booking
            if (formData.room_booking) {
                try {
                    console.log('Uploading room booking file:', { name: formData.room_booking.name, size: formData.room_booking.size, type: formData.room_booking.type });
                    await fileManager.uploadFile('event_request', record.id, 'room_booking', formData.room_booking);
                    console.log('Room booking file uploaded successfully');
                } catch (error) {
                    console.error('Failed to upload room booking:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    fileUploadErrors.push(`Failed to upload room booking file: ${errorMessage}`);
                }
            }

            // Upload invoice files
            if (formData.invoice_files && formData.invoice_files.length > 0) {
                try {
                    console.log('Uploading invoice files:', formData.invoice_files.length, 'files');
                    console.log('Invoice files:', formData.invoice_files.map(f => ({ name: f.name, size: f.size, type: f.type })));
                    await fileManager.appendFiles('event_request', record.id, 'invoice_files', formData.invoice_files);

                    // For backward compatibility, also upload the first file as the main invoice
                    if (formData.invoice || formData.invoice_files[0]) {
                        const mainInvoice = formData.invoice || formData.invoice_files[0];
                        console.log('Uploading main invoice file:', { name: mainInvoice.name, size: mainInvoice.size, type: mainInvoice.type });
                        await fileManager.uploadFile('event_request', record.id, 'invoice', mainInvoice);
                    }
                    console.log('Invoice files uploaded successfully');
                } catch (error) {
                    console.error('Failed to upload invoice files:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    fileUploadErrors.push(`Failed to upload invoice files: ${errorMessage}`);
                }
            } else if (formData.invoice) {
                try {
                    console.log('Uploading single invoice file:', { name: formData.invoice.name, size: formData.invoice.size, type: formData.invoice.type });
                    await fileManager.uploadFile('event_request', record.id, 'invoice', formData.invoice);
                    console.log('Invoice file uploaded successfully');
                } catch (error) {
                    console.error('Failed to upload invoice file:', error);
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    fileUploadErrors.push(`Failed to upload invoice file: ${errorMessage}`);
                }
            }

            // Show file upload warnings if any occurred
            if (fileUploadErrors.length > 0) {
                console.warn('File upload errors:', fileUploadErrors);
                // Show each file upload error as a separate toast for better UX
                fileUploadErrors.forEach(error => {
                    toast.error(error, {
                        duration: 6000, // Longer duration for file upload errors
                        position: 'top-right'
                    });
                });
                // Also show a summary toast
                toast.error(`Event request submitted successfully, but ${fileUploadErrors.length} file upload(s) failed. Please check the errors above and re-upload the files manually.`, {
                    duration: 8000,
                    position: 'top-center'
                });
            } else {
                // Keep success toast for form submission since it's a user action
                toast.success('Event request submitted successfully!');
            }

            // Clear form data from localStorage
            localStorage.removeItem('eventRequestFormData');

            // Send email notification to coordinators (non-blocking)
            try {
                await EmailClient.notifyEventRequestSubmission(record.id);
                console.log('Event request notification email sent successfully');
            } catch (emailError) {
                console.error('Failed to send event request notification email:', emailError);
                // Don't show error to user - email failure shouldn't disrupt the main flow
            }

            // Reset form
            resetForm();

            // Switch to the submissions tab
            const submissionsTab = document.getElementById('submissions-tab');
            if (submissionsTab) {
                submissionsTab.click();
            }
        } catch (error) {
            console.error('Error submitting event request:', error);
            toast.error('Failed to submit event request. Please try again.');
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
        let valid = true;
        const errors: string[] = [];

        if (!formData.name || formData.name.trim() === '') {
            errors.push('Event name is required');
            valid = false;
        }

        if (!formData.event_description || formData.event_description.trim() === '') {
            errors.push('Event description is required');
            valid = false;
        }

        if (!formData.start_date_time || formData.start_date_time.trim() === '') {
            errors.push('Event start date and time is required');
            valid = false;
        } else {
            // Validate start date format
            try {
                const startDate = new Date(formData.start_date_time);
                if (isNaN(startDate.getTime())) {
                    errors.push('Invalid start date and time format');
                    valid = false;
                } else {
                    // Check if start date is in the future
                    const now = new Date();
                    if (startDate <= now) {
                        errors.push('Event start date must be in the future');
                        valid = false;
                    }
                }
            } catch (e) {
                errors.push('Invalid start date and time format');
                valid = false;
            }
        }

        if (!formData.end_date_time || formData.end_date_time.trim() === '') {
            errors.push('Event end time is required');
            valid = false;
        } else if (formData.start_date_time) {
            // Validate end date format and logic
            try {
                const startDate = new Date(formData.start_date_time);
                const endDate = new Date(formData.end_date_time);
                
                if (isNaN(endDate.getTime())) {
                    errors.push('Invalid end date and time format');
                    valid = false;
                } else if (!isNaN(startDate.getTime()) && endDate <= startDate) {
                    errors.push('Event end time must be after the start time');
                    valid = false;
                }
            } catch (e) {
                errors.push('Invalid end date and time format');
                valid = false;
            }
        }

        if (!formData.location || formData.location.trim() === '') {
            errors.push('Event location is required');
            valid = false;
        }

        if (formData.will_or_have_room_booking === undefined || formData.will_or_have_room_booking === null) {
            errors.push('Room booking status is required');
            valid = false;
        }

        if (errors.length > 0) {
            // Show the first error as a toast instead of setting error state
            toast.error(errors[0]);
            return false;
        }

        return valid;
    };

    // Validate TAP Form Section
    const validateTAPFormSection = () => {
        // Verify that all required fields are filled
        if (!formData.will_or_have_room_booking && formData.will_or_have_room_booking !== false) {
            toast.error('Please indicate whether you will or have a room booking');
            return false;
        }

        if (!formData.expected_attendance || formData.expected_attendance <= 0) {
            toast.error('Please enter a valid expected attendance');
            return false;
        }

        // Only require room booking file if will_or_have_room_booking is true
        if (formData.will_or_have_room_booking && !formData.room_booking) {
            toast.error('Please upload your room booking confirmation');
            return false;
        }

        if (!formData.food_drinks_being_served && formData.food_drinks_being_served !== false) {
            toast.error('Please indicate whether food/drinks will be served');
            return false;
        }

        // Validate AS funding question if food is being served
        if (formData.food_drinks_being_served && formData.needs_as_funding === undefined) {
            toast.error('Please indicate whether you need AS funding');
            return false;
        }

        return true;
    };

    // Validate AS Funding Section
    const validateASFundingSection = () => {
        if (formData.as_funding_required) {
            // Check if invoice data is present and has items
            if (!formData.invoiceData || !formData.invoiceData.items || formData.invoiceData.items.length === 0) {
                toast.error('Please add at least one item to your invoice');
                return false;
            }

            // Calculate the total budget from invoice items
            const totalBudget = formData.invoiceData.items.reduce(
                (sum, item) => sum + (item.unitPrice * item.quantity), 0
            );

            // Check if the budget exceeds the maximum allowed ($5000 cap regardless of attendance)
            const maxBudget = Math.min(formData.expected_attendance * 10, 5000);
            if (totalBudget > maxBudget) {
                toast.error(`Your budget ($${totalBudget.toFixed(2)}) exceeds the maximum allowed ($${maxBudget}). The absolute maximum is $5,000.`);
                return false;
            }
        }

        return true;
    };

    // Validate all sections before submission
    const validateAllSections = () => {
        // We no longer forcibly set end_date_time to match start_date_time
        // The end time is now configured separately with the same date

        if (!validateEventDetailsSection()) {
            setCurrentStep(1);
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

        if (!isValid) {
            return; // Don't proceed if validation fails
        }

        // If we're moving from step 4 to step 5
        if (currentStep === 4 && nextStep === 5) {
            // If food and drinks aren't being served or if AS funding isn't needed, skip to step 6 (review)
            if (!formData.food_drinks_being_served || !formData.needs_as_funding) {
                nextStep = 6;
            }
        }

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
                    <CustomAlert
                        type="warning"
                        title="Multiple Events Notice"
                        message="If you have multiple events, you must submit a separate TAP form for each one. Multiple-day events require individual submissions for each day."
                        icon="heroicons:exclamation-triangle"
                        className="mb-4"
                    />

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
                    <div className="bg-base-200/50 p-6 rounded-lg mb-6">
                        <h3 className="text-xl font-semibold mb-4">AS Funding Details</h3>
                        <p className="mb-4">Please provide the necessary information for your AS funding request.</p>
                    </div>

                    <ASFundingSection formData={formData} onDataChange={handleSectionDataChange} />

                    <div className="flex justify-between mt-8">
                        <button className="btn btn-outline" onClick={() => setCurrentStep(4)}>
                            Back
                        </button>
                        <button className="btn btn-primary" onClick={() => handleNextStep(6)}>
                            Next
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
                        <EventRequestFormPreview formData={formData} isModal={false} />

                        <div className="divider my-6">Ready to Submit?</div>

                        <CustomAlert
                            type="info"
                            title="Important Note"
                            message="Once submitted, you'll need to notify PR and/or Coordinators in the #-events Slack channel."
                            icon="heroicons:information-circle"
                            className="mb-6"
                        />
                    </div>

                    <div className="flex justify-between mt-8">
                        <button
                            className="btn btn-outline"
                            onClick={() => {
                                // Skip the AS Funding section if not needed
                                if (!formData.food_drinks_being_served || !formData.needs_as_funding) {
                                    setCurrentStep(4);  // Go back to TAP Form section
                                } else {
                                    setCurrentStep(5);  // Go back to AS Funding section
                                }
                            }}
                        >
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