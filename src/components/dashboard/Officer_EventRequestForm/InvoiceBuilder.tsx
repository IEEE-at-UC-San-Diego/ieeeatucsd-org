import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import CustomAlert from '../universal/CustomAlert';

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
    // State for new item form with optional fields for input handling
    const [newItem, setNewItem] = useState<{
        description: string;
        quantity: number | '';
        unitPrice: number | string;
    }>({
        description: '',
        quantity: 1,
        unitPrice: ''
    });

    // State for form errors
    const [errors, setErrors] = useState<{
        description?: string;
        quantity?: string;
        unitPrice?: string;
        vendor?: string;
    }>({});

    // State for raw input values (to preserve exact user input)
    const [rawInputs, setRawInputs] = useState<{
        taxAmount: string;
        tipAmount: string;
    }>({
        taxAmount: '',
        tipAmount: ''
    });

    // State for input validation messages
    const [validationMessages, setValidationMessages] = useState<{
        vendor?: string;
        items?: string;
        tax?: string;
        tip?: string;
    }>({});

    // Generate a unique ID for new items
    const generateId = () => {
        return `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    };

    // Helper function to round to 2 decimal places for calculations only
    const roundToTwoDecimals = (num: number): number => {
        return Math.round((num + Number.EPSILON) * 100) / 100;
    };

    // Update raw input values when invoiceData changes from outside
    useEffect(() => {
        if (invoiceData.taxAmount === 0 && rawInputs.taxAmount === '') {
            // Don't update if it's already empty and the value is 0
        } else if (invoiceData.taxAmount.toString() !== rawInputs.taxAmount) {
            setRawInputs(prev => ({
                ...prev,
                taxAmount: invoiceData.taxAmount === 0 ? '' : invoiceData.taxAmount.toString()
            }));
        }

        if (invoiceData.tipAmount === 0 && rawInputs.tipAmount === '') {
            // Don't update if it's already empty and the value is 0
        } else if (invoiceData.tipAmount.toString() !== rawInputs.tipAmount) {
            setRawInputs(prev => ({
                ...prev,
                tipAmount: invoiceData.tipAmount === 0 ? '' : invoiceData.tipAmount.toString()
            }));
        }
    }, [invoiceData.taxAmount, invoiceData.tipAmount]);

    // Validate the entire invoice
    useEffect(() => {
        const messages: {
            vendor?: string;
            items?: string;
            tax?: string;
            tip?: string;
        } = {};

        // Validate vendor
        if (!invoiceData.vendor.trim()) {
            messages.vendor = 'Please enter a vendor/restaurant name';
        }

        // Validate items
        if (invoiceData.items.length === 0) {
            messages.items = 'Please add at least one item to the invoice';
        }

        // Validate tax (optional but must be valid if provided)
        if (rawInputs.taxAmount && isNaN(parseFloat(rawInputs.taxAmount))) {
            messages.tax = 'Tax amount must be a valid number';
        }

        // Validate tip (optional but must be valid if provided)
        if (rawInputs.tipAmount && isNaN(parseFloat(rawInputs.tipAmount))) {
            messages.tip = 'Tip amount must be a valid number';
        }

        setValidationMessages(messages);
    }, [invoiceData.vendor, invoiceData.items, rawInputs.taxAmount, rawInputs.tipAmount]);

    // Calculate subtotal, tax, tip, and total whenever items, tax rate, or tip percentage changes
    useEffect(() => {
        const subtotal = roundToTwoDecimals(
            invoiceData.items.reduce((sum, item) => sum + item.amount, 0)
        );
        const taxAmount = roundToTwoDecimals((invoiceData.taxRate / 100) * subtotal);
        const tipAmount = roundToTwoDecimals((invoiceData.tipPercentage / 100) * subtotal);
        const total = roundToTwoDecimals(subtotal + taxAmount + tipAmount);

        // Only update if values have changed to prevent infinite loop
        if (
            subtotal !== invoiceData.subtotal ||
            taxAmount !== invoiceData.taxAmount ||
            tipAmount !== invoiceData.tipAmount ||
            total !== invoiceData.total
        ) {
            onChange({
                ...invoiceData,
                subtotal,
                taxAmount,
                tipAmount,
                total
            });
        }
    }, [invoiceData.items, invoiceData.taxRate, invoiceData.tipPercentage]);

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

        if (newItem.quantity === '' || typeof newItem.quantity === 'number' && newItem.quantity <= 0) {
            newErrors.quantity = 'Quantity must be greater than 0';
        }

        if (newItem.unitPrice === '' || typeof newItem.unitPrice === 'number' && newItem.unitPrice < 0) {
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

        // Calculate amount with proper rounding for display and calculations
        const quantity = typeof newItem.quantity === 'number' ? newItem.quantity : 0;
        const unitPrice = typeof newItem.unitPrice === 'number'
            ? newItem.unitPrice
            : typeof newItem.unitPrice === 'string' && newItem.unitPrice !== ''
                ? parseFloat(newItem.unitPrice)
                : 0;

        const amount = roundToTwoDecimals(quantity * unitPrice);

        // Create new item
        const item: InvoiceItem = {
            id: generateId(),
            description: newItem.description,
            quantity: quantity,
            unitPrice: unitPrice, // Store the exact value
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
            unitPrice: ''
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

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    // Update tax amount directly - preserve exact input
    const handleTaxAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;

        // Store the raw input value
        setRawInputs(prev => ({
            ...prev,
            taxAmount: value
        }));

        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            const taxAmount = value === '' ? 0 : parseFloat(value);
            const taxRate = invoiceData.subtotal > 0 && !isNaN(taxAmount)
                ? roundToTwoDecimals((taxAmount / invoiceData.subtotal) * 100)
                : 0;

            onChange({
                ...invoiceData,
                taxAmount: isNaN(taxAmount) ? 0 : taxAmount,
                taxRate
            });
        }
    };

    // Update tip amount directly - preserve exact input
    const handleTipAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;

        // Store the raw input value
        setRawInputs(prev => ({
            ...prev,
            tipAmount: value
        }));

        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            const tipAmount = value === '' ? 0 : parseFloat(value);
            const tipPercentage = invoiceData.subtotal > 0 && !isNaN(tipAmount)
                ? roundToTwoDecimals((tipAmount / invoiceData.subtotal) * 100)
                : 0;

            onChange({
                ...invoiceData,
                tipAmount: isNaN(tipAmount) ? 0 : tipAmount,
                tipPercentage
            });
        }
    };

    // Custom CSS to hide spinner buttons on number inputs
    const numberInputStyle = {
        /* For Chrome, Safari, Edge, Opera */
        WebkitAppearance: 'none',
        margin: 0,
        /* For Firefox */
        MozAppearance: 'textfield'
    } as React.CSSProperties;

    return (
        <motion.div variants={itemVariants} className="space-y-6">
            <div className="bg-base-200/50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">Invoice Builder</h3>

                {/* AS Funding Limit Notice */}
                <CustomAlert
                    type="warning"
                    title="AS Funding Limits"
                    message="Maximum of $10.00 per expected student attendee and $5,000 per event."
                    className="mb-4"
                    icon="heroicons:exclamation-triangle"
                />

                {/* Vendor information */}
                <div className="form-control mb-4">
                    <label className="label">
                        <span className="label-text font-medium">Vendor/Restaurant Name</span>
                        <span className="label-text-alt text-error">*</span>
                    </label>
                    <input
                        type="text"
                        className={`input input-bordered ${errors.vendor || validationMessages.vendor ? 'input-error' : ''}`}
                        value={invoiceData.vendor}
                        onChange={(e) => {
                            onChange({
                                ...invoiceData,
                                vendor: e.target.value
                            });

                            // Clear vendor error if it exists
                            if (errors.vendor && e.target.value.trim()) {
                                setErrors({ ...errors, vendor: undefined });
                            }
                        }}
                        placeholder="e.g. L&L Hawaiian Barbeque"
                    />
                    {(errors.vendor || validationMessages.vendor) && (
                        <label className="label">
                            <span className="label-text-alt text-error">{errors.vendor || validationMessages.vendor}</span>
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

                {validationMessages.items && (
                    <div className="mb-4">
                        <span className="text-error text-sm">{validationMessages.items}</span>
                    </div>
                )}

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
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            id="quantity"
                            className={`input input-bordered input-sm ${errors.quantity ? 'input-error' : ''}`}
                            style={numberInputStyle}
                            value={newItem.quantity}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^\d*$/.test(value)) {
                                    setNewItem({
                                        ...newItem,
                                        quantity: value === '' ? '' : parseInt(value) || 0
                                    });
                                }
                            }}
                            placeholder="Enter quantity"
                        />
                        {errors.quantity && <div className="text-error text-xs mt-1">{errors.quantity}</div>}
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Unit Price ($)</span>
                        </label>
                        <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*\.?[0-9]*"
                            id="unitPrice"
                            className={`input input-bordered input-sm ${errors.unitPrice ? 'input-error' : ''}`}
                            style={numberInputStyle}
                            value={newItem.unitPrice}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^\d*\.?\d*$/.test(value)) {
                                    setNewItem({
                                        ...newItem,
                                        unitPrice: value
                                    });
                                }
                            }}
                            placeholder="Enter price"
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
                            <span className="label-text font-medium">Tax Amount ($)</span>
                        </label>
                        <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*\.?[0-9]*"
                            className={`input input-bordered input-sm ${validationMessages.tax ? 'input-error' : ''}`}
                            style={numberInputStyle}
                            value={rawInputs.taxAmount}
                            onChange={handleTaxAmountChange}
                            placeholder="Enter tax amount"
                        />
                        {validationMessages.tax && (
                            <label className="label">
                                <span className="label-text-alt text-error">{validationMessages.tax}</span>
                            </label>
                        )}
                    </div>
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">Tip Amount ($)</span>
                        </label>
                        <input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*\.?[0-9]*"
                            className={`input input-bordered input-sm ${validationMessages.tip ? 'input-error' : ''}`}
                            style={numberInputStyle}
                            value={rawInputs.tipAmount}
                            onChange={handleTipAmountChange}
                            placeholder="Enter tip amount"
                        />
                        {validationMessages.tip && (
                            <label className="label">
                                <span className="label-text-alt text-error">{validationMessages.tip}</span>
                            </label>
                        )}
                    </div>
                </div>

                {/* Totals */}
                <div className="bg-base-300/30 p-4 rounded-lg">
                    <div className="flex justify-between mb-2">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(invoiceData.subtotal)}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                        <span>Tax:</span>
                        <span>{formatCurrency(invoiceData.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between mb-2">
                        <span>Tip:</span>
                        <span>{formatCurrency(invoiceData.tipAmount)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                        <span>Total:</span>
                        <span>{formatCurrency(invoiceData.total)}</span>
                    </div>
                </div>

                {/* Validation notice */}
                {invoiceData.items.length === 0 && (
                    <CustomAlert
                        type="info"
                        title="Invoice Required"
                        message="Please add at least one item to the invoice."
                        className="mt-4"
                        icon="heroicons:information-circle"
                    />
                )}

                {/* Important Note */}
                <CustomAlert
                    type="warning"
                    title="Important Note"
                    message="The invoice builder helps you itemize your expenses for AS funding. You must still upload the actual invoice file."
                    className="mt-4"
                    icon="heroicons:exclamation-triangle"
                />
            </div>
        </motion.div>
    );
};

export default InvoiceBuilder; 