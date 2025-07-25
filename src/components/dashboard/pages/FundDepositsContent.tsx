import React, { useState, useEffect } from 'react';
import { Search, Calendar, Bell, User, Filter, Edit, CheckCircle, XCircle, Clock, DollarSign, Receipt, AlertCircle, FileText, MessageCircle, Eye, CreditCard, Check, X, Plus, Upload, Banknote, Trash2, Save } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp, addDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, storage } from '../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../firebase/client';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import DashboardHeader from '../DashboardHeader';
import type { UserRole } from '../types/firestore';
import { PublicProfileService } from '../services/publicProfile';

interface FundDeposit {
    id: string;
    title: string;
    amount: number;
    depositDate: string;
    status: 'pending' | 'verified' | 'rejected';
    depositedBy: string;
    depositedByName?: string;
    depositedByEmail?: string;
    depositMethod: 'cash' | 'check' | 'bank_transfer' | 'other';
    purpose: string;
    receiptFiles?: string[];
    description: string;
    submittedAt: any;
    verifiedBy?: string;
    verifiedByName?: string;
    verifiedAt?: any;

    notes?: string;
    auditLogs?: { action: string; createdBy: string; createdByName?: string; timestamp: any; note?: string; previousData?: any; newData?: any; }[];
    referenceNumber?: string;
    editedAt?: any;
    editedBy?: string;
    editedByName?: string;
    // IEEE deposit fields
    isIeeeDeposit?: boolean;
    ieeeDepositSource?: 'upp' | 'section' | 'region' | 'global' | 'society' | 'other';
    needsBankTransfer?: boolean;
    bankTransferInstructions?: string;
    bankTransferFiles?: string[];
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'verified':
            return 'bg-blue-100 text-blue-800';

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
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingDeposit, setEditingDeposit] = useState<FundDeposit | null>(null);
    const [editReceiptFiles, setEditReceiptFiles] = useState<File[]>([]);

    // Form state for new deposit
    const [newDeposit, setNewDeposit] = useState({
        title: '',
        amount: '',
        depositDate: new Date().toISOString().split('T')[0],
        depositMethod: 'cash' as 'cash' | 'check' | 'bank_transfer' | 'other',
        purpose: '',
        description: '',
        referenceNumber: '',
        isIeeeDeposit: false,
        ieeeDepositSource: 'upp' as 'upp' | 'section' | 'region' | 'global' | 'society' | 'other',
        needsBankTransfer: false,
        bankTransferInstructions: ''
    });

    const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
    const [bankTransferFiles, setBankTransferFiles] = useState<File[]>([]);
    const [editBankTransferFiles, setEditBankTransferFiles] = useState<File[]>([]);

    const addReceiptFile = (file: File) => {
        setReceiptFiles(prev => [...prev, file]);
    };

    const addEditReceiptFile = (file: File) => {
        setEditReceiptFiles(prev => [...prev, file]);
    };

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

    const uploadFiles = async (files: File[], path: string): Promise<string[]> => {
        const uploadPromises = files.map(async (file) => {
            const storageRef = ref(storage, `${path}/${user?.uid}/${Date.now()}_${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);
            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', null, reject, () => resolve(uploadTask.snapshot.ref));
            });
            return await getDownloadURL(storageRef);
        });
        return await Promise.all(uploadPromises);
    };

    const handleSubmitDeposit = async () => {
        if (!user || !newDeposit.title || !newDeposit.amount || !newDeposit.purpose) return;

        try {
            // Upload receipt files if any
            let receiptFileUrls: string[] = [];
            if (receiptFiles.length > 0) {
                receiptFileUrls = await uploadFiles(receiptFiles, 'fund_deposits');
            }

            // Upload bank transfer files if any
            let bankTransferFileUrls: string[] = [];
            if (bankTransferFiles.length > 0) {
                bankTransferFileUrls = await uploadFiles(bankTransferFiles, 'fund_deposits');
            }

            // Get user info for audit trail
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();
            const userName = userData?.name || user.email || 'Unknown User';

            const depositData: any = {
                title: newDeposit.title,
                amount: parseFloat(newDeposit.amount),
                depositDate: newDeposit.depositDate,
                status: 'pending' as const,
                depositedBy: user.uid,
                depositedByName: userName,
                depositedByEmail: user.email,
                depositMethod: newDeposit.depositMethod,
                purpose: newDeposit.purpose,
                description: newDeposit.description,
                receiptFiles: receiptFileUrls,
                referenceNumber: newDeposit.referenceNumber,
                submittedAt: Timestamp.now(),
                auditLogs: [{
                    action: 'submitted',
                    createdBy: user.uid,
                    createdByName: userName,
                    timestamp: Timestamp.now(),
                    note: 'Deposit submitted for review'
                }]
            };

            // Add IEEE deposit fields if applicable
            if (newDeposit.isIeeeDeposit) {
                depositData.isIeeeDeposit = true;
                depositData.ieeeDepositSource = newDeposit.ieeeDepositSource;
                depositData.needsBankTransfer = newDeposit.needsBankTransfer;
                depositData.bankTransferInstructions = newDeposit.bankTransferInstructions;
                depositData.bankTransferFiles = bankTransferFileUrls;
            }

            await addDoc(collection(db, 'fundDeposits'), depositData);

            setShowNewDepositModal(false);
            setNewDeposit({
                title: '',
                amount: '',
                depositDate: new Date().toISOString().split('T')[0],
                depositMethod: 'cash' as 'cash' | 'check' | 'bank_transfer' | 'other',
                purpose: '',
                description: '',
                referenceNumber: '',
                isIeeeDeposit: false,
                ieeeDepositSource: 'upp' as 'upp' | 'section' | 'region' | 'global' | 'society' | 'other',
                needsBankTransfer: false,
                bankTransferInstructions: ''
            });
            setReceiptFiles([]);
            setBankTransferFiles([]);
        } catch (error) {
            console.error('Error submitting deposit:', error);
        }
    };

    const handleStatusUpdate = async (depositId: string, newStatus: string, note?: string) => {
        if (!user) return;

        try {
            // Get user info
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();
            const userName = userData?.name || user.email || 'Unknown User';

            const depositRef = doc(db, 'fundDeposits', depositId);
            const updateData: any = {
                status: newStatus,
                [`${newStatus}By`]: user.uid,
                [`${newStatus}ByName`]: userName,
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
                    createdByName: userName,
                    timestamp: Timestamp.now(),
                    note: note || `Status changed to ${newStatus}`,
                    previousData: { status: deposit.status },
                    newData: { status: newStatus }
                };
                updateData.auditLogs = [...(deposit.auditLogs || []), newAuditLog];
            }

            await updateDoc(depositRef, updateData);
        } catch (error) {
            console.error('Error updating deposit status:', error);
        }
    };

    const handleEditDeposit = (deposit: FundDeposit) => {
        setEditingDeposit(deposit);
        setShowEditModal(true);
        setEditReceiptFiles([]);
    };

    const handleUpdateDeposit = async () => {
        if (!user || !editingDeposit) return;

        try {
            // Get original deposit data for comparison
            const originalDeposit = deposits.find(d => d.id === editingDeposit.id);
            if (!originalDeposit) return;

            // Upload new receipt files if any
            let newReceiptFileUrls: string[] = [];
            if (editReceiptFiles.length > 0) {
                newReceiptFileUrls = await uploadFiles(editReceiptFiles, 'fund_deposits');
            }

            // Get user info
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();
            const userName = userData?.name || user.email || 'Unknown User';

            const depositRef = doc(db, 'fundDeposits', editingDeposit.id);

            // Combine existing and new receipt files
            const allReceiptFiles = [...(editingDeposit.receiptFiles || []), ...newReceiptFileUrls];

            const updateData: any = {
                title: editingDeposit.title,
                amount: editingDeposit.amount,
                depositDate: editingDeposit.depositDate,
                depositMethod: editingDeposit.depositMethod,
                purpose: editingDeposit.purpose,
                description: editingDeposit.description,
                referenceNumber: editingDeposit.referenceNumber,
                receiptFiles: allReceiptFiles,
                editedBy: user.uid,
                editedByName: userName,
                editedAt: Timestamp.now(),
                isIeeeDeposit: editingDeposit.isIeeeDeposit,
                ieeeDepositSource: editingDeposit.ieeeDepositSource
            };

            // Create detailed audit log for changes
            const changes: string[] = [];
            if (originalDeposit.title !== editingDeposit.title) {
                changes.push(`Title: "${originalDeposit.title}" → "${editingDeposit.title}"`);
            }
            if (originalDeposit.amount !== editingDeposit.amount) {
                changes.push(`Amount: $${originalDeposit.amount} → $${editingDeposit.amount}`);
            }
            if (originalDeposit.depositDate !== editingDeposit.depositDate) {
                changes.push(`Date: ${originalDeposit.depositDate} → ${editingDeposit.depositDate}`);
            }
            if (originalDeposit.depositMethod !== editingDeposit.depositMethod) {
                changes.push(`Method: ${originalDeposit.depositMethod} → ${editingDeposit.depositMethod}`);
            }
            if (originalDeposit.purpose !== editingDeposit.purpose) {
                changes.push(`Purpose: "${originalDeposit.purpose}" → "${editingDeposit.purpose}"`);
            }
            if (originalDeposit.description !== editingDeposit.description) {
                changes.push(`Description: "${originalDeposit.description}" → "${editingDeposit.description}"`);
            }
            if (originalDeposit.referenceNumber !== editingDeposit.referenceNumber) {
                changes.push(`Reference: "${originalDeposit.referenceNumber || 'None'}" → "${editingDeposit.referenceNumber || 'None'}"`);
            }
            if (newReceiptFileUrls.length > 0) {
                changes.push(`Added ${newReceiptFileUrls.length} new receipt file(s)`);
            }
            if (originalDeposit.isIeeeDeposit !== editingDeposit.isIeeeDeposit) {
                changes.push(`IEEE Deposit: ${originalDeposit.isIeeeDeposit ? 'Yes' : 'No'} → ${editingDeposit.isIeeeDeposit ? 'Yes' : 'No'}`);
            }
            if (originalDeposit.ieeeDepositSource !== editingDeposit.ieeeDepositSource) {
                changes.push(`IEEE Source: ${originalDeposit.ieeeDepositSource || 'None'} → ${editingDeposit.ieeeDepositSource || 'None'}`);
            }

            const newAuditLog = {
                action: 'edited',
                createdBy: user.uid,
                createdByName: userName,
                timestamp: Timestamp.now(),
                note: changes.length > 0 ? `Changes: ${changes.join('; ')}` : 'No significant changes made',
                previousData: {
                    title: originalDeposit.title,
                    amount: originalDeposit.amount,
                    depositDate: originalDeposit.depositDate,
                    depositMethod: originalDeposit.depositMethod,
                    purpose: originalDeposit.purpose,
                    description: originalDeposit.description,
                    referenceNumber: originalDeposit.referenceNumber,
                    receiptFilesCount: originalDeposit.receiptFiles?.length || 0,
                    isIeeeDeposit: originalDeposit.isIeeeDeposit,
                    ieeeDepositSource: originalDeposit.ieeeDepositSource
                },
                newData: {
                    title: editingDeposit.title,
                    amount: editingDeposit.amount,
                    depositDate: editingDeposit.depositDate,
                    depositMethod: editingDeposit.depositMethod,
                    purpose: editingDeposit.purpose,
                    description: editingDeposit.description,
                    referenceNumber: editingDeposit.referenceNumber,
                    receiptFilesCount: allReceiptFiles.length,
                    isIeeeDeposit: editingDeposit.isIeeeDeposit,
                    ieeeDepositSource: editingDeposit.ieeeDepositSource
                }
            };

            updateData.auditLogs = [...(editingDeposit.auditLogs || []), newAuditLog];

            await updateDoc(depositRef, updateData);

            setShowEditModal(false);
            setEditingDeposit(null);
            setEditReceiptFiles([]);
        } catch (error) {
            console.error('Error updating deposit:', error);
        }
    };

    const handleDeleteDeposit = async (depositId: string) => {
        if (!user || !window.confirm('Are you sure you want to delete this deposit? This action cannot be undone.')) return;

        try {
            // Get deposit data for audit
            const deposit = deposits.find(d => d.id === depositId);
            if (!deposit) return;

            // Delete receipt files from storage
            if (deposit.receiptFiles && deposit.receiptFiles.length > 0) {
                for (const fileUrl of deposit.receiptFiles) {
                    try {
                        const url = new URL(fileUrl);
                        const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
                        if (pathMatch) {
                            const storagePath = decodeURIComponent(pathMatch[1]);
                            const fileRef = ref(storage, storagePath);
                            await deleteObject(fileRef);
                        }
                    } catch (deleteError) {
                        console.warn('Failed to delete receipt file:', deleteError);
                    }
                }
            }

            // Delete the document
            await deleteDoc(doc(db, 'fundDeposits', depositId));
        } catch (error) {
            console.error('Error deleting deposit:', error);
        }
    };

    const removeReceiptFile = async (deposit: FundDeposit, fileUrl: string) => {
        if (!user) return;

        try {
            // Get user info
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();
            const userName = userData?.name || user.email || 'Unknown User';

            // Remove file from storage
            try {
                const url = new URL(fileUrl);
                const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
                if (pathMatch) {
                    const storagePath = decodeURIComponent(pathMatch[1]);
                    const fileRef = ref(storage, storagePath);
                    await deleteObject(fileRef);
                }
            } catch (deleteError) {
                console.warn('Failed to delete file from storage:', deleteError);
            }

            // Update deposit document
            const depositRef = doc(db, 'fundDeposits', deposit.id);
            const updatedReceiptFiles = (deposit.receiptFiles || []).filter(url => url !== fileUrl);

            const newAuditLog = {
                action: 'receipt_removed',
                createdBy: user.uid,
                createdByName: userName,
                timestamp: Timestamp.now(),
                note: 'Receipt file removed'
            };

            await updateDoc(depositRef, {
                receiptFiles: updatedReceiptFiles,
                auditLogs: [...(deposit.auditLogs || []), newAuditLog]
            });
        } catch (error) {
            console.error('Error removing receipt file:', error);
        }
    };

    const canModifyDeposit = (deposit: FundDeposit): boolean => {
        // Officers can always modify (edit/delete)
        if (userRole === 'Executive Officer' || userRole === 'General Officer') {
            return true;
        }
        // Users can only edit their own pending deposits, but cannot delete
        return deposit.depositedBy === user?.uid && deposit.status === 'pending';
    };

    const canEditDeposit = (deposit: FundDeposit): boolean => {
        return canModifyDeposit(deposit);
    };

    const canDeleteDeposit = (deposit: FundDeposit): boolean => {
        // Only officers can delete deposits, users cannot delete their own
        return userRole === 'Executive Officer' || userRole === 'General Officer';
    };

    const canChangeStatus = (deposit: FundDeposit): boolean => {
        // Only officers can change status, and they cannot approve their own deposits
        return (userRole === 'Executive Officer' || userRole === 'General Officer') &&
            deposit.depositedBy !== user?.uid;
    };

    const stats = {
        total: deposits.length,
        pending: deposits.filter(d => d.status === 'pending').length,
        verified: deposits.filter(d => d.status === 'verified').length,
        rejected: deposits.filter(d => d.status === 'rejected').length,
        totalAmount: deposits
            .filter(d => d.status === 'verified')
            .reduce((sum, d) => sum + d.amount, 0)
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <DashboardHeader
                title="Fund Deposits"
                subtitle="Track and manage funds deposited into the IEEE account"
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
                            <XCircle className="h-8 w-8 text-red-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Rejected</p>
                                <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <Banknote className="h-8 w-8 text-green-600" />
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Total Verified</p>
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
                                                    <div className="text-xs text-gray-400">
                                                        By: {deposit.depositedByName || deposit.depositedByEmail || 'Unknown'}
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
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {canEditDeposit(deposit) && (
                                                        <button
                                                            onClick={() => handleEditDeposit(deposit)}
                                                            className="text-gray-600 hover:text-gray-900"
                                                            title="Edit"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    {canDeleteDeposit(deposit) && (
                                                        <button
                                                            onClick={() => handleDeleteDeposit(deposit.id)}
                                                            className="text-red-600 hover:text-red-900"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    {canChangeStatus(deposit) && deposit.status === 'pending' && (
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
                                    placeholder="Check number, transaction ID, confirmation number for money sent to IEEE, etc."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Receipt Files
                                </label>
                                <input
                                    type="file"
                                    multiple
                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        setReceiptFiles(prev => [...prev, ...files]);
                                        e.target.value = ''; // Reset input to allow same files again
                                    }}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Upload receipt files (PDF, JPG, PNG, DOC, DOCX) - can select multiple files
                                </p>
                                {receiptFiles.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-sm font-medium text-gray-700">Selected files:</p>
                                        <ul className="text-sm text-gray-600">
                                            {receiptFiles.map((file, index) => (
                                                <li key={index} className="flex items-center justify-between">
                                                    <span>{file.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setReceiptFiles(prev => prev.filter((_, i) => i !== index))}
                                                        className="text-red-600 hover:text-red-800 ml-2"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* IEEE Deposit Section */}
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="isIeeeDeposit"
                                    checked={newDeposit.isIeeeDeposit}
                                    onChange={(e) => setNewDeposit({ ...newDeposit, isIeeeDeposit: e.target.checked })}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <label htmlFor="isIeeeDeposit" className="ml-2 block text-sm text-gray-900">
                                    This is an IEEE deposit (include Concur receipt)
                                </label>
                            </div>

                            {newDeposit.isIeeeDeposit && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        IEEE Source *
                                    </label>
                                    <select
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        value={newDeposit.ieeeDepositSource}
                                        onChange={(e) => setNewDeposit({ ...newDeposit, ieeeDepositSource: e.target.value as any })}
                                    >
                                        <option value="upp">IEEE UPP</option>
                                        <option value="section">IEEE Section</option>
                                        <option value="region">IEEE Region</option>
                                        <option value="global">IEEE Global</option>
                                        <option value="society">IEEE Society</option>
                                        <option value="other">Other IEEE Entity</option>
                                    </select>
                                </div>
                            )}
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

                            {selectedDeposit.receiptFiles && selectedDeposit.receiptFiles.length > 0 && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Receipt Files</h4>
                                    <div className="space-y-2">
                                        {selectedDeposit.receiptFiles.map((fileUrl, index) => (
                                            <a
                                                key={index}
                                                href={fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-800 underline block"
                                            >
                                                Receipt {index + 1}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedDeposit.auditLogs && selectedDeposit.auditLogs.length > 0 && (
                                <div>
                                    <h4 className="font-medium text-gray-900 mb-2">Activity Log</h4>
                                    <div className="space-y-2">
                                        {selectedDeposit.auditLogs.map((log, index) => (
                                            <div key={index} className="text-sm border-l-2 border-gray-200 pl-3">
                                                <div className="font-medium text-gray-900 capitalize">{log.action}</div>
                                                <div className="text-gray-500">
                                                    {log.timestamp?.toDate().toLocaleString()}
                                                    {log.createdByName && ` - by ${log.createdByName}`}
                                                </div>
                                                {log.note && <div className="text-gray-700 mt-1">{log.note}</div>}
                                                {log.previousData && log.newData && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        Changed from: {JSON.stringify(log.previousData)} to: {JSON.stringify(log.newData)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Deposit Modal */}
            {showEditModal && editingDeposit && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-medium text-gray-900">Edit Fund Deposit</h3>
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Deposit Title *
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={editingDeposit.title}
                                    onChange={(e) => setEditingDeposit({ ...editingDeposit, title: e.target.value })}
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
                                        value={editingDeposit.amount}
                                        onChange={(e) => setEditingDeposit({ ...editingDeposit, amount: parseFloat(e.target.value) || 0 })}
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
                                        value={editingDeposit.depositDate}
                                        onChange={(e) => setEditingDeposit({ ...editingDeposit, depositDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Deposit Method *
                                </label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    value={editingDeposit.depositMethod}
                                    onChange={(e) => setEditingDeposit({ ...editingDeposit, depositMethod: e.target.value as any })}
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
                                    value={editingDeposit.purpose}
                                    onChange={(e) => setEditingDeposit({ ...editingDeposit, purpose: e.target.value })}
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
                                    value={editingDeposit.description}
                                    onChange={(e) => setEditingDeposit({ ...editingDeposit, description: e.target.value })}
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
                                    value={editingDeposit.referenceNumber || ''}
                                    onChange={(e) => setEditingDeposit({ ...editingDeposit, referenceNumber: e.target.value })}
                                    placeholder="Check number, transaction ID, confirmation number for money sent to IEEE, etc."
                                />
                            </div>

                            {/* Existing Receipt Files */}
                            {editingDeposit.receiptFiles && editingDeposit.receiptFiles.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Existing Receipt Files
                                    </label>
                                    <div className="space-y-2">
                                        {editingDeposit.receiptFiles.map((fileUrl, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                                                <a
                                                    href={fileUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:text-blue-800 underline"
                                                >
                                                    Receipt {index + 1}
                                                </a>
                                                <button
                                                    onClick={() => removeReceiptFile(editingDeposit, fileUrl)}
                                                    className="text-red-600 hover:text-red-800"
                                                    title="Remove file"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Add New Receipt Files */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Add New Receipt Files
                                </label>
                                <input
                                    type="file"
                                    multiple
                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        setEditReceiptFiles(prev => [...prev, ...files]);
                                        e.target.value = '';
                                    }}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Upload additional receipt files (PDF, JPG, PNG, DOC, DOCX) - can select multiple files
                                </p>
                                {editReceiptFiles.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-sm font-medium text-gray-700">New files to upload:</p>
                                        <ul className="text-sm text-gray-600">
                                            {editReceiptFiles.map((file, index) => (
                                                <li key={index} className="flex items-center justify-between">
                                                    <span>{file.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditReceiptFiles(prev => prev.filter((_, i) => i !== index))}
                                                        className="text-red-600 hover:text-red-800 ml-2"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateDeposit}
                                disabled={!editingDeposit.title || !editingDeposit.amount || !editingDeposit.purpose}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Update Deposit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FundDepositsContent; 