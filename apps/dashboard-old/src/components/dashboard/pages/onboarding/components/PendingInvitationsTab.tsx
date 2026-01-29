import React, { useState } from 'react';
import { RefreshCw, Mail, CheckCircle, XCircle, Clock, AlertCircle, Send } from 'lucide-react';
import { Card, CardBody, Button, Chip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Tooltip } from '@heroui/react';
import type { OfficerInvitation } from '../../../shared/types/firestore';
import { showToast } from '../../../shared/utils/toast';

interface PendingInvitationsTabProps {
    invitations: (OfficerInvitation & { id: string })[];
    loading: boolean;
    onRefresh: () => Promise<void>;
    onResend: (invitationId: string) => Promise<void>;
}

export default function PendingInvitationsTab({ invitations, loading, onRefresh, onResend }: PendingInvitationsTabProps) {
    const [refreshing, setRefreshing] = useState(false);
    const [resendingId, setResendingId] = useState<string | null>(null);

    const handleRefresh = async () => {
        setRefreshing(true);
        await onRefresh();
        setRefreshing(false);
    };

    const handleResend = async (invitationId: string, name: string) => {
        setResendingId(invitationId);
        try {
            await onResend(invitationId);
            showToast.success(`Invitation resent to ${name}`);
        } catch (error) {
            showToast.error(`Failed to resend invitation to ${name}`);
        } finally {
            setResendingId(null);
        }
    };

    const getStatusChip = (status: OfficerInvitation['status']) => {
        switch (status) {
            case 'pending':
                return <Chip color="warning" variant="flat" startContent={<Clock className="w-3 h-3" />}>Pending</Chip>;
            case 'accepted':
                return <Chip color="success" variant="flat" startContent={<CheckCircle className="w-3 h-3" />}>Accepted</Chip>;
            case 'declined':
                return <Chip color="danger" variant="flat" startContent={<XCircle className="w-3 h-3" />}>Declined</Chip>;
            case 'expired':
                return <Chip color="default" variant="flat" startContent={<AlertCircle className="w-3 h-3" />}>Expired</Chip>;
            default:
                return <Chip>{status}</Chip>;
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return 'Invalid date';
        }
    };

    const isExpired = (invitation: OfficerInvitation) => {
        if (!invitation.expiresAt) return false;
        const expiryDate = invitation.expiresAt.toDate ? invitation.expiresAt.toDate() : new Date(invitation.expiresAt);
        return new Date() > expiryDate && invitation.status === 'pending';
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">All Invitations</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        View and track all officer invitations sent through the system
                    </p>
                </div>
                <Button
                    color="primary"
                    variant="bordered"
                    onPress={handleRefresh}
                    isLoading={refreshing}
                    startContent={!refreshing && <RefreshCw className="w-4 h-4" />}
                    className="rounded-lg"
                >
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardBody className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Total</p>
                                <p className="text-2xl font-bold text-gray-900">{invitations.length}</p>
                            </div>
                            <Mail className="w-8 h-8 text-gray-400" />
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardBody className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Pending</p>
                                <p className="text-2xl font-bold text-yellow-600">
                                    {invitations.filter(i => i.status === 'pending').length}
                                </p>
                            </div>
                            <Clock className="w-8 h-8 text-yellow-400" />
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardBody className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Accepted</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {invitations.filter(i => i.status === 'accepted').length}
                                </p>
                            </div>
                            <CheckCircle className="w-8 h-8 text-green-400" />
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardBody className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Declined</p>
                                <p className="text-2xl font-bold text-red-600">
                                    {invitations.filter(i => i.status === 'declined').length}
                                </p>
                            </div>
                            <XCircle className="w-8 h-8 text-red-400" />
                        </div>
                    </CardBody>
                </Card>
            </div>

            {/* Invitations Table */}
            <Card>
                <CardBody className="p-0">
                    {invitations.length === 0 ? (
                        <div className="p-8 text-center">
                            <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">No invitations sent yet</p>
                            <p className="text-sm text-gray-400 mt-1">
                                Use the Invitation Flow or Direct Onboarding tabs to get started
                            </p>
                        </div>
                    ) : (
                        <Table aria-label="Invitations table" removeWrapper>
                            <TableHeader>
                                <TableColumn>NAME</TableColumn>
                                <TableColumn>EMAIL</TableColumn>
                                <TableColumn>POSITION</TableColumn>
                                <TableColumn>ROLE</TableColumn>
                                <TableColumn>STATUS</TableColumn>
                                <TableColumn>INVITED</TableColumn>
                                <TableColumn>EXPIRES</TableColumn>
                                <TableColumn>ACTIONS</TableColumn>
                            </TableHeader>
                            <TableBody>
                                {invitations.map((invitation) => (
                                    <TableRow key={invitation.id}>
                                        <TableCell>
                                            <div className="font-medium text-gray-900">{invitation.name}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm text-gray-600">{invitation.email}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm text-gray-900">{invitation.position}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Chip size="sm" variant="flat">{invitation.role}</Chip>
                                        </TableCell>
                                        <TableCell>
                                            {getStatusChip(isExpired(invitation) ? 'expired' : invitation.status)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm text-gray-600">
                                                {formatDate(invitation.invitedAt)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className={`text-sm ${isExpired(invitation) ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                                {formatDate(invitation.expiresAt)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {invitation.status === 'pending' && (
                                                <Tooltip content="Resend invitation email">
                                                    <Button
                                                        isIconOnly
                                                        size="sm"
                                                        variant="light"
                                                        color="primary"
                                                        onPress={() => handleResend(invitation.id!, invitation.name)}
                                                        isLoading={resendingId === invitation.id}
                                                        isDisabled={resendingId !== null}
                                                        className="rounded-lg"
                                                    >
                                                        {resendingId !== invitation.id && <Send className="w-4 h-4" />}
                                                    </Button>
                                                </Tooltip>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}

