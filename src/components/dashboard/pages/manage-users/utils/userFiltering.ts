import type { User as FirestoreUser, UserRole } from '../../../shared/types/firestore';
import type { UserFilters, SortConfig, UserStats } from '../types/UserManagementTypes';

export class UserFilteringService {
    static filterUsers(
        users: (FirestoreUser & { id: string })[],
        filters: UserFilters
    ): (FirestoreUser & { id: string })[] {
        let filtered = [...users];

        // Search filter
        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            filtered = filtered.filter(user =>
                user.name?.toLowerCase().includes(term) ||
                user.email?.toLowerCase().includes(term) ||
                user.position?.toLowerCase().includes(term) ||
                user.pid?.toLowerCase().includes(term) ||
                user.memberId?.toLowerCase().includes(term)
            );
        }

        // Role filter
        if (filters.roleFilter !== 'all') {
            filtered = filtered.filter(user => user.role === filters.roleFilter);
        }

        // Status filter
        if (filters.statusFilter !== 'all') {
            filtered = filtered.filter(user => user.status === filters.statusFilter);
        }

        return filtered;
    }

    static sortUsers(
        users: (FirestoreUser & { id: string })[],
        sortConfig: SortConfig
    ): (FirestoreUser & { id: string })[] {
        return [...users].sort((a, b) => {
            let aValue: any = '';
            let bValue: any = '';

            switch (sortConfig.field) {
                case 'name':
                    aValue = a.name || '';
                    bValue = b.name || '';
                    break;
                case 'email':
                    aValue = a.email || '';
                    bValue = b.email || '';
                    break;
                case 'role':
                    aValue = a.role || '';
                    bValue = b.role || '';
                    break;
                case 'position':
                    aValue = a.position || '';
                    bValue = b.position || '';
                    break;
                case 'status':
                    aValue = a.status || '';
                    bValue = b.status || '';
                    break;
                case 'points':
                    aValue = a.points || 0;
                    bValue = b.points || 0;
                    break;
                case 'joinDate':
                    aValue = a.joinDate ? a.joinDate.toDate().getTime() : 0;
                    bValue = b.joinDate ? b.joinDate.toDate().getTime() : 0;
                    break;
                case 'graduationYear':
                    aValue = a.graduationYear || 0;
                    bValue = b.graduationYear || 0;
                    break;
                default:
                    aValue = '';
                    bValue = '';
            }

            // Handle numeric sorting
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
            }

            // Handle string sorting
            const aStr = String(aValue).toLowerCase();
            const bStr = String(bValue).toLowerCase();

            if (sortConfig.direction === 'asc') {
                return aStr.localeCompare(bStr);
            } else {
                return bStr.localeCompare(aStr);
            }
        });
    }

    static searchMembers(
        users: (FirestoreUser & { id: string })[],
        searchTerm: string
    ): (FirestoreUser & { id: string })[] {
        if (!searchTerm || searchTerm.length < 2) {
            return [];
        }

        const term = searchTerm.toLowerCase();
        return users.filter(user => {
            try {
                return user.name?.toLowerCase().includes(term) ||
                       user.email?.toLowerCase().includes(term) ||
                       user.pid?.toLowerCase().includes(term) ||
                       user.memberId?.toLowerCase().includes(term);
            } catch (error) {
                console.error('Error filtering user:', error);
                return true; // Include the item if there's an error to avoid blank pages
            }
        });
    }

    static calculateStats(users: (FirestoreUser & { id: string })[]): UserStats {
        const totalMembers = users.length;
        const activeMembers = users.filter(u => u.status === 'active').length;
        const officers = users.filter(u => ['General Officer', 'Executive Officer'].includes(u.role)).length;
        
        const thisMonth = new Date();
        thisMonth.setDate(1);
        const newThisMonth = users.filter(u => 
            u.joinDate && u.joinDate.toDate() >= thisMonth
        ).length;

        return { totalMembers, activeMembers, officers, newThisMonth };
    }
}

export class UserDisplayService {
    static getStatusColor(status: string): string {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'inactive':
                return 'bg-gray-100 text-gray-800';
            case 'suspended':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }

    static getStatusIcon(status: string): string {
        switch (status) {
            case 'active':
                return 'CheckCircle';
            case 'inactive':
                return 'Clock';
            case 'suspended':
                return 'XCircle';
            default:
                return 'AlertCircle';
        }
    }

    static getRoleColor(role: UserRole): string {
        switch (role) {
            case 'Executive Officer':
                return 'bg-purple-100 text-purple-800';
            case 'General Officer':
                return 'bg-blue-100 text-blue-800';
            case 'Administrator':
                return 'bg-red-100 text-red-800';
            case 'Member at Large':
                return 'bg-yellow-100 text-yellow-800';
            case 'Past Officer':
                return 'bg-gray-100 text-gray-800';
            case 'Sponsor':
                return 'bg-green-100 text-green-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }
}
