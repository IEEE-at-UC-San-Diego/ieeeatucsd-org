import React, { useState, useEffect } from 'react';
import { Search, Calendar, Bell, User, Filter, Edit, CheckCircle, XCircle, Clock, DollarSign, Receipt, AlertCircle, FileText, MessageCircle, Eye, CreditCard, Check, X, Plus, Upload, Banknote, Trash2, Save, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, Timestamp, addDoc, getDoc, deleteDoc, where } from 'firebase/firestore';
import { db, storage } from '../../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../../firebase/client';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import type { UserRole } from '../../shared/types/firestore';
import { PublicProfileService } from '../../shared/services/publicProfile';
import { TableSkeleton, MetricCardSkeleton } from '../../../ui/loading';
import { useGlobalImagePaste } from '../../shared/hooks/useGlobalImagePaste';
import { useModalRegistration } from '../../shared/contexts/ModalContext';
import { usePasteNotification } from '../../shared/components/PasteNotification';
import MultiFileUpload from './components/MultiFileUpload';

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
    otherDepositMethod?: string; // Specification when depositMethod is 'other'
    purpose: string;
    receiptFiles?: string[];
    description: string;
    submittedAt: any;
    verifiedBy?: string;
    verifiedByName?: string;
    verifiedAt?: any;
    notes?: string;
    rejectionReason?: string; // Reason for rejection when status is 'rejected'
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

const getStatusLabel = (status: string) => {
    switch (status) {
        case 'pending':
            return 'Pending Review';
        case 'verified':
            return 'Verified';
        case 'approved':
            return 'Approved';
        case 'rejected':
            return 'Rejected';
        case 'submitted':
            return 'Submitted';
        case 'under_review':
            return 'Under Review';
        case 'processed':
            return 'Processed';
        default:
            return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    }
};

const FundDepositsContent: React.FC = () => {
    const [user, loading, error] = useAuthState(auth);
    const [deposits, setDeposits] = useState<FundDeposit[]>([]);
    const [filteredDeposits, setFilteredDeposits] = useState<FundDeposit[]>([]);
    const [isLoading, setIsLoading] = useState(true); // Start with loading state
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
        otherDepositMethod: '', // Add field for "other" specification
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

    // Sorting state
    const [sortField, setSortField] = useState<string>('submittedAt');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Validation state
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    // Rejection modal state
    const [showRejectionModal, setShowRejectionModal] = useState(false);
    const [rejectionDepositId, setRejectionDepositId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    const addReceiptFile = (file: File) => {
        setReceiptFiles(prev => [...prev, file]);
    };

    const addEditReceiptFile = (file: File) => {
        setEditReceiptFiles(prev => [...prev, file]);
    };

    // Paste notifications
    const { showPasteNotification: showNewDepositPaste, PasteNotificationComponent: NewDepositPasteNotification } =
        usePasteNotification('Receipt image pasted to new deposit');
    const { showPasteNotification: showEditDepositPaste, PasteNotificationComponent: EditDepositPasteNotification } =
        usePasteNotification('Receipt image pasted to deposit');

    // Register modals with global context
    useModalRegistration('fund-deposit-new', showNewDepositModal);
    useModalRegistration('fund-deposit-edit', showEditModal);

    // Global image paste handler for new deposit modal
    useGlobalImagePaste({
        modalType: 'fund-deposit-new',
        enabled: showNewDepositModal,
        onImagePaste: (file) => {
            addReceiptFile(file);
        },
        onPasteSuccess: () => {
            showNewDepositPaste();
        }
    });

    // Global image paste handler for edit deposit modal
    useGlobalImagePaste({
        modalType: 'fund-deposit-edit',
        enabled: showEditModal,
        onImagePaste: (file) => {
            addEditReceiptFile(file);
        },
        onPasteSuccess: () => {
            showEditDepositPaste();
        }
    });

    // Sortable header component
    const SortableHeader = ({ field, children, className = "" }: { field: string; children: React.ReactNode; className?: string }) => (
        <th
            className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${className}`}
            onClick={() => handleSort(field)}
        >
            <div className="flex items-center gap-1">
                {children}
                {sortField === field ? (
                    sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                ) : (
                    <ChevronsUpDown className="w-4 h-4 opacity-50" />
                )}
            </div>
        </th>
    );

    // Sorting function
    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Sort deposits based on current sort field and direction
    const sortedDeposits = React.useMemo(() => {
        return [...filteredDeposits].sort((a, b) => {
            let aValue: any = '';
            let bValue: any = '';

            switch (sortField) {
                case 'title':
                    aValue = a.title || '';
                    bValue = b.title || '';
                    break;
                case 'amount':
                    aValue = a.amount || 0;
                    bValue = b.amount || 0;
                    break;
                case 'depositMethod':
                    aValue = a.depositMethod || '';
                    bValue = b.depositMethod || '';
                    break;
                case 'status':
                    aValue = a.status || '';
                    bValue = b.status || '';
                    break;
                case 'depositDate':
                    aValue = new Date(a.depositDate).getTime();
                    bValue = new Date(b.depositDate).getTime();
                    break;
                case 'submittedAt':
                    aValue = a.submittedAt ? (a.submittedAt.toMillis ? a.submittedAt.toMillis() : a.submittedAt.toDate ? a.submittedAt.toDate().getTime() : 0) : 0;
                    bValue = b.submittedAt ? (b.submittedAt.toMillis ? b.submittedAt.toMillis() : b.submittedAt.toDate ? b.submittedAt.toDate().getTime() : 0) : 0;
                    break;
                default:
                    return 0;
            }

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredDeposits, sortField, sortDirection]);

    useEffect(() => {
        if (!user) return;

        const fetchUserRole = async () => {
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const role = userDoc.data().role || 'Member';
                    setUserRole(role);

                    // Set up query based on user role
                    let depositsQuery;
                    if (role === 'Administrator') {
                        // Only Administrators can see all deposits
                        depositsQuery = query(
                            collection(db, 'fundDeposits'),
                            orderBy('submittedAt', 'desc')
                        );
                    } else {
                        // All other users (including General/Executive Officers) can only see their own deposits
                        depositsQuery = query(
                            collection(db, 'fundDeposits'),
                            where('depositedBy', '==', user.uid),
                            orderBy('submittedAt', 'desc')
                        );
                    }

                    const unsubscribe = onSnapshot(depositsQuery, (snapshot) => {
                        const depositsData = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        })) as FundDeposit[];
                        setDeposits(depositsData);
                        setIsLoading(false);
                    }, (error) => {
                        console.error('Error fetching deposits:', error);
                        setIsLoading(false);
                    });

                    return () => unsubscribe();
                }
            } catch (error) {
                console.error('Error fetching user role:', error);
                setIsLoading(false);
            }
        };

        fetchUserRole();
    }, [user]);

    useEffect(() => {
        let filtered = deposits;

        // Remove the visibility filter since we're already querying correct deposits
        // filtered = filtered.filter(deposit => canViewDeposit(deposit));

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
    }, [deposits, searchTerm, statusFilter, userRole, user]);

    const uploadFiles = async (files: File[], path: string): Promise<string[]> => {
        // For fund deposits, we'll keep user-based organization for now
        // as they're not directly tied to specific events
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
        // Clear previous validation errors
        setValidationErrors({});

        // Validate required fields
        const errors: Record<string, string> = {};

        if (!user || !newDeposit.title || !newDeposit.amount || !newDeposit.purpose) {
            if (!newDeposit.title) errors.title = 'Title is required';
            if (!newDeposit.amount) errors.amount = 'Amount is required';
            if (!newDeposit.purpose) errors.purpose = 'Purpose is required';
        }

        // Validate "other" deposit method specification
        if (newDeposit.depositMethod === 'other' && !newDeposit.otherDepositMethod.trim()) {
            errors.otherDepositMethod = 'Please specify deposit method when "Other" is selected';
        }

        // If there are validation errors, show them and return
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            return;
        }

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
            if (!user) {
                throw new Error('User not authenticated');
            }
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
                otherDepositMethod: newDeposit.depositMethod === 'other' ? newDeposit.otherDepositMethod : null,
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

            const docRef = await addDoc(collection(db, 'fundDeposits'), depositData);

            // fire-and-forget email notification (submission)
            try {
                await fetch('/api/email/send-fund-deposit-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'fund_deposit_submission', depositId: docRef.id })
                });
            } catch (e) {
                console.warn('Fund deposit submission email failed', e);
            }

            setShowNewDepositModal(false);
            setNewDeposit({
                title: '',
                amount: '',
                depositDate: new Date().toISOString().split('T')[0],
                depositMethod: 'cash' as 'cash' | 'check' | 'bank_transfer' | 'other',
                otherDepositMethod: '',
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
            setValidationErrors({});
        } catch (error) {
            console.error('Error submitting deposit:', error);
        }
    };

    const handleStatusUpdate = async (depositId: string, newStatus: string, note?: string, rejectionReason?: string) => {
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

            // Add rejection reason if status is rejected
            if (newStatus === 'rejected' && rejectionReason) {
                updateData.rejectionReason = rejectionReason;
            }

            // Add audit log
            const deposit = deposits.find(d => d.id === depositId);
            if (deposit) {
                const newAuditLog = {
                    action: newStatus,
                    createdBy: user.uid,
                    createdByName: userName,
                    timestamp: Timestamp.now(),
                    note: rejectionReason || note || `Status changed to ${newStatus}`,
                    previousData: { status: deposit.status },
                    newData: { status: newStatus }
                };
                updateData.auditLogs = [...(deposit.auditLogs || []), newAuditLog];
            }

            await updateDoc(depositRef, updateData);

            // fire-and-forget email notification (status change)
            try {
                await fetch('/api/email/send-fund-deposit-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: 'fund_deposit_status_change', depositId, newStatus, rejectionReason })
                });
            } catch (e) {
                console.warn('Fund deposit status email failed', e);
            }
        } catch (error) {
            console.error('Error updating deposit status:', error);
        }
    };

    const handleRejectDeposit = (depositId: string) => {
        setRejectionDepositId(depositId);
        setRejectionReason('');
        setShowRejectionModal(true);
    };

    const handleConfirmRejection = async () => {
        if (!rejectionDepositId || !rejectionReason.trim()) return;

        await handleStatusUpdate(rejectionDepositId, 'rejected', rejectionReason, rejectionReason);
        setShowRejectionModal(false);
        setRejectionDepositId(null);
        setRejectionReason('');
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
            // Get deposit data for cleanup
            const deposit = deposits.find(d => d.id === depositId);
            if (!deposit) return;

            // 1) Delete Firestore document first to avoid dangling references
            await deleteDoc(doc(db, 'fundDeposits', depositId));

            // 2) Best-effort: delete storage files after doc removal
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

            const depositRef = doc(db, 'fundDeposits', deposit.id);
            const updatedReceiptFiles = (deposit.receiptFiles || []).filter(url => url !== fileUrl);

            // Attempt storage deletion first
            try {
                const url = new URL(fileUrl);
                const pathMatch = url.pathname.match(/\/o\/(.+?)\?/);
                if (pathMatch) {
                    const storagePath = decodeURIComponent(pathMatch[1]);
                    const fileRef = ref(storage, storagePath);
                    await deleteObject(fileRef);
                }
            } catch (deleteError) {
                console.error('Failed to delete receipt file:', deleteError);
                throw deleteError;
            }

            // Only update Firestore after successful storage deletion
            const removedAudit = {
                action: 'receipt_removed',
                createdBy: user.uid,
                createdByName: userName,
                timestamp: Timestamp.now(),
                note: 'Receipt file removed'
            };

            await updateDoc(depositRef, {
                receiptFiles: updatedReceiptFiles,
                auditLogs: [...(deposit.auditLogs || []), removedAudit]
            });

        } catch (error) {
            console.error('Error removing receipt file:', error);
        }
    };

    const canModifyDeposit = (deposit: FundDeposit): boolean => {
        // No one can edit deposits after submission (edit functionality removed)
        return false;
    };

    const canEditDeposit = (deposit: FundDeposit): boolean => {
        // Edit functionality completely removed per requirements
        return false;
    };

    const canDeleteDeposit = (deposit: FundDeposit): boolean => {
        // Users can only delete their own pending deposits
        if (deposit.depositedBy === user?.uid && deposit.status === 'pending') {
            return true;
        }
        // Only Administrators can delete any deposit
        return userRole === 'Administrator';
    };

    const canChangeStatus = (deposit: FundDeposit): boolean => {
        // Only Administrators can verify or decline deposits (including their own)
        return userRole === 'Administrator';
    };

    const canViewDeposit = (deposit: FundDeposit): boolean => {
        // Users can always view their own deposits
        if (deposit.depositedBy === user?.uid) {
            return true;
        }
        // Only Administrators can view all deposits
        return userRole === 'Administrator';
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
        <>
            {NewDepositPasteNotification}
            {EditDepositPasteNotification}
            <div className="min-h-screen bg-gray-50">
                <div className="p-4 md:p-6">
                    {/* Search Bar */}
                    {/* Header & Search */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Fund Deposits</h1>
                            <p className="text-gray-500 mt-1">Manage and track your fund deposits</p>
                        </div>
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search deposits..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white shadow-sm"
                            />
                        </div>
                    </div>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-4 md:mb-6">
                        {isLoading ? (
                            <>
                                <MetricCardSkeleton />
                                <MetricCardSkeleton />
                                <MetricCardSkeleton />
                                <MetricCardSkeleton />
                                <MetricCardSkeleton />
                            </>
                        ) : (
                            <>
                                <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-1">Total Deposits</p>
                                            <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats.total}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-1">Pending</p>
                                            <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats.pending}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-1">Verified</p>
                                            <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats.verified}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-gray-100 p-4 md:p-6 transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-1">Rejected</p>
                                            <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats.rejected}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100 p-6 transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-green-700 mb-1">Total Verified Amount</p>
                                            <p className="text-2xl md:text-3xl font-bold text-green-800">${stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Filters & Actions */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div className="bg-white rounded-2xl border border-gray-100 p-1.5 inline-flex shadow-sm">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${statusFilter === 'all'
                                    ? 'bg-gray-900 text-white shadow-md'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                All Deposits
                            </button>
                            <div className="w-px bg-gray-200 my-2 mx-1"></div>
                            <button
                                onClick={() => setStatusFilter('pending')}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${statusFilter === 'pending'
                                    ? 'bg-yellow-100 text-yellow-800 shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${statusFilter === 'pending' ? 'bg-yellow-500' : 'bg-yellow-400'}`}></div>
                                Pending
                            </button>
                            <button
                                onClick={() => setStatusFilter('verified')}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${statusFilter === 'verified'
                                    ? 'bg-blue-100 text-blue-800 shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${statusFilter === 'verified' ? 'bg-blue-500' : 'bg-blue-400'}`}></div>
                                Verified
                            </button>
                            <button
                                onClick={() => setStatusFilter('rejected')}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${statusFilter === 'rejected'
                                    ? 'bg-red-100 text-red-800 shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${statusFilter === 'rejected' ? 'bg-red-500' : 'bg-red-400'}`}></div>
                                Rejected
                            </button>
                        </div>

                        <button
                            onClick={() => setShowNewDepositModal(true)}
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 transition-all flex items-center gap-2 font-medium"
                        >
                            <Plus className="w-5 h-5" />
                            New Deposit
                        </button>
                    </div>

                    {/* Deposits Table */}
                    <div className="bg-white rounded-2xl shadow overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                    <tr className="bg-gray-50/50">
                                        <SortableHeader field="title" className="pl-6">
                                            Deposit Info
                                        </SortableHeader>
                                        <SortableHeader field="amount">
                                            Amount
                                        </SortableHeader>
                                        <SortableHeader field="depositMethod">
                                            Method
                                        </SortableHeader>
                                        <SortableHeader field="status">
                                            Status
                                        </SortableHeader>
                                        <SortableHeader field="depositDate">
                                            Date
                                        </SortableHeader>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={6} className="p-0">
                                                <TableSkeleton rows={6} columns={6} showHeader={false} />
                                            </td>
                                        </tr>
                                    ) : filteredDeposits.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                No deposits found
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedDeposits.map((deposit) => (
                                            <tr key={deposit.id} className="hover:bg-gray-50/80 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900">
                                                            {deposit.title}
                                                        </div>
                                                        <div className="text-sm text-gray-500 mt-0.5">
                                                            {deposit.purpose}
                                                        </div>
                                                        <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            {deposit.depositedByName || deposit.depositedByEmail || 'Unknown'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    ${deposit.amount.toFixed(2)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <span className="capitalize px-2 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-700 border border-gray-200">
                                                        {deposit.depositMethod.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${deposit.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                        deposit.status === 'verified' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                            'bg-red-50 text-red-700 border-red-200'
                                                        }`}>
                                                        {getStatusIcon(deposit.status)}
                                                        <span className="ml-1.5">{getStatusLabel(deposit.status)}</span>
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(deposit.depositDate).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {canViewDeposit(deposit) && (
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedDeposit(deposit);
                                                                    setShowDetailModal(true);
                                                                }}
                                                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="View Details"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {canDeleteDeposit(deposit) && (
                                                            <button
                                                                onClick={() => handleDeleteDeposit(deposit.id)}
                                                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {canChangeStatus(deposit) && deposit.status === 'pending' && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleStatusUpdate(deposit.id, 'verified')}
                                                                    className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                                    title="Verify"
                                                                >
                                                                    <Check className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleRejectDeposit(deposit.id)}
                                                                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
                        <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
                            <div className="p-6 border-b border-gray-100 flex-shrink-0 bg-gray-50/50 rounded-t-3xl">
                                <h3 className="text-xl font-bold text-gray-900">New Fund Deposit</h3>
                                <p className="text-sm text-gray-500 mt-1">Submit a new deposit record for review</p>
                            </div>

                            <div className="p-8 space-y-6 flex-grow overflow-y-auto">
                                <div className="space-y-6">
                                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                        <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                                            <div className="p-1 bg-blue-100 rounded-lg">
                                                <DollarSign className="w-4 h-4 text-blue-600" />
                                            </div>
                                            Transaction Details
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="col-span-1 md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                    Deposit Title <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${validationErrors.title ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                                                    value={newDeposit.title}
                                                    onChange={(e) => setNewDeposit({ ...newDeposit, title: e.target.value })}
                                                    placeholder="e.g., Membership Dues Collection"
                                                />
                                                {validationErrors.title && (
                                                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" /> {validationErrors.title}
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                    Amount <span className="text-red-500">*</span>
                                                </label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-gray-500 font-medium">$</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className={`w-full pl-8 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${validationErrors.amount ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                                                        value={newDeposit.amount}
                                                        onChange={(e) => setNewDeposit({ ...newDeposit, amount: e.target.value })}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                {validationErrors.amount && (
                                                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" /> {validationErrors.amount}
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                    Deposit Date <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                    value={newDeposit.depositDate}
                                                    onChange={(e) => setNewDeposit({ ...newDeposit, depositDate: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Deposit Method <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${validationErrors.depositMethod ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                                                value={newDeposit.depositMethod}
                                                onChange={(e) => setNewDeposit({ ...newDeposit, depositMethod: e.target.value as any })}
                                            >
                                                <option value="cash">Cash</option>
                                                <option value="check">Check</option>
                                                <option value="bank_transfer">Bank Transfer</option>
                                                <option value="other">Other</option>
                                            </select>
                                            {validationErrors.depositMethod && (
                                                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> {validationErrors.depositMethod}
                                                </p>
                                            )}
                                        </div>

                                        {newDeposit.depositMethod === 'other' && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                    Specify Method <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${validationErrors.otherDepositMethod ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                                                    value={newDeposit.otherDepositMethod}
                                                    onChange={(e) => setNewDeposit({ ...newDeposit, otherDepositMethod: e.target.value })}
                                                    placeholder="Specify method"
                                                />
                                                {validationErrors.otherDepositMethod && (
                                                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" /> {validationErrors.otherDepositMethod}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Purpose <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${validationErrors.purpose ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                                                value={newDeposit.purpose}
                                                onChange={(e) => setNewDeposit({ ...newDeposit, purpose: e.target.value })}
                                                placeholder="e.g., Membership Dues, Event Revenue, Sponsorship"
                                            />
                                            {validationErrors.purpose && (
                                                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> {validationErrors.purpose}
                                                </p>
                                            )}
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Description
                                            </label>
                                            <textarea
                                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                rows={3}
                                                value={newDeposit.description}
                                                onChange={(e) => setNewDeposit({ ...newDeposit, description: e.target.value })}
                                                placeholder="Additional details about this deposit..."
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Reference Number
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                value={newDeposit.referenceNumber}
                                                onChange={(e) => setNewDeposit({ ...newDeposit, referenceNumber: e.target.value })}
                                                placeholder="Transaction ID, Check #, etc."
                                            />
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-100 pt-6">
                                        <MultiFileUpload
                                            files={receiptFiles}
                                            onFilesChange={setReceiptFiles}
                                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                            maxFiles={10}
                                            maxSizeInMB={10}
                                            label="Receipt Files"
                                            description="Drag and drop files here, or click to browse"
                                        />
                                    </div>

                                    {/* IEEE Deposit Section */}
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                id="isIeeeDeposit"
                                                checked={newDeposit.isIeeeDeposit}
                                                onChange={(e) => setNewDeposit({ ...newDeposit, isIeeeDeposit: e.target.checked })}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all"
                                            />
                                            <label htmlFor="isIeeeDeposit" className="ml-2 block text-sm font-medium text-gray-900">
                                                This is an IEEE deposit (include Concur receipt)
                                            </label>
                                        </div>

                                        {newDeposit.isIeeeDeposit && (
                                            <div className="mt-4 pl-6 border-l-2 border-gray-300">
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                    IEEE Source <span className="text-red-500">*</span>
                                                </label>
                                                <select
                                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
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
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0 bg-gray-50/50 rounded-b-3xl">
                                <button
                                    onClick={() => setShowNewDepositModal(false)}
                                    className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:shadow-sm transition-all shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitDeposit}
                                    disabled={!newDeposit.title || !newDeposit.amount || !newDeposit.purpose}
                                    className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                                >
                                    Submit Deposit
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Detail Modal */}
                {showDetailModal && selectedDeposit && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
                        <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-3xl flex-shrink-0">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Deposit Details</h3>
                                    <p className="text-sm text-gray-500 mt-1">ID: {selectedDeposit.id}</p>
                                </div>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-8 space-y-8 flex-grow overflow-y-auto">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Left Column: Details */}
                                    <div className="space-y-6">
                                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
                                            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2 relative z-10">
                                                <FileText className="w-4 h-4 text-blue-600" />
                                                Deposit Information
                                            </h4>
                                            <dl className="space-y-4 relative z-10">
                                                <div>
                                                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Title</dt>
                                                    <dd className="text-gray-900 font-medium">{selectedDeposit.title}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Amount</dt>
                                                    <dd className="text-2xl font-bold text-gray-900">${selectedDeposit.amount.toFixed(2)}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Purpose</dt>
                                                    <dd className="text-gray-700 bg-gray-50 px-3 py-2 rounded-lg inline-block">{selectedDeposit.purpose}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Method</dt>
                                                    <dd className="text-gray-900 capitalize flex items-center gap-2">
                                                        <CreditCard className="w-4 h-4 text-gray-400" />
                                                        {selectedDeposit.depositMethod === 'other' && selectedDeposit.otherDepositMethod
                                                            ? selectedDeposit.otherDepositMethod
                                                            : selectedDeposit.depositMethod.replace('_', ' ')
                                                        }
                                                    </dd>
                                                </div>
                                                {selectedDeposit.referenceNumber && (
                                                    <div>
                                                        <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Reference Number</dt>
                                                        <dd className="text-gray-900 font-mono text-sm bg-gray-50 px-2 py-1 rounded border border-gray-200 inline-block">{selectedDeposit.referenceNumber}</dd>
                                                    </div>
                                                )}
                                            </dl>
                                        </div>

                                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 group hover:shadow-md transition-shadow">
                                            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                <Receipt className="w-4 h-4 text-blue-600" />
                                                Receipt Files
                                            </h4>
                                            {selectedDeposit.receiptFiles && selectedDeposit.receiptFiles.length > 0 ? (
                                                <div className="space-y-3">
                                                    {selectedDeposit.receiptFiles.map((fileUrl, index) => (
                                                        <a
                                                            key={index}
                                                            href={fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group/file"
                                                        >
                                                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg mr-3 group-hover/file:bg-blue-200 transition-colors">
                                                                <FileText className="w-4 h-4" />
                                                            </div>
                                                            <span className="text-sm font-medium text-gray-700 group-hover/file:text-blue-700 flex-1">View Receipt {index + 1}</span>
                                                            <Eye className="w-4 h-4 text-gray-400 group-hover/file:text-blue-500" />
                                                        </a>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-xl text-center">No receipt files attached</div>
                                            )}
                                        </div>

                                        {selectedDeposit.description && (
                                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                                                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                                    <MessageCircle className="w-4 h-4 text-blue-600" />
                                                    Description
                                                </h4>
                                                <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">{selectedDeposit.description}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Column: Status & Timeline */}
                                    <div className="space-y-6">
                                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                                            <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4 text-blue-600" />
                                                Status & Dates
                                            </h4>
                                            <dl className="space-y-5">
                                                <div>
                                                    <dt className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Current Status</dt>
                                                    <dd>
                                                        <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium border ${selectedDeposit.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                            selectedDeposit.status === 'verified' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                'bg-red-50 text-red-700 border-red-200'
                                                            }`}>
                                                            {getStatusIcon(selectedDeposit.status)}
                                                            <span className="ml-2">{getStatusLabel(selectedDeposit.status)}</span>
                                                        </span>
                                                    </dd>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-gray-50 p-3 rounded-xl">
                                                        <dt className="text-xs font-semibold text-gray-500 mb-1">Deposit Date</dt>
                                                        <dd className="text-sm font-medium text-gray-900">{new Date(selectedDeposit.depositDate).toLocaleDateString()}</dd>
                                                    </div>
                                                    <div className="bg-gray-50 p-3 rounded-xl">
                                                        <dt className="text-xs font-semibold text-gray-500 mb-1">Submitted</dt>
                                                        <dd className="text-sm font-medium text-gray-900">{selectedDeposit.submittedAt?.toDate().toLocaleDateString()}</dd>
                                                    </div>
                                                </div>
                                                {selectedDeposit.status === 'rejected' && selectedDeposit.rejectionReason && (
                                                    <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                                                        <dt className="text-xs font-bold text-red-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                                                            <AlertCircle className="w-3 h-3" /> Rejection Reason
                                                        </dt>
                                                        <dd className="text-sm text-red-700">{selectedDeposit.rejectionReason}</dd>
                                                    </div>
                                                )}
                                            </dl>
                                        </div>

                                        {selectedDeposit.auditLogs && selectedDeposit.auditLogs.length > 0 && (
                                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                                                <h4 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-blue-600" />
                                                    Activity Timeline
                                                </h4>
                                                <div className="relative border-l-2 border-gray-100 ml-3 space-y-6">
                                                    {selectedDeposit.auditLogs.map((log, index) => (
                                                        <div key={index} className="relative pl-6">
                                                            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-white bg-blue-100"></div>
                                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                                                                <div>
                                                                    <div className="text-sm font-semibold text-gray-900 capitalize">
                                                                        {log.action.replace('_', ' ')}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                                        by {log.createdByName || 'Unknown'}
                                                                    </div>
                                                                </div>
                                                                <div className="text-xs text-gray-400 mt-1 sm:mt-0 font-mono">
                                                                    {log.timestamp?.toDate().toLocaleString()}
                                                                </div>
                                                            </div>
                                                            {log.note && (
                                                                <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                                                    {log.note}
                                                                </div>
                                                            )}
                                                            {log.previousData && log.newData && (
                                                                <div className="mt-2">
                                                                    <details className="group">
                                                                        <summary className="text-xs text-blue-600 cursor-pointer hover:underline list-none flex items-center gap-1">
                                                                            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                                                                            View changes
                                                                        </summary>
                                                                        <div className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded-lg font-mono overflow-x-auto">
                                                                            <div className="opacity-50 mb-1">// Old</div>
                                                                            <div className="mb-2 text-red-300">{JSON.stringify(log.previousData, null, 2)}</div>
                                                                            <div className="opacity-50 mb-1">// New</div>
                                                                            <div className="text-green-300">{JSON.stringify(log.newData, null, 2)}</div>
                                                                        </div>
                                                                    </details>
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
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {showEditModal && editingDeposit && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
                        <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
                            <div className="p-6 border-b border-gray-100 flex-shrink-0 bg-gray-50/50 rounded-t-3xl">
                                <h3 className="text-xl font-bold text-gray-900">Edit Deposit</h3>
                                <p className="text-sm text-gray-500 mt-1">Update deposit details</p>
                            </div>

                            <div className="p-8 space-y-6 flex-grow overflow-y-auto">
                                <div className="space-y-6">
                                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                        <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                                            <div className="p-1 bg-blue-100 rounded-lg">
                                                <DollarSign className="w-4 h-4 text-blue-600" />
                                            </div>
                                            Transaction Details
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                            <div className="col-span-1 md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                    Deposit Title <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${validationErrors.title ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                                                    value={editingDeposit.title}
                                                    onChange={(e) => setEditingDeposit({ ...editingDeposit, title: e.target.value })}
                                                />
                                                {validationErrors.title && (
                                                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" /> {validationErrors.title}
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                    Amount <span className="text-red-500">*</span>
                                                </label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-gray-500 font-medium">$</span>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        className={`w-full pl-8 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${validationErrors.amount ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                                                        value={editingDeposit.amount}
                                                        onChange={(e) => setEditingDeposit({ ...editingDeposit, amount: Number(e.target.value) })}
                                                    />
                                                </div>
                                                {validationErrors.amount && (
                                                    <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" /> {validationErrors.amount}
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                    Deposit Date <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="date"
                                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                    value={editingDeposit.depositDate}
                                                    onChange={(e) => setEditingDeposit({ ...editingDeposit, depositDate: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Deposit Method <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${validationErrors.depositMethod ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                                                value={editingDeposit.depositMethod}
                                                onChange={(e) => setEditingDeposit({ ...editingDeposit, depositMethod: e.target.value as any })}
                                            >
                                                <option value="cash">Cash</option>
                                                <option value="check">Check</option>
                                                <option value="bank_transfer">Bank Transfer</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>

                                        {editingDeposit.depositMethod === 'other' && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                    Specify Method <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${validationErrors.otherDepositMethod ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                                                    value={editingDeposit.otherDepositMethod || ''}
                                                    onChange={(e) => setEditingDeposit({ ...editingDeposit, otherDepositMethod: e.target.value })}
                                                />
                                            </div>
                                        )}

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Purpose <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${validationErrors.purpose ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}
                                                value={editingDeposit.purpose}
                                                onChange={(e) => setEditingDeposit({ ...editingDeposit, purpose: e.target.value })}
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Description
                                            </label>
                                            <textarea
                                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                rows={3}
                                                value={editingDeposit.description || ''}
                                                onChange={(e) => setEditingDeposit({ ...editingDeposit, description: e.target.value })}
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Reference Number
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                value={editingDeposit.referenceNumber || ''}
                                                onChange={(e) => setEditingDeposit({ ...editingDeposit, referenceNumber: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-100 pt-6">
                                        <MultiFileUpload
                                            files={editReceiptFiles}
                                            onFilesChange={setEditReceiptFiles}
                                            existingFiles={editingDeposit.receiptFiles || []}
                                            onRemoveExistingFile={(fileUrl) => removeReceiptFile(editingDeposit, fileUrl)}
                                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                            maxFiles={10}
                                            maxSizeInMB={10}
                                            label="Receipt Files"
                                            description="Drag and drop files here, or click to browse"
                                        />
                                    </div>

                                    {/* IEEE Deposit Section */}
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                        <div className="flex items-center">
                                            <input
                                                type="checkbox"
                                                id="editIsIeeeDeposit"
                                                checked={editingDeposit.isIeeeDeposit || false}
                                                onChange={(e) => setEditingDeposit({ ...editingDeposit, isIeeeDeposit: e.target.checked })}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded transition-all"
                                            />
                                            <label htmlFor="editIsIeeeDeposit" className="ml-2 block text-sm font-medium text-gray-900">
                                                This is an IEEE deposit (include Concur receipt)
                                            </label>
                                        </div>

                                        {editingDeposit.isIeeeDeposit && (
                                            <div className="mt-4 pl-6 border-l-2 border-gray-300">
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                    IEEE Source <span className="text-red-500">*</span>
                                                </label>
                                                <select
                                                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                                                    value={editingDeposit.ieeeDepositSource || 'upp'}
                                                    onChange={(e) => setEditingDeposit({ ...editingDeposit, ieeeDepositSource: e.target.value as any })}
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
                                </div>
                            </div>

                            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0 bg-gray-50/50 rounded-b-3xl">
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:shadow-sm transition-all shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdateDeposit}
                                    className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20 transition-all shadow-md"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Rejection Modal */}
                {showRejectionModal && (
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
                        <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
                            <div className="p-6 border-b border-gray-100 bg-red-50/50">
                                <h3 className="text-xl font-bold text-red-900 flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-red-600" />
                                    Reject Deposit
                                </h3>
                                <p className="text-sm text-red-600/80 mt-1">Please provide a reason for rejecting this deposit.</p>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Rejection Reason <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
                                        rows={4}
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        placeholder="Explain why this deposit is being rejected..."
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        This reason will be visible to the user who submitted the deposit.
                                    </p>
                                </div>
                            </div>
                            <div className="p-6 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                                <button
                                    onClick={() => setShowRejectionModal(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:shadow-sm transition-all shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmRejection}
                                    disabled={!rejectionReason.trim()}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 border border-transparent rounded-xl hover:bg-red-700 hover:shadow-lg hover:shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                                >
                                    Reject Deposit
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default FundDepositsContent;
