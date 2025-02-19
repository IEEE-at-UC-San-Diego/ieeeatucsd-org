import React, { useState, useCallback } from 'react';
import { Icon } from '@iconify/react';
import FilePreview from '../universal/FilePreview';
import { FileManager } from '../../../scripts/pocketbase/FileManager';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Update } from '../../../scripts/pocketbase/Update';

interface ExpenseItem {
    description: string;
    amount: number;
    category: string;
}

interface ReimbursementRequest {
    id?: string;
    title: string;
    total_amount: number;
    date_of_purchase: string;
    payment_method: string;
    status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
    expense_items: ExpenseItem[];
    receipts: string[];
    submitted_by?: string;
}

const EXPENSE_CATEGORIES = [
    'Travel',
    'Meals',
    'Supplies',
    'Equipment',
    'Software',
    'Event Expenses',
    'Other'
];

const PAYMENT_METHODS = [
    'Personal Credit Card',
    'Personal Debit Card',
    'Cash',
    'Personal Check',
    'Other'
];

const MAX_REIMBURSEMENT_AMOUNT = 1000; // Maximum amount in dollars

export default function ReimbursementForm() {
    const [request, setRequest] = useState<ReimbursementRequest>({
        title: '',
        total_amount: 0,
        date_of_purchase: new Date().toISOString().split('T')[0],
        payment_method: '',
        status: 'draft',
        expense_items: [{ description: '', amount: 0, category: '' }],
        receipts: []
    });

    const [selectedFiles, setSelectedFiles] = useState<Map<string, File>>(new Map());
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [previewFilename, setPreviewFilename] = useState<string>('');
    const [showPreview, setShowPreview] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string>('');

    const fileManager = FileManager.getInstance();
    const auth = Authentication.getInstance();
    const update = Update.getInstance();

    const handleExpenseItemChange = (index: number, field: keyof ExpenseItem, value: string | number) => {
        const newExpenseItems = [...request.expense_items];
        newExpenseItems[index] = {
            ...newExpenseItems[index],
            [field]: value
        };

        // Recalculate total amount
        const newTotalAmount = newExpenseItems.reduce((sum, item) => sum + Number(item.amount), 0);

        setRequest(prev => ({
            ...prev,
            expense_items: newExpenseItems,
            total_amount: newTotalAmount
        }));
    };

    const addExpenseItem = () => {
        setRequest(prev => ({
            ...prev,
            expense_items: [...prev.expense_items, { description: '', amount: 0, category: '' }]
        }));
    };

    const removeExpenseItem = (index: number) => {
        if (request.expense_items.length === 1) {
            return; // Keep at least one expense item
        }

        const newExpenseItems = request.expense_items.filter((_, i) => i !== index);
        const newTotalAmount = newExpenseItems.reduce((sum, item) => sum + Number(item.amount), 0);

        setRequest(prev => ({
            ...prev,
            expense_items: newExpenseItems,
            total_amount: newTotalAmount
        }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = new Map(selectedFiles);
            Array.from(e.target.files).forEach(file => {
                // Validate file type
                if (!file.type.match('image/*') && file.type !== 'application/pdf') {
                    setError('Only images and PDF files are allowed');
                    return;
                }
                // Validate file size (5MB limit)
                if (file.size > 5 * 1024 * 1024) {
                    setError('File size must be less than 5MB');
                    return;
                }
                newFiles.set(file.name, file);
            });
            setSelectedFiles(newFiles);
            setError('');
        }
    };

    const handlePreviewFile = (url: string, filename: string) => {
        setPreviewUrl(url);
        setPreviewFilename(filename);
        setShowPreview(true);
    };

    const validateForm = (): boolean => {
        if (!request.title.trim()) {
            setError('Title is required');
            return false;
        }
        if (!request.payment_method) {
            setError('Payment method is required');
            return false;
        }
        if (request.total_amount <= 0) {
            setError('Total amount must be greater than 0');
            return false;
        }
        if (request.total_amount > MAX_REIMBURSEMENT_AMOUNT) {
            setError(`Total amount cannot exceed $${MAX_REIMBURSEMENT_AMOUNT}`);
            return false;
        }
        if (request.expense_items.some(item => !item.description || !item.category || item.amount <= 0)) {
            setError('All expense items must be filled out completely');
            return false;
        }
        if (selectedFiles.size === 0 && request.receipts.length === 0) {
            setError('At least one receipt is required');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!validateForm()) {
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
            formData.append('status', 'draft');
            formData.append('expense_items', JSON.stringify(request.expense_items));
            formData.append('submitted_by', userId);

            // Upload files
            Array.from(selectedFiles.values()).forEach(file => {
                formData.append('receipts', file);
            });

            // Submit the request
            const response = await pb.collection('reimbursement').create(formData);

            // Reset form
            setRequest({
                title: '',
                total_amount: 0,
                date_of_purchase: new Date().toISOString().split('T')[0],
                payment_method: '',
                status: 'draft',
                expense_items: [{ description: '', amount: 0, category: '' }],
                receipts: []
            });
            setSelectedFiles(new Map());
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

            {/* Expense Items */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <label className="label-text font-medium">Expense Items</label>
                    <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={addExpenseItem}
                    >
                        <Icon icon="heroicons:plus" className="h-4 w-4" />
                        Add Item
                    </button>
                </div>

                {request.expense_items.map((item, index) => (
                    <div key={index} className="card bg-base-200 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Description</span>
                                </label>
                                <input
                                    type="text"
                                    className="input input-bordered"
                                    value={item.description}
                                    onChange={(e) => handleExpenseItemChange(index, 'description', e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Category</span>
                                </label>
                                <select
                                    className="select select-bordered"
                                    value={item.category}
                                    onChange={(e) => handleExpenseItemChange(index, 'category', e.target.value)}
                                    required
                                >
                                    <option value="">Select category</option>
                                    {EXPENSE_CATEGORIES.map(category => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Amount ($)</span>
                                </label>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="number"
                                        className="input input-bordered"
                                        value={item.amount}
                                        onChange={(e) => handleExpenseItemChange(index, 'amount', Number(e.target.value))}
                                        min="0"
                                        step="0.01"
                                        required
                                    />
                                    {request.expense_items.length > 1 && (
                                        <button
                                            type="button"
                                            className="btn btn-square btn-sm btn-error"
                                            onClick={() => removeExpenseItem(index)}
                                        >
                                            <Icon icon="heroicons:trash" className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                <div className="text-right">
                    <p className="text-lg font-medium">
                        Total Amount: ${request.total_amount.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Receipt Upload */}
            <div className="form-control">
                <label className="label">
                    <span className="label-text">Upload Receipts</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <input
                    type="file"
                    className="file-input file-input-bordered w-full"
                    onChange={handleFileChange}
                    accept="image/*,.pdf"
                    multiple
                />
                <label className="label">
                    <span className="label-text-alt">Accepted formats: Images and PDF files (max 5MB each)</span>
                </label>

                {/* Selected Files Preview */}
                <div className="mt-4 space-y-2">
                    {Array.from(selectedFiles.entries()).map(([name, file]) => (
                        <div key={name} className="flex items-center justify-between p-2 bg-base-200 rounded-lg">
                            <span className="truncate">{name}</span>
                            <div className="flex gap-2">
                                <div className="badge badge-primary">New</div>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-xs text-error"
                                    onClick={() => {
                                        const updatedFiles = new Map(selectedFiles);
                                        updatedFiles.delete(name);
                                        setSelectedFiles(updatedFiles);
                                    }}
                                >
                                    <Icon icon="heroicons:x-circle" className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Submit Button */}
            <div className="mt-6">
                <button
                    type="submit"
                    className={`btn btn-primary w-full ${isSubmitting ? 'loading' : ''}`}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Reimbursement Request'}
                </button>
            </div>

            {/* File Preview Modal */}
            {showPreview && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-4xl">
                        <FilePreview
                            url={previewUrl}
                            filename={previewFilename}
                            isModal={true}
                        />
                        <div className="modal-action">
                            <button
                                className="btn"
                                onClick={() => setShowPreview(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </form>
    );
} 