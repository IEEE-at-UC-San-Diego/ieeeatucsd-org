import React from 'react';
import { Edit, Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Button, Avatar, Tooltip, Card } from '@heroui/react';
import type { User as FirestoreUser } from '../../../shared/types/firestore';
import type { SortConfig, UserPermissions } from '../types/UserManagementTypes';
import { UserDisplayService } from '../utils/userFiltering';

interface UserTableProps {
    users: (FirestoreUser & { id: string })[];
    sortConfig: SortConfig;
    onSort: (field: string) => void;
    onEditUser: (user: FirestoreUser & { id: string }) => void;
    onDeleteUser: (userId: string) => void;
    permissions: UserPermissions;
    currentUserId?: string;
}

// Utility function to truncate majors
const truncateMajor = (major: string, maxLength: number = 20) => {
    if (!major || major.length <= maxLength) return major;
    return major.substring(0, maxLength) + '...';
};

export default function UserTable({
    users,
    sortConfig,
    onSort,
    onEditUser,
    onDeleteUser,
    permissions,
    currentUserId
}: UserTableProps) {
    const getSortIcon = (field: string) => {
        if (sortConfig.field === field) {
            return sortConfig.direction === 'asc' ?
                <ChevronUp className="w-3.5 h-3.5" /> :
                <ChevronDown className="w-3.5 h-3.5" />;
        }
        return null; // Don't show icon for non-active columns
    };

    if (users.length === 0) {
        return (
            <Card shadow="sm" className="rounded-lg">
                <div className="p-8 text-center">
                    <div className="text-gray-400 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                    <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card shadow="sm" className="rounded-lg overflow-hidden">
            <Table
                aria-label="Users table"
                shadow="none"
                classNames={{
                    wrapper: "p-0",
                    th: "bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider py-3",
                    td: "py-3"
                }}
            >
                <TableHeader>
                    <TableColumn
                        key="name"
                        className="cursor-pointer hover:bg-gray-100 transition-colors align-middle"
                        onClick={() => onSort('name')}
                    >
                        <span className="inline-flex items-center gap-1">
                            Name {getSortIcon('name')}
                        </span>
                    </TableColumn>
                    <TableColumn
                        key="email"
                        className="cursor-pointer hover:bg-gray-100 transition-colors align-middle"
                        onClick={() => onSort('email')}
                    >
                        <span className="inline-flex items-center gap-1">
                            Email {getSortIcon('email')}
                        </span>
                    </TableColumn>
                    <TableColumn
                        key="role"
                        className="cursor-pointer hover:bg-gray-100 transition-colors align-middle"
                        onClick={() => onSort('role')}
                    >
                        <span className="inline-flex items-center gap-1">
                            Role {getSortIcon('role')}
                        </span>
                    </TableColumn>
                    <TableColumn
                        key="position"
                        className="cursor-pointer hover:bg-gray-100 transition-colors align-middle"
                        onClick={() => onSort('position')}
                    >
                        <span className="inline-flex items-center gap-1">
                            Position {getSortIcon('position')}
                        </span>
                    </TableColumn>
                    <TableColumn
                        key="points"
                        className="cursor-pointer hover:bg-gray-100 transition-colors align-middle"
                        onClick={() => onSort('points')}
                    >
                        <span className="inline-flex items-center gap-1">
                            Points {getSortIcon('points')}
                        </span>
                    </TableColumn>
                    <TableColumn
                        key="joinDate"
                        className="cursor-pointer hover:bg-gray-100 transition-colors align-middle"
                        onClick={() => onSort('joinDate')}
                    >
                        <span className="inline-flex items-center gap-1">
                            Join Date {getSortIcon('joinDate')}
                        </span>
                    </TableColumn>
                    <TableColumn key="actions" className="align-middle">
                        Actions
                    </TableColumn>
                </TableHeader>
                <TableBody>
                    {users.map((user) => (
                        <TableRow key={user.id} className="hover:bg-gray-50 group">
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar
                                        name={user.name?.charAt(0)?.toUpperCase() || '?'}
                                        className="bg-gray-300 text-gray-700"
                                        size="md"
                                        radius="full"
                                    />
                                    <div>
                                        <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                            {user.name || 'No name'}
                                            {user.id === currentUserId && (
                                                <Chip
                                                    color="primary"
                                                    variant="flat"
                                                    size="sm"
                                                    className="rounded-full"
                                                >
                                                    You
                                                </Chip>
                                            )}
                                        </div>
                                        {user.pid && (
                                            <div className="text-sm text-gray-500">PID: {user.pid}</div>
                                        )}
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm text-gray-900">{user.email}</div>
                                {user.memberId && (
                                    <div className="text-sm text-gray-500">ID: {user.memberId}</div>
                                )}
                            </TableCell>
                            <TableCell>
                                <Chip
                                    className={`${UserDisplayService.getRoleColor(user.role)} rounded-full`}
                                    size="sm"
                                    variant="flat"
                                >
                                    {user.role}
                                </Chip>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm text-gray-900">{user.position || '-'}</div>
                                {user.major && (
                                    <Tooltip content={user.major}>
                                        <div className="text-sm text-gray-500">{truncateMajor(user.major)}</div>
                                    </Tooltip>
                                )}
                            </TableCell>
                            <TableCell>
                                <div className="text-sm text-gray-900">{user.points || 0}</div>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm text-gray-500">
                                    {user.joinDate ? user.joinDate.toDate().toLocaleDateString() : '-'}
                                </div>
                                {user.graduationYear && (
                                    <div className="text-xs text-gray-400">Grad: {user.graduationYear}</div>
                                )}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {(permissions.canEditUserRole(user) || permissions.canEditUserPosition(user)) && (
                                        <Tooltip content="Edit user">
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="light"
                                                color="primary"
                                                onPress={() => onEditUser(user)}
                                                className="rounded-md"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                        </Tooltip>
                                    )}

                                    {permissions.canDeleteUser(user) && (
                                        <Tooltip content="Delete user">
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="light"
                                                color="danger"
                                                onPress={() => onDeleteUser(user.id)}
                                                className="rounded-md"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </Tooltip>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
}
