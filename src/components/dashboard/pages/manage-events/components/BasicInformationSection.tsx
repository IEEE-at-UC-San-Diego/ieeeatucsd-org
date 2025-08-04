import React from 'react';
import { Calendar, MapPin, FileText, DollarSign } from 'lucide-react';
import type { EventFormData, FieldError } from '../types/EventRequestTypes';
import { departmentOptions, eventTypes } from '../types/EventRequestTypes';
import { generateEventCode, formatTimeTo12H } from '../utils/eventRequestUtils';

interface BasicInformationSectionProps {
    formData: EventFormData;
    fieldErrors: FieldError;
    onInputChange: (field: string, value: any) => void;
}

export default function BasicInformationSection({
    formData,
    fieldErrors,
    onInputChange
}: BasicInformationSectionProps) {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
                {/* Event Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FileText className="w-4 h-4 inline mr-2" />
                        Event Name *
                    </label>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => onInputChange('name', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldErrors.name ? 'border-red-500' : 'border-gray-300'
                            }`}
                        placeholder="Enter event name"
                    />
                </div>

                {/* Location */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <MapPin className="w-4 h-4 inline mr-2" />
                        Location *
                    </label>
                    <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => onInputChange('location', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldErrors.location ? 'border-red-500' : 'border-gray-300'
                            }`}
                        placeholder="Enter event location"
                    />
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Calendar className="w-4 h-4 inline mr-2" />
                            Date *
                        </label>
                        <input
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => onInputChange('startDate', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldErrors.startDate ? 'border-red-500' : 'border-gray-300'
                                }`}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Start Time *
                        </label>
                        <input
                            type="time"
                            value={formData.startTime}
                            onChange={(e) => onInputChange('startTime', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldErrors.startTime ? 'border-red-500' : 'border-gray-300'
                                }`}
                        />
                        {formData.startTime && (
                            <p className="text-xs text-gray-500 mt-1">
                                {formatTimeTo12H(formData.startTime)}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            End Time *
                        </label>
                        <input
                            type="time"
                            value={formData.endTime}
                            onChange={(e) => onInputChange('endTime', e.target.value)}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldErrors.endTime ? 'border-red-500' : 'border-gray-300'
                                }`}
                        />
                        {formData.endTime && (
                            <p className="text-xs text-gray-500 mt-1">
                                {formatTimeTo12H(formData.endTime)}
                            </p>
                        )}
                    </div>
                </div>

                {/* Event Description */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Description *
                    </label>
                    <textarea
                        value={formData.eventDescription}
                        onChange={(e) => onInputChange('eventDescription', e.target.value)}
                        rows={4}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${fieldErrors.eventDescription ? 'border-red-500' : 'border-gray-300'
                            }`}
                        placeholder="Describe your event in detail"
                    />
                </div>

                {/* Department */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Department
                    </label>
                    <select
                        value={formData.department}
                        onChange={(e) => onInputChange('department', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {departmentOptions.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                </div>

                {/* Event Code */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Code
                    </label>
                    <div className="flex space-x-2">
                        <input
                            type="text"
                            value={formData.eventCode}
                            onChange={(e) => onInputChange('eventCode', e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter or generate event code"
                        />
                        <button
                            type="button"
                            onClick={() => onInputChange('eventCode', generateEventCode())}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Generate
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        This code will be used for event check-ins and point tracking
                    </p>
                </div>

                {/* Points to Reward */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <DollarSign className="w-4 h-4 inline mr-2" />
                        Points to Reward
                    </label>
                    <input
                        type="number"
                        min="0"
                        value={formData.pointsToReward}
                        onChange={(e) => onInputChange('pointsToReward', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter points to reward attendees"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Points that will be awarded to attendees for participating in this event
                    </p>
                </div>
            </div>
        </div>
    );
}
