import React from 'react';
import { Search, Calendar, Bell, User, Plus, Filter, Edit, Trash2, UserCheck, UserX, Mail, Shield, Users, GraduationCap } from 'lucide-react';

const members = [
    {
        id: 1,
        name: 'John Doe',
        email: 'john.doe@ucsd.edu',
        studentId: 'A12345678',
        major: 'Computer Science',
        year: '2025',
        role: 'Member',
        status: 'active',
        joinDate: '2023-09-15',
        eventsAttended: 12,
        points: 245
    },
    {
        id: 2,
        name: 'Jane Smith',
        email: 'jane.smith@ucsd.edu',
        studentId: 'A12345679',
        major: 'Electrical Engineering',
        year: '2024',
        role: 'Officer',
        status: 'active',
        joinDate: '2022-09-10',
        eventsAttended: 28,
        points: 560
    },
    {
        id: 3,
        name: 'Mike Johnson',
        email: 'mike.johnson@ucsd.edu',
        studentId: 'A12345680',
        major: 'Computer Engineering',
        year: '2026',
        role: 'Member',
        status: 'active',
        joinDate: '2024-01-20',
        eventsAttended: 8,
        points: 160
    },
    {
        id: 4,
        name: 'Sarah Wilson',
        email: 'sarah.wilson@ucsd.edu',
        studentId: 'A12345681',
        major: 'Data Science',
        year: '2025',
        role: 'Member',
        status: 'inactive',
        joinDate: '2023-03-12',
        eventsAttended: 3,
        points: 60
    },
    {
        id: 5,
        name: 'Alex Brown',
        email: 'alex.brown@ucsd.edu',
        studentId: 'A12345682',
        major: 'Mechanical Engineering',
        year: '2024',
        role: 'Executive',
        status: 'active',
        joinDate: '2022-09-05',
        eventsAttended: 45,
        points: 900
    }
];

const getStatusColor = (status: string) => {
    switch (status) {
        case 'active':
            return 'bg-green-100 text-green-800';
        case 'inactive':
            return 'bg-yellow-100 text-yellow-800';
        case 'suspended':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

const getRoleColor = (role: string) => {
    switch (role) {
        case 'Executive':
            return 'bg-purple-100 text-purple-800';
        case 'Officer':
            return 'bg-blue-100 text-blue-800';
        case 'Member':
            return 'bg-gray-100 text-gray-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'active':
            return <UserCheck className="w-4 h-4" />;
        case 'inactive':
            return <UserX className="w-4 h-4" />;
        case 'suspended':
            return <UserX className="w-4 h-4" />;
        default:
            return <User className="w-4 h-4" />;
    }
};

export default function ManageUsersContent() {
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
                                placeholder="Search members..."
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

            {/* Manage Users Content */}
            <main className="p-6">
                <div className="grid grid-cols-1 gap-6">
                    {/* Page Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Manage Users</h1>
                            <p className="text-gray-600">Manage IEEE UCSD member accounts and permissions</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                <Filter className="w-4 h-4" />
                                <span>Filter</span>
                            </button>
                            <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                <Plus className="w-4 h-4" />
                                <span>Add Member</span>
                            </button>
                        </div>
                    </div>

                    {/* User Management Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Total Members</p>
                                    <p className="text-2xl font-bold text-gray-900">142</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Users className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Active Members</p>
                                    <p className="text-2xl font-bold text-green-600">128</p>
                                </div>
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <UserCheck className="w-6 h-6 text-green-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Officers</p>
                                    <p className="text-2xl font-bold text-purple-600">18</p>
                                </div>
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                    <Shield className="w-6 h-6 text-purple-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">New This Month</p>
                                    <p className="text-2xl font-bold text-blue-600">12</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <GraduationCap className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Members Table */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">All Members</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Member
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Academic Info
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Role
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Activity
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Join Date
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {members.map((member) => (
                                        <tr key={member.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                        <span className="text-blue-600 font-medium text-sm">
                                                            {member.name.split(' ').map(n => n[0]).join('')}
                                                        </span>
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">{member.name}</div>
                                                        <div className="text-sm text-gray-500">{member.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm text-gray-900">{member.major}</div>
                                                    <div className="text-sm text-gray-500">Class of {member.year}</div>
                                                    <div className="text-xs text-gray-400">{member.studentId}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(member.role)}`}>
                                                    {member.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className={`inline-flex items-center space-x-1 px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(member.status)}`}>
                                                    {getStatusIcon(member.status)}
                                                    <span className="capitalize">{member.status}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div>
                                                    <div className="text-sm text-gray-900">{member.eventsAttended} events</div>
                                                    <div className="text-sm text-gray-500">{member.points} points</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {member.joinDate}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button className="text-blue-600 hover:text-blue-900" title="Edit Member">
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button className="text-green-600 hover:text-green-900" title="Send Email">
                                                        <Mail className="w-4 h-4" />
                                                    </button>
                                                    <button className="text-red-600 hover:text-red-900" title="Remove Member">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Plus className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">Add Member</p>
                                    <p className="text-sm text-gray-500">Register new IEEE member</p>
                                </div>
                            </button>
                            <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                                    <Mail className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">Send Announcement</p>
                                    <p className="text-sm text-gray-500">Email all members</p>
                                </div>
                            </button>
                            <button className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                    <Shield className="w-5 h-5 text-purple-600" />
                                </div>
                                <div className="text-left">
                                    <p className="font-medium text-gray-900">Manage Roles</p>
                                    <p className="text-sm text-gray-500">Update member permissions</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
} 