import React from 'react';
import { Search, Calendar, Bell, User, Plus, Filter, DollarSign, Receipt, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const reimbursementRequests = [
    {
        id: 1,
        title: 'IEEE Conference Registration',
        amount: 150.00,
        date: '2024-02-10',
        status: 'pending',
        description: 'Registration fee for IEEE Winter Conference 2024',
        receipts: 1
    },
    {
        id: 2,
        title: 'Team Lunch - Project Meeting',
        amount: 45.67,
        date: '2024-02-08',
        status: 'approved',
        description: 'Team lunch during quarterly project planning session',
        receipts: 2
    },
    {
        id: 3,
        title: 'Workshop Materials',
        amount: 89.99,
        date: '2024-02-05',
        status: 'processing',
        description: 'Materials for Arduino workshop',
        receipts: 3
    },
    {
        id: 4,
        title: 'Transportation - Tech Talk',
        amount: 25.00,
        date: '2024-01-30',
        status: 'rejected',
        description: 'Uber to guest speaker event',
        receipts: 1
    },
    {
        id: 5,
        title: 'RoboCup Competition Entry',
        amount: 200.00,
        date: '2024-01-25',
        status: 'completed',
        description: 'Entry fee for RoboCup regional competition',
        receipts: 1
    }
];

const getStatusColor = (status: string) => {
    switch (status) {
        case 'pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'approved':
            return 'bg-green-100 text-green-800';
        case 'processing':
            return 'bg-blue-100 text-blue-800';
        case 'rejected':
            return 'bg-red-100 text-red-800';
        case 'completed':
            return 'bg-gray-100 text-gray-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'pending':
            return <AlertCircle className="w-4 h-4" />;
        case 'approved':
            return <CheckCircle className="w-4 h-4" />;
        case 'processing':
            return <Clock className="w-4 h-4" />;
        case 'rejected':
            return <XCircle className="w-4 h-4" />;
        case 'completed':
            return <CheckCircle className="w-4 h-4" />;
        default:
            return <AlertCircle className="w-4 h-4" />;
    }
};

export default function ReimbursementContent() {
    return (
        <div className="flex-1 overflow-auto">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search reimbursements..."
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                            Search
                        </button>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Calendar className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Bell className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <User className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Reimbursement Content */}
            <main className="p-6">
                <div className="grid grid-cols-1 gap-6">
                    {/* Page Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Reimbursements</h1>
                            <p className="text-gray-600">Submit and track your reimbursement requests</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                <Filter className="w-4 h-4" />
                                <span>Filter</span>
                            </button>
                            <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                <Plus className="w-4 h-4" />
                                <span>New Request</span>
                            </button>
                        </div>
                    </div>

                    {/* Reimbursement Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Total Submitted</p>
                                    <p className="text-2xl font-bold text-gray-900">$510.66</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <DollarSign className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Approved</p>
                                    <p className="text-2xl font-bold text-green-600">$245.67</p>
                                </div>
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <CheckCircle className="w-6 h-6 text-green-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Pending</p>
                                    <p className="text-2xl font-bold text-yellow-600">$240.66</p>
                                </div>
                                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-yellow-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">This Month</p>
                                    <p className="text-2xl font-bold text-gray-900">5</p>
                                </div>
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                    <Receipt className="w-6 h-6 text-purple-600" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Reimbursement Requests */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Requests</h2>
                        <div className="space-y-4">
                            {reimbursementRequests.map((request) => (
                                <div key={request.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                            <Receipt className="w-6 h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">{request.title}</h3>
                                            <p className="text-sm text-gray-500 mt-1">{request.description}</p>
                                            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                                <span>Submitted: {request.date}</span>
                                                <span>•</span>
                                                <span>{request.receipts} receipt{request.receipts > 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <div className="text-right">
                                            <p className="text-lg font-bold text-gray-900">${request.amount.toFixed(2)}</p>
                                            <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                                                {getStatusIcon(request.status)}
                                                <span className="capitalize">{request.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Plus className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">Submit New Request</p>
                                    <p className="text-sm text-gray-500">Upload receipts and request reimbursement</p>
                                </div>
                            </button>
                            <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <Receipt className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">View Guidelines</p>
                                    <p className="text-sm text-gray-500">Check reimbursement policies and limits</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
} 