import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
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

// Row animation
const rowVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            type: "spring",
            stiffness: 500,
            damping: 25,
            mass: 0.8,
            duration: 0.25
        }
    },
    exit: {
        opacity: 0,
        x: 10,
        transition: { duration: 0.15 }
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
    taxAmount: number;
    tipAmount: number;
    total: number;
    vendor: string;
}

interface InvoiceBuilderProps {
    invoiceData: InvoiceData;
    onChange: (data: InvoiceData) => void;
}

const InvoiceBuilder: React.FC<InvoiceBuilderProps> = ({ invoiceData, onChange }) => {
    const [validationMessages, setValidationMessages] = useState({
        vendor: '',
        items: '',
        tax: '',
        tip: ''
    });

    // State for new item form
    const [newItem, setNewItem] = useState<{
        description: string;
        quantity: number;
        unitPrice: string;
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
    }>({});

    // State for raw input values (to preserve exact user input)
    const [rawInputs, setRawInputs] = useState<{
        taxAmount: string;
        tipAmount: string;
    }>({
        taxAmount: '',
        tipAmount: ''
    });

    // Validate inputs
    useEffect(() => {
        const newValidationMessages = {
            vendor: !invoiceData.vendor ? 'Vendor name is required' : '',
            items: invoiceData.items.length === 0 ? 'At least one item is required' : '',
            tax: invoiceData.taxAmount && isNaN(parseFloat(invoiceData.taxAmount.toString())) ? 'Tax must be a valid number' : '',
            tip: invoiceData.tipAmount && isNaN(parseFloat(invoiceData.tipAmount.toString())) ? 'Tip must be a valid number' : ''
        };

        setValidationMessages(newValidationMessages);
    }, [invoiceData]);

    // Handle vendor name change
    const handleVendorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange({ ...invoiceData, vendor: e.target.value });
    };

    // Generate a unique ID for new items
    const generateId = () => {
        return `item-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    };

    // Helper function to round to 2 decimal places
    const roundToTwoDecimals = (num: number): number => {
        return Math.round((num + Number.EPSILON) * 100) / 100;
    };

    // Validate new item before adding
    const validateNewItem = () => {
        const newErrors: {
            description?: string;
            quantity?: string;
            unitPrice?: string;
        } = {};

        if (!newItem.description.trim()) {
            newErrors.description = 'Item description is required';
        }

        if (typeof newItem.quantity !== 'number' || newItem.quantity <= 0) {
            newErrors.quantity = 'Quantity must be a positive number';
        }

        const unitPrice = typeof newItem.unitPrice === 'string'
            ? parseFloat(newItem.unitPrice)
            : newItem.unitPrice;

        if (isNaN(unitPrice) || unitPrice <= 0) {
            newErrors.unitPrice = 'Price must be a positive number';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Add new item
    const handleAddItem = () => {
        if (!validateNewItem()) {
            return;
        }

        // Calculate amount
        const quantity = typeof newItem.quantity === 'number' ? newItem.quantity : 0;
        const unitPrice = typeof newItem.unitPrice === 'string' && newItem.unitPrice !== ''
            ? parseFloat(newItem.unitPrice)
            : 0;

        const amount = roundToTwoDecimals(quantity * unitPrice);

        // Create new item
        const item: InvoiceItem = {
            id: generateId(),
            description: newItem.description,
            quantity: quantity,
            unitPrice: unitPrice,
            amount: amount
        };

        // Add item to invoice
        const updatedItems = [...invoiceData.items, item];

        // Calculate new subtotal
        const subtotal = updatedItems.reduce((sum, item) => sum + item.amount, 0);

        // Recalculate tax and tip amounts based on rates
        const taxAmount = roundToTwoDecimals(invoiceData.taxAmount);
        const tipAmount = roundToTwoDecimals(invoiceData.tipAmount);

        // Calculate new total
        const total = roundToTwoDecimals(subtotal + taxAmount + tipAmount);

        onChange({
            ...invoiceData,
            items: updatedItems,
            subtotal: subtotal,
            taxAmount: taxAmount,
            tipAmount: tipAmount,
            total: total
        });

        // Reset form
        setNewItem({
            description: '',
            quantity: 1,
            unitPrice: ''
        });

        // Clear errors
        setErrors({});

        toast.success(`Added ${item.description} to invoice`);
    };

    // Handle item changes
    const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
        const updatedItems = [...invoiceData.items];

        if (field === 'description') {
            updatedItems[index] = { ...updatedItems[index], description: value as string };
        } else if (field === 'unitPrice') {
            const unitPrice = parseFloat(value.toString());
            if (!isNaN(unitPrice)) {
                const amount = roundToTwoDecimals(unitPrice * updatedItems[index].quantity);
                updatedItems[index] = {
                    ...updatedItems[index],
                    unitPrice: unitPrice,
                    amount: amount
                };
            }
        } else if (field === 'quantity') {
            const quantity = parseInt(value.toString());
            if (!isNaN(quantity)) {
                const amount = roundToTwoDecimals(quantity * updatedItems[index].unitPrice);
                updatedItems[index] = {
                    ...updatedItems[index],
                    quantity: quantity,
                    amount: amount
                };
            }
        }

        // Calculate new subtotal
        const subtotal = updatedItems.reduce((sum, item) => sum + item.amount, 0);

        // Recalculate tax and tip amounts based on rates
        const taxAmount = roundToTwoDecimals(invoiceData.taxAmount);
        const tipAmount = roundToTwoDecimals(invoiceData.tipAmount);

        // Calculate new total
        const total = roundToTwoDecimals(subtotal + taxAmount + tipAmount);

        onChange({
            ...invoiceData,
            items: updatedItems,
            subtotal: subtotal,
            taxAmount: taxAmount,
            tipAmount: tipAmount,
            total: total
        });
    };

    // Remove item
    const handleRemoveItem = (id: string) => {
        const updatedItems = invoiceData.items.filter(item => item.id !== id);

        // Calculate new subtotal
        const subtotal = updatedItems.reduce((sum, item) => sum + item.amount, 0);

        // Recalculate tax and tip amounts based on rates
        const taxAmount = roundToTwoDecimals(invoiceData.taxAmount);
        const tipAmount = roundToTwoDecimals(invoiceData.tipAmount);

        // Calculate new total
        const total = roundToTwoDecimals(subtotal + taxAmount + tipAmount);

        onChange({
            ...invoiceData,
            items: updatedItems,
            subtotal: subtotal,
            taxAmount: taxAmount,
            tipAmount: tipAmount,
            total: total
        });

        toast.success('Item removed from invoice');
    };

    // Handle tax change
    const handleTaxAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const taxAmount = parseFloat(e.target.value);
        if (!isNaN(taxAmount)) {
            const total = roundToTwoDecimals(invoiceData.subtotal + taxAmount + invoiceData.tipAmount);

            onChange({
                ...invoiceData,
                taxAmount: taxAmount,
                total: total
            });
        } else {
            onChange({ ...invoiceData, taxAmount: 0 });
        }
    };

    // Handle tip change
    const handleTipAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const tipAmount = parseFloat(e.target.value);
        if (!isNaN(tipAmount)) {
            const total = roundToTwoDecimals(invoiceData.subtotal + invoiceData.taxAmount + tipAmount);

            onChange({
                ...invoiceData,
                tipAmount: tipAmount,
                total: total
            });
        } else {
            onChange({ ...invoiceData, tipAmount: 0 });
        }
    };

    // Calculate subtotal
    const subtotal = invoiceData.subtotal;

    // Calculate tax amount
    const taxAmount = invoiceData.taxAmount;

    // Calculate tip amount
    const tipAmount = invoiceData.tipAmount;

    // Calculate total
    const total = invoiceData.total;

    return (
        <motion.div
            className="space-y-6"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            <motion.div variants={itemVariants}>
                <h3 className="text-xl font-bold mb-4 text-primary">Invoice Builder</h3>
            </motion.div>

            {/* AS Funding Limit Notice */}
            <CustomAlert
                type="warning"
                title="AS Funding Limits"
                message="Maximum of $10.00 per expected student attendee and $5,000 per event."
                className="mb-4"
                icon="heroicons:exclamation-triangle"
            />

            {/* Vendor Input */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <label className="label">
                    <span className="label-text font-medium text-lg">Vendor Name</span>
                    <span className="label-text-alt text-error">*</span>
                </label>

                <div className="relative">
                    <motion.input
                        type="text"
                        className={`input input-bordered w-full ${validationMessages.vendor ? 'input-error' : 'focus:input-primary'}`}
                        placeholder="Enter vendor name"
                        value={invoiceData.vendor}
                        onChange={handleVendorChange}
                        whileHover="hover"
                        variants={inputHoverVariants}
                    />
                    {validationMessages.vendor && (
                        <div className="text-error text-sm mt-1 flex items-center gap-1">
                            <Icon icon="heroicons:exclamation-circle" className="w-4 h-4" />
                            {validationMessages.vendor}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Add New Item Form */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <h4 className="font-medium text-lg mb-4">Add New Item</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Description</span>
                        </label>
                        <motion.input
                            type="text"
                            className={`input input-bordered w-full ${errors.description ? 'input-error' : 'focus:input-primary'}`}
                            placeholder="Item description"
                            value={newItem.description}
                            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                            whileHover="hover"
                            variants={inputHoverVariants}
                        />
                        {errors.description && (
                            <div className="text-error text-sm mt-1 flex items-center gap-1">
                                <Icon icon="heroicons:exclamation-circle" className="w-4 h-4" />
                                {errors.description}
                            </div>
                        )}
                    </div>

                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Price ($)</span>
                        </label>
                        <motion.input
                            type="number"
                            className={`input input-bordered w-full ${errors.unitPrice ? 'input-error' : 'focus:input-primary'}`}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            value={newItem.unitPrice}
                            onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
                            whileHover="hover"
                            variants={inputHoverVariants}
                        />
                        {errors.unitPrice && (
                            <div className="text-error text-sm mt-1 flex items-center gap-1">
                                <Icon icon="heroicons:exclamation-circle" className="w-4 h-4" />
                                {errors.unitPrice}
                            </div>
                        )}
                    </div>

                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Quantity</span>
                        </label>
                        <motion.input
                            type="number"
                            className={`input input-bordered w-full ${errors.quantity ? 'input-error' : 'focus:input-primary'}`}
                            placeholder="1"
                            min="1"
                            value={newItem.quantity}
                            onChange={(e) => {
                                const value = parseInt(e.target.value);
                                setNewItem({
                                    ...newItem,
                                    quantity: isNaN(value) ? 1 : value
                                });
                            }}
                            whileHover="hover"
                            variants={inputHoverVariants}
                        />
                        {errors.quantity && (
                            <div className="text-error text-sm mt-1 flex items-center gap-1">
                                <Icon icon="heroicons:exclamation-circle" className="w-4 h-4" />
                                {errors.quantity}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end">
                    <motion.button
                        type="button"
                        className="btn btn-primary gap-2"
                        onClick={handleAddItem}
                        whileHover="hover"
                        whileTap="tap"
                        variants={buttonVariants}
                    >
                        <Icon icon="heroicons:plus-circle" className="w-5 h-5" />
                        Add Item
                    </motion.button>
                </div>
            </motion.div>

            {/* Items Section */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <div className="flex justify-between items-center mb-4">
                    <label className="label-text font-medium text-lg">
                        Items
                        <span className="text-error ml-1">*</span>
                    </label>
                </div>

                {validationMessages.items && (
                    <div className="text-error text-sm mb-3 flex items-center gap-1">
                        <Icon icon="heroicons:exclamation-circle" className="w-4 h-4" />
                        {validationMessages.items}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                        <thead>
                            <tr className="bg-base-300/50">
                                <th className="w-[40%]">Item</th>
                                <th className="w-[20%]">Price ($)</th>
                                <th className="w-[15%]">Qty</th>
                                <th className="w-[20%]">Total ($)</th>
                                <th className="w-[5%]"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoiceData.items.map((item, index) => (
                                <motion.tr
                                    key={item.id}
                                    variants={rowVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    className="hover:bg-base-300/30 transition-colors"
                                >
                                    <td>
                                        <motion.input
                                            type="text"
                                            className="input input-bordered input-sm w-full focus:input-primary"
                                            placeholder="Item name"
                                            value={item.description}
                                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                            whileHover="hover"
                                            variants={inputHoverVariants}
                                        />
                                    </td>
                                    <td>
                                        <motion.input
                                            type="number"
                                            className="input input-bordered input-sm w-full focus:input-primary"
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                            value={item.unitPrice}
                                            onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                                            whileHover="hover"
                                            variants={inputHoverVariants}
                                        />
                                    </td>
                                    <td>
                                        <motion.input
                                            type="number"
                                            className="input input-bordered input-sm w-full focus:input-primary"
                                            placeholder="1"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                            whileHover="hover"
                                            variants={inputHoverVariants}
                                        />
                                    </td>
                                    <td>
                                        <div className="input input-sm input-bordered bg-base-200/50 w-full text-right">
                                            {item.amount.toFixed(2)}
                                        </div>
                                    </td>
                                    <td>
                                        <motion.button
                                            type="button"
                                            className="btn btn-sm btn-ghost btn-circle text-error"
                                            onClick={() => handleRemoveItem(item.id)}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                        >
                                            <Icon icon="heroicons:trash" className="w-5 h-5" />
                                        </motion.button>
                                    </td>
                                </motion.tr>
                            ))}
                            {invoiceData.items.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-4 text-gray-500">
                                        No items added yet. Use the form above to add items.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Tax and Tip Section */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <label className="label-text font-medium text-lg mb-4">Tax and Tip</label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Tax Amount ($)</span>
                        </label>
                        <div className="relative">
                            <motion.input
                                type="number"
                                className={`input input-bordered w-full ${validationMessages.tax ? 'input-error' : 'focus:input-primary'}`}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                value={invoiceData.taxAmount || ''}
                                onChange={handleTaxAmountChange}
                                whileHover="hover"
                                variants={inputHoverVariants}
                            />
                            {validationMessages.tax && (
                                <div className="text-error text-sm mt-1 flex items-center gap-1">
                                    <Icon icon="heroicons:exclamation-circle" className="w-4 h-4" />
                                    {validationMessages.tax}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-control">
                        <label className="label">
                            <span className="label-text">Tip Amount ($)</span>
                        </label>
                        <div className="relative">
                            <motion.input
                                type="number"
                                className={`input input-bordered w-full ${validationMessages.tip ? 'input-error' : 'focus:input-primary'}`}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                value={invoiceData.tipAmount || ''}
                                onChange={handleTipAmountChange}
                                whileHover="hover"
                                variants={inputHoverVariants}
                            />
                            {validationMessages.tip && (
                                <div className="text-error text-sm mt-1 flex items-center gap-1">
                                    <Icon icon="heroicons:exclamation-circle" className="w-4 h-4" />
                                    {validationMessages.tip}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Totals Section */}
            <motion.div
                variants={itemVariants}
                className="bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <h3 className="text-lg font-medium mb-4">Invoice Summary</h3>

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-base-content/70">Subtotal:</span>
                        <span className="font-medium">${subtotal.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-base-content/70">Tax:</span>
                        <span className="font-medium">${taxAmount.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-base-content/70">Tip:</span>
                        <span className="font-medium">${tipAmount.toFixed(2)}</span>
                    </div>

                    <div className="divider my-2"></div>

                    <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">Total:</span>
                        <span className="text-lg font-bold text-primary">${total.toFixed(2)}</span>
                    </div>
                </div>
            </motion.div>

            {/* Budget Warning */}
            {total > 0 && (
                <CustomAlert
                    type="warning"
                    title="BUDGET RESTRICTION"
                    message="Your total cannot exceed $10 per expected attendee, with an absolute maximum of $5,000. Your form WILL BE REJECTED if it exceeds this limit."
                    className="mt-4"
                    icon="heroicons:exclamation-triangle"
                />
            )}

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

            {/* Summary Section */}
            <motion.div
                variants={itemVariants}
                className="mt-6 bg-base-200/40 rounded-lg p-4"
            >
                <div className=" md:grid-cols-2 gap-6">


                    {/* Right Column: Summary */}
                    <div>
                        <h3 className="font-medium text-lg mb-3">Invoice Summary</h3>
                        <div className="bg-base-100/50 p-4 rounded-lg">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm">Subtotal:</span>
                                <span className="font-medium">${invoiceData.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm">Tax:</span>
                                <span className="font-medium">${invoiceData.taxAmount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-sm">Tip:</span>
                                <span className="font-medium">${invoiceData.tipAmount.toFixed(2)}</span>
                            </div>
                            <div className="divider my-1"></div>
                            <div className="flex justify-between items-center font-bold text-primary">
                                <span>Total:</span>
                                <span>${invoiceData.total.toFixed(2)}</span>
                            </div>
                        </div>


                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default InvoiceBuilder; 