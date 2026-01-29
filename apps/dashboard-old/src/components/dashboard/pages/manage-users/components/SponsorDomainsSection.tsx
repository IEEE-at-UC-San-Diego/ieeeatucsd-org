import React, { useState } from 'react';
import { Plus, Edit, Trash2, Building2, Shield } from 'lucide-react';
import { useSponsorDomains } from '../hooks/useSponsorDomains';
import type { SponsorDomainWithId } from '../hooks/useSponsorDomains';
import SponsorDomainModal from './SponsorDomainModal';
import { Spinner, Card, CardBody, Button, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Tooltip } from '@heroui/react';

interface SponsorDomainsSectionProps {
    isAdmin: boolean;
}

export default function SponsorDomainsSection({ isAdmin }: SponsorDomainsSectionProps) {
    const {
        domains,
        loading,
        addDomain,
        updateDomain,
        deleteDomain,
    } = useSponsorDomains();

    const [showModal, setShowModal] = useState(false);
    const [editingDomain, setEditingDomain] = useState<SponsorDomainWithId | null>(null);
    const [deletingDomainId, setDeletingDomainId] = useState<string | null>(null);

    const handleAddClick = () => {
        setEditingDomain(null);
        setShowModal(true);
    };

    const handleEditClick = (domain: SponsorDomainWithId) => {
        setEditingDomain(domain);
        setShowModal(true);
    };

    const handleSave = async (formData: { domain: string; organizationName: string; sponsorTier: any }) => {
        if (editingDomain) {
            await updateDomain(editingDomain.id, formData);
        } else {
            await addDomain(formData);
        }

        setShowModal(false);
        setEditingDomain(null);
    };

    const handleDelete = async (domainId: string) => {
        if (window.confirm('Are you sure you want to delete this sponsor domain? Users with this domain will no longer be auto-assigned as sponsors.')) {
            await deleteDomain(domainId);
            setDeletingDomainId(null);
        }
    };

    const getTierColor = (tier: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
        switch (tier) {
            case 'Diamond':
                return 'primary';
            case 'Platinum':
                return 'secondary';
            case 'Gold':
                return 'warning';
            case 'Silver':
                return 'default';
            case 'Bronze':
                return 'danger'; // Using danger for bronze (orange-ish) or default
            default:
                return 'default';
        }
    };

    if (!isAdmin) {
        return null; // Only show to administrators
    }

    return (
        <Card shadow="sm" className="rounded-2xl">
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Building2 className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Sponsor Domain Auto-Detection</h3>
                            <p className="text-sm text-gray-500">
                                Configure email domains for automatic sponsor assignment
                            </p>
                        </div>
                    </div>
                    <Button
                        onPress={handleAddClick}
                        color="primary"
                        startContent={<Plus className="w-4 h-4" />}
                        className="rounded-xl font-medium"
                    >
                        Add Domain
                    </Button>
                </div>
            </div>

            <CardBody className="p-6">
                {loading ? (
                    <div className="text-center py-8">
                        <Spinner size="lg" color="primary" />
                        <p className="mt-2 text-sm text-gray-500">Loading sponsor domains...</p>
                    </div>
                ) : domains.length === 0 ? (
                    <div className="text-center py-8">
                        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500">No sponsor domains configured</p>
                        <p className="text-sm text-gray-400 mt-1">
                            Add a domain to automatically assign sponsor status to users with matching email addresses
                        </p>
                    </div>
                ) : (
                    <Table
                        aria-label="Sponsor domains table"
                        shadow="none"
                        classNames={{
                            wrapper: "p-0",
                            th: "bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider py-3",
                            td: "py-3"
                        }}
                    >
                        <TableHeader>
                            <TableColumn>DOMAIN</TableColumn>
                            <TableColumn>ORGANIZATION</TableColumn>
                            <TableColumn>TIER</TableColumn>
                            <TableColumn align="end">ACTIONS</TableColumn>
                        </TableHeader>
                        <TableBody>
                            {domains.map((domain) => (
                                <TableRow key={domain.id} className="hover:bg-gray-50 group">
                                    <TableCell>
                                        <span className="text-sm font-mono text-gray-900">{domain.domain}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-gray-900">{domain.organizationName}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            color={getTierColor(domain.sponsorTier)}
                                            variant="flat"
                                            size="sm"
                                        >
                                            {domain.sponsorTier}
                                        </Chip>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Tooltip content="Edit domain">
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    color="primary"
                                                    onPress={() => handleEditClick(domain)}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </Tooltip>
                                            <Tooltip content="Delete domain">
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    color="danger"
                                                    onPress={() => handleDelete(domain.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </Tooltip>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardBody>

            {/* Modal */}
            <SponsorDomainModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingDomain(null);
                }}
                onSave={handleSave}
                editingDomain={editingDomain}
                loading={loading}
            />
        </Card>
    );
}

