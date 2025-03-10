import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Get } from '../../../scripts/pocketbase/Get';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { FileManager } from '../../../scripts/pocketbase/FileManager';
import FilePreview from '../universal/FilePreview';
import { motion, AnimatePresence } from 'framer-motion';
import type { ItemizedExpense, Reimbursement, Receipt } from '../../../schemas/pocketbase';
import { DataSyncService } from '../../../scripts/database/DataSyncService';
import { Collections } from '../../../schemas/pocketbase/schema';
import { toast } from 'react-hot-toast';

interface AuditNote {
    note: string;
    auditor_id: string;
    timestamp: string;
    is_private: boolean;
}

// Extended Reimbursement interface with component-specific properties
interface ReimbursementRequest extends Omit<Reimbursement, 'audit_notes'> {
    audit_notes: AuditNote[] | null;
}

// Extended Receipt interface with component-specific properties
interface ReceiptDetails extends Omit<Receipt, 'itemized_expenses' | 'audited_by'> {
    file: string;
    itemized_expenses: ItemizedExpense[];
    audited_by: string[];
    created: string;
    updated: string;
}

const STATUS_COLORS = {
    submitted: 'badge-primary',
    under_review: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-error',
    paid: 'badge-success',
    in_progress: 'badge-info'
};

const STATUS_LABELS = {
    submitted: 'Submitted',
    under_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
    paid: 'Paid',
    in_progress: 'In Progress'
};

const DEPARTMENT_LABELS = {
    internal: 'Internal',
    external: 'External',
    projects: 'Projects',
    events: 'Events',
    other: 'Other'
};

// Add this after the STATUS_LABELS constant
const STATUS_ORDER = ['submitted', 'under_review', 'approved', 'rejected', 'in_progress', 'paid'] as const;

const STATUS_ICONS = {
    submitted: 'heroicons:paper-airplane',
    under_review: 'heroicons:eye',
    approved: 'heroicons:check-circle',
    rejected: 'heroicons:x-circle',
    in_progress: 'heroicons:clock',
    paid: 'heroicons:banknotes'
} as const;

// Add these animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            duration: 0.3,
            when: "beforeChildren",
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.3,
            type: "spring",
            stiffness: 100,
            damping: 15
        }
    }
};

export default function ReimbursementList() {
    const [requests, setRequests] = useState<ReimbursementRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedRequest, setSelectedRequest] = useState<ReimbursementRequest | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewFilename, setPreviewFilename] = useState('');
    const [selectedReceipt, setSelectedReceipt] = useState<ReceiptDetails | null>(null);
    const [receiptDetailsMap, setReceiptDetailsMap] = useState<Record<string, ReceiptDetails>>({});

    const get = Get.getInstance();
    const auth = Authentication.getInstance();
    const fileManager = FileManager.getInstance();

    useEffect(() => {
        // console.log('Component mounted');
        fetchReimbursements();
    }, []);

    // Add effect to monitor requests state
    useEffect(() => {
        // console.log('Requests state updated:', requests);
        // console.log('Number of requests:', requests.length);
    }, [requests]);

    // Add a useEffect to log preview URL and filename changes
    useEffect(() => {
        // console.log('Preview URL changed:', previewUrl);
        // console.log('Preview filename changed:', previewFilename);
    }, [previewUrl, previewFilename]);

    // Add a useEffect to log when the preview modal is shown/hidden
    useEffect(() => {
        // console.log('Show preview changed:', showPreview);
        if (showPreview) {
            // console.log('Selected receipt:', selectedReceipt);
        }
    }, [showPreview, selectedReceipt]);

    const fetchReimbursements = async () => {
        setLoading(true);
        setError('');

        try {
            const pb = auth.getPocketBase();
            const userId = pb.authStore.model?.id;

            if (!userId) {
                // Silently return without error when on dashboard page
                if (window.location.pathname.includes('/dashboard')) {
                    setLoading(false);
                    return;
                }
                throw new Error('User not authenticated');
            }

            // Use DataSyncService to get data from IndexedDB with forced sync
            const dataSync = DataSyncService.getInstance();

            // Sync reimbursements collection
            await dataSync.syncCollection(
                Collections.REIMBURSEMENTS,
                `submitted_by="${userId}"`,
                '-created',
                'audit_notes'
            );

            // Get reimbursements from IndexedDB
            const reimbursementRecords = await dataSync.getData<ReimbursementRequest>(
                Collections.REIMBURSEMENTS,
                false, // Don't force sync again
                `submitted_by="${userId}"`,
                '-created'
            );

            // console.log('Reimbursement records from IndexedDB:', reimbursementRecords);

            // Process the records
            const processedRecords = reimbursementRecords.map(record => {
                // Process audit notes if they exist
                let auditNotes = null;
                if (record.audit_notes) {
                    try {
                        // If it's a string, parse it
                        if (typeof record.audit_notes === 'string') {
                            auditNotes = JSON.parse(record.audit_notes);
                        } else {
                            // Otherwise use it directly
                            auditNotes = record.audit_notes;
                        }
                    } catch (e) {
                        // console.error('Error parsing audit notes:', e);
                    }
                }

                return {
                    ...record,
                    audit_notes: auditNotes
                };
            });

            setRequests(processedRecords);

            // Fetch receipt details for each reimbursement
            for (const record of processedRecords) {
                if (record.receipts && record.receipts.length > 0) {
                    for (const receiptId of record.receipts) {
                        try {
                            // Get receipt from IndexedDB
                            const receiptRecord = await dataSync.getItem<ReceiptDetails>(
                                Collections.RECEIPTS,
                                receiptId
                            );

                            if (receiptRecord) {
                                // Process itemized expenses
                                let itemizedExpenses: ItemizedExpense[] = [];
                                if (receiptRecord.itemized_expenses) {
                                    try {
                                        if (typeof receiptRecord.itemized_expenses === 'string') {
                                            itemizedExpenses = JSON.parse(receiptRecord.itemized_expenses);
                                        } else {
                                            itemizedExpenses = receiptRecord.itemized_expenses as ItemizedExpense[];
                                        }
                                    } catch (e) {
                                        // console.error('Error parsing itemized expenses:', e);
                                    }
                                }

                                // Add receipt to state
                                setReceiptDetailsMap(prevMap => ({
                                    ...prevMap,
                                    [receiptId]: {
                                        id: receiptRecord.id,
                                        file: receiptRecord.file,
                                        created_by: receiptRecord.created_by,
                                        date: receiptRecord.date,
                                        location_name: receiptRecord.location_name,
                                        location_address: receiptRecord.location_address,
                                        notes: receiptRecord.notes,
                                        tax: receiptRecord.tax,
                                        created: receiptRecord.created,
                                        updated: receiptRecord.updated,
                                        itemized_expenses: itemizedExpenses,
                                        audited_by: receiptRecord.audited_by || []
                                    }
                                }));
                            }
                        } catch (e) {
                            // console.error(`Error fetching receipt ${receiptId}:`, e);
                        }
                    }
                }
            }
        } catch (err) {
            // console.error('Error fetching reimbursements:', err);
            setError('Failed to load reimbursements. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handlePreviewFile = async (request: ReimbursementRequest, receiptId: string) => {
        try {
            // console.log('Previewing file for receipt ID:', receiptId);
            const pb = auth.getPocketBase();
            const fileManager = FileManager.getInstance();

            // Set the selected request
            setSelectedRequest(request);

            // Check if we already have the receipt details in our map
            if (receiptDetailsMap[receiptId]) {
                // console.log('Using cached receipt details');
                // Use the cached receipt details
                setSelectedReceipt(receiptDetailsMap[receiptId]);

                // Check if the receipt has a file
                if (!receiptDetailsMap[receiptId].file) {
                    // console.error('Receipt has no file attached');
                    toast.error('This receipt has no file attached');
                    setPreviewUrl('');
                    setPreviewFilename('');
                    setShowPreview(true);
                    return;
                }

                // Get the file URL with token for protected files
                // console.log('Getting file URL with token');
                const url = await fileManager.getFileUrlWithToken(
                    'receipts',
                    receiptId,
                    receiptDetailsMap[receiptId].file,
                    true // Use token for protected files
                );

                // Check if the URL is empty
                if (!url) {
                    // console.error('Failed to get file URL: Empty URL returned');
                    toast.error('Failed to load receipt: Could not generate file URL');
                    // Still show the preview modal but with empty URL to display the error message
                    setPreviewUrl('');
                    setPreviewFilename(receiptDetailsMap[receiptId].file || '');
                    setShowPreview(true);
                    return;
                }

                // console.log('Got URL:', url.substring(0, 50) + '...');

                // Set the preview URL and filename
                setPreviewUrl(url);
                setPreviewFilename(receiptDetailsMap[receiptId].file);

                // Show the preview modal
                setShowPreview(true);

                // Log the current state
                // console.log('Current state after setting:', {
                //     previewUrl: url,
                //     previewFilename: receiptDetailsMap[receiptId].file,
                //     showPreview: true
                // });

                return;
            }

            // If not in the map, get the receipt record using its ID
            // console.log('Fetching receipt details from server');
            const receiptRecord = await pb.collection('receipts').getOne(receiptId, {
                $autoCancel: false
            });

            if (receiptRecord) {
                // console.log('Receipt record found:', receiptRecord.id);
                // console.log('Receipt file:', receiptRecord.file);

                // Check if the receipt has a file
                if (!receiptRecord.file) {
                    // console.error('Receipt has no file attached');
                    toast.error('This receipt has no file attached');
                    setPreviewUrl('');
                    setPreviewFilename('');
                    setShowPreview(true);
                    return;
                }

                // Parse the itemized expenses if it's a string
                const itemizedExpenses = typeof receiptRecord.itemized_expenses === 'string'
                    ? JSON.parse(receiptRecord.itemized_expenses)
                    : receiptRecord.itemized_expenses;

                const receiptDetails: ReceiptDetails = {
                    id: receiptRecord.id,
                    file: receiptRecord.file,
                    created_by: receiptRecord.created_by,
                    itemized_expenses: itemizedExpenses,
                    tax: receiptRecord.tax,
                    date: receiptRecord.date,
                    location_name: receiptRecord.location_name,
                    location_address: receiptRecord.location_address,
                    notes: receiptRecord.notes || '',
                    audited_by: receiptRecord.audited_by || [],
                    created: receiptRecord.created,
                    updated: receiptRecord.updated
                };

                // Add to the map for future use
                setReceiptDetailsMap(prevMap => ({
                    ...prevMap,
                    [receiptId]: receiptDetails
                }));

                setSelectedReceipt(receiptDetails);

                // Get the file URL with token for protected files
                // console.log('Getting file URL with token for new receipt');
                const url = await fileManager.getFileUrlWithToken(
                    'receipts',
                    receiptRecord.id,
                    receiptRecord.file,
                    true // Use token for protected files
                );

                // Check if the URL is empty
                if (!url) {
                    // console.error('Failed to get file URL: Empty URL returned');
                    toast.error('Failed to load receipt: Could not generate file URL');
                    // Still show the preview modal but with empty URL to display the error message
                    setPreviewUrl('');
                    setPreviewFilename(receiptRecord.file || '');
                    setShowPreview(true);
                    return;
                }

                // console.log('Got URL:', url.substring(0, 50) + '...');

                // Set the preview URL and filename
                setPreviewUrl(url);
                setPreviewFilename(receiptRecord.file);

                // Show the preview modal
                setShowPreview(true);

                // Log the current state
                // console.log('Current state after setting:', {
                //     previewUrl: url,
                //     previewFilename: receiptRecord.file,
                //     showPreview: true
                // });
            } else {
                throw new Error('Receipt not found');
            }
        } catch (error) {
            // console.error('Error loading receipt:', error);
            toast.error('Failed to load receipt. Please try again.');
            // Show the preview modal with empty URL to display the error message
            setPreviewUrl('');
            setPreviewFilename('');
            setShowPreview(true);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        // console.log('Rendering loading state');
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center min-h-[400px] p-8"
            >
                <div className="loading loading-spinner loading-lg text-primary mb-4"></div>
                <p className="text-base-content/70 animate-pulse">Loading your reimbursements...</p>
            </motion.div>
        );
    }

    if (error) {
        // console.log('Rendering error state:', error);
        return (
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="alert alert-error shadow-lg max-w-2xl mx-auto"
            >
                <Icon icon="heroicons:exclamation-circle" className="h-5 w-5" />
                <span>{error}</span>
            </motion.div>
        );
    }

    // console.log('Rendering main component. Requests:', requests);
    // console.log('Requests length:', requests.length);

    return (
        <>
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-6"
            >
                {requests.length === 0 ? (
                    <motion.div
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                        className="text-center py-16 bg-base-200/50 backdrop-blur-sm rounded-2xl border-2 border-dashed border-base-300"
                    >
                        <Icon icon="heroicons:document" className="h-16 w-16 mx-auto text-base-content/30" />
                        <h3 className="mt-6 text-xl font-medium">No reimbursement requests</h3>
                        <p className="text-base-content/70 mt-2">Create a new request to get started</p>
                    </motion.div>
                ) : (
                    <motion.div
                        layout
                        initial="hidden"
                        animate="visible"
                        variants={containerVariants}
                        className="grid gap-4"
                    >
                        <AnimatePresence mode="popLayout">
                            {requests.map((request, index) => {
                                // console.log('Rendering request:', request);
                                return (
                                    <motion.div
                                        key={request.id}
                                        variants={itemVariants}
                                        initial="hidden"
                                        animate="visible"
                                        layout
                                        className="card bg-base-100 hover:bg-base-200 transition-all duration-300 border border-base-200 hover:border-primary shadow-sm hover:shadow-md"
                                    >
                                        <div className="card-body p-5">
                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="card-title text-lg font-bold truncate">{request.title}</h3>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        <div className="badge badge-outline badge-lg font-mono">
                                                            ${request.total_amount.toFixed(2)}
                                                        </div>
                                                        <div className="badge badge-ghost badge-lg gap-1">
                                                            <Icon icon="heroicons:calendar" className="h-4 w-4" />
                                                            {formatDate(request.date_of_purchase)}
                                                        </div>
                                                        {request.audit_notes && request.audit_notes.filter(note => !note.is_private).length > 0 && (
                                                            <div className="badge badge-ghost badge-lg gap-1">
                                                                <Icon icon="heroicons:chat-bubble-left-right" className="h-4 w-4" />
                                                                {request.audit_notes.filter(note => !note.is_private).length} Notes
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className="btn btn-primary btn-sm gap-2 shadow-sm hover:shadow-md transition-all duration-300"
                                                    onClick={() => setSelectedRequest(request)}
                                                >
                                                    <Icon icon="heroicons:eye" className="h-4 w-4" />
                                                    View Details
                                                </motion.button>
                                            </div>

                                            <div className="mt-4 card bg-base-200/50 backdrop-blur-sm p-4 shadow-sm">
                                                <div className="flex items-center justify-between w-full relative py-2">
                                                    <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-base-300 -translate-y-[1.0rem]" />
                                                    {STATUS_ORDER.map((status, index) => {
                                                        if (status === 'rejected' && request.status !== 'rejected') return null;
                                                        if (status === 'approved' && request.status === 'rejected') return null;

                                                        const isActive = STATUS_ORDER.indexOf(request.status) >= STATUS_ORDER.indexOf(status);
                                                        const isCurrent = request.status === status;

                                                        return (
                                                            <div key={status} className="relative flex flex-col items-center gap-2 z-10">
                                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isCurrent
                                                                    ? status === 'rejected'
                                                                        ? 'bg-error text-error-content ring-2 ring-error/20'
                                                                        : status === 'paid'
                                                                            ? 'bg-success text-success-content ring-2 ring-success/20'
                                                                            : status === 'in_progress'
                                                                                ? 'bg-warning text-warning-content ring-2 ring-warning/20'
                                                                                : 'bg-primary text-primary-content ring-2 ring-primary/20'
                                                                    : isActive
                                                                        ? status === 'rejected'
                                                                            ? 'bg-error/20 text-error'
                                                                            : status === 'paid'
                                                                                ? 'bg-success/20 text-success'
                                                                                : 'bg-primary/20 text-primary'
                                                                        : 'bg-base-300 text-base-content/40'
                                                                    }`}>
                                                                    <Icon icon={STATUS_ICONS[status]} className="h-3.5 w-3.5" />
                                                                </div>
                                                                <span className={`text-[10px] font-medium whitespace-nowrap mt-1 ${isCurrent
                                                                    ? status === 'rejected'
                                                                        ? 'text-error'
                                                                        : status === 'paid'
                                                                            ? 'text-success'
                                                                            : status === 'in_progress'
                                                                                ? 'text-warning'
                                                                                : 'text-primary'
                                                                    : isActive
                                                                        ? 'text-base-content'
                                                                        : 'text-base-content/40'
                                                                    }`}>
                                                                    {STATUS_LABELS[status]}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </motion.div>
                )}

                {/* Details Modal */}
                <AnimatePresence>
                    {selectedRequest && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="modal modal-open"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="modal-box max-w-3xl bg-base-100/95 backdrop-blur-md"
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                                        {selectedRequest.title}
                                    </h3>
                                    <motion.button
                                        whileHover={{ scale: 1.1, rotate: 90 }}
                                        whileTap={{ scale: 0.9 }}
                                        className="btn btn-ghost btn-sm btn-circle"
                                        onClick={() => setSelectedRequest(null)}
                                    >
                                        <Icon icon="heroicons:x-mark" className="h-5 w-5" />
                                    </motion.button>
                                </div>

                                <div className="grid gap-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="card bg-base-200/50 backdrop-blur-sm p-4 shadow-sm">
                                            <label className="text-sm font-medium text-base-content/70">Status</label>
                                            <div className={`badge ${STATUS_COLORS[selectedRequest.status]} badge-lg gap-1 mt-1`}>
                                                <Icon icon={STATUS_ICONS[selectedRequest.status]} className="h-4 w-4" />
                                                {STATUS_LABELS[selectedRequest.status]}
                                            </div>
                                        </div>
                                        <div className="card bg-base-200/50 backdrop-blur-sm p-4 shadow-sm">
                                            <label className="text-sm font-medium text-base-content/70">Department</label>
                                            <div className="badge badge-outline badge-lg mt-1">
                                                {DEPARTMENT_LABELS[selectedRequest.department]}
                                            </div>
                                        </div>
                                        <div className="card bg-base-200/50 backdrop-blur-sm p-4 shadow-sm">
                                            <label className="text-sm font-medium text-base-content/70">Total Amount</label>
                                            <p className="mt-1 text-xl font-mono font-bold text-primary">
                                                ${selectedRequest.total_amount.toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="card bg-base-200/50 backdrop-blur-sm p-4 shadow-sm">
                                            <label className="text-sm font-medium text-base-content/70">Date of Purchase</label>
                                            <p className="mt-1 font-medium">{formatDate(selectedRequest.date_of_purchase)}</p>
                                        </div>
                                        <div className="card bg-base-200/50 backdrop-blur-sm p-4 shadow-sm col-span-2">
                                            <label className="text-sm font-medium text-base-content/70">Payment Method</label>
                                            <p className="mt-1 font-medium">{selectedRequest.payment_method}</p>
                                        </div>
                                    </div>

                                    {selectedRequest.additional_info && (
                                        <div className="card bg-base-200/50 backdrop-blur-sm p-4 shadow-sm">
                                            <label className="text-sm font-medium text-base-content/70">Additional Information</label>
                                            <p className="mt-2 whitespace-pre-wrap">{selectedRequest.additional_info}</p>
                                        </div>
                                    )}

                                    {selectedRequest.audit_notes && selectedRequest.audit_notes.filter(note => !note.is_private).length > 0 && (
                                        <div className="card bg-base-200/50 backdrop-blur-sm p-4 shadow-sm border-l-4 border-primary">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Icon icon="heroicons:chat-bubble-left-right" className="h-5 w-5 text-primary" />
                                                <label className="text-base font-medium">Public Notes</label>
                                            </div>
                                            <div className="space-y-3">
                                                {selectedRequest.audit_notes
                                                    .filter(note => !note.is_private)
                                                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                                                    .map((note, index) => (
                                                        <div key={index} className="card bg-base-100 p-4 hover:bg-base-200 transition-colors duration-200">
                                                            <p className="whitespace-pre-wrap text-base">{note.note}</p>
                                                            <div className="flex justify-between items-center mt-3 text-sm text-base-content/70">
                                                                <span className="flex items-center gap-1">
                                                                    <Icon icon="heroicons:clock" className="h-4 w-4" />
                                                                    {formatDate(note.timestamp)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="card bg-base-200/50 backdrop-blur-sm p-4 shadow-sm">
                                        <label className="text-sm font-medium text-base-content/70 mb-2">Receipts</label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                            {(selectedRequest.receipts || []).map((receiptId, index) => (
                                                <motion.button
                                                    key={receiptId || index}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className="btn btn-outline btn-sm normal-case gap-2 hover:shadow-md transition-all duration-300"
                                                    onClick={() => handlePreviewFile(selectedRequest, receiptId)}
                                                >
                                                    <Icon icon="heroicons:document" className="h-4 w-4" />
                                                    Receipt #{index + 1}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="divider before:bg-base-300 after:bg-base-300"></div>

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="card bg-base-200/50 backdrop-blur-sm p-4 shadow-sm">
                                            <label className="text-sm font-medium text-base-content/70">Submitted At</label>
                                            <p className="mt-1">{formatDate(selectedRequest.created)}</p>
                                        </div>
                                        <div className="card bg-base-200/50 backdrop-blur-sm p-4 shadow-sm">
                                            <label className="text-sm font-medium text-base-content/70">Last Updated</label>
                                            <p className="mt-1">{formatDate(selectedRequest.updated)}</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* File Preview Modal */}
                <AnimatePresence>
                    {showPreview && selectedReceipt && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="modal modal-open"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="modal-box max-w-7xl bg-base-100/95 backdrop-blur-md"
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                                        Receipt Details
                                    </h3>
                                    <motion.button
                                        whileHover={{ scale: 1.1, rotate: 90 }}
                                        whileTap={{ scale: 0.9 }}
                                        className="btn btn-ghost btn-sm btn-circle"
                                        onClick={() => {
                                            setShowPreview(false);
                                            setSelectedReceipt(null);
                                        }}
                                    >
                                        <Icon icon="heroicons:x-mark" className="h-5 w-5" />
                                    </motion.button>
                                </div>

                                <div className="grid grid-cols-5 gap-6">
                                    {/* Receipt Details */}
                                    <div className="col-span-2 space-y-4">
                                        <div>
                                            <label className="text-sm font-medium">Location</label>
                                            <p className="mt-1">{selectedReceipt.location_name}</p>
                                            <p className="text-sm text-base-content/70">{selectedReceipt.location_address}</p>
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium">Date</label>
                                            <p className="mt-1">{formatDate(selectedReceipt.date)}</p>
                                        </div>

                                        {selectedReceipt.notes && (
                                            <div>
                                                <label className="text-sm font-medium">Notes</label>
                                                <p className="mt-1">{selectedReceipt.notes}</p>
                                            </div>
                                        )}

                                        <div>
                                            <label className="text-sm font-medium">Itemized Expenses</label>
                                            <div className="mt-2 space-y-2">
                                                {selectedReceipt.itemized_expenses.map((item, index) => (
                                                    <div key={index} className="card bg-base-200 p-3">
                                                        <div className="grid grid-cols-3 gap-4">
                                                            <div>
                                                                <label className="text-xs font-medium">Description</label>
                                                                <p>{item.description}</p>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-medium">Category</label>
                                                                <p>{item.category}</p>
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-medium">Amount</label>
                                                                <p>${item.amount.toFixed(2)}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm font-medium">Tax</label>
                                                <p className="mt-1">${selectedReceipt.tax.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium">Total</label>
                                                <p className="mt-1">${(selectedReceipt.itemized_expenses.reduce((sum, item) => sum + item.amount, 0) + selectedReceipt.tax).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* File Preview */}
                                    <div className="col-span-3 border-l border-base-300 pl-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-lg font-medium">Receipt Image</h3>
                                            <motion.a
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                                href={previewUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-sm btn-outline gap-2 hover:shadow-md transition-all duration-300"
                                            >
                                                <Icon icon="heroicons:arrow-top-right-on-square" className="h-4 w-4" />
                                                View Full Size
                                            </motion.a>
                                        </div>
                                        <div className="bg-base-200/50 backdrop-blur-sm rounded-lg p-4 shadow-sm">
                                            {previewUrl ? (
                                                <FilePreview
                                                    url={previewUrl}
                                                    filename={previewFilename}
                                                    isModal={false}
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                                                    <div className="bg-warning/20 p-4 rounded-full">
                                                        <Icon icon="heroicons:exclamation-triangle" className="h-12 w-12 text-warning" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <h3 className="text-lg font-semibold">Receipt Image Not Available</h3>
                                                        <p className="text-base-content/70 max-w-md">
                                                            The receipt image could not be loaded. This might be due to permission issues or the file may not exist.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </>
    );
} 