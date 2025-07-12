import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import FilePreview from '../universal/FilePreview';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import type { ItemizedExpense } from '../../../schemas/pocketbase';
// import ZoomablePreview from '../universal/ZoomablePreview';

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
    const [jsonInput, setJsonInput] = useState<string>('');
    const [showJsonInput, setShowJsonInput] = useState<boolean>(false);
    const [zoomLevel, setZoomLevel] = useState<number>(1);

    // Sample JSON data for users to copy
    const sampleJsonData = {
        itemized_expenses: [
            {
                description: "Presentation supplies for IEEE workshop",
                category: "Supplies",
                amount: 45.99
            },
            {
                description: "Team lunch during planning meeting",
                category: "Meals",
                amount: 82.50
            },
            {
                description: "Transportation to conference venue",
                category: "Travel",
                amount: 28.75
            }
        ],
        tax: 12.65,
        date: "2024-01-15",
        location_name: "Office Depot & Local Restaurant",
        location_address: "1234 Campus Drive, San Diego, CA 92093",
        notes: "Expenses for January IEEE workshop preparation and team coordination meeting"
    };

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

    const parseJsonData = () => {
        try {
            if (!jsonInput.trim()) {
                toast.error('Please enter JSON data to parse');
                return;
            }

            const parsed = JSON.parse(jsonInput);
            
            // Validate the structure
            if (!parsed.itemized_expenses || !Array.isArray(parsed.itemized_expenses)) {
                throw new Error('itemized_expenses must be an array');
            }

            // Validate each expense item
            for (const item of parsed.itemized_expenses) {
                if (!item.description || !item.category || typeof item.amount !== 'number') {
                    throw new Error('Each expense item must have description, category, and amount');
                }
                if (!EXPENSE_CATEGORIES.includes(item.category)) {
                    throw new Error(`Invalid category: ${item.category}. Must be one of: ${EXPENSE_CATEGORIES.join(', ')}`);
                }
            }

            // Populate the form fields
            setItemizedExpenses(parsed.itemized_expenses);
            if (parsed.tax !== undefined) setTax(Number(parsed.tax) || 0);
            if (parsed.date) setDate(parsed.date);
            if (parsed.location_name) setLocationName(parsed.location_name);
            if (parsed.location_address) setLocationAddress(parsed.location_address);
            if (parsed.notes) setNotes(parsed.notes);

            setError('');
            toast.success(`Successfully imported ${parsed.itemized_expenses.length} expense items`);
            setShowJsonInput(false);
            setJsonInput('');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Invalid JSON format';
            setError(`JSON Parse Error: ${errorMessage}`);
            toast.error(`Failed to parse JSON: ${errorMessage}`);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success('Sample data copied to clipboard!');
        }).catch(() => {
            toast.error('Failed to copy to clipboard');
        });
    };

    const zoomIn = () => {
        setZoomLevel(prev => Math.min(prev + 0.25, 3));
    };

    const zoomOut = () => {
        setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
    };

    const resetZoom = () => {
        setZoomLevel(1);
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
                className="space-y-4 overflow-y-auto max-h-[70vh] pr-8 overflow-x-hidden"
                style={{
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
                }}
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

                    {/* Date and Location in Grid */}
                    <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="form-control">
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
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Tax Amount ($)</span>
                            </label>
                            <input
                                type="number"
                                className="input input-bordered focus:input-primary transition-all duration-300"
                                value={tax === 0 ? '' : tax}
                                onChange={(e) => setTax(Number(e.target.value))}
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                            />
                        </div>
                    </motion.div>

                    {/* Location Fields */}
                    <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Location Name</span>
                                <span className="label-text-alt text-error">*</span>
                            </label>
                            <input
                                type="text"
                                className="input input-bordered focus:input-primary transition-all duration-300"
                                value={locationName}
                                onChange={(e) => setLocationName(e.target.value)}
                                placeholder="Store/vendor name"
                                required
                            />
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text font-medium">Location Address</span>
                                <span className="label-text-alt text-error">*</span>
                            </label>
                            <input
                                type="text"
                                className="input input-bordered focus:input-primary transition-all duration-300"
                                value={locationAddress}
                                onChange={(e) => setLocationAddress(e.target.value)}
                                placeholder="Full address"
                                required
                            />
                        </div>
                    </motion.div>

                    {/* Notes - Reduced height */}
                    <motion.div variants={itemVariants} className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Notes</span>
                        </label>
                        <textarea
                            className="textarea textarea-bordered focus:textarea-primary transition-all duration-300"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Additional notes..."
                        />
                    </motion.div>

                    {/* JSON Import Section */}
                    <motion.div variants={itemVariants} className="space-y-4">
                        <div className="card bg-base-200/30 border border-primary/20 shadow-sm">
                            <div className="card-body p-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-lg font-medium text-primary">Quick Import from JSON</h3>
                                        <p className="text-sm text-base-content/70">Paste receipt data in JSON format to auto-populate fields</p>
                                    </div>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        type="button"
                                        className="btn btn-primary btn-sm gap-2"
                                        onClick={() => setShowJsonInput(!showJsonInput)}
                                    >
                                        <Icon icon={showJsonInput ? "heroicons:chevron-up" : "heroicons:chevron-down"} className="h-4 w-4" />
                                        {showJsonInput ? 'Hide' : 'Show'} JSON Import
                                    </motion.button>
                                </div>

                                <AnimatePresence>
                                    {showJsonInput && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-4 mt-4 overflow-hidden"
                                        >
                                            {/* Sample Data Section */}
                                            <div className="bg-base-100/50 rounded-lg p-4 border border-base-300/50">
                                                <div className="flex justify-between items-center mb-3">
                                                    <h4 className="font-medium text-sm">Sample JSON Format:</h4>
                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        type="button"
                                                        className="btn btn-xs btn-ghost gap-1"
                                                        onClick={() => copyToClipboard(JSON.stringify(sampleJsonData, null, 2))}
                                                    >
                                                        <Icon icon="heroicons:clipboard-document" className="h-3 w-3" />
                                                        Copy Sample
                                                    </motion.button>
                                                </div>
                                                <pre className="text-xs bg-base-200/50 p-3 rounded border overflow-x-auto">
                                                    <code>{JSON.stringify(sampleJsonData, null, 2)}</code>
                                                </pre>
                                                <div className="mt-2 text-xs text-base-content/60">
                                                    <p><strong>Required fields:</strong> itemized_expenses (array)</p>
                                                    <p><strong>Optional fields:</strong> tax, date, location_name, location_address, notes</p>
                                                    <p><strong>Valid categories:</strong> {EXPENSE_CATEGORIES.join(', ')}</p>
                                                </div>
                                            </div>

                                            {/* JSON Input Area */}
                                            <div className="space-y-3">
                                                <label className="label">
                                                    <span className="label-text font-medium">Paste your JSON data:</span>
                                                </label>
                                                <textarea
                                                    className="textarea textarea-bordered w-full min-h-[150px] font-mono text-sm"
                                                    value={jsonInput}
                                                    onChange={(e) => setJsonInput(e.target.value)}
                                                    placeholder="Paste your JSON data here..."
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <motion.button
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        type="button"
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => setJsonInput('')}
                                                    >
                                                        Clear
                                                    </motion.button>
                                                    <motion.button
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        type="button"
                                                        className="btn btn-primary btn-sm gap-2"
                                                        onClick={parseJsonData}
                                                    >
                                                        <Icon icon="heroicons:arrow-down-tray" className="h-4 w-4" />
                                                        Import Data
                                                    </motion.button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>

                    {/* Itemized Expenses */}
                    <motion.div variants={itemVariants} className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-lg font-medium">Itemized Expenses</label>
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
                                    <div className="card-body p-3">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="text-sm font-medium">Item #{index + 1}</h4>
                                            {itemizedExpenses.length > 1 && (
                                                <button
                                                    type="button"
                                                    className="btn btn-xs btn-ghost text-error hover:bg-error/10"
                                                    onClick={() => removeExpenseItem(index)}
                                                    aria-label="Remove item"
                                                >
                                                    <Icon icon="heroicons:trash" className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="grid gap-3">
                                            <div className="form-control">
                                                <label className="label py-1">
                                                    <span className="label-text text-xs">Description</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    className="input input-bordered input-sm"
                                                    value={item.description}
                                                    onChange={(e) => handleExpenseItemChange(index, 'description', e.target.value)}
                                                    placeholder="What was purchased?"
                                                    required
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="form-control">
                                                    <label className="label py-1">
                                                        <span className="label-text text-xs">Category</span>
                                                    </label>
                                                    <select
                                                        className="select select-bordered select-sm w-full"
                                                        value={item.category}
                                                        onChange={(e) => handleExpenseItemChange(index, 'category', e.target.value)}
                                                        required
                                                    >
                                                        <option value="">Select...</option>
                                                        {EXPENSE_CATEGORIES.map(category => (
                                                            <option key={category} value={category}>{category}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className="form-control">
                                                    <label className="label py-1">
                                                        <span className="label-text text-xs">Amount ($)</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        className="input input-bordered input-sm w-full"
                                                        value={item.amount === 0 ? '' : item.amount}
                                                        onChange={(e) => handleExpenseItemChange(index, 'amount', Number(e.target.value))}
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Add Item Button - Moved to bottom */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-center pt-2"
                        >
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
                        </motion.div>
                    </motion.div>

                    {/* Total */}
                    <motion.div variants={itemVariants} className="card bg-base-200/50 backdrop-blur-sm p-3 shadow-sm">
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-sm text-base-content/70">
                                <span>Subtotal:</span>
                                <span className="font-mono">${itemizedExpenses.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-base-content/70">
                                <span>Tax:</span>
                                <span className="font-mono">${tax.toFixed(2)}</span>
                            </div>
                            <div className="divider my-1"></div>
                            <div className="flex justify-between items-center font-medium">
                                <span>Total:</span>
                                <span className="font-mono text-primary text-lg">${(itemizedExpenses.reduce((sum, item) => sum + item.amount, 0) + tax).toFixed(2)}</span>
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
                            className="bg-base-200/50 backdrop-blur-sm rounded-xl shadow-sm relative"
                        >
                            {/* Zoom Controls */}
                            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-base-100/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    className="btn btn-xs btn-ghost"
                                    onClick={zoomIn}
                                    disabled={zoomLevel >= 3}
                                    title="Zoom In"
                                >
                                    <Icon icon="heroicons:plus" className="h-3 w-3" />
                                </motion.button>
                                
                                <div className="text-xs text-center font-mono px-1">
                                    {Math.round(zoomLevel * 100)}%
                                </div>
                                
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    className="btn btn-xs btn-ghost"
                                    onClick={zoomOut}
                                    disabled={zoomLevel <= 0.5}
                                    title="Zoom Out"
                                >
                                    <Icon icon="heroicons:minus" className="h-3 w-3" />
                                </motion.button>
                                
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    className="btn btn-xs btn-ghost"
                                    onClick={resetZoom}
                                    disabled={zoomLevel === 1}
                                    title="Reset Zoom"
                                >
                                    <Icon icon="heroicons:arrows-pointing-out" className="h-3 w-3" />
                                </motion.button>
                            </div>

                            {/* Preview with Zoom */}
                            <div 
                                className="overflow-auto h-full rounded-xl"
                                style={{ 
                                    transform: `scale(${zoomLevel})`,
                                    transformOrigin: 'top left',
                                    height: zoomLevel > 1 ? `${100 / zoomLevel}%` : '100%',
                                    width: zoomLevel > 1 ? `${100 / zoomLevel}%` : '100%'
                                }}
                            >
                                <FilePreview url={previewUrl} filename={file?.name || ''} />
                            </div>
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