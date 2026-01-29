import type {
  InvoiceFormData,
  ItemizedInvoiceItem,
} from "../types/EventRequestTypes";
import { flexibleTimeParser } from './timeParser';

export const createNewInvoice = (): InvoiceFormData => ({
  id: `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  vendor: "",
  items: [{ description: "", quantity: 1, unitPrice: 0, total: 0 }],
  tax: 0,
  tip: 0,
  invoiceFiles: [],
  existingInvoiceFiles: [],
  // Legacy fields for backward compatibility
  invoiceFile: null,
  existingInvoiceFile: "",
});

export const calculateBudget = (attendance: number) => {
  const perPersonCost = 10;
  const maxBudget = 5000;
  const calculatedBudget = attendance * perPersonCost;
  const actualBudget = Math.min(calculatedBudget, maxBudget);

  return {
    perPersonCost,
    calculatedBudget,
    actualBudget,
    maxBudget,
    isAtMax: calculatedBudget >= maxBudget,
  };
};

export const generateEventCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const formatTimeTo12H = (time24: string) => {
  try {
    if (!time24) return "";
    const [hours, minutes] = time24.split(":");
    if (!hours || !minutes) return time24; // Return original if parsing fails
    const hour = parseInt(hours);
    if (isNaN(hour)) return time24;
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  } catch (error) {
    console.warn("Error formatting time:", error);
    return time24 || ""; // Return original time or empty string
  }
};

export const extractFileName = (url: string) => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split("/").pop();
    if (filename && filename.includes("_")) {
      return filename.substring(filename.indexOf("_") + 1);
    }
    return filename || "Unknown file";
  } catch (error) {
    console.warn("Error extracting filename:", error);
    return "Unknown file";
  }
};

// Local date formatting helpers to avoid UTC-induced off-by-one issues
const pad2 = (n: number) => n.toString().padStart(2, "0");
const formatLocalDate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const formatLocalDateMDY = (d: Date) =>
  `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`;
const formatLocalDateTime = (d: Date) =>
  `${formatLocalDate(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export const safeGetTimeString = (timestamp: any) => {
  try {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return date.toTimeString().slice(0, 5);
  } catch (error) {
    console.warn("Error parsing time:", error);
    return "";
  }
};

export const safeGetDateString = (timestamp: any) => {
  try {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    // Use local date to avoid UTC off-by-one
    return formatLocalDate(date);
  } catch (error) {
    console.warn("Error parsing date:", error);
    return "";
  }
};

export const safeGetDateInputString = (timestamp: any) => {
  try {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    return formatLocalDateMDY(date);
  } catch (error) {
    console.warn("Error parsing date:", error);
    return "";
  }
};

export const safeGetDateTimeString = (timestamp: any) => {
  try {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return "";
    // Use local date-time to avoid UTC shifting
    return formatLocalDateTime(date);
  } catch (error) {
    console.warn("Error parsing datetime:", error);
    return "";
  }
};

export const createSafeDateTime = (date: string, time: string) => {
  try {
    if (!date || !time) {
      throw new Error("Date and time are required");
    }
    const [y, m, d] = date.split("-").map((v) => parseInt(v, 10));
    const [hh, mm] = time.split(":").map((v) => parseInt(v, 10));
    if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) {
      throw new Error("Invalid date format");
    }
    const hours = isNaN(hh) ? 0 : hh;
    const minutes = isNaN(mm) ? 0 : mm;
    // Construct local Date to avoid timezone offset issues
    const dateTime = new Date(y, m - 1, d, hours, minutes, 0, 0);
    if (isNaN(dateTime.getTime())) {
      throw new Error("Invalid date/time combination");
    }
    return dateTime;
  } catch (error) {
    console.error("Error creating date/time:", error);
    throw error;
  }
};

export const createSafeDisplayDateTime = (date: string, time: string) => {
  try {
    if (!date || !time) return null;
    const [y, m, d] = date.split("-").map((v) => parseInt(v, 10));
    const [hh, mm] = time.split(":").map((v) => parseInt(v, 10));
    const hours = isNaN(hh) ? 0 : hh;
    const minutes = isNaN(mm) ? 0 : mm;
    const dateTime = new Date(y, m - 1, d, hours, minutes, 0, 0);
    if (isNaN(dateTime.getTime())) return null;
    return dateTime;
  } catch (error) {
    console.warn("Error creating display date/time:", error);
    return null;
  }
};

export const convertLegacyInvoices = (
  editingRequest: any,
): InvoiceFormData[] => {
  const invoices: InvoiceFormData[] = [];

  // Check if there's new format (multiple invoices)
  if (editingRequest.invoices && editingRequest.invoices.length > 0) {
    return editingRequest.invoices.map((invoice: any) => ({
      id:
        invoice.id ||
        `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      vendor: invoice.vendor || "",
      items: invoice.items || [],
      tax: invoice.tax || 0,
      tip: invoice.tip || 0,
      invoiceFiles: [],
      existingInvoiceFiles:
        invoice.invoiceFiles ||
        (invoice.invoiceFile ? [invoice.invoiceFile] : []),
      // Legacy fields for backward compatibility
      invoiceFile: null,
      existingInvoiceFile: invoice.invoiceFile || "",
    }));
  }

  // Convert legacy format (single invoice)
  if (
    editingRequest.itemizedInvoice &&
    editingRequest.itemizedInvoice.length > 0
  ) {
    const legacyInvoiceFile =
      editingRequest.invoiceFile || editingRequest.existingInvoiceFile || "";
    invoices.push({
      id: `invoice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      vendor: editingRequest.invoiceVendor || "",
      items: editingRequest.itemizedInvoice,
      tax: editingRequest.invoiceTax || 0,
      tip: editingRequest.invoiceTip || 0,
      invoiceFiles: [],
      existingInvoiceFiles: legacyInvoiceFile ? [legacyInvoiceFile] : [],
      // Legacy fields for backward compatibility
      invoiceFile: null,
      existingInvoiceFile: legacyInvoiceFile,
    });
  }

  return invoices;
};

export const calculateInvoiceSubtotal = (items: ItemizedInvoiceItem[]) => {
  return items.reduce((sum, item) => sum + item.total, 0);
};

export const calculateInvoiceTotal = (
  items: ItemizedInvoiceItem[],
  tax: number,
  tip: number,
) => {
  const subtotal = calculateInvoiceSubtotal(items);
  return subtotal + tax + tip;
};

export const calculateGrandTotal = (invoices: InvoiceFormData[]) => {
  return invoices.reduce((grandTotal, invoice) => {
    const subtotal = calculateInvoiceSubtotal(invoice.items);
    return grandTotal + subtotal + invoice.tax + invoice.tip;
  }, 0);
};

/**
 * Parse various date formats to YYYY-MM-DD
 * Supported formats:
 * - MM/DD/YYYY, MM/DD/YY (US format, default for ambiguous cases)
 * - DD/MM/YYYY, DD/MM/YY (International format)
 * - MMDDYYYY, MMDDYY (without slashes)
 *
 * Examples:
 * - "12/25/2023" -> "2023-12-25"
 * - "25/12/2023" -> "2023-12-25"
 * - "12/25/23" -> "2023-12-25"
 * - "12252023" -> "2023-12-25"
 *
 * For ambiguous dates (e.g., 01/02/2023), defaults to MM/DD/YYYY interpretation.
 *
 * @param dateString - Date in various supported formats
 * @returns Date in YYYY-MM-DD format or empty string if invalid
 */
export const parseDateMMDDYY = (dateString: string): string => {
  try {
    if (!dateString || typeof dateString !== 'string') {
      return "";
    }

    const trimmed = dateString.trim();
    
    // Check if input has slashes
    const hasSlashes = trimmed.includes("/");
    
    let month: number, day: number, year: number;
    
    if (hasSlashes) {
      // Split by slashes and validate format
      const parts = trimmed.split("/");
      if (parts.length !== 3) {
        return "";
      }
      
      // Parse numeric values
      const num1 = parseInt(parts[0], 10);
      const num2 = parseInt(parts[1], 10);
      const num3 = parseInt(parts[2], 10);
      
      // Validate all parts are numbers
      if (isNaN(num1) || isNaN(num2) || isNaN(num3)) {
        return "";
      }
      
      // Determine year (could be 2 or 4 digits)
      let fullYear: number;
      if (parts[2].length === 2) {
        // 2-digit year: assume 20xx for 00-50, 19xx for 51-99
        fullYear = num3 <= 50 ? 2000 + num3 : 1900 + num3;
      } else if (parts[2].length === 4) {
        fullYear = num3;
      } else {
        return ""; // Invalid year length
      }
      
      // Validate year range
      if (fullYear < 1900 || fullYear > 2100) {
        return "";
      }
      
      // Determine if DD/MM or MM/DD format
      // Strategy: If first number is > 12, must be DD/MM format
      // Otherwise, check if valid in MM/DD format first (US default)
      let isMMDD = true;
      
      if (num1 > 12) {
        // Must be DD/MM format since month can't be > 12
        isMMDD = false;
      } else if (num2 > 12) {
        // Must be MM/DD format since day in second position can't be month
        isMMDD = true;
      } else {
        // Ambiguous case (both numbers <= 12)
        // Default to MM/DD (US format) but try to validate
        // First try MM/DD interpretation
        const testDate = new Date(fullYear, num1 - 1, num2);
        if (
          testDate.getFullYear() === fullYear &&
          testDate.getMonth() === num1 - 1 &&
          testDate.getDate() === num2
        ) {
          isMMDD = true;
        } else {
          // MM/DD didn't work, try DD/MM
          isMMDD = false;
        }
      }
      
      if (isMMDD) {
        month = num1;
        day = num2;
      } else {
        day = num1;
        month = num2;
      }
      
      year = fullYear;
    } else {
      // No slashes - MMDDYYYY or MMDDYY format
      const cleaned = trimmed.replace(/\D/g, "");
      
      if (cleaned.length === 8) {
        // MMDDYYYY format
        month = parseInt(cleaned.substring(0, 2), 10);
        day = parseInt(cleaned.substring(2, 4), 10);
        year = parseInt(cleaned.substring(4, 8), 10);
      } else if (cleaned.length === 6) {
        // MMDDYY format
        month = parseInt(cleaned.substring(0, 2), 10);
        day = parseInt(cleaned.substring(2, 4), 10);
        const yy = parseInt(cleaned.substring(4, 6), 10);
        // Assume 20xx for 00-50, 19xx for 51-99
        year = yy <= 50 ? 2000 + yy : 1900 + yy;
      } else {
        return ""; // Invalid length
      }
    }

    // Validate month (1-12)
    if (month < 1 || month > 12) {
      return "";
    }

    // Validate day (1-31)
    if (day < 1 || day > 31) {
      return "";
    }

    // Validate year range
    if (year < 1900 || year > 2100) {
      return "";
    }

    // Validate the date is real (e.g., not Feb 30)
    const dateObj = new Date(year, month - 1, day);
    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getDate() !== day
    ) {
      return "";
    }

    // Return in YYYY-MM-DD format with zero-padded month and day
    const paddedMonth = month.toString().padStart(2, "0");
    const paddedDay = day.toString().padStart(2, "0");
    return `${year}-${paddedMonth}-${paddedDay}`;
  } catch (error) {
    console.warn("Error parsing date:", error);
    return "";
  }
};

/**
 * Parse shorthand time notation to HH:MM format (24-hour)
 * Examples: "9a" -> "09:00", "10p" -> "22:00", "1230p" -> "12:30"
 * @param timeString - Time in shorthand notation (e.g., "9a", "10p", "1230p")
 * @returns Time in HH:MM format or empty string if invalid
 */
/**
 * Parse shorthand time notation to HH:MM format (24-hour)
 * Examples: "9a" -> "09:00", "10p" -> "22:00", "1230p" -> "12:30"
 * @param timeString - Time in shorthand notation (e.g., "9a", "10p", "1230p")
 * @returns Time in HH:MM format or empty string if invalid
 *
 * @deprecated Use flexibleTimeParser.parseSingleTime() instead for more features
 */
export const parseTimeShorthand = (timeString: string): string => {
  // Use new parser for backward compatibility
  const result = flexibleTimeParser.parseSingleTime(timeString);
  
  // Return empty string for invalid (maintaining current behavior)
  if (!result.isValid || !result.time) {
    return "";
  }
  
  // Return 24-hour format (maintaining current behavior)
  return result.time.time24;
};

// Export the new flexible parser for enhanced functionality
export { flexibleTimeParser } from './timeParser';
