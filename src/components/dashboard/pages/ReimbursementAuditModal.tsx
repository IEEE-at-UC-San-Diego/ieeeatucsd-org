import React, { useState } from 'react';
import { X, Check, XCircle, CreditCard, MessageCircle, Upload, Calendar, Building } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';

interface ReimbursementAuditModalProps {
    reimbursement: any;
    onClose: () => void;
    onUpdate: (id: string, status: string, auditNote?: string, paymentInfo?: any) => void;
}

export default function ReimbursementAuditModal({ reimbursement, onClose, onUpdate }: ReimbursementAuditModalProps) {
    const [action, setAction] = useState<'review' | 'approve' | 'decline' | 'paid'>('review');
    const [auditNote, setAuditNote] = useState('');
    const [paymentInfo, setPaymentInfo] = useState({
        confirmationNumber: '',
        photoAttachment: null as File | null
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        let newStatus = reimbursement.status;
        let note = auditNote.trim();
        let payment = undefined;

        switch (action) {
            case 'approve':
                newStatus = 'approved';
                if (!note) note = 'Request approved for payment';
                break;
            case 'decline':
                newStatus = 'declined';
                if (!note) note = 'Request declined';
                break;
            case 'paid':
                newStatus = 'paid';
                if (!note) note = 'Payment processed';
                payment = {
                    confirmationNumber: paymentInfo.confirmationNumber,
                    photoAttachment: paymentInfo.photoAttachment ? paymentInfo.photoAttachment.name : null
                };
                break;
            case 'review':
                if (note) {
                    // Just adding a note without changing status
                }
                break;
        }

        onUpdate(reimbursement.id, newStatus, note || undefined, payment);
        onClose();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'submitted':
                return 'bg-yellow-100 text-yellow-800';
            case 'under_review':
                return 'bg-blue-100 text-blue-800';
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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Review Reimbursement</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Reimbursement Summary */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-medium text-gray-900">{reimbursement.title}</h3>
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(reimbursement.status)}`}>
                                {reimbursement.status === 'submitted' && 'Submitted'}
                                {reimbursement.status === 'under_review' && 'Under Review'}
                                {reimbursement.status === 'approved' && 'Approved (Not Paid)'}
                                {reimbursement.status === 'paid' && 'Approved (Paid)'}
                                {reimbursement.status === 'declined' && 'Declined'}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center space-x-2">
                                <Building className="w-4 h-4 text-gray-400" />
                                <span>Department: <span className="font-medium capitalize">{reimbursement.department}</span></span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span>Amount: <span className="font-bold text-green-600">${reimbursement.totalAmount?.toFixed(2)}</span></span>
                            </div>
                        </div>
                        <div className="mt-3">
                            <p className="text-sm text-gray-600"><span className="font-medium">Organization Purpose:</span> {reimbursement.businessPurpose}</p>
                        </div>
                    </div>

                    {/* Action Selection */}
                    <div>
                        <Label className="text-sm font-medium text-gray-700 mb-3 block">Choose Action</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <button
                                type="button"
                                onClick={() => setAction('review')}
                                className={`p-3 border-2 rounded-lg text-center transition-colors ${action === 'review'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <MessageCircle className="w-5 h-5 mx-auto mb-1" />
                                <span className="text-sm font-medium">Add Note</span>
                            </button>

                            {(reimbursement.status === 'submitted' || reimbursement.status === 'under_review') && (
                                <button
                                    type="button"
                                    onClick={() => setAction('approve')}
                                    className={`p-3 border-2 rounded-lg text-center transition-colors ${action === 'approve'
                                        ? 'border-green-500 bg-green-50 text-green-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <Check className="w-5 h-5 mx-auto mb-1" />
                                    <span className="text-sm font-medium">Approve</span>
                                </button>
                            )}

                            {(reimbursement.status === 'submitted' || reimbursement.status === 'under_review') && (
                                <button
                                    type="button"
                                    onClick={() => setAction('decline')}
                                    className={`p-3 border-2 rounded-lg text-center transition-colors ${action === 'decline'
                                        ? 'border-red-500 bg-red-50 text-red-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <XCircle className="w-5 h-5 mx-auto mb-1" />
                                    <span className="text-sm font-medium">Decline</span>
                                </button>
                            )}

                            {reimbursement.status === 'approved' && (
                                <button
                                    type="button"
                                    onClick={() => setAction('paid')}
                                    className={`p-3 border-2 rounded-lg text-center transition-colors ${action === 'paid'
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <CreditCard className="w-5 h-5 mx-auto mb-1" />
                                    <span className="text-sm font-medium">Mark Paid</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Audit Note */}
                    <div>
                        <Label htmlFor="auditNote" className="text-sm font-medium text-gray-700">
                            {action === 'decline' ? 'Reason for Decline *' : action === 'approve' ? 'Approval Notes' : 'Audit Notes'}
                        </Label>
                        <Textarea
                            id="auditNote"
                            value={auditNote}
                            onChange={(e) => setAuditNote(e.target.value)}
                            placeholder={
                                action === 'decline'
                                    ? 'Please provide a reason for declining this request...'
                                    : action === 'approve'
                                        ? 'Optional notes about the approval...'
                                        : 'Add any notes about this reimbursement...'
                            }
                            rows={4}
                            className={action === 'decline' && !auditNote.trim() ? 'border-red-500' : ''}
                        />
                        {action === 'decline' && !auditNote.trim() && (
                            <p className="mt-1 text-sm text-red-600">Please provide a reason for declining</p>
                        )}
                    </div>

                    {/* Payment Information (only for 'paid' action) */}
                    {action === 'paid' && (
                        <div className="space-y-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                            <h4 className="font-medium text-emerald-900">Payment Confirmation</h4>

                            <div>
                                <Label htmlFor="confirmationNumber" className="text-sm font-medium text-gray-700">
                                    Confirmation Number *
                                </Label>
                                <Input
                                    id="confirmationNumber"
                                    value={paymentInfo.confirmationNumber}
                                    onChange={(e) => setPaymentInfo({ ...paymentInfo, confirmationNumber: e.target.value })}
                                    placeholder="e.g., TXN123456789"
                                    required
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-medium text-gray-700">
                                    Payment Confirmation Photo
                                </Label>
                                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-emerald-300 border-dashed rounded-md">
                                    <div className="space-y-1 text-center">
                                        <Upload className="mx-auto h-12 w-12 text-emerald-400" />
                                        <div className="flex text-sm text-emerald-600">
                                            <label
                                                htmlFor="paymentPhoto"
                                                className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-emerald-500"
                                            >
                                                <span>Upload a file</span>
                                                <input
                                                    id="paymentPhoto"
                                                    type="file"
                                                    className="sr-only"
                                                    accept="image/*,.pdf"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) setPaymentInfo({ ...paymentInfo, photoAttachment: file });
                                                    }}
                                                />
                                            </label>
                                            <p className="pl-1">or drag and drop</p>
                                        </div>
                                        <p className="text-xs text-emerald-500">PNG, JPG, PDF up to 10MB</p>
                                        {paymentInfo.photoAttachment && (
                                            <p className="text-sm text-emerald-600 mt-2">
                                                ✓ {paymentInfo.photoAttachment.name}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Existing Audit Notes */}
                    {reimbursement.auditNotes && reimbursement.auditNotes.length > 0 && (
                        <div>
                            <h4 className="text-md font-medium text-gray-900 mb-3">Previous Audit Notes</h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {reimbursement.auditNotes.map((note: any, index: number) => (
                                    <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                                        <p className="text-sm text-gray-700">{note.note}</p>
                                        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                                            <span>By: {note.createdBy}</span>
                                            <span>{new Date(note.timestamp?.toDate()).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Form Actions */}
                    <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={action === 'decline' && !auditNote.trim()}
                            className={
                                action === 'approve'
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : action === 'decline'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : action === 'paid'
                                            ? 'bg-emerald-600 hover:bg-emerald-700'
                                            : 'bg-blue-600 hover:bg-blue-700'
                            }
                        >
                            {action === 'review' && 'Add Note'}
                            {action === 'approve' && 'Approve Request'}
                            {action === 'decline' && 'Decline Request'}
                            {action === 'paid' && 'Mark as Paid'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
} 