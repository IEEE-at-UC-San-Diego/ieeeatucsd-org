import React, { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import type { EventRequestFormData } from './EventRequestForm';
import InvoiceBuilder from './InvoiceBuilder';
import type { InvoiceData, InvoiceItem } from './InvoiceBuilder';
import CustomAlert from '../universal/CustomAlert';
import { Icon } from '@iconify/react';

// Enhanced animation variants with faster transitions
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.035,
            when: "beforeChildren",
            duration: 0.3,
            ease: "easeOut"
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            stiffness: 500,
            damping: 25,
            mass: 0.8,
            duration: 0.25
        }
    }
};

// Input field hover animation
const inputHoverVariants = {
    hover: {
        scale: 1.01,
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        transition: { duration: 0.15 }
    }
};

// Button animation
const buttonVariants = {
    hover: {
        scale: 1.03,
        transition: { duration: 0.15, ease: "easeOut" }
    },
    tap: {
        scale: 0.97,
        transition: { duration: 0.1 }
    }
};

// Toggle animation
const toggleVariants = {
    checked: { backgroundColor: "rgba(var(--p), 0.2)" },
    unchecked: { backgroundColor: "rgba(0, 0, 0, 0.05)" },
    hover: { scale: 1.01, transition: { duration: 0.15 } }
};

interface ASFundingSectionProps {
    formData: EventRequestFormData;
    onDataChange: (data: Partial<EventRequestFormData>) => void;
}

const ASFundingSection: React.FC<ASFundingSectionProps> = ({ formData, onDataChange }) => {
    // Check initial budget status
    React.useEffect(() => {
        if (formData.invoiceData?.total) {
            checkBudgetLimit(formData.invoiceData.total);
        }
    }, [formData.expected_attendance]);
    const [invoiceFiles, setInvoiceFiles] = useState<File[]>(formData.invoice_files || []);
    const [jsonInput, setJsonInput] = useState<string>('');
    const [jsonError, setJsonError] = useState<string>('');
    const [showJsonInput, setShowJsonInput] = useState<boolean>(false);
    const [isDragging, setIsDragging] = useState(false);

    // Handle invoice file upload
    const handleInvoiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files) as File[];
            setInvoiceFiles(newFiles);
            onDataChange({ invoice_files: newFiles });
        }
    };

    // Handle JSON input change
    const handleJsonInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setJsonInput(e.target.value);
        setJsonError('');
    };

    // Show JSON example
    const showJsonExample = () => {
        const example = {
            vendor: "Example Restaurant",
            items: [
                {
                    id: "item-1",
                    description: "Burger",
                    quantity: 2,
                    unitPrice: 12.99,
                    amount: 25.98
                },
                {
                    id: "item-2",
                    description: "Fries",
                    quantity: 2,
                    unitPrice: 4.99,
                    amount: 9.98
                }
            ],
            subtotal: 35.96,
            taxRate: 9.0,
            taxAmount: 3.24,
            tipPercentage: 13.9,
            tipAmount: 5.00,
            total: 44.20
        };
        setJsonInput(JSON.stringify(example, null, 2));
    };

    // Validate and apply JSON
    // Check budget limits and show warning if exceeded
    const checkBudgetLimit = (total: number) => {
        const maxBudget = Math.min(formData.expected_attendance * 10, 5000);
        if (total > maxBudget) {
            toast.error(`Total amount ($${total.toFixed(2)}) exceeds maximum funding of $${maxBudget.toFixed(2)} for ${formData.expected_attendance} attendees.`, {
                duration: 4000,
                position: 'top-center'
            });
            return true;
        }
        return false;
    };

    const validateAndApplyJson = () => {
        try {
            if (!jsonInput.trim()) {
                setJsonError('JSON input is empty');
                return;
            }

            const data = JSON.parse(jsonInput);

            // Validate structure
            if (!data.vendor) {
                setJsonError('Vendor field is required');
                return;
            }

            if (!Array.isArray(data.items) || data.items.length === 0) {
                setJsonError('Items array is required and must contain at least one item');
                return;
            }

            // Validate items
            for (const item of data.items) {
                if (!item.description || typeof item.unitPrice !== 'number' || typeof item.quantity !== 'number') {
                    setJsonError('Each item must have description, unitPrice, and quantity fields');
                    return;
                }
            }

            // Validate tax, tip, and total
            if (typeof data.taxAmount !== 'number') {
                setJsonError('Tax amount must be a number');
                return;
            }

            if (typeof data.tipAmount !== 'number') {
                setJsonError('Tip amount must be a number');
                return;
            }

            if (typeof data.total !== 'number') {
                setJsonError('Total is required and must be a number');
                return;
            }

            // Create itemized invoice string for Pocketbase
            const itemizedInvoice = JSON.stringify({
                vendor: data.vendor,
                items: data.items.map((item: InvoiceItem) => ({
                    item: item.description,
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    amount: item.amount
                })),
                subtotal: data.subtotal,
                tax: data.taxAmount,
                tip: data.tipAmount,
                total: data.total
            }, null, 2);

            // Check budget limits and show toast if needed
            checkBudgetLimit(data.total);

            // Apply the JSON data to the form
            onDataChange({
                invoiceData: data,
                itemized_invoice: itemizedInvoice,
                as_funding_required: true
            });

            toast.success('Invoice data applied successfully');
            setShowJsonInput(false);
        } catch (error) {
            setJsonError('Invalid JSON format: ' + (error as Error).message);
        }
    };

    // Handle drag events for file upload
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const newFiles = Array.from(e.dataTransfer.files) as File[];
            setInvoiceFiles(newFiles);
            onDataChange({ invoice_files: newFiles });
        }
    };

    // Handle invoice data change from the invoice builder
    const handleInvoiceDataChange = (data: InvoiceData) => {
        // Check budget limits and show toast if needed
        checkBudgetLimit(data.total);

        onDataChange({
            invoiceData: data,
            itemized_invoice: JSON.stringify(data)
        });
    };

    return (
        <motion.div
            className="space-y-8"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            <motion.div variants={itemVariants}>
                <h2 className="text-3xl font-bold mb-4 text-primary bg-linear-to-r from-primary to-primary-focus bg-clip-text text-transparent">
                    AS Funding Details
                </h2>
            </motion.div>

            <motion.div variants={itemVariants}>
                <CustomAlert
                    type="info"
                    title="AS Funding Information"
                    message="AS funding can cover food and other expenses for your event. Please itemize all expenses in the invoice builder below."
                    className="mb-6"
                    icon="heroicons:information-circle"
                />
            </motion.div>

            {/* Invoice Upload Section */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-xs hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <h3 className="text-xl font-semibold mb-2 text-primary">Invoice Information</h3>
                <p className="text-sm text-gray-500 mb-4">Upload your invoice files or create an itemized invoice below.</p>

                <motion.div
                    className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'
                        }`}
                    whileHover={{ scale: 1.02, boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)" }}
                    whileTap={{ scale: 0.98 }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('invoice-files')?.click()}
                >
                    <input
                        id="invoice-files"
                        type="file"
                        className="hidden"
                        onChange={handleInvoiceFileChange}
                        accept=".pdf,.jpg,.jpeg,.png"
                        multiple
                    />

                    <div className="flex flex-col items-center justify-center gap-3">
                        <motion.div
                            className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary"
                            whileHover={{ rotate: 15, scale: 1.1 }}
                        >
                            <Icon icon="heroicons:document-text" className="h-8 w-8" />
                        </motion.div>

                        {invoiceFiles.length > 0 ? (
                            <>
                                <p className="font-medium text-primary">{invoiceFiles.length} file(s) selected:</p>
                                <div className="max-h-24 overflow-y-auto text-left w-full">
                                    <ul className="list-disc list-inside text-sm">
                                        {invoiceFiles.map((file, index) => (
                                            <li key={index} className="truncate">{file.name}</li>
                                        ))}
                                    </ul>
                                </div>
                                <p className="text-xs text-gray-500">Click or drag to replace</p>
                            </>
                        ) : (
                            <>
                                <p className="font-medium">Drop your invoice files here or click to browse</p>
                                <p className="text-xs text-gray-500">Supports PDF, JPG, JPEG, PNG</p>
                            </>
                        )}
                    </div>
                </motion.div>
            </motion.div>

            {/* JSON/Builder Toggle */}
            <motion.div
                variants={itemVariants}
                className="bg-base-200/50 p-6 rounded-xl shadow-xs hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-primary">Invoice Details</h3>

                    <div className="flex mb-4 border rounded-lg overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setShowJsonInput(false)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${!showJsonInput ? 'bg-primary text-white' : 'hover:bg-base-200'
                                }`}
                        >
                            Visual Editor
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowJsonInput(true)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${showJsonInput ? 'bg-primary text-white' : 'hover:bg-base-200'
                                }`}
                        >
                            JSON Editor
                        </button>
                    </div>
                </div>

                {showJsonInput ? (
                    <motion.div
                        className="space-y-4"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="flex justify-between items-center">
                            <label className="label-text font-medium">JSON Invoice Data</label>
                            <motion.button
                                type="button"
                                className="btn btn-sm btn-ghost text-primary"
                                onClick={showJsonExample}
                                whileHover="hover"
                                whileTap="tap"
                                variants={buttonVariants}
                            >
                                <Icon icon="heroicons:code-bracket" className="w-4 h-4 mr-1" />
                                Show Example
                            </motion.button>
                        </div>

                        <motion.textarea
                            className={`textarea textarea-bordered w-full h-64 font-mono text-sm ${jsonError ? 'textarea-error' : 'focus:textarea-primary'}`}
                            value={jsonInput}
                            onChange={handleJsonInputChange}
                            placeholder="Paste your JSON invoice data here..."
                            whileHover="hover"
                            variants={inputHoverVariants}
                        />

                        {jsonError && (
                            <div className="text-error text-sm flex items-center gap-1">
                                <Icon icon="heroicons:exclamation-circle" className="w-4 h-4" />
                                {jsonError}
                            </div>
                        )}

                        <div className="flex justify-end">
                            <motion.button
                                type="button"
                                className="btn btn-primary"
                                onClick={validateAndApplyJson}
                                whileHover="hover"
                                whileTap="tap"
                                variants={buttonVariants}
                            >
                                <Icon icon="heroicons:check-circle" className="w-5 h-5 mr-1" />
                                Apply JSON
                            </motion.button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        variants={itemVariants}
                        className="form-control space-y-6"
                    >
                        <InvoiceBuilder
                            invoiceData={formData.invoiceData || {
                                vendor: '',
                                items: [],
                                subtotal: 0,
                                taxAmount: 0,
                                tipAmount: 0,
                                total: 0
                            }}
                            onChange={handleInvoiceDataChange}
                        />
                    </motion.div>
                )}
            </motion.div>
        </motion.div>
    );
};

export default ASFundingSection; 