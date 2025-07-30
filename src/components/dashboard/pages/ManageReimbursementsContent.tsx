import React, { useState, useEffect } from 'react';
import { Search, Calendar, Bell, User, Filter, Edit, CheckCircle, XCircle, Clock, DollarSign, Receipt, AlertCircle, FileText, MessageCircle, Eye, CreditCard, Check, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../firebase/client';
import DashboardHeader from '../DashboardHeader';
import ReimbursementDetailModal from './ReimbursementDetailModal';
import ReimbursementAuditModal from './ReimbursementAuditModal';
import type { UserRole } from '../types/firestore';
import { PublicProfileService } from '../services/publicProfile';
import { MetricCardSkeleton, TableSkeleton } from '../../ui/loading';

interface Reimbursement {
    id: string;
    title: string;
    totalAmount: number;
    dateOfPurchase: string;
    status: 'submitted' | 'declined' | 'approved' | 'paid';
    submittedBy: string;
    department: string;
    businessPurpose: string;
    expenses: any[];
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

const getStatusColor = (status: string) => {
    switch (status) {
        case 'submitted':
            return 'bg-yellow-100 text-yellow-800';
        case 'approved':
            return 'bg-green-100 text-green-800';
        case 'paid':
            return 'bg-emerald-100 text-emerald-800';
        case 'declined':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
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
    const [statusFilter, setStatusFilter] = useState('all');
    const [userNames, setUserNames] = useState<{ [key: string]: string }>({});
    const [sortField, setSortField] = useState<string>('submittedAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);

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
            <div className="flex-1 overflow-auto">
                <DashboardHeader
                    title="Access Denied"
                    subtitle="You don't have permission to access this page"
                />
                <div className="p-6">
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
        } catch (error) {
            console.error('Error updating reimbursement:', error);
        }
    };

    const filteredReimbursements = reimbursements.filter(reimbursement => {
        const matchesSearch = reimbursement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reimbursement.department.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || reimbursement.status === statusFilter;
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
        const totalAmount = reimbursements.reduce((sum, r) => sum + r.totalAmount, 0);
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
        return currentUserRole === 'General Officer' || currentUserRole === 'Executive Officer';
    };

    return (
        <div className="flex-1 overflow-auto">
            {/* Header */}
            <DashboardHeader
                title="Manage Reimbursements"
                subtitle="Review and process member reimbursement requests"
                searchPlaceholder="Search reimbursements..."
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
            >
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="all">All Status</option>
                    <option value="submitted">Submitted</option>
                    <option value="approved">Approved (Not Paid)</option>
                    <option value="paid">Paid</option>
                    <option value="declined">Declined</option>
                </select>
                <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <FileText className="w-4 h-4" />
                    <span>Export Report</span>
                </button>
            </DashboardHeader>

            {/* Manage Reimbursements Content */}
            <main className="p-6">
                <div className="grid grid-cols-1 gap-6">


                    {/* Reimbursement Management Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                        {loading ? (
                            <>
                                <MetricCardSkeleton />
                                <MetricCardSkeleton />
                                <MetricCardSkeleton />
                                <MetricCardSkeleton />
                            </>
                        ) : (
                            <>
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-600">Total Requests</p>
                                            <p className="text-2xl font-bold text-gray-900">{stats.totalRequests}</p>
                                        </div>
                                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                            <Receipt className="w-6 h-6 text-blue-600" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-600">Pending Review</p>
                                            <p className="text-2xl font-bold text-yellow-600">{stats.pendingReview}</p>
                                        </div>
                                        <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                                            <Clock className="w-6 h-6 text-yellow-600" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-600">Total Amount</p>
                                            <p className="text-2xl font-bold text-green-600">${stats.totalAmount.toFixed(2)}</p>
                                        </div>
                                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                            <DollarSign className="w-6 h-6 text-green-600" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-600">This Month</p>
                                            <p className="text-2xl font-bold text-purple-600">{stats.thisMonth}</p>
                                        </div>
                                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                            <Calendar className="w-6 h-6 text-purple-600" />
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Reimbursement Requests Table */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">All Reimbursement Requests</h2>
                        </div>
                        <div className="overflow-x-auto">
                            {loading ? (
                                <TableSkeleton rows={5} columns={7} />
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                <button
                                                    onClick={() => handleSort('title')}
                                                    className="flex items-center hover:text-gray-700 transition-colors"
                                                >
                                                    Request
                                                    {sortField === 'title' ? (
                                                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />
                                                    ) : (
                                                        <ChevronsUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                    )}
                                                </button>
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                <button
                                                    onClick={() => handleSort('submittedBy')}
                                                    className="flex items-center hover:text-gray-700 transition-colors"
                                                >
                                                    Submitted By
                                                    {sortField === 'submittedBy' ? (
                                                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />
                                                    ) : (
                                                        <ChevronsUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                    )}
                                                </button>
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                <button
                                                    onClick={() => handleSort('totalAmount')}
                                                    className="flex items-center hover:text-gray-700 transition-colors"
                                                >
                                                    Amount
                                                    {sortField === 'totalAmount' ? (
                                                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />
                                                    ) : (
                                                        <ChevronsUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                    )}
                                                </button>
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                <button
                                                    onClick={() => handleSort('submittedAt')}
                                                    className="flex items-center hover:text-gray-700 transition-colors"
                                                >
                                                    Date
                                                    {sortField === 'submittedAt' ? (
                                                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />
                                                    ) : (
                                                        <ChevronsUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                    )}
                                                </button>
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                <button
                                                    onClick={() => handleSort('status')}
                                                    className="flex items-center hover:text-gray-700 transition-colors"
                                                >
                                                    Status
                                                    {sortField === 'status' ? (
                                                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />
                                                    ) : (
                                                        <ChevronsUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                    )}
                                                </button>
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                <button
                                                    onClick={() => handleSort('department')}
                                                    className="flex items-center hover:text-gray-700 transition-colors"
                                                >
                                                    Department
                                                    {sortField === 'department' ? (
                                                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />
                                                    ) : (
                                                        <ChevronsUpDown className="w-4 h-4 ml-1 opacity-50" />
                                                    )}
                                                </button>
                                            </th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredReimbursements.map((reimbursement) => (
                                            <tr key={reimbursement.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{reimbursement.title}</div>
                                                        <div className="text-sm text-gray-500">{reimbursement.businessPurpose.substring(0, 60)}...</div>
                                                        <div className="text-xs text-gray-400 mt-1">{reimbursement.expenses.length} expense{reimbursement.expenses.length > 1 ? 's' : ''}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">{userNames[reimbursement.submittedBy] || (loading ? 'Loading...' : 'Unknown User')}</div>
                                                        <div className="text-sm text-gray-500">Submitted by</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-bold text-gray-900">${reimbursement.totalAmount.toFixed(2)}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{reimbursement.submittedAt?.toDate ? reimbursement.submittedAt.toDate().toLocaleDateString() : new Date(reimbursement.submittedAt).toLocaleDateString()}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className={`inline-flex items-center space-x-1 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(reimbursement.status)}`}>
                                                        {getStatusIcon(reimbursement.status)}
                                                        <span>{getStatusDisplayName(reimbursement.status)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full capitalize">
                                                        {reimbursement.department}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end space-x-2">
                                                        {reimbursement.status === 'submitted' && (
                                                            <>
                                                                {canPerformOfficerActions() && (
                                                                    <>
                                                                        <button
                                                                            onClick={() => setAuditReimbursement(reimbursement)}
                                                                            className="text-blue-600 hover:text-blue-900"
                                                                            title="Request Audit"
                                                                        >
                                                                            <User className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setAuditReimbursement(reimbursement)}
                                                                            className="text-green-600 hover:text-green-900"
                                                                            title="Approve"
                                                                        >
                                                                            <CheckCircle className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setAuditReimbursement(reimbursement)}
                                                                            className="text-red-600 hover:text-red-900"
                                                                            title="Decline"
                                                                        >
                                                                            <XCircle className="w-4 h-4" />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </>
                                                        )}
                                                        {reimbursement.status === 'approved' && canPerformOfficerActions() && (
                                                            <button
                                                                onClick={() => setAuditReimbursement(reimbursement)}
                                                                className="text-emerald-600 hover:text-emerald-900"
                                                                title="Mark as Paid"
                                                            >
                                                                <CreditCard className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {canPerformOfficerActions() && (
                                                            <button
                                                                onClick={() => setAuditReimbursement(reimbursement)}
                                                                className="text-blue-600 hover:text-blue-900"
                                                                title="Add Note"
                                                            >
                                                                <MessageCircle className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setSelectedReimbursement(reimbursement)}
                                                            className="text-blue-600 hover:text-blue-900"
                                                            title="View Details"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>


                </div>
            </main >

            {/* Modals */}
            {
                selectedReimbursement && (
                    <ReimbursementDetailModal
                        reimbursement={selectedReimbursement}
                        onClose={() => setSelectedReimbursement(null)}
                    />
                )
            }

            {
                auditReimbursement && (
                    <ReimbursementAuditModal
                        reimbursement={auditReimbursement}
                        onClose={() => setAuditReimbursement(null)}
                        onUpdate={updateReimbursementStatus}
                    />
                )
            }
        </div >
    );
} 