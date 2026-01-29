import { useState, useEffect, useCallback } from 'react';
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Textarea,
    Select,
    SelectItem,
    Progress,
    Chip,
    Card,
    CardBody,
    Divider,
} from '@heroui/react';
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    X,
    Link as LinkIcon,
    DollarSign,
    FileText,
    Upload,
    Check,
    AlertCircle,
    Calendar,
    Briefcase,
    Tag,
} from 'lucide-react';
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    Timestamp,
    serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../../../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import type {
    FundRequest,
    FundRequestCategory,
    FundRequestDepartment,
    VendorLink,
    FundRequestAttachment,
} from '../../../shared/types/fund-requests';
import { CATEGORY_LABELS, DEPARTMENT_LABELS } from '../../../shared/types/fund-requests';
import MultiFileUpload from '../../fund-deposits/components/MultiFileUpload';
import { showToast } from '../../../shared/utils/toast';

interface FundRequestFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    request?: FundRequest | null;
    isEditMode?: boolean;
}

const STEPS = [
    { id: 1, title: 'Basic Info', description: 'Details' },
    { id: 2, title: 'Budget', description: 'Costs' },
    { id: 3, title: 'Attachments', description: 'Files' },
    { id: 4, title: 'Review', description: 'Submit' },
];

const isValidUrl = (string: string): boolean => {
    try {
        new URL(string);
        return true;
    } catch {
        return false;
    }
};

export default function FundRequestFormModal({
    isOpen,
    onClose,
    onSuccess,
    request,
    isEditMode = false,
}: FundRequestFormModalProps) {
    const [user] = useAuthState(auth);
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [purpose, setPurpose] = useState('');
    const [category, setCategory] = useState<FundRequestCategory>('event');
    const [department, setDepartment] = useState<FundRequestDepartment>('events');
    const [amount, setAmount] = useState('');
    const [vendorLinks, setVendorLinks] = useState<VendorLink[]>([]);
    const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
    const [existingAttachments, setExistingAttachments] = useState<string[]>([]);
    const [infoResponseNotes, setInfoResponseNotes] = useState('');

    // Validation state
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Initialize form with existing request data
    useEffect(() => {
        if (request && isEditMode) {
            setTitle(request.title);
            setPurpose(request.purpose);
            setCategory(request.category);
            setDepartment(request.department || 'events');
            setAmount(request.amount.toString());
            setVendorLinks(request.vendorLinks || []);
            setExistingAttachments(request.attachments?.map((a) => a.url) || []);
            setInfoResponseNotes(request.infoResponseNotes || '');
        } else {
            resetForm();
        }
    }, [request, isEditMode, isOpen]);

    const resetForm = () => {
        setCurrentStep(1);
        setTitle('');
        setPurpose('');
        setCategory('event');
        setDepartment('events');
        setAmount('');
        setVendorLinks([]);
        setAttachmentFiles([]);
        setExistingAttachments([]);
        setInfoResponseNotes('');
        setErrors({});
    };

    const validateStep = (step: number): boolean => {
        const newErrors: Record<string, string> = {};

        switch (step) {
            case 1:
                if (!title.trim()) newErrors.title = 'Title is required';
                if (!purpose.trim()) newErrors.purpose = 'Purpose/justification is required';
                break;
            case 2:
                if (!amount || parseFloat(amount) <= 0) {
                    newErrors.amount = 'Valid budget amount is required';
                }
                break;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
        }
    };

    const handlePrevStep = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };

    // Initialize with one empty row if needed
    useEffect(() => {
        if (!isOpen) return;

        // If we are opening unrelated to a specific request (new request)
        // or if the request has no links, ensure one empty row
        setVendorLinks(prev => {
            if (prev.length === 0) {
                return [{
                    id: crypto.randomUUID(),
                    url: '',
                    itemName: '',
                    quantity: 1,
                }];
            }
            // Ensure last row is empty
            const lastLink = prev[prev.length - 1];
            if (lastLink.url?.trim() || lastLink.itemName?.trim()) {
                return [...prev, {
                    id: crypto.randomUUID(),
                    url: '',
                    itemName: '',
                    quantity: 1,
                }];
            }
            return prev;
        });
    }, [isOpen]);

    // Handle inline link editing - updates existing link and auto-adds new row
    const handleLinkChange = (id: string, field: 'itemName' | 'url' | 'quantity', value: string | number) => {
        setVendorLinks((prev) => {
            const index = prev.findIndex((l) => l.id === id);
            if (index === -1) return prev;

            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };

            // Check if we need to add a new empty row
            // If we are editing the last row, and it now has content, add a new one
            if (index === prev.length - 1) {
                const currentLink = updated[index];
                if (currentLink.itemName?.trim() || currentLink.url?.trim()) {
                    updated.push({
                        id: crypto.randomUUID(),
                        url: '',
                        itemName: '',
                        quantity: 1,
                    });
                }
            }

            return updated;
        });

        // Clear link error when user types
        if (errors.link) {
            setErrors((prev) => {
                const { link, ...rest } = prev;
                return rest;
            });
        }
        if (errors[`link_${id}`]) {
            setErrors((prev) => {
                const { [`link_${id}`]: removed, ...rest } = prev;
                return rest;
            });
        }
    };

    // Handle link blur - only validate URL
    const handleLinkBlur = (id: string) => {
        setVendorLinks((prev) => {
            const link = prev.find((l) => l.id === id);
            if (!link) return prev;

            // Validate URL if present
            if (link.url?.trim() && !isValidUrl(link.url)) {
                setErrors((e) => ({ ...e, [`link_${id}`]: 'Please enter a valid URL' }));
            }

            return prev;
        });
    };

    const handleRemoveLink = (id: string) => {
        setVendorLinks((prev) => {
            // Don't allow removing the last empty row if it's the only one
            if (prev.length <= 1) {
                return [{
                    id: crypto.randomUUID(),
                    url: '',
                    itemName: '',
                }];
            }
            return prev.filter((link) => link.id !== id);
        });
        setErrors((prev) => {
            const { [`link_${id}`]: removed, ...rest } = prev;
            return rest;
        });
    };

    const handleRemoveExistingAttachment = (url: string) => {
        setExistingAttachments((prev) => prev.filter((a) => a !== url));
    };

    const uploadFiles = async (files: File[], requestId: string): Promise<FundRequestAttachment[]> => {
        if (!user) return [];

        const attachments: FundRequestAttachment[] = [];

        for (const file of files) {
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const timestamp = Date.now();
            const path = `fund_requests/${user.uid}/${requestId}/${timestamp}_${sanitizedName}`;
            const storageRef = ref(storage, path);

            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            attachments.push({
                id: crypto.randomUUID(),
                url,
                name: file.name,
                size: file.size,
                type: file.type,
                uploadedAt: Timestamp.now(),
            });
        }

        return attachments;
    };

    const handleSubmit = async () => {
        if (!user) return;

        // Final validation
        if (!validateStep(1) || !validateStep(2)) {
            showToast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);

        try {
            const requestId = request?.id || crypto.randomUUID();

            // Upload new files (optional)
            const newAttachments = attachmentFiles.length > 0
                ? await uploadFiles(attachmentFiles, requestId)
                : [];

            // Combine with existing attachments
            const allAttachments = [
                ...(request?.attachments?.filter((a) => existingAttachments.includes(a.url)) || []),
                ...newAttachments,
            ];

            const status = 'submitted';

            // Filter out empty vendor links before saving
            const cleanedVendorLinks = vendorLinks.filter(
                (link) => link.url?.trim() || link.itemName?.trim()
            );

            // Build requestData without undefined values
            const requestData: Record<string, any> = {
                title: title.trim(),
                purpose: purpose.trim(),
                category,
                department,
                amount: parseFloat(amount) || 0,
                vendorLinks: cleanedVendorLinks,
                attachments: allAttachments,
                status,
                updatedAt: Timestamp.now(),
            };

            // Only add infoResponseNotes if it has a value
            if (request?.status === 'needs_info' && infoResponseNotes.trim()) {
                requestData.infoResponseNotes = infoResponseNotes.trim();
            }

            if (isEditMode && request) {
                // Update existing request
                const auditLog = {
                    id: crypto.randomUUID(),
                    action: request.status === 'needs_info' ? 'info_provided' : 'updated',
                    performedBy: user.uid,
                    performedByName: user.displayName || user.email || 'Unknown',
                    timestamp: Timestamp.now(),
                    previousStatus: request.status,
                    newStatus: status,
                };

                await updateDoc(doc(db, 'fundRequests', request.id), {
                    ...requestData,
                    auditLogs: [...(request.auditLogs || []), auditLog],
                });

                // Send resubmission email notification
                if (request.status === 'needs_info') {
                    try {
                        await fetch('/api/email/send-fund-request-notification', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'fund_request_submission',
                                requestId: request.id,
                            }),
                        });
                    } catch (emailError) {
                        console.error('Failed to send resubmission email:', emailError);
                    }
                }
            } else {
                // Create new request
                const newRequest = {
                    ...requestData,
                    submittedBy: user.uid,
                    submittedByName: user.displayName || user.email || 'Unknown',
                    submittedByEmail: user.email || '',
                    submittedAt: Timestamp.now(),
                    createdAt: Timestamp.now(),
                    auditLogs: [
                        {
                            id: crypto.randomUUID(),
                            action: 'created',
                            performedBy: user.uid,
                            performedByName: user.displayName || user.email || 'Unknown',
                            timestamp: Timestamp.now(),
                            newStatus: status,
                        },
                    ],
                };

                const docRef = await addDoc(collection(db, 'fundRequests'), newRequest);

                // Send email notification
                try {
                    await fetch('/api/email/send-fund-request-notification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            type: 'fund_request_submission',
                            requestId: docRef.id,
                        }),
                    });
                } catch (emailError) {
                    console.error('Failed to send email notification:', emailError);
                    // Don't fail the whole operation for email errors
                }
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving fund request:', error);
            showToast.error('Failed to save fund request');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrency = (value: string): string => {
        const num = parseFloat(value.replace(/[^0-9.]/g, ''));
        if (isNaN(num)) return '';
        return num.toFixed(2);
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="space-y-6">
                        <Input
                            label="Title"
                            placeholder="Enter a descriptive title for your request"
                            value={title}
                            onValueChange={setTitle}
                            isRequired
                            isInvalid={!!errors.title}
                            errorMessage={errors.title}
                            maxLength={100}
                            labelPlacement="outside"
                            variant="bordered"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Select
                                label="Department"
                                placeholder="Select Department"
                                selectedKeys={[department]}
                                onSelectionChange={(keys) => {
                                    const selected = Array.from(keys)[0] as FundRequestDepartment;
                                    if (selected) setDepartment(selected);
                                }}
                                isRequired
                                labelPlacement="outside"
                                variant="bordered"
                                startContent={<Briefcase className="w-4 h-4 text-default-400" />}
                            >
                                {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
                                    <SelectItem key={key}>{label}</SelectItem>
                                ))}
                            </Select>
                            <Select
                                label="Category"
                                placeholder="Select Category"
                                selectedKeys={[category]}
                                onSelectionChange={(keys) => {
                                    const selected = Array.from(keys)[0] as FundRequestCategory;
                                    if (selected) setCategory(selected);
                                }}
                                labelPlacement="outside"
                                variant="bordered"
                                startContent={<Tag className="w-4 h-4 text-default-400" />}
                            >
                                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                                    <SelectItem key={key}>{label}</SelectItem>
                                ))}
                            </Select>
                        </div>
                        <Textarea
                            label="Purpose / Justification"
                            placeholder="Explain why you need this funding and how it will be used..."
                            value={purpose}
                            onValueChange={setPurpose}
                            isRequired
                            isInvalid={!!errors.purpose}
                            errorMessage={errors.purpose}
                            minRows={6}
                            maxRows={8}
                            labelPlacement="outside"
                            variant="bordered"
                        />
                    </div>
                );

            case 2:
                return (
                    <div className="space-y-6">
                        <Input
                            label="Total Budget Amount"
                            placeholder="0.00"
                            value={amount}
                            onValueChange={(value) => {
                                // Allow only numbers and one decimal point
                                const sanitized = value.replace(/[^0-9.]/g, '');
                                const parts = sanitized.split('.');
                                if (parts.length > 2) return;
                                if (parts[1] && parts[1].length > 2) return;
                                setAmount(sanitized);
                            }}
                            onBlur={() => {
                                if (amount) setAmount(formatCurrency(amount));
                            }}
                            startContent={<DollarSign className="w-4 h-4 text-default-400" />}
                            isRequired
                            isInvalid={!!errors.amount}
                            errorMessage={errors.amount}
                            type="text"
                            inputMode="decimal"
                            labelPlacement="outside"
                            variant="bordered"
                            description="Enter the total amount requested in USD."
                        />

                        <Divider />

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <div>
                                    <label className="block text-sm font-medium">
                                        Purchase Links / Line Items
                                    </label>
                                    <p className="text-xs text-default-400">
                                        Enter items below. A new line will automatically appear.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {/* Header */}
                                {vendorLinks.length > 0 && (
                                    <div className="flex gap-2 px-1 text-xs text-default-500 font-medium uppercase tracking-wide">
                                        <span className="flex-1">Item Name</span>
                                        <span className="w-20">Qty</span>
                                        <span className="flex-[2]">URL</span>
                                        <span className="w-8"></span>
                                    </div>
                                )}

                                {/* Existing links as editable rows */}
                                {vendorLinks.map((link, index) => (
                                    <div key={link.id} className="group flex gap-2 items-center">
                                        <Input
                                            placeholder="Item name"
                                            value={link.itemName || link.label || ''}
                                            onValueChange={(value) => handleLinkChange(link.id, 'itemName', value)}
                                            onBlur={() => handleLinkBlur(link.id)}
                                            className="flex-1"
                                            size="sm"
                                            variant="bordered"
                                        />
                                        <Input
                                            placeholder="1"
                                            value={link.quantity?.toString() || '1'}
                                            onValueChange={(value) => {
                                                const num = parseInt(value) || 1;
                                                handleLinkChange(link.id, 'quantity', Math.max(1, num));
                                            }}
                                            type="number"
                                            min={1}
                                            className="w-20"
                                            size="sm"
                                            variant="bordered"
                                        />
                                        <Input
                                            placeholder="https://..."
                                            value={link.url || ''}
                                            onValueChange={(value) => handleLinkChange(link.id, 'url', value)}
                                            onBlur={() => handleLinkBlur(link.id)}
                                            startContent={<LinkIcon className="w-3.5 h-3.5 text-default-400" />}
                                            isInvalid={!!errors[`link_${link.id}`]}
                                            errorMessage={errors[`link_${link.id}`]}
                                            className="flex-[2]"
                                            size="sm"
                                            variant="bordered"
                                        />
                                        <Button
                                            isIconOnly
                                            size="sm"
                                            variant="light"
                                            color="danger"
                                            onPress={() => handleRemoveLink(link.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                            aria-label="Remove link"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="space-y-4">
                        <MultiFileUpload
                            files={attachmentFiles}
                            onFilesChange={setAttachmentFiles}
                            existingFiles={existingAttachments}
                            onRemoveExistingFile={handleRemoveExistingAttachment}
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            maxFiles={10}
                            maxSizeInMB={10}
                            label="Supporting Documents"
                            description="Upload receipts, invoices, screenshots, or quotes. Supported formats: .pdf, .jpg, .png, .doc"
                        />
                    </div>
                );

            case 4:
                return (
                    <div className="space-y-6">
                        <Card className="border border-default-200 shadow-sm bg-default-50/50">
                            <CardBody className="p-5 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="text-lg font-bold text-foreground">{title}</h4>
                                        <p className="text-sm text-default-500 mt-0.5">{DEPARTMENT_LABELS[department]}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-success-600">
                                            ${formatCurrency(amount)}
                                        </p>
                                        <Chip size="sm" variant="flat" color="primary" className="mt-1">
                                            {CATEGORY_LABELS[category]}
                                        </Chip>
                                    </div>
                                </div>

                                <Divider />

                                <div>
                                    <span className="text-xs font-semibold text-default-500 uppercase tracking-wide block mb-1">
                                        Purpose
                                    </span>
                                    <p className="text-sm text-default-700 whitespace-pre-wrap leading-relaxed">
                                        {purpose}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="p-3 bg-white rounded-lg border border-default-200">
                                        <div className="flex items-center gap-2 mb-1">
                                            <LinkIcon className="w-4 h-4 text-primary-500" />
                                            <span className="text-xs font-medium text-default-500 uppercase">Items / Links</span>
                                        </div>
                                        <p className="text-lg font-semibold pl-6">
                                            {vendorLinks.filter(l => l.url?.trim() || l.itemName?.trim()).length}
                                        </p>
                                    </div>
                                    <div className="p-3 bg-white rounded-lg border border-default-200">
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileText className="w-4 h-4 text-primary-500" />
                                            <span className="text-xs font-medium text-default-500 uppercase">Attachments</span>
                                        </div>
                                        <p className="text-lg font-semibold pl-6">
                                            {attachmentFiles.length + existingAttachments.length}
                                        </p>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>

                        {request?.status === 'needs_info' && (
                            <div className="bg-warning-50/50 rounded-xl p-4 border border-warning-200 space-y-3">
                                <div className="flex items-center gap-2 text-warning-700">
                                    <AlertCircle className="w-5 h-5" />
                                    <span className="font-semibold">Information Requested</span>
                                </div>
                                <p className="text-sm text-warning-800 bg-white/50 p-3 rounded-lg border border-warning-100 italic">
                                    "{request.infoRequestNotes}"
                                </p>
                                <Textarea
                                    label="Your Response"
                                    placeholder="Provide the additional information that was requested..."
                                    value={infoResponseNotes}
                                    onValueChange={setInfoResponseNotes}
                                    minRows={3}
                                    variant="bordered"
                                    classNames={{
                                        inputWrapper: "bg-white"
                                    }}
                                />
                            </div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="2xl"
            scrollBehavior="inside"
            isDismissable={!isSubmitting}
            hideCloseButton={isSubmitting}
            classNames={{
                body: "p-6",
            }}
        >
            <ModalContent>
                <ModalHeader className="pb-0">
                    <div className="flex flex-col gap-1 w-full">
                        <span className="text-xl font-bold">{isEditMode ? 'Edit Fund Request' : 'New Fund Request'}</span>

                        {/* Stepper */}
                        <div className="mt-6 mb-2 relative">
                            {/* Connector Line */}
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-default-100 -translate-y-1/2 z-0" />
                            <div
                                className="absolute top-1/2 left-0 h-0.5 bg-primary transition-all duration-300 -translate-y-1/2 z-0"
                                style={{
                                    width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%`
                                }}
                            />

                            {/* Steps */}
                            <div className="flex justify-between relative z-10">
                                {STEPS.map((step) => {
                                    const isCompleted = currentStep > step.id;
                                    const isCurrent = currentStep === step.id;

                                    return (
                                        <div key={step.id} className="flex flex-col items-center gap-2 bg-background px-2">
                                            <div
                                                className={`
                                                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 border-2
                                                    ${isCompleted || isCurrent ? 'border-primary bg-primary text-white' : 'border-default-200 bg-background text-default-400'}
                                                `}
                                            >
                                                {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                                            </div>
                                            <div className="hidden sm:flex flex-col items-center">
                                                <span className={`text-xs font-semibold ${isCurrent ? 'text-primary' : 'text-default-500'}`}>
                                                    {step.title}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </ModalHeader>

                <ModalBody className="py-6">
                    {renderStepContent()}
                </ModalBody>

                <ModalFooter className="flex justify-between items-center pt-2 pb-6 px-6 border-t border-default-100">
                    <Button
                        variant="light"
                        onPress={onClose}
                        isDisabled={isSubmitting}
                        className="text-default-500 hover:text-default-700"
                    >
                        Cancel
                    </Button>

                    <div className="flex gap-3">
                        {currentStep > 1 && (
                            <Button
                                variant="bordered"
                                onPress={handlePrevStep}
                                startContent={<ChevronLeft className="w-4 h-4" />}
                                isDisabled={isSubmitting}
                            >
                                Back
                            </Button>
                        )}

                        {currentStep < STEPS.length ? (
                            <Button
                                color="primary"
                                onPress={handleNextStep}
                                endContent={<ChevronRight className="w-4 h-4" />}
                                className="font-semibold shadow-md shadow-primary/20"
                            >
                                Next Step
                            </Button>
                        ) : (
                            <Button
                                color="primary"
                                onPress={() => handleSubmit()}
                                isLoading={isSubmitting}
                                startContent={!isSubmitting && <Check className="w-4 h-4" />}
                                className="font-semibold shadow-md shadow-primary/20"
                            >
                                {request?.status === 'needs_info' ? 'Resubmit Request' : 'Submit Request'}
                            </Button>
                        )}
                    </div>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
