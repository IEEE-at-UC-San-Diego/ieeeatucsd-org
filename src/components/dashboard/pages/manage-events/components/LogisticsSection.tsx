import React from 'react';
import { MapPin, Users, Upload, DollarSign, AlertTriangle, FileText, Image } from 'lucide-react';
import type { EventFormData } from '../types/EventRequestTypes';
import { calculateBudget, extractFileName } from '../utils/eventRequestUtils';

interface LogisticsSectionProps {
    formData: EventFormData;
    onInputChange: (field: string, value: any) => void;
    onRemoveExistingFile: (fileUrl: string, fileType: 'roomBooking' | 'invoice' | 'invoiceFiles' | 'otherLogos') => void;
}

export default function LogisticsSection({
    formData,
    onInputChange,
    onRemoveExistingFile
}: LogisticsSectionProps) {
    const attendance = parseInt(formData.expectedAttendance) || 0;
    const budget = calculateBudget(attendance);

    const getFileIcon = (filename: string) => {
        const ext = filename.toLowerCase().split('.').pop();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
            return <Image className="w-5 h-5 text-blue-500" />;
        }
        return <FileText className="w-5 h-5 text-gray-500" />;
    };

    const renderExistingFiles = (files: string[], title: string, fileType: 'roomBooking' | 'invoice' | 'invoiceFiles' | 'otherLogos') => {
        if (!files || files.length === 0) return null;

        return (
            <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">{title}:</p>
                <div className="space-y-2">
                    {files.map((fileUrl, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <div className="flex items-center space-x-2">
                                {getFileIcon(fileUrl)}
                                <span className="text-sm text-gray-700">{extractFileName(fileUrl)}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                    View
                                </a>
                                <button
                                    type="button"
                                    onClick={() => onRemoveExistingFile(fileUrl, fileType)}
                                    className="text-red-600 hover:text-red-800 text-sm"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-3">
                <MapPin className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Event Logistics</h3>
            </div>

            {/* Room Booking */}
            <div className="bg-gray-50 p-4 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                    Do you have a room booking for this event? *
                </label>
                <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                        <input
                            type="radio"
                            name="hasRoomBooking"
                            checked={formData.hasRoomBooking === true}
                            onChange={() => onInputChange('hasRoomBooking', true)}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Yes, I have a room booking</span>
                    </label>
                    <label className="flex items-center space-x-2">
                        <input
                            type="radio"
                            name="hasRoomBooking"
                            checked={formData.hasRoomBooking === false}
                            onChange={() => onInputChange('hasRoomBooking', false)}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">No, I need help with room booking</span>
                    </label>
                </div>

                {formData.hasRoomBooking && (
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Upload className="w-4 h-4 inline mr-2" />
                            Upload Room Booking Confirmation *
                        </label>
                        <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                            onChange={(e) => onInputChange('roomBookingFile', e.target.files?.[0] || null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Please upload your room booking confirmation (PDF, image, or document). Max size: 1MB
                        </p>

                        {renderExistingFiles(formData.existingRoomBookingFiles, 'Current room booking files', 'roomBooking')}
                    </div>
                )}
            </div>

            {/* Expected Attendance */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Users className="w-4 h-4 inline mr-2" />
                    Expected Attendance *
                </label>
                <input
                    type="number"
                    min="1"
                    value={formData.expectedAttendance}
                    onChange={(e) => onInputChange('expectedAttendance', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter expected number of attendees"
                />

                {attendance > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <h4 className="text-sm font-medium text-blue-900 mb-2">
                            <DollarSign className="w-4 h-4 inline mr-1" />
                            Budget Calculation
                        </h4>
                        <div className="text-sm text-blue-800 space-y-1">
                            <p>Expected Attendance: {attendance} people</p>
                            <p>Cost per person: ${budget.perPersonCost}</p>
                            <p>Calculated Budget: ${budget.calculatedBudget}</p>
                            <p className="font-medium">
                                Recommended Budget: ${budget.actualBudget}
                                {budget.isAtMax && (
                                    <span className="text-orange-600 ml-2">
                                        (Maximum budget reached)
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Food and Drinks */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Will you be serving food or drinks at this event? *
                        </label>
                        <div className="space-y-2">
                            <label className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    name="servingFoodDrinks"
                                    checked={formData.servingFoodDrinks === true}
                                    onChange={() => onInputChange('servingFoodDrinks', true)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">Yes, we will serve food or drinks</span>
                            </label>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    name="servingFoodDrinks"
                                    checked={formData.servingFoodDrinks === false}
                                    onChange={() => onInputChange('servingFoodDrinks', false)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">No food or drinks will be served</span>
                            </label>
                        </div>
                        <p className="text-xs text-yellow-700 mt-2">
                            Important: If serving food/drinks, you may need AS funding and must follow university guidelines
                        </p>
                    </div>
                </div>
            </div>

            {/* AS Funding */}
            {formData.servingFoodDrinks && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Do you need AS (Associated Students) funding for this event? *
                    </label>
                    <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                            <input
                                type="radio"
                                name="needsAsFunding"
                                checked={formData.needsAsFunding === true}
                                onChange={() => onInputChange('needsAsFunding', true)}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Yes, I need AS funding</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input
                                type="radio"
                                name="needsAsFunding"
                                checked={formData.needsAsFunding === false}
                                onChange={() => onInputChange('needsAsFunding', false)}
                                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">No, I have other funding sources</span>
                        </label>
                    </div>
                    <p className="text-xs text-green-700 mt-2">
                        AS funding requires detailed invoices and receipts. You'll need to provide this information in the next step.
                    </p>
                </div>
            )}
        </div>
    );
}
