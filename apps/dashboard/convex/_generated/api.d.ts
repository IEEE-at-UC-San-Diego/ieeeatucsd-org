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
import type * as links from "../links.js";
import type * as logs from "../logs.js";
import type * as merch_categories from "../merch/categories.js";
import type * as merch_helpers from "../merch/helpers.js";
import type * as merch_inventory from "../merch/inventory.js";
import type * as merch_pickupHelpers from "../merch/pickupHelpers.js";
import type * as merch_pickupJobs from "../merch/pickupJobs.js";
import type * as merch_pickups from "../merch/pickups.js";
import type * as merch_products from "../merch/products.js";
import type * as migrations_clearLegacyResumes from "../migrations/clearLegacyResumes.js";
import type * as notifications from "../notifications.js";
import type * as officerInvitations from "../officerInvitations.js";
import type * as officerRejections from "../officerRejections.js";
import type * as organizationSettings from "../organizationSettings.js";
import type * as permissions from "../permissions.js";
import type * as pointLedger from "../pointLedger.js";
import type * as points_helpers from "../points/helpers.js";
import type * as points_service from "../points/service.js";
import type * as points_types from "../points/types.js";
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
  links: typeof links;
  logs: typeof logs;
  "merch/categories": typeof merch_categories;
  "merch/helpers": typeof merch_helpers;
  "merch/inventory": typeof merch_inventory;
  "merch/pickupHelpers": typeof merch_pickupHelpers;
  "merch/pickupJobs": typeof merch_pickupJobs;
  "merch/pickups": typeof merch_pickups;
  "merch/products": typeof merch_products;
  "migrations/clearLegacyResumes": typeof migrations_clearLegacyResumes;
  notifications: typeof notifications;
  officerInvitations: typeof officerInvitations;
  officerRejections: typeof officerRejections;
  organizationSettings: typeof organizationSettings;
  permissions: typeof permissions;
  pointLedger: typeof pointLedger;
  "points/helpers": typeof points_helpers;
  "points/service": typeof points_service;
  "points/types": typeof points_types;
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
