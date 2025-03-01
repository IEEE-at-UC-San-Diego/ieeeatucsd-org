import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

// Animation variants
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

// Invoice item interface
export interface InvoiceItem {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
}

// Invoice data interface
export interface InvoiceData {
    items: InvoiceItem[];
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    tipPercentage: number;
    tipAmount: number;
    total: number;
    vendor: string;
}

interface InvoiceBuilderProps {
    invoiceData: InvoiceData;
    onChange: (data: InvoiceData) => void;
}

const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({ invoiceData, onChange }) => {
    // State for new item form
    const [newItem, setNewItem] = useState<Omit<InvoiceItem, 'id' | 'amount'>>({
        description: '',
        quantity: 1,
        unitPrice: 0
    });

    // Use a counter for generating IDs to avoid hydration issues
    const [idCounter, setIdCounter] = useState(1);

    // Generate a unique ID for new items without using non-deterministic functions
    const generateId = () => {
        const id = `item-${idCounter}`;
        setIdCounter(prev => prev + 1);
        return id;
    };

    // State for validation errors
    const [errors, setErrors] = useState<{
        description?: string;
        quantity?: string;
        unitPrice?: string;
        vendor?: string;
    }>({});

    // Calculate totals whenever invoice data changes
    useEffect(() => {
        calculateTotals();
    }, [invoiceData.items, invoiceData.taxRate, invoiceData.tipPercentage]);

    // Calculate all totals
    const calculateTotals = () => {
        // Calculate subtotal
        const subtotal = invoiceData.items.reduce((sum, item) => sum + item.amount, 0);

        // Calculate tax amount (ensure it's based on the current subtotal)
        const taxAmount = subtotal * (invoiceData.taxRate / 100);

        // Calculate tip amount (ensure it's based on the current subtotal)
        const tipAmount = subtotal * (invoiceData.tipPercentage / 100);

        // Calculate total
        const total = subtotal + taxAmount + tipAmount;

        // Update invoice data
        onChange({
            ...invoiceData,
            subtotal,
            taxAmount,
            tipAmount,
            total
        });
    };

    // Validate new item before adding
    const validateNewItem = () => {
        const newErrors: {
            description?: string;
            quantity?: string;
            unitPrice?: string;
            vendor?: string;
        } = {};

        if (!newItem.description.trim()) {
            newErrors.description = 'Description is required';
        }

        if (newItem.quantity <= 0) {
            newErrors.quantity = 'Quantity must be greater than 0';
        }

        if (newItem.unitPrice < 0) {
            newErrors.unitPrice = 'Unit price must be 0 or greater';
        }

        // Check for duplicate description
        const isDuplicate = invoiceData.items.some(
            item => item.description.toLowerCase() === newItem.description.toLowerCase()
        );

        if (isDuplicate) {
            newErrors.description = 'An item with this description already exists';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Add a new item to the invoice
    const handleAddItem = () => {
        if (!validateNewItem()) {
            return;
        }

        // Calculate amount
        const amount = newItem.quantity * newItem.unitPrice;

        // Create new item
        const item: InvoiceItem = {
            id: generateId(),
            description: newItem.description,
            quantity: newItem.quantity,
            unitPrice: newItem.unitPrice,
            amount
        };

        // Add item to invoice
        onChange({
            ...invoiceData,
            items: [...invoiceData.items, item]
        });

        // Show success toast
        toast.success(`Added ${item.description} to invoice`);

        // Reset new item form
        setNewItem({
            description: '',
            quantity: 1,
            unitPrice: 0
        });

        // Clear errors
        setErrors({});
    };

    // Remove an item
    const handleRemoveItem = (id: string) => {
        const itemToRemove = invoiceData.items.find(item => item.id === id);
        onChange({
            ...invoiceData,
            items: invoiceData.items.filter(item => item.id !== id)
        });

        if (itemToRemove) {
            toast.success(`Removed ${itemToRemove.description} from invoice`);
        }
    };

    // Update tax rate
    const handleTaxRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        onChange({
            ...invoiceData,
            taxRate: isNaN(value) ? 0 : Math.max(0, value)
        });
    };

    // Update tip percentage
    const handleTipPercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        onChange({
            ...invoiceData,
            tipPercentage: isNaN(value) ? 0 : Math.max(0, value)
        });
    };

    // Update vendor
    const handleVendorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({
            ...invoiceData,
            vendor: e.target.value
        });

        // Clear vendor error if it exists
        if (errors.vendor && e.target.value.trim()) {
            setErrors({ ...errors, vendor: undefined });
        }
    };

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    return (
        <motion.div variants={itemVariants} className="space-y-6">
            <div className="bg-base-200/50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Invoice Builder</h3>

                {/* AS Funding Limit Notice */}
                <div className="alert alert-warning mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 stroke-current" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <span className="font-bold">AS Funding Limits:</span> Maximum of $10.00 per expected student attendee and $5,000 per event.
                    </div>
                </div>

                {/* Vendor information */}
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text font-medium">Vendor/Restaurant Name</span>
                        <span className="label-text-alt text-error">*</span>
                    </label>
                    <input
                        type="text"
                        className={`input input-bordered ${errors.vendor ? 'input-error' : ''}`}
                        value={invoiceData.vendor}
                        onChange={handleVendorChange}
                        placeholder="e.g. L&L Hawaiian Barbeque"
                    />
                    {errors.vendor && (
                        <label className="label">
                            <span className="label-text-alt text-error">{errors.vendor}</span>
                        </label>
                    )}
                </div>

                {/* Item list */}
                <div className="overflow-x-auto mb-4">
                    <table className="table w-full">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th className="text-right">Qty</th>
                                <th className="text-right">Unit Price</th>
                                <th className="text-right">Amount</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoiceData.items.map(item => (
                                <tr key={item.id} className="hover">
                                    <td>{item.description}</td>
                                    <td className="text-right">{item.quantity}</td>
                                    <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                                    <td className="text-right">{formatCurrency(item.amount)}</td>
                                    <td className="text-right">
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-xs"
                                            onClick={() => handleRemoveItem(item.id)}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {invoiceData.items.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-4 text-gray-500">
                                        No items added yet
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Add new item form */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Description</span>
                        </label>
                        <input
                            type="text"
                            className={`input input-bordered input-sm ${errors.description ? 'input-error' : ''}`}
                            value={newItem.description}
                            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                            placeholder="e.g. Chicken Cutlet with Gravy"
                        />
                        {errors.description && (
                            <label className="label">
                                <span className="label-text-alt text-error">{errors.description}</span>
                            </label>
                        )}
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Quantity</span>
                        </label>
                        <input
                            type="number"
                            id="quantity"
                            className={`input input-bordered input-sm ${errors.quantity ? 'input-error' : ''}`}
                            value={newItem.quantity}
                            onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                            min="1"
                            step="1"
                        />
                        {errors.quantity && <div className="text-error text-xs mt-1">{errors.quantity}</div>}
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Unit Price ($)</span>
                        </label>
                        <input
                            type="number"
                            id="unitPrice"
                            className={`input input-bordered input-sm ${errors.unitPrice ? 'input-error' : ''}`}
                            value={newItem.unitPrice}
                            onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })}
                            min="0"
                            step="0.01"
                        />
                        {errors.unitPrice && (
                            <label className="label">
                                <span className="label-text-alt text-error">{errors.unitPrice}</span>
                            </label>
                        )}
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleAddItem}
                    >
                        Add Item
                    </button>
                </div>

                {/* Tax and tip */}
                <div className="divider"></div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Tax Rate (%)</span>
                        </label>
                        <input
                            type="number"
                            className="input input-bordered input-sm"
                            value={invoiceData.taxRate}
                            onChange={handleTaxRateChange}
                            min="0"
                            step="0.01"
                        />
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Tip Percentage (%)</span>
                        </label>
                        <input
                            type="number"
                            className="input input-bordered input-sm"
                            value={invoiceData.tipPercentage}
                            onChange={handleTipPercentageChange}
                            min="0"
                            step="0.01"
                        />
                    </div>
                </div>

                {/* Totals */}
                <div className="bg-base-300/30 p-4 rounded-lg">
                    <div className="flex justify-between mb-2">
                        <span>Subtotal:</span>
                        <span className="font-medium">{formatCurrency(invoiceData.subtotal)}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                        <span>Tax ({invoiceData.taxRate}%):</span>
                        <span className="font-medium">{formatCurrency(invoiceData.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                        <span>Tip ({invoiceData.tipPercentage}%):</span>
                        <span className="font-medium">{formatCurrency(invoiceData.tipAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span>{formatCurrency(invoiceData.total)}</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default InvoiceBuilder; 