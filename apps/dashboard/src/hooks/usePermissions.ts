import { useAuth } from "./useAuth";

export function usePermissions() {
  const {
    user,
    userRole,
    isAuthenticated,
    isLoading,
    logtoId,
    accessToken,
    convexSessionToken,
    getAuthHeaders,
  } = useAuth();

  const isAdmin = userRole === "Administrator";
  const isExecutiveOfficer = userRole === "Executive Officer";
  const isGeneralOfficer = userRole === "General Officer";
  const isSponsorRole = userRole === "Sponsor";

  const hasAdminAccess = isAdmin || isExecutiveOfficer;
  const hasOfficerAccess = hasAdminAccess || isGeneralOfficer;

  const canAccessResumeDatabase =
    isAdmin || (isSponsorRole && user?.sponsorTier !== "Bronze");

  return {
    user,
    userRole,
    isAuthenticated,
    isLoading,
    logtoId,
    accessToken,
    convexSessionToken,
    getAuthHeaders,
    isAdmin,
    isExecutiveOfficer,
    isGeneralOfficer,
    isSponsor: isSponsorRole,
    hasAdminAccess,
    hasOfficerAccess,
    canAccessResumeDatabase,
  };
}
