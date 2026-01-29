import React from 'react';
import { MoreHorizontal } from 'lucide-react';

const weeklyData = [
    { day: 'Mo', value: 200 },
    { day: 'Tu', value: 300 },
    { day: 'We', value: 400 },
    { day: 'Th', value: 500 },
    { day: 'Fr', value: 300 },
    { day: 'Sa', value: 250 },
    { day: 'Su', value: 350 }
];

const earningsData = [
    { day: 'Mo', value: 180 },
    { day: 'Tu', value: 220 },
    { day: 'We', value: 280 },
    { day: 'Th', value: 350 },
    { day: 'Fr', value: 420 },
    { day: 'Sa', value: 320 },
    { day: 'Su', value: 280 }
];

const followerData = [
    { day: 'Mo', value: 30 },
    { day: 'Tu', value: 45 },
    { day: 'We', value: 60 },
    { day: 'Th', value: 40 },
    { day: 'Fr', value: 70 },
    { day: 'Sa', value: 50 },
    { day: 'Su', value: 80 }
];

export function ReportsSection() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Earnings Report */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Earning Report</h3>
                    <button className="text-gray-400 hover:text-gray-600">
                        <MoreHorizontal className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-sm text-gray-500 mb-6">Earning Report Lorem Ipsum</p>

                <div className="mb-6">
                    <span className="text-3xl font-bold text-gray-900">$508</span>
                </div>

                {/* Weekly Chart */}
                <div className="h-32 flex items-end justify-between space-x-2 mb-4">
                    {weeklyData.map((item, index) => (
                        <div key={index} className="flex-1 flex flex-col items-center">
                            <div
                                className="w-full bg-yellow-400 rounded-t-sm"
                                style={{ height: `${(item.value / 500) * 100}px` }}
                            ></div>
                            <span className="text-xs text-gray-500 mt-2">{item.day}</span>
                        </div>
                    ))}
                </div>

                {/* Legend */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-gray-600">Earning Report</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">$508.6</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                            <span className="text-sm text-gray-600">Profit</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">$508.6</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                            <span className="text-sm text-gray-600">Withdraw</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">$508.6</span>
                    </div>
                </div>
            </div>

            {/* Sales */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Sales</h3>
                    <button className="text-gray-400 hover:text-gray-600">
                        <MoreHorizontal className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-sm text-gray-500 mb-6">Earning Report Lorem Ipsum</p>

                <div className="flex items-center space-x-4 mb-6">
                    <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">540</span>
                    </div>
                    <div>
                        <span className="text-2xl font-bold text-gray-900">540</span>
                        <p className="text-sm text-gray-500">Sale</p>
                    </div>
                </div>

                {/* Weekly Chart */}
                <div className="h-32 flex items-end justify-between space-x-2">
                    {weeklyData.map((item, index) => (
                        <div key={index} className="flex-1 flex flex-col items-center">
                            <div
                                className="w-full bg-blue-500 rounded-t-sm"
                                style={{ height: `${(item.value / 500) * 100}px` }}
                            ></div>
                            <span className="text-xs text-gray-500 mt-2">{item.day}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Earning */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Earning</h3>
                    <button className="text-gray-400 hover:text-gray-600">
                        <MoreHorizontal className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-sm text-gray-500 mb-6">Earning Report Lorem Ipsum</p>

                <div className="flex items-center space-x-4 mb-6">
                    <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">540</span>
                    </div>
                    <div>
                        <span className="text-2xl font-bold text-gray-900">540</span>
                        <p className="text-sm text-gray-500">Sale</p>
                    </div>
                </div>

                {/* Weekly Chart */}
                <div className="h-32 flex items-end justify-between space-x-2">
                    {earningsData.map((item, index) => (
                        <div key={index} className="flex-1 flex flex-col items-center">
                            <div
                                className="w-full bg-blue-500 rounded-t-sm"
                                style={{ height: `${(item.value / 500) * 100}px` }}
                            ></div>
                            <span className="text-xs text-gray-500 mt-2">{item.day}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Follower */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Follower</h3>
                <p className="text-sm text-gray-500 mb-6">Follower Report Lorem Ipsum</p>

                <div className="mb-6">
                    <span className="text-3xl font-bold text-gray-900">+58</span>
                </div>

                <p className="text-sm text-gray-500 mb-6">
                    Lorem ipsum is simply dummy text of the printing
                </p>

                {/* Weekly Chart */}
                <div className="h-32 flex items-end justify-between space-x-2">
                    {followerData.map((item, index) => (
                        <div key={index} className="flex-1 flex flex-col items-center">
                            <div
                                className="w-full bg-yellow-400 rounded-t-sm"
                                style={{ height: `${(item.value / 100) * 100}px` }}
                            ></div>
                            <span className="text-xs text-gray-500 mt-2">{item.day}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
} 