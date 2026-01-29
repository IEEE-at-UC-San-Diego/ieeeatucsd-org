import React from 'react';
import { Search, Filter, Plus, UserPlus, X } from 'lucide-react';
import { Card, CardBody, Input, Select, SelectItem, Button, Chip } from '@heroui/react';
import type { UserFilters } from '../types/UserManagementTypes';
import { USER_ROLES, USER_STATUSES } from '../types/UserManagementTypes';

interface UserFiltersProps {
    filters: UserFilters;
    onFiltersChange: (filters: Partial<UserFilters>) => void;
    onShowInviteModal: () => void;
    onShowAddMemberModal: () => void;
    canManageUsers: boolean;
}

export default function UserFilters({
    filters,
    onFiltersChange,
    onShowInviteModal,
    onShowAddMemberModal,
    canManageUsers
}: UserFiltersProps) {
    return (
        <Card shadow="sm" className="rounded-lg mb-6">
            <CardBody className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Search and Filters */}
                    <div className="flex flex-col sm:flex-row gap-4 flex-1">
                        {/* Search */}
                        <div className="flex-1 max-w-md">
                            <Input
                                type="text"
                                placeholder="Search users..."
                                value={filters.searchTerm}
                                onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
                                startContent={<Search className="w-4 h-4 text-gray-400" />}
                                classNames={{
                                    input: "text-sm",
                                    inputWrapper: "rounded-lg"
                                }}
                            />
                        </div>

                        {/* Role Filter */}
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <Select
                                selectedKeys={[filters.roleFilter]}
                                onChange={(e) => onFiltersChange({ roleFilter: e.target.value as any })}
                                classNames={{
                                    trigger: "rounded-lg min-w-[150px]"
                                }}
                                aria-label="Filter by role"
                            >
                                <SelectItem key="all">All Roles</SelectItem>
                                {USER_ROLES.map(role => (
                                    <SelectItem key={role}>{role}</SelectItem>
                                ))}
                            </Select>
                        </div>

                        {/* Status Filter */}
                        <div>
                            <Select
                                selectedKeys={[filters.statusFilter]}
                                onChange={(e) => onFiltersChange({ statusFilter: e.target.value as any })}
                                classNames={{
                                    trigger: "rounded-lg min-w-[150px]"
                                }}
                                aria-label="Filter by status"
                            >
                                {USER_STATUSES.map(status => (
                                    <SelectItem key={status}>
                                        {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                                    </SelectItem>
                                ))}
                            </Select>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {canManageUsers && (
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                                color="success"
                                variant="solid"
                                onPress={onShowAddMemberModal}
                                startContent={<UserPlus className="w-4 h-4" />}
                                className="rounded-lg"
                            >
                                Promote to Officer
                            </Button>

                            <Button
                                color="primary"
                                variant="solid"
                                onPress={onShowInviteModal}
                                startContent={<Plus className="w-4 h-4" />}
                                className="rounded-lg"
                            >
                                Invite Officer
                            </Button>
                        </div>
                    )}
                </div>

                {/* Active Filters Display */}
                {(filters.searchTerm || filters.roleFilter !== 'all' || filters.statusFilter !== 'all') && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm text-gray-600">Active filters:</span>

                            {filters.searchTerm && (
                                <Chip
                                    color="primary"
                                    variant="flat"
                                    size="sm"
                                    onClose={() => onFiltersChange({ searchTerm: '' })}
                                    className="rounded-full"
                                >
                                    Search: "{filters.searchTerm}"
                                </Chip>
                            )}

                            {filters.roleFilter !== 'all' && (
                                <Chip
                                    color="secondary"
                                    variant="flat"
                                    size="sm"
                                    onClose={() => onFiltersChange({ roleFilter: 'all' })}
                                    className="rounded-full"
                                >
                                    Role: {filters.roleFilter}
                                </Chip>
                            )}

                            {filters.statusFilter !== 'all' && (
                                <Chip
                                    color="success"
                                    variant="flat"
                                    size="sm"
                                    onClose={() => onFiltersChange({ statusFilter: 'all' })}
                                    className="rounded-full"
                                >
                                    Status: {filters.statusFilter}
                                </Chip>
                            )}

                            <Button
                                size="sm"
                                variant="light"
                                onPress={() => onFiltersChange({
                                    searchTerm: '',
                                    roleFilter: 'all',
                                    statusFilter: 'all'
                                })}
                                className="text-xs underline"
                            >
                                Clear all
                            </Button>
                        </div>
                    </div>
                )}
            </CardBody>
        </Card>
    );
}
