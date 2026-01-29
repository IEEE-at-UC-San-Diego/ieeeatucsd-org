import { useState, useEffect } from 'react';
import { Calendar, User, CheckCircle, XCircle, Clock, DollarSign, Receipt, AlertCircle, MessageCircle, Eye, CreditCard, ChevronUp, ChevronDown, ChevronsUpDown, Trash2, Search } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db } from '../../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../../firebase/client';
import { Card, CardHeader, CardBody, Button, Chip, Select, SelectItem, Skeleton, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/react';
import ManageReimbursementDetails from './ManageReimbursementDetails';
import type { UserRole } from '../../shared/types/firestore';
import { PublicProfileService } from '../../shared/services/publicProfile';
import { TableSkeleton } from '../../../ui/loading';
import { showToast } from '../../shared/utils/toast';

interface Reimbursement {
    id: string;
    title: string;
    totalAmount: number;
    dateOfPurchase: string;
    status: 'submitted' | 'declined' | 'approved' | 'paid';
    submittedBy: string;
    department: string;
    businessPurpose: string;
    expenses?: any[];
    receipts?: any[];
    submittedAt: any;
    additionalInfo?: string;
    auditNotes?: { note: string; createdBy: string; timestamp: any; }[];
    auditLogs?: { action: string; createdBy: string; timestamp: any; }[];
    auditRequests?: {
        auditorId: string;
        requestedBy: string;
        requestedAt: any;
        status: 'pending' | 'completed' | 'declined';
        auditResult?: 'approved' | 'needs_changes';
        auditNotes?: string;
        completedAt?: any;
    }[];
    requiresExecutiveOverride?: boolean;
    paymentConfirmation?: {
        confirmationNumber: string;
        photoAttachment: string;
        paidBy: string;
        paidAt: any;
    };
}

const getStatusColor = (status: string): "default" | "primary" | "secondary" | "success" | "warning" | "danger" => {
    switch (status) {
        case 'submitted':
            return 'warning';
        case 'under_review':
            return 'primary';
        case 'approved':
            return 'success';
        case 'paid':
            return 'success';
        case 'declined':
            return 'danger';
        default:
            return 'default';
    }
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'submitted':
            return <AlertCircle className="w-4 h-4" />;
        case 'approved':
            return <CheckCircle className="w-4 h-4" />;
        case 'paid':
            return <CreditCard className="w-4 h-4" />;
        case 'declined':
            return <XCircle className="w-4 h-4" />;
        default:
            return <AlertCircle className="w-4 h-4" />;
    }
};

const getStatusDisplayName = (status: string) => {
    switch (status) {
        case 'submitted':
            return 'Submitted';
        case 'approved':
            return 'Approved (Not Paid)';
        case 'paid':
            return 'Approved (Paid)';
        case 'declined':
            return 'Declined';
        default:
            return status;
    }
};

export default function ManageReimbursementsContent() {
    const [user] = useAuthState(auth);
    const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReimbursement, setSelectedReimbursement] = useState<Reimbursement | null>(null);
    const [auditReimbursement, setAuditReimbursement] = useState<Reimbursement | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set(['submitted', 'approved']));

    // Calculate receipt total if it's 0 or missing
    const calculateReceiptTotal = (receipt: any) => {
        if (receipt.total && receipt.total > 0) {
            return receipt.total;
        }
        // Calculate subtotal from line items if needed
        let subtotal = receipt.subtotal || 0;
        if (subtotal === 0 && receipt.lineItems && receipt.lineItems.length > 0) {
            subtotal = receipt.lineItems.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
        }
        return subtotal + (receipt.tax || 0) + (receipt.tip || 0) + (receipt.shipping || 0) + (receipt.otherCharges || 0);
    };

    // Calculate total amount for a reimbursement
    const calculateTotalAmount = (reimbursement: Reimbursement) => {
        // Handle new multi-receipt structure
        if (reimbursement.receipts && reimbursement.receipts.length > 0) {
            return reimbursement.receipts.reduce((sum: number, receipt: any) => {
                return sum + calculateReceiptTotal(receipt);
            }, 0);
        }
        // Handle legacy expenses structure
        if (reimbursement.expenses && reimbursement.expenses.length > 0) {
            return reimbursement.expenses.reduce((sum: number, expense: any) => {
                return sum + (expense.amount || 0);
            }, 0);
        }
        return 0;
    };
    const [userNames, setUserNames] = useState<{ [key: string]: string }>({});
    const [sortField, setSortField] = useState<string>('submittedAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; reimbursement: Reimbursement | null }>({ isOpen: false, reimbursement: null });
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (!user) return;

        // Fetch current user's role
        const fetchUserRole = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setCurrentUserRole(userData.role || 'Member');
                }
            } catch (error) {
                console.error('Error fetching user role:', error);
                setCurrentUserRole('Member'); // Default to Member if error
            }
        };

        fetchUserRole();
    }, [user]);

    // Check if user has permission to access reimbursement management
    const hasReimbursementAccess = () => {
        return currentUserRole === 'Executive Officer' || currentUserRole === 'Administrator';
    };

    // If user doesn't have access, show access denied message
    if (currentUserRole && !hasReimbursementAccess()) {
        return (
            <div className="flex-1 overflow-auto p-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <div className="flex items-center">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                        <div className="ml-4">
                            <h3 className="text-lg font-semibold text-red-800">Access Restricted</h3>
                            <p className="text-red-700">Only Executive Officers and Administrators can access reimbursement management.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    useEffect(() => {
        const q = query(
            collection(db, 'reimbursements'),
            orderBy('submittedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const reimbursementData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Reimbursement[];

            setReimbursements(reimbursementData);

            // Fetch user names for all submitters from public profiles
            const userIds = [...new Set(reimbursementData.map(r => r.submittedBy))];
            const newUserNames: { [key: string]: string } = {};

            await Promise.all(userIds.map(async (userId) => {
                if (userId && !userNames[userId]) {
                    try {
                        // First try to get from public profile
                        const publicProfile = await PublicProfileService.getPublicProfile(userId);
                        if (publicProfile && publicProfile.name) {
                            newUserNames[userId] = publicProfile.name;
                        } else {
                            // Fallback to users collection for officers (they have access)
                            try {
                                const userDoc = await getDoc(doc(db, 'users', userId));
                                if (userDoc.exists()) {
                                    const userData = userDoc.data();
                                    newUserNames[userId] = userData.name || userData.email || userId;
                                } else {
                                    newUserNames[userId] = userId;
                                }
                            } catch (fallbackError) {
                                console.warn(`Could not fetch user data for ${userId}, using ID as name`);
                                newUserNames[userId] = userId;
                            }
                        }
                    } catch (error) {
                        console.error(`Error fetching user ${userId}:`, error);
                        newUserNames[userId] = userId;
                    }
                }
            }));

            setUserNames(prev => ({ ...prev, ...newUserNames }));
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const updateReimbursementStatus = async (reimbursementId: string, newStatus: string, auditNote?: string, paymentInfo?: any) => {
        if (!user) return;

        try {
            // Get current reimbursement for previous status
            const currentReimbursement = reimbursements.find(r => r.id === reimbursementId);
            const previousStatus = currentReimbursement?.status;

            // Get current user name
            let currentUserName = 'Unknown User';
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    currentUserName = userData.name || userData.email || 'Unknown User';
                }
            } catch (error) {
                console.error('Error fetching user name:', error);
            }

            const updateData: any = {
                status: newStatus,
                auditLogs: [
                    ...reimbursements.find(r => r.id === reimbursementId)?.auditLogs || [],
                    {
                        action: `Status changed to ${newStatus}`,
                        createdBy: user.uid,
                        createdByName: currentUserName,
                        timestamp: Timestamp.now()
                    }
                ]
            };

            if (auditNote) {
                updateData.auditNotes = [
                    ...reimbursements.find(r => r.id === reimbursementId)?.auditNotes || [],
                    {
                        note: auditNote,
                        createdBy: user.uid,
                        createdByName: currentUserName,
                        timestamp: Timestamp.now()
                    }
                ];
            }

            if (paymentInfo && newStatus === 'paid') {
                updateData.paymentConfirmation = {
                    ...paymentInfo,
                    paidBy: user.uid,
                    paidByName: currentUserName,
                    paidAt: Timestamp.now()
                };
            }

            await updateDoc(doc(db, 'reimbursements', reimbursementId), updateData);

            // Send status change email notification
            try {
                await fetch('/api/email/send-reimbursement-notification', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        type: 'status_change',
                        reimbursementId,
                        newStatus,
                        previousStatus,
                        changedByUserId: user.uid,
                        rejectionReason: auditNote && newStatus === 'declined' ? auditNote : undefined,
                        paymentConfirmation: paymentInfo && newStatus === 'paid' ? {
                            ...paymentInfo,
                            paidByName: currentUserName,
                            paidAt: new Date()
                        } : undefined,
                    }),
                });
            } catch (emailError) {
                console.error('Failed to send status change notification email:', emailError);
                // Don't fail the status update if email fails
            }
        } catch (error) {
            console.error('Error updating reimbursement:', error);
        }
    };

    const handleDeleteClick = (reimbursement: Reimbursement) => {
        setDeleteConfirmation({ isOpen: true, reimbursement });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirmation.reimbursement || !user || currentUserRole !== 'Administrator') {
            console.error('Unauthorized: Only administrators can delete reimbursements');
            return;
        }

        setIsDeleting(true);
        try {
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'reimbursements', deleteConfirmation.reimbursement.id));
            console.log('Reimbursement deleted successfully');
            setDeleteConfirmation({ isOpen: false, reimbursement: null });
        } catch (error) {
            console.error('Error deleting reimbursement:', error);
            showToast.error('Failed to delete reimbursement. Please try again.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteConfirmation({ isOpen: false, reimbursement: null });
    };

    const filteredReimbursements = reimbursements.filter(reimbursement => {
        const searchLower = searchTerm.toLowerCase();
        const userName = userNames[reimbursement.submittedBy]?.toLowerCase() || '';
        const matchesSearch = reimbursement.title.toLowerCase().includes(searchLower) ||
            reimbursement.department.toLowerCase().includes(searchLower) ||
            reimbursement.businessPurpose?.toLowerCase().includes(searchLower) ||
            userName.includes(searchLower);
        const matchesStatus = statusFilter.size === 0 || statusFilter.has(reimbursement.status);
        return matchesSearch && matchesStatus;
    }).sort((a, b) => {
        let aValue, bValue;

        switch (sortField) {
            case 'title':
                aValue = a.title.toLowerCase();
                bValue = b.title.toLowerCase();
                break;
            case 'submittedBy':
                aValue = (userNames[a.submittedBy] || '').toLowerCase();
                bValue = (userNames[b.submittedBy] || '').toLowerCase();
                break;
            case 'totalAmount':
                aValue = a.totalAmount;
                bValue = b.totalAmount;
                break;
            case 'submittedAt':
                aValue = a.submittedAt?.toDate ? a.submittedAt.toDate().getTime() : new Date(a.submittedAt).getTime();
                bValue = b.submittedAt?.toDate ? b.submittedAt.toDate().getTime() : new Date(b.submittedAt).getTime();
                break;
            case 'status':
                aValue = a.status;
                bValue = b.status;
                break;
            case 'department':
                aValue = a.department.toLowerCase();
                bValue = b.department.toLowerCase();
                break;
            default:
                return 0;
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getStats = () => {
        const totalRequests = reimbursements.length;
        const pendingReview = reimbursements.filter(r => r.status === 'submitted').length;
        const totalAmount = reimbursements.reduce((sum, r) => sum + calculateTotalAmount(r), 0);
        const thisMonth = reimbursements.filter(r => {
            const submittedDate = r.submittedAt?.toDate();
            const now = new Date();
            return submittedDate && submittedDate.getMonth() === now.getMonth() && submittedDate.getFullYear() === now.getFullYear();
        }).length;

        return { totalRequests, pendingReview, totalAmount, thisMonth };
    };

    const stats = getStats();

    // Helper function to check if user can perform officer actions
    const canPerformOfficerActions = () => {
        return currentUserRole === 'Executive Officer' || currentUserRole === 'Administrator';
    };

    // If a reimbursement is selected, show the details view
    if (selectedReimbursement) {
        return (
            <ManageReimbursementDetails
                reimbursement={selectedReimbursement}
                onBack={() => {
                    setSelectedReimbursement(null);
                    setAuditReimbursement(null);
                }}
                currentUser={user}
                onUpdate={updateReimbursementStatus}
            />
        );
    }

    return (
        <div className="flex-1 overflow-auto">
            {/* Manage Reimbursements Content */}
            <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">

                {/* Reimbursement Management Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {loading ? (
                        <>
                            <Card className="w-full border border-gray-200" shadow="sm">
                                <CardBody className="p-6">
                                    <Skeleton className="rounded-lg">
                                        <div className="h-20 rounded-lg bg-default-300"></div>
                                    </Skeleton>
                                </CardBody>
                            </Card>
                            <Card className="w-full border border-gray-200" shadow="sm">
                                <CardBody className="p-6">
                                    <Skeleton className="rounded-lg">
                                        <div className="h-20 rounded-lg bg-default-300"></div>
                                    </Skeleton>
                                </CardBody>
                            </Card>
                            <Card className="w-full border border-gray-200" shadow="sm">
                                <CardBody className="p-6">
                                    <Skeleton className="rounded-lg">
                                        <div className="h-20 rounded-lg bg-default-300"></div>
                                    </Skeleton>
                                </CardBody>
                            </Card>
                            <Card className="w-full border border-gray-200" shadow="sm">
                                <CardBody className="p-6">
                                    <Skeleton className="rounded-lg">
                                        <div className="h-20 rounded-lg bg-default-300"></div>
                                    </Skeleton>
                                </CardBody>
                            </Card>
                        </>
                    ) : (
                        <>
                            <Card className="w-full border border-gray-200" shadow="sm">
                                <CardBody className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-sm font-medium text-gray-500">Total Requests</p>
                                            <p className="text-2xl font-bold text-gray-900">{stats.totalRequests}</p>
                                        </div>
                                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                                            <Receipt className="w-5 h-5 text-blue-600" />
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                            <Card className="w-full border border-gray-200" shadow="sm">
                                <CardBody className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-sm font-medium text-gray-500">Pending Review</p>
                                            <p className="text-2xl font-bold text-amber-600">{stats.pendingReview}</p>
                                        </div>
                                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                                            <Clock className="w-5 h-5 text-amber-600" />
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                            <Card className="w-full border border-gray-200" shadow="sm">
                                <CardBody className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-sm font-medium text-gray-500">Total Amount</p>
                                            <p className="text-2xl font-bold text-emerald-600">${stats.totalAmount.toFixed(2)}</p>
                                        </div>
                                        <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                                            <DollarSign className="w-5 h-5 text-emerald-600" />
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                            <Card className="w-full border border-gray-200" shadow="sm">
                                <CardBody className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-sm font-medium text-gray-500">This Month</p>
                                            <p className="text-2xl font-bold text-purple-600">{stats.thisMonth}</p>
                                        </div>
                                        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                                            <Calendar className="w-5 h-5 text-purple-600" />
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        </>
                    )}
                </div>

                {/* Reimbursement Requests Table */}
                <Card className="w-full border border-gray-200" shadow="sm">
                    <CardHeader className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center px-6 py-4 border-b border-gray-100">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">All Reimbursements</h2>
                            <p className="text-sm text-gray-500">Manage and track reimbursement requests</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search requests..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/50 hover:bg-white focus:bg-white"
                                />
                            </div>
                            <Select
                                placeholder="Filter Status"
                                selectionMode="multiple"
                                selectedKeys={statusFilter}
                                onSelectionChange={(keys) => {
                                    setStatusFilter(new Set(keys as Set<string>));
                                }}
                                className="w-full sm:w-48"
                                size="sm"
                                variant="bordered"
                                classNames={{
                                    trigger: "h-[38px] border-gray-200",
                                    popoverContent: "rounded-xl",
                                    listboxWrapper: "rounded-xl"
                                }}
                            >
                                <SelectItem key="submitted">Submitted</SelectItem>
                                <SelectItem key="approved">Approved</SelectItem>
                                <SelectItem key="paid">Paid</SelectItem>
                                <SelectItem key="declined">Declined</SelectItem>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardBody className="p-0">
                        <div className="overflow-x-auto">
                            {loading ? (
                                <div className="p-6">
                                    <TableSkeleton rows={5} columns={6} />
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-gray-50/50 border-b border-gray-100">
                                        <tr>
                                            {[
                                                { id: 'title', label: 'Request' },
                                                { id: 'totalAmount', label: 'Amount' },
                                                { id: 'submittedAt', label: 'Date' },
                                                { id: 'status', label: 'Status' },
                                                { id: 'department', label: 'Department' },
                                                { id: 'actions', label: '' }
                                            ].map((column) => (
                                                <th key={column.id} className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                    {column.id !== 'actions' ? (
                                                        <button
                                                            onClick={() => handleSort(column.id)}
                                                            className="flex items-center gap-1 hover:text-gray-700 transition-colors group"
                                                        >
                                                            {column.label}
                                                            <span className="text-gray-400 group-hover:text-gray-600">
                                                                {sortField === column.id ? (
                                                                    sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <ChevronsUpDown className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                )}
                                                            </span>
                                                        </button>
                                                    ) : column.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {filteredReimbursements.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 text-sm">
                                                    No reimbursements found
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredReimbursements.map((reimbursement) => (
                                                <tr
                                                    key={reimbursement.id}
                                                    onClick={() => setSelectedReimbursement(reimbursement)}
                                                    className="group hover:bg-gray-50/50 transition-colors cursor-pointer"
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="max-w-xs">
                                                            <div className="text-sm font-semibold text-gray-900 truncate mb-0.5" title={reimbursement.title}>
                                                                {reimbursement.title}
                                                            </div>
                                                            <div className="text-xs text-gray-500 truncate mb-1" title={reimbursement.businessPurpose}>
                                                                {reimbursement.businessPurpose}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">
                                                                    {reimbursement.receipts
                                                                        ? `${reimbursement.receipts.length} receipt${reimbursement.receipts.length > 1 ? 's' : ''}`
                                                                        : `${reimbursement.expenses?.length || 0} expense${(reimbursement.expenses?.length || 0) > 1 ? 's' : ''}`
                                                                    }
                                                                </span>
                                                                <span className="text-[10px] text-gray-400">
                                                                    by {userNames[reimbursement.submittedBy] || 'Unknown'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-bold text-gray-900 font-mono">
                                                            ${calculateTotalAmount(reimbursement).toFixed(2)}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-600">
                                                            {reimbursement.submittedAt?.toDate
                                                                ? reimbursement.submittedAt.toDate().toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' })
                                                                : new Date(reimbursement.submittedAt).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' })
                                                            }
                                                        </div>
                                                        <div className="text-xs text-gray-400 mt-0.5">
                                                            {reimbursement.submittedAt?.toDate
                                                                ? reimbursement.submittedAt.toDate().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                                                : new Date(reimbursement.submittedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                                                            }
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <Chip
                                                            color={getStatusColor(reimbursement.status)}
                                                            variant="flat"
                                                            size="sm"
                                                            startContent={getStatusIcon(reimbursement.status)}
                                                            classNames={{
                                                                base: "border-0",
                                                                content: "font-medium"
                                                            }}
                                                        >
                                                            {getStatusDisplayName(reimbursement.status)}
                                                        </Chip>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                            {reimbursement.department}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {reimbursement.status === 'submitted' && canPerformOfficerActions() && (
                                                                <>
                                                                    <Button
                                                                        isIconOnly
                                                                        size="sm"
                                                                        variant="light"
                                                                        color="success"
                                                                        onPress={() => setSelectedReimbursement(reimbursement)}
                                                                        className="text-success-600 hover:bg-success-50"
                                                                        title="Approve"
                                                                    >
                                                                        <CheckCircle className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button
                                                                        isIconOnly
                                                                        size="sm"
                                                                        variant="light"
                                                                        color="danger"
                                                                        onPress={() => setSelectedReimbursement(reimbursement)}
                                                                        className="text-danger-600 hover:bg-danger-50"
                                                                        title="Decline"
                                                                    >
                                                                        <XCircle className="w-4 h-4" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                            {reimbursement.status === 'approved' && canPerformOfficerActions() && (
                                                                <Button
                                                                    isIconOnly
                                                                    size="sm"
                                                                    variant="light"
                                                                    color="success"
                                                                    onPress={() => setSelectedReimbursement(reimbursement)}
                                                                    className="text-success-600 hover:bg-success-50"
                                                                    title="Mark as Paid"
                                                                >
                                                                    <CreditCard className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                isIconOnly
                                                                size="sm"
                                                                variant="light"
                                                                color="primary"
                                                                onPress={() => setSelectedReimbursement(reimbursement)}
                                                                className="text-blue-600 hover:bg-blue-50"
                                                                title="View Details"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </Button>
                                                            {currentUserRole === 'Administrator' && (
                                                                <Button
                                                                    isIconOnly
                                                                    size="sm"
                                                                    variant="light"
                                                                    color="danger"
                                                                    onPress={() => handleDeleteClick(reimbursement)}
                                                                    className="text-gray-400 hover:text-red-600 hover:bg-red-50"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </CardBody>
                </Card>

            </main>



            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={deleteConfirmation.isOpen}
                onClose={handleDeleteCancel}
                size="md"
            >
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1">
                        <h2 className="text-xl font-semibold text-danger">Delete Reimbursement</h2>
                    </ModalHeader>
                    <ModalBody>
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-6 h-6 text-danger flex-shrink-0 mt-1" />
                            <div>
                                <p className="text-gray-900 font-medium mb-2">
                                    Are you sure you want to delete this reimbursement?
                                </p>
                                {deleteConfirmation.reimbursement && (
                                    <div className="bg-gray-50 p-3 rounded-lg mb-3">
                                        <p className="text-sm font-medium text-gray-900">
                                            {deleteConfirmation.reimbursement.title}
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            Amount: ${deleteConfirmation.reimbursement.totalAmount.toFixed(2)}
                                        </p>
                                    </div>
                                )}
                                <p className="text-sm text-gray-600">
                                    This action cannot be undone. The reimbursement and all associated data will be permanently deleted.
                                </p>
                            </div>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            variant="flat"
                            onPress={handleDeleteCancel}
                            isDisabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="danger"
                            onPress={handleDeleteConfirm}
                            isLoading={isDeleting}
                        >
                            Delete
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </div>
    );
}
