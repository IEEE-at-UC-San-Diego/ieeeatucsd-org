import React from 'react';
import { ChevronDown } from 'lucide-react';

const chartData = [
    { month: 'Feb', value: 800 },
    { month: 'Mar', value: 1200 },
    { month: 'Apr', value: 1600 },
    { month: 'May', value: 2000 },
    { month: 'Jun', value: 1400 },
    { month: 'Jul', value: 1000 },
    { month: 'Aug', value: 1800 },
    { month: 'Sep', value: 1600 },
    { month: 'Oct', value: 1200 },
    { month: 'Nov', value: 2200 },
    { month: 'Dec', value: 1800 }
];

const maxValue = Math.max(...chartData.map(item => item.value));

export function AnalyticsChart() {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Analytic</h3>
                    <p className="text-sm text-gray-500">Analytic This Year</p>
                </div>
                <div className="flex items-center space-x-2">
                    <button className="flex items-center space-x-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                        <span>This Year</span>
                        <ChevronDown className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="mb-4">
                <p className="text-sm text-gray-600">
                    Lorem ipsum is simply dummy text of the printing
                </p>
            </div>

            {/* Chart */}
            <div className="h-64 flex items-end justify-between space-x-2">
                {chartData.map((item, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                        <div className="w-full flex flex-col items-center space-y-1">
                            {/* Stacked bars */}
                            <div className="w-full relative" style={{ height: '200px' }}>
                                <div className="absolute bottom-0 w-full">
                                    <div
                                        className="bg-blue-500 rounded-t-sm"
                                        style={{ height: `${(item.value / maxValue) * 180}px` }}
                                    ></div>
                                    <div
                                        className="bg-green-500 rounded-t-sm"
                                        style={{ height: `${(item.value * 0.7 / maxValue) * 180}px` }}
                                    ></div>
                                    <div
                                        className="bg-orange-500 rounded-t-sm"
                                        style={{ height: `${(item.value * 0.4 / maxValue) * 180}px` }}
                                    ></div>
                                </div>
                            </div>
                            <span className="text-xs text-gray-500 mt-2">{item.month}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Chart Legend */}
            <div className="flex items-center justify-center space-x-6 mt-6">
                <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">2000</span>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">1000</span>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">500</span>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">200</span>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">100</span>
                </div>
            </div>
        </div>
    );
} 