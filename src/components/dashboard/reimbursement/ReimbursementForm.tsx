import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { DataSyncService } from '../../../scripts/database/DataSyncService';
import { Collections } from '../../../schemas/pocketbase/schema';
import ReceiptForm from './ReceiptForm';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import FilePreview from '../universal/FilePreview';
import type { ItemizedExpense, Reimbursement, Receipt } from '../../../schemas/pocketbase';

interface ReceiptFormData {
    file: File;
    itemized_expenses: ItemizedExpense[];
    tax: number;
    date: string;
    location_name: string;
    location_address: string;
    notes: string;
}

// Extended Reimbursement interface with form-specific fields
interface ReimbursementRequest extends Partial<Omit<Reimbursement, 'receipts'>> {
    title: string;
    total_amount: number;
    date_of_purchase: string;
    payment_method: string;
    status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid' | 'in_progress';
    additional_info: string;
    receipts: string[];
    department: 'internal' | 'external' | 'projects' | 'events' | 'other';
}

const PAYMENT_METHODS = [
    'Personal Credit Card',
    'Personal Debit Card',
    'Cash',
    'Personal Check',
    'Other'
];

const DEPARTMENTS = [
    'internal',
    'external',
    'projects',
    'events',
    'other'
] as const;

const DEPARTMENT_LABELS = {
    internal: 'Internal',
    external: 'External',
    projects: 'Projects',
    events: 'Events',
    other: 'Other'
};

// Add these animation variants
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

export default function ReimbursementForm() {
    const [request, setRequest] = useState<ReimbursementRequest>({
        title: '',
        total_amount: 0,
        date_of_purchase: new Date().toISOString().split('T')[0],
        payment_method: '',
        status: 'submitted',
        additional_info: '',
        receipts: [],
        department: 'internal'
    });

    const [receipts, setReceipts] = useState<(ReceiptFormData & { id: string })[]>([]);
    const [showReceiptForm, setShowReceiptForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string>('');
    const [showReceiptDetails, setShowReceiptDetails] = useState(false);
    const [selectedReceiptDetails, setSelectedReceiptDetails] = useState<ReceiptFormData | null>(null);
    const [hasZelleInfo, setHasZelleInfo] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const auth = Authentication.getInstance();

    useEffect(() => {
        checkZelleInformation();
    }, []);

    const checkZelleInformation = async () => {
        try {
            setIsLoading(true);
            const pb = auth.getPocketBase();
            const userId = pb.authStore.model?.id;

            if (!userId) {
                // Silently return without error when on dashboard page
                if (window.location.pathname.includes('/dashboard')) {
                    setIsLoading(false);
                    return;
                }
                throw new Error('User not authenticated');
            }

            const user = await pb.collection('users').getOne(userId);
            setHasZelleInfo(!!user.zelle_information);
        } catch (error) {
            // Only log error if not on dashboard page or if it's not an authentication error
            if (!window.location.pathname.includes('/dashboard') ||
                !(error instanceof Error && error.message === 'User not authenticated')) {
                console.error('Error checking Zelle information:', error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="loading loading-spinner loading-lg text-primary"></div>
                <p className="mt-4 text-base-content/70">Loading...</p>
            </div>
        );
    }

    if (hasZelleInfo === false) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto text-center py-12"
            >
                <div className="card bg-base-200 p-8">
                    <Icon icon="heroicons:exclamation-triangle" className="h-16 w-16 mx-auto text-warning" />
                    <h2 className="text-2xl font-bold mt-6">Zelle Information Required</h2>
                    <p className="mt-4 text-base-content/70">
                        Before submitting a reimbursement request, you need to provide your Zelle information.
                        This is required for processing your reimbursement payments.
                    </p>
                    <div className="mt-8">
                        <button
                            className="btn btn-primary gap-2"
                            onClick={() => {
                                const profileBtn = document.querySelector('[data-section="settings"]') as HTMLButtonElement;
                                if (profileBtn) profileBtn.click();
                            }}
                        >
                            <Icon icon="heroicons:user-circle" className="h-5 w-5" />
                            Update Profile
                        </button>
                    </div>
                </div>
            </motion.div>
        );
    }

    const handleAddReceipt = async (receiptData: ReceiptFormData) => {
        try {
            const pb = auth.getPocketBase();
            const userId = pb.authStore.model?.id;

            if (!userId) {
                // Silently return without error when on dashboard page
                if (window.location.pathname.includes('/dashboard')) {
                    return;
                }
                toast.error('User not authenticated');
                throw new Error('User not authenticated');
            }

            // Create receipt record
            const formData = new FormData();
            formData.append('file', receiptData.file);
            formData.append('created_by', userId);
            formData.append('itemized_expenses', JSON.stringify(receiptData.itemized_expenses));
            formData.append('tax', receiptData.tax.toString());
            formData.append('date', new Date(receiptData.date).toISOString());
            formData.append('location_name', receiptData.location_name);
            formData.append('location_address', receiptData.location_address);
            formData.append('notes', receiptData.notes);

            const response = await pb.collection('receipts').create(formData);

            // Sync the receipts collection to update IndexedDB
            const dataSync = DataSyncService.getInstance();
            await dataSync.syncCollection(Collections.RECEIPTS);

            // Add receipt to state
            setReceipts(prev => [...prev, { ...receiptData, id: response.id }]);

            // Update total amount
            const totalAmount = receiptData.itemized_expenses.reduce((sum, item) => sum + item.amount, 0) + receiptData.tax;
            setRequest(prev => ({
                ...prev,
                total_amount: prev.total_amount + totalAmount,
                receipts: [...prev.receipts, response.id]
            }));

            setShowReceiptForm(false);
            toast.success('Receipt added successfully');
        } catch (error) {
            console.error('Error creating receipt:', error);
            toast.error('Failed to add receipt');
            setError('Failed to add receipt. Please try again.');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!request.title.trim()) {
            toast.error('Title is required');
            setError('Title is required');
            return;
        }
        if (!request.payment_method) {
            toast.error('Payment method is required');
            setError('Payment method is required');
            return;
        }
        if (receipts.length === 0) {
            toast.error('At least one receipt is required');
            setError('At least one receipt is required');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const pb = auth.getPocketBase();
            const userId = pb.authStore.model?.id;

            if (!userId) {
                // Silently return without error when on dashboard page
                if (window.location.pathname.includes('/dashboard')) {
                    setIsSubmitting(false);
                    return;
                }
                throw new Error('User not authenticated');
            }

            // Create reimbursement record
            const formData = new FormData();
            formData.append('title', request.title);
            formData.append('total_amount', request.total_amount.toString());
            formData.append('date_of_purchase', new Date(request.date_of_purchase).toISOString());
            formData.append('payment_method', request.payment_method);
            formData.append('status', 'submitted');
            formData.append('submitted_by', userId);
            formData.append('additional_info', request.additional_info);
            formData.append('receipts', JSON.stringify(request.receipts));
            formData.append('department', request.department);

            // Create the reimbursement record
            const newReimbursement = await pb.collection('reimbursement').create(formData);

            // Sync the reimbursements collection to update IndexedDB
            const dataSync = DataSyncService.getInstance();

            // Force sync with specific filter to ensure the new record is fetched
            await dataSync.syncCollection(
                Collections.REIMBURSEMENTS,
                `submitted_by="${userId}"`,
                '-created',
                'audit_notes'
            );

            // Verify the new record is in IndexedDB
            const syncedData = await dataSync.getData(
                Collections.REIMBURSEMENTS,
                true, // Force sync again to be sure
                `id="${newReimbursement.id}"`
            );

            if (syncedData.length === 0) {
                console.warn('New reimbursement not found in IndexedDB after sync, forcing another sync');
                // Try one more time with a slight delay
                setTimeout(async () => {
                    await dataSync.syncCollection(Collections.REIMBURSEMENTS);
                }, 500);
            }

            // Reset form
            setRequest({
                title: '',
                total_amount: 0,
                date_of_purchase: new Date().toISOString().split('T')[0],
                payment_method: '',
                status: 'submitted',
                additional_info: '',
                receipts: [],
                department: 'internal'
            });
            setReceipts([]);
            setError('');

            toast.success('🎉 Reimbursement request submitted successfully! Check "My Requests" to view it.', {
                duration: 5000,
                position: 'top-center',
                style: {
                    background: '#10B981',
                    color: '#FFFFFF',
                    padding: '16px',
                    borderRadius: '8px',
                }
            });

        } catch (error) {
            console.error('Error submitting reimbursement request:', error);
            toast.error('Failed to submit reimbursement request. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="max-w-4xl mx-auto"
            >
                <form onSubmit={handleSubmit} className="space-y-8">
                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                className="alert alert-error shadow-lg"
                            >
                                <Icon icon="heroicons:exclamation-circle" className="h-5 w-5" />
                                <span>{error}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Title */}
                        <div className="form-control md:col-span-2">
                            <label className="label">
                                <span className="label-text font-medium">Title</span>
                                <span className="label-text-alt text-error">*</span>
                            </label>
                            <input
                                type="text"
                                className="input input-bordered focus:input-primary transition-all duration-300"
                                value={request.title}
                                onChange={(e) => setRequest(prev => ({ ...prev, title: e.target.value }))}
                                required
                            />
                        </div>

                        {/* Date of Purchase */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Date of Purchase</span>
                                <span className="label-text-alt text-error">*</span>
                            </label>
                            <input
                                type="date"
                                className="input input-bordered focus:input-primary transition-all duration-300"
                                value={request.date_of_purchase}
                                onChange={(e) => setRequest(prev => ({ ...prev, date_of_purchase: e.target.value }))}
                                required
                            />
                        </div>

                        {/* Payment Method */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Payment Method</span>
                                <span className="label-text-alt text-error">*</span>
                            </label>
                            <select
                                className="select select-bordered focus:select-primary transition-all duration-300"
                                value={request.payment_method}
                                onChange={(e) => setRequest(prev => ({ ...prev, payment_method: e.target.value }))}
                                required
                            >
                                <option value="">Select payment method</option>
                                {PAYMENT_METHODS.map(method => (
                                    <option key={method} value={method}>{method}</option>
                                ))}
                            </select>
                        </div>

                        {/* Department */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Department</span>
                                <span className="label-text-alt text-error">*</span>
                            </label>
                            <select
                                className="select select-bordered focus:select-primary transition-all duration-300"
                                value={request.department}
                                onChange={(e) => setRequest(prev => ({ ...prev, department: e.target.value as typeof DEPARTMENTS[number] }))}
                                required
                            >
                                {DEPARTMENTS.map(dept => (
                                    <option key={dept} value={dept}>{DEPARTMENT_LABELS[dept]}</option>
                                ))}
                            </select>
                        </div>

                        {/* Additional Info */}
                        <div className="form-control md:col-span-2">
                            <label className="label">
                                <span className="label-text font-medium">Additional Information</span>
                            </label>
                            <textarea
                                className="textarea textarea-bordered focus:textarea-primary transition-all duration-300 min-h-[120px]"
                                value={request.additional_info}
                                onChange={(e) => setRequest(prev => ({ ...prev, additional_info: e.target.value }))}
                                rows={3}
                            />
                        </div>
                    </motion.div>

                    {/* Receipts */}
                    <motion.div variants={itemVariants} className="card bg-base-200/50 backdrop-blur-sm p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium">Receipts</h3>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                type="button"
                                className="btn btn-primary btn-sm gap-2 hover:shadow-lg transition-all duration-300"
                                onClick={() => setShowReceiptForm(true)}
                            >
                                <Icon icon="heroicons:plus" className="h-4 w-4" />
                                Add Receipt
                            </motion.button>
                        </div>

                        {receipts.length > 0 ? (
                            <motion.div layout className="grid gap-4">
                                <AnimatePresence>
                                    {receipts.map((receipt, index) => (
                                        <motion.div
                                            key={receipt.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            className="card bg-base-100 hover:bg-base-200 transition-all duration-300 shadow-sm"
                                        >
                                            <div className="card-body p-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-medium text-lg">{receipt.location_name}</h3>
                                                        <p className="text-sm text-base-content/70">{receipt.location_address}</p>
                                                        <p className="text-sm mt-2">
                                                            Total: <span className="font-mono font-medium text-primary">${(receipt.itemized_expenses.reduce((sum, item) => sum + item.amount, 0) + receipt.tax).toFixed(2)}</span>
                                                        </p>
                                                    </div>
                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        type="button"
                                                        className="btn btn-ghost btn-sm gap-2"
                                                        onClick={() => {
                                                            setSelectedReceiptDetails(receipt);
                                                            setShowReceiptDetails(true);
                                                        }}
                                                    >
                                                        <Icon icon="heroicons:eye" className="h-4 w-4" />
                                                        View Details
                                                    </motion.button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-12 bg-base-100 rounded-lg"
                            >
                                <Icon icon="heroicons:receipt" className="h-16 w-16 mx-auto text-base-content/30" />
                                <h3 className="mt-4 text-lg font-medium">No receipts added</h3>
                                <p className="text-base-content/70 mt-2">Add receipts to continue</p>
                            </motion.div>
                        )}

                        {receipts.length > 0 && (
                            <div className="mt-4 p-4 bg-base-100 rounded-lg">
                                <div className="flex justify-between items-center text-lg font-medium">
                                    <span>Total Amount:</span>
                                    <span className="font-mono text-primary">${request.total_amount.toFixed(2)}</span>
                                </div>
                            </div>
                        )}
                    </motion.div>

                    {/* Submit Button */}
                    <motion.div
                        variants={itemVariants}
                        className="mt-8"
                    >
                        <motion.button
                            whileHover={{ scale: 1.01, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)" }}
                            whileTap={{ scale: 0.99 }}
                            type="submit"
                            className="btn btn-primary w-full h-12 shadow-md hover:shadow-lg transition-all duration-300 text-lg"
                            disabled={isSubmitting || receipts.length === 0}
                        >
                            {isSubmitting ? (
                                <span className="loading loading-spinner loading-md"></span>
                            ) : (
                                <>
                                    <Icon icon="heroicons:paper-airplane" className="h-5 w-5" />
                                    Submit Reimbursement Request
                                </>
                            )}
                        </motion.button>
                    </motion.div>
                </form>

                {/* Receipt Form Modal */}
                <AnimatePresence>
                    {showReceiptForm && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="modal modal-open"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="modal-box max-w-5xl bg-base-100/95 backdrop-blur-md"
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Add Receipt</h3>
                                    <motion.button
                                        whileHover={{ scale: 1.1, rotate: 90 }}
                                        whileTap={{ scale: 0.9 }}
                                        className="btn btn-ghost btn-sm btn-circle"
                                        onClick={() => setShowReceiptForm(false)}
                                    >
                                        <Icon icon="heroicons:x-mark" className="h-5 w-5" />
                                    </motion.button>
                                </div>
                                <ReceiptForm
                                    onSubmit={handleAddReceipt}
                                    onCancel={() => setShowReceiptForm(false)}
                                />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Receipt Details Modal */}
                <AnimatePresence>
                    {showReceiptDetails && selectedReceiptDetails && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="modal modal-open"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="modal-box max-w-4xl bg-base-100/95 backdrop-blur-md"
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                                        Receipt Details
                                    </h3>
                                    <motion.button
                                        whileHover={{ scale: 1.1, rotate: 90 }}
                                        whileTap={{ scale: 0.9 }}
                                        className="btn btn-ghost btn-sm btn-circle"
                                        onClick={() => {
                                            setShowReceiptDetails(false);
                                            setSelectedReceiptDetails(null);
                                        }}
                                    >
                                        <Icon icon="heroicons:x-mark" className="h-5 w-5" />
                                    </motion.button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium">Location</label>
                                            <p className="mt-1">{selectedReceiptDetails.location_name}</p>
                                            <p className="text-sm text-base-content/70">{selectedReceiptDetails.location_address}</p>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium">Date</label>
                                            <p className="mt-1">{new Date(selectedReceiptDetails.date).toLocaleDateString()}</p>
                                        </div>

                                        {selectedReceiptDetails.notes && (
                                            <div>
                                                <label className="text-sm font-medium">Notes</label>
                                                <p className="mt-1">{selectedReceiptDetails.notes}</p>
                                            </div>
                                        )}

                                        <div>
                                            <label className="text-sm font-medium">Itemized Expenses</label>
                                            <div className="mt-2 space-y-2">
                                                {selectedReceiptDetails.itemized_expenses.map((item, index) => (
                                                    <div key={index} className="card bg-base-200 p-3">
                                                        <div className="grid grid-cols-3 gap-4">
                                                            <div>
                                                                <label className="text-xs font-medium">Description</label>
                                                                <p>{item.description}</p>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-medium">Category</label>
                                                                <p>{item.category}</p>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-medium">Amount</label>
                                                                <p>${item.amount.toFixed(2)}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium">Tax</label>
                                                <p className="mt-1">${selectedReceiptDetails.tax.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium">Total</label>
                                                <p className="mt-1">${(selectedReceiptDetails.itemized_expenses.reduce((sum, item) => sum + item.amount, 0) + selectedReceiptDetails.tax).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="border-l border-base-300 pl-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-medium">Receipt Image</h3>
                                        </div>
                                        <div className="bg-base-200/50 backdrop-blur-sm rounded-lg p-4 shadow-sm">
                                            <FilePreview
                                                url={URL.createObjectURL(selectedReceiptDetails.file)}
                                                filename={selectedReceiptDetails.file.name}
                                                isModal={false}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </>
    );
} 