import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getFirestore, collection, addDoc, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { app } from '../../../../firebase/client';
import { auth } from '../../../../firebase/client';
import { EventAuditService } from '../../shared/services/eventAuditService';
import { EmailClient } from '../../../../scripts/email/EmailClient';
import { toast } from 'react-hot-toast';

// Import refactored components and utilities
import type {
    EventRequestModalProps,
    EventFormData,
    FieldError
} from './types/EventRequestTypes';
import { useInvoiceManagement } from './hooks/useInvoiceManagement';
import { validateStep, validateCompleteForm } from './utils/validationUtils';
import {
    safeGetTimeString,
    safeGetDateString,
    safeGetDateTimeString,
    convertLegacyInvoices,
    createSafeDateTime
} from './utils/eventRequestUtils';
import { uploadFiles } from './utils/fileUploadUtils';

// Import section components
import DisclaimerSection from './components/DisclaimerSection';
import BasicInformationSection from './components/BasicInformationSection';
import MarketingSection from './components/MarketingSection';
import LogisticsSection from './components/LogisticsSection';
import FundingSection from './components/FundingSection';
import EventReviewSection from './components/EventReviewSection';

export default function EventRequestModal({ onClose, editingRequest, onSuccess }: EventRequestModalProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<FieldError>({});

    // Track original data for comparison when editing
    const [originalData, setOriginalData] = useState<any>(null);

    // Form data
    const [formData, setFormData] = useState<EventFormData>({
        name: '',
        location: '',
        startDate: '',
        startTime: '',
        endTime: '',
        eventDescription: '',
        department: 'General',
        eventCode: '',
        pointsToReward: 0,
        flyersNeeded: false,
        flyerType: [],
        otherFlyerType: '',
        flyerAdvertisingStartDate: '',
        flyerAdditionalRequests: '',
        flyersCompleted: false,
        photographyNeeded: false,
        requiredLogos: [],
        otherLogos: [],
        otherLogoFiles: [],
        advertisingFormat: '',
        additionalSpecifications: '',
        hasRoomBooking: true,
        roomBookingFile: null,
        expectedAttendance: '',
        servingFoodDrinks: false,
        needsAsFunding: false,
        invoices: [],
        needsGraphics: false,
        // Existing files for editing
        existingRoomBookingFiles: [],
        existingOtherLogos: [],
        // Legacy fields for backward compatibility
        itemizedInvoice: [],
        invoiceTax: 0,
        invoiceTip: 0,
        invoiceVendor: '',
        invoice: null,
        invoiceFiles: [],
        existingInvoiceFiles: [],
        existingInvoiceFile: ''
    });

    // Use the invoice management hook
    const {
        invoices,
        setInvoices,
        invoiceTabState,
        jsonImportData,
        activeInvoiceTab,
        setActiveInvoiceTab,
        addInvoice,
        removeInvoice,
        updateInvoice,
        addInvoiceItem,
        removeInvoiceItem,
        updateInvoiceItem,
        handleJsonImport,
        updateJsonImportData,
        updateInvoiceTabState
    } = useInvoiceManagement(formData.invoices);

    // Sync invoices with form data
    useEffect(() => {
        setFormData(prev => ({ ...prev, invoices }));
    }, [invoices]);

    const db = getFirestore(app);

    // Populate form data when editing
    useEffect(() => {
        if (editingRequest) {
            const invoicesData = convertLegacyInvoices(editingRequest);

            // Set original data for comparison
            setOriginalData({
                name: editingRequest.name || '',
                location: editingRequest.location || '',
                startDate: safeGetDateString(editingRequest.startDateTime),
                startTime: safeGetTimeString(editingRequest.startDateTime),
                endTime: safeGetTimeString(editingRequest.endDateTime),
                eventDescription: editingRequest.eventDescription || '',
                department: editingRequest.department || 'General',
                eventCode: editingRequest.eventCode || '',
                pointsToReward: editingRequest.pointsToReward || 0,
                expectedAttendance: editingRequest.expectedAttendance?.toString() || '',
                needsGraphics: editingRequest.needsGraphics || false,
                needsAsFunding: editingRequest.needsAsFunding || editingRequest.asFundingRequired || false,
                flyersNeeded: editingRequest.needsGraphics || editingRequest.flyersNeeded || false,
                photographyNeeded: editingRequest.photographyNeeded || false,
                servingFoodDrinks: editingRequest.servingFoodDrinks || editingRequest.foodDrinksBeingServed || false,
                hasRoomBooking: editingRequest.hasRoomBooking ?? editingRequest.willOrHaveRoomBooking ?? true,
                // Marketing fields
                flyerType: editingRequest.flyerType || [],
                requiredLogos: editingRequest.requiredLogos || [],
                advertisingFormat: editingRequest.advertisingFormat || '',
                additionalSpecifications: editingRequest.additionalSpecifications || '',
                flyerAdvertisingStartDate: safeGetDateTimeString(editingRequest.flyerAdvertisingStartDate),
                flyerAdditionalRequests: editingRequest.flyerAdditionalRequests || '',
                // File fields
                existingRoomBookingFiles: editingRequest.roomBookingFiles || [],
                existingOtherLogos: editingRequest.otherLogos || [],
                existingInvoiceFiles: editingRequest.invoiceFiles || [],
                invoices: invoicesData,
                _firestore: editingRequest
            });

            setFormData({
                name: editingRequest.name || '',
                location: editingRequest.location || '',
                startDate: safeGetDateString(editingRequest.startDateTime),
                startTime: safeGetTimeString(editingRequest.startDateTime),
                endTime: safeGetTimeString(editingRequest.endDateTime),
                eventDescription: editingRequest.eventDescription || '',
                department: editingRequest.department || 'General',
                eventCode: editingRequest.eventCode || '',
                pointsToReward: editingRequest.pointsToReward || 0,
                flyersNeeded: editingRequest.needsGraphics || editingRequest.flyersNeeded || false,
                flyerType: editingRequest.flyerType || [],
                otherFlyerType: editingRequest.otherFlyerType || '',
                flyerAdvertisingStartDate: safeGetDateTimeString(editingRequest.flyerAdvertisingStartDate),
                flyerAdditionalRequests: editingRequest.flyerAdditionalRequests || '',
                flyersCompleted: editingRequest.flyersCompleted || false,
                photographyNeeded: editingRequest.photographyNeeded || false,
                requiredLogos: editingRequest.requiredLogos || [],
                otherLogos: editingRequest.otherLogos || [],
                otherLogoFiles: [],
                advertisingFormat: editingRequest.advertisingFormat || '',
                additionalSpecifications: editingRequest.additionalSpecifications || '',
                hasRoomBooking: editingRequest.hasRoomBooking ?? editingRequest.willOrHaveRoomBooking ?? true,
                roomBookingFile: null,
                expectedAttendance: editingRequest.expectedAttendance?.toString() || '',
                servingFoodDrinks: editingRequest.servingFoodDrinks || editingRequest.foodDrinksBeingServed || false,
                needsAsFunding: editingRequest.needsAsFunding || editingRequest.asFundingRequired || false,
                invoices: invoicesData,
                needsGraphics: editingRequest.needsGraphics || false,
                existingRoomBookingFiles: editingRequest.roomBookingFiles || [],
                existingOtherLogos: editingRequest.otherLogos || [],
                // Legacy fields
                itemizedInvoice: editingRequest.itemizedInvoice || [],
                invoiceTax: editingRequest.invoiceTax || 0,
                invoiceTip: editingRequest.invoiceTip || 0,
                invoiceVendor: editingRequest.invoiceVendor || '',
                invoice: null,
                invoiceFiles: [],
                existingInvoiceFiles: editingRequest.invoiceFiles || [],
                existingInvoiceFile: editingRequest.invoiceFile || ''
            });

            // Initialize invoices in the hook
            setInvoices(invoicesData);
        }
    }, [editingRequest, setInvoices]);

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Clear field error when user starts typing
        if (fieldErrors[field]) {
            setFieldErrors(prev => ({ ...prev, [field]: false }));
        }
    };

    const handleArrayChange = (field: string, value: string, checked: boolean) => {
        setFormData(prev => ({
            ...prev,
            [field]: checked
                ? [...(prev[field as keyof EventFormData] as string[]), value]
                : (prev[field as keyof EventFormData] as string[]).filter(item => item !== value)
        }));
    };

    const handleFileChange = (field: string, files: FileList | null) => {
        if (files) {
            setFormData(prev => ({ ...prev, [field]: Array.from(files) }));
        }
    };

    const handleRemoveExistingFile = (fileUrl: string, fileType: 'roomBooking' | 'invoice' | 'invoiceFiles' | 'otherLogos') => {
        setFormData(prev => {
            switch (fileType) {
                case 'roomBooking':
                    return {
                        ...prev,
                        existingRoomBookingFiles: prev.existingRoomBookingFiles.filter(url => url !== fileUrl)
                    };
                case 'otherLogos':
                    return {
                        ...prev,
                        existingOtherLogos: prev.existingOtherLogos.filter(url => url !== fileUrl)
                    };
                default:
                    return prev;
            }
        });
    };

    const scrollToTop = () => {
        const modalContent = document.querySelector('.overflow-y-auto');
        if (modalContent) {
            modalContent.scrollTop = 0;
        }
    };

    const validateCurrentStep = () => {
        const validation = validateStep(currentStep, formData);
        if (!validation.isValid) {
            setError(validation.errorMessage || 'Please fix the errors before continuing');
            setFieldErrors(validation.errors);
            scrollToTop();
            return false;
        }
        setError(null);
        setFieldErrors({});
        return true;
    };

    const handleNext = () => {
        if (validateCurrentStep()) {
            setCurrentStep(prev => prev + 1);
            scrollToTop();
        }
    };

    const handlePrevious = () => {
        setCurrentStep(prev => prev - 1);
        scrollToTop();
    };

    const handleSubmit = async () => {
        const validation = validateCompleteForm(formData);
        if (!validation.isValid) {
            setError(validation.errorMessage || 'Please fix all errors before submitting');
            setFieldErrors(validation.errors);
            scrollToTop();
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Upload files
            let roomBookingUrls: string[] = [];
            let otherLogoUrls: string[] = [];

            if (formData.roomBookingFile) {
                roomBookingUrls = await uploadFiles([formData.roomBookingFile], 'room_bookings');
            }

            if (formData.otherLogoFiles.length > 0) {
                otherLogoUrls = await uploadFiles(formData.otherLogoFiles, 'logos');
            }

            // Process invoices with file uploads
            const processedInvoices = await Promise.all(
                invoices.map(async (invoice) => {
                    // Handle multiple invoice files
                    let invoiceFileUrls: string[] = [...(invoice.existingInvoiceFiles || [])];

                    if (invoice.invoiceFiles && invoice.invoiceFiles.length > 0) {
                        const uploadedUrls = await uploadFiles(invoice.invoiceFiles, 'invoices');
                        invoiceFileUrls = [...invoiceFileUrls, ...uploadedUrls];
                    }

                    const subtotal = invoice.items.reduce((sum, item) => sum + item.total, 0);
                    const total = subtotal + invoice.tax + invoice.tip;

                    return {
                        ...invoice,
                        invoiceFiles: invoiceFileUrls,
                        // Legacy field for backward compatibility
                        invoiceFile: invoiceFileUrls[0] || '',
                        subtotal,
                        total
                    };
                })
            );

            // Merge existing files with new uploads
            const finalRoomBookingUrls = editingRequest
                ? [...formData.existingRoomBookingFiles, ...roomBookingUrls]
                : roomBookingUrls;

            const finalOtherLogoUrls = editingRequest
                ? [...formData.existingOtherLogos, ...otherLogoUrls]
                : otherLogoUrls;

            // Create event request data
            const startDateTime = createSafeDateTime(formData.startDate, formData.startTime);
            const endDateTime = createSafeDateTime(formData.startDate, formData.endTime);

            const eventRequestData = {
                name: formData.name,
                location: formData.location,
                startDateTime,
                endDateTime,
                eventDescription: formData.eventDescription,
                department: formData.department,
                eventCode: formData.eventCode,
                pointsToReward: formData.pointsToReward,
                expectedAttendance: parseInt(formData.expectedAttendance) || 0,
                needsGraphics: formData.needsGraphics,
                flyersNeeded: formData.flyersNeeded,
                flyerType: formData.flyerType,
                otherFlyerType: formData.otherFlyerType,
                flyerAdvertisingStartDate: formData.flyerAdvertisingStartDate ? new Date(formData.flyerAdvertisingStartDate) : null,
                flyerAdditionalRequests: formData.flyerAdditionalRequests,
                flyersCompleted: formData.flyersCompleted,
                photographyNeeded: formData.photographyNeeded,
                requiredLogos: formData.requiredLogos,
                otherLogos: finalOtherLogoUrls,
                advertisingFormat: formData.advertisingFormat,
                additionalSpecifications: formData.additionalSpecifications,
                hasRoomBooking: formData.hasRoomBooking,
                roomBookingFiles: finalRoomBookingUrls,
                servingFoodDrinks: formData.servingFoodDrinks,
                needsAsFunding: formData.needsAsFunding,
                invoices: processedInvoices,
                // Legacy fields for backward compatibility
                itemizedInvoice: processedInvoices.length > 0 ? processedInvoices[0].items : [],
                invoiceTax: processedInvoices.length > 0 ? processedInvoices[0].tax : 0,
                invoiceTip: processedInvoices.length > 0 ? processedInvoices[0].tip : 0,
                invoiceVendor: processedInvoices.length > 0 ? processedInvoices[0].vendor : '',
                invoiceFile: processedInvoices.length > 0 ? processedInvoices[0].invoiceFile : '',
                status: editingRequest ? editingRequest.status : 'submitted',
                requestedUser: auth.currentUser?.uid || '',
                createdAt: editingRequest ? editingRequest.createdAt : new Date(),
                updatedAt: new Date()
            };

            let eventRequestRef;

            if (editingRequest) {
                // Update existing event request
                eventRequestRef = doc(db, 'event_requests', editingRequest.id);
                await updateDoc(eventRequestRef, eventRequestData);

                // Log event update
                try {
                    const userName = await EventAuditService.getUserName(auth.currentUser?.uid || '');
                    const fieldMappings = {
                        name: 'Event Name',
                        location: 'Location',
                        startDateTime: 'Start Date/Time',
                        endDateTime: 'End Date/Time',
                        eventDescription: 'Description',
                        department: 'Department',
                        expectedAttendance: 'Expected Attendance',
                        needsGraphics: 'Graphics Needed',
                        needsAsFunding: 'AS Funding Needed'
                    };
                    const changes = EventAuditService.generateFieldChanges(
                        originalData?._firestore || originalData,
                        eventRequestData,
                        fieldMappings
                    );

                    if (changes.length > 0) {
                        await EventAuditService.logEventUpdate(
                            editingRequest.id,
                            userName,
                            changes,
                            userName,
                            undefined,
                            { eventName: formData.name }
                        );
                    }
                } catch (error) {
                    console.error('Error logging event update:', error);
                }

                toast.success('Event request updated successfully!');
            } else {
                // Create new event request
                eventRequestRef = await addDoc(collection(db, 'event_requests'), eventRequestData);

                // Log event creation
                try {
                    const userName = await EventAuditService.getUserName(auth.currentUser?.uid || '');
                    await EventAuditService.logEventCreation(
                        (eventRequestRef as any).id,
                        userName,
                        userName,
                        { eventName: formData.name }
                    );
                } catch (error) {
                    console.error('Error logging event creation:', error);
                }

                toast.success('Event request submitted successfully!');
            }

            // Handle corresponding event in events collection
            const eventData = {
                eventName: formData.name,
                eventDescription: formData.eventDescription,
                startDate: startDateTime,
                endDate: endDateTime,
                location: formData.location,
                files: [],
                privateFiles: [],
                pointsToReward: formData.pointsToReward,
                createdFrom: editingRequest ? editingRequest.id : (eventRequestRef as any).id,
                status: 'draft'
            };

            if (editingRequest) {
                // Find and update corresponding event
                const eventsQuery = query(collection(db, 'events'), where('createdFrom', '==', editingRequest.id));
                const eventsSnapshot = await getDocs(eventsQuery);

                if (!eventsSnapshot.empty) {
                    const eventDoc = eventsSnapshot.docs[0];
                    const existingEventData = eventDoc.data();

                    const updatedEventData = {
                        ...eventData,
                        files: existingEventData.files || [],
                        privateFiles: existingEventData.privateFiles || [],
                    };

                    await updateDoc(eventDoc.ref, updatedEventData);
                } else {
                    await addDoc(collection(db, 'events'), eventData);
                }
            } else {
                await addDoc(collection(db, 'events'), eventData);
            }

            // Send email notification for new submissions
            if (!editingRequest) {
                try {
                    await EmailClient.notifyFirebaseEventRequestSubmission((eventRequestRef as any).id);
                } catch (error) {
                    console.error('Error sending email notification:', error);
                }
            }

            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Error submitting event request:', error);
            setError('Failed to submit event request. Please try again.');
            toast.error('Failed to submit event request');
        } finally {
            setLoading(false);
        }
    };

    const getSteps = () => {
        const baseSteps = [
            { title: 'Important Information', component: () => <DisclaimerSection /> },
            {
                title: 'Basic Information', component: () => (
                    <BasicInformationSection
                        formData={formData}
                        fieldErrors={fieldErrors}
                        onInputChange={handleInputChange}
                    />
                )
            },
            {
                title: 'Marketing & Graphics', component: () => (
                    <MarketingSection
                        formData={formData}
                        onInputChange={handleInputChange}
                        onArrayChange={handleArrayChange}
                        onFileChange={handleFileChange}
                        onRemoveExistingFile={handleRemoveExistingFile}
                        eventRequestId={editingRequest?.id}
                    />
                )
            },
            {
                title: 'Logistics', component: () => (
                    <LogisticsSection
                        formData={formData}
                        onInputChange={handleInputChange}
                        onRemoveExistingFile={handleRemoveExistingFile}
                        eventRequestId={editingRequest?.id}
                    />
                )
            }
        ];

        // Add funding step if needed
        if (formData.needsAsFunding) {
            baseSteps.push({
                title: 'Funding Details',
                component: () => (
                    <FundingSection
                        needsAsFunding={formData.needsAsFunding}
                        invoices={invoices}
                        invoiceTabState={invoiceTabState}
                        jsonImportData={jsonImportData}
                        activeInvoiceTab={activeInvoiceTab}
                        onAddInvoice={addInvoice}
                        onRemoveInvoice={removeInvoice}
                        onUpdateInvoice={updateInvoice}
                        onAddInvoiceItem={addInvoiceItem}
                        onRemoveInvoiceItem={removeInvoiceItem}
                        onUpdateInvoiceItem={(invoiceId: string, itemIndex: number, field: string, value: string | number) =>
                            updateInvoiceItem(invoiceId, itemIndex, field as keyof import('./types/EventRequestTypes').ItemizedInvoiceItem, value)
                        }
                        onHandleJsonImport={handleJsonImport}
                        onUpdateJsonImportData={updateJsonImportData}
                        onUpdateInvoiceTabState={updateInvoiceTabState}
                        onSetActiveInvoiceTab={setActiveInvoiceTab}
                        onRemoveExistingFile={handleRemoveExistingFile}
                        eventRequestId={editingRequest?.id}
                    />
                )
            });
        }

        // Add review step as the final step
        baseSteps.push({
            title: 'Review & Submit',
            component: () => (
                <EventReviewSection
                    formData={formData}
                    isInlineStep={true}
                    showRoomBookingWarning={true}
                    originalData={originalData}
                    isEditMode={!!editingRequest}
                    onConfirm={handleSubmit}
                    onCancel={onClose}
                    isSubmitting={loading}
                />
            )
        });

        return baseSteps;
    };

    const steps = getSteps();
    const isLastStep = currentStep === steps.length - 1;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {editingRequest ? 'Edit Event Request' : 'New Event Request'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        disabled={loading}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                            Step {currentStep + 1} of {steps.length}
                        </span>
                        <span className="text-sm text-gray-500">
                            {steps[currentStep]?.title}
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-800 text-sm">{error}</p>
                        </div>
                    )}

                    {steps[currentStep]?.component()}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={handlePrevious}
                        disabled={currentStep === 0 || loading}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        Previous
                    </button>

                    <div className="flex space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            Cancel
                        </button>

                        {isLastStep ? (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                            >
                                {loading && (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                )}
                                <span>{editingRequest ? 'Update Request' : 'Submit Request'}</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
                            >
                                Next
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
