import type { Id } from "@convex/_generated/dataModel";

export type UserRole =
  | "Member"
  | "General Officer"
  | "Executive Officer"
  | "Member at Large"
  | "Past Officer"
  | "Sponsor"
  | "Administrator";

export type OfficerTeam = "Internal" | "Events" | "Projects";
export type UserStatus = "active" | "inactive" | "suspended";
export type SponsorTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export interface UserModalData {
  _id?: Id<"users">;
  id?: Id<"users">;
  name: string;
  email: string;
  role: UserRole;
  position?: string;
  status: UserStatus;
  pid?: string;
  memberId?: string;
  major?: string;
  graduationYear?: number;
  points?: number;
  team?: OfficerTeam;
  avatar?: string;
  hasIEEEEmail?: boolean;
  ieeeEmail?: string;
  ieeeEmailCreatedAt?: number;
  ieeeEmailStatus?: "active" | "disabled";
  sponsorTier?: SponsorTier;
  sponsorOrganization?: string;
  autoAssignedSponsor?: boolean;
}

export interface InviteModalData {
  name: string;
  email: string;
  role: UserRole;
  position: string;
  team?: OfficerTeam;
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
  statusFilter: UserStatus | "all";
  teamFilter: OfficerTeam | "all";
}

export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

export interface SponsorDomain {
  domain: string;
  organizationName: string;
  sponsorTier: SponsorTier;
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

export const USER_ROLES: UserRole[] = [
  "Member",
  "General Officer",
  "Executive Officer",
  "Member at Large",
  "Past Officer",
  "Sponsor",
  "Administrator",
];

export const USER_STATUSES: (UserStatus | "all")[] = [
  "all",
  "active",
  "inactive",
  "suspended",
];

export const TEAMS: (OfficerTeam | "all")[] = [
  "all",
  "Internal",
  "Events",
  "Projects",
];

export const SPONSOR_TIERS: SponsorTier[] = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
];
