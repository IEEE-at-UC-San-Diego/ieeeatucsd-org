import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, XCircle, DollarSign, AlertCircle, FileText, ChevronLeft, ChevronRight, Calculator, Table, Sparkles, UploadCloud } from 'lucide-react';
import { Button, Chip, Input, Textarea, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Tabs, Tab } from '@heroui/react';
import { doc, getDoc, updateDoc, Timestamp, arrayUnion, deleteField } from 'firebase/firestore';
import { db } from '../../../../firebase/client';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { showToast } from '../../shared/utils/toast';
import ReceiptViewer from '../reimbursement/components/ReceiptViewer';

interface ManageReimbursementDetailsProps {
    reimbursement: any;
    onBack: () => void;
    currentUser: any;
    onUpdate: (id: string, status: string, auditNote?: string, paymentInfo?: any) => Promise<void>;
}

export default function ManageReimbursementDetails({
    reimbursement,
    onBack,
    currentUser,
    onUpdate
}: ManageReimbursementDetailsProps) {
    const [activeReceiptIndex, setActiveReceiptIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [submitterZelle, setSubmitterZelle] = useState('');

    useEffect(() => {
        const fetchSubmitterDetails = async () => {
            // Only fetch if we suspect we need it (missing additionalInfo) or just always fetch to be safe/consistent?
            // Always fetch is safer for "Profile" fallback indication.
            if (reimbursement.submittedBy) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', reimbursement.submittedBy));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setSubmitterZelle(userData.zelleInformation || '');
                    }
                } catch (error) {
                    console.error("Error fetching submitter details", error);
                }
            }
        };
        fetchSubmitterDetails();
    }, [reimbursement.submittedBy]);

    // Paid Confirmation State
    const { isOpen: isPaidOpen, onOpen: onPaidOpen, onOpenChange: onPaidOpenChange } = useDisclosure();
    const [paidConfirmationNumber, setPaidConfirmationNumber] = useState('');
    const [paidProofFile, setPaidProofFile] = useState<File | null>(null);
    const [aiProcessing, setAiProcessing] = useState(false);
    const [paymentReviewData, setPaymentReviewData] = useState<any>(null);
    const [paymentDate, setPaymentDate] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMemo, setPaymentMemo] = useState('');
    const [uploadedProofUrl, setUploadedProofUrl] = useState('');

    // Handle paste event for file upload
    // Handle paste event for file upload
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (!isPaidOpen || paymentReviewData) return; // Don't allow paste if already reviewing

            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        setPaidProofFile(file);
                        showToast.success('Image pasted successfully');
                        e.preventDefault();
                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [isPaidOpen, paymentReviewData]);

    // Partial Reimbursement State
    const { isOpen: isPartialOpen, onOpen: onPartialOpen, onOpenChange: onPartialOpenChange } = useDisclosure();
    const [partialAmount, setPartialAmount] = useState('');
    const [partialReason, setPartialReason] = useState('');

    const receipts = reimbursement.receipts || [];
    const currentReceipt = receipts[activeReceiptIndex] || {};
    const hasReceipts = receipts.length > 0;

    const calculateTotalAmount = () => {
        if (reimbursement.approvedAmount) return reimbursement.approvedAmount;
        return reimbursement.totalAmount || 0;
    };

    const handleAction = async (action: string) => {
        setIsProcessing(true);
        try {
            if (action === 'approve') {
                if (confirm('Are you sure you want to approve this reimbursement for the full amount?')) {
                    // Clear any partial approval data if it exists
                    if (reimbursement.partialReason || reimbursement.approvedAmount) {
                        try {
                            await updateDoc(doc(db, 'reimbursements', reimbursement.id), {
                                approvedAmount: deleteField(),
                                partialReason: deleteField()
                            });
                        } catch (err) {
                            console.error("Error clearing partial fields:", err);
                        }
                    }
                    await onUpdate(reimbursement.id, 'approved', 'Approved full amount');
                    onBack();
                }
            } else if (action === 'decline') {
                const reason = prompt('Please enter a reason for declining:');
                if (reason) {
                    await onUpdate(reimbursement.id, 'declined', `Declined: ${reason}`);
                    onBack();
                }
            } else if (action === 'paid') {
                setIsProcessing(false);
                onPaidOpen();
                return;
            }
        } catch (error) {
            console.error(error);
            showToast.error('Action Failed', 'Could not update reimbursement status.');
        } finally {
            if (action !== 'paid') {
                setIsProcessing(false);
            }
        }
    };

    const handlePartialSubmit = async () => {
        const amount = parseFloat(partialAmount);
        if (isNaN(amount) || amount <= 0) {
            showToast.error('Invalid Amount', 'Please enter a valid positive number.');
            return;
        }
        if (!partialReason.trim()) {
            showToast.error('Reason Required', 'Please provide a reason for the partial approval.');
            return;
        }

        setIsProcessing(true);
        try {
            await updateDoc(doc(db, 'reimbursements', reimbursement.id), {
                approvedAmount: amount,
                partialReason: partialReason,
                originalAmount: reimbursement.totalAmount
            });

            await onUpdate(reimbursement.id, 'approved', `Partial Approval: $${amount}. Reason: ${partialReason}`);

            onPartialOpenChange();
            onBack();
        } catch (error) {
            console.error(error);
            showToast.error('Failed', 'Could not process partial reimbursement.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePaidSubmit = async () => {
        // Step 2: Final Confirmation
        if (paymentReviewData) {
            if (!paidConfirmationNumber.trim()) {
                showToast.error('Missing Information', 'Please provide a confirmation number.');
                return;
            }

            setIsProcessing(true);
            try {
                await onUpdate(reimbursement.id, 'paid', 'Marked as paid', {
                    confirmationNumber: paidConfirmationNumber,
                    paymentDate: Timestamp.fromDate(new Date(paymentDate || Date.now())),
                    amountPaid: parseFloat(paymentAmount) || calculateTotalAmount(),
                    proofFileUrl: uploadedProofUrl,
                    memo: paymentMemo
                });

                onPaidOpenChange();
                onBack();
            } catch (error) {
                console.error(error);
                showToast.error('Failed', 'Could not save payment details.');
            } finally {
                setIsProcessing(false);
            }
            return;
        }

        // Step 1: Initial Processing (Upload & AI)
        if (!paidProofFile) {
            showToast.error('Missing File', 'Please upload a proof of payment.');
            return;
        }

        setIsProcessing(true);
        setAiProcessing(true);
        try {
            // 1. Upload proof file first
            let proofUrl = '';
            try {
                const storage = getStorage();
                const timestamp = Date.now();
                const storageRef = ref(storage, `reimbursements/${reimbursement.id}/payment_proof/${timestamp}_${paidProofFile.name}`);

                const uploadTask = await uploadBytesResumable(storageRef, paidProofFile);
                proofUrl = await getDownloadURL(uploadTask.ref);
                setUploadedProofUrl(proofUrl);
            } catch (uploadError) {
                console.error("Upload failed", uploadError);
                showToast.error('Upload Failed', 'Could not upload proof file.');
                setIsProcessing(false);
                setAiProcessing(false);
                return;
            }

            // 2. Call AI Endpoint
            try {
                const response = await fetch('/api/extract-payment-details', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageUrl: proofUrl })
                });

                if (!response.ok) throw new Error('AI Extraction failed');
                const result = await response.json();

                if (result.success && result.data) {
                    const data = result.data;
                    setPaymentReviewData(data);

                    // Pre-fill fields
                    if (data.confirmationNumber) setPaidConfirmationNumber(data.confirmationNumber);
                    if (data.paymentDate) setPaymentDate(data.paymentDate);
                    if (data.amountPaid) setPaymentAmount(data.amountPaid.toString());
                    if (data.memo) setPaymentMemo(data.memo);

                    showToast.success('Details Extracted', 'Please review the payment usage.');
                } else {
                    throw new Error('No data returned');
                }

            } catch (aiError) {
                console.error("AI failed, falling back", aiError);
                showToast.error('AI Extraction Failed', 'Please enter details manually.');
                // Fallback to manual entry state
                setPaymentReviewData({ manual: true });
                setPaymentDate(new Date().toISOString().split('T')[0]);
                setPaymentAmount(calculateTotalAmount().toFixed(2));
            }

        } catch (error) {
            console.error(error);
            showToast.error('Failed', 'Could not process payment proof.');
        } finally {
            setIsProcessing(false);
            setAiProcessing(false);
        }
    };

    const resetPaidModal = () => {
        setPaidConfirmationNumber('');
        setPaidProofFile(null);
        setPaymentReviewData(null);
        setPaymentDate('');
        setPaymentAmount('');
        setPaymentMemo('');
        setUploadedProofUrl('');
        setIsProcessing(false);
        setAiProcessing(false);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved': return 'success';
            case 'paid': return 'success';
            case 'declined': return 'danger';
            case 'submitted': return 'warning';
            default: return 'default';
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 absolute inset-0 z-10 overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 h-16 box-border shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <Button variant="light" isIconOnly onClick={onBack} className="-ml-2 text-gray-500 hover:text-blue-600">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-bold text-gray-900 leading-tight">
                                {reimbursement.title}
                            </h1>
                            <Chip size="sm" variant="flat" color={getStatusColor(reimbursement.status)} className="uppercase font-bold text-[10px] h-5">
                                {reimbursement.status === 'approved' && reimbursement.partialReason ? 'Partially Approved' : reimbursement.status}
                            </Chip>
                        </div>
                        <p className="text-xs text-gray-500">
                            Submitted on {reimbursement.submittedAt?.toDate().toLocaleDateString()} by {reimbursement.submittedByName}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right mr-2">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                            {reimbursement.approvedAmount ? 'Approved Amount' : 'Total Amount'}
                        </p>
                        <p className="text-xl font-bold text-gray-900 leading-none">
                            ${calculateTotalAmount().toFixed(2)}
                            {reimbursement.approvedAmount && <span className="text-gray-400 text-xs ml-1 line-through">${reimbursement.totalAmount.toFixed(2)}</span>}
                        </p>
                    </div>
                </div>
            </header>

            {/* Split Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel: Management & Info */}
                <div className="w-5/12 flex flex-col border-r border-gray-200 bg-white overflow-y-auto">

                    {/* Actions Bar */}
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50 space-y-4">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Actions</h2>
                        <div className="flex flex-wrap gap-2">
                            {(reimbursement.status === 'submitted' || (reimbursement.status === 'approved' && !reimbursement.paymentConfirmation)) && (
                                <>
                                    <Button
                                        color="success"
                                        className="text-white font-semibold"
                                        startContent={<CheckCircle className="w-4 h-4" />}
                                        onPress={() => handleAction('approve')}
                                        isDisabled={reimbursement.status === 'approved' && !reimbursement.partialReason}
                                    >
                                        Approve Full
                                    </Button>
                                    <Button
                                        color="warning"
                                        variant="flat"
                                        className="font-semibold text-yellow-700"
                                        startContent={<Calculator className="w-4 h-4" />}
                                        onPress={onPartialOpen}
                                    >
                                        {reimbursement.partialReason ? 'Edit Partial' : 'Partial'}
                                    </Button>
                                    <Button
                                        color="danger"
                                        variant="flat"
                                        className="font-semibold"
                                        startContent={<XCircle className="w-4 h-4" />}
                                        onPress={() => handleAction('decline')}
                                    >
                                        Decline
                                    </Button>
                                </>
                            )}
                            {reimbursement.status === 'approved' && !reimbursement.paymentConfirmation && (
                                <Button color="primary" className="bg-emerald-600 font-semibold" startContent={<DollarSign className="w-4 h-4" />} onPress={() => handleAction('paid')}>
                                    Mark as Paid
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Details Section */}
                    <div className="p-6 space-y-8">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 mb-4">Request Details</h3>
                            <div className="space-y-4 text-sm">
                                <div className="grid grid-cols-3 gap-2">
                                    <span className="text-gray-500 font-medium">Department</span>
                                    <span className="col-span-2 text-gray-900">{reimbursement.department}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <span className="text-gray-500 font-medium">Business Purpose</span>
                                    <span className="col-span-2 text-gray-900">{reimbursement.businessPurpose}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <span className="text-gray-500 font-medium">Payment Method</span>
                                    <span className="col-span-2 text-gray-900">
                                        {reimbursement.paymentMethod}
                                        {/* Show additional info inline if small, or below */}
                                    </span>
                                </div>
                                {(reimbursement.additionalInfo || submitterZelle || ['Zelle', 'Venmo', 'PayPal', 'Other'].includes(reimbursement.paymentMethod)) && (
                                    <div className="grid grid-cols-3 gap-2">
                                        <span className="text-gray-500 font-medium">
                                            {reimbursement.paymentMethod === 'Zelle' ? 'Zelle Info' : 'Payment Details'}
                                        </span>
                                        <span className="col-span-2 text-gray-900 font-medium bg-blue-50 px-2 py-0.5 rounded text-blue-800 inline-block selection:bg-blue-200">
                                            {reimbursement.additionalInfo || submitterZelle || 'Not provided'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Partial Info if present */}
                        {reimbursement.partialReason && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <h4 className="text-sm font-bold text-amber-800 mb-1 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Partial Approval Notes
                                </h4>
                                <p className="text-sm text-amber-900">{reimbursement.partialReason}</p>
                            </div>
                        )}

                        {/* Receipts List Selection */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 mb-4 flex justify-between">
                                <span>Receipts</span>
                                <span className="text-gray-500 font-medium text-xs">{receipts.length} items</span>
                            </h3>
                            <div className="space-y-3">
                                {receipts.map((r: any, idx: number) => (
                                    <div
                                        key={idx}
                                        onClick={() => setActiveReceiptIndex(idx)}
                                        className={`p-3 rounded-xl border cursor-pointer transition-all ${activeReceiptIndex === idx
                                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-semibold text-gray-900">{r.vendorName || 'Unknown Vendor'}</span>
                                            <span className="font-bold text-gray-900">${(r.total || 0).toFixed(2)}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 flex justify-between">
                                            <span>{r.dateOfPurchase ? new Date(r.dateOfPurchase).toLocaleDateString() : 'No date'}</span>
                                            <span>{r.receiptFile ? 'View File' : 'No File'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Audit Logs */}
                        {reimbursement.auditLogs && (
                            <div className="border-t border-gray-100 pt-6">
                                <h3 className="text-sm font-bold text-gray-900 mb-4">Audit History</h3>
                                <div className="space-y-4 relative pl-4 border-l-2 border-gray-100">
                                    {reimbursement.auditLogs.map((log: any, i: number) => (
                                        <div key={i} className="relative">
                                            <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-gray-300 border-2 border-white" />
                                            <p className="text-sm text-gray-800">{log.action}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {log.timestamp?.toDate().toLocaleString()} • {log.createdByName || 'System'}
                                            </p>
                                            {log.note && <p className="text-xs text-gray-600 italic mt-1 bg-gray-50 p-2 rounded">{log.note}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Receipt Viewer & Itemized Invoice */}
                <div className="w-7/12 bg-gray-100 flex flex-col h-full border-l border-gray-200">
                    <div className="bg-white border-b border-gray-200 px-4 pt-1">
                        <Tabs
                            aria-label="View Options"
                            variant="underlined"
                            classNames={{
                                cursor: "w-full bg-blue-600",
                                tabList: "gap-6",
                                tabContent: "group-data-[selected=true]:text-blue-600 font-medium"
                            }}
                        >
                            <Tab key="image" title="Receipt Image">
                                <div className="p-4 h-full overflow-hidden" style={{ height: 'calc(100vh - 180px)' }}>
                                    <ReceiptViewer
                                        url={currentReceipt?.receiptFile?.url || currentReceipt?.receiptFile}
                                        type={currentReceipt?.receiptFile?.type}
                                        fileName={currentReceipt?.receiptFile?.name || `Receipt-${activeReceiptIndex + 1}`}
                                        className="h-full shadow-lg"
                                    />
                                </div>
                            </Tab>
                            <Tab key="invoice" title="Itemized Invoice">
                                <div className="p-6 h-full overflow-y-auto" style={{ height: 'calc(100vh - 180px)' }}>
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                            <div>
                                                <h3 className="font-bold text-gray-900">{currentReceipt.vendorName || 'Unknown Vendor'}</h3>
                                                <p className="text-xs text-gray-500">{currentReceipt.dateOfPurchase ? new Date(currentReceipt.dateOfPurchase).toLocaleDateString() : 'No date'}</p>
                                            </div>
                                            <Chip size="sm" variant="flat" color="primary">Results from AI</Chip>
                                        </div>

                                        {/* Line Items Table */}
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                                                <tr>
                                                    <th className="text-left font-medium py-3 px-4">Item Description</th>
                                                    <th className="text-left font-medium py-3 px-4">Category</th>
                                                    <th className="text-right font-medium py-3 px-4">Qty</th>
                                                    <th className="text-right font-medium py-3 px-4">Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {currentReceipt.lineItems?.map((item: any, i: number) => (
                                                    <tr key={i} className="hover:bg-gray-50/50">
                                                        <td className="py-3 px-4 text-gray-900 font-medium">{item.description}</td>
                                                        <td className="py-3 px-4 text-gray-500">
                                                            <Chip size="sm" variant="flat" className="text-[10px] h-5">{item.category}</Chip>
                                                        </td>
                                                        <td className="py-3 px-4 text-right text-gray-500">{item.quantity || 1}</td>
                                                        <td className="py-3 px-4 text-right text-gray-900 font-mono">${(item.amount || 0).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                                {(!currentReceipt.lineItems || currentReceipt.lineItems.length === 0) && (
                                                    <tr>
                                                        <td colSpan={4} className="py-8 text-center text-gray-400 italic">No line items found</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>

                                        {/* Totals Breakdown */}
                                        <div className="bg-gray-50/80 p-4 border-t border-gray-100 space-y-2">
                                            <div className="flex justify-between text-xs text-gray-600">
                                                <span>Subtotal</span>
                                                <span>${(currentReceipt.subtotal || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-600">
                                                <span>Tax</span>
                                                <span>${(currentReceipt.tax || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-600">
                                                <span>Tip</span>
                                                <span>${(currentReceipt.tip || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-600">
                                                <span>Shipping</span>
                                                <span>${(currentReceipt.shipping || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-gray-600">
                                                <span>Other Charges</span>
                                                <span>${(currentReceipt.otherCharges || 0).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                                                <span>Receipt Total</span>
                                                <span>${(currentReceipt.total || 0).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Tab>
                        </Tabs>
                    </div>
                </div>
            </div>

            {/* Partial Reimbursement Modal */}
            <Modal
                isOpen={isPartialOpen}
                onClose={onPartialOpenChange}
                motionProps={{
                    variants: {
                        enter: {
                            scale: 1,
                            opacity: 1,
                            transition: {
                                duration: 0.2,
                                ease: "easeOut",
                            },
                        },
                        exit: {
                            scale: 0.95,
                            opacity: 0,
                            transition: {
                                duration: 0.1,
                                ease: "easeIn",
                            },
                        },
                    }
                }}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">Process Partial Reimbursement</ModalHeader>
                            <ModalBody>
                                <p className="text-sm text-gray-500 mb-4">
                                    Specify the approved amount and provide a reason for the adjustment.
                                    The original request total was <span className="font-bold text-gray-900">${reimbursement.totalAmount?.toFixed(2)}</span>.
                                </p>
                                <div className="space-y-4">
                                    <Input
                                        label="Approved Amount"
                                        placeholder="0.00"
                                        startContent={<DollarSign className="w-4 h-4 text-gray-400" />}
                                        type="number"
                                        variant="bordered"
                                        value={partialAmount}
                                        onChange={(e) => setPartialAmount(e.target.value)}
                                    />
                                    <Textarea
                                        label="Reason for Partial Approval"
                                        placeholder="e.g. Alcohol is not reimbursable..."
                                        variant="bordered"
                                        value={partialReason}
                                        onChange={(e) => setPartialReason(e.target.value)}
                                        minRows={3}
                                    />
                                </div>
                            </ModalBody>
                            <ModalFooter>
                                <Button color="danger" variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button color="primary" onPress={handlePartialSubmit} isLoading={isProcessing}>
                                    Confirm Partial Approval
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
            {/* Paid Confirmation Modal */}
            <Modal
                isOpen={isPaidOpen}
                onClose={() => { onPaidOpenChange(); setTimeout(resetPaidModal, 300); }}
                size={paymentReviewData ? "2xl" : "md"}
                motionProps={{
                    variants: {
                        enter: {
                            scale: 1,
                            opacity: 1,
                            transition: {
                                duration: 0.2,
                                ease: "easeOut",
                            },
                        },
                        exit: {
                            scale: 0.95,
                            opacity: 0,
                            transition: {
                                duration: 0.1,
                                ease: "easeIn",
                            },
                        },
                    }
                }}
            >
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="flex flex-col gap-1">
                                {paymentReviewData ? 'Review Payment Details' : 'Process Payment'}
                            </ModalHeader>
                            <ModalBody>
                                {paymentReviewData ? (
                                    <div className="flex gap-6">
                                        {/* Left: Inputs */}
                                        <div className="flex-1 space-y-4">
                                            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-3">
                                                <Sparkles className="w-5 h-5 text-blue-600 mt-0.5" />
                                                <div className="text-sm text-blue-800">
                                                    <p className="font-semibold">AI Extraction Complete</p>
                                                    <p className="opacity-80">Please verify the details below match the proof.</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <Input
                                                    label="Payment Date"
                                                    type="date"
                                                    variant="bordered"
                                                    value={paymentDate}
                                                    onChange={(e) => setPaymentDate(e.target.value)}
                                                />
                                                <Input
                                                    label="Amount Paid"
                                                    type="number"
                                                    variant="bordered"
                                                    startContent={<span className="text-gray-500">$</span>}
                                                    value={paymentAmount}
                                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                                />
                                            </div>

                                            <Input
                                                label="Confirmation Number"
                                                placeholder="Transaction ID"
                                                variant="bordered"
                                                value={paidConfirmationNumber}
                                                onChange={(e) => setPaidConfirmationNumber(e.target.value)}
                                                isRequired
                                            />

                                            <Textarea
                                                label="Memo / Notes"
                                                placeholder="Any additional notes"
                                                variant="bordered"
                                                value={paymentMemo}
                                                onChange={(e) => setPaymentMemo(e.target.value)}
                                                minRows={2}
                                            />
                                        </div>

                                        {/* Right: Preview */}
                                        <div className="w-1/3 shrink-0">
                                            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Proof Preview</p>
                                            <div className="border rounded-lg overflow-hidden h-64 bg-gray-100 flex items-center justify-center relative group">
                                                {uploadedProofUrl ? (
                                                    <img src={uploadedProofUrl} className="w-full h-full object-contain" alt="Proof" />
                                                ) : (
                                                    <FileText className="text-gray-400 w-12 h-12" />
                                                )}
                                                <a
                                                    href={uploadedProofUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium"
                                                >
                                                    View Full
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="py-6">
                                        <div
                                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${paidProofFile ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                                                }`}
                                        >
                                            <input
                                                type="file"
                                                id="payment-proof-upload"
                                                accept="image/*,application/pdf"
                                                onChange={(e) => setPaidProofFile(e.target.files ? e.target.files[0] : null)}
                                                className="hidden"
                                            />

                                            <label htmlFor="payment-proof-upload" className="cursor-pointer space-y-3 block">
                                                {paidProofFile ? (
                                                    <>
                                                        <CheckCircle className="w-12 h-12 text-blue-500 mx-auto" />
                                                        <div>
                                                            <p className="font-bold text-gray-900">{paidProofFile.name}</p>
                                                            <p className="text-sm text-gray-500">Ready to process</p>
                                                        </div>
                                                        <Button size="sm" color="danger" variant="light" onPress={() => setPaidProofFile(null)}>Remove</Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-2">
                                                            <UploadCloud className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900 text-lg">Upload Proof of Payment</p>
                                                            <p className="text-sm text-gray-500">Click to browse or paste screenshot (Ctrl+V)</p>
                                                        </div>
                                                        <div className="flex gap-2 justify-center mt-4">
                                                            <Chip size="sm" variant="flat">Use "Paste" for quick screenshots</Chip>
                                                        </div>
                                                    </>
                                                )}
                                            </label>
                                        </div>

                                        {/* Info about AI */}
                                        <div className="mt-6 flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100 items-start">
                                            <Sparkles className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
                                            <div className="text-xs text-gray-600">
                                                <p className="font-semibold text-gray-900">AI-Powered Extraction</p>
                                                <p>Upload a screenshot and our AI will automatically extract the confirmation number, date, and amount for you to review.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </ModalBody>
                            <ModalFooter>
                                <Button color="danger" variant="light" onPress={onClose}>
                                    Cancel
                                </Button>
                                <Button
                                    color="primary"
                                    onPress={handlePaidSubmit}
                                    isLoading={isProcessing || aiProcessing}
                                    className={aiProcessing ? "bg-purple-600" : ""}
                                    startContent={aiProcessing}
                                >
                                    {paymentReviewData ? 'Confirm Payment' : 'Process & Analyze'}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </div>
    );
}
