import React, { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Tabs, Tab } from '@heroui/react';
import { Check, Copy, DollarSign, FileText, Lock } from 'lucide-react';
import EnhancedFileViewer from '../components/EnhancedFileViewer';
import { getFilenameFromUrl } from './utils';
import InvoiceTabContent from './InvoiceTabContent';
import type { EventRequest } from './types';

interface FundingInvoicesTabProps {
    request: EventRequest;
    eventFiles: string[];
    privateFiles: string[];
    loadingEventFiles: boolean;
    copiedInvoice: boolean;
    onCopyInvoice: (invoiceIndex?: number) => void;
    formatInvoiceData: (invoiceIndex?: number) => string;
    onPreviewFile: (file: string) => void;
}

export default function FundingInvoicesTab({
    request,
    eventFiles,
    privateFiles,
    loadingEventFiles,
    copiedInvoice,
    onCopyInvoice,
    formatInvoiceData,
    onPreviewFile
}: FundingInvoicesTabProps) {
    const [selectedInvoiceTab, setSelectedInvoiceTab] = useState('0');
    const hasMultipleInvoices = Boolean(request.invoices && request.invoices.length > 0);
    const hasLegacyInvoices = (!request.invoices || request.invoices.length === 0) && Boolean(request.invoiceFiles && request.invoiceFiles.length > 0);
    const hasRoomBooking = Boolean(request.roomBookingFiles && request.roomBookingFiles.length > 0);
    const hasPrivateFiles =
        (request.invoiceFiles && request.invoiceFiles.length > 0) ||
        Boolean(request.invoice) ||
        hasRoomBooking ||
        privateFiles.length > 0;

    return (
        <div className="space-y-6">
            {(request.asFundingRequired || request.needsAsFunding || hasMultipleInvoices || (request.itemizedInvoice?.length || 0) > 0 || request.invoice || hasLegacyInvoices) && (
                <Card shadow="sm" className="border border-gray-200">
                    <CardHeader className="flex gap-2 pb-3">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Funding &amp; Invoice Information</h3>
                    </CardHeader>
                    <CardBody className="space-y-4 pt-0">
                        {hasMultipleInvoices ? (
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-green-600" />
                                    Invoice Details ({request.invoices?.length} invoice{request.invoices && request.invoices.length !== 1 ? 's' : ''})
                                </h4>
                                <Tabs
                                    selectedKey={selectedInvoiceTab}
                                    onSelectionChange={(key) => setSelectedInvoiceTab(key as string)}
                                    aria-label="Invoice tabs"
                                    color="success"
                                    variant="underlined"
                                >
                                    {(request.invoices || []).map((invoice, index) => (
                                        <Tab
                                            key={index.toString()}
                                            title={
                                                <div className="flex items-center gap-2">
                                                    <DollarSign className="w-4 h-4" />
                                                    <span>{invoice.vendor}</span>
                                                </div>
                                            }
                                        >
                                            <InvoiceTabContent
                                                invoice={invoice}
                                                index={index}
                                                requestId={request.id}
                                                copiedInvoice={copiedInvoice}
                                                onCopyInvoice={onCopyInvoice}
                                                formatInvoiceData={(invoiceIndex) => formatInvoiceData(invoiceIndex)}
                                                onPreviewFile={onPreviewFile}
                                            />
                                        </Tab>
                                    ))}
                                </Tabs>
                            </div>
                        ) : (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-green-900">Formatted Invoice Data (Copyable)</h4>
                                    <Button
                                        size="sm"
                                        color="success"
                                        variant="solid"
                                        onPress={() => onCopyInvoice()}
                                        startContent={copiedInvoice ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    >
                                        {copiedInvoice ? 'Copied!' : 'Copy'}
                                    </Button>
                                </div>
                                <p className="text-green-800 font-mono text-xs bg-white p-3 rounded border break-words">
                                    {formatInvoiceData()}
                                </p>
                            </div>
                        )}

                        {hasLegacyInvoices && (
                            <div>
                                <h4 className="font-medium text-gray-900 mb-3">Invoice Files (Legacy)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(request.invoiceFiles || []).map((file, index) => (
                                        <EnhancedFileViewer
                                            key={index}
                                            url={file}
                                            filename={`Invoice ${index + 1}`}
                                            eventRequestId={request.id}
                                            onPreview={onPreviewFile}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardBody>
                </Card>
            )}

            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                    Public Event Files
                </h3>
                {loadingEventFiles ? (
                    <div className="text-center py-4">
                        <p className="text-gray-500">Loading event files...</p>
                    </div>
                ) : eventFiles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {eventFiles.map((file, index) => (
                            <EnhancedFileViewer
                                key={index}
                                url={file}
                                filename={file.split('/').pop()?.split('_').slice(1).join('_') || `Event File ${index + 1}`}
                                eventRequestId={request.id}
                                onPreview={onPreviewFile}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-gray-500">No public event files available</p>
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Lock className="w-5 h-5 mr-2 text-red-600" />
                    Private Event Files
                </h3>
                {loadingEventFiles ? (
                    <div className="text-center py-4">
                        <p className="text-gray-500">Loading private files...</p>
                    </div>
                ) : hasPrivateFiles ? (
                    <div className="space-y-4">
                        {request.invoiceFiles && request.invoiceFiles.length > 0 && (
                            <div>
                                <h4 className="font-medium text-gray-900 mb-2">Invoice Files</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {request.invoiceFiles.map((file, index) => (
                                        <EnhancedFileViewer
                                            key={`invoice-${index}`}
                                            url={file}
                                            filename={`Invoice ${index + 1}`}
                                            eventRequestId={request.id}
                                            onPreview={onPreviewFile}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {request.invoice && (
                            <div>
                                <h4 className="font-medium text-gray-900 mb-2">Main Invoice</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <EnhancedFileViewer
                                        url={request.invoice}
                                        filename={getFilenameFromUrl(request.invoice, 'Main Invoice File')}
                                        eventRequestId={request.id}
                                        onPreview={onPreviewFile}
                                    />
                                </div>
                            </div>
                        )}

                        {hasRoomBooking && (
                            <div>
                                <h4 className="font-medium text-gray-900 mb-2">Room Booking Files</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {(request.roomBookingFiles || []).map((file, index) => (
                                        <EnhancedFileViewer
                                            key={`room-${index}`}
                                            url={file}
                                            filename={`Room Booking ${index + 1}`}
                                            eventRequestId={request.id}
                                            onPreview={onPreviewFile}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {privateFiles.length > 0 && (
                            <div>
                                <h4 className="font-medium text-gray-900 mb-2">Other Private Files</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {privateFiles.map((file, index) => (
                                        <EnhancedFileViewer
                                            key={`private-${index}`}
                                            url={file}
                                            filename={`Private File ${index + 1}`}
                                            eventRequestId={request.id}
                                            onPreview={onPreviewFile}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-gray-500">No private event files available</p>
                    </div>
                )}
            </div>
        </div>
    );
}
