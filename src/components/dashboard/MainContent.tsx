import React from 'react';
import { Search, Calendar, Bell, User } from 'lucide-react';
import { MetricsCards } from './MetricsCards';
import { AnalyticsChart } from './AnalyticsChart';
import { StatsCards } from './StatsCards';
import { ReportsSection } from './ReportsSection';

export function MainContent() {
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
                                placeholder="Search"
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

            {/* Dashboard Content */}
            <main className="p-6">
                <div className="grid grid-cols-1 gap-6">
                    {/* Metrics Cards */}
                    <MetricsCards />

                    {/* Analytics Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <AnalyticsChart />
                        </div>
                        <div>
                            <StatsCards />
                        </div>
                    </div>

                    {/* Reports Section */}
                    <ReportsSection />
                </div>
            </main>
        </div>
    );
} 