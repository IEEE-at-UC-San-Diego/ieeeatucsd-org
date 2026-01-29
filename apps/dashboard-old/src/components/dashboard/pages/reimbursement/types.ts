export interface ReimbursementFormData {
  title: string;
  department: string;
  paymentMethod: string;
  additionalInfo: string;
  businessPurpose: string;
}

export interface LineItem {
  id: string;
  description: string;
  category: string;
  amount: number;
  quantity?: number;
}

export interface ReimbursementReceipt {
  id: string;
  vendorName: string;
  location: string;
  dateOfPurchase: string;
  lineItems: LineItem[];
  receiptFile?: {
    url: string;
    name: string;
    size: number;
    type: string;
  };
  notes?: string;
  subtotal: number;
  tax?: number;
  tip?: number;
  shipping?: number;
  otherCharges?: number;
  total: number;
}

export interface AIReceiptResponse {
  vendorName: string;
  location: string;
  dateOfPurchase: string;
  lineItems: {
    description: string;
    category: string;
    amount: number;
    quantity?: number;
  }[];
  subtotal: number;
  tax?: number;
  tip?: number;
  shipping?: number;
  otherCharges?: number;
  total: number;
}

export const DEPARTMENTS = [
  { value: "general", label: "General" },
  { value: "internal", label: "Internal" },
  { value: "projects", label: "Projects" },
  { value: "events", label: "Events" },
  { value: "other", label: "Other" },
];

export const EXPENSE_CATEGORIES = [
  "Food & Beverages",
  "Transportation",
  "Materials & Supplies",
  "Registration Fees",
  "Equipment",
  "Software/Subscriptions",
  "Printing/Marketing",
  "Other",
];

export const PAYMENT_METHODS = [
  "Credit Card",
  "Debit Card",
  "Cash",
  "Venmo",
  "Zelle",
  "PayPal",
  "Check",
  "Other",
];
