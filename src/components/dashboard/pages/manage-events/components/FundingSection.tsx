import React from 'react';
import { DollarSign, Plus, Trash2, Upload, FileText } from 'lucide-react';
import type { InvoiceFormData, InvoiceTabState, JsonImportData } from '../types/EventRequestTypes';
import { calculateGrandTotal } from '../utils/eventRequestUtils';

interface FundingSectionProps {
    needsAsFunding: boolean;
    invoices: InvoiceFormData[];
    invoiceTabState: InvoiceTabState;
    jsonImportData: JsonImportData;
    activeInvoiceTab: string;
    onAddInvoice: () => void;
    onRemoveInvoice: (invoiceId: string) => void;
    onUpdateInvoice: (invoiceId: string, updates: Partial<InvoiceFormData>) => void;
    onAddInvoiceItem: (invoiceId: string) => void;
    onRemoveInvoiceItem: (invoiceId: string, itemIndex: number) => void;
    onUpdateInvoiceItem: (invoiceId: string, itemIndex: number, field: string, value: string | number) => void;
    onHandleJsonImport: (invoiceId: string) => void;
    onUpdateJsonImportData: (invoiceId: string, data: string) => void;
    onUpdateInvoiceTabState: (invoiceId: string, tab: 'details' | 'import') => void;
    onSetActiveInvoiceTab: (invoiceId: string) => void;
}

export default function FundingSection({
    needsAsFunding,
    invoices,
    invoiceTabState,
    jsonImportData,
    activeInvoiceTab,
    onAddInvoice,
    onRemoveInvoice,
    onUpdateInvoice,
    onAddInvoiceItem,
    onRemoveInvoiceItem,
    onUpdateInvoiceItem,
    onHandleJsonImport,
    onUpdateJsonImportData,
    onUpdateInvoiceTabState,
    onSetActiveInvoiceTab
}: FundingSectionProps) {
    if (!needsAsFunding) {
        return (
            <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">
                    <DollarSign className="w-4 h-4 inline mr-2" />
                    No AS funding requested for this event.
                </p>
            </div>
        );
    }

    const grandTotal = calculateGrandTotal(invoices);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <DollarSign className="w-6 h-6 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">AS Funding Details</h3>
                </div>
                <button
                    type="button"
                    onClick={onAddInvoice}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>Add Invoice</span>
                </button>
            </div>

            {invoices.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                        Please add at least one invoice to request AS funding.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Invoice Tabs */}
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8 overflow-x-auto">
                            {invoices.map((invoice, index) => {
                                const subtotal = invoice.items.reduce((sum, item) => sum + item.total, 0);
                                const total = subtotal + invoice.tax + invoice.tip;
                                const currentTab = invoiceTabState[invoice.id] || 'details';

                                return (
                                    <button
                                        key={invoice.id}
                                        type="button"
                                        onClick={() => onSetActiveInvoiceTab(invoice.id)}
                                        className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${activeInvoiceTab === invoice.id
                                                ? 'border-green-500 text-green-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            }`}
                                    >
                                        Invoice #{index + 1}
                                        {invoice.vendor && ` - ${invoice.vendor}`}
                                        {total > 0 && (
                                            <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                                                ${total.toFixed(2)}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Active Invoice Content */}
                    {invoices.map((invoice, index) => {
                        if (activeInvoiceTab !== invoice.id) return null;

                        const subtotal = invoice.items.reduce((sum, item) => sum + item.total, 0);
                        const total = subtotal + invoice.tax + invoice.tip;
                        const currentTab = invoiceTabState[invoice.id] || 'details';

                        return (
                            <div key={invoice.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-lg font-medium text-gray-900">
                                        Invoice #{index + 1}
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => onRemoveInvoice(invoice.id)}
                                        className="flex items-center space-x-1 px-3 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Remove</span>
                                    </button>
                                </div>

                                {/* Invoice Tab Navigation */}
                                <div className="flex space-x-4 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => onUpdateInvoiceTabState(invoice.id, 'details')}
                                        className={`px-3 py-1 rounded text-sm font-medium ${currentTab === 'details'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'text-gray-600 hover:text-gray-800'
                                            }`}
                                    >
                                        Manual Entry
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onUpdateInvoiceTabState(invoice.id, 'import')}
                                        className={`px-3 py-1 rounded text-sm font-medium ${currentTab === 'import'
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'text-gray-600 hover:text-gray-800'
                                            }`}
                                    >
                                        Import JSON
                                    </button>
                                </div>

                                {currentTab === 'details' ? (
                                    <div className="space-y-4">
                                        {/* Vendor */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Vendor/Restaurant *
                                            </label>
                                            <input
                                                type="text"
                                                value={invoice.vendor}
                                                onChange={(e) => onUpdateInvoice(invoice.id, { vendor: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Enter vendor or restaurant name"
                                            />
                                        </div>

                                        {/* Invoice File */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                <Upload className="w-4 h-4 inline mr-2" />
                                                Invoice File *
                                            </label>
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                onChange={(e) => onUpdateInvoice(invoice.id, { invoiceFile: e.target.files?.[0] || null })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                            {invoice.existingInvoiceFile && (
                                                <div className="mt-2 flex items-center space-x-2 text-sm text-gray-600">
                                                    <FileText className="w-4 h-4" />
                                                    <span>Current file: {invoice.existingInvoiceFile.split('/').pop()}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Items */}
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <label className="block text-sm font-medium text-gray-700">
                                                    Invoice Items *
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => onAddInvoiceItem(invoice.id)}
                                                    className="flex items-center space-x-1 px-3 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    <span>Add Item</span>
                                                </button>
                                            </div>

                                            <div className="space-y-3">
                                                {invoice.items.map((item, itemIndex) => (
                                                    <div key={itemIndex} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-3 rounded">
                                                        <div className="col-span-4">
                                                            <input
                                                                type="text"
                                                                value={item.description}
                                                                onChange={(e) => onUpdateInvoiceItem(invoice.id, itemIndex, 'description', e.target.value)}
                                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                                placeholder="Item description"
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.quantity}
                                                                onChange={(e) => onUpdateInvoiceItem(invoice.id, itemIndex, 'quantity', parseInt(e.target.value) || 1)}
                                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                                placeholder="Qty"
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={item.unitPrice}
                                                                onChange={(e) => onUpdateInvoiceItem(invoice.id, itemIndex, 'unitPrice', parseFloat(e.target.value) || 0)}
                                                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                                placeholder="Price"
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <input
                                                                type="text"
                                                                value={`$${item.total.toFixed(2)}`}
                                                                readOnly
                                                                className="w-full px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm"
                                                            />
                                                        </div>
                                                        <div className="col-span-2">
                                                            {invoice.items.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onRemoveInvoiceItem(invoice.id, itemIndex)}
                                                                    className="w-full flex items-center justify-center px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Tax and Tip */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Tax ($)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={invoice.tax}
                                                    onChange={(e) => onUpdateInvoice(invoice.id, { tax: parseFloat(e.target.value) || 0 })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Tip ($)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={invoice.tip}
                                                    onChange={(e) => onUpdateInvoice(invoice.id, { tip: parseFloat(e.target.value) || 0 })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>

                                        {/* Invoice Total */}
                                        <div className="bg-green-50 p-3 rounded-lg">
                                            <div className="flex justify-between items-center text-sm">
                                                <span>Subtotal:</span>
                                                <span>${subtotal.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span>Tax:</span>
                                                <span>${invoice.tax.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span>Tip:</span>
                                                <span>${invoice.tip.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-lg font-semibold border-t border-green-200 pt-2 mt-2">
                                                <span>Total:</span>
                                                <span>${total.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Import Invoice Data (JSON)
                                            </label>
                                            <textarea
                                                value={jsonImportData[invoice.id] || ''}
                                                onChange={(e) => onUpdateJsonImportData(invoice.id, e.target.value)}
                                                rows={8}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                                                placeholder='{"vendor": "Restaurant Name", "tax": 5.50, "tip": 10.00, "items": [{"description": "Item 1", "quantity": 2, "unitPrice": 15.99}]}'
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => onHandleJsonImport(invoice.id)}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            Import Data
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Grand Total */}
                    {invoices.length > 1 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex justify-between items-center text-xl font-bold text-blue-900">
                                <span>Grand Total (All Invoices):</span>
                                <span>${grandTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
