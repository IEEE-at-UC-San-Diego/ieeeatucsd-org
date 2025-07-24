import React, { useState, useEffect } from 'react';
import { Search, Calendar, Bell, User, Plus, Filter, DollarSign, Receipt, Clock, CheckCircle, XCircle, AlertCircle, FileText, Eye } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../firebase/client';
import ReimbursementRequestModal from './ReimbursementRequestModal';
// import ReimbursementDetailModal from './ReimbursementDetailModal';

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
    submittedAt: string;
    additionalInfo?: string;
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
            return <CheckCircle className="w-4 h-4" />;
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

export default function ReimbursementContent() {
    const [user] = useAuthState(auth);
    const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedReimbursement, setSelectedReimbursement] = useState<Reimbursement | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'reimbursements'),
            where('submittedBy', '==', user.uid),
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
    }, [user]);

    const handleSubmitReimbursement = async (data: any) => {
        if (!user) return;

        try {
            // Convert File objects to strings (file names) for Firestore storage
            const processedExpenses = data.expenses.map((expense: any) => ({
                ...expense,
                receipt: expense.receipt ? expense.receipt.name : null // Store just the filename
            }));

            const docRef = await addDoc(collection(db, 'reimbursements'), {
                title: data.title,
                totalAmount: data.totalAmount,
                dateOfPurchase: data.dateOfPurchase,
                paymentMethod: data.paymentMethod,
                status: 'submitted',
                submittedBy: user.uid,
                department: data.department,
                businessPurpose: data.businessPurpose,
                location: data.location,
                vendor: data.vendor,
                expenses: processedExpenses,
                additionalInfo: data.additionalInfo,
                submittedAt: Timestamp.now(),
                auditNotes: [],
                auditLogs: [{
                    action: 'Request submitted',
                    createdBy: user.uid,
                    timestamp: Timestamp.now()
                }]
            });

            // Send notification emails
            try {
                await fetch('/api/email/send-reimbursement-notification', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        type: 'reimbursement_submission',
                        reimbursementId: docRef.id
                    }),
                });
            } catch (emailError) {
                console.error('Failed to send notification emails:', emailError);
                // Don't fail the submission if email fails
            }
        } catch (error) {
            console.error('Error submitting reimbursement:', error);
        }
    };

    const filteredReimbursements = reimbursements.filter(reimbursement => {
        const matchesSearch = reimbursement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reimbursement.department.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || reimbursement.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getStats = () => {
        const totalSubmitted = reimbursements.reduce((sum, r) => sum + r.totalAmount, 0);
        const approved = reimbursements.filter(r => r.status === 'approved' || r.status === 'paid').reduce((sum, r) => sum + r.totalAmount, 0);
        const pending = reimbursements.filter(r => r.status === 'submitted').reduce((sum, r) => sum + r.totalAmount, 0);
        const thisMonth = reimbursements.filter(r => {
            const submittedDate = new Date(r.submittedAt);
            const now = new Date();
            return submittedDate.getMonth() === now.getMonth() && submittedDate.getFullYear() === now.getFullYear();
        }).length;

        return { totalSubmitted, approved, pending, thisMonth };
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

                            <option value="approved">Approved</option>
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

            {/* Reimbursement Content */}
            <main className="p-6">
                <div className="grid grid-cols-1 gap-6">
                    {/* Page Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Reimbursements</h1>
                            <p className="text-gray-600">Submit and track your reimbursement requests</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                <Filter className="w-4 h-4" />
                                <span>Export</span>
                            </button>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                <span>New Request</span>
                            </button>
                        </div>
                    </div>

                    {/* Reimbursement Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Total Submitted</p>
                                    <p className="text-2xl font-bold text-gray-900">${stats.totalSubmitted.toFixed(2)}</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <DollarSign className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Approved</p>
                                    <p className="text-2xl font-bold text-green-600">${stats.approved.toFixed(2)}</p>
                                </div>
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Pending</p>
                                    <p className="text-2xl font-bold text-yellow-600">${stats.pending.toFixed(2)}</p>
                                </div>
                                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-yellow-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">This Month</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.thisMonth}</p>
                                </div>
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                    <Receipt className="w-6 h-6 text-purple-600" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Reimbursement Requests */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Requests</h2>
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : filteredReimbursements.length === 0 ? (
                            <div className="text-center py-8">
                                <Receipt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                <p className="text-gray-500">No reimbursement requests found</p>
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    Submit Your First Request
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredReimbursements.map((reimbursement) => (
                                    <div key={reimbursement.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                                <Receipt className="w-6 h-6 text-green-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-gray-900">{reimbursement.title}</h3>
                                                <p className="text-sm text-gray-500 mt-1">{reimbursement.businessPurpose}</p>
                                                <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                                    <span>Submitted: {new Date(reimbursement.submittedAt).toLocaleDateString()}</span>
                                                    <span>•</span>
                                                    <span className="capitalize">{reimbursement.department}</span>
                                                    <span>•</span>
                                                    <span>{reimbursement.expenses.length} expense{reimbursement.expenses.length > 1 ? 's' : ''}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-gray-900">${reimbursement.totalAmount.toFixed(2)}</p>
                                                <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(reimbursement.status)}`}>
                                                    {getStatusIcon(reimbursement.status)}
                                                    <span>{getStatusDisplayName(reimbursement.status)}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedReimbursement(reimbursement)}
                                                className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Plus className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">Submit New Request</p>
                                    <p className="text-sm text-gray-500">Upload receipts and request reimbursement</p>
                                </div>
                            </button>
                            <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">View Guidelines</p>
                                    <p className="text-sm text-gray-500">Check reimbursement policies and limits</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            <ReimbursementRequestModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmitReimbursement}
            />

            {/* TODO: Add back detail modal 
            {selectedReimbursement && (
                <ReimbursementDetailModal
                    reimbursement={selectedReimbursement}
                    onClose={() => setSelectedReimbursement(null)}
                />
            )}
            */}
        </div>
    );
} 