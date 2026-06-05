import {
  Home,
  Calendar,
  CreditCard,
  Users,
  DollarSign,
  Trophy,
  FileText,
  MessageSquare,
  Link as LinkIcon,
  Briefcase,
  Building2,
  UserPlus,
  ClipboardList,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "../hooks/useAuth";

export interface NavigationItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

export interface NavigationCategory {
  title: string;
  items: NavigationItem[];
  requiresRole?: UserRole[];
}

export const NAVIGATION_PATHS = {
  OVERVIEW: "/overview",
  EVENTS: "/events",
  REIMBURSEMENT: "/reimbursement",
  LEADERBOARD: "/leaderboard",
  LINKS: "/links",
  MANAGE_EVENTS: "/manage-events",
  MANAGE_REIMBURSEMENTS: "/manage-reimbursements",
  FUND_REQUESTS: "/fund-requests",
  MANAGE_FUND_REQUESTS: "/manage-fund-requests",
  SLACK_ACCESS: "/slack-access",
  MANAGE_USERS: "/manage-users",
  MANAGE_SPONSORS: "/manage-sponsors",
  ONBOARDING: "/onboarding",
  CONSTITUTION_BUILDER: "/constitution-builder",
  EXECUTIVE_ANALYTICS: "/executive-analytics",
  RESUME_DATABASE: "/sponsors/resume-database",
  SPONSOR_INFORMATION: "/sponsors/information",
  SETTINGS: "/settings",
  SIGNOUT: "/signout",
  GET_STARTED: "/get-started",
  OFFICER_CALENDAR: "/officer-calendar",
} as const;

export type NavigationPath =
  (typeof NAVIGATION_PATHS)[keyof typeof NAVIGATION_PATHS];

export const navigationCategories: NavigationCategory[] = [
  {
    title: "Member Actions",
    items: [
      { icon: Home, label: "Overview", href: NAVIGATION_PATHS.OVERVIEW },
      { icon: LinkIcon, label: "Links", href: NAVIGATION_PATHS.LINKS },
      { icon: Calendar, label: "Events", href: NAVIGATION_PATHS.EVENTS },
      {
        icon: CreditCard,
        label: "Reimbursement",
        href: NAVIGATION_PATHS.REIMBURSEMENT,
      },
      {
        icon: Trophy,
        label: "Leaderboard",
        href: NAVIGATION_PATHS.LEADERBOARD,
      },
    ],
  },
  {
    title: "General Officers",
    requiresRole: ["General Officer", "Executive Officer", "Administrator"],
    items: [
      {
        icon: Calendar,
        label: "Manage Events",
        href: NAVIGATION_PATHS.MANAGE_EVENTS,
      },
      {
        icon: Calendar,
        label: "Officer Calendar",
        href: NAVIGATION_PATHS.OFFICER_CALENDAR,
      },
      {
        icon: ClipboardList,
        label: "Fund Requests",
        href: NAVIGATION_PATHS.FUND_REQUESTS,
      },
      {
        icon: MessageSquare,
        label: "Slack Access",
        href: NAVIGATION_PATHS.SLACK_ACCESS,
      },
    ],
  },
  {
    title: "Executive Officers",
    requiresRole: ["Executive Officer", "Administrator"],
    items: [
      {
        icon: DollarSign,
        label: "Manage Reimbursements",
        href: NAVIGATION_PATHS.MANAGE_REIMBURSEMENTS,
      },
      {
        icon: ClipboardList,
        label: "Manage Fund Requests",
        href: NAVIGATION_PATHS.MANAGE_FUND_REQUESTS,
      },
      {
        icon: Users,
        label: "Manage Users",
        href: NAVIGATION_PATHS.MANAGE_USERS,
      },
      {
        icon: Building2,
        label: "Manage Sponsors",
        href: NAVIGATION_PATHS.MANAGE_SPONSORS,
      },
      {
        icon: UserPlus,
        label: "Onboarding",
        href: NAVIGATION_PATHS.ONBOARDING,
      },
      {
        icon: FileText,
        label: "Constitution Builder",
        href: NAVIGATION_PATHS.CONSTITUTION_BUILDER,
      },
      {
        icon: BarChart3,
        label: "Executive Analytics",
        href: NAVIGATION_PATHS.EXECUTIVE_ANALYTICS,
      },
    ],
  },
  {
    title: "Sponsors",
    requiresRole: ["Sponsor", "Administrator"],
    items: [
      {
        icon: Briefcase,
        label: "Resume Database",
        href: NAVIGATION_PATHS.RESUME_DATABASE,
      },
      {
        icon: Building2,
        label: "Sponsor Information",
        href: NAVIGATION_PATHS.SPONSOR_INFORMATION,
      },
    ],
  },
];

export const PATH_LABELS: Record<string, string> = {
  "/overview": "Overview",
  "/events": "Events",
  "/reimbursement": "Reimbursement",
  "/leaderboard": "Leaderboard",
  "/links": "Links",
  "/manage-events": "Manage Events",
  "/manage-reimbursements": "Manage Reimbursements",
  "/fund-requests": "Fund Requests",
  "/manage-fund-requests": "Manage Fund Requests",
  "/slack-access": "Slack Access",
  "/manage-users": "Manage Users",
  "/manage-sponsors": "Manage Sponsors",
  "/onboarding": "Onboarding",
  "/constitution-builder": "Constitution Builder",
  "/executive-analytics": "Executive Analytics",
  "/sponsors/resume-database": "Resume Database",
  "/sponsors/information": "Sponsor Information",
  "/settings": "Settings",
  "/get-started": "Get Started",
  "/officer-calendar": "Officer Calendar",
};

export const LEGAL_VERSIONS = {
  TOS_VERSION: "1.2",
  TOS_EFFECTIVE_DATE: "2024-12-29",
  TOS_URL: "/terms-of-service",
  PRIVACY_POLICY_VERSION: "1.2",
  PRIVACY_POLICY_EFFECTIVE_DATE: "2024-12-29",
  PRIVACY_POLICY_URL: "/privacy-policy",
};
