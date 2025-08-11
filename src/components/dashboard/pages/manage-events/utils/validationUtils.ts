import type { EventFormData, FieldError } from "../types/EventRequestTypes";

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
  }

  if (!formData.startTime) {
    errors.startTime = true;
    errorMessages.push("Start time is required");
  }

  if (!formData.endTime) {
    errors.endTime = true;
    errorMessages.push("End time is required");
  }

  if (!formData.eventDescription) {
    errors.eventDescription = true;
    errorMessages.push("Event description is required");
  }

  // Validate end time is after start time
  if (formData.startDate && formData.startTime && formData.endTime) {
    const startDateTime = new Date(
      `${formData.startDate}T${formData.startTime}`,
    );
    const endDateTime = new Date(`${formData.startDate}T${formData.endTime}`);
    if (endDateTime <= startDateTime) {
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

    if (!formData.flyerAdvertisingStartDate) {
      errorMessage =
        "Advertising start date is required when graphics are needed";
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
