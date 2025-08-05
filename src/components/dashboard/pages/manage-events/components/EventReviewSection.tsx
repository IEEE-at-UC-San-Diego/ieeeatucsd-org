import React, { useState } from 'react';
import { AlertTriangle, Calendar, MapPin, Users, DollarSign, FileText, CheckCircle, X } from 'lucide-react';
import { truncateFilename } from '../utils/filenameUtils';

interface EventReviewSectionProps {
  eventData: any;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  showRoomBookingWarning?: boolean;
}

export default function EventReviewSection({
  eventData,
  onConfirm,
  onCancel,
  isSubmitting = false,
  showRoomBookingWarning = true
}: EventReviewSectionProps) {
  const [hasConfirmed, setHasConfirmed] = useState(false);

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return 'Not specified';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const hasRoomBooking = eventData.hasRoomBooking ?? eventData.willOrHaveRoomBooking;
  const hasRoomBookingFiles = eventData.roomBookingFiles && eventData.roomBookingFiles.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-20">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Review Event Submission</h2>
            <p className="text-sm text-gray-600 mt-1">
              Please review all information before final submission
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 p-2"
            disabled={isSubmitting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Room Booking Warning */}
          {showRoomBookingWarning && (!hasRoomBooking || !hasRoomBookingFiles) && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertTriangle className="w-6 h-6 text-amber-600 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-amber-800 font-semibold text-lg mb-2">
                    ⚠️ Room Booking Warning
                  </h3>
                  <p className="text-amber-700 font-medium mb-2">
                    Events without room bookings have a high probability of cancellation. 
                    Please ensure room availability is confirmed.
                  </p>
                  {!hasRoomBooking && (
                    <p className="text-amber-600 text-sm">
                      • No room booking indicated for this event
                    </p>
                  )}
                  {hasRoomBooking && !hasRoomBookingFiles && (
                    <p className="text-amber-600 text-sm">
                      • Room booking indicated but no confirmation files uploaded
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Event Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Event Details
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-blue-800">Name:</span>
                  <p className="text-blue-700">{eventData.name || 'Not specified'}</p>
                </div>
                <div>
                  <span className="font-medium text-blue-800">Description:</span>
                  <p className="text-blue-700">{eventData.eventDescription || 'Not specified'}</p>
                </div>
                <div>
                  <span className="font-medium text-blue-800">Location:</span>
                  <p className="text-blue-700 flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {eventData.location || 'Not specified'}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-blue-800">Department:</span>
                  <p className="text-blue-700">{eventData.department || 'General'}</p>
                </div>
                <div>
                  <span className="font-medium text-blue-800">Expected Attendance:</span>
                  <p className="text-blue-700 flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {eventData.expectedAttendance || 'Not specified'}
                  </p>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Schedule
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-green-800">Start:</span>
                  <p className="text-green-700">{formatDateTime(eventData.startDateTime)}</p>
                </div>
                <div>
                  <span className="font-medium text-green-800">End:</span>
                  <p className="text-green-700">{formatDateTime(eventData.endDateTime)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Requirements & Services */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-purple-900 mb-4">Requirements & Services</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${eventData.needsGraphics ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-purple-700">Graphics Required</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${eventData.needsAsFunding ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-purple-700">AS Funding Required</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${eventData.flyersNeeded ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-purple-700">Flyers Needed</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${eventData.photographyNeeded ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-purple-700">Photography Needed</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${hasRoomBooking && hasRoomBookingFiles ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-purple-700">Room Booking</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${eventData.servingFoodDrinks ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-purple-700">Food & Drinks</span>
              </div>
            </div>
          </div>

          {/* Funding Information */}
          {(eventData.invoices?.length > 0 || eventData.itemizedInvoice?.length > 0) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Funding Information
              </h3>
              {eventData.invoices?.length > 0 ? (
                <div className="space-y-3">
                  {eventData.invoices.map((invoice: any, index: number) => (
                    <div key={index} className="bg-white border border-green-200 rounded p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-green-800">Invoice #{index + 1} - {invoice.vendor}</span>
                        <span className="font-bold text-green-700">${invoice.total.toFixed(2)}</span>
                      </div>
                      <p className="text-sm text-green-600">{invoice.items.length} items</p>
                    </div>
                  ))}
                  <div className="bg-white border-2 border-green-300 rounded p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-green-900">Total Funding Request:</span>
                      <span className="font-bold text-lg text-green-700">
                        ${eventData.invoices.reduce((total: number, invoice: any) => total + invoice.total, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-green-700">Legacy invoice format detected</p>
              )}
            </div>
          )}

          {/* Files Summary */}
          {(eventData.roomBookingFiles?.length > 0 || eventData.invoiceFiles?.length > 0) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Uploaded Files
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {eventData.roomBookingFiles?.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-800">Room Booking Files:</span>
                    <ul className="mt-1 space-y-1">
                      {eventData.roomBookingFiles.map((file: string, index: number) => (
                        <li key={index} className="text-gray-600">
                          • {truncateFilename(`Room Booking ${index + 1}`)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {eventData.invoiceFiles?.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-800">Invoice Files:</span>
                    <ul className="mt-1 space-y-1">
                      {eventData.invoiceFiles.map((file: string, index: number) => (
                        <li key={index} className="text-gray-600">
                          • {truncateFilename(`Invoice ${index + 1}`)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Confirmation Checkbox */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasConfirmed}
                onChange={(e) => setHasConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={isSubmitting}
              />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">
                  I confirm that all information above is accurate and complete
                </p>
                <p className="text-yellow-700 mt-1">
                  I understand that submitting incomplete or inaccurate information may result in event delays or cancellation.
                </p>
              </div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4 border-t">
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back to Edit
            </button>
            <button
              onClick={onConfirm}
              disabled={!hasConfirmed || isSubmitting}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Confirm & Submit Event
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
