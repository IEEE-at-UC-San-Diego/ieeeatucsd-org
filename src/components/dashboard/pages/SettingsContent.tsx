import React from 'react';
import { Search, Calendar, Bell, User, Save, Shield, Globe, Mail, Lock, UserCircle, Palette, Database } from 'lucide-react';

export default function SettingsContent() {
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
                                placeholder="Search settings..."
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

            {/* Settings Content */}
            <main className="p-6">
                <div className="grid grid-cols-1 gap-6">
                    {/* Page Header */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
                        <p className="text-gray-600">Manage your account settings and preferences</p>
                    </div>

                    {/* Profile Settings */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <UserCircle className="w-5 h-5 text-blue-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900">Profile Settings</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="John"
                                    defaultValue="John"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Doe"
                                    defaultValue="Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="john.doe@ucsd.edu"
                                    defaultValue="john.doe@ucsd.edu"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Student ID</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="A12345678"
                                    defaultValue="A12345678"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Major</label>
                                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                    <option>Computer Science</option>
                                    <option>Electrical Engineering</option>
                                    <option>Mechanical Engineering</option>
                                    <option>Data Science</option>
                                    <option>Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Graduation Year</label>
                                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                    <option>2024</option>
                                    <option>2025</option>
                                    <option>2026</option>
                                    <option>2027</option>
                                    <option>2028</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Security Settings */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                                <Shield className="w-5 h-5 text-red-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                                <input
                                    type="password"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                                <input
                                    type="password"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                                <input
                                    type="password"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="twoFactor"
                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="twoFactor" className="text-sm text-gray-700">
                                    Enable two-factor authentication
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Notification Settings */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <Bell className="w-5 h-5 text-green-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="font-medium text-gray-700">Email Notifications</label>
                                    <p className="text-sm text-gray-500">Receive notifications about events and updates</p>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        defaultChecked
                                    />
                                    <div className="relative">
                                        <div className="w-10 h-6 bg-blue-600 rounded-full shadow-inner"></div>
                                        <div className="absolute w-4 h-4 bg-white rounded-full shadow -left-1 -top-1 transition translate-x-6"></div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="font-medium text-gray-700">Event Reminders</label>
                                    <p className="text-sm text-gray-500">Get reminded about upcoming events</p>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        defaultChecked
                                    />
                                    <div className="relative">
                                        <div className="w-10 h-6 bg-blue-600 rounded-full shadow-inner"></div>
                                        <div className="absolute w-4 h-4 bg-white rounded-full shadow -left-1 -top-1 transition translate-x-6"></div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="font-medium text-gray-700">Reimbursement Updates</label>
                                    <p className="text-sm text-gray-500">Updates on reimbursement request status</p>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        defaultChecked
                                    />
                                    <div className="relative">
                                        <div className="w-10 h-6 bg-blue-600 rounded-full shadow-inner"></div>
                                        <div className="absolute w-4 h-4 bg-white rounded-full shadow -left-1 -top-1 transition translate-x-6"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Privacy Settings */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center space-x-3 mb-6">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Lock className="w-5 h-5 text-purple-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900">Privacy Settings</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="font-medium text-gray-700">Profile Visibility</label>
                                    <p className="text-sm text-gray-500">Control who can see your profile information</p>
                                </div>
                                <select className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                    <option>IEEE Members Only</option>
                                    <option>Officers Only</option>
                                    <option>Private</option>
                                </select>
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="font-medium text-gray-700">Data Sharing</label>
                                    <p className="text-sm text-gray-500">Allow IEEE UCSD to share anonymized data</p>
                                </div>
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                    />
                                    <div className="relative">
                                        <div className="w-10 h-6 bg-gray-200 rounded-full shadow-inner"></div>
                                        <div className="absolute w-4 h-4 bg-white rounded-full shadow -left-1 -top-1 transition"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <button className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            <Save className="w-5 h-5" />
                            <span>Save Changes</span>
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
} 