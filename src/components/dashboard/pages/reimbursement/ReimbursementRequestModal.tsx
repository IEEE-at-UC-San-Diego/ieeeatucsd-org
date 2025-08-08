import React, { useState, useRef } from 'react';
import { X, Upload, Trash2, Plus, DollarSign, Calendar, MapPin, FileText, Building, CreditCard, CheckCircle } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../../../../firebase/client';

interface Expense {
    id: string;
    description: string;
    category: string;
    amount: number;
    receipt?: { url: string; name: string; size: number; type: string };
}

interface ReimbursementRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
}

const DEPARTMENTS = [
    { value: 'general', label: 'General' },
    { value: 'internal', label: 'Internal' },
    { value: 'projects', label: 'Projects' },
    { value: 'events', label: 'Events' },
    { value: 'other', label: 'Other' }
];

const EXPENSE_CATEGORIES = [
    'Food & Beverages',
    'Transportation',
    'Materials & Supplies',
    'Registration Fees',
    'Equipment',
    'Software/Subscriptions',
    'Printing/Marketing',
    'Other'
];

const PAYMENT_METHODS = [
    'Personal Credit Card',
    'Personal Debit Card',
    'Cash',
    'Venmo',
    'Zelle',
    'PayPal',
    'Check',
    'Other'
];

export default function ReimbursementRequestModal({ isOpen, onClose, onSubmit }: ReimbursementRequestModalProps) {
    const [formData, setFormData] = useState({
        title: '',
        department: '',
        dateOfPurchase: '',
        paymentMethod: '',
        additionalInfo: '',
        businessPurpose: '',
        location: '',
        vendor: ''
    });

    const [expenses, setExpenses] = useState<Expense[]>([
        { id: '1', description: '', category: '', amount: 0 }
    ]);

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    const addExpense = () => {
        const newExpense: Expense = {
            id: Date.now().toString(),
            description: '',
            category: '',
            amount: 0
        };
        setExpenses([...expenses, newExpense]);
    };

    const removeExpense = (id: string) => {
        if (expenses.length > 1) {
            setExpenses(expenses.filter(expense => expense.id !== id));
        }
    };

    const updateExpense = (id: string, field: keyof Expense, value: any) => {
        setExpenses(expenses.map(expense =>
            expense.id === id ? { ...expense, [field]: value } : expense
        ));
    };

    const handleReceiptUpload = async (expenseId: string, file: File) => {
        try {
            setUploadingFiles(prev => new Set(prev).add(expenseId));

            // Upload file to Firebase Storage
            // For reimbursements, we'll keep user-based organization for now
            // as they're not directly tied to specific events
            const fileName = `${Date.now()}_${file.name}`;
            const storageRef = ref(storage, `reimbursements/${auth.currentUser?.uid}/${fileName}`);

            const uploadTask = uploadBytesResumable(storageRef, file);
            await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', null, reject, () => resolve(uploadTask.snapshot.ref));
            });

            const downloadURL = await getDownloadURL(storageRef);
            console.log('Firebase Storage upload completed. Download URL:', downloadURL);

            // Update expense with the download URL and original file info
            const receiptData = {
                url: downloadURL,
                name: file.name,
                size: file.size,
                type: file.type
            };
            console.log('Updating expense receipt data:', receiptData);
            updateExpense(expenseId, 'receipt', receiptData);

            setUploadingFiles(prev => {
                const newSet = new Set(prev);
                newSet.delete(expenseId);
                return newSet;
            });

        } catch (error) {
            console.error('Error uploading file:', error);
            setErrors(prev => ({
                ...prev,
                [`expense_${expenseId}_receipt`]: 'Failed to upload file. Please try again.'
            }));
            setUploadingFiles(prev => {
                const newSet = new Set(prev);
                newSet.delete(expenseId);
                return newSet;
            });
        }
    };

    const getTotalAmount = () => {
        return expenses.reduce((total, expense) => total + (expense.amount || 0), 0);
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.title.trim()) newErrors.title = 'Title is required';
        if (!formData.department) newErrors.department = 'Department is required';
        if (!formData.dateOfPurchase) newErrors.dateOfPurchase = 'Date of purchase is required';
        if (!formData.paymentMethod) newErrors.paymentMethod = 'Payment method is required';
        if (!formData.businessPurpose.trim()) newErrors.businessPurpose = 'Business purpose is required';

        expenses.forEach((expense, index) => {
            if (!expense.description.trim()) newErrors[`expense_${expense.id}_description`] = 'Description is required';
            if (!expense.category) newErrors[`expense_${expense.id}_category`] = 'Category is required';
            if (!expense.amount || expense.amount <= 0) newErrors[`expense_${expense.id}_amount`] = 'Valid amount is required';
            if (!expense.receipt || !expense.receipt.url) newErrors[`expense_${expense.id}_receipt`] = 'Receipt is required';
        });

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        const reimbursementData = {
            ...formData,
            expenses,
            totalAmount: getTotalAmount(),
            status: 'submitted',
            submittedAt: new Date().toISOString()
        };

        onSubmit(reimbursementData);
        onClose();

        // Reset form
        setFormData({
            title: '',
            department: '',
            dateOfPurchase: '',
            paymentMethod: '',
            additionalInfo: '',
            businessPurpose: '',
            location: '',
            vendor: ''
        });
        setExpenses([{ id: '1', description: '', category: '', amount: 0 }]);
        setErrors({});
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Submit Reimbursement Request</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Basic Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <Label htmlFor="title" className="text-sm font-medium text-gray-700">
                                Request Title <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="title"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Brief description of the reimbursement"
                                className={errors.title ? 'border-red-500' : ''}
                            />
                            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
                        </div>

                        <div>
                            <Label htmlFor="department" className="text-sm font-medium text-gray-700">
                                Department <span className="text-red-500">*</span>
                            </Label>
                            <Select value={formData.department} onValueChange={(value) => setFormData({ ...formData, department: value })}>
                                <SelectTrigger className={errors.department ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DEPARTMENTS.map((dept) => (
                                        <SelectItem key={dept.value} value={dept.value}>{dept.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.department && <p className="mt-1 text-sm text-red-600">{errors.department}</p>}
                        </div>

                        <div>
                            <Label htmlFor="dateOfPurchase" className="text-sm font-medium text-gray-700">
                                Date of Purchase <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="dateOfPurchase"
                                type="date"
                                value={formData.dateOfPurchase}
                                onChange={(e) => setFormData({ ...formData, dateOfPurchase: e.target.value })}
                                className={errors.dateOfPurchase ? 'border-red-500' : ''}
                            />
                            {errors.dateOfPurchase && <p className="mt-1 text-sm text-red-600">{errors.dateOfPurchase}</p>}
                        </div>

                        <div>
                            <Label htmlFor="paymentMethod" className="text-sm font-medium text-gray-700">
                                Payment Method <span className="text-red-500">*</span>
                            </Label>
                            <Select value={formData.paymentMethod} onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}>
                                <SelectTrigger className={errors.paymentMethod ? 'border-red-500' : ''}>
                                    <SelectValue placeholder="How did you pay?" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAYMENT_METHODS.map((method) => (
                                        <SelectItem key={method} value={method}>{method}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.paymentMethod && <p className="mt-1 text-sm text-red-600">{errors.paymentMethod}</p>}
                        </div>

                        <div>
                            <Label htmlFor="vendor" className="text-sm font-medium text-gray-700">
                                Vendor/Merchant
                            </Label>
                            <Input
                                id="vendor"
                                value={formData.vendor}
                                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                                placeholder="e.g., Amazon, Target, etc."
                            />
                        </div>

                        <div>
                            <Label htmlFor="location" className="text-sm font-medium text-gray-700">
                                Location
                            </Label>
                            <Input
                                id="location"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                placeholder="Where the expense occurred"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <Label htmlFor="businessPurpose" className="text-sm font-medium text-gray-700">
                                Organization Purpose <span className="text-red-500">*</span>
                            </Label>
                            <p className="text-xs text-gray-500 mb-2">Explain how this expense relates to the organization and benefits IEEE UCSD</p>
                            <Textarea
                                id="businessPurpose"
                                value={formData.businessPurpose}
                                onChange={(e) => setFormData({ ...formData, businessPurpose: e.target.value })}
                                placeholder="e.g., Workshop materials for Arduino programming event, food for general body meeting, conference registration to represent IEEE UCSD..."
                                rows={3}
                                className={errors.businessPurpose ? 'border-red-500' : ''}
                            />
                            {errors.businessPurpose && <p className="mt-1 text-sm text-red-600">{errors.businessPurpose}</p>}
                        </div>
                    </div>

                    {/* Expenses Section */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">Itemized Expenses</h3>
                                <p className="text-sm text-gray-600 mt-1">Add one expense entry for each receipt you have. Each expense must include a receipt.</p>
                            </div>
                            <Button
                                type="button"
                                onClick={addExpense}
                                variant="outline"
                                size="sm"
                                className="flex items-center space-x-2"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add Expense</span>
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {expenses.map((expense, index) => (
                                <div key={expense.id} className="p-4 border border-gray-200 rounded-lg">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="font-medium text-gray-900">Expense {index + 1}</h4>
                                        {expenses.length > 1 && (
                                            <Button
                                                type="button"
                                                onClick={() => removeExpense(expense.id)}
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        {/* Category and Amount in a row */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <Label className="text-sm font-medium text-gray-700">
                                                    Category <span className="text-red-500">*</span>
                                                </Label>
                                                <Select
                                                    value={expense.category}
                                                    onValueChange={(value) => updateExpense(expense.id, 'category', value)}
                                                >
                                                    <SelectTrigger className={errors[`expense_${expense.id}_category`] ? 'border-red-500' : ''}>
                                                        <SelectValue placeholder="Select category" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {EXPENSE_CATEGORIES.map((category) => (
                                                            <SelectItem key={category} value={category}>{category}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {errors[`expense_${expense.id}_category`] && (
                                                    <p className="mt-1 text-sm text-red-600">{errors[`expense_${expense.id}_category`]}</p>
                                                )}
                                            </div>

                                            <div>
                                                <Label className="text-sm font-medium text-gray-700">
                                                    Amount <span className="text-red-500">*</span>
                                                </Label>
                                                <div className="relative">
                                                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={expense.amount === 0 ? '' : expense.amount}
                                                        onChange={(e) => updateExpense(expense.id, 'amount', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                                        placeholder="0.00"
                                                        className={`pl-10 ${errors[`expense_${expense.id}_amount`] ? 'border-red-500' : ''}`}
                                                    />
                                                </div>
                                                {errors[`expense_${expense.id}_amount`] && (
                                                    <p className="mt-1 text-sm text-red-600">{errors[`expense_${expense.id}_amount`]}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Description full width */}
                                        <div>
                                            <Label className="text-sm font-medium text-gray-700">
                                                Description <span className="text-red-500">*</span>
                                            </Label>
                                            <Textarea
                                                value={expense.description}
                                                onChange={(e) => updateExpense(expense.id, 'description', e.target.value)}
                                                placeholder="Detailed description of what was purchased (e.g., Arduino starter kits for workshop, lunch for 15 attendees at project meeting)"
                                                rows={2}
                                                className={errors[`expense_${expense.id}_description`] ? 'border-red-500' : ''}
                                            />
                                            {errors[`expense_${expense.id}_description`] && (
                                                <p className="mt-1 text-sm text-red-600">{errors[`expense_${expense.id}_description`]}</p>
                                            )}
                                        </div>

                                        {/* Receipt upload full width */}
                                        <div>
                                            <Label className="text-sm font-medium text-gray-700">
                                                Receipt <span className="text-red-500">*</span>
                                            </Label>
                                            <div
                                                className={`mt-1 border-2 border-dashed rounded-md transition-colors h-32 ${expense.receipt
                                                    ? 'border-green-300 bg-green-50'
                                                    : 'border-gray-300 hover:border-gray-400'
                                                    }`}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }}
                                                onDragEnter={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    const files = e.dataTransfer.files;
                                                    if (files && files[0]) {
                                                        handleReceiptUpload(expense.id, files[0]);
                                                    }
                                                }}
                                            >
                                                {uploadingFiles.has(expense.id) ? (
                                                    <div className="h-full flex items-center justify-center">
                                                        <div className="text-center">
                                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                                            <p className="text-sm text-blue-600">Uploading...</p>
                                                        </div>
                                                    </div>
                                                ) : expense.receipt ? (
                                                    <div className="h-full flex items-center justify-center">
                                                        <div className="text-center">
                                                            <div className="flex items-center justify-center mb-2">
                                                                <CheckCircle className="w-8 h-8 text-green-600" />
                                                            </div>
                                                            <p className="text-sm font-medium text-green-700">{expense.receipt.name}</p>
                                                            <p className="text-xs text-green-600">Receipt uploaded successfully</p>
                                                            <p className="text-xs text-gray-500">{(expense.receipt.size / 1024 / 1024).toFixed(2)} MB</p>
                                                            <div className="mt-2 space-x-2">
                                                                <label
                                                                    htmlFor={`receipt-${expense.id}`}
                                                                    className="inline-block text-xs text-blue-600 hover:text-blue-500 cursor-pointer underline"
                                                                >
                                                                    Replace file
                                                                    <input
                                                                        id={`receipt-${expense.id}`}
                                                                        type="file"
                                                                        className="sr-only"
                                                                        accept="image/*,.pdf"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) handleReceiptUpload(expense.id, file);
                                                                        }}
                                                                    />
                                                                </label>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => updateExpense(expense.id, 'receipt', undefined)}
                                                                    className="text-xs text-red-600 hover:text-red-800 underline"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-full flex items-center justify-center">
                                                        <div className="text-center">
                                                            <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                                                            <div className="flex text-sm text-gray-600">
                                                                <label
                                                                    htmlFor={`receipt-${expense.id}`}
                                                                    className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                                                                >
                                                                    <span>Upload a file</span>
                                                                    <input
                                                                        id={`receipt-${expense.id}`}
                                                                        type="file"
                                                                        className="sr-only"
                                                                        accept="image/*,.pdf"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) handleReceiptUpload(expense.id, file);
                                                                        }}
                                                                    />
                                                                </label>
                                                                <p className="pl-1">or drag and drop</p>
                                                            </div>
                                                            <p className="text-xs text-gray-500 mt-1">PNG, JPG, PDF up to 10MB</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            {errors[`expense_${expense.id}_receipt`] && (
                                                <p className="mt-1 text-sm text-red-600">{errors[`expense_${expense.id}_receipt`]}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Total Amount Display */}
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-lg font-medium text-gray-900">Total Amount:</span>
                                <span className="text-2xl font-bold text-blue-600">${getTotalAmount().toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Additional Information */}
                    <div>
                        <Label htmlFor="additionalInfo" className="text-sm font-medium text-gray-700">
                            Additional Information
                        </Label>
                        <Textarea
                            id="additionalInfo"
                            value={formData.additionalInfo}
                            onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                            placeholder="Any additional details or special circumstances"
                            rows={3}
                        />
                    </div>

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
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            Submit Request
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
} 