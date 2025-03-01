export type OfficerStatus =
  | "administrator"
  | "executive"
  | "general"
  | "honorary"
  | "past"
  | "sponsor"
  | "none"
  | "";
type RoleHierarchy = Record<OfficerStatus, OfficerStatus[]>;

export function hasAccess(
  userRole: OfficerStatus,
  requiredRole: OfficerStatus,
): boolean {
  const roleHierarchy: RoleHierarchy = {
    administrator: [
      "administrator",
      "executive",
      "general",
      "honorary",
      "past",
      "sponsor",
      "none",
      "",
    ],
    executive: ["executive", "general", "honorary", "past", "none", ""],
    general: ["general", "honorary", "past", "none", ""],
    honorary: ["honorary", "none", ""],
    past: ["past", "none", ""],
    sponsor: ["sponsor"], // Sponsor can only access sponsor-specific content
    none: ["none", ""],
    "": [""],
  };

  return roleHierarchy[userRole]?.includes(requiredRole) || false;
}
