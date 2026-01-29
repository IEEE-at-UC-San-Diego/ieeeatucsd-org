import type { UserRole, SponsorTier } from "../../../shared/types/firestore";

export class SponsorPermissionService {
  /**
   * Check if user has sponsor access to resume database
   * Sponsors (Silver tier and above) and Administrators can access the resume database
   * Bronze tier sponsors do NOT have access
   */
  static hasSponsorAccess(
    userRole: UserRole | null,
    sponsorTier?: SponsorTier | null,
  ): boolean {
    if (!userRole) return false;

    // Administrators always have access
    if (userRole === "Administrator") return true;

    // Sponsors need to be Silver tier or above
    if (userRole === "Sponsor") {
      // Bronze tier sponsors do not have access
      if (sponsorTier === "Bronze") return false;

      // Silver, Gold, Platinum, Diamond have access
      if (
        sponsorTier === "Silver" ||
        sponsorTier === "Gold" ||
        sponsorTier === "Platinum" ||
        sponsorTier === "Diamond"
      ) {
        return true;
      }

      // If no tier is assigned, deny access
      return false;
    }

    return false;
  }

  /**
   * Check if user can view resume database
   */
  static canViewResumeDatabase(
    userRole: UserRole | null,
    sponsorTier?: SponsorTier | null,
  ): boolean {
    return this.hasSponsorAccess(userRole, sponsorTier);
  }
}
