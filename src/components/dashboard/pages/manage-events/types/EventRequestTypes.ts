export interface EventRequestModalProps {
    onClose: () => void;
    editingRequest?: any | null;
    onSuccess?: () => void;
}

export interface ItemizedInvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface InvoiceFormData {
    id: string;
    vendor: string;
    items: ItemizedInvoiceItem[];
    tax: number;
    tip: number;
    invoiceFile: File | null;
    existingInvoiceFile: string;
}

export interface EventFormData {
    name: string;
    location: string;
    startDate: string;
    startTime: string;
    endTime: string;
    eventDescription: string;
    department: string;
    eventCode: string;
    pointsToReward: number;
    flyersNeeded: boolean;
    flyerType: string[];
    otherFlyerType: string;
    flyerAdvertisingStartDate: string;
    flyerAdditionalRequests: string;
    flyersCompleted: boolean;
    photographyNeeded: boolean;
    requiredLogos: string[];
    otherLogos: string[];
    otherLogoFiles: File[];
    advertisingFormat: string;
    additionalSpecifications: string;
    hasRoomBooking: boolean;
    roomBookingFile: File | null;
    expectedAttendance: string;
    servingFoodDrinks: boolean;
    needsAsFunding: boolean;
    invoices: InvoiceFormData[];
    needsGraphics: boolean;
    // Existing files for editing
    existingRoomBookingFiles: string[];
    existingOtherLogos: string[];
    // Legacy fields for backward compatibility
    itemizedInvoice: ItemizedInvoiceItem[];
    invoiceTax: number;
    invoiceTip: number;
    invoiceVendor: string;
    invoice: File | null;
    invoiceFiles: File[];
    existingInvoiceFiles: string[];
    existingInvoiceFile: string;
}

export interface FieldError {
    [key: string]: boolean;
}

export interface InvoiceTabState {
    [key: string]: 'details' | 'import';
}

export interface JsonImportData {
    [key: string]: string;
}

export const flyerTypes = [
    'Digital flyer (with social media advertising: Facebook, Instagram, Discord)',
    'Digital flyer (with NO social media advertising)',
    'Physical flyer (for posting around campus)',
    'Social media graphics (Instagram story, post, etc.)',
    'Email newsletter graphics',
    'Website banner',
    'Other (please specify in additional requests)'
];

export const logoTypes = [
    'IEEE', 
    'AS (required if funded by AS)', 
    'HKN', 
    'TESC', 
    'PIB', 
    'TNT', 
    'SWE', 
    'OTHER (please upload transparent logo files)'
];

export const formatTypes = ['PDF', 'JPEG', 'PNG', "Doesn't Matter"];

export const eventTypes = ['social', 'technical', 'outreach', 'professional', 'projects', 'other'];

export const departmentOptions = [
    'General',
    'Technical',
    'Social',
    'Outreach',
    'Professional',
    'Projects'
];
