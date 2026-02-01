/**
 * Dashboard navigation configuration
 *
 * Defines all dashboard routes with paths, labels, icons, and role requirements.
 * Used by the sidebar navigation and route guards.
 */

import type { ComponentType } from "react";
import {
  Home,
  Calendar,
  CreditCard,
  Settings,
  Users,
  DollarSign,
  Trophy,
  Banknote,
  FileText,
  MessageSquare,
  Link as LinkIcon,
  Briefcase,
  Building2,
  UserPlus,
  User,
  Award,
  ClipboardList,
} from "lucide-react";

/**
 * User role types for role-based access control
 */
export type UserRole =
  | "administrator"
  | "executive_officer"
  | "general_officer"
  | "member_at_large"
  | "past_officer"
  | "sponsor"
  | "member";

/**
 * Single navigation item definition
 */
export interface NavigationItem {
  /** Route path */
  path: string;
  /** Display label */
  label: string;
  /** Icon component (optional) */
  icon?: ComponentType<{ className?: string }>;
  /** Required roles to access this route (empty = public) */
  requiredRoles?: UserRole[];
}

/**
 * Grouped navigation category
 */
export interface NavigationCategory {
  title: string;
  items: NavigationItem[];
  /** Roles that can see this entire category */
  requiresRole?: UserRole[];
}

/**
 * All dashboard navigation items
 */
export const NAVIGATION_ITEMS: NavigationCategory[] = [
  {
    title: "Member Actions",
    items: [
      { icon: Home, label: "Overview", path: "/overview" },
      { icon: LinkIcon, label: "Links", path: "/links" },
      { icon: Calendar, label: "Events", path: "/events" },
      { icon: CreditCard, label: "Reimbursement", path: "/reimbursement" },
      { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
    ],
  },
  {
    title: "General Officers",
    requiresRole: ["general_officer", "executive_officer", "administrator"],
    items: [
      {
        icon: Calendar,
        label: "Manage Events",
        path: "/manage-events",
        requiredRoles: ["general_officer", "executive_officer", "administrator"],
      },
      {
        icon: Banknote,
        label: "Fund Deposits",
        path: "/fund-deposits",
        requiredRoles: ["general_officer", "executive_officer", "administrator"],
      },
      {
        icon: ClipboardList,
        label: "Fund Requests",
        path: "/fund-requests",
        requiredRoles: ["general_officer", "executive_officer", "administrator"],
      },
      {
        icon: MessageSquare,
        label: "Slack Access",
        path: "/slack-access",
        requiredRoles: ["general_officer", "executive_officer", "administrator"],
      },
      {
        icon: Trophy,
        label: "Officer Leaderboard",
        path: "/officer-leaderboard",
        requiredRoles: ["general_officer", "executive_officer", "administrator"],
      },
    ],
  },
  {
    title: "Executive Officers",
    requiresRole: ["executive_officer", "administrator"],
    items: [
      {
        icon: DollarSign,
        label: "Manage Reimbursements",
        path: "/manage-reimbursements",
        requiredRoles: ["executive_officer", "administrator"],
      },
      {
        icon: ClipboardList,
        label: "Manage Fund Requests",
        path: "/manage-fund-requests",
        requiredRoles: ["executive_officer", "administrator"],
      },
      {
        icon: Users,
        label: "Manage Users",
        path: "/manage-users",
        requiredRoles: ["executive_officer", "administrator"],
      },
      {
        icon: Building2,
        label: "Manage Sponsors",
        path: "/manage-sponsors",
        requiredRoles: ["executive_officer", "administrator"],
      },
      {
        icon: UserPlus,
        label: "Onboarding",
        path: "/onboarding",
        requiredRoles: ["executive_officer", "administrator"],
      },
      {
        icon: FileText,
        label: "Constitution Builder",
        path: "/constitution-builder",
        requiredRoles: ["executive_officer", "administrator"],
      },
    ],
  },
  {
    title: "Sponsors",
    requiresRole: ["sponsor", "administrator"],
    items: [
      {
        icon: Briefcase,
        label: "Resume Database",
        path: "/sponsors/resume-database",
        requiredRoles: ["sponsor", "administrator"],
      },
      {
        icon: Building2,
        label: "Sponsor Information",
        path: "/sponsors/information",
        requiredRoles: ["sponsor", "administrator"],
      },
    ],
  },
];

/**
 * Navigation path constants for type-safe routing
 */
export const NAVIGATION_PATHS = {
  OVERVIEW: "/overview",
  EVENTS: "/events",
  LEADERBOARD: "/leaderboard",
  MANAGE_USERS: "/manage-users",
  SETTINGS: "/settings",
  GET_STARTED: "/get-started",
  MANAGE_EVENTS: "/manage-events",
  FUND_REQUESTS: "/fund-requests",
  FUND_DEPOSITS: "/fund-deposits",
  REIMBURSEMENT: "/reimbursement",
  ONBOARDING: "/onboarding",
  CONSTITUTION_BUILDER: "/constitution-builder",
  LINKS: "/links",
  MANAGE_SPONSORS: "/manage-sponsors",
  SLACK_ACCESS: "/slack-access",
  MANAGE_FUND_REQUESTS: "/manage-fund-requests",
  MANAGE_REIMBURSEMENTS: "/manage-reimbursements",
  OFFICER_LEADERBOARD: "/officer-leaderboard",
  SPONSOR_RESUME_DATABASE: "/sponsors/resume-database",
  SPONSOR_INFORMATION: "/sponsors/information",
} as const;

export type NavigationPath = (typeof NAVIGATION_PATHS)[keyof typeof NAVIGATION_PATHS];
