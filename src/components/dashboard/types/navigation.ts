import type { UserRole } from './firestore';

export interface NavigationItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  active?: boolean;
}

export interface NavigationCategory {
  title: string;
  items: NavigationItem[];
  requiresRole?: UserRole[];
}

export interface DashboardUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface DashboardState {
  user: DashboardUser | null;
  currentPath: string;
  isLoading: boolean;
  error: string | null;
}

export interface SidebarProps {
  currentPath?: string;
  user?: DashboardUser;
}

// Navigation configuration
export const NAVIGATION_PATHS = {
  OVERVIEW: '/dashboard/overview',
  EVENTS: '/dashboard/events',
  REIMBURSEMENT: '/dashboard/reimbursement',
  LEADERBOARD: '/dashboard/leaderboard',
  MANAGE_EVENTS: '/dashboard/manage-events',
  MANAGE_REIMBURSEMENTS: '/dashboard/manage-reimbursements',
  MANAGE_USERS: '/dashboard/manage-users',
  FIREBASE_TEST: '/dashboard/firebase-test',
  SETTINGS: '/dashboard/settings',
  SIGNOUT: '/dashboard/signout',
  GET_STARTED: '/dashboard/get-started',
} as const;

export type NavigationPath = typeof NAVIGATION_PATHS[keyof typeof NAVIGATION_PATHS]; 