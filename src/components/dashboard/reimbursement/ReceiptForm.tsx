import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import FilePreview from '../universal/FilePreview';

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

interface ReceiptFormProps {
    onSubmit: (data: ReceiptFormData) => void;
    onCancel: () => void;
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

export default function ReceiptForm({ onSubmit, onCancel }: ReceiptFormProps) {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [itemizedExpenses, setItemizedExpenses] = useState<ExpenseItem[]>([
        { description: '', amount: 0, category: '' }
    ]);
    const [tax, setTax] = useState<number>(0);
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [locationName, setLocationName] = useState<string>('');
    const [locationAddress, setLocationAddress] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [error, setError] = useState<string>('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];

            // Validate file type
            if (!selectedFile.type.match('image/*') && selectedFile.type !== 'application/pdf') {
                setError('Only images and PDF files are allowed');
                return;
            }

            // Validate file size (5MB limit)
            if (selectedFile.size > 5 * 1024 * 1024) {
                setError('File size must be less than 5MB');
                return;
            }

            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setError('');
        }
    };

    const addExpenseItem = () => {
        setItemizedExpenses([...itemizedExpenses, { description: '', amount: 0, category: '' }]);
    };

    const removeExpenseItem = (index: number) => {
        if (itemizedExpenses.length === 1) return;
        setItemizedExpenses(itemizedExpenses.filter((_, i) => i !== index));
    };

    const handleExpenseItemChange = (index: number, field: keyof ExpenseItem, value: string | number) => {
        const newItems = [...itemizedExpenses];
        newItems[index] = {
            ...newItems[index],
            [field]: value
        };
        setItemizedExpenses(newItems);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!file) {
            setError('Please upload a receipt');
            return;
        }

        if (!locationName.trim()) {
            setError('Location name is required');
            return;
        }

        if (!locationAddress.trim()) {
            setError('Location address is required');
            return;
        }

        if (itemizedExpenses.some(item => !item.description || !item.category || item.amount <= 0)) {
            setError('All expense items must be filled out completely');
            return;
        }

        onSubmit({
            field: file,
            itemized_expenses: itemizedExpenses,
            tax,
            date,
            location_name: locationName,
            location_address: locationAddress,
            notes
        });
    };

    return (
        <div className="grid grid-cols-2 gap-6 h-full">
            {/* Left side - Form */}
            <div className="space-y-4 overflow-y-auto max-h-[70vh]">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="alert alert-error">
                            <Icon icon="heroicons:exclamation-circle" className="h-5 w-5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* File Upload */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Upload Receipt</span>
                            <span className="label-text-alt text-error">*</span>
                        </label>
                        <input
                            type="file"
                            className="file-input file-input-bordered w-full"
                            onChange={handleFileChange}
                            accept="image/*,.pdf"
                        />
                    </div>

                    {/* Date */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Date</span>
                            <span className="label-text-alt text-error">*</span>
                        </label>
                        <input
                            type="date"
                            className="input input-bordered"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                    </div>

                    {/* Location Name */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Location Name</span>
                            <span className="label-text-alt text-error">*</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered"
                            value={locationName}
                            onChange={(e) => setLocationName(e.target.value)}
                            required
                        />
                    </div>

                    {/* Location Address */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Location Address</span>
                            <span className="label-text-alt text-error">*</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered"
                            value={locationAddress}
                            onChange={(e) => setLocationAddress(e.target.value)}
                            required
                        />
                    </div>

                    {/* Notes */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Notes</span>
                        </label>
                        <textarea
                            className="textarea textarea-bordered"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </div>

                    {/* Itemized Expenses */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="label-text font-medium">Itemized Expenses</label>
                            <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={addExpenseItem}
                            >
                                <Icon icon="heroicons:plus" className="h-4 w-4" />
                                Add Item
                            </button>
                        </div>

                        {itemizedExpenses.map((item, index) => (
                            <div key={index} className="card bg-base-200 p-4">
                                <div className="grid gap-4">
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

                                    <div className="grid grid-cols-2 gap-4">
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
                                                {itemizedExpenses.length > 1 && (
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
                            </div>
                        ))}
                    </div>

                    {/* Tax */}
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Tax Amount ($)</span>
                        </label>
                        <input
                            type="number"
                            className="input input-bordered"
                            value={tax}
                            onChange={(e) => setTax(Number(e.target.value))}
                            min="0"
                            step="0.01"
                        />
                    </div>

                    {/* Total */}
                    <div className="text-right">
                        <p className="text-lg font-medium">
                            Subtotal: ${itemizedExpenses.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                        </p>
                        <p className="text-lg font-medium">
                            Tax: ${tax.toFixed(2)}
                        </p>
                        <p className="text-lg font-medium">
                            Total: ${(itemizedExpenses.reduce((sum, item) => sum + item.amount, 0) + tax).toFixed(2)}
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            type="button"
                            className="btn"
                            onClick={onCancel}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                        >
                            Add Receipt
                        </button>
                    </div>
                </form>
            </div>

            {/* Right side - Preview */}
            <div className="border-l border-base-300 pl-6">
                {previewUrl ? (
                    <FilePreview
                        url={previewUrl}
                        filename={file?.name || ''}
                        isModal={false}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-base-content/70">
                        <div className="text-center">
                            <Icon icon="heroicons:document" className="h-12 w-12 mx-auto mb-2" />
                            <p>Upload a receipt to preview</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 