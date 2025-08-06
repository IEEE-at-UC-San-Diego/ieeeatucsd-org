import type { UserRole } from "../../../shared/types/firestore";

export interface UserModalData {
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  position?: string;
  status: "active" | "inactive" | "suspended";
  pid?: string;
  memberId?: string;
  major?: string;
  graduationYear?: number;
  points?: number;
  // IEEE Email fields
  hasIEEEEmail?: boolean;
  ieeeEmail?: string;
  ieeeEmailCreatedAt?: any;
  ieeeEmailStatus?: "active" | "disabled";
}

export interface InviteModalData {
  name: string;
  email: string;
  role: UserRole;
  position: string;
  message: string;
}

export interface UserStats {
  totalMembers: number;
  activeMembers: number;
  officers: number;
  newThisMonth: number;
}

export interface UserFilters {
  searchTerm: string;
  roleFilter: UserRole | "all";
  statusFilter: "all" | "active" | "inactive" | "suspended";
}

export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

export interface EmailManagementData {
  userId: string;
  currentEmail?: string;
  newAlias?: string;
  action: "update" | "disable" | "enable" | "delete";
}

export interface EmailOperationResult {
  success: boolean;
  message: string;
  newEmail?: string;
}

export interface UserPermissions {
  hasUserManagementAccess: boolean;
  canInviteWithRole: (role: UserRole) => boolean;
  getAvailableRoles: (isCurrentUser?: boolean) => UserRole[];
  canEditUserRole: (targetUser: any) => boolean;
  canEditUserPosition: (targetUser: any) => boolean;
  canDeleteUser: (targetUser: any) => boolean;
  isOAuthUser: (targetUserId: string) => boolean;
}

export const USER_ROLES: UserRole[] = [
  "Member",
  "General Officer",
  "Executive Officer",
  "Member at Large",
  "Past Officer",
  "Sponsor",
  "Administrator",
];

export const USER_STATUSES = [
  "all",
  "active",
  "inactive",
  "suspended",
] as const;

export type UserStatus = (typeof USER_STATUSES)[number];
