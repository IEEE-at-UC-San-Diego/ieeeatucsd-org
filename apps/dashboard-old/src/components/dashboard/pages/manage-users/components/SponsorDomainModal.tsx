import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Select, SelectItem } from '@heroui/react';
import type { SponsorTier } from '../../../shared/types/firestore';
import type { SponsorDomainWithId } from '../hooks/useSponsorDomains';
import { showToast } from '../../../shared/utils/toast';

interface SponsorDomainModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { domain: string; organizationName: string; sponsorTier: SponsorTier }) => void;
    editingDomain: SponsorDomainWithId | null;
    loading?: boolean;
}

const SPONSOR_TIERS: SponsorTier[] = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];

export default function SponsorDomainModal({
    isOpen,
    onClose,
    onSave,
    editingDomain,
    loading = false
}: SponsorDomainModalProps) {
    const [formData, setFormData] = useState({
        domain: '',
        organizationName: '',
        sponsorTier: 'Bronze' as SponsorTier
    });

    useEffect(() => {
        if (isOpen) {
            if (editingDomain) {
                setFormData({
                    domain: editingDomain.domain,
                    organizationName: editingDomain.organizationName,
                    sponsorTier: editingDomain.sponsorTier
                });
            } else {
                setFormData({
                    domain: '',
                    organizationName: '',
                    sponsorTier: 'Bronze'
                });
            }
        }
    }, [isOpen, editingDomain]);

    const validateDomain = (domain: string): string | null => {
        if (!domain) {
            return 'Domain is required';
        }
        if (!domain.startsWith('@')) {
            return 'Domain must start with @';
        }
        if (domain.length < 3) {
            return 'Domain must have at least one character after @';
        }
        // Check for valid domain format (basic validation)
        const domainPart = domain.substring(1);
        if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domainPart)) {
            return 'Invalid domain format (e.g., @example.com)';
        }
        return null;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate domain
        const domainError = validateDomain(formData.domain);
        if (domainError) {
            showToast.error(domainError);
            return;
        }

        // Validate organization name
        if (!formData.organizationName.trim()) {
            showToast.error('Organization name is required');
            return;
        }

        onSave(formData);
    };

    const handleDomainChange = (value: string) => {
        // Auto-add @ if not present
        let processedValue = value.trim();
        if (processedValue && !processedValue.startsWith('@')) {
            processedValue = '@' + processedValue;
        }
        setFormData({ ...formData, domain: processedValue });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="md"
            classNames={{
                base: "rounded-2xl",
                header: "border-b border-gray-200 py-4 px-6",
                body: "py-6 px-6",
                footer: "border-t border-gray-200 py-4 px-6"
            }}
        >
            <ModalContent>
                <form onSubmit={handleSubmit}>
                    <ModalHeader className="flex flex-col gap-1">
                        <h3 className="text-lg font-medium text-gray-900">
                            {editingDomain ? 'Edit Sponsor Domain' : 'Add Sponsor Domain'}
                        </h3>
                    </ModalHeader>
                    <ModalBody className="space-y-4">
                        <Input
                            label="Email Domain"
                            placeholder="@example.com"
                            value={formData.domain}
                            onChange={(e) => handleDomainChange(e.target.value)}
                            isRequired
                            description="Enter the email domain (e.g., @tsmc.com)"
                            isDisabled={loading}
                            classNames={{
                                inputWrapper: "rounded-xl"
                            }}
                        />

                        <Input
                            label="Organization Name"
                            placeholder="e.g. TSMC"
                            value={formData.organizationName}
                            onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                            isRequired
                            isDisabled={loading}
                            classNames={{
                                inputWrapper: "rounded-xl"
                            }}
                        />

                        <Select
                            label="Sponsor Tier"
                            selectedKeys={[formData.sponsorTier]}
                            onChange={(e) => setFormData({ ...formData, sponsorTier: e.target.value as SponsorTier })}
                            isRequired
                            isDisabled={loading}
                            classNames={{
                                trigger: "rounded-xl"
                            }}
                        >
                            {SPONSOR_TIERS.map((tier) => (
                                <SelectItem key={tier}>
                                    {tier}
                                </SelectItem>
                            ))}
                        </Select>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="flat"
                            onPress={onClose}
                            isDisabled={loading}
                            className="rounded-xl font-medium"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            color="primary"
                            isLoading={loading}
                            className="rounded-xl font-medium"
                        >
                            {editingDomain ? 'Update' : 'Add'}
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
}

