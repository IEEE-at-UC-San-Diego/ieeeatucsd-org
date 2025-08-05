import { useState, useEffect, useRef } from "react";
import { EventAuditService } from "../../../shared/services/eventAuditService";
import { auth } from "../../../../../firebase/client";

interface FieldChange {
  field: string;
  label: string;
  oldValue: any;
  newValue: any;
  type: "text" | "number" | "boolean" | "date" | "array" | "object" | "file";
  timestamp: Date;
}

interface FileChange {
  type: "added" | "removed" | "replaced";
  field: string;
  filename: string;
  url?: string;
  timestamp: Date;
}

interface InvoiceChange {
  invoiceId: string;
  field: string;
  oldValue: any;
  newValue: any;
  type: "added" | "removed" | "modified";
  timestamp: Date;
}

interface ChangeTrackingState {
  fieldChanges: FieldChange[];
  fileChanges: FileChange[];
  invoiceChanges: InvoiceChange[];
  hasChanges: boolean;
  lastChangeTimestamp?: Date;
}

interface UseChangeTrackingOptions {
  eventRequestId?: string;
  enableAuditLogging?: boolean;
  debounceMs?: number;
}

export function useChangeTracking(
  originalData: any,
  currentData: any,
  options: UseChangeTrackingOptions = {},
) {
  const {
    eventRequestId,
    enableAuditLogging = true,
    debounceMs = 500,
  } = options;

  const [changeState, setChangeState] = useState<ChangeTrackingState>({
    fieldChanges: [],
    fileChanges: [],
    invoiceChanges: [],
    hasChanges: false,
  });

  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const previousDataRef = useRef(originalData);

  // Field mappings for change detection
  const fieldMappings = [
    { field: "name", label: "Event Name", type: "text" },
    { field: "location", label: "Location", type: "text" },
    { field: "startDate", label: "Start Date", type: "date" },
    { field: "startTime", label: "Start Time", type: "text" },
    { field: "endTime", label: "End Time", type: "text" },
    { field: "eventDescription", label: "Description", type: "text" },
    { field: "department", label: "Department", type: "text" },
    { field: "eventCode", label: "Event Code", type: "text" },
    { field: "pointsToReward", label: "Points to Reward", type: "number" },
    { field: "expectedAttendance", label: "Expected Attendance", type: "text" },
    { field: "flyersNeeded", label: "Flyers Needed", type: "boolean" },
    {
      field: "photographyNeeded",
      label: "Photography Needed",
      type: "boolean",
    },
    { field: "hasRoomBooking", label: "Room Booking", type: "boolean" },
    { field: "servingFoodDrinks", label: "Food & Drinks", type: "boolean" },
    { field: "needsAsFunding", label: "AS Funding", type: "boolean" },
    { field: "needsGraphics", label: "Graphics Needed", type: "boolean" },
    { field: "flyerType", label: "Flyer Types", type: "array" },
    { field: "requiredLogos", label: "Required Logos", type: "array" },
    { field: "advertisingFormat", label: "Advertising Format", type: "text" },
    {
      field: "additionalSpecifications",
      label: "Additional Specifications",
      type: "text",
    },
    {
      field: "flyerAdvertisingStartDate",
      label: "Flyer Start Date",
      type: "date",
    },
    {
      field: "flyerAdditionalRequests",
      label: "Flyer Additional Requests",
      type: "text",
    },
  ];

  // File field mappings
  const fileFieldMappings = [
    { field: "existingRoomBookingFiles", label: "Room Booking Files" },
    { field: "existingOtherLogos", label: "Other Logo Files" },
    { field: "existingInvoiceFiles", label: "Invoice Files" },
  ];

  const detectFieldChanges = (): FieldChange[] => {
    const changes: FieldChange[] = [];
    const timestamp = new Date();

    fieldMappings.forEach(({ field, label, type }) => {
      const oldValue = originalData[field];
      const newValue = currentData[field];

      // Deep comparison for objects and arrays
      const hasChanged = JSON.stringify(oldValue) !== JSON.stringify(newValue);

      if (hasChanged) {
        changes.push({
          field,
          label,
          oldValue,
          newValue,
          type: type as any,
          timestamp,
        });
      }
    });

    return changes;
  };

  const detectFileChanges = (): FileChange[] => {
    const changes: FileChange[] = [];
    const timestamp = new Date();

    fileFieldMappings.forEach(({ field, label }) => {
      const oldFiles = originalData[field] || [];
      const newFiles = currentData[field] || [];

      // Detect removed files
      oldFiles.forEach((fileUrl: string) => {
        if (!newFiles.includes(fileUrl)) {
          changes.push({
            type: "removed",
            field,
            filename: extractFilename(fileUrl),
            url: fileUrl,
            timestamp,
          });
        }
      });

      // Detect added files
      newFiles.forEach((fileUrl: string) => {
        if (!oldFiles.includes(fileUrl)) {
          changes.push({
            type: "added",
            field,
            filename: extractFilename(fileUrl),
            url: fileUrl,
            timestamp,
          });
        }
      });
    });

    // Check for new file uploads (File objects)
    if (currentData.roomBookingFile) {
      changes.push({
        type: "added",
        field: "roomBookingFile",
        filename: currentData.roomBookingFile.name,
        timestamp,
      });
    }

    if (currentData.otherLogoFiles && currentData.otherLogoFiles.length > 0) {
      currentData.otherLogoFiles.forEach((file: File) => {
        changes.push({
          type: "added",
          field: "otherLogoFiles",
          filename: file.name,
          timestamp,
        });
      });
    }

    return changes;
  };

  const detectInvoiceChanges = (): InvoiceChange[] => {
    const changes: InvoiceChange[] = [];
    const timestamp = new Date();

    const oldInvoices = originalData.invoices || [];
    const newInvoices = currentData.invoices || [];

    // Compare invoices by ID
    const invoiceMap = new Map();
    oldInvoices.forEach((invoice: any) => {
      invoiceMap.set(invoice.id, { old: invoice, new: null });
    });

    newInvoices.forEach((invoice: any) => {
      if (invoiceMap.has(invoice.id)) {
        invoiceMap.get(invoice.id).new = invoice;
      } else {
        invoiceMap.set(invoice.id, { old: null, new: invoice });
      }
    });

    invoiceMap.forEach((value, invoiceId) => {
      const { old: oldInvoice, new: newInvoice } = value;

      if (!oldInvoice && newInvoice) {
        // New invoice added
        changes.push({
          invoiceId,
          field: "invoice",
          oldValue: null,
          newValue: newInvoice,
          type: "added",
          timestamp,
        });
      } else if (oldInvoice && !newInvoice) {
        // Invoice removed
        changes.push({
          invoiceId,
          field: "invoice",
          oldValue: oldInvoice,
          newValue: null,
          type: "removed",
          timestamp,
        });
      } else if (oldInvoice && newInvoice) {
        // Compare invoice fields
        const invoiceFields = [
          "vendor",
          "total",
          "tax",
          "tip",
          "items",
          "invoiceFile",
        ];
        invoiceFields.forEach((field) => {
          if (
            JSON.stringify(oldInvoice[field]) !==
            JSON.stringify(newInvoice[field])
          ) {
            changes.push({
              invoiceId,
              field,
              oldValue: oldInvoice[field],
              newValue: newInvoice[field],
              type: "modified",
              timestamp,
            });
          }
        });
      }
    });

    return changes;
  };

  const extractFilename = (url: string): string => {
    try {
      const urlParts = url.split("/");
      const filename = urlParts[urlParts.length - 1];
      return decodeURIComponent(filename.split("?")[0]);
    } catch {
      return "Unknown file";
    }
  };

  const logChangesToAudit = async (changes: ChangeTrackingState) => {
    if (!enableAuditLogging || !eventRequestId || !auth.currentUser) return;

    try {
      const userName = await EventAuditService.getUserName(
        auth.currentUser.uid,
      );

      // Log field changes
      if (changes.fieldChanges.length > 0) {
        const fieldChanges = changes.fieldChanges.map((change) => ({
          field: change.field,
          fieldDisplayName: change.label,
          oldValue: change.oldValue,
          newValue: change.newValue,
          changeType: "updated" as const,
        }));

        await EventAuditService.logEventUpdate(
          eventRequestId,
          userName,
          fieldChanges,
          userName,
        );
      }

      // Log file changes
      if (changes.fileChanges.length > 0) {
        const fileChanges = changes.fileChanges.map((change) => ({
          action: change.type === "replaced" ? "added" : change.type,
          fileName: change.filename,
          fileType: change.field.includes("roomBooking")
            ? ("room_booking" as const)
            : change.field.includes("invoice")
              ? ("invoice" as const)
              : change.field.includes("logo")
                ? ("logo" as const)
                : change.field.includes("graphics")
                  ? ("graphics" as const)
                  : ("other" as const),
        }));

        await EventAuditService.logFileUpload(
          eventRequestId,
          userName,
          fileChanges,
          userName,
        );
      }

      // Log invoice changes
      if (changes.invoiceChanges.length > 0) {
        const invoiceFieldChanges = changes.invoiceChanges.map((change) => ({
          field: change.field,
          fieldDisplayName: `Invoice ${change.invoiceId} - ${change.field}`,
          oldValue: change.oldValue,
          newValue: change.newValue,
          changeType:
            change.type === "added"
              ? ("added" as const)
              : change.type === "removed"
                ? ("removed" as const)
                : ("updated" as const),
        }));

        await EventAuditService.logInvoiceEdit(
          eventRequestId,
          userName,
          invoiceFieldChanges,
          userName,
        );
      }
    } catch (error) {
      console.error("Error logging changes to audit:", error);
    }
  };

  // Debounced change detection
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const fieldChanges = detectFieldChanges();
      const fileChanges = detectFileChanges();
      const invoiceChanges = detectInvoiceChanges();

      const newChangeState: ChangeTrackingState = {
        fieldChanges,
        fileChanges,
        invoiceChanges,
        hasChanges:
          fieldChanges.length > 0 ||
          fileChanges.length > 0 ||
          invoiceChanges.length > 0,
        lastChangeTimestamp: new Date(),
      };

      setChangeState(newChangeState);

      // Log changes if there are any
      if (newChangeState.hasChanges) {
        logChangesToAudit(newChangeState);
      }

      previousDataRef.current = currentData;
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [
    currentData,
    originalData,
    debounceMs,
    enableAuditLogging,
    eventRequestId,
  ]);

  return {
    ...changeState,
    resetChanges: () =>
      setChangeState({
        fieldChanges: [],
        fileChanges: [],
        invoiceChanges: [],
        hasChanges: false,
      }),
  };
}
