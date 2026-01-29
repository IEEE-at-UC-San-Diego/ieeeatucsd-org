import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Select, SelectItem, Textarea, Spacer } from '@heroui/react';
import type { UserRole } from '../../../shared/types/firestore';
import type { InviteModalData } from '../types/UserManagementTypes';

interface InviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (inviteData: InviteModalData) => void;
    availableRoles: UserRole[];
    loading?: boolean;
}

export default function InviteModal({
    isOpen,
    onClose,
    onSave,
    availableRoles,
    loading = false
}: InviteModalProps) {
    const [formData, setFormData] = useState<InviteModalData>({
        name: '',
        email: '',
        role: 'General Officer',
        position: '',
        message: 'You have been invited to join IEEE UCSD as an officer. Please click the link below to create your account and get started.'
    });

    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: '',
                email: '',
                role: 'General Officer',
                position: '',
                message: 'You have been invited to join IEEE UCSD as an officer. Please click the link below to create your account and get started.'
            });
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="md"
            classNames={{
                base: "rounded-lg",
                header: "border-b border-gray-200",
                body: "py-6",
                footer: "border-t border-gray-200"
            }}
        >
            <ModalContent>
                <form onSubmit={handleSubmit}>
                    <ModalHeader>
                        <h3 className="text-lg font-medium text-gray-900">Invite Officer</h3>
                    </ModalHeader>
                    <ModalBody className="space-y-4">
                        <Input
                            type="text"
                            label="Name"
                            placeholder="Enter name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            isRequired
                            classNames={{
                                inputWrapper: "rounded-lg"
                            }}
                        />

                        <Input
                            type="email"
                            label="Email"
                            placeholder="Enter email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            isRequired
                            classNames={{
                                inputWrapper: "rounded-lg"
                            }}
                        />

                        <Select
                            label="Role"
                            selectedKeys={[formData.role]}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
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
                            value={formData.position}
                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                            classNames={{
                                inputWrapper: "rounded-lg"
                            }}
                        />

                        <Textarea
                            label="Message"
                            placeholder="Enter invitation message"
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            minRows={3}
                            classNames={{
                                inputWrapper: "rounded-lg"
                            }}
                        />
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
                        <Button
                            type="submit"
                            color="primary"
                            isLoading={loading}
                            className="rounded-lg"
                        >
                            {loading ? 'Sending...' : 'Send Invite'}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
}
