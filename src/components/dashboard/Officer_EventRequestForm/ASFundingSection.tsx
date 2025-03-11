import React, { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import type { EventRequestFormData } from './EventRequestForm';
import InvoiceBuilder from './InvoiceBuilder';
import type { InvoiceData } from './InvoiceBuilder';
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

interface ASFundingSectionProps {
    formData: EventRequestFormData;
    onDataChange: (data: Partial<EventRequestFormData>) => void;
}

const ASFundingSection: React.FC<ASFundingSectionProps> = ({ formData, onDataChange }) => {
    const [invoiceFile, setInvoiceFile] = useState<File | null>(formData.invoice);
    const [invoiceFiles, setInvoiceFiles] = useState<File[]>(formData.invoice_files || []);
    const [useJsonInput, setUseJsonInput] = useState(false);
    const [jsonInput, setJsonInput] = useState('');
    const [jsonError, setJsonError] = useState('');
    const [showExample, setShowExample] = useState(false);

    // Example JSON for the user to reference
    const jsonExample = {
        items: [
            {
                item: "Chicken Plate",
                quantity: 10,
                unit_price: 12.99
            },
            {
                item: "Vegetarian Plate",
                quantity: 5,
                unit_price: 11.99
            },
            {
                item: "Bottled Water",
                quantity: 15,
                unit_price: 1.50
            }
        ],
        tax: 10.14,
        tip: 15.00,
        vendor: "L&L Hawaiian BBQ"
    };

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

    // Handle JSON input change
    const handleJsonInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setJsonInput(value);

        // Validate JSON as user types
        if (value.trim()) {
            try {
                JSON.parse(value);
                setJsonError('');
            } catch (err) {
                setJsonError('Invalid JSON format. Please check your syntax.');
            }
        } else {
            setJsonError('');
        }
    };

    // Show JSON example
    const showJsonExample = () => {
        // Toggle example visibility
        setShowExample(!showExample);

        // If showing example, populate the textarea with the example JSON
        if (!showExample) {
            setJsonInput(JSON.stringify(jsonExample, null, 2));
        }
    };

    // Validate and apply JSON
    const validateAndApplyJson = () => {
        try {
            // Parse the JSON input
            const parsedJson = JSON.parse(jsonInput);

            // Validate the structure
            let validationError = '';

            // Check for required fields
            if (!parsedJson.items || !Array.isArray(parsedJson.items)) {
                validationError = 'Missing or invalid "items" array.';
            } else if (parsedJson.items.length === 0) {
                validationError = 'The "items" array cannot be empty.';
            } else {
                // Check each item in the array
                for (let i = 0; i < parsedJson.items.length; i++) {
                    const item = parsedJson.items[i];
                    if (!item.item || typeof item.item !== 'string') {
                        validationError = `Item #${i + 1} is missing a valid "item" name.`;
                        break;
                    }
                    if (typeof item.quantity !== 'number' || item.quantity <= 0) {
                        validationError = `Item #${i + 1} is missing a valid "quantity" (must be a positive number).`;
                        break;
                    }
                    if (typeof item.unit_price !== 'number' || item.unit_price < 0) {
                        validationError = `Item #${i + 1} is missing a valid "unit_price" (must be a non-negative number).`;
                        break;
                    }
                }
            }

            // Check other required fields
            if (!validationError) {
                if (typeof parsedJson.tax !== 'number') {
                    validationError = 'Missing or invalid "tax" amount (must be a number).';
                } else if (typeof parsedJson.tip !== 'number') {
                    validationError = 'Missing or invalid "tip" amount (must be a number).';
                } else if (!parsedJson.vendor || typeof parsedJson.vendor !== 'string') {
                    validationError = 'Missing or invalid "vendor" name.';
                }
            }

            if (validationError) {
                setJsonError(validationError);
                return;
            }

            // Calculate subtotal and total
            const subtotal = parsedJson.items.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
            const total = subtotal + parsedJson.tax + parsedJson.tip;

            // Convert the JSON to the format expected by InvoiceData
            const invoiceData: InvoiceData = {
                items: parsedJson.items.map((item: any, index: number) => ({
                    id: `item-${index + 1}`,
                    description: item.item,
                    quantity: item.quantity,
                    unitPrice: item.unit_price,
                    amount: item.quantity * item.unit_price
                })),
                subtotal: subtotal,
                taxRate: subtotal ? (parsedJson.tax / subtotal) * 100 : 0,
                taxAmount: parsedJson.tax,
                tipPercentage: subtotal ? (parsedJson.tip / subtotal) * 100 : 0,
                tipAmount: parsedJson.tip,
                total: total,
                vendor: parsedJson.vendor
            };

            // Update the form data
            handleInvoiceDataChange(invoiceData);

            // Update the itemized_invoice field with the complete JSON including calculated total
            const completeJson = {
                ...parsedJson,
                subtotal: subtotal,
                total: total
            };
            onDataChange({ itemized_invoice: JSON.stringify(completeJson, null, 2) });

            // Show success message
            toast.success('JSON invoice data applied successfully!');

            // Optionally, switch back to the invoice builder view to show the applied data
            setUseJsonInput(false);
        } catch (err) {
            setJsonError('Failed to parse JSON. Please check your syntax.');
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4 text-primary">AS Funding Information</h2>

            <CustomAlert
                type="warning"
                title="Important Information"
                message="Please make sure the restaurant is a valid AS Funding food vendor! An invoice can be an unofficial receipt. Just make sure that the restaurant name and location, desired pickup or delivery date and time, all the items ordered plus their prices, discount/fees/tax/tip, and total are on the invoice! We don't recommend paying out of pocket because reimbursements can be a hassle when you're not a Principal Member."
                className="mb-6"
                icon="heroicons:exclamation-triangle"
            />

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
            </motion.div>

            {/* JSON Invoice Paste Option */}
            <motion.div variants={itemVariants} className="bg-base-300/50 p-4 rounded-lg mb-6">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-lg">Paste JSON Invoice</h3>
                    <div className="form-control">
                        <label className="label cursor-pointer">
                            <span className="label-text mr-2">Use JSON input</span>
                            <input
                                type="checkbox"
                                className="toggle toggle-primary"
                                checked={useJsonInput}
                                onChange={(e) => setUseJsonInput(e.target.checked)}
                            />
                        </label>
                    </div>
                </div>

                {useJsonInput && (
                    <>
                        <div className="form-control mb-4">
                            <label className="label">
                                <span className="label-text font-medium">Paste your JSON invoice data</span>
                                <span className="label-text-alt">
                                    <div className="tooltip tooltip-left" data-tip={jsonInput.trim().length > 0 ? "Clear the text field to see an example" : ""}>
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-ghost"
                                            onClick={showJsonExample}
                                            disabled={jsonInput.trim().length > 0}
                                        >
                                            See example
                                        </button>
                                    </div>
                                </span>
                            </label>
                            <textarea
                                className={`textarea textarea-bordered h-48 font-mono text-sm ${jsonError ? 'textarea-error' : ''}`}
                                value={jsonInput}
                                onChange={handleJsonInputChange}
                                placeholder="paste json here"
                            ></textarea>
                            {jsonError && (
                                <label className="label">
                                    <span className="label-text-alt text-error">{jsonError}</span>
                                </label>
                            )}
                        </div>

                        <div className="flex justify-end mb-4">
                            <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={validateAndApplyJson}
                                disabled={!!jsonError}
                            >
                                Apply JSON
                            </button>
                        </div>

                        <CustomAlert
                            type="info"
                            title="Required JSON Format"
                            message={`Your JSON must include: an array of items (each with item name, quantity, and unit_price), tax amount, tip amount, and vendor name. The total will be calculated automatically.`}
                            className="mb-4"
                            icon="heroicons:information-circle"
                        />
                    </>
                )}
            </motion.div>

            {/* Invoice Builder */}
            {!useJsonInput && (
                <InvoiceBuilder
                    invoiceData={formData.invoiceData}
                    onChange={handleInvoiceDataChange}
                />
            )}

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

            <CustomAlert
                type="warning"
                title="Important Note"
                message="AS Funding requests must be submitted at least 6 weeks before your event. Please check the Funding Guide or the Google Calendar for the funding request deadlines."
                className="mb-4"
                icon="heroicons:clock"
            />
        </div>
    );
};

export default ASFundingSection; 