import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import FilePreview from '../universal/FilePreview';
import { Get } from '../../../scripts/pocketbase/Get';
import { Update } from '../../../scripts/pocketbase/Update';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface Receipt {
    id: string;
    field: string;
    created_by: string;
    itemized_expenses: string; // JSON string
    tax: number;
    date: string;
    location_name: string;
    location_address: string;
    notes: string;
    audited_by: string[];
    auditor_names?: string[]; // Names of auditors
    created: string;
    updated: string;
}

interface User {
    id: string;
    name: string;
    email: string;
    avatar: string;
    zelle_information: string;
    created: string;
    updated: string;
}

interface Reimbursement {
    id: string;
    title: string;
    total_amount: number;
    date_of_purchase: string;
    payment_method: string;
    status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'in_progress' | 'paid';
    submitted_by: string;
    additional_info: string;
    receipts: string[]; // Array of Receipt IDs
    department: 'internal' | 'external' | 'projects' | 'events' | 'other';
    audit_notes: string | null; // JSON string for user-submitted notes
    audit_logs: string | null; // JSON string for system-generated logs
    created: string;
    updated: string;
    submitter?: User;
}

interface FilterOptions {
    status: string[];
    department: string[];
    dateRange: 'all' | 'week' | 'month' | 'year';
    sortBy: 'date_of_purchase' | 'total_amount' | 'status';
    sortOrder: 'asc' | 'desc';
}

interface ItemizedExpense {
    description: string;
    category: string;
    amount: number;
}

export default function ReimbursementManagementPortal() {
    const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
    const [receipts, setReceipts] = useState<Record<string, Receipt>>({});
    const [selectedReimbursement, setSelectedReimbursement] = useState<Reimbursement | null>(null);
    const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<FilterOptions>({
        status: [],
        department: [],
        dateRange: 'all',
        sortBy: 'date_of_purchase',
        sortOrder: 'desc'
    });
    const [auditNote, setAuditNote] = useState('');
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [expandedReceipts, setExpandedReceipts] = useState<Set<string>>(new Set());
    const [auditingReceipt, setAuditingReceipt] = useState<string | null>(null);
    const [users, setUsers] = useState<Record<string, User>>({});
    const [showUserProfile, setShowUserProfile] = useState<string | null>(null);
    const [auditNotes, setAuditNotes] = useState<string[]>([]);
    const userDropdownRef = React.useRef<HTMLDivElement>(null);
    const [currentLogPage, setCurrentLogPage] = useState(1);
    const [currentNotePage, setCurrentNotePage] = useState(1);
    const logsPerPage = 5;
    const [notesPerPage, setNotesPerPage] = useState(5);
    const [isPrivateNote, setIsPrivateNote] = useState(true);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectingId, setRejectingId] = useState<string | null>(null);

    useEffect(() => {
        const auth = Authentication.getInstance();
        if (!auth.isAuthenticated()) {
            setError('You must be logged in to view reimbursements');
            setLoading(false);
            return;
        }
        loadReimbursements();
    }, [filters]);

    // Add click outside handler
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
                setShowUserProfile(null);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const loadReimbursements = async () => {
        try {
            setLoading(true);
            setError(null);
            const get = Get.getInstance();
            const sort = `${filters.sortOrder === 'desc' ? '-' : ''}${filters.sortBy}`;

            let filter = '';
            if (filters.status.length > 0) {
                const statusFilter = filters.status.map(s => `status = "${s}"`).join(' || ');
                filter = `(${statusFilter})`;
            }

            if (filters.department.length > 0) {
                const departmentFilter = filters.department.map(d => `department = "${d}"`).join(' || ');
                filter = filter ? `${filter} && (${departmentFilter})` : `(${departmentFilter})`;
            }

            if (filters.dateRange !== 'all') {
                const now = new Date();
                const cutoff = new Date();
                switch (filters.dateRange) {
                    case 'week':
                        cutoff.setDate(now.getDate() - 7);
                        break;
                    case 'month':
                        cutoff.setMonth(now.getMonth() - 1);
                        break;
                    case 'year':
                        cutoff.setFullYear(now.getFullYear() - 1);
                        break;
                }
                const dateFilter = `created >= "${cutoff.toISOString()}"`;
                filter = filter ? `${filter} && ${dateFilter}` : dateFilter;
            }

            const records = await get.getAll<Reimbursement>('reimbursement', filter, sort);
            console.log('Loaded reimbursements:', records);

            // Load user data for submitters
            const userIds = new Set(records.map(r => r.submitted_by));
            const userRecords = await Promise.all(
                Array.from(userIds).map(async id => {
                    try {
                        return await get.getOne<User>('users', id);
                    } catch (error) {
                        console.error(`Failed to load user ${id}:`, error);
                        return null;
                    }
                })
            );

            const validUsers = userRecords.filter((u): u is User => u !== null);
            const userMap = Object.fromEntries(
                validUsers.map(user => [user.id, user])
            );
            setUsers(userMap);

            // Attach user data to reimbursements
            const enrichedRecords = records.map(record => ({
                ...record,
                submitter: userMap[record.submitted_by]
            }));

            setReimbursements(enrichedRecords);

            // Load associated receipts
            const receiptIds = enrichedRecords.flatMap(r => r.receipts || []);
            console.log('Extracted receipt IDs:', receiptIds, 'from reimbursements:', enrichedRecords.map(r => ({ id: r.id, receipts: r.receipts })));

            if (receiptIds.length > 0) {
                try {
                    console.log('Attempting to load receipts with IDs:', receiptIds);
                    const receiptRecords = await Promise.all(
                        receiptIds.map(async id => {
                            try {
                                const receipt = await get.getOne<Receipt>('receipts', id);
                                // Get auditor names from the users collection
                                if (receipt.audited_by.length > 0) {
                                    const auditorUsers = await Promise.all(
                                        receipt.audited_by.map(auditorId =>
                                            get.getOne('users', auditorId)
                                                .catch(() => ({ name: 'Unknown User' }))
                                        )
                                    );
                                    receipt.auditor_names = auditorUsers.map(user => user.name);
                                }
                                return receipt;
                            } catch (error) {
                                console.error(`Failed to load receipt ${id}:`, error);
                                return null;
                            }
                        })
                    );

                    const validReceipts = receiptRecords.filter((r): r is Receipt => r !== null);
                    console.log('Successfully loaded receipt records:', validReceipts);

                    const receiptMap = Object.fromEntries(
                        validReceipts.map(receipt => [receipt.id, receipt])
                    );
                    console.log('Created receipt map:', receiptMap);
                    setReceipts(receiptMap);
                } catch (error: any) {
                    console.error('Error loading receipts:', error);
                    console.error('Error details:', {
                        status: error?.status,
                        message: error?.message,
                        data: error?.data
                    });
                    toast.error('Failed to load receipts: ' + (error?.message || 'Unknown error'));
                }
            } else {
                console.log('No receipt IDs found in reimbursements');
                setReceipts({});
            }
        } catch (error) {
            console.error('Error loading reimbursements:', error);
            toast.error('Failed to load reimbursements. Please try again later.');
            setError('Failed to load reimbursements. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    // Add helper function to add audit log
    const addAuditLog = async (reimbursementId: string, action: string, details: Record<string, any> = {}) => {
        try {
            const update = Update.getInstance();
            const auth = Authentication.getInstance();
            const userId = auth.getUserId();

            if (!userId) throw new Error('User not authenticated');

            const reimbursement = reimbursements.find(r => r.id === reimbursementId);
            if (!reimbursement) throw new Error('Reimbursement not found');

            // Get current logs
            let currentLogs = [];
            try {
                if (reimbursement.audit_logs) {
                    if (typeof reimbursement.audit_logs === 'string') {
                        currentLogs = JSON.parse(reimbursement.audit_logs);
                    } else {
                        currentLogs = reimbursement.audit_logs;
                    }
                    if (!Array.isArray(currentLogs)) {
                        currentLogs = [];
                    }
                }
            } catch (error) {
                console.error('Error parsing existing audit logs:', error);
                currentLogs = [];
            }

            // Add new log entry
            currentLogs.push({
                action,
                ...details,
                auditor_id: userId,
                timestamp: new Date().toISOString()
            });

            await update.updateFields('reimbursement', reimbursementId, {
                audit_logs: JSON.stringify(currentLogs)
            });
        } catch (error) {
            console.error('Error adding audit log:', error);
        }
    };

    const refreshAuditData = async (reimbursementId: string) => {
        try {
            const get = Get.getInstance();
            const updatedReimbursement = await get.getOne<Reimbursement>('reimbursement', reimbursementId);

            // Get updated user data if needed
            if (!users[updatedReimbursement.submitted_by]) {
                const user = await get.getOne<User>('users', updatedReimbursement.submitted_by);
                setUsers(prev => ({
                    ...prev,
                    [user.id]: user
                }));
            }

            // Get updated receipt data
            const updatedReceipts = await Promise.all(
                updatedReimbursement.receipts.map(async id => {
                    try {
                        const receipt = await get.getOne<Receipt>('receipts', id);
                        // Get updated auditor names
                        if (receipt.audited_by.length > 0) {
                            const auditorUsers = await Promise.all(
                                receipt.audited_by.map(async auditorId => {
                                    try {
                                        const user = await get.getOne<User>('users', auditorId);
                                        // Update users state with any new auditors
                                        setUsers(prev => ({
                                            ...prev,
                                            [user.id]: user
                                        }));
                                        return user;
                                    } catch {
                                        return { name: 'Unknown User' } as User;
                                    }
                                })
                            );
                            receipt.auditor_names = auditorUsers.map(user => user.name);
                        }
                        return receipt;
                    } catch (error) {
                        console.error(`Failed to load receipt ${id}:`, error);
                        return null;
                    }
                })
            );

            const validReceipts = updatedReceipts.filter((r): r is Receipt => r !== null);
            const receiptMap = Object.fromEntries(
                validReceipts.map(receipt => [receipt.id, receipt])
            );

            // Update all states
            setReceipts(prev => ({
                ...prev,
                ...receiptMap
            }));

            // Update the reimbursement in the list
            setReimbursements(prev => prev.map(r =>
                r.id === reimbursementId ? {
                    ...r,
                    ...updatedReimbursement,
                    submitter: users[updatedReimbursement.submitted_by]
                } : r
            ));

            // Update selected reimbursement if it's the one being viewed
            if (selectedReimbursement?.id === reimbursementId) {
                setSelectedReimbursement({
                    ...selectedReimbursement,
                    ...updatedReimbursement,
                    submitter: users[updatedReimbursement.submitted_by]
                });
            }

            // Reset pagination to first page when data is refreshed
            setCurrentLogPage(1);
            setCurrentNotePage(1);
        } catch (error) {
            console.error('Error refreshing audit data:', error);
            toast.error('Failed to refresh audit data');
        }
    };

    // Update the updateStatus function
    const updateStatus = async (id: string, status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'in_progress' | 'paid') => {
        try {
            setLoadingStatus(true);
            const update = Update.getInstance();
            const auth = Authentication.getInstance();
            const userId = auth.getUserId();

            if (!userId) throw new Error('User not authenticated');

            await update.updateFields('reimbursement', id, { status });

            // Add audit log for status change
            await addAuditLog(id, 'status_change', {
                from: selectedReimbursement?.status,
                to: status
            });

            toast.success(`Reimbursement ${status} successfully`);
            await refreshAuditData(id);
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Failed to update reimbursement status');
            setError('Failed to update reimbursement status. Please try again.');
        } finally {
            setLoadingStatus(false);
        }
    };

    const toggleReceipt = (receiptId: string) => {
        setExpandedReceipts(prev => {
            const next = new Set(prev);
            if (next.has(receiptId)) {
                next.delete(receiptId);
            } else {
                next.add(receiptId);
            }
            return next;
        });
    };

    // Update the auditReceipt function
    const auditReceipt = async (receiptId: string) => {
        try {
            setAuditingReceipt(receiptId);
            const update = Update.getInstance();
            const auth = Authentication.getInstance();
            const userId = auth.getUserId();

            if (!userId) throw new Error('User not authenticated');

            const receipt = receipts[receiptId];
            if (!receipt) throw new Error('Receipt not found');

            const updatedAuditors = [...new Set([...receipt.audited_by, userId])];

            await update.updateFields('receipts', receiptId, {
                audited_by: updatedAuditors
            });

            // Add audit log for receipt audit
            if (selectedReimbursement) {
                let totalAmount = 0;
                try {
                    const expenses: ItemizedExpense[] = typeof receipt.itemized_expenses === 'string'
                        ? JSON.parse(receipt.itemized_expenses)
                        : receipt.itemized_expenses;
                    totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0) + receipt.tax;
                } catch (error) {
                    console.error('Error calculating total amount:', error);
                }

                await addAuditLog(selectedReimbursement.id, 'receipt_audit', {
                    receipt_id: receiptId,
                    receipt_name: receipt.location_name,
                    receipt_date: receipt.date,
                    receipt_amount: totalAmount
                });

                await refreshAuditData(selectedReimbursement.id);
            }

            // Update local state
            setReceipts(prev => ({
                ...prev,
                [receiptId]: {
                    ...prev[receiptId],
                    audited_by: updatedAuditors
                }
            }));

            toast.success('Receipt audited successfully');
        } catch (error) {
            console.error('Error auditing receipt:', error);
            toast.error('Failed to audit receipt');
        } finally {
            setAuditingReceipt(null);
        }
    };

    const canApproveOrReject = (reimbursement: Reimbursement): boolean => {
        const auth = Authentication.getInstance();
        const userId = auth.getUserId();

        if (!userId) return false;

        // Check if all receipts have been audited by the current user
        return reimbursement.receipts.every(receiptId => {
            const receipt = receipts[receiptId];
            return receipt && receipt.audited_by.includes(userId);
        });
    };

    const getReceiptUrl = (receipt: Receipt): string => {
        const auth = Authentication.getInstance();
        const pb = auth.getPocketBase();
        return pb.files.getURL(receipt, receipt.field);
    };

    // Add this function to get the user avatar URL
    const getUserAvatarUrl = (user: User): string => {
        const auth = Authentication.getInstance();
        const pb = auth.getPocketBase();
        return pb.files.getURL(user, user.avatar);
    };

    // Update the saveAuditNote function
    const saveAuditNote = async () => {
        try {
            if (!auditNote.trim()) {
                toast.error('Please enter a note before saving');
                return;
            }

            if (!selectedReimbursement) return;

            setLoadingStatus(true);
            const update = Update.getInstance();
            const auth = Authentication.getInstance();
            const userId = auth.getUserId();

            if (!userId) throw new Error('User not authenticated');

            // Parse existing notes or initialize empty array
            let currentNotes = [];
            try {
                if (selectedReimbursement.audit_notes) {
                    if (typeof selectedReimbursement.audit_notes === 'string') {
                        currentNotes = JSON.parse(selectedReimbursement.audit_notes);
                    } else {
                        currentNotes = selectedReimbursement.audit_notes;
                    }
                    if (!Array.isArray(currentNotes)) {
                        currentNotes = [];
                    }
                }
            } catch (error) {
                console.error('Error parsing existing audit notes:', error);
                currentNotes = [];
            }

            // Add new note with privacy setting
            currentNotes.push({
                note: auditNote.trim(),
                auditor_id: userId,
                timestamp: new Date().toISOString(),
                is_private: isPrivateNote
            });

            await update.updateFields('reimbursement', selectedReimbursement.id, {
                audit_notes: JSON.stringify(currentNotes)
            });

            // Add audit log for note addition
            await addAuditLog(selectedReimbursement.id, 'note_added', {
                note_preview: auditNote.length > 50 ? `${auditNote.substring(0, 50)}...` : auditNote,
                is_private: isPrivateNote
            });

            toast.success('Audit note saved successfully');
            setAuditNote('');
            setIsPrivateNote(true);
            await refreshAuditData(selectedReimbursement.id);
        } catch (error) {
            console.error('Error saving audit note:', error);
            toast.error('Failed to save audit note');
        } finally {
            setLoadingStatus(false);
        }
    };

    // Add this function to get auditor name
    const getAuditorName = (auditorId: string): string => {
        return users[auditorId]?.name || 'Unknown User';
    };

    // Add handleReject function
    const handleReject = (id: string) => {
        setRejectingId(id);
        setRejectReason('');
        setShowRejectModal(true);
    };

    // Add submitRejection function
    const submitRejection = async () => {
        if (!rejectReason.trim() || !rejectingId) return;

        try {
            setLoadingStatus(true);

            // First update the status
            await updateStatus(rejectingId, 'rejected');

            // Then add the rejection reason as a public note
            const auth = Authentication.getInstance();
            const userId = auth.getUserId();

            if (!userId) throw new Error('User not authenticated');

            // Get current notes
            let currentNotes = [];
            try {
                const reimbursement = reimbursements.find(r => r.id === rejectingId);
                if (reimbursement?.audit_notes) {
                    if (typeof reimbursement.audit_notes === 'string') {
                        currentNotes = JSON.parse(reimbursement.audit_notes);
                    } else {
                        currentNotes = reimbursement.audit_notes;
                    }
                    if (!Array.isArray(currentNotes)) {
                        currentNotes = [];
                    }
                }
            } catch (error) {
                console.error('Error parsing existing audit notes:', error);
                currentNotes = [];
            }

            // Add rejection reason as a public note
            currentNotes.push({
                note: `Rejection Reason: ${rejectReason.trim()}`,
                auditor_id: userId,
                timestamp: new Date().toISOString(),
                is_private: false
            });

            const update = Update.getInstance();
            await update.updateFields('reimbursement', rejectingId, {
                audit_notes: JSON.stringify(currentNotes)
            });

            await refreshAuditData(rejectingId);
            setShowRejectModal(false);
            setRejectingId(null);
            setRejectReason('');
            toast.success('Reimbursement rejected successfully');
        } catch (error) {
            console.error('Error rejecting reimbursement:', error);
            toast.error('Failed to reject reimbursement');
        } finally {
            setLoadingStatus(false);
        }
    };

    if (error) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="alert alert-error shadow-lg max-w-2xl mx-auto mt-8"
            >
                <Icon icon="heroicons:exclamation-circle" className="h-5 w-5" />
                <span>{error}</span>
            </motion.div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr),minmax(0,1fr)] gap-4 p-2 sm:p-4 max-w-[1600px] mx-auto">
            {/* Left side - List of reimbursements */}
            <div className="space-y-3 sm:space-y-4">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="sticky top-0 lg:top-4 z-10 bg-base-100 p-3 sm:p-5 rounded-xl shadow-lg border border-base-300"
                >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-4">
                        <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                            Reimbursement Requests
                        </h2>
                        <span className="badge badge-primary badge-md font-medium">
                            {reimbursements.length} Total
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        <div className="form-control">
                            <div className="join h-9 relative">
                                <div className="flex items-center justify-center w-9 bg-base-200 border border-base-300 rounded-l-lg join-item">
                                    <Icon icon="heroicons:funnel" className="h-4 w-4" />
                                </div>
                                <select
                                    className={`select select-bordered select-sm w-full focus:outline-none h-full join-item rounded-l-none ${filters.status.length > 0 ? 'pr-16' : 'pr-8'}`}
                                    value="placeholder"
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === 'placeholder') return;
                                        setFilters(prev => ({
                                            ...prev,
                                            status: prev.status.includes(value)
                                                ? prev.status.filter(s => s !== value)
                                                : [...prev.status, value]
                                        }));
                                    }}
                                >
                                    <option value="placeholder">
                                        {filters.status.length === 0
                                            ? 'Filter by Status'
                                            : `${filters.status.length} Status${filters.status.length > 1 ? 'es' : ''} Selected`}
                                    </option>
                                    <option value="submitted" className={filters.status.includes('submitted') ? 'bg-base-200' : ''}>
                                        Submitted {filters.status.includes('submitted') ? '✓' : ''}
                                    </option>
                                    <option value="under_review" className={filters.status.includes('under_review') ? 'bg-base-200' : ''}>
                                        Under Review {filters.status.includes('under_review') ? '✓' : ''}
                                    </option>
                                    <option value="approved" className={filters.status.includes('approved') ? 'bg-base-200' : ''}>
                                        Approved {filters.status.includes('approved') ? '✓' : ''}
                                    </option>
                                    <option value="rejected" className={filters.status.includes('rejected') ? 'bg-base-200' : ''}>
                                        Rejected {filters.status.includes('rejected') ? '✓' : ''}
                                    </option>
                                    <option value="in_progress" className={filters.status.includes('in_progress') ? 'bg-base-200' : ''}>
                                        In Progress {filters.status.includes('in_progress') ? '✓' : ''}
                                    </option>
                                    <option value="paid" className={filters.status.includes('paid') ? 'bg-base-200' : ''}>
                                        Paid {filters.status.includes('paid') ? '✓' : ''}
                                    </option>
                                </select>

                                {filters.status.length > 0 && (
                                    <button
                                        className="btn btn-ghost btn-sm absolute right-6 top-0 h-full px-2"
                                        onClick={() => setFilters(prev => ({ ...prev, status: [] }))}
                                    >
                                        <Icon icon="heroicons:x-mark" className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="form-control">
                            <div className="join h-9 relative">
                                <div className="flex items-center justify-center w-9 bg-base-200 border border-base-300 rounded-l-lg join-item">
                                    <Icon icon="heroicons:building-office" className="h-4 w-4" />
                                </div>
                                <select
                                    className={`select select-bordered select-sm w-full focus:outline-none h-full join-item rounded-l-none ${filters.department.length > 0 ? 'pr-16' : 'pr-8'}`}
                                    value="placeholder"
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === 'placeholder') return;
                                        setFilters(prev => ({
                                            ...prev,
                                            department: prev.department.includes(value)
                                                ? prev.department.filter(d => d !== value)
                                                : [...prev.department, value]
                                        }));
                                    }}
                                >
                                    <option value="placeholder">
                                        {filters.department.length === 0
                                            ? 'Filter by Department'
                                            : `${filters.department.length} Department${filters.department.length > 1 ? 's' : ''} Selected`}
                                    </option>
                                    <option value="internal" className={filters.department.includes('internal') ? 'bg-base-200' : ''}>
                                        Internal {filters.department.includes('internal') ? '✓' : ''}
                                    </option>
                                    <option value="external" className={filters.department.includes('external') ? 'bg-base-200' : ''}>
                                        External {filters.department.includes('external') ? '✓' : ''}
                                    </option>
                                    <option value="projects" className={filters.department.includes('projects') ? 'bg-base-200' : ''}>
                                        Projects {filters.department.includes('projects') ? '✓' : ''}
                                    </option>
                                    <option value="events" className={filters.department.includes('events') ? 'bg-base-200' : ''}>
                                        Events {filters.department.includes('events') ? '✓' : ''}
                                    </option>
                                    <option value="other" className={filters.department.includes('other') ? 'bg-base-200' : ''}>
                                        Other {filters.department.includes('other') ? '✓' : ''}
                                    </option>
                                </select>

                                {filters.department.length > 0 && (
                                    <button
                                        className="btn btn-ghost btn-sm absolute right-6 top-0 h-full px-2"
                                        onClick={() => setFilters(prev => ({ ...prev, department: [] }))}
                                    >
                                        <Icon icon="heroicons:x-mark" className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="form-control">
                            <div className="join h-9">
                                <div className="flex items-center justify-center w-9 bg-base-200 border border-base-300 rounded-l-lg join-item">
                                    <Icon icon="heroicons:calendar" className="h-4 w-4" />
                                </div>
                                <select
                                    className="select select-bordered select-sm w-full focus:outline-none h-full join-item rounded-l-none"
                                    value={filters.dateRange}
                                    onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as FilterOptions['dateRange'] })}
                                >
                                    <option value="all">All Time</option>
                                    <option value="week">Last Week</option>
                                    <option value="month">Last Month</option>
                                    <option value="year">Last Year</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-control md:col-span-2">
                            <div className="join h-9">
                                <div className="flex items-center justify-center w-9 bg-base-200 border border-base-300 rounded-l-lg join-item">
                                    <Icon icon="heroicons:arrows-up-down" className="h-4 w-4" />
                                </div>
                                <select
                                    className="select select-bordered select-sm w-full focus:outline-none h-full join-item rounded-none"
                                    value={filters.sortBy}
                                    onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as FilterOptions['sortBy'] })}
                                >
                                    <option value="date_of_purchase">Sort by Date</option>
                                    <option value="total_amount">Sort by Amount</option>
                                    <option value="status">Sort by Status</option>
                                </select>
                                <button
                                    className="btn btn-sm btn-ghost border border-base-300 rounded-l-none join-item w-9 h-full p-0 min-h-0"
                                    onClick={() => setFilters({ ...filters, sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
                                >
                                    <Icon
                                        icon={filters.sortOrder === 'asc' ? 'heroicons:arrow-up' : 'heroicons:arrow-down'}
                                        className="h-4 w-4"
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center p-12 space-y-4">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Icon icon="heroicons:document-text" className="h-6 w-6 text-primary" />
                            </div>
                        </div>
                        <p className="text-base-content/70 animate-pulse">Loading reimbursements...</p>
                    </div>
                ) : reimbursements.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center p-12 space-y-4 bg-base-200 rounded-2xl border-2 border-dashed border-base-300"
                    >
                        <Icon icon="heroicons:document-text" className="h-16 w-16 text-base-content/40" />
                        <p className="text-base-content/70">No reimbursements found</p>
                    </motion.div>
                ) : (
                    <AnimatePresence>
                        <div className="space-y-4">
                            {reimbursements.map((reimbursement, index) => (
                                <motion.div
                                    key={reimbursement.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`group card bg-base-100 hover:bg-base-200 cursor-pointer transition-all duration-200 border border-base-300
                                        ${selectedReimbursement?.id === reimbursement.id ? 'ring-2 ring-primary shadow-lg scale-[1.02]' : 'hover:scale-[1.01] hover:shadow-md'}`}
                                    onClick={() => setSelectedReimbursement(reimbursement)}
                                >
                                    <div className="card-body p-5">
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="space-y-2 flex-1 min-w-0">
                                                <h3 className="font-bold text-lg group-hover:text-primary transition-colors truncate">
                                                    {reimbursement.title}
                                                </h3>
                                                <div className="flex flex-wrap gap-3 text-sm">
                                                    <div className="flex items-center gap-1.5 text-base-content/70">
                                                        <Icon icon="heroicons:calendar" className="h-4 w-4 flex-shrink-0" />
                                                        <span>{new Date(reimbursement.date_of_purchase).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-base-content/70">
                                                        <Icon icon="heroicons:building-office" className="h-4 w-4 flex-shrink-0" />
                                                        <span className="truncate">{reimbursement.department}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                                <span className="font-mono font-bold text-lg text-primary whitespace-nowrap">
                                                    ${reimbursement.total_amount.toFixed(2)}
                                                </span>
                                                <span className={`badge ${reimbursement.status === 'approved' ? 'badge-success' :
                                                    reimbursement.status === 'rejected' ? 'badge-error' :
                                                        reimbursement.status === 'under_review' ? 'badge-info' :
                                                            reimbursement.status === 'in_progress' ? 'badge-warning' :
                                                                reimbursement.status === 'paid' ? 'badge-success' :
                                                                    'badge-ghost'
                                                    } gap-1.5 px-3 py-2.5 capitalize font-medium`}>
                                                    <Icon icon={
                                                        reimbursement.status === 'approved' ? 'heroicons:check-circle' :
                                                            reimbursement.status === 'rejected' ? 'heroicons:x-circle' :
                                                                reimbursement.status === 'under_review' ? 'heroicons:eye' :
                                                                    reimbursement.status === 'in_progress' ? 'heroicons:currency-dollar' :
                                                                        reimbursement.status === 'paid' ? 'heroicons:banknotes' :
                                                                            'heroicons:clock'
                                                    } className="h-4 w-4 flex-shrink-0" />
                                                    {reimbursement.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </AnimatePresence>
                )}
            </div>

            {/* Right side - Selected reimbursement details */}
            <AnimatePresence mode="wait">
                {selectedReimbursement ? (
                    <motion.div
                        key={selectedReimbursement.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="card bg-base-100 lg:sticky lg:top-4 h-fit max-h-[calc(100vh-1rem)] overflow-y-auto border border-base-300 shadow-xl"
                    >
                        <div className="card-body p-3 sm:p-6 space-y-4 sm:space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
                                <div className="space-y-2 flex-1 min-w-0">
                                    <h2 className="text-xl sm:text-2xl font-bold break-words">{selectedReimbursement.title}</h2>
                                    <div className="relative" ref={userDropdownRef}>
                                        <div className="flex flex-wrap items-center gap-2 text-base-content/70">
                                            <span>Submitted by:</span>
                                            <button
                                                className="btn btn-ghost btn-sm gap-2 hover:bg-base-200 -ml-1 truncate"
                                                onClick={() => setShowUserProfile(prev => prev === selectedReimbursement.submitted_by ? null : selectedReimbursement.submitted_by)}
                                            >
                                                {selectedReimbursement.submitter?.avatar && (
                                                    <img
                                                        src={getUserAvatarUrl(selectedReimbursement.submitter)}
                                                        alt=""
                                                        className="w-6 h-6 rounded-full flex-shrink-0"
                                                    />
                                                )}
                                                <span className="font-medium text-base-content truncate">{selectedReimbursement.submitter?.name || 'Unknown User'}</span>
                                                <Icon icon="heroicons:chevron-down" className="h-4 w-4 flex-shrink-0" />
                                            </button>
                                            {showUserProfile === selectedReimbursement.submitted_by && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="absolute top-full left-0 mt-2 w-72 bg-base-100 rounded-lg shadow-xl border border-base-300 z-50"
                                                >
                                                    <div className="p-4 space-y-3">
                                                        <div className="flex items-center gap-3">
                                                            {selectedReimbursement.submitter?.avatar && (
                                                                <img
                                                                    src={getUserAvatarUrl(selectedReimbursement.submitter)}
                                                                    alt=""
                                                                    className="w-12 h-12 rounded-full"
                                                                />
                                                            )}
                                                            <div>
                                                                <h3 className="font-semibold">{selectedReimbursement.submitter?.name}</h3>
                                                                <p className="text-sm text-base-content/70">{selectedReimbursement.submitter?.email}</p>
                                                            </div>
                                                        </div>
                                                        {selectedReimbursement.submitter?.zelle_information && (
                                                            <div className="pt-2 border-t border-base-300">
                                                                <h4 className="text-sm font-medium text-base-content/70 mb-1">Zelle Information</h4>
                                                                <p className="text-sm flex items-center gap-2">
                                                                    <Icon icon="heroicons:banknotes" className="h-4 w-4 text-primary flex-shrink-0" />
                                                                    {selectedReimbursement.submitter.zelle_information}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                    {selectedReimbursement.status === 'submitted' && (
                                        <button
                                            className="btn btn-sm btn-info gap-2 flex-1 sm:flex-initial"
                                            onClick={() => updateStatus(selectedReimbursement.id, 'under_review')}
                                            disabled={loadingStatus}
                                        >
                                            {loadingStatus ? (
                                                <span className="loading loading-spinner loading-sm" />
                                            ) : (
                                                <Icon icon="heroicons:eye" className="h-4 w-4 flex-shrink-0" />
                                            )}
                                            <span className="font-medium">Review</span>
                                        </button>
                                    )}
                                    {selectedReimbursement.status === 'under_review' && (
                                        <button
                                            className="btn btn-sm btn-success gap-2 flex-1 sm:flex-initial px-6"
                                            onClick={() => updateStatus(selectedReimbursement.id, 'approved')}
                                            disabled={loadingStatus || !canApproveOrReject(selectedReimbursement)}
                                            title={!canApproveOrReject(selectedReimbursement) ? 'All receipts must be audited first' : ''}
                                        >
                                            {loadingStatus ? (
                                                <span className="loading loading-spinner loading-sm" />
                                            ) : (
                                                <Icon icon="heroicons:check" className="h-4 w-4 flex-shrink-0" />
                                            )}
                                            <span className="font-medium">Approve</span>
                                        </button>
                                    )}
                                    {selectedReimbursement.status === 'approved' && (
                                        <button
                                            className="btn btn-sm btn-primary gap-2 flex-1 sm:flex-initial px-6"
                                            onClick={() => updateStatus(selectedReimbursement.id, 'in_progress')}
                                            disabled={loadingStatus}
                                        >
                                            {loadingStatus ? (
                                                <span className="loading loading-spinner loading-sm" />
                                            ) : (
                                                <Icon icon="heroicons:currency-dollar" className="h-4 w-4 flex-shrink-0" />
                                            )}
                                            <span className="font-medium">Mark as in progress</span>
                                        </button>
                                    )}
                                    {selectedReimbursement.status === 'in_progress' && (
                                        <button
                                            className="btn btn-sm btn-success gap-2 flex-1 sm:flex-initial px-6"
                                            onClick={() => updateStatus(selectedReimbursement.id, 'paid')}
                                            disabled={loadingStatus}
                                        >
                                            {loadingStatus ? (
                                                <span className="loading loading-spinner loading-sm" />
                                            ) : (
                                                <Icon icon="heroicons:check-circle" className="h-4 w-4 flex-shrink-0" />
                                            )}
                                            <span className="font-medium">Mark as Paid</span>
                                        </button>
                                    )}
                                    {selectedReimbursement.status !== 'rejected' && selectedReimbursement.status !== 'paid' && (
                                        <button
                                            className="btn btn-sm btn-error gap-2 flex-1 sm:flex-initial px-6"
                                            onClick={() => handleReject(selectedReimbursement.id)}
                                            disabled={loadingStatus}
                                        >
                                            {loadingStatus ? (
                                                <span className="loading loading-spinner loading-sm" />
                                            ) : (
                                                <Icon icon="heroicons:x-mark" className="h-4 w-4 flex-shrink-0" />
                                            )}
                                            <span className="font-medium">Reject</span>
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-ghost btn-sm hover:bg-base-200"
                                        onClick={() => setSelectedReimbursement(null)}
                                    >
                                        <Icon icon="heroicons:x-mark" className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-3">
                                <div className="card bg-base-200 hover:bg-base-300 transition-colors">
                                    <div className="card-body !p-3">
                                        <h3 className="text-sm font-medium text-base-content/70">Date of Purchase</h3>
                                        <p className="flex items-center gap-2 font-medium mt-1">
                                            <Icon icon="heroicons:calendar" className="h-4 w-4 text-primary flex-shrink-0" />
                                            {new Date(selectedReimbursement.date_of_purchase).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="card bg-base-200 hover:bg-base-300 transition-colors">
                                    <div className="card-body !p-3">
                                        <h3 className="text-sm font-medium text-base-content/70">Payment Method</h3>
                                        <p className="flex items-center gap-2 font-medium mt-1">
                                            <Icon icon="heroicons:credit-card" className="h-4 w-4 text-primary flex-shrink-0" />
                                            {selectedReimbursement.payment_method}
                                        </p>
                                    </div>
                                </div>
                                <div className="card bg-base-200 hover:bg-base-300 transition-colors">
                                    <div className="card-body !p-3">
                                        <h3 className="text-sm font-medium text-base-content/70">Department</h3>
                                        <p className="flex items-center gap-2 font-medium mt-1">
                                            <Icon icon="heroicons:building-office" className="h-4 w-4 text-primary flex-shrink-0" />
                                            <span className="capitalize">{selectedReimbursement.department.replace('_', ' ')}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="card bg-base-200 hover:bg-base-300 transition-colors">
                                    <div className="card-body !p-3">
                                        <h3 className="text-sm font-medium text-base-content/70">Total Amount</h3>
                                        <p className="font-mono font-bold text-xl text-primary">
                                            ${selectedReimbursement.total_amount.toFixed(2)}
                                        </p>
                                    </div>
                                </div>
                                {selectedReimbursement.submitter?.zelle_information && (
                                    <div className="card bg-base-200 hover:bg-base-300 transition-colors xs:col-span-2">
                                        <div className="card-body !p-3">
                                            <h3 className="text-sm font-medium text-base-content/70">Zelle Information</h3>
                                            <p className="flex items-center gap-2 font-medium mt-1">
                                                <Icon icon="heroicons:banknotes" className="h-4 w-4 text-primary flex-shrink-0" />
                                                {selectedReimbursement.submitter.zelle_information}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="divider before:bg-base-300 after:bg-base-300">
                                Receipts ({selectedReimbursement.receipts?.length || 0})
                            </div>

                            <div className="space-y-3 sm:space-y-4">
                                {selectedReimbursement.receipts?.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-4 sm:p-8 space-y-3 bg-base-200 rounded-lg border-2 border-dashed border-base-300">
                                        <Icon icon="heroicons:receipt-percent" className="h-10 sm:h-12 w-10 sm:w-12 text-base-content/30" />
                                        <p className="text-base-content/70 text-sm">No receipts attached</p>
                                    </div>
                                ) : (
                                    selectedReimbursement.receipts?.map(receiptId => {
                                        const receipt = receipts[receiptId];
                                        if (!receipt) return null;

                                        const isExpanded = expandedReceipts.has(receipt.id);

                                        return (
                                            <motion.div
                                                key={receipt.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="card bg-base-200 hover:bg-base-300 transition-all duration-200"
                                            >
                                                <div className="card-body !p-3 sm:!p-4">
                                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-4">
                                                        <div className="space-y-1 flex-1 min-w-0">
                                                            <h3 className="font-semibold text-base sm:text-lg truncate">
                                                                {receipt.location_name}
                                                            </h3>
                                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-base-content/70">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Icon icon="heroicons:map-pin" className="h-4 w-4 flex-shrink-0" />
                                                                    <span className="truncate">{receipt.location_address}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <Icon icon="heroicons:calendar" className="h-4 w-4 flex-shrink-0" />
                                                                    <span>{new Date(receipt.date).toLocaleDateString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            className="btn btn-ghost btn-sm p-1"
                                                            onClick={() => toggleReceipt(receipt.id)}
                                                        >
                                                            <motion.div
                                                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                                                transition={{ duration: 0.2 }}
                                                            >
                                                                <Icon
                                                                    icon="heroicons:chevron-down"
                                                                    className="h-5 w-5 text-base-content/70"
                                                                />
                                                            </motion.div>
                                                        </button>
                                                    </div>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: "auto" }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="border-t border-base-300"
                                                        >
                                                            <div className="p-3 sm:p-4 space-y-4">
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    {receipt.itemized_expenses && (
                                                                        <div className="space-y-2">
                                                                            <h4 className="text-sm font-medium text-base-content/70">Itemized Expenses</h4>
                                                                            <div className="space-y-2">
                                                                                {(() => {
                                                                                    try {
                                                                                        const expenses: ItemizedExpense[] = typeof receipt.itemized_expenses === 'string'
                                                                                            ? JSON.parse(receipt.itemized_expenses)
                                                                                            : receipt.itemized_expenses;
                                                                                        return expenses.map((expense, index) => (
                                                                                            <div key={index} className="flex justify-between items-start gap-2 text-sm">
                                                                                                <div>
                                                                                                    <p className="font-medium">{expense.description}</p>
                                                                                                    <p className="text-base-content/70">{expense.category}</p>
                                                                                                </div>
                                                                                                <span className="font-mono font-medium whitespace-nowrap">
                                                                                                    ${expense.amount.toFixed(2)}
                                                                                                </span>
                                                                                            </div>
                                                                                        ));
                                                                                    } catch (error) {
                                                                                        console.error('Error parsing itemized expenses:', error);
                                                                                        return <p className="text-error text-sm">Error loading expenses</p>;
                                                                                    }
                                                                                })()}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <div className="space-y-2">
                                                                        <h4 className="text-sm font-medium text-base-content/70">Receipt Details</h4>
                                                                        <div className="space-y-2">
                                                                            <div className="flex justify-between items-center text-sm">
                                                                                <span className="text-base-content/70">Tax</span>
                                                                                <span className="font-mono font-medium">${receipt.tax.toFixed(2)}</span>
                                                                            </div>
                                                                            <div className="flex justify-between items-center text-sm">
                                                                                <span className="text-base-content/70">Total</span>
                                                                                <span className="font-mono font-medium">
                                                                                    ${(() => {
                                                                                        try {
                                                                                            const expenses: ItemizedExpense[] = typeof receipt.itemized_expenses === 'string'
                                                                                                ? JSON.parse(receipt.itemized_expenses)
                                                                                                : receipt.itemized_expenses;
                                                                                            const subtotal = expenses.reduce((sum, item) => sum + item.amount, 0);
                                                                                            return (subtotal + receipt.tax).toFixed(2);
                                                                                        } catch (error) {
                                                                                            return '0.00';
                                                                                        }
                                                                                    })()}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {receipt.notes && (
                                                                    <div className="space-y-2">
                                                                        <h4 className="text-sm font-medium text-base-content/70">Notes</h4>
                                                                        <p className="text-sm whitespace-pre-wrap">{receipt.notes}</p>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-center flex-col items-center gap-2">
                                                                    <button
                                                                        className="btn btn-primary btn-sm gap-2 w-full"
                                                                        onClick={() => {
                                                                            setSelectedReceipt(receipt);
                                                                            setShowReceiptModal(true);
                                                                        }}
                                                                    >
                                                                        <Icon icon="heroicons:photo" className="h-4 w-4" />
                                                                        View Receipt
                                                                    </button>

                                                                </div>
                                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <h4 className="text-sm font-medium text-base-content/70">Audited by:</h4>
                                                                        {receipt.auditor_names?.length ? (
                                                                            <div className="flex flex-wrap gap-1">
                                                                                {receipt.auditor_names.map((name, index) => (
                                                                                    <span key={index} className="badge badge-ghost">{name}</span>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-sm text-base-content/70">Not audited yet</span>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        className="btn btn-primary btn-sm gap-2"
                                                                        onClick={() => auditReceipt(receipt.id)}
                                                                        disabled={auditingReceipt === receipt.id || receipt.audited_by.includes(Authentication.getInstance().getUserId() || '')}
                                                                    >
                                                                        {auditingReceipt === receipt.id ? (
                                                                            <span className="loading loading-spinner loading-sm" />
                                                                        ) : (
                                                                            <Icon icon="heroicons:check-circle" className="h-4 w-4" />
                                                                        )}
                                                                        {receipt.audited_by.includes(Authentication.getInstance().getUserId() || '') ? 'Audited' : 'Mark as Audited'}
                                                                    </button>
                                                                </div>

                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>

                            {selectedReimbursement.additional_info && (
                                <>
                                    <div className="divider before:bg-base-300 after:bg-base-300">Additional Information from Member</div>
                                    <div className="bg-base-200 p-4 rounded-lg">
                                        <p className="whitespace-pre-wrap text-sm">{selectedReimbursement.additional_info}</p>
                                    </div>
                                </>
                            )}

                            {selectedReimbursement.audit_logs && (
                                <>
                                    <div
                                        className="divider before:bg-base-300 after:bg-base-300 cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => setExpandedReceipts(prev => {
                                            const next = new Set(prev);
                                            if (next.has('audit_logs')) {
                                                next.delete('audit_logs');
                                            } else {
                                                next.add('audit_logs');
                                            }
                                            return next;
                                        })}
                                    >
                                        <div className="flex items-center gap-2">
                                            System Audit Logs
                                            <Icon
                                                icon={expandedReceipts.has('audit_logs') ? 'heroicons:chevron-up' : 'heroicons:chevron-down'}
                                                className="h-4 w-4"
                                            />
                                        </div>
                                    </div>
                                    <AnimatePresence>
                                        {expandedReceipts.has('audit_logs') && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="space-y-3 overflow-hidden"
                                            >
                                                {(() => {
                                                    if (!selectedReimbursement.audit_logs) return null;

                                                    let currentLogs = [];
                                                    try {
                                                        if (selectedReimbursement.audit_logs) {
                                                            if (typeof selectedReimbursement.audit_logs === 'string') {
                                                                currentLogs = JSON.parse(selectedReimbursement.audit_logs);
                                                            } else {
                                                                currentLogs = selectedReimbursement.audit_logs;
                                                            }
                                                            if (!Array.isArray(currentLogs)) {
                                                                currentLogs = [];
                                                            }
                                                        }
                                                    } catch (error) {
                                                        console.error('Error parsing existing audit logs:', error);
                                                        currentLogs = [];
                                                    }

                                                    if (currentLogs.length === 0) {
                                                        return (
                                                            <div className="bg-base-200 p-4 rounded-lg text-base-content/70 text-center">
                                                                No audit logs yet
                                                            </div>
                                                        );
                                                    }

                                                    // Sort logs by timestamp in descending order (most recent first)
                                                    currentLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                                                    const totalPages = Math.ceil(currentLogs.length / logsPerPage);
                                                    const startIndex = (currentLogPage - 1) * logsPerPage;
                                                    const endIndex = startIndex + logsPerPage;
                                                    const currentPageLogs = currentLogs.slice(startIndex, endIndex);

                                                    return (
                                                        <>
                                                            {currentPageLogs.map((log: { action: string; from?: string; to?: string; receipt_id?: string; receipt_name?: string; receipt_date?: string; receipt_amount?: number; auditor_id: string; timestamp: string }, index: number) => (
                                                                <div key={index} className="bg-base-200 p-4 rounded-lg space-y-2">
                                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={`badge ${log.to === 'approved' ? 'badge-success' :
                                                                                log.to === 'rejected' ? 'badge-error' :
                                                                                    log.to === 'under_review' ? 'badge-info' :
                                                                                        log.to === 'in_progress' ? 'badge-warning' :
                                                                                            log.to === 'paid' ? 'badge-success' :
                                                                                                'badge-ghost'
                                                                                } capitalize`}>
                                                                                {log.action === 'status_change' ? `Changed to ${log.to?.replace('_', ' ')}` :
                                                                                    log.action === 'receipt_audit' ? 'Audited Receipt' : log.action}
                                                                            </span>
                                                                            <span className="text-sm">
                                                                                by <span className="font-medium">{getAuditorName(log.auditor_id)}</span>
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-sm text-base-content/70">
                                                                            {new Date(log.timestamp).toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                    {log.action === 'status_change' && log.from && (
                                                                        <p className="text-sm text-base-content/70">
                                                                            Previous status: <span className="capitalize">{log.from.replace('_', ' ')}</span>
                                                                        </p>
                                                                    )}
                                                                    {log.action === 'receipt_audit' && log.receipt_name && (
                                                                        <p className="text-sm text-base-content/70">
                                                                            Receipt from <span className="font-medium">{log.receipt_name}</span>
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ))}

                                                            {totalPages > 1 && (
                                                                <div className="flex justify-center items-center gap-2 mt-4">
                                                                    <button
                                                                        className="btn btn-sm btn-ghost"
                                                                        onClick={() => setCurrentLogPage(prev => Math.max(1, prev - 1))}
                                                                        disabled={currentLogPage === 1}
                                                                    >
                                                                        <Icon icon="heroicons:chevron-left" className="h-4 w-4" />
                                                                    </button>
                                                                    <span className="text-sm">
                                                                        Page {currentLogPage} of {totalPages}
                                                                    </span>
                                                                    <button
                                                                        className="btn btn-sm btn-ghost"
                                                                        onClick={() => setCurrentLogPage(prev => Math.min(totalPages, prev + 1))}
                                                                        disabled={currentLogPage === totalPages}
                                                                    >
                                                                        <Icon icon="heroicons:chevron-right" className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </>
                            )}

                            {selectedReimbursement.audit_notes && (
                                <>
                                    <div
                                        className="divider before:bg-base-300 after:bg-base-300 cursor-pointer hover:text-primary transition-colors"
                                        onClick={() => setExpandedReceipts(prev => {
                                            const next = new Set(prev);
                                            if (next.has('audit_notes')) {
                                                next.delete('audit_notes');
                                            } else {
                                                next.add('audit_notes');
                                            }
                                            return next;
                                        })}
                                    >
                                        <div className="flex items-center gap-2">
                                            Auditor Notes
                                            <Icon
                                                icon={expandedReceipts.has('audit_notes') ? 'heroicons:chevron-up' : 'heroicons:chevron-down'}
                                                className="h-4 w-4"
                                            />
                                        </div>
                                    </div>
                                    <AnimatePresence>
                                        {expandedReceipts.has('audit_notes') && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: "auto" }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="space-y-3 overflow-hidden"
                                            >
                                                {(() => {
                                                    if (!selectedReimbursement.audit_notes) return null;

                                                    let notes = [];
                                                    try {
                                                        if (typeof selectedReimbursement.audit_notes === 'string') {
                                                            notes = JSON.parse(selectedReimbursement.audit_notes);
                                                        } else {
                                                            notes = selectedReimbursement.audit_notes;
                                                        }
                                                        if (!Array.isArray(notes)) {
                                                            notes = [];
                                                        }
                                                    } catch (error) {
                                                        console.error('Error parsing audit notes:', error);
                                                        notes = [];
                                                    }

                                                    if (notes.length === 0) {
                                                        return (
                                                            <div className="bg-base-200 p-4 rounded-lg text-base-content/70 text-center">
                                                                No audit notes yet
                                                            </div>
                                                        );
                                                    }

                                                    // Sort notes by timestamp in descending order (most recent first)
                                                    notes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                                                    const totalPages = Math.ceil(notes.length / notesPerPage);
                                                    const startIndex = (currentNotePage - 1) * notesPerPage;
                                                    const endIndex = startIndex + notesPerPage;
                                                    const currentPageNotes = notes.slice(startIndex, endIndex);

                                                    return (
                                                        <>
                                                            {currentPageNotes.map((note, index) => (
                                                                <div key={index} className="bg-base-200 p-4 rounded-lg space-y-2">
                                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-sm">
                                                                                Note by <span className="font-medium">{getAuditorName(note.auditor_id)}</span>
                                                                            </span>
                                                                            {note.is_private && (
                                                                                <span className="badge badge-ghost gap-1">
                                                                                    <Icon icon="heroicons:eye-slash" className="h-3 w-3" />
                                                                                    Private
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-sm text-base-content/70">
                                                                            {new Date(note.timestamp).toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                                                                </div>
                                                            ))}

                                                            {totalPages > 1 && (
                                                                <div className="flex justify-center items-center gap-2 mt-4">
                                                                    <button
                                                                        className="btn btn-sm btn-ghost"
                                                                        onClick={() => setCurrentNotePage(prev => Math.max(1, prev - 1))}
                                                                        disabled={currentNotePage === 1}
                                                                    >
                                                                        <Icon icon="heroicons:chevron-left" className="h-4 w-4" />
                                                                    </button>
                                                                    <span className="text-sm">
                                                                        Page {currentNotePage} of {totalPages}
                                                                    </span>
                                                                    <button
                                                                        className="btn btn-sm btn-ghost"
                                                                        onClick={() => setCurrentNotePage(prev => Math.min(totalPages, prev + 1))}
                                                                        disabled={currentNotePage === totalPages}
                                                                    >
                                                                        <Icon icon="heroicons:chevron-right" className="h-4 w-4" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </>
                            )}

                            <div className="form-control">
                                <label className="label justify-between">
                                    <span className="label-text font-medium">New Audit Note</span>
                                    <span className="label-text-alt text-base-content/70">
                                        {auditNote.length} / 500 characters
                                    </span>
                                </label>
                                <div className="space-y-2">
                                    <textarea
                                        className="textarea textarea-bordered w-full min-h-[120px] resize-y font-medium"
                                        value={auditNote}
                                        onChange={(e) => setAuditNote(e.target.value)}
                                        placeholder="Enter your audit note here..."
                                        rows={3}
                                        maxLength={500}
                                    />
                                    <div className="flex items-center gap-2">
                                        <label className="label cursor-pointer gap-2">
                                            <input
                                                type="checkbox"
                                                className="checkbox checkbox-sm"
                                                checked={!isPrivateNote}
                                                onChange={(e) => setIsPrivateNote(!e.target.checked)}
                                            />
                                            <span className="label-text flex items-center gap-1">
                                                <Icon icon="heroicons:eye" className="h-4 w-4" />
                                                Make note visible to member
                                            </span>
                                        </label>
                                    </div>
                                    <button
                                        className="btn btn-primary w-full gap-2"
                                        onClick={saveAuditNote}
                                        disabled={loadingStatus || !auditNote.trim()}
                                    >
                                        {loadingStatus ? (
                                            <span className="loading loading-spinner loading-sm" />
                                        ) : (
                                            <Icon icon="heroicons:document-text" className="h-4 w-4" />
                                        )}
                                        Save Audit Note
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center p-12 space-y-4 text-base-content/70 h-[50vh] bg-base-200 rounded-2xl border-2 border-dashed border-base-300"
                    >
                        <Icon icon="heroicons:document-text" className="h-16 w-16 text-base-content/40" />
                        <p>Select a reimbursement to view details</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Add Rejection Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="modal-box relative max-w-lg w-full"
                    >
                        <h3 className="font-bold text-lg mb-4">Reject Reimbursement</h3>
                        <p className="text-base-content/70 mb-4">
                            Please provide a reason for rejecting this reimbursement. This will be added as a public note.
                        </p>
                        <div className="form-control">
                            <textarea
                                className="textarea textarea-bordered w-full min-h-[120px] resize-y font-medium"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Enter rejection reason..."
                                rows={3}
                                maxLength={500}
                            />
                        </div>
                        <div className="modal-action mt-6">
                            <button
                                className="btn btn-ghost"
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectingId(null);
                                    setRejectReason('');
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-error"
                                onClick={submitRejection}
                                disabled={!rejectReason.trim() || loadingStatus}
                            >
                                {loadingStatus ? (
                                    <span className="loading loading-spinner loading-sm" />
                                ) : (
                                    'Confirm Rejection'
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Receipt Preview Modal */}
            {showReceiptModal && selectedReceipt && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="modal-box relative max-w-4xl w-full bg-base-100 p-0 overflow-hidden"
                    >
                        <div className="sticky top-0 flex items-center justify-between p-4 bg-base-100 border-b border-base-300 z-10">
                            <h3 className="font-bold text-lg pl-2">
                                File Preview
                            </h3>


                            <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => {
                                    setShowReceiptModal(false);
                                    setSelectedReceipt(null);
                                }}
                            >

                                <Icon icon="heroicons:x-mark" className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="px-4 py-0">
                            <FilePreview
                                url={getReceiptUrl(selectedReceipt)}
                                filename={`Receipt from ${selectedReceipt.location_name}`}
                            />
                        </div>
                        <div className="sticky bottom-0 flex justify-end gap-2 p-4 bg-base-100 border-t border-base-300">

                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
} 