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
    payment_method: string;
    status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'paid' | 'in_progress';
    submitted_by: string;
    additional_info: string;
    reciepts: string[];
    department: 'internal' | 'external' | 'projects' | 'events' | 'other';
    created: string;
    updated: string;
}

interface ReceiptDetails {
    id: string;
    field: string;
    created_by: string;
    itemized_expenses: ExpenseItem[];
    tax: number;
    date: string;
    location_name: string;
    location_address: string;
    notes: string;
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

export default function ReimbursementList() {
    const [requests, setRequests] = useState<ReimbursementRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [selectedRequest, setSelectedRequest] = useState<ReimbursementRequest | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [previewFilename, setPreviewFilename] = useState('');
    const [selectedReceipt, setSelectedReceipt] = useState<ReceiptDetails | null>(null);

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
                payment_method: record.payment_method,
                status: record.status,
                submitted_by: record.submitted_by,
                additional_info: record.additional_info || '',
                reciepts: record.reciepts || [],
                department: record.department,
                created: record.created,
                updated: record.updated
            })) as ReimbursementRequest[];

            setRequests(reimbursements);
        } catch (error) {
            console.error('Error fetching reimbursements:', error);
            setError('Failed to load reimbursement requests');
        } finally {
            setLoading(false);
        }
    };

    const handlePreviewFile = async (request: ReimbursementRequest, receiptId: string) => {
        try {
            const pb = auth.getPocketBase();

            // Get the receipt record using its ID
            const receiptRecord = await pb.collection('reciepts').getOne(receiptId, {
                $autoCancel: false
            });

            if (receiptRecord) {
                // Parse the itemized expenses if it's a string
                const itemizedExpenses = typeof receiptRecord.itemized_expenses === 'string'
                    ? JSON.parse(receiptRecord.itemized_expenses)
                    : receiptRecord.itemized_expenses;

                setSelectedReceipt({
                    id: receiptRecord.id,
                    field: receiptRecord.field,
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
                });

                // Get the file URL using the PocketBase URL and collection info
                const url = `${pb.baseUrl}/api/files/reciepts/${receiptRecord.id}/${receiptRecord.field}`;
                setPreviewUrl(url);
                setPreviewFilename(receiptRecord.field);
                setShowPreview(true);
            } else {
                throw new Error('Receipt not found');
            }
        } catch (error) {
            console.error('Error loading receipt:', error);
            alert('Failed to load receipt. Please try again.');
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
                                    <div className={`badge ${STATUS_COLORS[selectedRequest.status]} mt-1 block`}>
                                        {STATUS_LABELS[selectedRequest.status]}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Department</label>
                                    <div className="badge badge-outline mt-1 block">
                                        {DEPARTMENT_LABELS[selectedRequest.department]}
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

                            {selectedRequest.additional_info && (
                                <div>
                                    <label className="text-sm font-medium">Additional Information</label>
                                    <p className="mt-1">{selectedRequest.additional_info}</p>
                                </div>
                            )}

                            <div>
                                <label className="text-sm font-medium">Receipts</label>
                                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {(selectedRequest.reciepts || []).map((receiptId, index) => (
                                        <button
                                            key={receiptId || index}
                                            className="btn btn-outline btn-sm normal-case"
                                            onClick={() => handlePreviewFile(selectedRequest, receiptId)}
                                        >
                                            <Icon icon="heroicons:document" className="h-4 w-4 mr-2" />
                                            Receipt #{index + 1}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="divider"></div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <label className="font-medium">Submitted At</label>
                                    <p className="mt-1">{formatDate(selectedRequest.created)}</p>
                                </div>
                                <div>
                                    <label className="font-medium">Last Updated</label>
                                    <p className="mt-1">{formatDate(selectedRequest.updated)}</p>
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
            {showPreview && selectedReceipt && (
                <div className="modal modal-open">
                    <div className="modal-box max-w-7xl">
                        <div className="grid grid-cols-5 gap-6">
                            {/* Receipt Details */}
                            <div className="col-span-2 space-y-4">
                                <h3 className="font-bold text-lg">Receipt Details</h3>

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
                                    <h3 className="font-bold text-lg">Receipt Image</h3>
                                    <a
                                        href={previewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-sm btn-outline gap-2"
                                    >
                                        <Icon icon="heroicons:arrow-top-right-on-square" className="h-4 w-4" />
                                        View Full Size
                                    </a>
                                </div>
                                <div className="bg-base-200 rounded-lg p-4">
                                    <FilePreview
                                        url={previewUrl}
                                        filename={previewFilename}
                                        isModal={false}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="modal-action">
                            <button
                                className="btn"
                                onClick={() => {
                                    setShowPreview(false);
                                    setSelectedReceipt(null);
                                }}
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