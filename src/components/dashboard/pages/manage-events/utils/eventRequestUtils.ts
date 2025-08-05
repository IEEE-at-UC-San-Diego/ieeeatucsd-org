import type {
  InvoiceFormData,
  ItemizedInvoiceItem,
} from "../types/EventRequestTypes";

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
    return date.toISOString().split("T")[0];
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
    return date.toISOString().slice(0, 16); // Format for datetime-local input
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
    const dateTime = new Date(`${date}T${time}`);
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
    const dateTime = new Date(`${date}T${time}`);
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
