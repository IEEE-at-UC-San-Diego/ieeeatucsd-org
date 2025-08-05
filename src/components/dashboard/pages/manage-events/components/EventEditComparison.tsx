import React from 'react';
import { ArrowRight, Calendar, MapPin, Users, DollarSign, FileText, AlertCircle } from 'lucide-react';
import { truncateFilename } from '../utils/filenameUtils';

interface FieldChange {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
  type: 'text' | 'number' | 'boolean' | 'date' | 'array' | 'object';
}

interface EventEditComparisonProps {
  originalData: any;
  newData: any;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function EventEditComparison({
  originalData,
  newData,
  onConfirm,
  onCancel,
  isSubmitting = false
}: EventEditComparisonProps) {
  
  const formatValue = (value: any, type: string): string => {
    if (value === null || value === undefined) return 'Not specified';
    
    switch (type) {
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'date':
        try {
          const date = value.toDate ? value.toDate() : new Date(value);
          return date.toLocaleString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        } catch {
          return 'Invalid date';
        }
      case 'array':
        return Array.isArray(value) ? value.join(', ') : String(value);
      case 'object':
        if (typeof value === 'object') {
          return JSON.stringify(value, null, 2);
        }
        return String(value);
      default:
        return String(value);
    }
  };

  const detectChanges = (): FieldChange[] => {
    const changes: FieldChange[] = [];
    
    const fieldMappings = [
      { field: 'name', label: 'Event Name', type: 'text' },
      { field: 'eventDescription', label: 'Description', type: 'text' },
      { field: 'location', label: 'Location', type: 'text' },
      { field: 'department', label: 'Department', type: 'text' },
      { field: 'expectedAttendance', label: 'Expected Attendance', type: 'number' },
      { field: 'startDateTime', label: 'Start Date & Time', type: 'date' },
      { field: 'endDateTime', label: 'End Date & Time', type: 'date' },
      { field: 'needsGraphics', label: 'Graphics Required', type: 'boolean' },
      { field: 'needsAsFunding', label: 'AS Funding Required', type: 'boolean' },
      { field: 'flyersNeeded', label: 'Flyers Needed', type: 'boolean' },
      { field: 'photographyNeeded', label: 'Photography Needed', type: 'boolean' },
      { field: 'hasRoomBooking', label: 'Room Booking', type: 'boolean' },
      { field: 'servingFoodDrinks', label: 'Food & Drinks', type: 'boolean' },
      { field: 'flyerType', label: 'Flyer Types', type: 'array' },
      { field: 'requiredLogos', label: 'Required Logos', type: 'array' },
    ];

    fieldMappings.forEach(({ field, label, type }) => {
      const oldValue = originalData[field];
      const newValue = newData[field];
      
      // Deep comparison for objects and arrays
      const hasChanged = JSON.stringify(oldValue) !== JSON.stringify(newValue);
      
      if (hasChanged) {
        changes.push({
          field,
          label,
          oldValue,
          newValue,
          type: type as any
        });
      }
    });

    return changes;
  };

  const changes = detectChanges();
  const hasChanges = changes.length > 0;

  const getChangeIcon = (field: string) => {
    switch (field) {
      case 'name':
      case 'startDateTime':
      case 'endDateTime':
        return <Calendar className="w-4 h-4" />;
      case 'location':
        return <MapPin className="w-4 h-4" />;
      case 'expectedAttendance':
        return <Users className="w-4 h-4" />;
      case 'needsAsFunding':
        return <DollarSign className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getChangeColor = (field: string) => {
    const criticalFields = ['name', 'startDateTime', 'endDateTime', 'location'];
    return criticalFields.includes(field) ? 'text-red-600' : 'text-blue-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 z-20">
          <h2 className="text-2xl font-bold text-gray-900">Review Event Changes</h2>
          <p className="text-sm text-gray-600 mt-1">
            {hasChanges 
              ? `${changes.length} change${changes.length !== 1 ? 's' : ''} detected`
              : 'No changes detected'
            }
          </p>
        </div>

        <div className="p-6">
          {!hasChanges ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Changes Detected</h3>
              <p className="text-gray-600">
                The event data appears to be identical to the original. No updates will be made.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Change Summary</h3>
                <p className="text-blue-700">
                  The following {changes.length} field{changes.length !== 1 ? 's' : ''} will be updated:
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {changes.map((change, index) => (
                    <span 
                      key={index}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 ${getChangeColor(change.field)}`}
                    >
                      {getChangeIcon(change.field)}
                      <span className="ml-1">{change.label}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Detailed Changes */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Detailed Changes</h3>
                {changes.map((change, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center space-x-2">
                        {getChangeIcon(change.field)}
                        <h4 className="font-medium text-gray-900">{change.label}</h4>
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Original Value */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                            <span className="text-sm font-medium text-red-700">Original</span>
                          </div>
                          <div className="bg-red-50 border border-red-200 rounded p-3">
                            <pre className="text-sm text-red-800 whitespace-pre-wrap break-words">
                              {formatValue(change.oldValue, change.type)}
                            </pre>
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="hidden md:flex items-center justify-center">
                          <ArrowRight className="w-6 h-6 text-gray-400" />
                        </div>
                        <div className="md:hidden flex items-center justify-center py-2">
                          <ArrowRight className="w-5 h-5 text-gray-400 rotate-90" />
                        </div>

                        {/* New Value */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-medium text-green-700">Updated</span>
                          </div>
                          <div className="bg-green-50 border border-green-200 rounded p-3">
                            <pre className="text-sm text-green-800 whitespace-pre-wrap break-words">
                              {formatValue(change.newValue, change.type)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Critical Changes Warning */}
              {changes.some(change => ['name', 'startDateTime', 'endDateTime', 'location'].includes(change.field)) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-amber-800 font-medium">Critical Changes Detected</h4>
                      <p className="text-amber-700 text-sm mt-1">
                        You are modifying critical event information (name, date/time, or location). 
                        These changes may require additional notifications to attendees and stakeholders.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-6 border-t mt-6">
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel Changes
            </button>
            <button
              onClick={onConfirm}
              disabled={isSubmitting || !hasChanges}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving Changes...
                </>
              ) : (
                `Confirm ${changes.length} Change${changes.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
