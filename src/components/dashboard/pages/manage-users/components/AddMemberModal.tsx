import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../../../firebase/client';
import type { UserRole } from '../../../shared/types/firestore';

interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    position?: string;
}

interface AddMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (userId: string, newRole: UserRole, newPosition: string) => void;
    availableRoles: UserRole[];
    loading?: boolean;
}

export default function AddMemberModal({
    isOpen,
    onClose,
    onSave,
    availableRoles,
    loading = false
}: AddMemberModalProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [members, setMembers] = useState<User[]>([]);
    const [filteredMembers, setFilteredMembers] = useState<User[]>([]);
    const [selectedMember, setSelectedMember] = useState<User | null>(null);
    const [newRole, setNewRole] = useState<UserRole>('General Officer');
    const [newPosition, setNewPosition] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchMembers();
            setSearchTerm('');
            setSelectedMember(null);
            setNewRole('General Officer');
            setNewPosition('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (searchTerm) {
            const filtered = members.filter(member =>
                (member.name && member.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (member.email && member.email.toLowerCase().includes(searchTerm.toLowerCase()))
            );

            setFilteredMembers(filtered);
        } else {
            setFilteredMembers(members);
        }
    }, [searchTerm, members]);

    const fetchMembers = async () => {
        setIsLoading(true);
        try {
            // Get all users and filter for Members on the client side
            // This is because Firestore queries with where() can be restrictive
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);
            const allUsers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as User[];

            // Filter for users who can be promoted (Members and lower-level officers)
            const promotableRoles = ['Member', 'General Officer', 'Member at Large', 'Past Officer'];
            const membersList = allUsers.filter(user => promotableRoles.includes(user.role));
            setMembers(membersList);
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedMember) {
            onSave(selectedMember.id, newRole, newPosition);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Promote User</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Search Users */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Search Users
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name or email..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {/* Users List */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select User
                        </label>
                        <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                            {isLoading ? (
                                <div className="p-4 text-center text-gray-500">Loading users...</div>
                            ) : filteredMembers.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">
                                    {searchTerm ? 'No users found matching your search.' : 'No users available to promote.'}
                                </div>
                            ) : (
                                filteredMembers.map(member => (
                                    <div
                                        key={member.id}
                                        onClick={() => setSelectedMember(member)}
                                        className={`p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${selectedMember?.id === member.id
                                            ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-500 ring-inset'
                                            : ''
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-medium text-gray-900">{member.name}</div>
                                                <div className="text-sm text-gray-500">{member.email}</div>
                                                <div className="text-xs text-gray-400">Current role: {member.role}</div>
                                            </div>
                                            {selectedMember?.id === member.id && (
                                                <div className="text-blue-600">
                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Role and Position Selection */}
                    {selectedMember && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    New Role
                                </label>
                                <select
                                    value={newRole}
                                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    {availableRoles.filter(role => role !== 'Member').map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Position
                                </label>
                                <input
                                    type="text"
                                    value={newPosition}
                                    onChange={(e) => setNewPosition(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="e.g., Treasurer, Secretary"
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                >
                                    {loading ? 'Promoting...' : 'Promote User'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
