/**
 * Event View Modal Components
 * 
 * This module exports all components and utilities for the EventViewModal.
 * The main EventViewModal component has been refactored into smaller, 
 * more maintainable components organized by functionality.
 */

// Tab Components
export { default as EventDetailsTab } from './EventDetailsTab';
export { default as FilesGraphicsTab } from './FilesGraphicsTab';
export { default as FundingInvoicesTab } from './FundingInvoicesTab';
export { default as AttendeesTab } from './AttendeesTab';
export { default as ActivityHistoryTab } from './ActivityHistoryTab';

// Reusable Components
export { default as AttendeeTable } from './AttendeeTable';
export { default as InvoiceTabContent } from './InvoiceTabContent';
export { default as ReviewFeedbackModal } from './ReviewFeedbackModal';

// Utilities
export * from './utils';

// Types
export * from './types';
