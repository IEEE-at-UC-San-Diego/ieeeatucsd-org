import React, { useMemo } from 'react';
import { Card, CardBody, CardHeader, Chip } from '@heroui/react';
import { AlertTriangle, Camera, FileText, Image, Lock, Megaphone } from 'lucide-react';
import EnhancedFileViewer from '../components/EnhancedFileViewer';
import { extractPRRequirements, hasPRRequirements } from '../utils/prRequirementsUtils';
import { formatDate, getFilenameFromUrl } from './utils';
import type { EventRequest } from './types';

interface FilesGraphicsTabProps {
    request: EventRequest;
    eventFiles: string[];
    privateFiles: string[];
    loadingEventFiles: boolean;
    onPreviewFile: (file: string) => void;
}

export default function FilesGraphicsTab({
    request,
    eventFiles,
    privateFiles,
    loadingEventFiles,
    onPreviewFile
}: FilesGraphicsTabProps) {
    const prRequirements = useMemo(() => extractPRRequirements(request), [request]);
    const showPrRequirements = hasPRRequirements(request);
    const hasRoomBooking = Boolean(request.roomBookingFiles && request.roomBookingFiles.length > 0);

    const hasPrivateFiles =
        (request.invoiceFiles && request.invoiceFiles.length > 0) ||
        Boolean(request.invoice) ||
        hasRoomBooking ||
        privateFiles.length > 0;

    return (
        <div className="space-y-6">
            {(request.flyersNeeded || request.photographyNeeded || request.needsGraphics) && (
                <Card shadow="sm" className="border border-gray-200">
                    <CardHeader className="flex gap-2 pb-3">
                        <Megaphone className="w-5 h-5 text-pink-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Graphics &amp; Marketing</h3>
                    </CardHeader>
                    <CardBody className="pt-0">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {request.flyersNeeded && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                        <Image className="w-4 h-4 text-pink-600" />
                                        Flyer Information
                                    </h4>
                                    <div className="space-y-2">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Types</label>
                                            <p className="text-sm text-gray-900 mt-0.5">{request.flyerType?.join(', ') || 'Not specified'}</p>
                                        </div>
                                        {request.otherFlyerType && (
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Other Type</label>
                                                <p className="text-sm text-gray-900 mt-0.5">{request.otherFlyerType}</p>
                                            </div>
                                        )}
                                        {request.flyerAdditionalRequests && (
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Additional Requests</label>
                                                <p className="text-sm text-gray-900 mt-0.5">{request.flyerAdditionalRequests}</p>
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status</label>
                                            <Chip
                                                color={request.flyersCompleted ? 'success' : 'warning'}
                                                variant="flat"
                                                size="sm"
                                                className="mt-0.5"
                                            >
                                                {request.flyersCompleted ? 'Completed' : 'Pending'}
                                            </Chip>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {request.photographyNeeded && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                        <Camera className="w-4 h-4 text-pink-600" />
                                        Photography
                                    </h4>
                                    <div className="space-y-2">
                                        <div>
                                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Required Logos</label>
                                            <p className="text-sm text-gray-900 mt-0.5">{request.requiredLogos?.join(', ') || 'None specified'}</p>
                                        </div>
                                        {request.otherLogos && request.otherLogos.length > 0 && (
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Other Logos</label>
                                                <p className="text-sm text-gray-900 mt-0.5">{request.otherLogos.join(', ')}</p>
                                            </div>
                                        )}
                                        {request.advertisingFormat && (
                                            <div>
                                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Format</label>
                                                <p className="text-sm text-gray-900 mt-0.5">{request.advertisingFormat}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardBody>
                </Card>
            )}

            {request.graphicsFiles && request.graphicsFiles.length > 0 && (
                <Card shadow="sm" className="border border-gray-200">
                    <CardHeader className="flex gap-2 pb-3">
                        <FileText className="w-5 h-5 text-purple-600" />
                        <h3 className="text-lg font-semibold text-gray-900">Graphics Files</h3>
                    </CardHeader>
                    <CardBody className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {request.graphicsFiles.map((file, index) => (
                                <EnhancedFileViewer
                                    key={index}
                                    url={file}
                                    filename={file.split('/').pop()?.split('_').slice(1).join('_') || `Graphics File ${index + 1}`}
                                    eventRequestId={request.id}
                                    onPreview={onPreviewFile}
                                    showPRRequirements={showPrRequirements}
                                    prRequirements={prRequirements}
                                    className="bg-purple-50 border-purple-200"
                                />
                            ))}
                        </div>
                    </CardBody>
                </Card>
            )}

            {!(request.hasRoomBooking ?? request.willOrHaveRoomBooking) && (
                <Card shadow="sm" className="border-l-4 border-l-amber-500 bg-amber-50">
                    <CardBody className="flex flex-row items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-amber-800 font-semibold text-sm">No Room Booking</h4>
                            <p className="text-amber-700 text-sm mt-1">
                                This event does not have room booking arranged. Please ensure venue arrangements are confirmed.
                            </p>
                        </div>
                    </CardBody>
                </Card>
            )}

            {hasRoomBooking && (
                <Card shadow="sm" className="border border-gray-200">
                    <CardHeader className="pb-3">
                        <h3 className="text-lg font-semibold text-gray-900">Room Booking Files</h3>
                    </CardHeader>
                    <CardBody className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(request.roomBookingFiles || []).map((file, index) => (
                                <EnhancedFileViewer
                                    key={index}
                                    url={file}
                                    filename={`Room Booking ${index + 1}`}
                                    eventRequestId={request.id}
                                    onPreview={onPreviewFile}
                                />
                            ))}
                        </div>
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
