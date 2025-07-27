import React from 'react';
import { X, Calendar, Building, CreditCard, FileText, MapPin, User, Download, Eye, File, Image } from 'lucide-react';

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
                                <p>Submitted: {reimbursement.submittedAt?.toDate ? reimbursement.submittedAt.toDate().toLocaleDateString() : new Date(reimbursement.submittedAt).toLocaleDateString()}</p>
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
                                    <div className="flex items-start justify-between mb-2 gap-4">
                                        <h5 className="font-medium text-gray-900 break-words flex-1 min-w-0">{expense.description}</h5>
                                        <span className="text-lg font-bold text-gray-900 flex-shrink-0">${expense.amount?.toFixed(2)}</span>
                                    </div>
                                    <div className="text-sm text-gray-600 mb-3">
                                        <span>Category: {expense.category}</span>
                                    </div>
                                    {expense.receipt && (
                                        // Support multiple receipt data formats
                                        expense.receipt.url ||
                                        expense.receipt.downloadURL ||
                                        (typeof expense.receipt === 'string' && expense.receipt.startsWith('http')) ||
                                        expense.receipt
                                    ) && (
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-2">
                                                        <File className="w-4 h-4 text-blue-600" />
                                                        <span className="text-sm font-medium text-blue-900">Receipt Available</span>
                                                        {expense.receipt.name && (
                                                            <span className="text-xs text-blue-600">({expense.receipt.name})</span>
                                                        )}
                                                    </div>
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    // Support multiple receipt data formats
                                                                    let url = expense.receipt.url ||
                                                                        expense.receipt.downloadURL ||
                                                                        (typeof expense.receipt === 'string' && expense.receipt.startsWith('http') ? expense.receipt : null);

                                                                    console.log('Receipt data:', expense.receipt);
                                                                    console.log('Initial URL:', url);

                                                                    // If we don't have a URL but have a filename, try to construct Firebase URL
                                                                    if (!url && expense.receipt) {
                                                                        const filename = expense.receipt.name || expense.receipt;
                                                                        if (filename && typeof filename === 'string' && !filename.startsWith('http')) {
                                                                            console.log('Attempting to construct Firebase URL from filename:', filename);

                                                                            // Try to construct Firebase Storage URL
                                                                            // This requires getting a new download URL from Firebase
                                                                            try {
                                                                                const { ref, getDownloadURL } = await import('firebase/storage');
                                                                                const { storage } = await import('../../../firebase/client');

                                                                                // Try different possible paths where the file might be stored
                                                                                const possiblePaths = [
                                                                                    `reimbursements/${reimbursement.submittedBy}/${filename}`,
                                                                                    `reimbursements/${reimbursement.submittedBy}/${Date.now()}_${filename}`,
                                                                                    filename
                                                                                ];

                                                                                for (const path of possiblePaths) {
                                                                                    try {
                                                                                        const storageRef = ref(storage, path);
                                                                                        url = await getDownloadURL(storageRef);
                                                                                        console.log('Successfully constructed URL:', url);
                                                                                        break;
                                                                                    } catch (e) {
                                                                                        console.log(`Failed to get URL for path: ${path}`);
                                                                                    }
                                                                                }
                                                                            } catch (storageError) {
                                                                                console.error('Error constructing Firebase URL:', storageError);
                                                                            }
                                                                        }
                                                                    }

                                                                    if (url && typeof url === 'string' && url.startsWith('http')) {
                                                                        window.open(url, '_blank');
                                                                    } else {
                                                                        console.error('Unable to resolve receipt URL');
                                                                        alert(`Unable to open receipt. The receipt may have been uploaded with an older system or there may be an issue with the file storage. Receipt data: ${JSON.stringify(expense.receipt)}`);
                                                                    }
                                                                } catch (error) {
                                                                    console.error('Error opening receipt:', error);
                                                                    alert('An error occurred while trying to open the receipt. Please try again.');
                                                                }
                                                            }}
                                                            className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                                                            title="View receipt"
                                                        >
                                                            <Eye className="w-3 h-3" />
                                                            <span>View</span>
                                                        </button>
                                                        <a
                                                            href={expense.receipt.url ||
                                                                expense.receipt.downloadURL ||
                                                                (typeof expense.receipt === 'string' && expense.receipt.startsWith('http') ? expense.receipt : null) ||
                                                                expense.receipt}
                                                            download={expense.receipt.name || 'receipt'}
                                                            className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                                                            title="Download receipt"
                                                        >
                                                            <Download className="w-3 h-3" />
                                                            <span>Download</span>
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    {(!expense.receipt || (
                                        !expense.receipt.url &&
                                        !expense.receipt.downloadURL &&
                                        !(typeof expense.receipt === 'string' && expense.receipt.startsWith('http')) &&
                                        !expense.receipt
                                    )) && (
                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                                <div className="flex items-center space-x-2">
                                                    <FileText className="w-4 h-4 text-gray-400" />
                                                    <span className="text-sm text-gray-500">No receipt attached</span>
                                                </div>
                                            </div>
                                        )}
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
                                            <span>By: {note.createdByName || note.createdBy}</span>
                                            <span>{new Date(note.timestamp?.toDate ? note.timestamp.toDate() : note.timestamp).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Audit Logs */}
                    {reimbursement.auditLogs && reimbursement.auditLogs.length > 0 && (
                        <div>
                            <h4 className="text-md font-medium text-gray-900 mb-4">Activity Log</h4>
                            <div className="space-y-2">
                                {reimbursement.auditLogs.map((log: any, index: number) => (
                                    <div key={index} className="border-l-4 border-blue-200 bg-blue-50 p-3 rounded">
                                        <p className="text-sm text-blue-800">{log.action}</p>
                                        <div className="flex items-center justify-between mt-1 text-xs text-blue-600">
                                            <span>By: {log.createdByName || log.createdBy}</span>
                                            <span>{new Date(log.timestamp?.toDate ? log.timestamp.toDate() : log.timestamp).toLocaleDateString()}</span>
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