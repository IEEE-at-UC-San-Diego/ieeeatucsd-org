import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import FilePreview from '../universal/FilePreview';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import type { ItemizedExpense } from '../../../schemas/pocketbase';

interface ReceiptFormData {
    file: File;
    itemized_expenses: ItemizedExpense[];
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

// Add these animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
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

export default function ReceiptForm({ onSubmit, onCancel }: ReceiptFormProps) {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [itemizedExpenses, setItemizedExpenses] = useState<ItemizedExpense[]>([
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
                toast.error('Only images and PDF files are allowed');
                setError('Only images and PDF files are allowed');
                return;
            }

            // Validate file size (5MB limit)
            if (selectedFile.size > 5 * 1024 * 1024) {
                toast.error('File size must be less than 5MB');
                setError('File size must be less than 5MB');
                return;
            }

            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setError('');
            toast.success('File uploaded successfully');
        }
    };

    const addExpenseItem = () => {
        setItemizedExpenses([...itemizedExpenses, { description: '', amount: 0, category: '' }]);
    };

    const removeExpenseItem = (index: number) => {
        if (itemizedExpenses.length === 1) return;
        setItemizedExpenses(itemizedExpenses.filter((_, i) => i !== index));
    };

    const handleExpenseItemChange = (index: number, field: keyof ItemizedExpense, value: string | number) => {
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
            file: file,
            itemized_expenses: itemizedExpenses,
            tax,
            date,
            location_name: locationName,
            location_address: locationAddress,
            notes
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 gap-6 h-full"
        >
            {/* Left side - Form */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-4 overflow-y-auto max-h-[70vh] pr-4 custom-scrollbar"
            >
                <form onSubmit={handleSubmit} className="space-y-6">
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

                    {/* File Upload */}
                    <motion.div variants={itemVariants} className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Upload Receipt</span>
                            <span className="label-text-alt text-error">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="file"
                                className="file-input file-input-bordered w-full file-input-primary hover:file-input-ghost transition-all duration-300"
                                onChange={handleFileChange}
                                accept="image/*,.pdf"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-base-content/50">
                                <Icon icon="heroicons:cloud-arrow-up" className="h-5 w-5" />
                            </div>
                        </div>
                    </motion.div>

                    {/* Date */}
                    <motion.div variants={itemVariants} className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Date</span>
                            <span className="label-text-alt text-error">*</span>
                        </label>
                        <input
                            type="date"
                            className="input input-bordered focus:input-primary transition-all duration-300"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                    </motion.div>

                    {/* Location Name */}
                    <motion.div variants={itemVariants} className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Location Name</span>
                            <span className="label-text-alt text-error">*</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered focus:input-primary transition-all duration-300"
                            value={locationName}
                            onChange={(e) => setLocationName(e.target.value)}
                            required
                        />
                    </motion.div>

                    {/* Location Address */}
                    <motion.div variants={itemVariants} className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Location Address</span>
                            <span className="label-text-alt text-error">*</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered focus:input-primary transition-all duration-300"
                            value={locationAddress}
                            onChange={(e) => setLocationAddress(e.target.value)}
                            required
                        />
                    </motion.div>

                    {/* Notes */}
                    <motion.div variants={itemVariants} className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Notes</span>
                        </label>
                        <textarea
                            className="textarea textarea-bordered focus:textarea-primary transition-all duration-300 min-h-[100px]"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />
                    </motion.div>

                    {/* Itemized Expenses */}
                    <motion.div variants={itemVariants} className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-lg font-medium">Itemized Expenses</label>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                type="button"
                                className="btn btn-primary btn-sm gap-2 hover:shadow-lg transition-all duration-300"
                                onClick={addExpenseItem}
                            >
                                <Icon icon="heroicons:plus" className="h-4 w-4" />
                                Add Item
                            </motion.button>
                        </div>

                        <AnimatePresence>
                            {itemizedExpenses.map((item, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="card bg-base-200/50 hover:bg-base-200 transition-colors duration-300 backdrop-blur-sm shadow-sm"
                                >
                                    <div className="card-body p-4">
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
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>

                    {/* Tax */}
                    <motion.div variants={itemVariants} className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Tax Amount ($)</span>
                        </label>
                        <input
                            type="number"
                            className="input input-bordered focus:input-primary transition-all duration-300"
                            value={tax}
                            onChange={(e) => setTax(Number(e.target.value))}
                            min="0"
                            step="0.01"
                        />
                    </motion.div>

                    {/* Total */}
                    <motion.div variants={itemVariants} className="card bg-base-200/50 backdrop-blur-sm p-4 shadow-sm">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-base-content/70">
                                <span>Subtotal:</span>
                                <span className="font-mono">${itemizedExpenses.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-base-content/70">
                                <span>Tax:</span>
                                <span className="font-mono">${tax.toFixed(2)}</span>
                            </div>
                            <div className="divider my-1"></div>
                            <div className="flex justify-between items-center font-medium text-lg">
                                <span>Total:</span>
                                <span className="font-mono text-primary">${(itemizedExpenses.reduce((sum, item) => sum + item.amount, 0) + tax).toFixed(2)}</span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Action Buttons */}
                    <motion.div variants={itemVariants} className="flex justify-end gap-3 mt-8">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="button"
                            className="btn btn-ghost hover:btn-error transition-all duration-300"
                            onClick={onCancel}
                        >
                            Cancel
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.02, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)" }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            className="btn btn-primary shadow-md hover:shadow-lg transition-all duration-300"
                        >
                            Add Receipt
                        </motion.button>
                    </motion.div>
                </form>
            </motion.div>

            {/* Right side - Preview */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="border-l border-base-300 pl-6"
            >
                <AnimatePresence mode="wait">
                    {previewUrl ? (
                        <motion.div
                            key="preview"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="bg-base-200/50 backdrop-blur-sm rounded-xl p-4 shadow-sm"
                        >
                            <FilePreview
                                url={previewUrl}
                                filename={file?.name || ''}
                                isModal={false}
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="placeholder"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center justify-center h-full text-base-content/70"
                        >
                            <div className="text-center">
                                <Icon icon="heroicons:document" className="h-16 w-16 mx-auto mb-4 text-base-content/30" />
                                <p className="text-lg">Upload a receipt to preview</p>
                                <p className="text-sm text-base-content/50 mt-2">Supported formats: Images, PDF</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.div>
    );
} 