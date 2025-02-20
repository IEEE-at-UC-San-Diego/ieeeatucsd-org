import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import InfoCard from './InfoCard';
import Tooltip from './Tooltip';
import { tooltips, infoNotes } from './tooltips';
import { Icon } from '@iconify/react';

interface InvoiceItem {
    quantity: number;
    item_name: string;
    unit_cost: number;
}

interface InvoiceData {
    items: InvoiceItem[];
    tax: number;
    tip: number;
    total: number;
    vendor: string;
}

interface ASFundingSectionProps {
    onDataChange?: (data: any) => void;
}

const ASFundingSection: React.FC<ASFundingSectionProps> = ({ onDataChange }) => {
    const [invoiceData, setInvoiceData] = useState<InvoiceData>({
        items: [{ quantity: 0, item_name: '', unit_cost: 0 }],
        tax: 0,
        tip: 0,
        total: 0,
        vendor: ''
    });

    const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
        const newItems = [...invoiceData.items];
        newItems[index] = { ...newItems[index], [field]: value };

        // Calculate new total
        const itemsTotal = newItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
        const newTotal = itemsTotal + invoiceData.tax + invoiceData.tip;

        setInvoiceData(prev => ({
            ...prev,
            items: newItems,
            total: newTotal
        }));

        // Notify parent with JSON string
        onDataChange?.({
            itemized_invoice: JSON.stringify({
                ...invoiceData,
                items: newItems,
                total: newTotal
            })
        });
    };

    const addItem = () => {
        setInvoiceData(prev => ({
            ...prev,
            items: [...prev.items, { quantity: 0, item_name: '', unit_cost: 0 }]
        }));
        toast('New item added', { icon: '➕' });
    };

    const removeItem = (index: number) => {
        if (invoiceData.items.length > 1) {
            const newItems = invoiceData.items.filter((_, i) => i !== index);

            // Recalculate total
            const itemsTotal = newItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
            const newTotal = itemsTotal + invoiceData.tax + invoiceData.tip;

            setInvoiceData(prev => ({
                ...prev,
                items: newItems,
                total: newTotal
            }));

            // Notify parent with JSON string
            onDataChange?.({
                itemized_invoice: JSON.stringify({
                    ...invoiceData,
                    items: newItems,
                    total: newTotal
                })
            });
            toast('Item removed', { icon: '🗑️' });
        }
    };

    const handleExtraChange = (field: 'tax' | 'tip' | 'vendor', value: string | number) => {
        const numValue = field !== 'vendor' ? Number(value) : value;

        // Calculate new total for tax/tip changes
        const itemsTotal = invoiceData.items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
        const newTotal = field === 'tax' ?
            itemsTotal + Number(value) + invoiceData.tip :
            field === 'tip' ?
                itemsTotal + invoiceData.tax + Number(value) :
                itemsTotal + invoiceData.tax + invoiceData.tip;

        setInvoiceData(prev => ({
            ...prev,
            [field]: numValue,
            total: field !== 'vendor' ? newTotal : prev.total
        }));

        // Notify parent with JSON string
        onDataChange?.({
            itemized_invoice: JSON.stringify({
                ...invoiceData,
                [field]: numValue,
                total: field !== 'vendor' ? newTotal : invoiceData.total
            })
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="card bg-base-100/95 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300"
        >
            <div className="card-body">
                <motion.h2
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="card-title text-xl mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-2"
                >
                    <Icon icon="mdi:cash" className="h-6 w-6" />
                    AS Funding Details
                </motion.h2>

                <div className="space-y-8">
                    <InfoCard
                        title={infoNotes.asFunding.title}
                        items={infoNotes.asFunding.items}
                        type="warning"
                        className="mb-6"
                    />

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="form-control w-full"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <label className="label">
                                <span className="label-text font-medium text-lg flex items-center gap-2">
                                    <Icon icon="mdi:store" className="h-5 w-5 text-primary" />
                                    Vendor Information
                                </span>
                            </label>
                            <Tooltip
                                title={tooltips.vendor.title}
                                description={tooltips.vendor.description}
                                position="left"
                            >
                                <div className="badge badge-primary badge-outline p-3 cursor-help">
                                    <Icon icon="mdi:information-outline" className="h-4 w-4" />
                                </div>
                            </Tooltip>
                        </div>

                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="Enter vendor name and location"
                                className="input input-bordered w-full pl-12 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                                value={invoiceData.vendor}
                                onChange={(e) => handleExtraChange('vendor', e.target.value)}
                                required
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 group-hover:text-primary transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="form-control w-full"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <label className="label">
                                <span className="label-text font-medium text-lg flex items-center gap-2">
                                    <Icon icon="mdi:file-document-outline" className="h-5 w-5 text-primary" />
                                    Itemized Invoice
                                </span>
                            </label>
                            <Tooltip
                                title={tooltips.invoice.title}
                                description={tooltips.invoice.description}
                                position="left"
                            >
                                <div className="badge badge-primary badge-outline p-3 cursor-help">
                                    <Icon icon="mdi:information-outline" className="h-4 w-4" />
                                </div>
                            </Tooltip>
                        </div>

                        <AnimatePresence mode="popLayout">
                            <div className="space-y-4">
                                {invoiceData.items.map((item, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex gap-4 items-end bg-base-200/50 p-4 rounded-lg group hover:bg-base-200 transition-colors duration-300"
                                    >
                                        <div className="form-control flex-1">
                                            <label className="label">
                                                <span className="label-text">Quantity</span>
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="input input-bordered w-full transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                                                value={item.quantity || ''}
                                                onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                                                required
                                            />
                                        </div>
                                        <div className="form-control flex-[3]">
                                            <label className="label">
                                                <span className="label-text">Item Name</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="input input-bordered w-full transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                                                value={item.item_name}
                                                onChange={(e) => handleItemChange(index, 'item_name', e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="form-control flex-1">
                                            <label className="label">
                                                <span className="label-text">Unit Cost ($)</span>
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="input input-bordered w-full pl-8 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                                                    value={item.unit_cost || ''}
                                                    onChange={(e) => handleItemChange(index, 'unit_cost', Number(e.target.value))}
                                                    required
                                                />
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-gray-400">$</span>
                                                </div>
                                            </div>
                                        </div>
                                        <motion.button
                                            type="button"
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            className="btn btn-ghost btn-square opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                            onClick={() => removeItem(index)}
                                            disabled={invoiceData.items.length === 1}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </motion.button>
                                    </motion.div>
                                ))}
                            </div>
                        </AnimatePresence>

                        <motion.button
                            type="button"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="btn btn-ghost mt-4 w-full group hover:bg-primary/10"
                            onClick={addItem}
                        >
                            <Icon icon="mdi:plus" className="h-6 w-6 mr-2 group-hover:text-primary transition-colors duration-300" />
                            Add Item
                        </motion.button>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="grid grid-cols-2 gap-4"
                    >
                        <div className="form-control">
                            <div className="flex items-center justify-between mb-2">
                                <label className="label">
                                    <span className="label-text font-medium flex items-center gap-2">
                                        <Icon icon="mdi:percent" className="h-5 w-5 text-primary" />
                                        Tax ($)
                                    </span>
                                </label>
                                <Tooltip
                                    title={tooltips.tax.title}
                                    description={tooltips.tax.description}
                                    position="top"
                                >
                                    <div className="badge badge-primary badge-outline p-3 cursor-help">
                                        <Icon icon="mdi:information-outline" className="h-4 w-4" />
                                    </div>
                                </Tooltip>
                            </div>
                            <div className="relative group">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="input input-bordered pl-10 w-full transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                                    value={invoiceData.tax || ''}
                                    onChange={(e) => handleExtraChange('tax', Number(e.target.value))}
                                    required
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-400 group-hover:text-primary transition-colors duration-300">$</span>
                                </div>
                            </div>
                        </div>
                        <div className="form-control">
                            <div className="flex items-center justify-between mb-2">
                                <label className="label">
                                    <span className="label-text font-medium flex items-center gap-2">
                                        <Icon icon="mdi:hand-coin" className="h-5 w-5 text-primary" />
                                        Tip ($)
                                    </span>
                                </label>
                                <Tooltip
                                    title={tooltips.tip.title}
                                    description={tooltips.tip.description}
                                    position="top"
                                >
                                    <div className="badge badge-primary badge-outline p-3 cursor-help">
                                        <Icon icon="mdi:information-outline" className="h-4 w-4" />
                                    </div>
                                </Tooltip>
                            </div>
                            <div className="relative group">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="input input-bordered pl-10 w-full transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                                    value={invoiceData.tip || ''}
                                    onChange={(e) => handleExtraChange('tip', Number(e.target.value))}
                                    required
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-400 group-hover:text-primary transition-colors duration-300">$</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="form-control"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <label className="label">
                                <span className="label-text font-medium text-lg flex items-center gap-2">
                                    <Icon icon="mdi:calculator" className="h-5 w-5 text-primary" />
                                    Total Amount
                                </span>
                            </label>
                            <Tooltip
                                title={tooltips.total.title}
                                description={tooltips.total.description}
                                position="left"
                            >
                                <div className="badge badge-primary badge-outline p-3 cursor-help">
                                    <Icon icon="mdi:information-outline" className="h-4 w-4" />
                                </div>
                            </Tooltip>
                        </div>
                        <div className="relative group">
                            <input
                                type="number"
                                className="input input-bordered pl-10 w-full font-bold bg-base-200/50 transition-all duration-300"
                                value={invoiceData.total.toFixed(2)}
                                disabled
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-400 group-hover:text-primary transition-colors duration-300">$</span>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="form-control w-full"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <label className="label">
                                <span className="label-text font-medium text-lg flex items-center gap-2">
                                    <Icon icon="mdi:cloud-upload" className="h-5 w-5 text-primary" />
                                    Upload Invoice
                                </span>
                            </label>
                            <Tooltip
                                title={tooltips.invoice.title}
                                description={tooltips.invoice.description}
                                position="left"
                            >
                                <div className="badge badge-primary badge-outline p-3 cursor-help">
                                    <Icon icon="mdi:information-outline" className="h-4 w-4" />
                                </div>
                            </Tooltip>
                        </div>

                        <InfoCard
                            title={infoNotes.invoice.title}
                            items={infoNotes.invoice.items}
                            type="info"
                            className="mb-4"
                        />

                        <div className="relative group">
                            <input
                                type="file"
                                name="invoice"
                                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                className="file-input file-input-bordered w-full pl-12 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                                onChange={(e) => {
                                    onDataChange?.({ invoice: e.target.files?.[0] });
                                    if (e.target.files?.[0]) {
                                        toast('Invoice file uploaded', { icon: '📄' });
                                    }
                                }}
                                required
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400 group-hover:text-primary transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    );
};

export default ASFundingSection; 