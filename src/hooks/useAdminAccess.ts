import { useAuth } from './useAuth';

/**
 * Hook to check if the current user has administrative access
 * @returns Object with admin access status and role information
 */
export function useAdminAccess() {
  const { user, userRole } = useAuth();

  const isAdmin = userRole === 'Administrator';
  const isExecutiveOfficer = userRole === 'Executive Officer';
  const isGeneralOfficer = userRole === 'General Officer';
  
  // Admin access includes Administrators and Executive Officers
  const hasAdminAccess = isAdmin || isExecutiveOfficer;
  
  // Officer access includes all officer roles
  const hasOfficerAccess = hasAdminAccess || isGeneralOfficer;

  return {
    user,
    userRole,
    isAdmin,
    isExecutiveOfficer,
    isGeneralOfficer,
    hasAdminAccess,
    hasOfficerAccess,
    isAuthenticated: !!user,
  };
}
