import type { Id } from "@convex/_generated/dataModel";

export type SponsorTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export interface SponsorDomain {
  _id: Id<"sponsorDomains">;
  _creationTime: number;
  domain: string;
  organizationName: string;
  sponsorTier: SponsorTier;
  createdBy: string;
  lastModifiedBy?: string;
  _updatedAt?: number;
}

export interface SponsorStats {
  totalSponsors: number;
  goldSponsors: number;
  silverSponsors: number;
  bronzeSponsors: number;
}

export interface SortConfig {
  field: string;
  direction: "asc" | "desc";
}

export interface SponsorFormData {
  domain: string;
  organizationName: string;
  sponsorTier: SponsorTier;
}
