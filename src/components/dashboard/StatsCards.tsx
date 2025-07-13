import React from 'react';

const statsData = [
    {
        title: 'Sales',
        percentage: 70,
        color: 'text-blue-600',
        strokeColor: 'stroke-blue-600',
        bgColor: 'bg-blue-50'
    },
    {
        title: 'Views',
        percentage: 90,
        color: 'text-green-600',
        strokeColor: 'stroke-green-600',
        bgColor: 'bg-green-50'
    },
    {
        title: 'Earning',
        percentage: 60,
        color: 'text-orange-600',
        strokeColor: 'stroke-orange-600',
        bgColor: 'bg-orange-50'
    }
];

interface CircularProgressProps {
    percentage: number;
    color: string;
    strokeColor: string;
}

function CircularProgress({ percentage, color, strokeColor }: CircularProgressProps) {
    const circumference = 2 * Math.PI * 40;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-gray-200"
                />
                <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className={strokeColor}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-bold ${color}`}>
                    {percentage}%
                </span>
            </div>
        </div>
    );
}

export function StatsCards() {
    return (
        <div className="space-y-6">
            {statsData.map((stat, index) => (
                <div key={index} className={`${stat.bgColor} rounded-lg p-6`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-gray-600 mb-1">{stat.title}</h3>
                            <p className="text-xs text-gray-500">Are</p>
                        </div>
                        <CircularProgress
                            percentage={stat.percentage}
                            color={stat.color}
                            strokeColor={stat.strokeColor}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
} 