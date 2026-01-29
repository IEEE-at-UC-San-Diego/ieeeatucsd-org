import React from 'react';
import { Button, Card, CardBody } from '@heroui/react';
import { Check, Copy } from 'lucide-react';
import EnhancedFileViewer from '../components/EnhancedFileViewer';
import type { Invoice } from './types';

interface InvoiceTabContentProps {
    invoice: Invoice;
    index: number;
    requestId: string;
    copiedInvoice: boolean;
    onCopyInvoice: (index: number) => void;
    formatInvoiceData: (index: number) => string;
    onPreviewFile: (file: string) => void;
}

export default function InvoiceTabContent({
    invoice,
    index,
    requestId,
    copiedInvoice,
    onCopyInvoice,
    formatInvoiceData,
    onPreviewFile
}: InvoiceTabContentProps) {
    const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    return (
        <Card shadow="sm" className="border border-green-200 bg-green-50 mt-4">
            <CardBody className="space-y-4">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h5 className="text-sm font-semibold text-green-900">Formatted Invoice Data</h5>
                        <Button
                            size="sm"
                            color="success"
                            variant="solid"
                            onPress={() => onCopyInvoice(index)}
                            startContent={copiedInvoice ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        >
                            {copiedInvoice ? 'Copied!' : 'Copy'}
                        </Button>
                    </div>
                    <p className="text-green-800 font-mono text-xs bg-white p-3 rounded border break-words">
                        {formatInvoiceData(index)}
                    </p>
                </div>

                <div>
                    <h6 className="text-sm font-semibold text-gray-900 mb-2">Items</h6>
                    <div className="space-y-2">
                        {invoice.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="flex justify-between items-center bg-white p-2 rounded border border-green-100">
                                <div className="flex-1">
                                    <span className="text-sm text-gray-900">{item.quantity}x {item.description}</span>
                                </div>
                                <div className="text-sm text-gray-600">
                                    ${item.unitPrice.toFixed(2)} each
                                </div>
                                <div className="text-sm font-semibold text-gray-900 ml-4">
                                    ${(item.quantity * item.unitPrice).toFixed(2)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="border-t border-green-200 pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="text-gray-900 font-medium">
                            ${subtotal.toFixed(2)}
                        </span>
                    </div>
                    {invoice.tax > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tax:</span>
                            <span className="text-gray-900 font-medium">${invoice.tax.toFixed(2)}</span>
                        </div>
                    )}
                    {invoice.tip > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Tip:</span>
                            <span className="text-gray-900 font-medium">${invoice.tip.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-base font-semibold border-t border-green-200 pt-2">
                        <span className="text-gray-900">Total:</span>
                        <span className="text-green-700">${invoice.total.toFixed(2)}</span>
                    </div>
                </div>

                {invoice.invoiceFile && (
                    <div>
                        <h6 className="text-sm font-semibold text-gray-900 mb-2">Invoice File</h6>
                        <EnhancedFileViewer
                            url={invoice.invoiceFile}
                            filename={`Invoice - ${invoice.vendor}`}
                            eventRequestId={requestId}
                            onPreview={onPreviewFile}
                        />
                    </div>
                )}
            </CardBody>
        </Card>
    );
}
