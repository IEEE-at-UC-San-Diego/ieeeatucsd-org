import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, ChevronLeft, ChevronRight, DollarSign, CheckCircle, FileText, ExternalLink, Calendar, CreditCard } from 'lucide-react';
import { Button, Input, Select, SelectItem, Chip, ScrollShadow, Divider, Tabs, Tab } from '@heroui/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../../firebase/client';
import { showToast } from '../../shared/utils/toast';
import ReceiptViewer from './components/ReceiptViewer';

interface ReimbursementDetailsPageProps {
    reimbursement: any;
    onBack: () => void;
    userRole?: string;
    onUpdate?: (id: string, status: string, auditNote?: string, paymentInfo?: any) => void;
}

export default function ReimbursementDetailsPage({
    reimbursement,
    onBack,
    onUpdate
}: ReimbursementDetailsPageProps) {
    const [activeReceiptIndex, setActiveReceiptIndex] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [editedReimbursement, setEditedReimbursement] = useState(reimbursement);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        setEditedReimbursement(reimbursement);
        setActiveReceiptIndex(0);
        setHasChanges(false);
    }, [reimbursement]);

    // Receipt Navigation
    const receipts = editedReimbursement.receipts || [];
    const currentReceipt = receipts[activeReceiptIndex] || {};
    const hasReceipts = receipts.length > 0;
    const currentLineItems = currentReceipt.lineItems || [];

    // Helper to calculate totals
    const calculateReceiptTotal = (receipt: any) => {
        if (!receipt) return 0;
        return (receipt.subtotal || 0) + (receipt.tax || 0) + (receipt.tip || 0) + (receipt.shipping || 0) + (receipt.otherCharges || 0);
    };

    // Handle Field Updates
    const handleReceiptUpdate = (field: string, value: any) => {
        const updatedReceipts = [...receipts];
        updatedReceipts[activeReceiptIndex] = {
            ...updatedReceipts[activeReceiptIndex],
            [field]: value
        };

        // Recalculate total if amount changes
        let newTotalAmount = editedReimbursement.totalAmount;
        if (field === 'total') {
            newTotalAmount = updatedReceipts.reduce((sum: number, r: any) => sum + (parseFloat(r.total) || 0), 0);
        }

        setEditedReimbursement({
            ...editedReimbursement,
            receipts: updatedReceipts,
            totalAmount: newTotalAmount
        });
        setHasChanges(true);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const docRef = doc(db, 'reimbursements', reimbursement.id);
            await updateDoc(docRef, {
                receipts: editedReimbursement.receipts,
                totalAmount: editedReimbursement.totalAmount,
                updatedAt: new Date()
            });
            showToast.success('Changes Saved', 'Reimbursement details updated successfully.');
            setHasChanges(false);
            if (onUpdate) onUpdate(reimbursement.id, reimbursement.status); // Trigger refresh if needed
        } catch (error) {
            console.error("Error saving reimbursement:", error);
            showToast.error('Save Failed', 'Could not update reimbursement details.');
        } finally {
            setIsSaving(false);
        }
    };

    // Format date for input field (YYYY-MM-DD)
    const formatDateForInput = (dateVal: any) => {
        if (!dateVal) return '';
        try {
            // Handle Firestore Timestamp or Date object or ISO string
            const date = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
            if (isNaN(date.getTime())) return '';
            return date.toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 absolute inset-0 z-10 overflow-hidden">
            {/* Top Navigation / Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0 h-16 box-border">
                <div className="flex items-center gap-4">
                    <Button
                        variant="light"
                        isIconOnly
                        onClick={() => {
                            if (hasChanges && !window.confirm("You have unsaved changes. Are you sure you want to leave?")) return;
                            onBack();
                        }}
                        className="-ml-2 text-gray-500 hover:text-blue-600"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-bold text-gray-900 leading-tight truncate max-w-[300px]" title={editedReimbursement.title}>
                                {editedReimbursement.title}
                            </h1>
                            <Chip size="sm" variant="flat" color={editedReimbursement.status === 'approved' ? 'success' : 'warning'} className="uppercase font-bold text-[10px] h-5">
                                {editedReimbursement.status}
                            </Chip>
                        </div>
                        <p className="text-xs text-gray-500 leading-tight">
                            ID: {editedReimbursement.id.slice(0, 8)} • {editedReimbursement.department}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right mr-2 hidden sm:block">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Amount</p>
                        <p className="text-xl font-bold text-gray-900 leading-none">${editedReimbursement.totalAmount?.toFixed(2)}</p>
                    </div>

                    <Button
                        color="primary"
                        className="font-semibold bg-[#0078D4]"
                        isDisabled={!hasChanges}
                        isLoading={isSaving}
                        onClick={handleSave}
                        startContent={!isSaving && <Save className="w-4 h-4" />}
                        size="sm"
                    >
                        Save
                    </Button>
                </div>
            </header>

            {/* Content Area - Split View */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel: Form / Details */}
                <div className="w-1/2 flex flex-col border-r border-gray-200 bg-white overflow-hidden">
                    {/* Navigation Bar for Receipts */}
                    {hasReceipts && (
                        <div className="flex items-center justify-between px-6 py-2 border-b border-gray-100 bg-gray-50 h-12 shrink-0">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                                Receipt {activeReceiptIndex + 1} of {receipts.length}
                            </span>
                            <div className="flex gap-1">
                                <Button
                                    size="sm"
                                    variant="flat"
                                    isIconOnly
                                    className="h-7 w-7 min-w-0"
                                    isDisabled={activeReceiptIndex === 0}
                                    onClick={() => setActiveReceiptIndex(prev => prev - 1)}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="flat"
                                    isIconOnly
                                    className="h-7 w-7 min-w-0"
                                    isDisabled={activeReceiptIndex === receipts.length - 1}
                                    onClick={() => setActiveReceiptIndex(prev => prev + 1)}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto">
                        <div className="px-6 py-6 space-y-8 max-w-2xl mx-auto w-full">
                            {/* Payment Information (New) */}
                            {editedReimbursement.status === 'paid' && editedReimbursement.paymentDetails && (
                                <section className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
                                    <div className="flex items-center gap-2 border-b border-green-100 pb-2 mb-2">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                        <h3 className="text-sm font-bold text-green-900 uppercase tracking-wide">
                                            Payment Confirmation
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                        <div>
                                            <p className="text-xs font-semibold text-green-700 uppercase mb-1">Confirmation Number</p>
                                            <p className="text-sm font-mono font-medium text-gray-900 bg-white/50 px-2 py-1 rounded border border-green-100 inline-block">
                                                {editedReimbursement.paymentDetails.confirmationNumber}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-green-700 uppercase mb-1">Payment Date</p>
                                            <div className="flex items-center gap-1.5 text-sm text-gray-900">
                                                <Calendar className="w-4 h-4 text-green-500" />
                                                <span>
                                                    {editedReimbursement.paymentDetails.paymentDate?.toDate
                                                        ? editedReimbursement.paymentDetails.paymentDate.toDate().toLocaleDateString()
                                                        : new Date(editedReimbursement.paymentDetails.paymentDate).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-green-700 uppercase mb-1">Amount Paid</p>
                                            <p className="text-lg font-bold text-gray-900 flex items-center gap-1">
                                                <span className="text-green-600 text-sm">$</span>
                                                {editedReimbursement.paymentDetails.amountPaid?.toFixed(2)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-semibold text-green-700 uppercase mb-1">Payment Proof</p>
                                            {editedReimbursement.paymentDetails.proofFileUrl ? (
                                                <a
                                                    href={editedReimbursement.paymentDetails.proofFileUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                    View Proof Document
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            ) : (
                                                <span className="text-sm text-gray-500 italic">No proof attached</span>
                                            )}
                                        </div>
                                        {editedReimbursement.paymentDetails.memo && (
                                            <div className="col-span-2 mt-1">
                                                <p className="text-xs font-semibold text-green-700 uppercase mb-1">Memo</p>
                                                <p className="text-sm text-gray-700 bg-white/50 p-2 rounded border border-green-100">
                                                    {editedReimbursement.paymentDetails.memo}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            )}

                            {/* Section 1: Vendor & Date */}
                            <section className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4 uppercase tracking-wide">
                                    Receipt Details
                                </h3>
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-gray-600 uppercase">Vendor Name</p>
                                        <Input
                                            placeholder="e.g. Amazon"
                                            value={currentReceipt.vendorName || ''}
                                            onChange={(e) => handleReceiptUpdate('vendorName', e.target.value)}
                                            variant="bordered"
                                            radius="md"
                                            classNames={{
                                                inputWrapper: "bg-white border-gray-300 hover:border-gray-400 focus-within:!border-blue-500 shadow-sm transition-all"
                                            }}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-gray-600 uppercase">Date of Purchase</p>
                                        <Input
                                            type="date"
                                            value={formatDateForInput(currentReceipt.dateOfPurchase)}
                                            onChange={(e) => handleReceiptUpdate('dateOfPurchase', new Date(e.target.value))}
                                            variant="bordered"
                                            radius="md"
                                            classNames={{
                                                inputWrapper: "bg-white border-gray-300 hover:border-gray-400 focus-within:!border-blue-500 shadow-sm transition-all"
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Location / City</p>
                                    <Input
                                        value={currentReceipt.location || ''}
                                        onChange={(e) => handleReceiptUpdate('location', e.target.value)}
                                        variant="bordered"
                                        radius="md"
                                        classNames={{
                                            inputWrapper: "bg-white border-gray-300 hover:border-gray-400 focus-within:!border-blue-500 shadow-sm transition-all"
                                        }}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Payment Method</p>
                                    <Input
                                        value={editedReimbursement.paymentMethod || ''}
                                        variant="bordered"
                                        radius="md"
                                        isReadOnly
                                        classNames={{
                                            inputWrapper: "bg-white border-gray-300 hover:border-gray-400 focus-within:!border-blue-500 shadow-sm transition-all"
                                        }}
                                    />
                                </div>
                                {editedReimbursement.paymentMethod !== 'Check' && editedReimbursement.paymentMethod !== 'Cash' && editedReimbursement.paymentMethod !== 'Personal Credit Card' && (
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-gray-600 uppercase">Additional Info (Zelle/etc)</p>
                                        <Input
                                            value={editedReimbursement.additionalInfo || ''}
                                            placeholder="Not provided"
                                            variant="bordered"
                                            radius="md"
                                            isReadOnly
                                            classNames={{
                                                inputWrapper: "bg-white border-gray-300 hover:border-gray-400 focus-within:!border-blue-500 shadow-sm transition-all"
                                            }}
                                        />
                                    </div>
                                )}
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold text-gray-600 uppercase">Business Purpose</p>
                                    <Input
                                        value={editedReimbursement.businessPurpose || ''}
                                        variant="bordered"
                                        radius="md"
                                        isReadOnly
                                        classNames={{
                                            inputWrapper: "bg-white border-gray-300 hover:border-gray-400 focus-within:!border-blue-500 shadow-sm transition-all"
                                        }}
                                    />
                                </div>

                            </section>

                            {/* Section 2: Amounts */}
                            <section className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4 uppercase tracking-wide">
                                    Financials
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-gray-600 uppercase">Subtotal</p>
                                        <Input
                                            type="number"
                                            value={currentReceipt.subtotal?.toString() || ''}
                                            variant="bordered"
                                            radius="md"
                                            isReadOnly
                                            startContent={<span className="text-gray-400 text-xs">$</span>}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-gray-600 uppercase">Tax</p>
                                        <Input
                                            type="number"
                                            value={currentReceipt.tax?.toString() ?? '0'}
                                            onChange={(e) => handleReceiptUpdate('tax', parseFloat(e.target.value) || 0)}
                                            variant="bordered"
                                            radius="md"
                                            startContent={<span className="text-gray-400 text-xs">$</span>}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-gray-600 uppercase">Tip</p>
                                        <Input
                                            type="number"
                                            value={currentReceipt.tip?.toString() ?? '0'}
                                            onChange={(e) => handleReceiptUpdate('tip', parseFloat(e.target.value) || 0)}
                                            variant="bordered"
                                            radius="md"
                                            startContent={<span className="text-gray-400 text-xs">$</span>}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-gray-600 uppercase">Shipping</p>
                                        <Input
                                            type="number"
                                            value={currentReceipt.shipping?.toString() ?? '0'}
                                            onChange={(e) => handleReceiptUpdate('shipping', parseFloat(e.target.value) || 0)}
                                            variant="bordered"
                                            radius="md"
                                            startContent={<span className="text-gray-400 text-xs">$</span>}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-gray-600 uppercase">Other</p>
                                        <Input
                                            type="number"
                                            value={currentReceipt.otherCharges?.toString() ?? '0'}
                                            onChange={(e) => handleReceiptUpdate('otherCharges', parseFloat(e.target.value) || 0)}
                                            variant="bordered"
                                            radius="md"
                                            startContent={<span className="text-gray-400 text-xs">$</span>}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-green-700 uppercase">Total</p>
                                        <Input
                                            type="number"
                                            value={calculateReceiptTotal(currentReceipt).toFixed(2)}
                                            variant="bordered"
                                            isReadOnly
                                            classNames={{
                                                input: "font-bold text-green-600"
                                            }}
                                            startContent={<span className="text-green-600 text-xs font-bold">$</span>}
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Section 3: Line Items (Read Only for now mostly) */}
                            <section className="space-y-4">
                                <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4 uppercase tracking-wide flex justify-between items-center">
                                    <span>Line Items</span>
                                    <span className="text-xs font-normal text-gray-400 normal-case">{currentLineItems.length} items</span>
                                </h3>
                                {currentLineItems.length > 0 ? (
                                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                                                <tr>
                                                    <th className="px-4 py-2">Item</th>
                                                    <th className="px-4 py-2 text-center">Qty</th>
                                                    <th className="px-4 py-2 text-right">Price</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {currentLineItems.map((item: any, idx: number) => (
                                                    <tr key={idx} className="bg-white">
                                                        <td className="px-4 py-2">
                                                            <div className="font-medium text-gray-900">{item.description}</div>
                                                            <div className="text-xs text-gray-500">{item.category}</div>
                                                        </td>
                                                        <td className="px-4 py-2 text-center text-gray-600">{item.quantity}</td>
                                                        <td className="px-4 py-2 text-right text-gray-900 font-medium">${parseFloat(item.amount).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">No line items detailed.</p>
                                )}
                            </section>


                        </div>
                    </div>
                </div>

                {/* Right Panel: Viewer */}
                <div className="w-1/2 bg-gray-100 p-4 border-l border-gray-200 h-full overflow-hidden">
                    <ReceiptViewer
                        url={typeof currentReceipt.receiptFile === 'string' ? currentReceipt.receiptFile : currentReceipt.receiptFile?.url}
                        type={currentReceipt.receiptFile?.type}
                        fileName={currentReceipt.receiptFile?.name}
                    />
                </div>
            </div>
        </div>
    );
}
