import React, { useState, useEffect } from 'react';
import { X, Check, XCircle, CreditCard, MessageCircle, Upload, Calendar, Building, UserCheck } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';

interface ReimbursementAuditModalProps {
    reimbursement: any;
    onClose: () => void;
    onUpdate: (id: string, status: string, auditNote?: string, paymentInfo?: any) => void;
}

export default function ReimbursementAuditModal({ reimbursement, onClose, onUpdate }: ReimbursementAuditModalProps) {
    const [user] = useAuthState(auth);
    const [action, setAction] = useState<'review' | 'approve' | 'approve_paid' | 'decline' | 'request_audit'>('review');
    const [auditNote, setAuditNote] = useState('');
    const [paymentInfo, setPaymentInfo] = useState({
        confirmationNumber: '',
        photoAttachment: null as File | null
    });
    const [executives, setExecutives] = useState<any[]>([]);
    const [selectedAuditor, setSelectedAuditor] = useState('');
    const [currentUserName, setCurrentUserName] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch current user's name
                if (user?.uid) {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setCurrentUserName(userData.name || userData.email || 'Unknown User');
                    }
                }

                // Fetch executives for audit requests
                if (action === 'request_audit') {
                    const q = query(collection(db, 'users'), where('role', '==', 'Executive Officer'));
                    const querySnapshot = await getDocs(q);
                    const executivesList = querySnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setExecutives(executivesList);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };

        fetchData();
    }, [action, user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        let newStatus = reimbursement.status;
        let note = auditNote.trim();
        let payment = undefined;

        switch (action) {
            case 'approve':
                newStatus = 'approved';
                if (!note) note = 'Request approved for payment';
                break;
            case 'approve_paid':
                newStatus = 'paid';
                if (!note) note = 'Request approved and marked as paid';
                payment = {
                    confirmationNumber: paymentInfo.confirmationNumber,
                    photoAttachment: paymentInfo.photoAttachment ? paymentInfo.photoAttachment.name : null
                };
                break;
            case 'decline':
                newStatus = 'declined';
                if (!note) note = 'Request declined';
                break;
            case 'request_audit':
                if (selectedAuditor) {
                    // Send audit request email
                    try {
                        console.log('Sending audit request email with data:', {
                            type: 'audit_request',
                            reimbursementId: reimbursement.id,
                            auditorId: selectedAuditor,
                            requestNote: note
                        });

                        const response = await fetch('/api/email/send-reimbursement-notification', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                type: 'audit_request',
                                reimbursementId: reimbursement.id,
                                auditorId: selectedAuditor,
                                requestNote: note
                            }),
                        });

                        const result = await response.json();
                        console.log('Email API response:', result);

                        if (!response.ok || !result.success) {
                            throw new Error(result.error || 'Failed to send audit request email');
                        }

                        // Update reimbursement with audit request
                        newStatus = 'under_review';
                        if (!note) note = 'Audit requested from another executive';
                    } catch (error) {
                        console.error('Failed to send audit request email:', error);
                        alert(`Failed to send audit request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
                        return;
                    }
                }
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
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
                                    onClick={() => setAction('request_audit')}
                                    className={`p-3 border-2 rounded-lg text-center transition-colors ${action === 'request_audit'
                                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <UserCheck className="w-5 h-5 mx-auto mb-1" />
                                    <span className="text-sm font-medium">Request Audit</span>
                                </button>
                            )}

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
                                    <span className="text-sm font-medium">Approve (Not Paid)</span>
                                </button>
                            )}

                            {(reimbursement.status === 'submitted' || reimbursement.status === 'under_review' || reimbursement.status === 'approved') && (
                                <button
                                    type="button"
                                    onClick={() => setAction('approve_paid')}
                                    className={`p-3 border-2 rounded-lg text-center transition-colors ${action === 'approve_paid'
                                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <CreditCard className="w-5 h-5 mx-auto mb-1" />
                                    <span className="text-sm font-medium">Approve & Pay</span>
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
                        </div>
                    </div>

                    {/* Executive Selection for Audit Request */}
                    {action === 'request_audit' && (
                        <div>
                            <Label className="text-sm font-medium text-gray-700">
                                Select Executive for Audit *
                            </Label>
                            <Select value={selectedAuditor} onValueChange={setSelectedAuditor}>
                                <SelectTrigger className="w-full mt-1">
                                    <SelectValue placeholder="Choose an executive officer to audit this request" />
                                </SelectTrigger>
                                <SelectContent>
                                    {executives.map((exec) => (
                                        <SelectItem key={exec.id} value={exec.id}>
                                            {exec.name || exec.email} - {exec.position || 'Executive Officer'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {action === 'request_audit' && !selectedAuditor && (
                                <p className="mt-1 text-sm text-red-600">Please select an executive to audit this request</p>
                            )}
                        </div>
                    )}

                    {/* Audit Note */}
                    <div>
                        <Label htmlFor="auditNote" className="text-sm font-medium text-gray-700">
                            {action === 'decline' ? 'Reason for Decline *' :
                                action === 'approve' ? 'Approval Notes' :
                                    action === 'request_audit' ? 'Request Message' :
                                        'Audit Notes'}
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
                                        : action === 'request_audit'
                                            ? 'Optional message to include with the audit request...'
                                            : 'Add any notes about this reimbursement...'
                            }
                            rows={4}
                            className={action === 'decline' && !auditNote.trim() ? 'border-red-500' : ''}
                        />
                        {action === 'decline' && !auditNote.trim() && (
                            <p className="mt-1 text-sm text-red-600">Please provide a reason for declining</p>
                        )}
                    </div>

                    {/* Payment Information (only for 'approve_paid' action) */}
                    {action === 'approve_paid' && (
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
                            disabled={(action === 'decline' && !auditNote.trim()) || (action === 'request_audit' && !selectedAuditor)}
                            className={
                                action === 'approve'
                                    ? 'bg-green-600 hover:bg-green-700'
                                    : action === 'decline'
                                        ? 'bg-red-600 hover:bg-red-700'
                                        : action === 'approve_paid'
                                            ? 'bg-emerald-600 hover:bg-emerald-700'
                                            : action === 'request_audit'
                                                ? 'bg-purple-600 hover:bg-purple-700'
                                                : 'bg-blue-600 hover:bg-blue-700'
                            }
                        >
                            {action === 'review' && 'Add Note'}
                            {action === 'approve' && 'Approve (Not Paid)'}
                            {action === 'decline' && 'Decline Request'}
                            {action === 'approve_paid' && 'Approve & Mark Paid'}
                            {action === 'request_audit' && 'Send Audit Request'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
} 