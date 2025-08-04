import React from 'react';
import { Users, UserCheck, Shield, GraduationCap } from 'lucide-react';
import type { UserStats } from '../types/UserManagementTypes';

interface UserStatsCardsProps {
    stats: UserStats;
    loading?: boolean;
}

export default function UserStatsCards({ stats, loading = false }: UserStatsCardsProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-white rounded-lg shadow p-6">
                        <div className="animate-pulse">
                            <div className="flex items-center">
                                <div className="w-8 h-8 bg-gray-200 rounded"></div>
                                <div className="ml-4">
                                    <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                                    <div className="h-6 bg-gray-200 rounded w-12"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    const statCards = [
        {
            title: 'Total Members',
            value: stats.totalMembers,
            icon: Users,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
        },
        {
            title: 'Active Members',
            value: stats.activeMembers,
            icon: UserCheck,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
        },
        {
            title: 'Officers',
            value: stats.officers,
            icon: Shield,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100'
        },
        {
            title: 'New This Month',
            value: stats.newThisMonth,
            icon: GraduationCap,
            color: 'text-orange-600',
            bgColor: 'bg-orange-100'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((stat, index) => {
                const IconComponent = stat.icon;
                return (
                    <div key={index} className="bg-white rounded-lg shadow p-6">
                        <div className="flex items-center">
                            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                                <IconComponent className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
