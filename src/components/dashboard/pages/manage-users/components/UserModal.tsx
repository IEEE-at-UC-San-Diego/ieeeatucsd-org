import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { UserRole } from '../../../shared/types/firestore';
import type { UserModalData } from '../types/UserManagementTypes';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (userData: UserModalData) => void;
    editingUser: UserModalData | null;
    availableRoles: UserRole[];
    canEditRole: boolean;
    canEditPosition: boolean;
    canEditPoints: boolean;
    loading?: boolean;
}

export default function UserModal({
    isOpen,
    onClose,
    onSave,
    editingUser,
    availableRoles,
    canEditRole,
    canEditPosition,
    canEditPoints,
    loading = false
}: UserModalProps) {
    const [formData, setFormData] = useState<UserModalData>({
        name: '',
        email: '',
        role: 'Member',
        position: '',
        status: 'active',
        pid: '',
        memberId: '',
        major: '',
        graduationYear: undefined,
        points: 0
    });

    useEffect(() => {
        if (editingUser) {
            setFormData(editingUser);
        } else {
            setFormData({
                name: '',
                email: '',
                role: 'Member',
                position: '',
                status: 'active',
                pid: '',
                memberId: '',
                major: '',
                graduationYear: undefined,
                points: 0
            });
        }
    }, [editingUser, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    const handleInputChange = (field: keyof UserModalData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {editingUser ? 'Edit User' : 'Add New User'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        disabled={loading}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Basic Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email *
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleInputChange('email', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                                disabled={!!editingUser} // Can't change email for existing users
                            />
                        </div>
                    </div>

                    {/* Role and Position */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Role *
                            </label>
                            <select
                                value={formData.role}
                                onChange={(e) => handleInputChange('role', e.target.value as UserRole)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                disabled={!canEditRole}
                                required
                            >
                                {availableRoles.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                            {!canEditRole && (
                                <p className="text-xs text-gray-500 mt-1">
                                    You don't have permission to change this user's role
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Position
                            </label>
                            <input
                                type="text"
                                value={formData.position || ''}
                                onChange={(e) => handleInputChange('position', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., President, Vice President, etc."
                                disabled={!canEditPosition}
                            />
                            {!canEditPosition && (
                                <p className="text-xs text-gray-500 mt-1">
                                    You don't have permission to change this user's position
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Status *
                        </label>
                        <select
                            value={formData.status}
                            onChange={(e) => handleInputChange('status', e.target.value as 'active' | 'inactive' | 'suspended')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="suspended">Suspended</option>
                        </select>
                    </div>

                    {/* Additional Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                PID
                            </label>
                            <input
                                type="text"
                                value={formData.pid || ''}
                                onChange={(e) => handleInputChange('pid', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Student ID"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Member ID
                            </label>
                            <input
                                type="text"
                                value={formData.memberId || ''}
                                onChange={(e) => handleInputChange('memberId', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="IEEE Member ID"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Major
                            </label>
                            <input
                                type="text"
                                value={formData.major || ''}
                                onChange={(e) => handleInputChange('major', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., Computer Science"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Graduation Year
                            </label>
                            <input
                                type="number"
                                value={formData.graduationYear || ''}
                                onChange={(e) => handleInputChange('graduationYear', e.target.value ? parseInt(e.target.value) : undefined)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., 2025"
                                min="2020"
                                max="2030"
                            />
                        </div>
                    </div>

                    {/* Points (Admin only) */}
                    {canEditPoints && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Points
                            </label>
                            <input
                                type="number"
                                value={formData.points || 0}
                                onChange={(e) => handleInputChange('points', parseInt(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="0"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Only administrators can modify points
                            </p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            disabled={loading}
                        >
                            {loading && (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            )}
                            <span>{editingUser ? 'Update User' : 'Add User'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
