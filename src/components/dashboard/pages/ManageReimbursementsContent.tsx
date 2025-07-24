import React, { useState, useEffect } from 'react';
import { Search, Calendar, Bell, User, Filter, Edit, CheckCircle, XCircle, Clock, DollarSign, Receipt, AlertCircle, FileText, MessageCircle, Eye, CreditCard, Check, X } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp, addDoc } from 'firebase/firestore';
import { db } from '../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../firebase/client';
import ReimbursementDetailModal from './ReimbursementDetailModal';
import ReimbursementAuditModal from './ReimbursementAuditModal';

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

    useEffect(() => {
        const q = query(
            collection(db, 'reimbursements'),
            orderBy('submittedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reimbursementData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Reimbursement[];

            setReimbursements(reimbursementData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const updateReimbursementStatus = async (reimbursementId: string, newStatus: string, auditNote?: string, paymentInfo?: any) => {
        if (!user) return;

        try {
            const updateData: any = {
                status: newStatus,
                auditLogs: [
                    ...reimbursements.find(r => r.id === reimbursementId)?.auditLogs || [],
                    {
                        action: `Status changed to ${newStatus}`,
                        createdBy: user.uid,
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
                        timestamp: Timestamp.now()
                    }
                ];
            }

            if (paymentInfo && newStatus === 'paid') {
                updateData.paymentConfirmation = {
                    ...paymentInfo,
                    paidBy: user.uid,
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
    });

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

    return (
        <div className="flex-1 overflow-auto">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search reimbursements..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
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
                    </div>

                    <div className="flex items-center space-x-4">
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Calendar className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Bell className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <User className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Manage Reimbursements Content */}
            <main className="p-6">
                <div className="grid grid-cols-1 gap-6">
                    {/* Page Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Manage Reimbursements</h1>
                            <p className="text-gray-600">Review and process member reimbursement requests</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                <Filter className="w-4 h-4" />
                                <span>Filter</span>
                            </button>
                            <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                <FileText className="w-4 h-4" />
                                <span>Export Report</span>
                            </button>
                        </div>
                    </div>

                    {/* Reimbursement Management Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
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
                    </div>

                    {/* Reimbursement Requests Table */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">All Reimbursement Requests</h2>
                        </div>
                        <div className="overflow-x-auto">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                </div>
                            ) : (
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Request
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Submitted By
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Amount
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Department
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
                                                        <div className="text-sm font-medium text-gray-900">{reimbursement.submittedBy}</div>
                                                        <div className="text-sm text-gray-500">User ID</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-bold text-gray-900">${reimbursement.totalAmount.toFixed(2)}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{reimbursement.submittedAt?.toDate().toLocaleDateString()}</div>
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
                                                        {reimbursement.status === 'approved' && (
                                                            <button
                                                                onClick={() => setAuditReimbursement(reimbursement)}
                                                                className="text-emerald-600 hover:text-emerald-900"
                                                                title="Mark as Paid"
                                                            >
                                                                <CreditCard className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => setAuditReimbursement(reimbursement)}
                                                            className="text-blue-600 hover:text-blue-900"
                                                            title="Add Note"
                                                        >
                                                            <MessageCircle className="w-4 h-4" />
                                                        </button>
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

                    {/* Quick Actions */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button
                                onClick={() => setStatusFilter('submitted')}
                                className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-yellow-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">Review Pending</p>
                                    <p className="text-sm text-gray-500">Process pending requests</p>
                                </div>
                            </button>
                            <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">Generate Report</p>
                                    <p className="text-sm text-gray-500">Export monthly summary</p>
                                </div>
                            </button>
                            <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <DollarSign className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">Budget Overview</p>
                                    <p className="text-sm text-gray-500">View spending analytics</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            {selectedReimbursement && (
                <ReimbursementDetailModal
                    reimbursement={selectedReimbursement}
                    onClose={() => setSelectedReimbursement(null)}
                />
            )}

            {auditReimbursement && (
                <ReimbursementAuditModal
                    reimbursement={auditReimbursement}
                    onClose={() => setAuditReimbursement(null)}
                    onUpdate={updateReimbursementStatus}
                />
            )}
        </div>
    );
} 