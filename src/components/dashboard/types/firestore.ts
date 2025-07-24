import type { Timestamp } from 'firebase/firestore';

export type UserRole = 
  | 'Member'
  | 'General Officer'
  | 'Executive Officer'
  | 'Member at Large'
  | 'Past Officer'
  | 'Sponsor';

export interface User {
  email: string;
  emailVisibility: boolean;
  verified: boolean;
  name: string;
  username?: string;
  avatar?: string;
  pid?: string;
  memberId?: string;
  graduationYear?: number;
  major?: string;
  zelleInformation?: string;
  lastLogin?: Timestamp;
  notificationPreferences: Record<string, unknown>;
  displayPreferences: Record<string, unknown>;
  accessibilitySettings: Record<string, unknown>;
  resume?: string;
  signedUp: boolean;
  requestedEmail: boolean;
  role: UserRole;
  position?: string; // Specific position like "Webmaster", "President", etc.
  status: 'active' | 'inactive' | 'suspended';
  joinDate: Timestamp;
  eventsAttended?: number;
  points?: number;
  invitedBy?: string; // uid of the user who invited them
  inviteAccepted?: Timestamp; // when they accepted the invite
}

export interface PublicProfile {
  name: string;
  major: string;
  points: number;
  totalEventsAttended: number;
}

export interface Event {
  eventName: string;
  eventDescription: string;
  eventCode: string;
  location: string;
  files: string[];
  pointsToReward: number;
  startDate: Timestamp;
  endDate: Timestamp;
  published: boolean;
  eventType: 'social' | 'technical' | 'outreach' | 'professional' | 'projects' | 'other';
  hasFood: boolean;
}

export interface Attendee {
  userId: string;
  timeCheckedIn: Timestamp;
  food: string;
  pointsEarned: number;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  vendor: string;
  items: InvoiceItem[];
  tax: number;
  tip: number;
  invoiceFile?: string;
  additionalFiles: string[];
  subtotal: number;
  total: number;
}

export interface EventRequest {
  name: string;
  location: string;
  startDateTime: Timestamp;
  endDateTime: Timestamp;
  eventDescription: string;
  flyersNeeded: boolean;
  flyerType: string[];
  otherFlyerType?: string;
  flyerAdvertisingStartDate?: Timestamp;
  flyerAdditionalRequests?: string;
  flyersCompleted: boolean;
  photographyNeeded: boolean;
  requiredLogos: string[];
  otherLogos?: string[];
  advertisingFormat?: string;
  willOrHaveRoomBooking: boolean;
  expectedAttendance?: number;
  roomBookingFiles: string[];
  asFundingRequired: boolean;
  foodDrinksBeingServed: boolean;
  // Updated to support multiple invoices
  invoices: Invoice[];
  // Keep legacy fields for backward compatibility
  itemizedInvoice?: { description: string; quantity: number; unitPrice: number; total: number; }[];
  invoice?: string;
  invoiceFiles?: string[];
  needsGraphics: boolean;
  needsAsFunding: boolean;
  status: 'submitted' | 'pending' | 'completed' | 'declined';
  declinedReason?: string;
  requestedUser: string;
}

export interface Log {
  userId: string;
  type: 'error' | 'update' | 'delete' | 'create' | 'login' | 'logout';
  part: string;
  message: string;
  created: Timestamp;
}

export interface Officer {
  userId: string;
  role: string;
  type: 'administrator' | 'executive' | 'general' | 'honorary' | 'past';
}

export interface Reimbursement {
  title: string;
  totalAmount: number;
  dateOfPurchase: Timestamp;
  paymentMethod: string;
  status: 'submitted' | 'declined' | 'approved' | 'paid';
  submittedBy: string;
  additionalInfo: string;
  department: 'internal' | 'external' | 'projects' | 'events' | 'other';
  auditNotes?: { note: string; createdBy: string; timestamp: Timestamp; }[];
  auditLogs?: { action: string; createdBy: string; timestamp: Timestamp; }[];
  auditRequests?: { 
    auditorId: string; 
    requestedBy: string; 
    requestedAt: Timestamp; 
    status: 'pending' | 'completed' | 'declined';
    auditResult?: 'approved' | 'needs_changes';
    auditNotes?: string;
    completedAt?: Timestamp;
  }[];
  requiresExecutiveOverride?: boolean;
}

export interface Receipt {
  file: string;
  createdBy: string;
  itemizedExpenses: { description: string; category: string; amount: number; }[];
  tax: number;
  date: Timestamp;
  locationName: string;
  locationAddress: string;
  notes: string;
  auditedBy: string;
}

export interface Sponsor {
  userId: string;
  company: string;
} 