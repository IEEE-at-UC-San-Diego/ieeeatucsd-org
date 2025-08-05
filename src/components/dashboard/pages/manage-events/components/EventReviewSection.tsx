import { useState } from 'react';
import { AlertTriangle, Calendar, MapPin, Users, DollarSign, FileText, CheckCircle, X, Megaphone } from 'lucide-react';
import { truncateFilename } from '../utils/filenameUtils';
import type { EventFormData } from '../types/EventRequestTypes';
import EventEditComparison from './EventEditComparison';

interface EventReviewSectionProps {
  eventData?: any;
  formData?: EventFormData;
  onConfirm?: () => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  showRoomBookingWarning?: boolean;
  isInlineStep?: boolean;
  originalData?: any; // For edit mode comparison
  isEditMode?: boolean;
}

export default function EventReviewSection({
  eventData,
  formData,
  onConfirm,
  onCancel,
  isSubmitting = false,
  showRoomBookingWarning = true,
  isInlineStep = false,
  originalData,
  isEditMode = false
}: EventReviewSectionProps) {
  const [hasConfirmed, setHasConfirmed] = useState(false);

  // Use formData if provided (for inline step), otherwise use eventData (for modal)
  const data = formData || eventData;

  // If in edit mode and we have original data, show comparison view
  if (isEditMode && originalData && data) {
    return (
      <EventEditComparison
        originalData={originalData}
        newData={data}
        onConfirm={onConfirm || (() => { })}
        onCancel={onCancel || (() => { })}
        isSubmitting={isSubmitting}
        enableRealTimeTracking={true}
      />
    );
  }

  // Helper function to calculate invoice totals
  const calculateInvoiceTotal = (invoice: any): number => {
    if (!invoice) return 0;

    // Calculate subtotal from items
    const subtotal = invoice.items?.reduce((sum: number, item: any) => {
      const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
      return sum + itemTotal;
    }, 0) || 0;

    // Add tax and tip
    const tax = invoice.tax || 0;
    const tip = invoice.tip || 0;

    return subtotal + tax + tip;
  };

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

  const formatFormDateTime = (date: string, time: string) => {
    if (!date || !time) return 'Not specified';
    try {
      const dateTime = new Date(`${date}T${time}`);
      return dateTime.toLocaleString('en-US', {
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

  const hasRoomBooking = data?.hasRoomBooking ?? data?.willOrHaveRoomBooking;
  const hasRoomBookingFiles = (data?.roomBookingFiles && data.roomBookingFiles.length > 0) ||
    (data?.roomBookingFile) ||
    (data?.existingRoomBookingFiles && data.existingRoomBookingFiles.length > 0);

  // If this is an inline step, render without the modal wrapper
  if (isInlineStep) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Review Event Submission</h2>
          <p className="text-sm text-gray-600 mt-1">
            Please review all information before final submission
          </p>
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
                  <p className="text-blue-700">{data?.name || 'Not specified'}</p>
                </div>
                <div>
                  <span className="font-medium text-blue-800">Description:</span>
                  <p className="text-blue-700">{data?.eventDescription || 'Not specified'}</p>
                </div>
                <div>
                  <span className="font-medium text-blue-800">Location:</span>
                  <p className="text-blue-700 flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {data?.location || 'Not specified'}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-blue-800">Department:</span>
                  <p className="text-blue-700">{data?.department || 'General'}</p>
                </div>
                <div>
                  <span className="font-medium text-blue-800">Expected Attendance:</span>
                  <p className="text-blue-700 flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {data?.expectedAttendance || 'Not specified'}
                  </p>
                </div>
                {data?.eventCode && (
                  <div>
                    <span className="font-medium text-blue-800">Event Code:</span>
                    <p className="text-blue-700">{data.eventCode}</p>
                  </div>
                )}
                {data?.pointsToReward && data.pointsToReward > 0 && (
                  <div>
                    <span className="font-medium text-blue-800">Points to Reward:</span>
                    <p className="text-blue-700">{data.pointsToReward}</p>
                  </div>
                )}
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
                  <p className="text-green-700">
                    {formData ? formatFormDateTime(data?.startDate, data?.startTime) : formatDateTime(data?.startDateTime)}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-green-800">End:</span>
                  <p className="text-green-700">
                    {formData ? formatFormDateTime(data?.startDate, data?.endTime) : formatDateTime(data?.endDateTime)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Requirements & Services */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-purple-900 mb-4">Requirements & Services</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${data?.needsGraphics || data?.flyersNeeded ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-purple-700">Graphics Required</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${data?.needsAsFunding ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-purple-700">AS Funding Required</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${data?.flyersNeeded ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-purple-700">Flyers Needed</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${data?.photographyNeeded ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-purple-700">Photography Needed</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${hasRoomBooking && hasRoomBookingFiles ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-purple-700">Room Booking</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${data?.servingFoodDrinks ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <span className="text-purple-700">Food & Drinks</span>
              </div>
            </div>
          </div>

          {/* Funding Information */}
          {(data?.invoices?.length > 0 || data?.itemizedInvoice?.length > 0) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Funding Information
              </h3>
              {data?.invoices?.length > 0 ? (
                <div className="space-y-4">
                  {data.invoices.map((invoice: any, index: number) => {
                    const calculatedTotal = calculateInvoiceTotal(invoice);
                    const subtotal = invoice.items?.reduce((sum: number, item: any) => {
                      return sum + ((item.quantity || 0) * (item.unitPrice || 0));
                    }, 0) || 0;

                    return (
                      <div key={index} className="bg-white border border-green-200 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-medium text-green-800 text-lg">
                            Invoice #{index + 1} - {invoice.vendor || 'No vendor specified'}
                          </span>
                          <span className="font-bold text-green-700 text-lg">
                            ${calculatedTotal.toFixed(2)}
                          </span>
                        </div>

                        {/* Invoice Items */}
                        {invoice.items && invoice.items.length > 0 && (
                          <div className="mb-3">
                            <h4 className="font-medium text-gray-700 mb-2">Items ({invoice.items.length}):</h4>
                            <div className="space-y-1">
                              {invoice.items.map((item: any, itemIndex: number) => (
                                <div key={itemIndex} className="flex justify-between text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                                  <span>{item.quantity}x {item.description || 'No description'}</span>
                                  <span>${((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Invoice Breakdown */}
                        <div className="border-t border-green-200 pt-3">
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Subtotal:</span>
                              <span className="text-gray-800">${subtotal.toFixed(2)}</span>
                            </div>
                            {(invoice.tax || 0) > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Tax:</span>
                                <span className="text-gray-800">${(invoice.tax || 0).toFixed(2)}</span>
                              </div>
                            )}
                            {(invoice.tip || 0) > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Tip:</span>
                                <span className="text-gray-800">${(invoice.tip || 0).toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-medium border-t border-gray-200 pt-1">
                              <span className="text-green-700">Total:</span>
                              <span className="text-green-700">${calculatedTotal.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Grand Total */}
                  <div className="bg-white border-2 border-green-300 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-green-900 text-lg">Total Funding Request:</span>
                      <span className="font-bold text-xl text-green-700">
                        ${data.invoices.reduce((total: number, invoice: any) => total + calculateInvoiceTotal(invoice), 0).toFixed(2)}
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
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Uploaded Files & Status
            </h3>

            {/* Room Booking Files */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-800">Room Booking Files:</span>
                <span className={`text-xs px-2 py-1 rounded-full ${hasRoomBookingFiles ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {hasRoomBookingFiles ? 'Uploaded' : 'Missing'}
                </span>
              </div>
              {hasRoomBookingFiles ? (
                <ul className="space-y-1 text-sm">
                  {data?.roomBookingFile && (
                    <li className="text-gray-600 flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      {typeof data.roomBookingFile === 'string' ? truncateFilename(data.roomBookingFile) : 'Room Booking File'}
                    </li>
                  )}
                  {data?.existingRoomBookingFiles?.map((file: string, index: number) => (
                    <li key={index} className="text-gray-600 flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      {truncateFilename(file)}
                    </li>
                  ))}
                  {data?.roomBookingFiles?.map((file: string, index: number) => (
                    <li key={index} className="text-gray-600 flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      {truncateFilename(file)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-red-600 text-sm">No room booking files uploaded</p>
              )}
            </div>

            {/* Invoice Files */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-800">Invoice Files:</span>
                <span className={`text-xs px-2 py-1 rounded-full ${(data?.invoiceFiles?.length > 0 || data?.invoices?.some((inv: any) => inv.invoiceFile || (inv.invoiceFiles && inv.invoiceFiles.length > 0) || (inv.existingInvoiceFiles && inv.existingInvoiceFiles.length > 0)))
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
                  }`}>
                  {(data?.invoiceFiles?.length > 0 || data?.invoices?.some((inv: any) => inv.invoiceFile || (inv.invoiceFiles && inv.invoiceFiles.length > 0) || (inv.existingInvoiceFiles && inv.existingInvoiceFiles.length > 0))) ? 'Uploaded' : 'Missing'}
                </span>
              </div>
              {(data?.invoiceFiles?.length > 0 || data?.invoices?.some((inv: any) => inv.invoiceFile || (inv.invoiceFiles && inv.invoiceFiles.length > 0) || (inv.existingInvoiceFiles && inv.existingInvoiceFiles.length > 0))) ? (
                <div className="space-y-2">
                  {/* Legacy invoice files */}
                  {data?.invoiceFiles?.map((file: string, index: number) => (
                    <div key={index} className="text-gray-600 flex items-center text-sm">
                      <FileText className="w-4 h-4 mr-2" />
                      {truncateFilename(file)}
                    </div>
                  ))}

                  {/* New invoice files per invoice */}
                  {data?.invoices?.map((invoice: any, index: number) => {
                    const hasFiles = invoice.invoiceFile || (invoice.invoiceFiles && invoice.invoiceFiles.length > 0) || (invoice.existingInvoiceFiles && invoice.existingInvoiceFiles.length > 0);
                    if (!hasFiles) return null;

                    return (
                      <div key={index} className="border-l-2 border-gray-300 pl-3">
                        <div className="text-sm font-medium text-gray-700 mb-1">
                          Invoice #{index + 1} - {invoice.vendor || 'No vendor'}:
                        </div>
                        <div className="space-y-1">
                          {invoice.invoiceFile && (
                            <div className="text-gray-600 flex items-center text-sm">
                              <FileText className="w-4 h-4 mr-2" />
                              {typeof invoice.invoiceFile === 'string' ? truncateFilename(invoice.invoiceFile) : `Invoice ${index + 1} File`}
                            </div>
                          )}
                          {invoice.invoiceFiles?.map((file: any, fileIndex: number) => (
                            <div key={fileIndex} className="text-gray-600 flex items-center text-sm">
                              <FileText className="w-4 h-4 mr-2" />
                              {typeof file === 'string' ? truncateFilename(file) : file.name || `File ${fileIndex + 1}`}
                            </div>
                          ))}
                          {invoice.existingInvoiceFiles?.map((file: string, fileIndex: number) => (
                            <div key={fileIndex} className="text-gray-600 flex items-center text-sm">
                              <FileText className="w-4 h-4 mr-2" />
                              {truncateFilename(file)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-red-600 text-sm">No invoice files uploaded</p>
              )}
            </div>

            {/* Other Files */}
            {(data?.otherLogoFiles?.length > 0 || data?.existingOtherLogos?.length > 0) && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800">Other Logo Files:</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                    Uploaded
                  </span>
                </div>
                <ul className="space-y-1 text-sm">
                  {data?.otherLogoFiles?.map((file: any, index: number) => (
                    <li key={index} className="text-gray-600 flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      {typeof file === 'string' ? truncateFilename(file) : file.name || `Logo File ${index + 1}`}
                    </li>
                  ))}
                  {data?.existingOtherLogos?.map((file: string, index: number) => (
                    <li key={index} className="text-gray-600 flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      {truncateFilename(file)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Confirmation Note for inline step */}
          {isInlineStep && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm">
                <p className="font-medium text-blue-800">
                  Please review all information above carefully
                </p>
                <p className="text-blue-700 mt-1">
                  Once you click "Submit Request" below, your event request will be submitted for review. Make sure all information is accurate and complete.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Original modal version
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

          {/* Rest of the modal content would go here - same as inline version */}
          {/* For brevity, using the same content structure as inline */}

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
