/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as ai from "../ai.js";
import type * as constitutions from "../constitutions.js";
import type * as crons from "../crons.js";
import type * as directOnboardings from "../directOnboardings.js";
import type * as eventTimeRange from "../eventTimeRange.js";
import type * as events from "../events.js";
import type * as fundDeposits from "../fundDeposits.js";
import type * as fundRequests from "../fundRequests.js";
import type * as googleCalendar from "../googleCalendar.js";
import type * as googleCalendarEventUtils from "../googleCalendarEventUtils.js";
import type * as googleCalendarIds from "../googleCalendarIds.js";
import type * as googleCalendarQueries from "../googleCalendarQueries.js";
import type * as googleGroupAssignments from "../googleGroupAssignments.js";
import type * as internalEvents from "../internalEvents.js";
import type * as lib_merchAuth from "../lib/merchAuth.js";
import type * as lib_merchInventory from "../lib/merchInventory.js";
import type * as lib_merchOrders from "../lib/merchOrders.js";
import type * as lib_merchOutbox from "../lib/merchOutbox.js";
import type * as lib_merchPickup from "../lib/merchPickup.js";
import type * as lib_merchValidation from "../lib/merchValidation.js";
import type * as lib_pointsLedger from "../lib/pointsLedger.js";
import type * as links from "../links.js";
import type * as logs from "../logs.js";
import type * as merchCatalog from "../merchCatalog.js";
import type * as merchFulfillment from "../merchFulfillment.js";
import type * as merchNotifications from "../merchNotifications.js";
import type * as merchOrders from "../merchOrders.js";
import type * as merchPickup from "../merchPickup.js";
import type * as migrations_clearLegacyResumes from "../migrations/clearLegacyResumes.js";
import type * as migrations_initializePointLedger from "../migrations/initializePointLedger.js";
import type * as notifications from "../notifications.js";
import type * as officerInvitations from "../officerInvitations.js";
import type * as officerRejections from "../officerRejections.js";
import type * as organizationSettings from "../organizationSettings.js";
import type * as permissions from "../permissions.js";
import type * as points from "../points.js";
import type * as reimbursements from "../reimbursements.js";
import type * as resume from "../resume.js";
import type * as sponsorDomains from "../sponsorDomains.js";
import type * as userProvisioning from "../userProvisioning.js";
import type * as users from "../users.js";
import type * as weekLabelSettings from "../weekLabelSettings.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  constitutions: typeof constitutions;
  crons: typeof crons;
  directOnboardings: typeof directOnboardings;
  eventTimeRange: typeof eventTimeRange;
  events: typeof events;
  fundDeposits: typeof fundDeposits;
  fundRequests: typeof fundRequests;
  googleCalendar: typeof googleCalendar;
  googleCalendarEventUtils: typeof googleCalendarEventUtils;
  googleCalendarIds: typeof googleCalendarIds;
  googleCalendarQueries: typeof googleCalendarQueries;
  googleGroupAssignments: typeof googleGroupAssignments;
  internalEvents: typeof internalEvents;
  "lib/merchAuth": typeof lib_merchAuth;
  "lib/merchInventory": typeof lib_merchInventory;
  "lib/merchOrders": typeof lib_merchOrders;
  "lib/merchOutbox": typeof lib_merchOutbox;
  "lib/merchPickup": typeof lib_merchPickup;
  "lib/merchValidation": typeof lib_merchValidation;
  "lib/pointsLedger": typeof lib_pointsLedger;
  links: typeof links;
  logs: typeof logs;
  merchCatalog: typeof merchCatalog;
  merchFulfillment: typeof merchFulfillment;
  merchNotifications: typeof merchNotifications;
  merchOrders: typeof merchOrders;
  merchPickup: typeof merchPickup;
  "migrations/clearLegacyResumes": typeof migrations_clearLegacyResumes;
  "migrations/initializePointLedger": typeof migrations_initializePointLedger;
  notifications: typeof notifications;
  officerInvitations: typeof officerInvitations;
  officerRejections: typeof officerRejections;
  organizationSettings: typeof organizationSettings;
  permissions: typeof permissions;
  points: typeof points;
  reimbursements: typeof reimbursements;
  resume: typeof resume;
  sponsorDomains: typeof sponsorDomains;
  userProvisioning: typeof userProvisioning;
  users: typeof users;
  weekLabelSettings: typeof weekLabelSettings;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
