import { useMemo } from 'react';
import { ArrowRight, Calendar, MapPin, Users, DollarSign, FileText, AlertCircle, Upload, Trash2, Plus, Eye, Clock, RefreshCw } from 'lucide-react';
import { extractFilename } from '../utils/filenameUtils';
import { useChangeTracking } from '../hooks/useChangeTracking';

interface FieldChange {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
  type: 'text' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'file';
  timestamp?: Date;
}

interface FileChange {
  type: 'added' | 'removed' | 'replaced';
  field: string;
  filename: string;
  url?: string;
}

interface InvoiceChange {
  invoiceId: string;
  field: string;
  oldValue: any;
  newValue: any;
  type: 'added' | 'removed' | 'modified';
}

interface EventEditComparisonProps {
  originalData: any;
  newData: any;
  onConfirm: () => void;
  onCancel: () => void;
  onBack?: () => void;
  isSubmitting?: boolean;
  eventRequestId?: string;
  enableRealTimeTracking?: boolean;
}

export default function EventEditComparison({
  originalData,
  newData,
  onConfirm,
  onCancel,
  onBack,
  isSubmitting = false,
  eventRequestId,
  enableRealTimeTracking = true
}: EventEditComparisonProps) {
  // Use change tracking hook for real-time updates
  const {
    fieldChanges: trackedFieldChanges,
    fileChanges: trackedFileChanges,
    invoiceChanges: trackedInvoiceChanges,
    hasChanges: hasTrackedChanges,
    lastChangeTimestamp
  } = useChangeTracking(originalData, newData, {
    eventRequestId,
    enableAuditLogging: enableRealTimeTracking,
    debounceMs: 300
  });

  const formatValue = (value: any, type: string): string => {
    // Handle null and undefined
    if (value === null || value === undefined) return 'Not specified';

    // Handle File objects
    if (value instanceof File) {
      return value.name;
    }

    // Handle arrays that might contain File objects
    if (Array.isArray(value) && value.some(item => item instanceof File)) {
      return value.map(item => item instanceof File ? item.name : item).join(', ');
    }

    switch (type) {
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'date':
        // Handle empty string for dates
        if (value === '') return 'Not specified';
        try {
          const date = value.toDate ? value.toDate() : new Date(value);
          // Check if date is valid
          if (isNaN(date.getTime())) return 'Not specified';
          return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
        } catch {
          return 'Not specified';
        }
      case 'array':
        if (Array.isArray(value)) {
          return value.length > 0 ? value.join(', ') : 'Not specified';
        }
        return String(value);
      case 'object':
        if (typeof value === 'object') {
          return JSON.stringify(value, null, 2);
        }
        return String(value);
      case 'number':
        // Handle number values properly
        if (value === '' || value === null || value === undefined) return 'Not specified';
        const numValue = Number(value);
        return isNaN(numValue) ? 'Not specified' : String(numValue);
      default:
        // Handle string values properly - don't treat empty string as "Not specified" unless it's truly empty
        if (value === '') return 'Not specified';
        const stringValue = String(value).trim();
        return stringValue === '' ? 'Not specified' : stringValue;
    }
  };

  // Helper function to normalize values for comparison
  const normalizeValue = (value: any, type: string): any => {
    if (value === null || value === undefined) return null;

    switch (type) {
      case 'text':
        const stringValue = String(value).trim();
        return stringValue === '' ? null : stringValue;
      case 'number':
        if (value === '' || value === null || value === undefined) return null;
        const numValue = Number(value);
        return isNaN(numValue) ? null : numValue;
      case 'boolean':
        // Handle boolean values more strictly
        if (value === null || value === undefined) return null;
        if (value === '' || value === 'false' || value === false) return false;
        return Boolean(value);
      case 'array':
        if (!Array.isArray(value)) return [];
        return value.filter(item => item !== null && item !== undefined && item !== '');
      case 'date':
        if (!value || value === '') return null;
        try {
          const date = value.toDate ? value.toDate() : new Date(value);
          if (isNaN(date.getTime())) return null;
          return date.toISOString();
        } catch {
          return null;
        }
      default:
        return value;
    }
  };

  const detectLegacyChanges = (): FieldChange[] => {
    const changes: FieldChange[] = [];

    const fieldMappings = [
      { field: 'name', label: 'Event Name', type: 'text' },
      { field: 'eventDescription', label: 'Description', type: 'text' },
      { field: 'location', label: 'Location', type: 'text' },
      { field: 'department', label: 'Department', type: 'text' },
      { field: 'expectedAttendance', label: 'Expected Attendance', type: 'text' },
      { field: 'startDate', label: 'Start Date', type: 'date' },
      { field: 'startTime', label: 'Start Time', type: 'text' },
      { field: 'endTime', label: 'End Time', type: 'text' },
      { field: 'eventCode', label: 'Event Code', type: 'text' },
      { field: 'pointsToReward', label: 'Points to Reward', type: 'number' },
      { field: 'needsGraphics', label: 'Graphics Required', type: 'boolean' },
      { field: 'needsAsFunding', label: 'AS Funding Required', type: 'boolean' },
      { field: 'flyersNeeded', label: 'Flyers Needed', type: 'boolean' },
      { field: 'photographyNeeded', label: 'Photography Needed', type: 'boolean' },
      { field: 'hasRoomBooking', label: 'Room Booking', type: 'boolean' },
      { field: 'servingFoodDrinks', label: 'Food & Drinks', type: 'boolean' },
      { field: 'flyerType', label: 'Flyer Types', type: 'array' },
      { field: 'requiredLogos', label: 'Required Logos', type: 'array' },
      { field: 'advertisingFormat', label: 'Advertising Format', type: 'text' },
      { field: 'additionalSpecifications', label: 'Additional Specifications', type: 'text' },
      { field: 'flyerAdvertisingStartDate', label: 'Flyer Start Date', type: 'date' },
      { field: 'flyerAdditionalRequests', label: 'Flyer Additional Requests', type: 'text' },
    ];

    fieldMappings.forEach(({ field, label, type }) => {
      // Get values directly from the data objects
      let oldValue = originalData?.[field];
      let newValue = newData?.[field];

      // Normalize both values for proper comparison
      const normalizedOldValue = normalizeValue(oldValue, type);
      const normalizedNewValue = normalizeValue(newValue, type);

      // Use deep equality comparison for arrays and objects
      let hasChanged = false;
      if (type === 'array') {
        const oldArray = Array.isArray(normalizedOldValue) ? normalizedOldValue : [];
        const newArray = Array.isArray(normalizedNewValue) ? normalizedNewValue : [];
        hasChanged = JSON.stringify(oldArray.sort()) !== JSON.stringify(newArray.sort());
      } else {
        hasChanged = normalizedOldValue !== normalizedNewValue;
      }

      // Skip optional fields that are empty in both original and new data
      const optionalFields = ['additionalSpecifications', 'flyerAdditionalRequests'];
      if (optionalFields.includes(field)) {
        const isOldEmpty = !normalizedOldValue || (typeof normalizedOldValue === 'string' && normalizedOldValue.trim() === '');
        const isNewEmpty = !normalizedNewValue || (typeof normalizedNewValue === 'string' && normalizedNewValue.trim() === '');
        if (isOldEmpty && isNewEmpty) {
          return; // Skip this field
        }
      }

      if (hasChanged) {
        changes.push({
          field,
          label,
          oldValue,
          newValue,
          type: type as any,
          timestamp: new Date()
        });
      }
    });

    return changes;
  };

  const detectFileChanges = (): FileChange[] => {
    const changes: FileChange[] = [];

    const fileFields = [
      { field: 'existingRoomBookingFiles', label: 'Room Booking Files' },
      { field: 'existingOtherLogos', label: 'Other Logo Files' },
      { field: 'existingInvoiceFiles', label: 'Invoice Files' }
    ];

    fileFields.forEach(({ field }) => {
      const oldFiles = Array.isArray(originalData[field]) ? originalData[field] : [];
      const newFiles = Array.isArray(newData[field]) ? newData[field] : [];

      // Only detect changes if the arrays are actually different
      if (JSON.stringify(oldFiles.sort()) === JSON.stringify(newFiles.sort())) {
        return; // No changes in this field
      }

      // Detect removed files
      oldFiles.forEach((fileUrl: string) => {
        if (fileUrl && !newFiles.includes(fileUrl)) {
          changes.push({
            type: 'removed',
            field,
            filename: extractFilename(fileUrl),
            url: fileUrl
          });
        }
      });

      // Detect added files
      newFiles.forEach((fileUrl: string) => {
        if (fileUrl && !oldFiles.includes(fileUrl)) {
          changes.push({
            type: 'added',
            field,
            filename: extractFilename(fileUrl),
            url: fileUrl
          });
        }
      });
    });

    // Check for new file uploads (File objects) only if they exist and are different from existing files
    const newFileFields = [
      { field: 'roomBookingFile', existingField: 'existingRoomBookingFiles' },
      { field: 'otherLogoFiles', existingField: 'existingOtherLogos' }
    ];

    newFileFields.forEach(({ field, existingField }) => {
      const newFileData = newData[field];
      const existingFiles = Array.isArray(newData[existingField]) ? newData[existingField] : [];
      const originalExistingFiles = Array.isArray(originalData[existingField]) ? originalData[existingField] : [];

      if (field === 'roomBookingFile' && newFileData instanceof File) {
        // Only add if this is a new file upload and wasn't in the original data
        const isNewFile = !originalExistingFiles.some((url: string) => extractFilename(url) === newFileData.name) &&
          !existingFiles.some((url: string) => extractFilename(url) === newFileData.name);
        if (isNewFile) {
          changes.push({
            type: 'added',
            field,
            filename: newFileData.name
          });
        }
      } else if (field === 'otherLogoFiles' && Array.isArray(newFileData)) {
        newFileData.forEach((file: File) => {
          if (file instanceof File) {
            const isNewFile = !originalExistingFiles.some((url: string) => extractFilename(url) === file.name) &&
              !existingFiles.some((url: string) => extractFilename(url) === file.name);
            if (isNewFile) {
              changes.push({
                type: 'added',
                field,
                filename: file.name
              });
            }
          }
        });
      }
    });

    return changes;
  };

  const detectInvoiceChanges = (): InvoiceChange[] => {
    const changes: InvoiceChange[] = [];
    const oldInvoices = originalData.invoices || [];
    const newInvoices = newData.invoices || [];

    // Create maps for comparison
    const oldInvoiceMap = new Map(oldInvoices.map((inv: any) => [inv.id, inv]));
    const newInvoiceMap = new Map(newInvoices.map((inv: any) => [inv.id, inv]));

    // Check for added invoices
    newInvoices.forEach((invoice: any) => {
      if (!oldInvoiceMap.has(invoice.id)) {
        changes.push({
          invoiceId: invoice.id,
          field: 'invoice',
          oldValue: null,
          newValue: invoice,
          type: 'added'
        });
      }
    });

    // Check for removed invoices
    oldInvoices.forEach((invoice: any) => {
      if (!newInvoiceMap.has(invoice.id)) {
        changes.push({
          invoiceId: invoice.id,
          field: 'invoice',
          oldValue: invoice,
          newValue: null,
          type: 'removed'
        });
      }
    });

    // Check for modified invoices
    oldInvoices.forEach((oldInvoice: any) => {
      const newInvoice = newInvoiceMap.get(oldInvoice.id);
      if (newInvoice) {
        const fieldsToCheck = ['vendor', 'total', 'tax', 'tip', 'items', 'invoiceFile'];
        fieldsToCheck.forEach(field => {
          const oldValue = (oldInvoice as any)[field];
          const newValue = (newInvoice as any)[field];
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            changes.push({
              invoiceId: oldInvoice.id,
              field,
              oldValue,
              newValue,
              type: 'modified'
            });
          }
        });
      }
    });

    return changes;
  };

  // Comprehensive change detection with memoization
  const allChanges = useMemo(() => {
    const fieldChanges = enableRealTimeTracking ? trackedFieldChanges : detectLegacyChanges();
    const fileChanges = enableRealTimeTracking ? trackedFileChanges : detectFileChanges();
    const invoiceChanges = enableRealTimeTracking ? trackedInvoiceChanges : detectInvoiceChanges();

    return {
      fieldChanges,
      fileChanges,
      invoiceChanges,
      hasChanges: fieldChanges.length > 0 || fileChanges.length > 0 || invoiceChanges.length > 0
    };
  }, [originalData, newData, trackedFieldChanges, trackedFileChanges, trackedInvoiceChanges, enableRealTimeTracking]);

  // Use comprehensive changes
  const { fieldChanges, fileChanges, invoiceChanges, hasChanges } = allChanges;

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

  const renderChangeValue = (value: any, type: string, isOld: boolean = false) => {
    let formattedValue = formatValue(value, type);

    // Special handling for File objects that might appear in invoice changes
    if (value instanceof File) {
      formattedValue = value.name;
    } else if (typeof value === 'object' && value !== null && value.constructor === File) {
      formattedValue = value.name;
    }

    return (
      <div className={`px-3 py-2 rounded text-sm ${isOld
        ? 'bg-red-50 text-red-800 border border-red-200'
        : 'bg-green-50 text-green-800 border border-green-200'
        }`}>
        {formattedValue}
      </div>
    );
  };

  const renderFileChanges = () => {
    if (fileChanges.length === 0) return null;

    return (
      <div className="mt-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Upload className="w-5 h-5 mr-2" />
          File Changes ({fileChanges.length})
        </h4>
        <div className="space-y-3">
          {fileChanges.map((change, index) => (
            <div key={index} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {change.type === 'added' && <Plus className="w-4 h-4 text-green-600" />}
                  {change.type === 'removed' && <Trash2 className="w-4 h-4 text-red-600" />}
                  {change.type === 'replaced' && <RefreshCw className="w-4 h-4 text-blue-600" />}
                  <span className={`text-sm font-medium ${change.type === 'added' ? 'text-green-700' :
                    change.type === 'removed' ? 'text-red-700' : 'text-blue-700'
                    }`}>
                    {change.type.charAt(0).toUpperCase() + change.type.slice(1)} File
                  </span>
                </div>
                <span className="text-xs text-gray-500">{change.field}</span>
              </div>
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-700">{change.filename}</span>
                {change.url && (
                  <a
                    href={change.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 ml-auto"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderInvoiceChanges = () => {
    if (invoiceChanges.length === 0) return null;

    return (
      <div className="mt-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <DollarSign className="w-5 h-5 mr-2" />
          Invoice Changes ({invoiceChanges.length})
        </h4>
        <div className="space-y-4">
          {invoiceChanges.map((change, index) => (
            <div key={index} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {change.type === 'added' && <Plus className="w-4 h-4 text-green-600" />}
                  {change.type === 'removed' && <Trash2 className="w-4 h-4 text-red-600" />}
                  {change.type === 'modified' && <RefreshCw className="w-4 h-4 text-blue-600" />}
                  <span className={`text-sm font-medium ${change.type === 'added' ? 'text-green-700' :
                    change.type === 'removed' ? 'text-red-700' : 'text-blue-700'
                    }`}>
                    {change.type.charAt(0).toUpperCase() + change.type.slice(1)} Invoice
                  </span>
                </div>
                <span className="text-xs text-gray-500">ID: {change.invoiceId}</span>
              </div>

              {change.type === 'modified' && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">{change.field}:</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Before:</div>
                      {renderChangeValue(change.oldValue, 'text', true)}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">After:</div>
                      {renderChangeValue(change.newValue, 'text', false)}
                    </div>
                  </div>
                </div>
              )}

              {(change.type === 'added' || change.type === 'removed') && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-700">
                    {change.type === 'added' ? 'New invoice:' : 'Removed invoice:'}
                  </div>
                  <div className="text-xs text-gray-600 bg-white p-2 rounded border">
                    {change.newValue ? (
                      <div>
                        <div>Vendor: {change.newValue.vendor || 'N/A'}</div>
                        <div>Total: ${change.newValue.total || '0.00'}</div>
                        <div>Items: {change.newValue.items?.length || 0}</div>
                      </div>
                    ) : (
                      <div>
                        <div>Vendor: {change.oldValue?.vendor || 'N/A'}</div>
                        <div>Total: ${change.oldValue?.total || '0.00'}</div>
                        <div>Items: {change.oldValue?.items?.length || 0}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 z-20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Review Event Changes</h2>
              <p className="text-sm text-gray-600 mt-1">
                {hasChanges
                  ? `${fieldChanges.length + fileChanges.length + invoiceChanges.length} total change${(fieldChanges.length + fileChanges.length + invoiceChanges.length) !== 1 ? 's' : ''} detected`
                  : 'No changes detected'
                }
              </p>
            </div>
            {enableRealTimeTracking && lastChangeTimestamp && (
              <div className="text-right">
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>Last updated: {lastChangeTimestamp.toLocaleTimeString()}</span>
                </div>
                <div className="text-xs text-green-600 mt-1">Real-time tracking enabled</div>
              </div>
            )}
          </div>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-700">{fieldChanges.length}</div>
                    <div className="text-sm text-blue-600">Field Changes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-700">{fileChanges.length}</div>
                    <div className="text-sm text-green-600">File Changes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-700">{invoiceChanges.length}</div>
                    <div className="text-sm text-purple-600">Invoice Changes</div>
                  </div>
                </div>
                {fieldChanges.length > 0 && (
                  <div className="mt-3">
                    <p className="text-blue-700 text-sm mb-2">Field changes:</p>
                    <div className="flex flex-wrap gap-2">
                      {fieldChanges.map((change, index) => (
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
                )}
              </div>

              {/* Detailed Field Changes */}
              {fieldChanges.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Field Changes</h3>
                  {fieldChanges.map((change, index) => (
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
              )}

              {/* File Changes Section */}
              {renderFileChanges()}

              {/* Invoice Changes Section */}
              {renderInvoiceChanges()}

              {/* Critical Changes Warning */}
              {fieldChanges.some(change => ['name', 'startDateTime', 'endDateTime', 'location'].includes(change.field)) && (
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
          <div className="flex items-center pt-6 border-t mt-6">
            {/* Cancel Button - Leftmost */}
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel Changes
            </button>

            {/* Spacer */}
            <div className="flex-1"></div>

            {/* Right side buttons */}
            <div className="flex space-x-3">
              {/* Back Button */}
              {onBack && (
                <button
                  onClick={onBack}
                  disabled={isSubmitting}
                  className="px-6 py-3 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  ← Back
                </button>
              )}

              {/* Confirm Button - Primary position (rightmost) */}
              <button
                onClick={onConfirm}
                disabled={isSubmitting || !hasChanges}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving Changes...
                  </>
                ) : (
                  `Confirm ${fieldChanges.length + fileChanges.length + invoiceChanges.length} Change${(fieldChanges.length + fileChanges.length + invoiceChanges.length) !== 1 ? 's' : ''}`
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
