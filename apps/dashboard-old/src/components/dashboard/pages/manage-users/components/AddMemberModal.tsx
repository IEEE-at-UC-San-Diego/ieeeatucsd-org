import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Select, SelectItem, Spacer, Card, CardBody, Spinner } from '@heroui/react';
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

    const handleSubmit = () => {
        if (selectedMember) {
            onSave(selectedMember.id, newRole, newPosition);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="2xl"
            scrollBehavior="inside"
            classNames={{
                base: "rounded-lg",
                header: "border-b border-gray-200",
                body: "py-6",
                footer: "border-t border-gray-200"
            }}
        >
            <ModalContent>
                <ModalHeader>
                    <h3 className="text-lg font-medium text-gray-900">Promote User</h3>
                </ModalHeader>

                <ModalBody className="space-y-4">
                    {/* Search Users */}
                    <Input
                        type="text"
                        label="Search Users"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        startContent={<Search className="w-4 h-4 text-gray-400" />}
                        classNames={{
                            inputWrapper: "rounded-lg"
                        }}
                    />

                    {/* Users List */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select User
                        </label>
                        <Card shadow="sm" className="rounded-lg max-h-64 overflow-y-auto">
                            <CardBody className="p-0">
                                {isLoading ? (
                                    <div className="p-8 flex justify-center">
                                        <Spinner size="lg" />
                                    </div>
                                ) : filteredMembers.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">
                                        {searchTerm ? 'No users found matching your search.' : 'No users available to promote.'}
                                    </div>
                                ) : (
                                    filteredMembers.map(member => (
                                        <div
                                            key={member.id}
                                            onClick={() => setSelectedMember(member)}
                                            className={`p-4 border-b border-gray-200 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors ${selectedMember?.id === member.id
                                                ? 'bg-primary-50 border-primary-200'
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
                                                    <div className="text-primary">
                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </CardBody>
                        </Card>
                    </div>

                    {/* Role and Position Selection */}
                    {selectedMember && (
                        <>
                            <Select
                                label="New Role"
                                selectedKeys={[newRole]}
                                onChange={(e) => setNewRole(e.target.value as UserRole)}
                                classNames={{
                                    trigger: "rounded-lg"
                                }}
                            >
                                {availableRoles.filter(role => role !== 'Member').map(role => (
                                    <SelectItem key={role}>
                                        {role}
                                    </SelectItem>
                                ))}
                            </Select>

                            <Input
                                type="text"
                                label="Position"
                                placeholder="e.g., Treasurer, Secretary"
                                value={newPosition}
                                onChange={(e) => setNewPosition(e.target.value)}
                                classNames={{
                                    inputWrapper: "rounded-lg"
                                }}
                            />
                        </>
                    )}
                </ModalBody>

                <ModalFooter>
                    <Button
                        variant="flat"
                        onPress={onClose}
                        className="rounded-lg"
                    >
                        Cancel
                    </Button>
                    <Spacer />
                    {selectedMember && (
                        <Button
                            color="success"
                            onPress={handleSubmit}
                            isLoading={loading}
                            className="rounded-lg"
                        >
                            {loading ? 'Promoting...' : 'Promote User'}
                        </Button>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
