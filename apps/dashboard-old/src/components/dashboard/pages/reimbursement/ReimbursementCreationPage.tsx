import React, { useState, useEffect } from 'react';
import {
    Button,
    Input,
    Select,
    SelectItem,
    Textarea,
    Card,
    CardBody,
    Spacer,
    Progress,
    Tabs,
    Tab,
    Divider
} from "@heroui/react";
import {
    ChevronLeft,
    Upload,
    X,
    FileText,
    CheckCircle,
    AlertTriangle,
    ArrowRight,
    Plus,
    DollarSign,
    Save
} from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, storage } from '../../../../firebase/client';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { showToast } from '../../shared/utils/toast';
import type {
    ReimbursementFormData,
    ReimbursementReceipt
} from './types';
import {
    DEPARTMENTS,
    PAYMENT_METHODS
} from './types';
import ReceiptForm from './wizard-steps/ReceiptForm';
import { useGlobalImagePaste } from '../../shared/hooks/useGlobalImagePaste';
import { usePasteNotification } from '../../shared/components/PasteNotification';

interface ReimbursementCreationPageProps {
    onBack: () => void;
    onSubmitSuccess: () => void;
    initialData?: any; // Using any to avoid circular deps or duplicate types for now, ideally import shared type
}

export default function ReimbursementCreationPage({ onBack, onSubmitSuccess, initialData }: ReimbursementCreationPageProps) {
    const [user] = useAuthState(auth);
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState<ReimbursementFormData>({
        title: '',
        department: '',
        paymentMethod: '',
        additionalInfo: '',
        businessPurpose: ''
    });

    // Receipt State
    const [receipts, setReceipts] = useState<ReimbursementReceipt[]>([]);
    const [activeReceiptTab, setActiveReceiptTab] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    // AI State
    const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
    const [parsingReceipts, setParsingReceipts] = useState<Set<string>>(new Set());
    const [parseResults, setParseResults] = useState<Record<string, { success: boolean; message: string }>>({});

    // Paste notification
    const { showPasteNotification, PasteNotificationComponent } = usePasteNotification("Receipt file pasted");

    // Initialize with data or one receipt
    React.useEffect(() => {
        if (initialData) {
            setFormData({
                title: initialData.title || '',
                department: initialData.department || '',
                paymentMethod: initialData.paymentMethod || '',
                additionalInfo: initialData.additionalInfo || '',
                businessPurpose: initialData.businessPurpose || ''
            });

            if (initialData.receipts && initialData.receipts.length > 0) {
                const mappedReceipts = initialData.receipts.map((r: any) => ({
                    id: r.id || Date.now().toString() + Math.random(),
                    vendorName: r.vendorName || '',
                    location: r.location || '',
                    dateOfPurchase: r.dateOfPurchase || '',
                    lineItems: r.lineItems || [],
                    receiptFile: r.receiptFile ? (typeof r.receiptFile === 'string' ? {
                        url: r.receiptFile,
                        name: 'Receipt',
                        size: 0,
                        type: r.receiptFile.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
                    } : r.receiptFile) : undefined,
                    notes: r.notes || '',
                    subtotal: r.subtotal || 0,
                    tax: r.tax || 0,
                    tip: r.tip || 0,
                    shipping: r.shipping || 0,
                    otherCharges: r.otherCharges || 0,
                    total: r.total || 0
                }));
                setReceipts(mappedReceipts);
                setActiveReceiptTab(mappedReceipts[0].id);
            } else {
                addReceipt();
            }

            // Skip warning step if editing
            setStep(2);
        } else if (receipts.length === 0) {
            addReceipt();
        }
    }, [initialData]);

    // Fetch user profile for default payment info
    useEffect(() => {
        const fetchUserProfile = async () => {
            if (user && !formData.additionalInfo && !initialData) {
                try {
                    const { doc, getDoc } = await import('firebase/firestore');
                    const { db } = await import('../../../../firebase/client');
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        if (userData.zelleInformation) {
                            setFormData(prev => ({
                                ...prev,
                                additionalInfo: userData.zelleInformation
                            }));
                        }
                    }
                } catch (error) {
                    console.error("Error fetching user profile for default Zelle info", error);
                }
            }
        };
        fetchUserProfile();
    }, [user, initialData]);  // Run once when user loads or if initialData changes (though initialData handles its own set)

    // Global image paste handler
    useGlobalImagePaste({
        modalType: "reimbursement-submission",
        enabled: step === 3,
        onImagePaste: (file) => {
            if (activeReceiptTab && step === 3) {
                handleReceiptUpload(activeReceiptTab, file);
            }
        },
        onPasteSuccess: () => {
            showPasteNotification();
        },
    });

    const addReceipt = () => {
        const newReceiptId = Date.now().toString();
        const newReceipt: ReimbursementReceipt = {
            id: newReceiptId,
            vendorName: "",
            location: "",
            dateOfPurchase: "",
            lineItems: [],
            notes: "",
            subtotal: 0,
            tax: 0,
            tip: 0,
            shipping: 0,
            otherCharges: 0,
            total: 0,
        };
        setReceipts(prev => [...prev, newReceipt]);
        setActiveReceiptTab(newReceiptId);
    };

    const removeReceipt = (id: string) => {
        if (receipts.length > 1) {
            const newReceipts = receipts.filter((receipt) => receipt.id !== id);
            setReceipts(newReceipts);
            if (activeReceiptTab === id && newReceipts.length > 0) {
                setActiveReceiptTab(newReceipts[0].id);
            }
        } else if (receipts.length === 1) {
            // Reset last receipt instead of removing
            setReceipts([{
                id: receipts[0].id,
                vendorName: "",
                location: "",
                dateOfPurchase: "",
                lineItems: [],
                notes: "",
                subtotal: 0,
                tax: 0,
                tip: 0,
                shipping: 0,
                otherCharges: 0,
                total: 0,
            }]);
        }
    };

    const updateReceipt = (id: string, updates: Partial<ReimbursementReceipt>) => {
        setReceipts(prev => prev.map(receipt =>
            receipt.id === id ? { ...receipt, ...updates } : receipt
        ));
    };

    const handleReceiptUpload = async (receiptId: string, file: File) => {
        try {
            setUploadingFiles((prev) => new Set(prev).add(receiptId));
            setParseResults((prev) => {
                const newResults = { ...prev };
                delete newResults[receiptId];
                return newResults;
            });

            // Upload to Firebase Storage
            const fileName = `${Date.now()}_${file.name}`;
            const storageRef = ref(storage, `receipts/${auth.currentUser?.uid}/${fileName}`);

            const uploadTask = uploadBytesResumable(storageRef, file);
            await new Promise((resolve, reject) => {
                uploadTask.on("state_changed", null, reject, () => resolve(uploadTask.snapshot.ref));
            });

            const downloadURL = await getDownloadURL(storageRef);

            const receiptFileObj = {
                url: downloadURL,
                name: file.name,
                size: file.size,
                type: file.type,
            };

            updateReceipt(receiptId, { receiptFile: receiptFileObj });

            setUploadingFiles((prev) => {
                const newSet = new Set(prev);
                newSet.delete(receiptId);
                return newSet;
            });

            // Trigger AI Parsing
            await parseReceiptWithAI(receiptId, downloadURL, receiptFileObj);

        } catch (error) {
            console.error("Error uploading file:", error);
            setErrors(prev => ({
                ...prev,
                [`receipt_${receiptId}_file`]: "Failed to upload file. Please try again."
            }));
            setUploadingFiles((prev) => {
                const newSet = new Set(prev);
                newSet.delete(receiptId);
                return newSet;
            });
        }
    };

    const parseReceiptWithAI = async (
        receiptId: string,
        imageUrl: string,
        receiptFile?: { url: string; name: string; size: number; type: string }
    ) => {
        try {
            setParsingReceipts((prev) => new Set(prev).add(receiptId));
            // Removed intermediate "Parsing..." success message from here as it's handled by state in UI

            const response = await fetch("/api/parse-receipt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageUrl }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || result.message || "Failed to parse receipt");
            }

            const parsedData = result.data;
            if (!parsedData) throw new Error("Invalid response from AI service");

            const updates: Partial<ReimbursementReceipt> = {
                vendorName: parsedData.vendorName || "",
                location: parsedData.location || "",
                dateOfPurchase: parsedData.dateOfPurchase || "",
                lineItems: Array.isArray(parsedData.lineItems)
                    ? parsedData.lineItems.map((item: any, index: number) => ({
                        id: `parsed_${Date.now()}_${index}`,
                        description: item.description || "",
                        category: item.category || "Other",
                        amount: parseFloat(item.amount) || 0,
                        quantity: parseInt(item.quantity) || 1,
                    }))
                    : [{
                        id: `parsed_${Date.now()}_0`,
                        description: "Receipt Total",
                        category: "Other",
                        amount: parsedData.total || 0,
                        quantity: 1,
                    }],
                subtotal: parseFloat(parsedData.subtotal) || 0,
                tax: parseFloat(parsedData.tax) || 0,
                tip: parseFloat(parsedData.tip) || 0,
                shipping: parseFloat(parsedData.shipping) || 0,
                otherCharges: parseFloat(parsedData.otherCharges) || 0,
                total: parseFloat(parsedData.total) || 0,
            };

            if (receiptFile) updates.receiptFile = receiptFile;

            updateReceipt(receiptId, updates);

            setParseResults((prev) => ({
                ...prev,
                [receiptId]: { success: true, message: "Receipt parsed successfully!" },
            }));
            // Clear errors
            setErrors(prev => {
                const newErrs = { ...prev };
                delete newErrs[`receipt_${receiptId}_parse`];
                return newErrs;
            });

        } catch (error) {
            console.error("Error parsing receipt:", error);
            setParseResults((prev) => ({
                ...prev,
                [receiptId]: { success: false, message: "Could not auto-parse. Please enter details manually." },
            }));
        } finally {
            setParsingReceipts((prev) => {
                const newSet = new Set(prev);
                newSet.delete(receiptId);
                return newSet;
            });
        }
    };

    const validateStep = (currentStep: number) => {
        if (currentStep === 2) {
            return formData.title && formData.department && formData.paymentMethod && formData.businessPurpose;
        }
        if (currentStep === 3) {
            if (receipts.length === 0) return false;
            // Basic check: each receipt must have a total > 0 and a vendor and file
            // Relaxing strict check for file if manual entry is allowed, but usually receipt is required. Let's enforce file.
            return receipts.every(r => r.receiptFile && r.total > 0 && r.vendorName);
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!user) return;
        setIsSubmitting(true);

        try {
            const { db } = await import('../../../../firebase/client');
            const { collection, addDoc, updateDoc, doc, serverTimestamp, arrayUnion, Timestamp } = await import('firebase/firestore');

            const formattedReceipts = receipts.map(r => ({
                id: r.id,
                vendorName: r.vendorName,
                location: r.location || '',
                dateOfPurchase: r.dateOfPurchase ? new Date(r.dateOfPurchase).toISOString() : new Date().toISOString(),
                lineItems: r.lineItems,
                receiptFile: r.receiptFile || '',
                notes: r.notes || '',
                subtotal: r.subtotal || 0,
                tax: r.tax || 0,
                tip: r.tip || 0,
                shipping: r.shipping || 0,
                otherCharges: r.otherCharges || 0,
                total: r.total || 0
            }));

            const submissionData = {
                ...formData,
                status: 'submitted',
                submittedBy: user.uid,
                submittedByName: user.displayName || 'Unknown',
                receipts: formattedReceipts,
                totalAmount: receipts.reduce((sum, r) => sum + (r.total || 0), 0),
            };

            if (initialData?.id) {
                await updateDoc(doc(db, 'reimbursements', initialData.id), {
                    ...submissionData,
                    updatedAt: serverTimestamp(),
                    auditLogs: arrayUnion({
                        action: 'Request edited',
                        editedBy: user.uid,
                        timestamp: Timestamp.now()
                    })
                });
                showToast.success('Reimbursement updated successfully!');
            } else {
                await addDoc(collection(db, 'reimbursements'), {
                    ...submissionData,
                    submittedAt: serverTimestamp(),
                    history: [{
                        action: 'created',
                        by: user.uid,
                        at: new Date()
                    }]
                }).then(async (docRef) => {
                    // Send notification email
                    try {
                        await fetch('/api/email/send-reimbursement-notification', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                type: 'reimbursement_submission',
                                reimbursementId: docRef.id
                            }),
                        });
                    } catch (emailError) {
                        console.error('Failed to send notification emails:', emailError);
                        // Don't fail the submission if email fails
                    }
                });
                showToast.success('Reimbursement submitted successfully!');
            }

            onSubmitSuccess();

        } catch (error) {
            console.error('Error submitting:', error);
            showToast.error('Failed to submit reimbursement');
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalAmount = receipts.reduce((sum, r) => sum + (r.total || 0), 0);

    return (
        <div className="flex flex-col h-screen bg-gray-50 absolute inset-0 z-50 overflow-hidden">
            {PasteNotificationComponent}

            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 h-16 box-border">
                <div className="flex items-center gap-4">
                    <Button isIconOnly variant="light" onPress={onBack} size="sm">
                        <ChevronLeft className="w-5 h-5 text-gray-500" />
                    </Button>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 leading-tight">
                            {initialData ? 'Edit Request' : 'New Request'}
                        </h1>
                        <p className="text-xs text-gray-500">Step {step} of 4</p>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <div className="w-48 hidden sm:block">
                        <Progress value={(step / 4) * 100} className="h-2" color="primary" />
                    </div>
                    {step > 1 && (
                        <div className="text-right">
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Total</p>
                            <p className="text-lg font-bold text-gray-900 leading-none">${totalAmount.toFixed(2)}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto p-0 sm:p-6 flex justify-center bg-gray-50">
                <div className="w-full max-w-5xl h-full flex flex-col">

                    {/* Step 1: Warning */}
                    {step === 1 && (
                        <div className="flex flex-col items-center justify-center flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500 p-6">
                            <div className="bg-white border border-blue-100 shadow-sm rounded-2xl p-8 text-center space-y-6 max-w-lg w-full">
                                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                                    <AlertTriangle className="w-10 h-10 text-blue-600" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Before you start</h2>
                                    <p className="text-gray-600 leading-relaxed">
                                        Our system uses AI to automatically parse details from your receipts.
                                        Please review all extracted information carefully before submitting.
                                    </p>
                                </div>
                                <Button color="primary" size="lg" className="w-full font-semibold" endContent={<ArrowRight className="w-4 h-4" />} onPress={() => setStep(2)}>
                                    I Understand, Continue
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Basic Info */}
                    {step === 2 && (
                        <div className="flex flex-col items-center justify-center flex-1 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Card className="w-full max-w-2xl shadow-sm border border-gray-200">
                                <CardBody className="gap-8 p-8">
                                    <div className="border-b border-gray-100 pb-4">
                                        <h2 className="text-xl font-bold text-gray-900">Report Details</h2>
                                        <p className="text-sm text-gray-500">Enter the high-level details for this reimbursement request.</p>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="space-y-2">
                                            <p className="text-sm font-semibold text-gray-700">Report Title</p>
                                            <Input
                                                placeholder="e.g. Flight to conference"
                                                value={formData.title}
                                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                variant="bordered"
                                                radius="md"
                                                classNames={{ inputWrapper: "bg-white" }}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <p className="text-sm font-semibold text-gray-700">Department</p>
                                                <Select
                                                    selectedKeys={formData.department ? [formData.department] : []}
                                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                                    variant="bordered"
                                                    radius="md"
                                                    placeholder="Select Department"
                                                    classNames={{ trigger: "bg-white" }}
                                                >
                                                    {DEPARTMENTS.map(dept => <SelectItem key={dept.value}>{dept.label}</SelectItem>)}
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-sm font-semibold text-gray-700">Payment Method</p>
                                                <Select
                                                    selectedKeys={formData.paymentMethod ? [formData.paymentMethod] : []}
                                                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                                                    variant="bordered"
                                                    radius="md"
                                                    placeholder="Select Method"
                                                    classNames={{ trigger: "bg-white" }}
                                                >
                                                    {PAYMENT_METHODS.map(method => <SelectItem key={method}>{method}</SelectItem>)}
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Additional Info for Payment (Zelle/Venmo etc) */}
                                        {(formData.paymentMethod === 'Zelle' || formData.paymentMethod === 'Venmo' || formData.paymentMethod === 'PayPal' || formData.paymentMethod === 'Other') && (
                                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                                <p className="text-sm font-semibold text-gray-700">
                                                    {formData.paymentMethod} Details
                                                    <span className="text-gray-400 font-normal ml-1">(Email, Phone, or Username)</span>
                                                </p>
                                                <Input
                                                    placeholder={`Enter your ${formData.paymentMethod} details...`}
                                                    value={formData.additionalInfo}
                                                    onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                                                    variant="bordered"
                                                    radius="md"
                                                    classNames={{ inputWrapper: "bg-white" }}
                                                />
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <p className="text-sm font-semibold text-gray-700">Business Purpose</p>
                                            <Textarea
                                                placeholder="Explain business reason..."
                                                value={formData.businessPurpose}
                                                onChange={(e) => setFormData({ ...formData, businessPurpose: e.target.value })}
                                                variant="bordered"
                                                radius="md"
                                                minRows={3}
                                                classNames={{ inputWrapper: "bg-white" }}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-between pt-4">
                                        <Button variant="light" onPress={() => setStep(1)}>Back</Button>
                                        <Button color="primary" onPress={() => validateStep(2) && setStep(3)} isDisabled={!validateStep(2)}>
                                            Next: Upload Receipts
                                        </Button>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    )}

                    {/* Step 3: Receipt Upload */}
                    {step === 3 && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
                            <div className="flex items-center justify-between mb-4 px-2 shrink-0">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Upload Receipts</h2>
                                    <p className="text-xs text-gray-500">Manage expenses for this report</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button onPress={addReceipt} startContent={<Plus className="w-4 h-4" />} size="sm" variant="flat" color="primary" className="font-semibold">
                                        Add Receipt
                                    </Button>
                                    <Button
                                        onPress={() => validateStep(3) && setStep(4)}
                                        isDisabled={!validateStep(3)}
                                        size="sm"
                                        color="primary"
                                        className="font-semibold"
                                        endContent={<ArrowRight className="w-4 h-4" />}
                                    >
                                        Review & Submit
                                    </Button>
                                </div>
                            </div>

                            <Tabs
                                selectedKey={activeReceiptTab}
                                onSelectionChange={(key) => setActiveReceiptTab(key as string)}
                                aria-label="Receipt Tabs"
                                variant="underlined"
                                classNames={{
                                    tabList: "gap-6 w-full relative rounded-none p-0 border-b border-gray-200 mb-4",
                                    cursor: "w-full bg-blue-600",
                                    tab: "max-w-fit px-0 h-10",
                                }}
                            >
                                {receipts.map((receipt, index) => (
                                    <Tab
                                        key={receipt.id}
                                        title={
                                            <div className="flex items-center space-x-2">
                                                <span>Receipt {index + 1}</span>
                                                {receipts.length > 1 && (
                                                    <div
                                                        role="button"
                                                        onClick={(e) => { e.stopPropagation(); removeReceipt(receipt.id); }}
                                                        className="ml-2 text-gray-400 hover:text-red-500 rounded-full p-0.5 hover:bg-red-50 transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>
                                        }
                                    >
                                        <ReceiptForm
                                            receipt={receipt}
                                            updateReceipt={updateReceipt}
                                            errors={errors}
                                            uploadingFiles={uploadingFiles}
                                            parsingReceipts={parsingReceipts}
                                            parseResults={parseResults}
                                            onFileUpload={handleReceiptUpload}
                                        />
                                    </Tab>
                                ))}
                            </Tabs>

                            <div className="flex justify-between mt-4 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
                                <Button variant="light" onPress={() => setStep(2)}>Back</Button>
                                <Button
                                    color="primary"
                                    onPress={() => validateStep(3) && setStep(4)}
                                    isDisabled={!validateStep(3)}
                                >
                                    Review & Submit
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Review */}
                    {step === 4 && (
                        <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
                            <div className="mb-6 shrink-0">
                                <h2 className="text-2xl font-bold text-gray-900">Review Request</h2>
                                <p className="text-gray-500">Please review all line items and details before submitting.</p>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Summary Card */}
                                <div className="lg:col-span-1 space-y-6">
                                    <Card className="shadow-sm border border-gray-200">
                                        <CardBody className="p-6 space-y-6">
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">Report Summary</h3>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label className="text-xs text-gray-500 uppercase block mb-1">Title</label>
                                                        <p className="font-medium text-gray-900">{formData.title}</p>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-500 uppercase block mb-1">Department</label>
                                                        <p className="font-medium text-gray-900">{DEPARTMENTS.find(d => d.value === formData.department)?.label}</p>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-500 uppercase block mb-1">Payment Method</label>
                                                        <p className="font-medium text-gray-900">{formData.paymentMethod}</p>
                                                    </div>
                                                    <Divider className="my-2" />
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-gray-900">Total Amount</span>
                                                        <span className="font-bold text-xl text-green-600">${totalAmount.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardBody>
                                    </Card>
                                    <div className="flex flex-col gap-3">
                                        <Button
                                            color="primary"
                                            size="lg"
                                            onPress={handleSubmit}
                                            isLoading={isSubmitting}
                                            startContent={!isSubmitting && <CheckCircle className="w-5 h-5" />}
                                            className="w-full font-bold shadow-md shadow-blue-500/20"
                                        >
                                            {initialData ? 'Update Request' : 'Submit Request'}
                                        </Button>
                                        <Button variant="light" onPress={() => setStep(3)}>Back to Edit</Button>
                                    </div>
                                </div>

                                {/* Detailed Breakdown */}
                                <div className="lg:col-span-2 space-y-6">
                                    {receipts.map((r, i) => (
                                        <Card key={r.id} className="shadow-sm border border-gray-200">
                                            <CardBody className="p-0">
                                                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-500 text-sm">
                                                            {i + 1}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-gray-900">{r.vendorName}</h4>
                                                            <p className="text-xs text-gray-500">{r.dateOfPurchase} • {r.location}</p>
                                                        </div>
                                                    </div>
                                                    <span className="font-bold text-gray-900">${r.total.toFixed(2)}</span>
                                                </div>
                                                <div className="p-6">
                                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                        <table className="w-full text-sm text-left">
                                                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                                                                <tr>
                                                                    <th className="px-4 py-2">Line Item</th>
                                                                    <th className="px-4 py-2 text-center">Category</th>
                                                                    <th className="px-4 py-2 text-center">Qty</th>
                                                                    <th className="px-4 py-2 text-right">Unit Price</th>
                                                                    <th className="px-4 py-2 text-right">Line Total</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {r.lineItems.map((item, idx) => {
                                                                    const lineTotal = (item.amount || 0) * (item.quantity || 1);
                                                                    return (
                                                                        <tr key={idx} className="bg-white">
                                                                            <td className="px-4 py-2 font-medium text-gray-900">{item.description}</td>
                                                                            <td className="px-4 py-2 text-center text-gray-500 text-xs">{item.category}</td>
                                                                            <td className="px-4 py-2 text-center text-gray-500">{item.quantity}</td>
                                                                            <td className="px-4 py-2 text-right text-gray-700">${item.amount.toFixed(2)}</td>
                                                                            <td className="px-4 py-2 text-right text-gray-900 font-medium">${lineTotal.toFixed(2)}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                                {/* Summary Rows */}
                                                                {((r.tax || 0) > 0 || (r.tip || 0) > 0 || (r.shipping || 0) > 0) && (
                                                                    <tr className="bg-gray-50/50 text-xs text-gray-500">
                                                                        <td colSpan={4} className="px-4 py-2 text-right uppercase font-semibold tracking-wide">Additional (Tax/Tip/Ship)</td>
                                                                        <td className="px-4 py-2 text-right font-medium text-gray-700">
                                                                            ${((r.tax || 0) + (r.tip || 0) + (r.shipping || 0)).toFixed(2)}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
