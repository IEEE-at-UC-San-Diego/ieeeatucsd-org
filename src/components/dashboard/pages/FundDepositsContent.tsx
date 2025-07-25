import React, { useState, useEffect } from 'react';
import { Search, Calendar, Bell, User, Filter, Edit, CheckCircle, XCircle, Clock, DollarSign, Receipt, AlertCircle, FileText, MessageCircle, Eye, CreditCard, Check, X, Plus, Upload, Banknote } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../firebase/client';
import DashboardHeader from '../DashboardHeader';
import type { UserRole } from '../types/firestore';
import { PublicProfileService } from '../services/publicProfile';

interface FundDeposit {
    id: string;
    title: string;
    amount: number;
    depositDate: string;
    status: 'pending' | 'verified' | 'processed' | 'rejected';
    depositedBy: string;
    depositMethod: 'cash' | 'check' | 'bank_transfer' | 'other';
    purpose: string;
    receiptUrl?: string;
    description: string;
    submittedAt: any;
    verifiedBy?: string;
    verifiedAt?: any;
    processedBy?: string;
    processedAt?: any;
    notes?: string;
    auditLogs?: { action: string; createdBy: string; timestamp: any; note?: string; }[];
    referenceNumber?: string;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'verified':
            return 'bg-blue-100 text-blue-800';
        case 'processed':
            return 'bg-green-100 text-green-800';
        case 'rejected':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'pending':
            return <Clock className="w-4 h-4" />;
        case 'verified':
            return <Eye className="w-4 h-4" />;
        case 'processed':
            return <CheckCircle className="w-4 h-4" />;
        case 'rejected':
            return <XCircle className="w-4 h-4" />;
        default:
            return <Clock className="w-4 h-4" />;
    }
};

const FundDepositsContent: React.FC = () => {
    const [user, loading, error] = useAuthState(auth);
    const [deposits, setDeposits] = useState<FundDeposit[]>([]);
    const [filteredDeposits, setFilteredDeposits] = useState<FundDeposit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [userRole, setUserRole] = useState<UserRole>('Member');
    const [showNewDepositModal, setShowNewDepositModal] = useState(false);
    const [selectedDeposit, setSelectedDeposit] = useState<FundDeposit | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Form state for new deposit
    const [newDeposit, setNewDeposit] = useState({
        title: '',
        amount: '',
        depositDate: new Date().toISOString().split('T')[0],
        depositMethod: 'cash' as 'cash' | 'check' | 'bank_transfer' | 'other',
        purpose: '',
        description: '',
        receiptUrl: '',
        referenceNumber: ''
    });

    useEffect(() => {
        if (!user) return;

        const fetchUserRole = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    setUserRole(userDoc.data().role || 'Member');
                }
            } catch (error) {
                console.error('Error fetching user role:', error);
            }
        };

        fetchUserRole();

        const depositsQuery = query(
            collection(db, 'fundDeposits'),
            orderBy('submittedAt', 'desc')
        );

        const unsubscribe = onSnapshot(depositsQuery, (snapshot) => {
            const depositsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as FundDeposit[];
            setDeposits(depositsData);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        let filtered = deposits;

        if (searchTerm) {
            filtered = filtered.filter(deposit =>
                deposit.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                deposit.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
                deposit.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(deposit => deposit.status === statusFilter);
        }

        setFilteredDeposits(filtered);
    }, [deposits, searchTerm, statusFilter]);

    const handleSubmitDeposit = async () => {
        if (!user || !newDeposit.title || !newDeposit.amount || !newDeposit.purpose) return;

        try {
            const depositData = {
                title: newDeposit.title,
                amount: parseFloat(newDeposit.amount),
                depositDate: newDeposit.depositDate,
                status: 'pending' as const,
                depositedBy: user.uid,
                depositMethod: newDeposit.depositMethod,
                purpose: newDeposit.purpose,
                description: newDeposit.description,
                receiptUrl: newDeposit.receiptUrl,
                referenceNumber: newDeposit.referenceNumber,
                submittedAt: Timestamp.now(),
                auditLogs: [{
                    action: 'submitted',
                    createdBy: user.uid,
                    timestamp: Timestamp.now(),
                    note: 'Deposit submitted for review'
                }]
            };

            await addDoc(collection(db, 'fundDeposits'), depositData);

            setShowNewDepositModal(false);
            setNewDeposit({
                title: '',
                amount: '',
                depositDate: new Date().toISOString().split('T')[0],
                depositMethod: 'cash',
                purpose: '',
                description: '',
                receiptUrl: '',
                referenceNumber: ''
            });
        } catch (error) {
            console.error('Error submitting deposit:', error);
        }
    };

    const handleStatusUpdate = async (depositId: string, newStatus: string, note?: string) => {
        if (!user) return;

        try {
            const depositRef = doc(db, 'fundDeposits', depositId);
            const updateData: any = {
                status: newStatus,
                [`${newStatus}By`]: user.uid,
                [`${newStatus}At`]: Timestamp.now()
            };

            if (note) {
                updateData.notes = note;
            }

            // Add audit log
            const deposit = deposits.find(d => d.id === depositId);
            if (deposit) {
                const newAuditLog = {
                    action: newStatus,
                    createdBy: user.uid,
                    timestamp: Timestamp.now(),
                    note: note || `Status changed to ${newStatus}`
                };
                updateData.auditLogs = [...(deposit.auditLogs || []), newAuditLog];
            }

            await updateDoc(depositRef, updateData);
        } catch (error) {
            console.error('Error updating deposit status:', error);
        }
    };

    const canModifyDeposit = (deposit: FundDeposit): boolean => {
        return userRole === 'Executive Officer' ||
            userRole === 'General Officer' ||
            (deposit.depositedBy === user?.uid && deposit.status === 'pending');
    };

    const stats = {
        total: deposits.length,
        pending: deposits.filter(d => d.status === 'pending').length,
        verified: deposits.filter(d => d.status === 'verified').length,
        processed: deposits.filter(d => d.status === 'processed').length,
        totalAmount: deposits
            .filter(d => d.status === 'processed')
            .reduce((sum, d) => sum + d.amount, 0)
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <DashboardHeader
                title="Fund Deposits"
                subtitle="Track and manage funds deposited into the IEEE account"
                showDate={true}
            />

            <div className="p-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <Receipt className="h-8 w-8 text-blue-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Total Deposits</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <Clock className="h-8 w-8 text-yellow-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Pending</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <Eye className="h-8 w-8 text-blue-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Verified</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.verified}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <CheckCircle className="h-8 w-8 text-green-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Processed</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.processed}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <Banknote className="h-8 w-8 text-green-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Total Processed</p>
                                <p className="text-2xl font-bold text-gray-900">${stats.totalAmount.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters and Search */}
                <div className="bg-white rounded-lg shadow mb-6">
                    <div className="p-6 border-b border-gray-200">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="Search deposits..."
                                        className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <select
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option value="all">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="verified">Verified</option>
                                    <option value="processed">Processed</option>
                                    <option value="rejected">Rejected</option>
                                </select>

                                <button
                                    onClick={() => setShowNewDepositModal(true)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    New Deposit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Deposits Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Deposit Info
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Amount
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Method
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex justify-center">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredDeposits.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                            No deposits found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredDeposits.map((deposit) => (
                                        <tr key={deposit.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {deposit.title}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {deposit.purpose}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                ${deposit.amount.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                                                {deposit.depositMethod.replace('_', ' ')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(deposit.status)}`}>
                                                    {getStatusIcon(deposit.status)}
                                                    <span className="ml-1 capitalize">{deposit.status}</span>
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(deposit.depositDate).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedDeposit(deposit);
                                                            setShowDetailModal(true);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-900"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {canModifyDeposit(deposit) && deposit.status === 'pending' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleStatusUpdate(deposit.id, 'verified')}
                                                                className="text-blue-600 hover:text-blue-900"
                                                                title="Verify"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleStatusUpdate(deposit.id, 'rejected')}
                                                                className="text-red-600 hover:text-red-900"
                                                                title="Reject"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}

                                                    {canModifyDeposit(deposit) && deposit.status === 'verified' && (
                                                        <button
                                                            onClick={() => handleStatusUpdate(deposit.id, 'processed')}
                                                            className="text-green-600 hover:text-green-900"
                                                            title="Mark as Processed"
                                                        >
                                                            <CheckCircle className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* New Deposit Modal */}
            {showNewDepositModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">New Fund Deposit</h3>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Deposit Title *
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={newDeposit.title}
                                    onChange={(e) => setNewDeposit({ ...newDeposit, title: e.target.value })}
                                    placeholder="e.g., Membership Dues Collection"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Amount *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        value={newDeposit.amount}
                                        onChange={(e) => setNewDeposit({ ...newDeposit, amount: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Deposit Date *
                                    </label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        value={newDeposit.depositDate}
                                        onChange={(e) => setNewDeposit({ ...newDeposit, depositDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Deposit Method *
                                </label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={newDeposit.depositMethod}
                                    onChange={(e) => setNewDeposit({ ...newDeposit, depositMethod: e.target.value as any })}
                                >
                                    <option value="cash">Cash</option>
                                    <option value="check">Check</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Purpose *
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={newDeposit.purpose}
                                    onChange={(e) => setNewDeposit({ ...newDeposit, purpose: e.target.value })}
                                    placeholder="e.g., Membership Dues, Event Revenue, Sponsorship"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    rows={3}
                                    value={newDeposit.description}
                                    onChange={(e) => setNewDeposit({ ...newDeposit, description: e.target.value })}
                                    placeholder="Additional details about this deposit..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Reference Number
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={newDeposit.referenceNumber}
                                    onChange={(e) => setNewDeposit({ ...newDeposit, referenceNumber: e.target.value })}
                                    placeholder="Check number, transaction ID, etc."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Receipt/Proof URL
                                </label>
                                <input
                                    type="url"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={newDeposit.receiptUrl}
                                    onChange={(e) => setNewDeposit({ ...newDeposit, receiptUrl: e.target.value })}
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => setShowNewDepositModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitDeposit}
                                disabled={!newDeposit.title || !newDeposit.amount || !newDeposit.purpose}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Submit Deposit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedDeposit && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium text-gray-900">Deposit Details</h3>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-4">Deposit Information</h4>
                                    <dl className="space-y-3">
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Title</dt>
                                            <dd className="text-sm text-gray-900">{selectedDeposit.title}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Amount</dt>
                                            <dd className="text-sm text-gray-900">${selectedDeposit.amount.toFixed(2)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Purpose</dt>
                                            <dd className="text-sm text-gray-900">{selectedDeposit.purpose}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Method</dt>
                                            <dd className="text-sm text-gray-900 capitalize">{selectedDeposit.depositMethod.replace('_', ' ')}</dd>
                                        </div>
                                        {selectedDeposit.referenceNumber && (
                                            <div>
                                                <dt className="text-sm font-medium text-gray-500">Reference Number</dt>
                                                <dd className="text-sm text-gray-900">{selectedDeposit.referenceNumber}</dd>
                                            </div>
                                        )}
                                    </dl>
                                </div>

                                <div>
                                    <h4 className="font-medium text-gray-900 mb-4">Status & Dates</h4>
                                    <dl className="space-y-3">
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Status</dt>
                                            <dd>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedDeposit.status)}`}>
                                                    {getStatusIcon(selectedDeposit.status)}
                                                    <span className="ml-1 capitalize">{selectedDeposit.status}</span>
                                                </span>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Deposit Date</dt>
                                            <dd className="text-sm text-gray-900">{new Date(selectedDeposit.depositDate).toLocaleDateString()}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Submitted</dt>
                                            <dd className="text-sm text-gray-900">{selectedDeposit.submittedAt?.toDate().toLocaleString()}</dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>

                            {selectedDeposit.description && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                                    <p className="text-sm text-gray-700">{selectedDeposit.description}</p>
                                </div>
                            )}

                            {selectedDeposit.receiptUrl && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Receipt/Proof</h4>
                                    <a
                                        href={selectedDeposit.receiptUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 underline"
                                    >
                                        View Receipt
                                    </a>
                                </div>
                            )}

                            {selectedDeposit.auditLogs && selectedDeposit.auditLogs.length > 0 && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Activity Log</h4>
                                    <div className="space-y-2">
                                        {selectedDeposit.auditLogs.map((log, index) => (
                                            <div key={index} className="text-sm border-l-2 border-gray-200 pl-3">
                                                <div className="font-medium text-gray-900 capitalize">{log.action}</div>
                                                <div className="text-gray-500">{log.timestamp?.toDate().toLocaleString()}</div>
                                                {log.note && <div className="text-gray-700 mt-1">{log.note}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FundDepositsContent; 