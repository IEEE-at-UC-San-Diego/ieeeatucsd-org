import React from 'react';
import { Search, Filter, Plus, UserPlus } from 'lucide-react';
import type { UserFilters } from '../types/UserManagementTypes';
import { USER_ROLES, USER_STATUSES } from '../types/UserManagementTypes';

interface UserFiltersProps {
    filters: UserFilters;
    onFiltersChange: (filters: Partial<UserFilters>) => void;
    onShowUserModal: () => void;
    onShowInviteModal: () => void;
    onShowAddMemberModal: () => void;
    canManageUsers: boolean;
}

export default function UserFilters({
    filters,
    onFiltersChange,
    onShowUserModal,
    onShowInviteModal,
    onShowAddMemberModal,
    canManageUsers
}: UserFiltersProps) {
    return (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-4 flex-1">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={filters.searchTerm}
                            onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Role Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <select
                            value={filters.roleFilter}
                            onChange={(e) => onFiltersChange({ roleFilter: e.target.value as any })}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">All Roles</option>
                            {USER_ROLES.map(role => (
                                <option key={role} value={role}>{role}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <select
                            value={filters.statusFilter}
                            onChange={(e) => onFiltersChange({ statusFilter: e.target.value as any })}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            {USER_STATUSES.map(status => (
                                <option key={status} value={status}>
                                    {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Action Buttons */}
                {canManageUsers && (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <button
                            onClick={onShowAddMemberModal}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span>Add Member</span>
                        </button>
                        
                        <button
                            onClick={onShowInviteModal}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Send Invite</span>
                        </button>
                        
                        <button
                            onClick={onShowUserModal}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add User</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Active Filters Display */}
            {(filters.searchTerm || filters.roleFilter !== 'all' || filters.statusFilter !== 'all') && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-gray-600">Active filters:</span>
                        
                        {filters.searchTerm && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                Search: "{filters.searchTerm}"
                                <button
                                    onClick={() => onFiltersChange({ searchTerm: '' })}
                                    className="ml-1 text-blue-600 hover:text-blue-800"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                        
                        {filters.roleFilter !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                                Role: {filters.roleFilter}
                                <button
                                    onClick={() => onFiltersChange({ roleFilter: 'all' })}
                                    className="ml-1 text-purple-600 hover:text-purple-800"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                        
                        {filters.statusFilter !== 'all' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                Status: {filters.statusFilter}
                                <button
                                    onClick={() => onFiltersChange({ statusFilter: 'all' })}
                                    className="ml-1 text-green-600 hover:text-green-800"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                        
                        <button
                            onClick={() => onFiltersChange({ 
                                searchTerm: '', 
                                roleFilter: 'all', 
                                statusFilter: 'all' 
                            })}
                            className="text-xs text-gray-500 hover:text-gray-700 underline"
                        >
                            Clear all
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
