import React from 'react';
import { Edit, Trash2, ChevronUp, ChevronDown, ChevronsUpDown, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
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

export default function UserTable({
    users,
    sortConfig,
    onSort,
    onEditUser,
    onDeleteUser,
    permissions,
    currentUserId
}: UserTableProps) {
    const SortableHeader = ({ field, children, className = "" }: { 
        field: string; 
        children: React.ReactNode; 
        className?: string 
    }) => (
        <th
            className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${className}`}
            onClick={() => onSort(field)}
        >
            <div className="flex items-center gap-1">
                {children}
                {sortConfig.field === field ? (
                    sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                ) : (
                    <ChevronsUpDown className="w-4 h-4 opacity-50" />
                )}
            </div>
        </th>
    );

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'active':
                return <CheckCircle className="w-4 h-4" />;
            case 'inactive':
                return <Clock className="w-4 h-4" />;
            case 'suspended':
                return <XCircle className="w-4 h-4" />;
            default:
                return <AlertCircle className="w-4 h-4" />;
        }
    };

    if (users.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow">
                <div className="p-8 text-center">
                    <div className="text-gray-400 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
                    <p className="text-gray-500">Try adjusting your search or filter criteria.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <SortableHeader field="name">Name</SortableHeader>
                            <SortableHeader field="email">Email</SortableHeader>
                            <SortableHeader field="role">Role</SortableHeader>
                            <SortableHeader field="position">Position</SortableHeader>
                            <SortableHeader field="status">Status</SortableHeader>
                            <SortableHeader field="points">Points</SortableHeader>
                            <SortableHeader field="joinDate">Join Date</SortableHeader>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10">
                                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                                <span className="text-sm font-medium text-gray-700">
                                                    {user.name?.charAt(0)?.toUpperCase() || '?'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">
                                                {user.name || 'No name'}
                                                {user.id === currentUserId && (
                                                    <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        You
                                                    </span>
                                                )}
                                            </div>
                                            {user.pid && (
                                                <div className="text-sm text-gray-500">PID: {user.pid}</div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{user.email}</div>
                                    {user.memberId && (
                                        <div className="text-sm text-gray-500">ID: {user.memberId}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${UserDisplayService.getRoleColor(user.role)}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">{user.position || '-'}</div>
                                    {user.major && (
                                        <div className="text-sm text-gray-500">{user.major}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${UserDisplayService.getStatusColor(user.status)}`}>
                                        {getStatusIcon(user.status)}
                                        <span className="ml-1">{user.status}</span>
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {user.points || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {user.joinDate ? user.joinDate.toDate().toLocaleDateString() : '-'}
                                    {user.graduationYear && (
                                        <div className="text-xs">Grad: {user.graduationYear}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex items-center gap-2">
                                        {(permissions.canEditUserRole(user) || permissions.canEditUserPosition(user)) && (
                                            <button
                                                onClick={() => onEditUser(user)}
                                                className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                                                title="Edit user"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        )}
                                        
                                        {permissions.canDeleteUser(user) && (
                                            <button
                                                onClick={() => onDeleteUser(user.id)}
                                                className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                                                title="Delete user"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        
                                        {permissions.isOAuthUser(user.id) && (
                                            <span 
                                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                                                title="OAuth user - password cannot be changed"
                                            >
                                                OAuth
                                            </span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
