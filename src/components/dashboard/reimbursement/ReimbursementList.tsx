import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { Get } from '../../../scripts/pocketbase/Get';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { FileManager } from '../../../scripts/pocketbase/FileManager';
import FilePreview from '../universal/FilePreview';

interface ExpenseItem {
    description: string;
    amount: number;
    category: string;
}

interface ReimbursementRequest {
    id: string;
    title: string;
    total_amount: number;
    date_of_purchase: string;
    business_purpose: string;
    payment_method: string;
    status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid';
    expense_items: ExpenseItem[];
    receipts: string[];
    submitted_by: string;
    submitted_at: string;
    last_updated: string;
}

const STATUS_COLORS = {
    draft: 'badge-ghost',
    submitted: 'badge-primary',
    under_review: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-error',
    paid: 'badge-success'
};

const STATUS_LABELS = {
    draft: 'Draft',
    submitted: 'Submitted',
    under_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
    paid: 'Paid'
};

export default function ReimbursementList() {
    const [requests, setRequests] = useState<ReimbursementRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [selectedRequest, setSelectedRequest] = useState<ReimbursementRequest | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewFilename, setPreviewFilename] = useState('');

    const get = Get.getInstance();
    const auth = Authentication.getInstance();
    const fileManager = FileManager.getInstance();

    useEffect(() => {
        fetchReimbursements();
    }, []);

    const fetchReimbursements = async () => {
        try {
            setLoading(true);
            const pb = auth.getPocketBase();
            const userId = pb.authStore.model?.id;

            if (!userId) {
                throw new Error('User not authenticated');
            }

            const records = await pb.collection('reimbursement').getList(1, 50, {
                filter: `submitted_by = "${userId}"`,
                sort: '-created',
                expand: 'submitted_by'
            });

            // Convert PocketBase records to ReimbursementRequest type
            const reimbursements = records.items.map(record => ({
                id: record.id,
                title: record.title,
                total_amount: record.total_amount,
                date_of_purchase: record.date_of_purchase,
                business_purpose: record.business_purpose || '', // Add fallback since it might not exist in schema
                payment_method: record.payment_method,
                status: record.status,
                expense_items: typeof record.expense_items === 'string' ? JSON.parse(record.expense_items) : record.expense_items,
                receipts: record.receipts || [],
                submitted_by: record.submitted_by,
                submitted_at: record.created, // Use created field for submitted_at
                last_updated: record.updated // Use updated field for last_updated
            })) as ReimbursementRequest[];

            setRequests(reimbursements);
        } catch (error) {
            console.error('Error fetching reimbursements:', error);
            setError('Failed to load reimbursement requests');
        } finally {
            setLoading(false);
        }
    };

    const handlePreviewFile = (request: ReimbursementRequest, filename: string) => {
        const url = fileManager.getFileUrl('reimbursement', request.id, filename);
        setPreviewUrl(url);
        setPreviewFilename(filename);
        setShowPreview(true);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8">
                <div className="loading loading-spinner loading-lg text-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="alert alert-error">
                <Icon icon="heroicons:exclamation-circle" className="h-5 w-5" />
                <span>{error}</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {requests.length === 0 ? (
                <div className="text-center py-8">
                    <Icon icon="heroicons:document" className="h-12 w-12 mx-auto text-base-content/50" />
                    <h3 className="mt-4 text-lg font-medium">No reimbursement requests</h3>
                    <p className="text-base-content/70">Create a new request to get started</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {requests.map((request) => (
                        <div
                            key={request.id}
                            className="card bg-base-100 shadow-xl border border-base-200 hover:border-primary transition-all duration-300"
                        >
                            <div className="card-body">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <h3 className="card-title">{request.title}</h3>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <div className={`badge ${STATUS_COLORS[request.status]}`}>
                                                {STATUS_LABELS[request.status]}
                                            </div>
                                            <div className="badge badge-outline">
                                                ${request.total_amount.toFixed(2)}
                                            </div>
                                            <div className="badge badge-outline">
                                                {formatDate(request.date_of_purchase)}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn-sm btn-primary"
                                        onClick={() => setSelectedRequest(request)}
                                    >
                                        View Details
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Details Modal */}
            {selectedRequest && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-3xl">
                        <h3 className="font-bold text-lg mb-4">{selectedRequest.title}</h3>

                        <div className="grid gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">Status</label>
                                    <div className={`badge ${STATUS_COLORS[selectedRequest.status]} mt-1`}>
                                        {STATUS_LABELS[selectedRequest.status]}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Total Amount</label>
                                    <p className="mt-1">${selectedRequest.total_amount.toFixed(2)}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Date of Purchase</label>
                                    <p className="mt-1">{formatDate(selectedRequest.date_of_purchase)}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Payment Method</label>
                                    <p className="mt-1">{selectedRequest.payment_method}</p>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium">Business Purpose</label>
                                <p className="mt-1">{selectedRequest.business_purpose}</p>
                            </div>

                            <div>
                                <label className="text-sm font-medium">Expense Items</label>
                                <div className="mt-2 space-y-2">
                                    {selectedRequest.expense_items.map((item, index) => (
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

                            <div>
                                <label className="text-sm font-medium">Receipts</label>
                                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {selectedRequest.receipts.map((filename) => (
                                        <button
                                            key={filename}
                                            className="btn btn-outline btn-sm normal-case"
                                            onClick={() => handlePreviewFile(selectedRequest, filename)}
                                        >
                                            <Icon icon="heroicons:document" className="h-4 w-4 mr-2" />
                                            {filename}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="divider"></div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <label className="font-medium">Submitted At</label>
                                    <p className="mt-1">{formatDate(selectedRequest.submitted_at)}</p>
                                </div>
                                <div>
                                    <label className="font-medium">Last Updated</label>
                                    <p className="mt-1">{formatDate(selectedRequest.last_updated)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="modal-action">
                            <button
                                className="btn"
                                onClick={() => setSelectedRequest(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* File Preview Modal */}
            {showPreview && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-4xl">
                        <FilePreview
                            url={previewUrl}
                            filename={previewFilename}
                            isModal={true}
                        />
                        <div className="modal-action">
                            <button
                                className="btn"
                                onClick={() => setShowPreview(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
} 