import React, { useState } from 'react';
import { FileText, Eye, Download, ExternalLink, Copy, Check, HelpCircle, Upload } from 'lucide-react';
import { truncateFilename, isImageFile, isPdfFile } from '../utils/filenameUtils';
import DragDropFileUpload from './DragDropFileUpload';
import EnhancedFileUploadManager from './EnhancedFileUploadManager';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  vendor: string;
  items: InvoiceItem[];
  tax: number;
  tip: number;
  subtotal: number;
  total: number;
  invoiceFiles: File[];
  existingInvoiceFiles: string[];
  // Legacy fields for backward compatibility
  invoiceFile?: File | null;
  existingInvoiceFile?: string;
}

interface InvoiceEditorProps {
  invoices: Invoice[];
  onInvoicesChange: (invoices: Invoice[]) => void;
  onFileUpload?: (file: File) => Promise<string>;
  disabled?: boolean;
}

export default function InvoiceEditor({
  invoices,
  onInvoicesChange,
  onFileUpload,
  disabled = false
}: InvoiceEditorProps) {
  const [showSampleJson, setShowSampleJson] = useState(false);
  const [copiedSample, setCopiedSample] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const sampleJsonData = {
    invoices: [
      {
        id: "invoice_1",
        vendor: "Costco Wholesale",
        items: [
          {
            description: "Pizza slices (cheese)",
            quantity: 20,
            unitPrice: 2.50,
            total: 50.00
          },
          {
            description: "Bottled water (24-pack)",
            quantity: 3,
            unitPrice: 4.99,
            total: 14.97
          }
        ],
        tax: 5.25,
        tip: 0.00,
        subtotal: 64.97,
        total: 70.22
      },
      {
        id: "invoice_2",
        vendor: "Office Depot",
        items: [
          {
            description: "Name tags (pack of 100)",
            quantity: 1,
            unitPrice: 12.99,
            total: 12.99
          },
          {
            description: "Markers (pack of 12)",
            quantity: 2,
            unitPrice: 8.50,
            total: 17.00
          }
        ],
        tax: 2.42,
        tip: 0.00,
        subtotal: 29.99,
        total: 32.41
      }
    ]
  };

  const fieldDescriptions = {
    vendor: "The business or store name where the purchase was made",
    description: "Detailed description of the item purchased",
    quantity: "Number of items purchased (must be a positive integer)",
    unitPrice: "Price per individual item (in dollars, e.g., 2.50)",
    tax: "Total tax amount for this invoice (in dollars)",
    tip: "Tip amount if applicable (in dollars)",
    subtotal: "Sum of all item totals before tax and tip",
    total: "Final amount including tax and tip"
  };

  const copySampleJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(sampleJsonData, null, 2));
      setCopiedSample(true);
      setTimeout(() => setCopiedSample(false), 2000);
    } catch (error) {
      console.error('Failed to copy sample JSON:', error);
    }
  };

  const addInvoice = () => {
    const newInvoice: Invoice = {
      id: `invoice_${Date.now()}`,
      vendor: '',
      items: [{
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0
      }],
      tax: 0,
      tip: 0,
      subtotal: 0,
      total: 0,
      invoiceFiles: [],
      existingInvoiceFiles: [],
      // Legacy fields for backward compatibility
      invoiceFile: null,
      existingInvoiceFile: ''
    };
    onInvoicesChange([...invoices, newInvoice]);
  };

  const removeInvoice = (invoiceId: string) => {
    onInvoicesChange(invoices.filter(inv => inv.id !== invoiceId));
  };

  const updateInvoice = (invoiceId: string, updates: Partial<Invoice>) => {
    onInvoicesChange(invoices.map(inv =>
      inv.id === invoiceId ? { ...inv, ...updates } : inv
    ));
  };

  const addItem = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      const newItem: InvoiceItem = {
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0
      };
      updateInvoice(invoiceId, {
        items: [...invoice.items, newItem]
      });
    }
  };

  const removeItem = (invoiceId: string, itemIndex: number) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      const newItems = invoice.items.filter((_, index) => index !== itemIndex);
      updateInvoice(invoiceId, { items: newItems });
      recalculateInvoice(invoiceId, { items: newItems });
    }
  };

  const updateItem = (invoiceId: string, itemIndex: number, field: keyof InvoiceItem, value: any) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      const newItems = invoice.items.map((item, index) => {
        if (index === itemIndex) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updatedItem.total = updatedItem.quantity * updatedItem.unitPrice;
          }
          return updatedItem;
        }
        return item;
      });
      updateInvoice(invoiceId, { items: newItems });
      recalculateInvoice(invoiceId, { items: newItems });
    }
  };

  const recalculateInvoice = (invoiceId: string, updates: Partial<Invoice> = {}) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      const updatedInvoice = { ...invoice, ...updates };
      const subtotal = updatedInvoice.items.reduce((sum, item) => sum + item.total, 0);
      const total = subtotal + (updatedInvoice.tax || 0) + (updatedInvoice.tip || 0);

      updateInvoice(invoiceId, {
        ...updates,
        subtotal,
        total
      });
    }
  };

  const FileViewer = ({ url, filename }: { url: string; filename: string }) => {
    const isImage = isImageFile(filename);
    const isPdf = isPdfFile(filename);
    const displayName = truncateFilename(filename);

    return (
      <div className="border rounded-lg p-3 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">{displayName}</span>
          <div className="flex space-x-1">
            <button
              onClick={() => setSelectedFile(url)}
              className="text-blue-600 hover:text-blue-800 p-1"
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:text-purple-800 p-1"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <a
              href={url}
              download={filename}
              className="text-green-600 hover:text-green-800 p-1"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        </div>
        {isImage && (
          <img
            src={url}
            alt={filename}
            className="w-full h-20 object-cover rounded cursor-pointer"
            onClick={() => setSelectedFile(url)}
          />
        )}
        {isPdf && (
          <div
            className="w-full h-20 bg-red-100 rounded flex items-center justify-center cursor-pointer"
            onClick={() => setSelectedFile(url)}
          >
            <FileText className="w-6 h-6 text-red-600" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Sample JSON */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Invoice Editor</h3>
        <button
          onClick={() => setShowSampleJson(!showSampleJson)}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
        >
          <FileText className="w-4 h-4" />
          <span>Sample JSON</span>
        </button>
      </div>

      {/* Sample JSON Section */}
      {showSampleJson && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Sample Invoice JSON Format</h4>
            <button
              onClick={copySampleJson}
              className="flex items-center space-x-1 px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              {copiedSample ? (
                <>
                  <Check className="w-4 h-4" />
                  <span className="text-sm">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="text-sm">Copy</span>
                </>
              )}
            </button>
          </div>
          <pre className="bg-white border rounded p-3 text-sm overflow-x-auto">
            {JSON.stringify(sampleJsonData, null, 2)}
          </pre>
        </div>
      )}

      {/* Field Descriptions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-3 flex items-center">
          <HelpCircle className="w-4 h-4 mr-2" />
          Field Descriptions
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {Object.entries(fieldDescriptions).map(([field, description]) => (
            <div key={field}>
              <span className="font-medium text-blue-800 capitalize">{field}:</span>
              <p className="text-blue-700">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Invoices */}
      <div className="space-y-4">
        {invoices.map((invoice, invoiceIndex) => (
          <div key={invoice.id} className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">Invoice #{invoiceIndex + 1}</h4>
              <button
                onClick={() => removeInvoice(invoice.id)}
                disabled={disabled}
                className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
              >
                Remove Invoice
              </button>
            </div>

            {/* Vendor */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendor/Store Name *
              </label>
              <input
                type="text"
                value={invoice.vendor}
                onChange={(e) => updateInvoice(invoice.id, { vendor: e.target.value })}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                placeholder="e.g., Costco Wholesale"
              />
            </div>

            {/* Items */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Items</label>
                <button
                  onClick={() => addItem(invoice.id)}
                  disabled={disabled}
                  className="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
                >
                  Add Item
                </button>
              </div>
              <div className="space-y-2">
                {invoice.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(invoice.id, itemIndex, 'description', e.target.value)}
                        disabled={disabled}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                        placeholder="Item description"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(invoice.id, itemIndex, 'quantity', parseInt(e.target.value) || 0)}
                        disabled={disabled}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                        placeholder="Qty"
                        min="1"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(invoice.id, itemIndex, 'unitPrice', parseFloat(e.target.value) || 0)}
                        disabled={disabled}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100"
                        placeholder="Price"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={`$${item.total.toFixed(2)}`}
                        disabled
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-gray-100 text-gray-600"
                      />
                    </div>
                    <div className="col-span-1">
                      <button
                        onClick={() => removeItem(invoice.id, itemIndex)}
                        disabled={disabled || invoice.items.length <= 1}
                        className="text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax and Tip */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax ($)</label>
                <input
                  type="number"
                  value={invoice.tax}
                  onChange={(e) => {
                    const tax = parseFloat(e.target.value) || 0;
                    updateInvoice(invoice.id, { tax });
                    recalculateInvoice(invoice.id, { tax });
                  }}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  step="0.01"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tip ($)</label>
                <input
                  type="number"
                  value={invoice.tip}
                  onChange={(e) => {
                    const tip = parseFloat(e.target.value) || 0;
                    updateInvoice(invoice.id, { tip });
                    recalculateInvoice(invoice.id, { tip });
                  }}
                  disabled={disabled}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Subtotal:</span>
                  <p className="font-medium">${invoice.subtotal.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Tax + Tip:</span>
                  <p className="font-medium">${(invoice.tax + invoice.tip).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-gray-600">Total:</span>
                  <p className="font-bold text-lg text-green-600">${invoice.total.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div>
              <EnhancedFileUploadManager
                title="Invoice Files"
                description="Upload invoice files (PDF, image, or document). Required for AS funding requests. Max size: 10MB per file."
                existingFiles={invoice.existingInvoiceFiles || []}
                newFiles={invoice.invoiceFiles || []}
                onFilesChange={(files) => {
                  const fileArray = Array.isArray(files) ? files : (files ? [files] : []);
                  updateInvoice(invoice.id, {
                    invoiceFiles: fileArray,
                    // Update legacy field for backward compatibility
                    invoiceFile: fileArray[0] || null
                  });
                }}
                onRemoveExistingFile={(fileUrl) => {
                  const updatedFiles = (invoice.existingInvoiceFiles || []).filter(url => url !== fileUrl);
                  updateInvoice(invoice.id, {
                    existingInvoiceFiles: updatedFiles,
                    // Update legacy field for backward compatibility
                    existingInvoiceFile: updatedFiles[0] || ''
                  });
                }}
                allowedTypes={['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']}
                maxSizeInMB={10}
                maxFiles={5}
                multiple={true}
                required={false}
                disabled={disabled}
                uploadFunction={onFileUpload}
              />
            </div>
          </div>
        ))}

        {/* Add Invoice Button */}
        <button
          onClick={addInvoice}
          disabled={disabled}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Another Invoice
        </button>
      </div>

      {/* File Preview Modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center">
              <h3 className="text-lg font-semibold">File Preview</h3>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              {selectedFile.toLowerCase().includes('.pdf') ? (
                <iframe
                  src={selectedFile}
                  className="w-full h-96"
                  title="PDF Preview"
                />
              ) : (
                <img
                  src={selectedFile}
                  alt="File preview"
                  className="max-w-full h-auto"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
