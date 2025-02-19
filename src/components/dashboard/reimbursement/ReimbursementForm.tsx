import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import ReceiptForm from './ReceiptForm';

interface ExpenseItem {
    description: string;
    amount: number;
    category: string;
}

interface ReceiptFormData {
    field: File;
    itemized_expenses: ExpenseItem[];
    tax: number;
    date: string;
    location_name: string;
    location_address: string;
    notes: string;
}

interface ReimbursementRequest {
    id?: string;
    title: string;
    total_amount: number;
    date_of_purchase: string;
    payment_method: string;
    status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid' | 'in_progress';
    submitted_by?: string;
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

    const auth = Authentication.getInstance();

    const handleAddReceipt = async (receiptData: ReceiptFormData) => {
        try {
            const pb = auth.getPocketBase();
            const userId = pb.authStore.model?.id;

            if (!userId) {
                throw new Error('User not authenticated');
            }

            // Create receipt record
            const formData = new FormData();
            formData.append('field', receiptData.field);
            formData.append('created_by', userId);
            formData.append('itemized_expenses', JSON.stringify(receiptData.itemized_expenses));
            formData.append('tax', receiptData.tax.toString());
            formData.append('date', new Date(receiptData.date).toISOString());
            formData.append('location_name', receiptData.location_name);
            formData.append('location_address', receiptData.location_address);
            formData.append('notes', receiptData.notes);

            const response = await pb.collection('receipts').create(formData);

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
        } catch (error) {
            console.error('Error creating receipt:', error);
            setError('Failed to add receipt. Please try again.');
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!request.title.trim()) {
            setError('Title is required');
            return;
        }
        if (!request.payment_method) {
            setError('Payment method is required');
            return;
        }
        if (receipts.length === 0) {
            setError('At least one receipt is required');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const pb = auth.getPocketBase();
            const userId = pb.authStore.model?.id;

            if (!userId) {
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

            await pb.collection('reimbursement').create(formData);

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

            // Show success message
            alert('Reimbursement request submitted successfully!');
        } catch (error) {
            console.error('Error submitting reimbursement request:', error);
            setError('Failed to submit reimbursement request. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="alert alert-error">
                        <Icon icon="heroicons:exclamation-circle" className="h-5 w-5" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Title */}
                <div className="form-control">
                    <label className="label">
                        <span className="label-text">Title</span>
                        <span className="label-text-alt text-error">*</span>
                    </label>
                    <input
                        type="text"
                        className="input input-bordered"
                        value={request.title}
                        onChange={(e) => setRequest(prev => ({ ...prev, title: e.target.value }))}
                        required
                    />
                </div>

                {/* Date of Purchase */}
                <div className="form-control">
                    <label className="label">
                        <span className="label-text">Date of Purchase</span>
                        <span className="label-text-alt text-error">*</span>
                    </label>
                    <input
                        type="date"
                        className="input input-bordered"
                        value={request.date_of_purchase}
                        onChange={(e) => setRequest(prev => ({ ...prev, date_of_purchase: e.target.value }))}
                        required
                    />
                </div>

                {/* Payment Method */}
                <div className="form-control">
                    <label className="label">
                        <span className="label-text">Payment Method</span>
                        <span className="label-text-alt text-error">*</span>
                    </label>
                    <select
                        className="select select-bordered"
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
                        <span className="label-text">Department</span>
                        <span className="label-text-alt text-error">*</span>
                    </label>
                    <select
                        className="select select-bordered"
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
                <div className="form-control">
                    <label className="label">
                        <span className="label-text">Additional Information</span>
                    </label>
                    <textarea
                        className="textarea textarea-bordered"
                        value={request.additional_info}
                        onChange={(e) => setRequest(prev => ({ ...prev, additional_info: e.target.value }))}
                        rows={3}
                    />
                </div>

                {/* Receipts */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="label-text font-medium">Receipts</label>
                        <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => setShowReceiptForm(true)}
                        >
                            <Icon icon="heroicons:plus" className="h-4 w-4" />
                            Add Receipt
                        </button>
                    </div>

                    {receipts.length > 0 ? (
                        <div className="grid gap-4">
                            {receipts.map((receipt, index) => (
                                <div
                                    key={receipt.id}
                                    className="card bg-base-200 p-4"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-medium">{receipt.location_name}</h3>
                                            <p className="text-sm text-base-content/70">{receipt.location_address}</p>
                                            <p className="text-sm">
                                                Total: ${(receipt.itemized_expenses.reduce((sum, item) => sum + item.amount, 0) + receipt.tax).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-sm"
                                                onClick={() => {
                                                    // Show receipt details in modal
                                                    // TODO: Implement receipt details view
                                                }}
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 bg-base-200 rounded-lg">
                            <Icon icon="heroicons:receipt" className="h-12 w-12 mx-auto text-base-content/50" />
                            <h3 className="mt-4 text-lg font-medium">No receipts added</h3>
                            <p className="text-base-content/70">Add receipts to continue</p>
                        </div>
                    )}
                </div>

                {/* Total */}
                <div className="text-right">
                    <p className="text-lg font-medium">
                        Total Amount: ${request.total_amount.toFixed(2)}
                    </p>
                </div>

                {/* Submit Button */}
                <div className="mt-6">
                    <button
                        type="submit"
                        className={`btn btn-primary w-full ${isSubmitting ? 'loading' : ''}`}
                        disabled={isSubmitting || receipts.length === 0}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Reimbursement Request'}
                    </button>
                </div>
            </form>

            {/* Receipt Form Modal */}
            {showReceiptForm && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-5xl">
                        <h3 className="font-bold text-lg mb-4">Add Receipt</h3>
                        <ReceiptForm
                            onSubmit={handleAddReceipt}
                            onCancel={() => setShowReceiptForm(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
} 