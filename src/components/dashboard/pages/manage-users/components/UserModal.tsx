import React, { useState, useEffect } from 'react';
import { X, Mail, AlertTriangle, Trash2, Power, PowerOff, Edit3, Save, XCircle } from 'lucide-react';
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
    canManageEmails?: boolean;
    onEmailAction?: (action: 'disable' | 'enable' | 'delete', userId: string, email?: string) => Promise<void>;
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
    canManageEmails = false,
    onEmailAction,
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

    // Email management state
    const [emailOperationLoading, setEmailOperationLoading] = useState(false);
    const [showEmailConfirmDialog, setShowEmailConfirmDialog] = useState<{
        action: 'disable' | 'enable' | 'delete';
        email: string;
    } | null>(null);

    // Email alias editing state
    const [isEditingAlias, setIsEditingAlias] = useState(false);
    const [newAlias, setNewAlias] = useState('');

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

    const handleEmailAction = async (action: 'disable' | 'enable' | 'delete') => {
        if (!editingUser?.ieeeEmail || !onEmailAction) return;

        setShowEmailConfirmDialog({ action, email: editingUser.ieeeEmail });
    };

    const confirmEmailAction = async () => {
        if (!showEmailConfirmDialog || !editingUser?.id || !onEmailAction) return;

        setEmailOperationLoading(true);
        try {
            await onEmailAction(
                showEmailConfirmDialog.action,
                editingUser.id,
                showEmailConfirmDialog.email
            );
            setShowEmailConfirmDialog(null);
        } catch (error) {
            console.error('Email operation failed:', error);
        } finally {
            setEmailOperationLoading(false);
        }
    };

    const handleStartEditAlias = () => {
        if (editingUser?.ieeeEmail) {
            const currentAlias = editingUser.ieeeEmail.split('@')[0];
            setNewAlias(currentAlias);
            setIsEditingAlias(true);
        }
    };

    const handleCancelEditAlias = () => {
        setIsEditingAlias(false);
        setNewAlias('');
    };

    const handleSaveAlias = async () => {
        if (!editingUser?.ieeeEmail || !onEmailAction || !newAlias.trim()) return;

        // Validate alias format
        const aliasRegex = /^[a-zA-Z0-9._-]+$/;
        if (!aliasRegex.test(newAlias)) {
            alert('Invalid alias format. Only letters, numbers, dots, hyphens, and underscores are allowed.');
            return;
        }

        const currentAlias = editingUser.ieeeEmail.split('@')[0];
        if (newAlias === currentAlias) {
            setIsEditingAlias(false);
            return;
        }

        setEmailOperationLoading(true);
        try {
            // For now, we'll show a message that this requires manual intervention
            alert('Email alias updates require manual intervention. Please contact the webmaster to change the email alias.');
            setIsEditingAlias(false);
        } catch (error) {
            console.error('Alias update failed:', error);
        } finally {
            setEmailOperationLoading(false);
        }
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

                    {/* IEEE Email Management (Admin only) */}
                    {canManageEmails && editingUser && (
                        <div className="border-t border-gray-200 pt-6">
                            <div className="flex items-center gap-2 mb-4">
                                <Mail className="w-5 h-5 text-blue-600" />
                                <h3 className="text-lg font-medium text-gray-900">IEEE Email Management</h3>
                            </div>

                            {editingUser.hasIEEEEmail && editingUser.ieeeEmail ? (
                                <div className="space-y-4">
                                    <div className="p-4 bg-gray-50 rounded-lg">
                                        <div className="space-y-3">
                                            {/* Email Address with Edit Functionality */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Email Address
                                                </label>
                                                {isEditingAlias ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 flex items-center">
                                                            <input
                                                                type="text"
                                                                value={newAlias}
                                                                onChange={(e) => setNewAlias(e.target.value)}
                                                                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                                placeholder="Enter alias"
                                                            />
                                                            <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg text-gray-600">
                                                                @ieeeucsd.org
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={handleSaveAlias}
                                                            disabled={emailOperationLoading || !newAlias.trim()}
                                                            className="p-2 text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors disabled:opacity-50"
                                                        >
                                                            <Save className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleCancelEditAlias}
                                                            disabled={emailOperationLoading}
                                                            className="p-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <p className="font-medium text-gray-900">{editingUser.ieeeEmail}</p>
                                                        <button
                                                            type="button"
                                                            onClick={handleStartEditAlias}
                                                            className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
                                                            title="Edit email alias"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Email Metadata */}
                                            <div className="space-y-1">
                                                <p className="text-sm text-gray-600">
                                                    Created: {editingUser.ieeeEmailCreatedAt ?
                                                        new Date(editingUser.ieeeEmailCreatedAt.toDate()).toLocaleDateString() :
                                                        'Unknown'
                                                    }
                                                </p>
                                                <p className="text-sm">
                                                    Status: <span className={`font-medium ${editingUser.ieeeEmailStatus === 'disabled' ? 'text-red-600' : 'text-green-600'
                                                        }`}>
                                                        {editingUser.ieeeEmailStatus === 'disabled' ? 'Disabled' : 'Active'}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {editingUser.ieeeEmailStatus !== 'disabled' ? (
                                            <button
                                                type="button"
                                                onClick={() => handleEmailAction('disable')}
                                                className="flex items-center gap-2 px-3 py-2 text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition-colors"
                                                disabled={emailOperationLoading}
                                            >
                                                <PowerOff className="w-4 h-4" />
                                                Disable Email
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleEmailAction('enable')}
                                                className="flex items-center gap-2 px-3 py-2 text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
                                                disabled={emailOperationLoading}
                                            >
                                                <Power className="w-4 h-4" />
                                                Enable Email
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => handleEmailAction('delete')}
                                            className="flex items-center gap-2 px-3 py-2 text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                                            disabled={emailOperationLoading}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete Email
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-gray-50 rounded-lg text-center">
                                    <p className="text-gray-600">This user has not created an IEEE email address yet.</p>
                                </div>
                            )}
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

            {/* Email Action Confirmation Dialog */}
            {showEmailConfirmDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <AlertTriangle className="w-6 h-6 text-orange-500" />
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Confirm Email {showEmailConfirmDialog.action === 'delete' ? 'Deletion' :
                                        showEmailConfirmDialog.action === 'disable' ? 'Disable' : 'Enable'}
                                </h3>
                            </div>

                            <p className="text-gray-600 mb-6">
                                {showEmailConfirmDialog.action === 'delete' &&
                                    `Are you sure you want to permanently delete the email address "${showEmailConfirmDialog.email}"? This action cannot be undone.`
                                }
                                {showEmailConfirmDialog.action === 'disable' &&
                                    `Are you sure you want to disable the email address "${showEmailConfirmDialog.email}"? The user will not be able to receive new emails.`
                                }
                                {showEmailConfirmDialog.action === 'enable' &&
                                    `Are you sure you want to enable the email address "${showEmailConfirmDialog.email}"?`
                                }
                            </p>

                            <div className="flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowEmailConfirmDialog(null)}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                                    disabled={emailOperationLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmEmailAction}
                                    className={`px-6 py-2 text-white rounded-lg transition-colors flex items-center gap-2 ${showEmailConfirmDialog.action === 'delete'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : showEmailConfirmDialog.action === 'disable'
                                            ? 'bg-orange-600 hover:bg-orange-700'
                                            : 'bg-green-600 hover:bg-green-700'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    disabled={emailOperationLoading}
                                >
                                    {emailOperationLoading && (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    )}
                                    <span>
                                        {showEmailConfirmDialog.action === 'delete' ? 'Delete' :
                                            showEmailConfirmDialog.action === 'disable' ? 'Disable' : 'Enable'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
