import type { UserRole } from '../../../shared/types/firestore';
import type { User as FirestoreUser } from '../../../shared/types/firestore';
import { USER_ROLES } from '../types/UserManagementTypes';

export class UserPermissionService {
    static hasUserManagementAccess(currentUserRole: UserRole): boolean {
        return currentUserRole === 'Executive Officer' || currentUserRole === 'Administrator';
    }

    static canEditUserRole(
        currentUserRole: UserRole,
        targetUser: FirestoreUser & { id: string },
        currentUserId?: string
    ): boolean {
        // Executive Officers cannot change Administrator users
        if (currentUserRole === 'Executive Officer' && targetUser.role === 'Administrator') {
            return false;
        }

        // Administrators can change anyone's role including their own
        if (currentUserRole === 'Administrator') {
            return true;
        }

        // Executive Officers cannot change their own role
        if (currentUserRole === 'Executive Officer' && currentUserId && targetUser.id === currentUserId) {
            return false;
        }

        // Executive Officers can change other users' roles except Administrators
        if (currentUserRole === 'Executive Officer' && targetUser.role !== 'Administrator') {
            return true;
        }

        return false;
    }

    static canEditUserPosition(
        currentUserRole: UserRole,
        targetUser: FirestoreUser & { id: string },
        currentUserId?: string
    ): boolean {
        // Administrators can change anyone's position including their own
        if (currentUserRole === 'Administrator') {
            return true;
        }

        // Executive Officers cannot change their own position
        if (currentUserRole === 'Executive Officer' && currentUserId && targetUser.id === currentUserId) {
            return false;
        }

        // Executive Officers cannot change Administrator positions
        if (currentUserRole === 'Executive Officer' && targetUser.role === 'Administrator') {
            return false;
        }

        return currentUserRole === 'Executive Officer';
    }

    static canDeleteUser(
        currentUserRole: UserRole,
        targetUser: FirestoreUser & { id: string }
    ): boolean {
        // Only Administrators can delete other Administrators or Executive Officers
        if (['Administrator', 'Executive Officer'].includes(targetUser.role)) {
            return currentUserRole === 'Administrator';
        }

        // Both Administrators and Executive Officers can delete other roles
        return this.hasUserManagementAccess(currentUserRole);
    }

    static canInviteWithRole(currentUserRole: UserRole, inviteRole: UserRole): boolean {
        // Only administrators can invite executive officers or administrators
        if (['Executive Officer', 'Administrator'].includes(inviteRole)) {
            return currentUserRole === 'Administrator';
        }

        return this.hasUserManagementAccess(currentUserRole);
    }

    static getAvailableRoles(
        currentUserRole: UserRole,
        isCurrentUser: boolean = false
    ): UserRole[] {
        if (currentUserRole === 'Administrator') {
            // Administrators can assign any role to anyone including themselves
            return USER_ROLES;
        } else if (currentUserRole === 'Executive Officer') {
            if (isCurrentUser) {
                // Executive Officers cannot change their own role - return only their current role
                return [currentUserRole];
            }
            // Executive Officers can assign any role except Administrator to others
            return USER_ROLES.filter(role => role !== 'Administrator');
        }

        return [];
    }

    static isOAuthUser(
        targetUserId: string,
        users: (FirestoreUser & { id: string })[],
        currentAuthUser?: any
    ): boolean {
        // Find the user in our users list and check their signInMethod
        const targetUser = users.find(u => u.id === targetUserId);
        if (targetUser && targetUser.signInMethod) {
            // Consider anything other than 'email' as OAuth
            return targetUser.signInMethod !== 'email';
        }

        // Fallback: if we can't find the sign-in method and this is the current user,
        // check the auth providers
        if (currentAuthUser && currentAuthUser.uid === targetUserId) {
            return currentAuthUser.providerData.some((provider: any) =>
                provider.providerId !== 'password'
            );
        }

        return false;
    }
}
