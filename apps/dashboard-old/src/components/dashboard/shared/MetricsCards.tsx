import React from 'react';
import { TrendingUp } from 'lucide-react';

const metricsData = [
    {
        title: 'Views',
        value: '540',
        subtitle: 'Awaitric This Month',
        trend: 'up',
        color: 'text-green-600'
    },
    {
        title: 'Views',
        value: '540',
        subtitle: 'Awaitric This Month',
        trend: 'up',
        color: 'text-green-600'
    },
    {
        title: 'Views',
        value: '540',
        subtitle: 'Awaitric This Month',
        trend: 'up',
        color: 'text-green-600'
    },
    {
        title: 'Views',
        value: '540',
        subtitle: 'Awaitric This Month',
        trend: 'up',
        color: 'text-green-600'
    }
];

export function MetricsCards() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metricsData.map((metric, index) => (
                <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-500">{metric.title}</h3>
                        <div className="flex items-center space-x-2">
                            <TrendingUp className={`w-4 h-4 ${metric.color}`} />
                            <div className="w-16 h-8 bg-green-50 rounded flex items-center justify-center">
                                <div className="w-12 h-2 bg-green-500 rounded-full"></div>
                            </div>
                        </div>
                    </div>

                    <div className="mb-2">
                        <span className={`text-3xl font-bold ${metric.color}`}>
                            {metric.value}
                        </span>
                    </div>

                    <div className="text-sm text-gray-500">
                        {metric.subtitle}
                    </div>
                </div>
            ))}
        </div>
    );
} 