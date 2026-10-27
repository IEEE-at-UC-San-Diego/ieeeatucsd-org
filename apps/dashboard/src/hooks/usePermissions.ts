import { canViewVcoPipeline as hasVcoPipelineAccess } from "@/lib/vco/vcoAccess";
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
	const canViewVcoPipeline = hasVcoPipelineAccess(
		userRole,
		(user as { position?: string } | null)?.position,
	);

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
		canViewVcoPipeline,
	};
}
