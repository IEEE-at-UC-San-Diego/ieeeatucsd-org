/**
 * PocketBase Collections Schema
 *
 * This file documents the schema for all collections in the PocketBase database.
 * It is based on the interfaces found throughout the codebase.
 */

/**
 * Base interface for all PocketBase records
 */
export interface BaseRecord {
  id: string;
  created: string;
  updated: string;
}

/**
 * Users Collection
 * Represents user accounts in the system
 * Collection ID: _pb_users_auth_
 */
export interface User extends BaseRecord {
  email: string;
  emailVisibility: boolean;
  verified: boolean;
  name: string;
  avatar?: string;
  pid?: string;
  member_id?: string;
  graduation_year?: number;
  major?: string;
  zelle_information?: string;
  last_login?: string;
  notification_preferences?: string; // JSON string of notification settings
  display_preferences?: string; // JSON string of display settings (theme, font size, etc.)
  accessibility_settings?: string; // JSON string of accessibility settings (color blind mode, reduced motion)
}

/**
 * Events Collection
 * Represents events created in the system
 * Collection ID: pbc_1687431684
 */
export interface Event extends BaseRecord {
  event_name: string;
  event_description: string;
  event_code: string;
  location: string;
  files: string[];
  points_to_reward: number;
  start_date: string;
  end_date: string;
  published: boolean;
  has_food: boolean;
  attendees?: AttendeeEntry[];
}

/**
 * Attendee Entry
 * Represents an attendee record for an event
 * This is stored as part of the Event record
 */
export interface AttendeeEntry {
  user_id: string;
  time_checked_in: string;
  food: string;
}

/**
 * Event Requests Collection
 * Represents requests to create new events
 * Collection ID: pbc_1475615553
 */
export interface EventRequest extends BaseRecord {
  name: string;
  location: string;
  start_date_time: string;
  end_date_time: string;
  event_description: string;
  flyers_needed: boolean;
  flyer_type?: string[]; // digital_with_social, digital_no_social, physical_with_advertising, physical_no_advertising, newsletter, other
  other_flyer_type?: string;
  flyer_advertising_start_date?: string;
  flyer_additional_requests?: string;
  photography_needed: boolean;
  required_logos?: string[]; // IEEE, AS, HKN, TESC, PIB, TNT, SWE, OTHER
  other_logos?: string[];
  advertising_format?: string;
  will_or_have_room_booking?: boolean;
  expected_attendance?: number;
  room_booking?: string;
  as_funding_required: boolean;
  food_drinks_being_served: boolean;
  itemized_invoice?: string; // JSON string
  invoice?: string;
  invoice_files?: string[]; // Array of invoice file IDs
  needs_graphics?: boolean;
  needs_as_funding?: boolean;
  status: "submitted" | "pending" | "completed" | "declined";
  requested_user?: string;
}

/**
 * Logs Collection
 * Represents system logs for user actions
 * Collection ID: pbc_3615662572
 */
export interface Log extends BaseRecord {
  user: string; // Relation to User
  type: string; // Standard types: "error", "update", "delete", "create", "login", "logout"
  part: string; // The specific part/section being logged
  message: string;
}

/**
 * Officers Collection
 * Represents officer roles in the organization
 * Collection ID: pbc_1036312343
 */
export interface Officer extends BaseRecord {
  user: string; // Relation to User
  role: string;
  type: "administrator" | "executive" | "general" | "honorary" | "past";
}

/**
 * Reimbursements Collection
 * Represents reimbursement requests
 * Collection ID: pbc_2573806534
 */
export interface Reimbursement extends BaseRecord {
  title: string;
  total_amount: number;
  date_of_purchase: string;
  payment_method: string;
  status:
    | "submitted"
    | "under_review"
    | "approved"
    | "rejected"
    | "in_progress"
    | "paid";
  submitted_by: string; // Relation to User
  additional_info: string;
  receipts: string[]; // Array of Receipt IDs (Relations)
  department: "internal" | "external" | "projects" | "events" | "other";
  audit_notes?: string | null; // JSON string for user-submitted notes
  audit_logs?: string | null; // JSON string for system-generated logs
}

/**
 * Receipts Collection
 * Represents receipt records for reimbursements
 * Collection ID: pbc_1571142587
 */
export interface Receipt extends BaseRecord {
  file: string; // Single file
  created_by: string; // Relation to User
  itemized_expenses: string; // JSON string of ItemizedExpense[]
  tax: number;
  date: string;
  location_name: string;
  location_address: string;
  notes: string;
  audited_by: string; // Relation to User
}

/**
 * Sponsors Collection
 * Represents sponsors of the organization
 * Collection ID: pbc_3665759510
 */
export interface Sponsor extends BaseRecord {
  user: string; // Relation to User
  company: string;
}

/**
 * Itemized Expense
 * Represents an individual expense item in a receipt
 * This is stored as part of the Receipt record as a JSON string
 */
export interface ItemizedExpense {
  description: string;
  category: string;
  amount: number;
}

/**
 * Collection Names
 * Constants for the collection names used in the PocketBase API
 */
export const Collections = {
  USERS: "users",
  EVENTS: "events",
  EVENT_REQUESTS: "event_request",
  LOGS: "logs",
  OFFICERS: "officers",
  REIMBURSEMENTS: "reimbursement",
  RECEIPTS: "receipts",
  SPONSORS: "sponsors",
};

/**
 * Flyer Type Options
 * Constants for the flyer type options used in event requests
 */
export const FlyerTypes = {
  DIGITAL_WITH_SOCIAL: "digital_with_social",
  DIGITAL_NO_SOCIAL: "digital_no_social",
  PHYSICAL_WITH_ADVERTISING: "physical_with_advertising",
  PHYSICAL_NO_ADVERTISING: "physical_no_advertising",
  NEWSLETTER: "newsletter",
  OTHER: "other",
};

/**
 * Logo Options
 * Constants for the logo options used in event requests
 */
export const LogoOptions = {
  IEEE: "IEEE",
  AS: "AS",
  HKN: "HKN",
  TESC: "TESC",
  PIB: "PIB",
  TNT: "TNT",
  SWE: "SWE",
  OTHER: "OTHER",
};

/**
 * Event Request Status Options
 * Constants for the status options used in event requests
 */
export const EventRequestStatus = {
  SUBMITTED: "submitted",
  PENDING: "pending",
  COMPLETED: "completed",
  DECLINED: "declined",
};

/**
 * Officer Type Options
 * Constants for the officer type options
 */
export const OfficerTypes = {
  ADMINISTRATOR: "administrator",
  EXECUTIVE: "executive",
  GENERAL: "general",
  HONORARY: "honorary",
  PAST: "past",
};
