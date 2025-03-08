import React, { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import type { EventRequestFormData } from './EventRequestForm';
import InvoiceBuilder from './InvoiceBuilder';
import type { InvoiceData } from './InvoiceBuilder';

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

interface ASFundingSectionProps {
    formData: EventRequestFormData;
    onDataChange: (data: Partial<EventRequestFormData>) => void;
}

const ASFundingSection: React.FC<ASFundingSectionProps> = ({ formData, onDataChange }) => {
    const [invoiceFile, setInvoiceFile] = useState<File | null>(formData.invoice);
    const [invoiceFiles, setInvoiceFiles] = useState<File[]>(formData.invoice_files || []);

    // Handle single invoice file upload (for backward compatibility)
    const handleInvoiceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setInvoiceFile(file);
            onDataChange({ invoice: file });
        }
    };

    // Handle multiple invoice files upload
    const handleMultipleInvoiceFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files) as File[];

            // Check file sizes
            const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit per file
            const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);

            if (oversizedFiles.length > 0) {
                toast.error(`Some files exceed the 10MB size limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
                return;
            }

            // Update state with new files
            const updatedFiles = [...invoiceFiles, ...files];
            setInvoiceFiles(updatedFiles);
            onDataChange({ invoice_files: updatedFiles });

            // Also set the first file as the main invoice file for backward compatibility
            if (files.length > 0 && !formData.invoice) {
                setInvoiceFile(files[0]);
                onDataChange({ invoice: files[0] });
            }

            toast.success(`Added ${files.length} file${files.length > 1 ? 's' : ''} successfully`);
        }
    };

    // Remove an invoice file
    const handleRemoveInvoiceFile = (index: number) => {
        const updatedFiles = [...invoiceFiles];
        const removedFileName = updatedFiles[index].name;
        updatedFiles.splice(index, 1);
        setInvoiceFiles(updatedFiles);
        onDataChange({ invoice_files: updatedFiles });

        // Update the main invoice file if needed
        if (invoiceFile && invoiceFile.name === removedFileName) {
            const newMainFile = updatedFiles.length > 0 ? updatedFiles[0] : null;
            setInvoiceFile(newMainFile);
            onDataChange({ invoice: newMainFile });
        }

        toast.success(`Removed ${removedFileName}`);
    };

    // Handle invoice data change
    const handleInvoiceDataChange = (invoiceData: InvoiceData) => {
        // Update the invoiceData in the form
        onDataChange({ invoiceData });

        // For backward compatibility, create a properly formatted JSON string
        const jsonFormat = {
            items: invoiceData.items.map(item => ({
                item: item.description,
                quantity: item.quantity,
                unit_price: item.unitPrice
            })),
            tax: invoiceData.taxAmount,
            tip: invoiceData.tipAmount,
            total: invoiceData.total,
            vendor: invoiceData.vendor
        };

        // For backward compatibility, still update the itemized_invoice field
        // but with a more structured format that's easier to parse if needed
        const itemizedText = JSON.stringify(jsonFormat, null, 2);

        // Update the itemized_invoice field for backward compatibility
        onDataChange({ itemized_invoice: itemizedText });
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4 text-primary">AS Funding Information</h2>

            <div className="bg-base-300/50 p-4 rounded-lg mb-6">
                <div className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm">
                        Please make sure the restaurant is a valid AS Funding food vendor! An invoice can be an unofficial receipt. Just make sure that the restaurant name and location, desired pickup or delivery date and time, all the items ordered plus their prices, discount/fees/tax/tip, and total are on the invoice! We don't recommend paying out of pocket because reimbursements can be a hassle when you're not a Principal Member.
                    </p>
                </div>
            </div>

            {/* Invoice Builder Instructions */}
            <motion.div variants={itemVariants} className="bg-base-300/50 p-4 rounded-lg mb-6">
                <h3 className="font-bold text-lg mb-2">How to Use the Invoice Builder</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>Enter the vendor/restaurant name in the field provided.</li>
                    <li>Add each item from your invoice by filling in the description, quantity, and unit price, then click "Add Item".</li>
                    <li>The subtotal, tax, and tip will be calculated automatically based on the tax rate and tip percentage.</li>
                    <li>You can adjust the tax rate (default is 7.75% for San Diego) and tip percentage as needed.</li>
                    <li>Remove items by clicking the "X" button next to each item.</li>
                    <li>Upload your actual invoice file (receipt, screenshot, etc.) using the file upload below.</li>
                </ol>
                <p className="text-sm mt-3 text-warning">Note: The invoice builder helps you itemize your expenses for AS funding. You must still upload the actual invoice file.</p>
            </motion.div>

            {/* Invoice Builder */}
            <InvoiceBuilder
                invoiceData={formData.invoiceData}
                onChange={handleInvoiceDataChange}
            />

            {/* Invoice file upload */}
            <motion.div variants={itemVariants} className="form-control">
                <label className="label">
                    <span className="label-text font-medium">
                        Upload your invoice files (receipts, screenshots, etc.)
                    </span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <input
                    type="file"
                    className="file-input file-input-bordered w-full file-input-primary hover:file-input-ghost transition-all duration-300"
                    onChange={handleMultipleInvoiceFilesChange}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    multiple
                    required={invoiceFiles.length === 0}
                />

                {invoiceFiles.length > 0 && (
                    <div className="mt-4">
                        <p className="text-sm font-medium mb-2">Uploaded files:</p>
                        <div className="space-y-2">
                            {invoiceFiles.map((file, index) => (
                                <div key={index} className="flex items-center justify-between bg-base-300/30 p-2 rounded">
                                    <span className="text-sm truncate max-w-[80%]">{file.name}</span>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-xs"
                                        onClick={() => handleRemoveInvoiceFile(index)}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <p className="text-xs text-gray-400 mt-2">
                    Official food invoices will be required 2 weeks before the start of your event. Please use the following naming format: EventName_OrderLocation_DateOfEvent (i.e. QPWorkathon#1_PapaJohns_01/06/2025)
                </p>
            </motion.div>

            <motion.div
                variants={itemVariants}
                className="alert alert-warning"
            >
                <div>
                    <h3 className="font-bold">Important Note</h3>
                    <div className="text-sm">
                        AS Funding requests must be submitted at least 6 weeks before your event. Please check the Funding Guide or the Google Calendar for the funding request deadlines.
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default ASFundingSection; 