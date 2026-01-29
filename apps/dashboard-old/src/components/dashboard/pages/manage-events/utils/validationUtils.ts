import type { EventFormData, FieldError } from "../types/EventRequestTypes";
import { parseDateMMDDYY } from "./eventRequestUtils";

export interface ValidationResult {
  isValid: boolean;
  errors: FieldError;
  errorMessage?: string;
}

export const validateBasicInformation = (
  formData: EventFormData,
): ValidationResult => {
  const errors: FieldError = {};
  const errorMessages: string[] = [];

  if (!formData.name) {
    errors.name = true;
    errorMessages.push("Event name is required");
  }

  if (!formData.location) {
    errors.location = true;
    errorMessages.push("Location is required");
  }

  if (!formData.startDate) {
    errors.startDate = true;
    errorMessages.push("Start date is required");
  } else {
    const parsedDate = parseDateMMDDYY(formData.startDate);
    if (!parsedDate) {
      errors.startDate = true;
      errorMessages.push(
        "Invalid date format. Use MM/DD/YYYY, DD/MM/YYYY, MM/DD/YY, or MMDDYYYY (e.g., 12/25/2023, 25/12/23)",
      );
    }
  }

  // Time validation - both startTime and endTime should be populated
  // They are stored as 24-hour format times (e.g., "09:00", "22:00")
  // The UI ensures they come from a time range input
  if (!formData.startTime) {
    errors.startTime = true;
    errorMessages.push("Start time is required");
  }

  if (!formData.endTime) {
    errors.endTime = true;
    errorMessages.push("End time is required");
  }

  // Validate that both times are in valid HH:MM format
  const timeFormatRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

  if (formData.startTime && !timeFormatRegex.test(formData.startTime)) {
    errors.startTime = true;
    errorMessages.push(
      'Invalid start time format. Please enter a time range (e.g., "10am-2pm")',
    );
  }

  if (formData.endTime && !timeFormatRegex.test(formData.endTime)) {
    errors.endTime = true;
    errorMessages.push(
      'Invalid end time format. Please enter a time range (e.g., "10am-2pm")',
    );
  }

  if (!formData.eventDescription) {
    errors.eventDescription = true;
    errorMessages.push("Event description is required");
  }

  // Cross-field time validation
  // Validate that end time is after start time
  if (
    formData.startTime &&
    formData.endTime &&
    timeFormatRegex.test(formData.startTime) &&
    timeFormatRegex.test(formData.endTime)
  ) {
    const [startHour, startMinute] = formData.startTime.split(":").map(Number);
    const [endHour, endMinute] = formData.endTime.split(":").map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (endMinutes <= startMinutes) {
      errors.endTime = true;
      errorMessages.push("End time must be after start time");
    }
  }

  return {
    isValid: errorMessages.length === 0,
    errors,
    errorMessage:
      errorMessages.length > 0 ? errorMessages.join(", ") : undefined,
  };
};

export const validateMarketingGraphics = (
  formData: EventFormData,
): ValidationResult => {
  const errors: FieldError = {};
  let errorMessage = "";

  if (formData.needsGraphics) {
    if (formData.flyerType.length === 0) {
      errorMessage =
        "Please select at least one flyer type when graphics are needed";
      return { isValid: false, errors, errorMessage };
    }

    if (
      formData.flyerType.includes(
        "Other (please specify in additional requests)",
      ) &&
      !formData.otherFlyerType
    ) {
      errorMessage = "Please specify the other flyer type";
      return { isValid: false, errors, errorMessage };
    }

    if (formData.requiredLogos.length === 0) {
      errorMessage =
        "Please select at least one required logo when graphics are needed";
      return { isValid: false, errors, errorMessage };
    }

    if (
      formData.requiredLogos.includes(
        "OTHER (please upload transparent logo files)",
      ) &&
      formData.otherLogoFiles.length === 0 &&
      (formData.existingOtherLogos || []).length === 0
    ) {
      errorMessage = 'Please upload logo files when "OTHER" is selected';
      return { isValid: false, errors, errorMessage };
    }

    if (!formData.advertisingFormat) {
      errorMessage =
        "Please select an advertising format when graphics are needed";
      return { isValid: false, errors, errorMessage };
    }
  }

  return { isValid: true, errors };
};

export const validateLogistics = (
  formData: EventFormData,
): ValidationResult => {
  const errors: FieldError = {};
  let errorMessage = "";

  // Room booking validation
  if (
    formData.hasRoomBooking === undefined ||
    formData.hasRoomBooking === null
  ) {
    errorMessage = "Please answer whether you have a room booking";
    return { isValid: false, errors, errorMessage };
  }

  if (
    formData.hasRoomBooking &&
    !formData.roomBookingFile &&
    formData.existingRoomBookingFiles.length === 0
  ) {
    errorMessage = "Please upload room booking confirmation";
    return { isValid: false, errors, errorMessage };
  }

  // File size validation
  if (formData.roomBookingFile && formData.roomBookingFile.size > 1024 * 1024) {
    errorMessage = "Room booking file must be under 1MB";
    return { isValid: false, errors, errorMessage };
  }

  // Attendance validation
  if (!formData.expectedAttendance) {
    errorMessage = "Expected attendance is required";
    return { isValid: false, errors, errorMessage };
  }

  // Validate that attendance is a positive integer
  const attendanceValue = parseInt(formData.expectedAttendance);
  if (
    isNaN(attendanceValue) ||
    attendanceValue <= 0 ||
    !Number.isInteger(attendanceValue) ||
    formData.expectedAttendance.includes(".")
  ) {
    errorMessage =
      "Expected attendance must be a positive integer (no decimals or negative numbers)";
    return { isValid: false, errors, errorMessage };
  }

  // Food/drinks validation
  if (
    formData.servingFoodDrinks === undefined ||
    formData.servingFoodDrinks === null
  ) {
    errorMessage = "Please answer whether you will be serving food or drinks";
    return { isValid: false, errors, errorMessage };
  }

  // Only validate AS funding if they're serving food/drinks
  if (
    formData.servingFoodDrinks &&
    (formData.needsAsFunding === undefined || formData.needsAsFunding === null)
  ) {
    errorMessage = "Please answer whether you need AS funding";
    return { isValid: false, errors, errorMessage };
  }

  return { isValid: true, errors };
};

export const validateFunding = (formData: EventFormData): ValidationResult => {
  const errors: FieldError = {};
  let errorMessage = "";

  if (formData.needsAsFunding) {
    if (formData.invoices.length === 0) {
      errorMessage =
        "Please add at least one invoice when requesting AS funding";
      return { isValid: false, errors, errorMessage };
    }

    // Validate each invoice
    for (let i = 0; i < formData.invoices.length; i++) {
      const invoice = formData.invoices[i];
      const invoiceNum = i + 1;

      if (!invoice.vendor.trim()) {
        errorMessage = `Invoice #${invoiceNum}: Vendor/Restaurant is required`;
        return { isValid: false, errors, errorMessage };
      }

      // Check if invoice has either new files or existing files
      const hasNewFiles =
        (invoice.invoiceFiles && invoice.invoiceFiles.length > 0) ||
        (invoice.invoiceFile !== null && invoice.invoiceFile !== undefined);
      const hasExistingFiles =
        (invoice.existingInvoiceFiles &&
          invoice.existingInvoiceFiles.length > 0) ||
        (invoice.existingInvoiceFile &&
          invoice.existingInvoiceFile.trim() !== "");

      // Debug logging for invoice file validation
      console.log(`Invoice #${invoiceNum} validation:`, {
        invoiceId: invoice.id,
        hasNewFiles,
        hasExistingFiles,
        invoiceFiles: invoice.invoiceFiles,
        existingInvoiceFiles: invoice.existingInvoiceFiles,
        // Legacy fields
        invoiceFile: invoice.invoiceFile,
        existingInvoiceFile: invoice.existingInvoiceFile,
      });

      if (!hasNewFiles && !hasExistingFiles) {
        errorMessage = `Invoice #${invoiceNum}: At least one invoice file is required when requesting AS funding`;
        return { isValid: false, errors, errorMessage };
      }

      if (invoice.items.length === 0) {
        errorMessage = `Invoice #${invoiceNum}: Please add at least one item`;
        return { isValid: false, errors, errorMessage };
      }

      // Validate each item
      for (let j = 0; j < invoice.items.length; j++) {
        const item = invoice.items[j];
        const itemNum = j + 1;

        if (!item.description.trim()) {
          errorMessage = `Invoice #${invoiceNum}, Item #${itemNum}: Description is required`;
          return { isValid: false, errors, errorMessage };
        }

        if (item.quantity <= 0) {
          errorMessage = `Invoice #${invoiceNum}, Item #${itemNum}: Quantity must be greater than 0`;
          return { isValid: false, errors, errorMessage };
        }

        if (item.unitPrice < 0) {
          errorMessage = `Invoice #${invoiceNum}, Item #${itemNum}: Unit price cannot be negative`;
          return { isValid: false, errors, errorMessage };
        }
      }

      // Validate tax and tip are not negative
      if (invoice.tax < 0) {
        errorMessage = `Invoice #${invoiceNum}: Tax cannot be negative`;
        return { isValid: false, errors, errorMessage };
      }

      if (invoice.tip < 0) {
        errorMessage = `Invoice #${invoiceNum}: Tip cannot be negative`;
        return { isValid: false, errors, errorMessage };
      }
    }
  }

  return { isValid: true, errors };
};

export const validateStep = (
  step: number,
  formData: EventFormData,
): ValidationResult => {
  switch (step) {
    case 0: // Important Information (requirements) - no validation needed
      return { isValid: true, errors: {} };

    case 1: // Basic Information
      return validateBasicInformation(formData);

    case 2: // Marketing & Graphics
      return validateMarketingGraphics(formData);

    case 3: // Logistics
      return validateLogistics(formData);

    case 4: // Funding (if needed) or Review & Submit
      if (formData.needsAsFunding) {
        return validateFunding(formData);
      } else {
        // This is the review step - no additional validation needed
        return { isValid: true, errors: {} };
      }

    case 5: // Review & Submit (when funding step is present)
      return { isValid: true, errors: {} };

    default:
      return { isValid: true, errors: {} };
  }
};

export const validateCompleteForm = (
  formData: EventFormData,
): ValidationResult => {
  // Run all validations
  const basicValidation = validateBasicInformation(formData);
  if (!basicValidation.isValid) return basicValidation;

  const marketingValidation = validateMarketingGraphics(formData);
  if (!marketingValidation.isValid) return marketingValidation;

  const logisticsValidation = validateLogistics(formData);
  if (!logisticsValidation.isValid) return logisticsValidation;

  const fundingValidation = validateFunding(formData);
  if (!fundingValidation.isValid) return fundingValidation;

  return { isValid: true, errors: {} };
};
