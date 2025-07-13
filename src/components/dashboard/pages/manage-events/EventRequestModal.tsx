import React, { useState } from 'react';
import { X, Calendar, MapPin, FileText, Image, DollarSign, Upload, AlertTriangle } from 'lucide-react';
import { getFirestore, collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { app } from '../../../../firebase/client';
import { auth } from '../../../../firebase/client';

interface EventRequestModalProps {
    onClose: () => void;
}

interface ItemizedInvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

interface JsonInvoiceData {
    items: ItemizedInvoiceItem[];
    tax?: number;
    tip?: number;
    subtotal?: number;
    total?: number;
}

export default function EventRequestModal({ onClose }: EventRequestModalProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ [key: string]: boolean }>({});
    const [skipForm, setSkipForm] = useState(false);
    const [invoiceView, setInvoiceView] = useState<'interactive' | 'json'>('interactive');
    const [jsonInput, setJsonInput] = useState('');

    // Form data
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        startDate: '',
        startTime: '',
        endTime: '',
        eventDescription: '',
        flyersNeeded: false,
        flyerType: [] as string[],
        otherFlyerType: '',
        flyerAdvertisingStartDate: '',
        flyerAdditionalRequests: '',
        flyersCompleted: false,
        photographyNeeded: false,
        requiredLogos: [] as string[],
        otherLogos: [] as string[],
        otherLogoFiles: [] as File[],
        advertisingFormat: '',
        additionalSpecifications: '',
        hasRoomBooking: true,
        roomBookingFile: null as File | null,
        expectedAttendance: '',
        servingFoodDrinks: false,
        needsAsFunding: false,
        itemizedInvoice: [] as ItemizedInvoiceItem[],
        invoiceTax: 0,
        invoiceTip: 0,
        invoice: null as File | null,
        invoiceFiles: [] as File[],
        needsGraphics: false
    });

    const db = getFirestore(app);
    const storage = getStorage(app);

    const flyerTypes = [
        'Digital flyer (with social media advertising: Facebook, Instagram, Discord)',
        'Digital flyer (with NO social media advertising)',
        'Physical flyer (with advertising)',
        'Physical flyer (with NO advertising)',
        'Newsletter (IEEE, ECE, IDEA)',
        'Other'
    ];

    const logoTypes = ['IEEE', 'AS (required if funded by AS)', 'HKN', 'TESC', 'PIB', 'TNT', 'SWE', 'OTHER (please upload transparent logo files)'];
    const formatTypes = ['PDF', 'JPEG', 'PNG', "Doesn't Matter"];
    const eventTypes = ['social', 'technical', 'outreach', 'professional', 'projects', 'other'];

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
        // Clear field error when user starts typing
        if (fieldErrors[field]) {
            setFieldErrors(prev => ({ ...prev, [field]: false }));
        }
    };

    const handleArrayChange = (field: string, value: string, checked: boolean) => {
        setFormData(prev => ({
            ...prev,
            [field]: checked
                ? [...(prev[field as keyof typeof prev] as string[]), value]
                : (prev[field as keyof typeof prev] as string[]).filter(item => item !== value)
        }));
    };

    const handleFileChange = (field: string, files: FileList | null) => {
        if (files) {
            setFormData(prev => ({ ...prev, [field]: Array.from(files) }));
        }
    };

    const addInvoiceItem = () => {
        setFormData(prev => ({
            ...prev,
            itemizedInvoice: [...prev.itemizedInvoice, { description: '', quantity: 1, unitPrice: 0, total: 0 }]
        }));
    };

    const updateInvoiceItem = (index: number, field: keyof ItemizedInvoiceItem, value: string | number) => {
        setFormData(prev => ({
            ...prev,
            itemizedInvoice: prev.itemizedInvoice.map((item, i) => {
                if (i === index) {
                    const updated = { ...item, [field]: value };
                    if (field === 'quantity' || field === 'unitPrice') {
                        updated.total = updated.quantity * updated.unitPrice;
                    }
                    return updated;
                }
                return item;
            })
        }));
    };

    const removeInvoiceItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            itemizedInvoice: prev.itemizedInvoice.filter((_, i) => i !== index)
        }));
    };

    const calculateBudget = (attendance: number) => {
        const perPersonCost = 10;
        const maxBudget = 5000;
        const calculatedBudget = attendance * perPersonCost;
        const actualBudget = Math.min(calculatedBudget, maxBudget);

        return {
            calculatedBudget,
            actualBudget,
            isCapReached: calculatedBudget > maxBudget,
            perPersonCost,
            maxBudget
        };
    };

    const importJsonInvoice = (jsonText: string) => {
        try {
            const jsonData: JsonInvoiceData = JSON.parse(jsonText);

            if (jsonData.items && Array.isArray(jsonData.items)) {
                setFormData(prev => ({
                    ...prev,
                    itemizedInvoice: jsonData.items.map(item => ({
                        description: item.description || '',
                        quantity: item.quantity || 1,
                        unitPrice: item.unitPrice || 0,
                        total: (item.quantity || 1) * (item.unitPrice || 0)
                    })),
                    invoiceTax: jsonData.tax || 0,
                    invoiceTip: jsonData.tip || 0
                }));
                setJsonInput('');
                setInvoiceView('interactive');
                setError(null);
            }
        } catch (error) {
            setError('Failed to import JSON data. Please check the file format.');
        }
    };

    const getSampleJson = () => {
        return JSON.stringify({
            items: [
                {
                    description: "Pizza for event",
                    quantity: 5,
                    unitPrice: 15.99
                },
                {
                    description: "Drinks",
                    quantity: 20,
                    unitPrice: 2.50
                }
            ],
            tax: 8.75,
            tip: 12.00
        }, null, 2);
    };

    const handleJsonSubmit = () => {
        if (formData.itemizedInvoice.length > 0) {
            if (confirm('This will override any existing invoice data. Are you sure you want to continue?')) {
                importJsonInvoice(jsonInput);
            }
        } else {
            importJsonInvoice(jsonInput);
        }
    };

    const uploadFiles = async (files: File[], path: string): Promise<string[]> => {
        const uploadPromises = files.map(async (file) => {
            const storageRef = ref(storage, `${path}/${auth.currentUser?.uid}/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);
            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', null, reject, () => resolve(uploadTask.snapshot.ref));
            });
            return await getDownloadURL(storageRef);
        });
        return await Promise.all(uploadPromises);
    };

    const validateStep = (step: number) => {
        setError(null);
        const errors: { [key: string]: boolean } = {};

        switch (step) {
            case 0: // Important Information (requirements) - no validation needed
                break;

            case 1: // Basic Information
                const errorMessages: string[] = [];

                if (!formData.name) {
                    errors.name = true;
                    errorMessages.push('Event name is required');
                }
                if (!formData.location) {
                    errors.location = true;
                    errorMessages.push('Event location is required');
                }
                if (!formData.startDate) {
                    errors.startDate = true;
                    errorMessages.push('Event start date is required');
                }
                if (!formData.startTime) {
                    errors.startTime = true;
                    errorMessages.push('Event start time is required');
                }
                if (!formData.endTime) {
                    errors.endTime = true;
                    errorMessages.push('Event end time is required');
                }
                if (formData.startDate && formData.startTime && formData.endTime) {
                    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
                    const endDateTime = new Date(`${formData.startDate}T${formData.endTime}`);
                    if (endDateTime <= startDateTime) {
                        errors.endTime = true;
                        errorMessages.push('End time must be after start time');
                    }
                }
                if (!formData.eventDescription) {
                    errors.eventDescription = true;
                    errorMessages.push('Event description is required');
                }

                if (Object.keys(errors).length > 0) {
                    setFieldErrors(errors);
                    setError(errorMessages.join(', '));
                    return false;
                }
                break;

            case 2: // Marketing & Graphics
                if (formData.needsGraphics) {
                    if (formData.flyerType.length === 0) {
                        setError('Please select at least one flyer type when graphics are needed');
                        return false;
                    }
                    if (formData.flyerType.includes('Other') && !formData.otherFlyerType) {
                        setError('Please specify the other flyer type');
                        return false;
                    }
                    if (formData.requiredLogos.length === 0) {
                        setError('Please select at least one logo when graphics are needed');
                        return false;
                    }
                    if (formData.requiredLogos.includes('OTHER (please upload transparent logo files)') && formData.otherLogoFiles.length === 0) {
                        setError('Please upload logo files for "OTHER" selection');
                        return false;
                    }
                    if (!formData.advertisingFormat) {
                        setError('Please select a format for the materials');
                        return false;
                    }
                    if (formData.flyerType.length > 0 && !formData.flyerAdvertisingStartDate) {
                        setError('Flyer advertising start date is required');
                        return false;
                    }
                }
                // If graphics not needed, no validation required for this step
                break;

            case 3: // Logistics
                // Room booking validation
                if (formData.hasRoomBooking === undefined || formData.hasRoomBooking === null) {
                    setError('Please answer whether you have a room booking');
                    return false;
                }
                if (formData.hasRoomBooking && !formData.roomBookingFile) {
                    setError('Please upload room booking confirmation');
                    return false;
                }
                if (formData.roomBookingFile && formData.roomBookingFile.size > 1024 * 1024) {
                    setError('Room booking file must be under 1MB');
                    return false;
                }

                // Attendance validation
                if (!formData.expectedAttendance) {
                    setError('Expected attendance is required');
                    return false;
                }

                // Food/drinks validation
                if (formData.servingFoodDrinks === undefined || formData.servingFoodDrinks === null) {
                    setError('Please answer whether you will be serving food or drinks');
                    return false;
                }

                // Only validate AS funding if they're serving food/drinks
                if (formData.servingFoodDrinks && (formData.needsAsFunding === undefined || formData.needsAsFunding === null)) {
                    setError('Please answer whether you need AS funding');
                    return false;
                }
                break;

            case 4: // Funding & Invoices (only if AS funding needed)
                // This step only appears if AS funding is needed, so validate accordingly
                if (formData.needsAsFunding) {
                    const fundingErrorMessages: string[] = [];

                    if (!formData.invoice) {
                        errors.invoice = true;
                        fundingErrorMessages.push('Invoice upload is required for AS funding');
                    }
                    // Could add validation for itemized invoice if needed

                    if (Object.keys(errors).length > 0) {
                        setFieldErrors(errors);
                        setError(fundingErrorMessages.join(', '));
                        return false;
                    }
                }
                break;
        }

        return true;
    };

    const validateGraphicsSection = () => {
        return validateStep(2);
    };

    const handleSubmit = async () => {
        // Validate required fields
        if (!formData.name || !formData.location || !formData.startDate || !formData.startTime || !formData.endTime || !formData.eventDescription) {
            setError('Please fill in all required fields');
            return;
        }

        // Validate end time is after start time
        const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
        const endDateTime = new Date(`${formData.startDate}T${formData.endTime}`);
        if (endDateTime <= startDateTime) {
            setError('End time must be after start time');
            return;
        }

        // Validate room booking file if required
        if (formData.hasRoomBooking && !formData.roomBookingFile) {
            setError('Please upload room booking confirmation');
            return;
        }

        // Validate file size for room booking
        if (formData.roomBookingFile && formData.roomBookingFile.size > 1024 * 1024) {
            setError('Room booking file must be under 1MB');
            return;
        }

        // Validate food/drinks question is answered
        if (formData.servingFoodDrinks === undefined || formData.servingFoodDrinks === null) {
            setError('Please answer whether you will be serving food or drinks');
            return;
        }

        // Validate AS funding question if serving food/drinks
        if (formData.servingFoodDrinks && (formData.needsAsFunding === undefined || formData.needsAsFunding === null)) {
            setError('Please answer whether you need AS funding');
            return;
        }

        // Validate invoice upload if AS funding is needed
        if (formData.needsAsFunding && !formData.invoice) {
            setError('Please upload an invoice for AS funding');
            return;
        }

        // Validate flyer advertising start date if graphics are needed
        if (formData.needsGraphics && formData.flyerType.length > 0 && !formData.flyerAdvertisingStartDate) {
            setError('Please provide the flyer advertising start date');
            return;
        }

        if (!validateGraphicsSection()) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Upload files
            let roomBookingUrls: string[] = [];
            let invoiceUrls: string[] = [];
            let invoiceUrl = '';
            let otherLogoUrls: string[] = [];

            if (formData.roomBookingFile) {
                roomBookingUrls = await uploadFiles([formData.roomBookingFile], 'room_bookings');
            }

            if (formData.invoiceFiles.length > 0) {
                invoiceUrls = await uploadFiles(formData.invoiceFiles, 'invoices');
            }

            if (formData.invoice) {
                const [url] = await uploadFiles([formData.invoice], 'invoices');
                invoiceUrl = url;
            }

            if (formData.otherLogoFiles.length > 0) {
                otherLogoUrls = await uploadFiles(formData.otherLogoFiles, 'logos');
            }

            // Create event request
            const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
            const endDateTime = new Date(`${formData.startDate}T${formData.endTime}`);

            const eventRequestData = {
                name: formData.name,
                location: formData.location,
                startDateTime: startDateTime,
                endDateTime: endDateTime,
                eventDescription: formData.eventDescription,
                flyersNeeded: formData.flyersNeeded,
                flyerType: formData.flyerType,
                otherFlyerType: formData.otherFlyerType,
                flyerAdvertisingStartDate: formData.flyerAdvertisingStartDate ? new Date(formData.flyerAdvertisingStartDate) : null,
                flyerAdditionalRequests: formData.flyerAdditionalRequests,
                flyersCompleted: formData.flyersCompleted,
                photographyNeeded: formData.photographyNeeded,
                requiredLogos: formData.requiredLogos,
                otherLogos: otherLogoUrls,
                advertisingFormat: formData.advertisingFormat,
                additionalSpecifications: formData.additionalSpecifications,
                hasRoomBooking: formData.hasRoomBooking,
                expectedAttendance: formData.expectedAttendance ? parseInt(formData.expectedAttendance) : null,
                roomBookingFiles: roomBookingUrls,
                servingFoodDrinks: formData.servingFoodDrinks,
                itemizedInvoice: formData.itemizedInvoice,
                invoiceTax: formData.invoiceTax,
                invoiceTip: formData.invoiceTip,
                invoice: invoiceUrl,
                invoiceFiles: invoiceUrls,
                needsGraphics: formData.needsGraphics,
                needsAsFunding: formData.needsAsFunding,
                status: 'submitted',
                requestedUser: auth.currentUser?.uid,
                createdAt: new Date()
            };

            const eventRequestRef = await addDoc(collection(db, 'event_requests'), eventRequestData);

            // Create draft event
            const eventData = {
                eventName: formData.name,
                eventDescription: formData.eventDescription,
                eventCode: `EVT-${Date.now()}`,
                location: formData.location,
                files: [],
                pointsToReward: 0,
                startDate: startDateTime,
                endDate: endDateTime,
                published: false,
                eventType: 'other' as const,
                hasFood: formData.servingFoodDrinks,
                createdFrom: eventRequestRef.id,
                createdAt: new Date()
            };

            await addDoc(collection(db, 'events'), eventData);

            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSkipForm = async () => {
        try {
            // Create basic event directly
            const eventData = {
                eventName: 'New Event',
                eventDescription: '',
                eventCode: `EVT-${Date.now()}`,
                location: '',
                files: [],
                pointsToReward: 0,
                startDate: new Date(),
                endDate: new Date(),
                published: false,
                eventType: 'other' as const,
                hasFood: false,
                createdAt: new Date()
            };

            await addDoc(collection(db, 'events'), eventData);
            onClose();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const renderDisclaimer = () => (
        <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 className="font-medium text-yellow-800 mb-2">Important Information</h4>
                        <div className="text-sm text-yellow-700 space-y-2">
                            <p><strong>Timeline:</strong> If you need PR Materials, please don't forget that this form MUST be submitted at least 6 weeks in advance even if you aren't requesting AS funding or physical flyers. Also, please remember to ping PR in #-events on Slack once you've submitted this form.</p>

                            <p><strong>WARNING:</strong> If you need a booking and submit without one, your event WILL BE CANCELLED. This is non-negotiable. Contact the event coordinator immediately if you have any booking concerns.</p>

                            <p><strong>Note:</strong> For multi-day events, please submit a separate request for each day.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="text-center">
                <p className="text-gray-600 mb-4">
                    Please read all requirements above before proceeding.
                </p>
            </div>
        </div>
    );

    const renderBasicInfo = () => (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${fieldErrors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                            }`}
                        placeholder="Enter event name"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Location <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${fieldErrors.location ? 'border-red-500 bg-red-50' : 'border-gray-300'
                            }`}
                        placeholder="Enter event location"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Event Start Date <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-2">Date of the event</p>
                        <input
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => handleInputChange('startDate', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${fieldErrors.startDate ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                }`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Start Time <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-2">The event time should not include setup time.</p>
                        <input
                            type="time"
                            value={formData.startTime}
                            onChange={(e) => handleInputChange('startTime', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${fieldErrors.startTime ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                }`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            End Time <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-2">When does the event end?</p>
                        <input
                            type="time"
                            value={formData.endTime}
                            onChange={(e) => handleInputChange('endTime', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${fieldErrors.endTime ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                }`}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={formData.eventDescription}
                        onChange={(e) => handleInputChange('eventDescription', e.target.value)}
                        rows={4}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${fieldErrors.eventDescription ? 'border-red-500 bg-red-50' : 'border-gray-300'
                            }`}
                        placeholder="Describe your event"
                    />
                </div>
            </div>
        </div>
    );

    const renderMarketingSection = () => (
        <div className="space-y-6">
            <div className="flex items-center space-x-3">
                <input
                    type="checkbox"
                    id="needsGraphics"
                    checked={formData.needsGraphics}
                    onChange={(e) => handleInputChange('needsGraphics', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="needsGraphics" className="text-sm font-medium text-gray-700">
                    I need graphics from the design team
                </label>
            </div>

            {formData.needsGraphics && (
                <div className="space-y-4 pl-7">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Select flyer types needed <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-2">
                            {flyerTypes.map(type => (
                                <label key={type} className="flex items-start space-x-3">
                                    <input
                                        type="checkbox"
                                        checked={formData.flyerType.includes(type)}
                                        onChange={(e) => handleArrayChange('flyerType', type, e.target.checked)}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                                    />
                                    <span className="text-sm text-gray-700 leading-5">{type}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {formData.flyerType.includes('Other') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Specify other flyer type</label>
                            <input
                                type="text"
                                value={formData.otherFlyerType}
                                onChange={(e) => handleInputChange('otherFlyerType', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                                placeholder="Specify other flyer type"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Select logos needed <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-2">
                            {logoTypes.map(logo => (
                                <label key={logo} className="flex items-start space-x-3">
                                    <input
                                        type="checkbox"
                                        checked={formData.requiredLogos.includes(logo)}
                                        onChange={(e) => handleArrayChange('requiredLogos', logo, e.target.checked)}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5"
                                    />
                                    <span className="text-sm text-gray-700 leading-5">{logo}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {formData.requiredLogos.includes('OTHER (please upload transparent logo files)') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Upload logo files</label>
                            <input
                                type="file"
                                multiple
                                accept=".png,.jpg,.jpeg,.svg"
                                onChange={(e) => handleFileChange('otherLogoFiles', e.target.files)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                            <p className="text-xs text-gray-500 mt-1">Please upload transparent PNG or SVG files for best quality</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Format of materials <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-2">
                            {formatTypes.map(format => (
                                <label key={format} className="flex items-center space-x-3">
                                    <input
                                        type="radio"
                                        name="advertisingFormat"
                                        value={format}
                                        checked={formData.advertisingFormat === format}
                                        onChange={(e) => handleInputChange('advertisingFormat', e.target.value)}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                    />
                                    <span className="text-sm text-gray-700">{format}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Additional specifications</label>
                        <textarea
                            value={formData.additionalSpecifications}
                            onChange={(e) => handleInputChange('additionalSpecifications', e.target.value)}
                            rows={3}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                            placeholder="Any additional requirements or specifications"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Advertising start date</label>
                        <input
                            type="datetime-local"
                            value={formData.flyerAdvertisingStartDate}
                            onChange={(e) => handleInputChange('flyerAdvertisingStartDate', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center space-x-3">
                <input
                    type="checkbox"
                    id="photographyNeeded"
                    checked={formData.photographyNeeded}
                    onChange={(e) => handleInputChange('photographyNeeded', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="photographyNeeded" className="text-sm font-medium text-gray-700">
                    Photography needed
                </label>
            </div>
        </div>
    );

    const renderLogisticsSection = () => {
        const attendance = parseInt(formData.expectedAttendance) || 0;
        const budget = calculateBudget(attendance);

        return (
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Do you have a room booking? <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-3">
                            <input
                                type="radio"
                                name="hasRoomBooking"
                                checked={formData.hasRoomBooking === true}
                                onChange={() => handleInputChange('hasRoomBooking', true)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Yes</span>
                        </label>
                        <label className="flex items-center space-x-3">
                            <input
                                type="radio"
                                name="hasRoomBooking"
                                checked={formData.hasRoomBooking === false}
                                onChange={() => handleInputChange('hasRoomBooking', false)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <span className="text-sm text-gray-700">No</span>
                        </label>
                    </div>

                    {formData.hasRoomBooking === false && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-start space-x-2">
                                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-red-800">Warning</p>
                                    <p className="text-sm text-red-700">
                                        Events without room bookings will most likely be canceled. Please secure a room booking before submitting your request.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {formData.hasRoomBooking && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Upload room booking confirmation <span className="text-red-500">*</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-2">PDF or image file under 1MB</p>
                        <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleInputChange('roomBookingFile', e.target.files?.[0] || null)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expected attendance <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number"
                        value={formData.expectedAttendance}
                        onChange={(e) => handleInputChange('expectedAttendance', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        placeholder="Number of expected attendees"
                    />

                    {attendance > 0 && (
                        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-900 mb-2">Budget Calculator</h4>
                            <p className="text-sm text-blue-800">
                                ${budget.perPersonCost} per person × {attendance} people
                            </p>
                            <p className="text-sm text-blue-800 font-medium">
                                You cannot exceed spending past ${budget.actualBudget.toLocaleString()} dollars.
                            </p>
                            {budget.isCapReached && (
                                <p className="text-sm text-orange-700 font-medium mt-1">
                                    Budget cap reached. Maximum budget is ${budget.maxBudget.toLocaleString()} regardless of attendance.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Will you be serving food or drinks at your event?
                    </label>
                    <div className="space-y-3">
                        <label className="flex items-center space-x-3">
                            <input
                                type="radio"
                                name="servingFoodDrinks"
                                checked={formData.servingFoodDrinks === true}
                                onChange={() => handleInputChange('servingFoodDrinks', true)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Yes</span>
                        </label>
                        <label className="flex items-center space-x-3">
                            <input
                                type="radio"
                                name="servingFoodDrinks"
                                checked={formData.servingFoodDrinks === false}
                                onChange={() => handleInputChange('servingFoodDrinks', false)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <span className="text-sm text-gray-700">No</span>
                        </label>
                    </div>
                </div>

                {formData.servingFoodDrinks && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Do you need funding from AS?
                        </label>
                        <div className="space-y-3">
                            <label className="flex items-center space-x-3">
                                <input
                                    type="radio"
                                    name="needsAsFunding"
                                    checked={formData.needsAsFunding === true}
                                    onChange={() => handleInputChange('needsAsFunding', true)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                                <span className="text-sm text-gray-700">Yes</span>
                            </label>
                            <label className="flex items-center space-x-3">
                                <input
                                    type="radio"
                                    name="needsAsFunding"
                                    checked={formData.needsAsFunding === false}
                                    onChange={() => handleInputChange('needsAsFunding', false)}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                                <span className="text-sm text-gray-700">No</span>
                            </label>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderFundingSection = () => {
        if (!formData.needsAsFunding) {
            return (
                <div className="text-center py-8">
                    <p className="text-gray-600">No AS funding required for this event.</p>
                </div>
            );
        }

        const subtotal = formData.itemizedInvoice.reduce((sum, item) => sum + item.total, 0);
        const total = subtotal + formData.invoiceTax + formData.invoiceTip;

        return (
            <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-blue-900 mb-2">AS Funding Details</h3>
                    <p className="text-sm text-blue-800">
                        Please provide detailed invoice information for AS funding approval.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Invoice <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.png"
                        onChange={(e) => handleInputChange('invoice', e.target.files?.[0] || null)}
                        className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 ${fieldErrors.invoice ? 'border-red-500 bg-red-50' : 'border-gray-300'
                            }`}
                    />
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                        <label className="block text-sm font-medium text-gray-700">Itemized Invoice</label>
                        <div className="flex space-x-3">
                            <button
                                type="button"
                                onClick={() => setInvoiceView(invoiceView === 'interactive' ? 'json' : 'interactive')}
                                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                            >
                                {invoiceView === 'interactive' ? '📝 JSON View' : '🔧 Interactive View'}
                            </button>
                            {invoiceView === 'interactive' && (
                                <button
                                    type="button"
                                    onClick={addInvoiceItem}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    + Add Item
                                </button>
                            )}
                        </div>
                    </div>

                    {invoiceView === 'interactive' ? (
                        <div className="space-y-3">
                            {/* Column headers */}
                            <div className="grid grid-cols-12 gap-3 p-3 bg-gray-100 border border-gray-300 rounded-lg">
                                <div className="col-span-4">
                                    <span className="text-sm font-medium text-gray-700">Description</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-sm font-medium text-gray-700">Quantity</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-sm font-medium text-gray-700">Unit Price</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-sm font-medium text-gray-700">Total</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-sm font-medium text-gray-700">Action</span>
                                </div>
                            </div>

                            {formData.itemizedInvoice.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                                    <div className="col-span-4">
                                        <input
                                            type="text"
                                            placeholder="Description"
                                            value={item.description}
                                            onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            type="number"
                                            placeholder="Qty"
                                            value={item.quantity}
                                            onChange={(e) => updateInvoiceItem(index, 'quantity', parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Unit Price"
                                            value={item.unitPrice}
                                            onChange={(e) => updateInvoiceItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Total"
                                            value={item.total.toFixed(2)}
                                            readOnly
                                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-50"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <button
                                            type="button"
                                            onClick={() => removeInvoiceItem(index)}
                                            className="w-full text-red-600 hover:text-red-700 text-sm font-medium"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-700">Paste JSON Data</span>
                                <button
                                    type="button"
                                    onClick={() => setJsonInput(getSampleJson())}
                                    className="text-sm text-green-600 hover:text-green-700 font-medium"
                                >
                                    📋 Paste Sample
                                </button>
                            </div>
                            <textarea
                                value={jsonInput}
                                onChange={(e) => setJsonInput(e.target.value)}
                                placeholder="Paste your JSON invoice data here..."
                                rows={10}
                                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                            />
                            <button
                                type="button"
                                onClick={handleJsonSubmit}
                                disabled={!jsonInput.trim()}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Import JSON Data
                            </button>
                        </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tax ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.invoiceTax}
                                    onChange={(e) => handleInputChange('invoiceTax', parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Tip ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.invoiceTip}
                                    onChange={(e) => handleInputChange('invoiceTip', parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="bg-white border border-gray-300 rounded-lg p-3">
                            <div className="flex justify-between text-sm">
                                <span>Subtotal:</span>
                                <span>${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Tax:</span>
                                <span>${formData.invoiceTax.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>Tip:</span>
                                <span>${formData.invoiceTip.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-semibold border-t border-gray-200 pt-2 mt-2">
                                <span>Total:</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Additional Files</label>
                    <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.png"
                        onChange={(e) => handleFileChange('invoiceFiles', e.target.files)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                </div>
            </div>
        );
    };

    const renderReviewSection = () => {
        const startDateTime = formData.startDate && formData.startTime ?
            new Date(`${formData.startDate}T${formData.startTime}`) : null;
        const endDateTime = formData.startDate && formData.endTime ?
            new Date(`${formData.startDate}T${formData.endTime}`) : null;

        return (
            <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-blue-900 mb-2">Review Your Event Request</h3>
                    <p className="text-sm text-blue-800">
                        Please review all the information below before submitting your event request.
                    </p>
                </div>

                {/* Basic Information */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Basic Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="font-medium text-gray-700">Event Name:</span>
                            <p className="text-gray-900">{formData.name || 'Not specified'}</p>
                        </div>
                        <div>
                            <span className="font-medium text-gray-700">Location:</span>
                            <p className="text-gray-900">{formData.location || 'Not specified'}</p>
                        </div>
                        <div>
                            <span className="font-medium text-gray-700">Date:</span>
                            <p className="text-gray-900">{formData.startDate ? new Date(formData.startDate).toLocaleDateString() : 'Not specified'}</p>
                        </div>
                        <div>
                            <span className="font-medium text-gray-700">Time:</span>
                            <p className="text-gray-900">
                                {formData.startTime && formData.endTime ?
                                    `${formData.startTime} - ${formData.endTime}` : 'Not specified'}
                            </p>
                        </div>
                        <div className="md:col-span-2">
                            <span className="font-medium text-gray-700">Description:</span>
                            <p className="text-gray-900 mt-1">{formData.eventDescription || 'Not specified'}</p>
                        </div>
                    </div>
                </div>

                {/* Graphics & Marketing */}
                {formData.needsGraphics && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="text-md font-semibold text-gray-900 mb-3">Graphics & Marketing</h4>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="font-medium text-gray-700">Graphics Needed:</span>
                                <p className="text-gray-900">Yes</p>
                            </div>
                            {formData.flyerType.length > 0 && (
                                <div>
                                    <span className="font-medium text-gray-700">Flyer Types:</span>
                                    <ul className="text-gray-900 mt-1 list-disc list-inside">
                                        {formData.flyerType.map((type, index) => (
                                            <li key={index}>{type}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {formData.requiredLogos.length > 0 && (
                                <div>
                                    <span className="font-medium text-gray-700">Required Logos:</span>
                                    <ul className="text-gray-900 mt-1 list-disc list-inside">
                                        {formData.requiredLogos.map((logo, index) => (
                                            <li key={index}>{logo}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {formData.advertisingFormat && (
                                <div>
                                    <span className="font-medium text-gray-700">Format:</span>
                                    <p className="text-gray-900">{formData.advertisingFormat}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Logistics */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Logistics</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="font-medium text-gray-700">Room Booking:</span>
                            <p className="text-gray-900">{formData.hasRoomBooking ? 'Yes' : 'No'}</p>
                        </div>
                        <div>
                            <span className="font-medium text-gray-700">Expected Attendance:</span>
                            <p className="text-gray-900">{formData.expectedAttendance || 'Not specified'}</p>
                        </div>
                        <div>
                            <span className="font-medium text-gray-700">Serving Food/Drinks:</span>
                            <p className="text-gray-900">{formData.servingFoodDrinks ? 'Yes' : 'No'}</p>
                        </div>
                        {formData.servingFoodDrinks && (
                            <div>
                                <span className="font-medium text-gray-700">AS Funding Needed:</span>
                                <p className="text-gray-900">{formData.needsAsFunding ? 'Yes' : 'No'}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Funding Information */}
                {formData.needsAsFunding && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="text-md font-semibold text-gray-900 mb-3">Funding & Invoices</h4>
                        <div className="space-y-3 text-sm">
                            <div>
                                <span className="font-medium text-gray-700">Invoice Uploaded:</span>
                                <p className="text-gray-900">{formData.invoice ? 'Yes' : 'No'}</p>
                            </div>
                            {formData.itemizedInvoice.length > 0 && (
                                <div>
                                    <span className="font-medium text-gray-700">Itemized Invoice:</span>
                                    <div className="mt-2 bg-gray-50 rounded-lg p-3">
                                        {formData.itemizedInvoice.map((item, index) => (
                                            <div key={index} className="flex justify-between">
                                                <span>{item.description}</span>
                                                <span>{item.quantity} × ${item.unitPrice} = ${item.total.toFixed(2)}</span>
                                            </div>
                                        ))}
                                        <div className="border-t border-gray-200 pt-2 mt-2 font-medium">
                                            <div className="flex justify-between">
                                                <span>Total:</span>
                                                <span>${(formData.itemizedInvoice.reduce((sum, item) => sum + item.total, 0) + formData.invoiceTax + formData.invoiceTip).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const getSteps = () => {
        const baseSteps = [
            { title: 'Important Information', component: renderDisclaimer },
            { title: 'Basic Information', component: renderBasicInfo },
            { title: 'Marketing & Graphics', component: renderMarketingSection },
            { title: 'Logistics', component: renderLogisticsSection }
        ];

        if (formData.needsAsFunding) {
            baseSteps.push({ title: 'Funding & Invoices', component: renderFundingSection });
        }

        // Always add review as the last step
        baseSteps.push({ title: 'Review & Submit', component: renderReviewSection });

        return baseSteps;
    };

    const steps = getSteps();

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Create Event Request</h2>
                        <p className="text-sm text-gray-600">Fill out the form to request a new event</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Skip Option */}
                {currentStep > 0 && (
                    <div className="px-6 py-3 bg-yellow-50 border-b border-yellow-200">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-yellow-800">
                                Want to skip the request form? You can create a basic event directly, but using the request form is recommended.
                            </p>
                            <button
                                onClick={handleSkipForm}
                                className="text-sm text-yellow-700 hover:text-yellow-800 underline font-medium"
                            >
                                Skip Form
                            </button>
                        </div>
                    </div>
                )}

                {/* Progress */}
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                        <span>Step {currentStep + 1} of {steps.length}</span>
                        <span>{Math.round(((currentStep + 1) / steps.length) * 100)}% Complete</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto" style={{ maxHeight: '60vh' }}>
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{steps[currentStep].title}</h3>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-red-700 text-sm">{error}</p>
                        </div>
                    )}

                    {steps[currentStep].component()}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-200">
                    <button
                        onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                        disabled={currentStep === 0}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Previous
                    </button>

                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>

                        {currentStep === steps.length - 1 ? (
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {loading ? 'Submitting...' : 'Submit Request'}
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    // No validation needed for step 0 (requirements)
                                    if (currentStep === 0 || validateStep(currentStep)) {
                                        setCurrentStep(Math.min(steps.length - 1, currentStep + 1));
                                    }
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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