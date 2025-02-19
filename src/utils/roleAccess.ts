export type OfficerStatus = "admin" | "executive" | "general" | "past" | "sponsor" | "none" | "";
type RoleHierarchy = Record<OfficerStatus, OfficerStatus[]>;

export function hasAccess(userRole: OfficerStatus, requiredRole: OfficerStatus): boolean {
    const roleHierarchy: RoleHierarchy = {
        "admin": ["admin", "sponsor", "executive", "general", "past", "none", ""],
        "executive": ["executive", "general", "past", "none", ""],
        "general": ["general", "past", "none", ""],
        "past": ["past", "none", ""],
        "sponsor": ["sponsor"], // Sponsor can only access sponsor-specific content
        "none": ["none", ""],
        "": [""]
    };
    
    return roleHierarchy[userRole]?.includes(requiredRole) || false;
} 