import React from 'react';
import { X, Calendar, Building, CreditCard, FileText, MapPin, User } from 'lucide-react';

interface ReimbursementDetailModalProps {
    reimbursement: any;
    onClose: () => void;
}

export default function ReimbursementDetailModal({ reimbursement, onClose }: ReimbursementDetailModalProps) {
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

    const getStatusDisplayName = (status: string) => {
        switch (status) {
            case 'submitted':
                return 'Submitted';
            case 'under_review':
                return 'Under Review';
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

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Reimbursement Details</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Header Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-4">{reimbursement.title}</h3>
                            <div className="space-y-3">
                                <div className="flex items-center space-x-3">
                                    <Building className="w-5 h-5 text-gray-400" />
                                    <span className="text-sm text-gray-600">Department: <span className="font-medium capitalize">{reimbursement.department}</span></span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <Calendar className="w-5 h-5 text-gray-400" />
                                    <span className="text-sm text-gray-600">Date of Purchase: <span className="font-medium">{reimbursement.dateOfPurchase}</span></span>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <CreditCard className="w-5 h-5 text-gray-400" />
                                    <span className="text-sm text-gray-600">Payment Method: <span className="font-medium">{reimbursement.paymentMethod}</span></span>
                                </div>
                                {reimbursement.location && (
                                    <div className="flex items-center space-x-3">
                                        <MapPin className="w-5 h-5 text-gray-400" />
                                        <span className="text-sm text-gray-600">Location: <span className="font-medium">{reimbursement.location}</span></span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="text-right mb-4">
                                <p className="text-3xl font-bold text-gray-900">${reimbursement.totalAmount?.toFixed(2)}</p>
                                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(reimbursement.status)}`}>
                                    {getStatusDisplayName(reimbursement.status)}
                                </div>
                            </div>
                            <div className="text-sm text-gray-600">
                                <p>Submitted: {new Date(reimbursement.submittedAt).toLocaleDateString()}</p>
                                {reimbursement.vendor && <p>Vendor: {reimbursement.vendor}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Organization Purpose */}
                    <div>
                        <h4 className="text-md font-medium text-gray-900 mb-2">Organization Purpose</h4>
                        <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{reimbursement.businessPurpose}</p>
                    </div>

                    {/* Expenses */}
                    <div>
                        <h4 className="text-md font-medium text-gray-900 mb-4">Itemized Expenses</h4>
                        <div className="space-y-3">
                            {reimbursement.expenses?.map((expense: any, index: number) => (
                                <div key={expense.id || index} className="border border-gray-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h5 className="font-medium text-gray-900">{expense.description}</h5>
                                        <span className="text-lg font-bold text-gray-900">${expense.amount?.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm text-gray-600">
                                        <span>Category: {expense.category}</span>
                                        {expense.receipt && (
                                            <span className="text-green-600">✓ Receipt attached</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Additional Information */}
                    {reimbursement.additionalInfo && (
                        <div>
                            <h4 className="text-md font-medium text-gray-900 mb-2">Additional Information</h4>
                            <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{reimbursement.additionalInfo}</p>
                        </div>
                    )}

                    {/* Audit Notes */}
                    {reimbursement.auditNotes && reimbursement.auditNotes.length > 0 && (
                        <div>
                            <h4 className="text-md font-medium text-gray-900 mb-4">Audit Notes</h4>
                            <div className="space-y-3">
                                {reimbursement.auditNotes.map((note: any, index: number) => (
                                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                                        <p className="text-gray-700">{note.note}</p>
                                        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                                            <span>By: {note.createdBy}</span>
                                            <span>{new Date(note.timestamp?.toDate()).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 