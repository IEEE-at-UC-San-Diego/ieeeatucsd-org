import type { Doc } from "@convex/_generated/dataModel";

export interface UserWithResume extends Doc<"users"> {
	id: string;
	name: string;
	email: string;
	major?: string;
	graduationYear?: number;
	resume?: string;
	role: "Member" | "General Officer" | "Executive Officer" | "Member at Large" | "Past Officer" | "Sponsor" | "Administrator";
	position?: string;
	sponsorTier?: "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";
}
