import React from 'react';
import { Megaphone, Image, Upload } from 'lucide-react';
import type { EventFormData } from '../types/EventRequestTypes';
import { flyerTypes, logoTypes, formatTypes } from '../types/EventRequestTypes';
import EnhancedFileUploadManager from './EnhancedFileUploadManager';

interface MarketingSectionProps {
    formData: EventFormData;
    onInputChange: (field: string, value: any) => void;
    onArrayChange: (field: string, value: string, checked: boolean) => void;
    onFileChange: (field: string, files: FileList | null) => void;
    onRemoveExistingFile?: (fileUrl: string, fileType: 'roomBooking' | 'invoice' | 'invoiceFiles' | 'otherLogos') => void;
    eventRequestId?: string;
}

export default function MarketingSection({
    formData,
    onInputChange,
    onArrayChange,
    onFileChange,
    onRemoveExistingFile,
    eventRequestId
}: MarketingSectionProps) {
    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-3">
                <Megaphone className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Marketing & Graphics</h3>
            </div>

            {/* Graphics Needed */}
            <div className="bg-gray-50 p-4 rounded-lg">
                <label className="flex items-center space-x-3">
                    <input
                        type="checkbox"
                        checked={formData.needsGraphics}
                        onChange={(e) => onInputChange('needsGraphics', e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                        I need graphics/marketing materials for this event
                    </span>
                </label>
            </div>

            {formData.needsGraphics && (
                <div className="space-y-6 border-l-4 border-blue-200 pl-6">
                    {/* Flyer Types */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            What type of flyers/graphics do you need? *
                        </label>
                        <div className="space-y-2">
                            {flyerTypes.map(type => (
                                <label key={type} className="flex items-start space-x-3">
                                    <input
                                        type="checkbox"
                                        checked={formData.flyerType.includes(type)}
                                        onChange={(e) => onArrayChange('flyerType', type, e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
                                    />
                                    <span className="text-sm text-gray-700">{type}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Other Flyer Type */}
                    {formData.flyerType.includes('Other (please specify in additional requests)') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Please specify the other flyer type *
                            </label>
                            <input
                                type="text"
                                value={formData.otherFlyerType}
                                onChange={(e) => onInputChange('otherFlyerType', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Specify other flyer type"
                            />
                        </div>
                    )}

                    {/* Required Logos */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Which logos are required on your graphics? *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {logoTypes.map(logo => (
                                <label key={logo} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.requiredLogos.includes(logo)}
                                        onChange={(e) => onArrayChange('requiredLogos', logo, e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">{logo}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Other Logo Files */}
                    {formData.requiredLogos.includes('OTHER (please upload transparent logo files)') && (
                        <div>
                            <EnhancedFileUploadManager
                                title="Other Logo Files"
                                description="Please upload transparent PNG files for best quality. Max size: 10MB each"
                                existingFiles={formData.existingOtherLogos || []}
                                newFiles={formData.otherLogoFiles || []}
                                onFilesChange={(files) => {
                                    // Convert File[] to FileList-like object
                                    if (Array.isArray(files)) {
                                        const fileList = {
                                            item: (index: number) => files[index] || null,
                                            ...files
                                        } as FileList;
                                        onFileChange('otherLogoFiles', fileList);
                                    } else {
                                        onFileChange('otherLogoFiles', null);
                                    }
                                }}
                                onRemoveExistingFile={(fileUrl) => onRemoveExistingFile?.(fileUrl, 'otherLogos')}
                                allowedTypes={['png', 'jpg', 'jpeg', 'svg', 'gif']}
                                maxSizeInMB={10}
                                maxFiles={5}
                                multiple={true}
                                required={true}
                                eventRequestId={eventRequestId}
                            />
                        </div>
                    )}

                    {/* Advertising Format */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Preferred file format for final graphics *
                        </label>
                        <select
                            value={formData.advertisingFormat}
                            onChange={(e) => onInputChange('advertisingFormat', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Select format</option>
                            {formatTypes.map(format => (
                                <option key={format} value={format}>{format}</option>
                            ))}
                        </select>
                    </div>

                    {/* Advertising Start Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            When should advertising start? *
                        </label>
                        <input
                            type="datetime-local"
                            value={formData.flyerAdvertisingStartDate}
                            onChange={(e) => onInputChange('flyerAdvertisingStartDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            This helps us plan the marketing timeline for your event
                        </p>
                    </div>

                    {/* Additional Specifications */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Additional specifications or requests
                        </label>
                        <textarea
                            value={formData.additionalSpecifications}
                            onChange={(e) => onInputChange('additionalSpecifications', e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Any specific design requirements, colors, themes, or other details..."
                        />
                    </div>

                    {/* Photography Needed */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <label className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                checked={formData.photographyNeeded}
                                onChange={(e) => onInputChange('photographyNeeded', e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">
                                I need photography coverage for this event
                            </span>
                        </label>
                        <p className="text-xs text-gray-500 mt-2 ml-7">
                            Check this if you want professional photos taken during your event
                        </p>
                    </div>
                </div>
            )}

            {!formData.needsGraphics && (
                <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">
                        <Image className="w-4 h-4 inline mr-2" />
                        No graphics or marketing materials needed for this event.
                    </p>
                </div>
            )}
        </div>
    );
}
