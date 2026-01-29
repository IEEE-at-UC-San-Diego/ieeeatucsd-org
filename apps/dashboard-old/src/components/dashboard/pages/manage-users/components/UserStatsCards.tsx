import React from 'react';
import { Users, UserCheck, Shield, GraduationCap } from 'lucide-react';
import { Card, CardBody, Avatar, Skeleton } from '@heroui/react';
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
                    <Card key={i} shadow="sm" className="rounded-lg">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-4">
                                <Skeleton className="w-12 h-12 rounded-lg" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-20 rounded-md" />
                                    <Skeleton className="h-6 w-12 rounded-md" />
                                </div>
                            </div>
                        </CardBody>
                    </Card>
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
                    <Card key={index} shadow="sm" className="rounded-lg">
                        <CardBody className="p-6">
                            <div className="flex items-center gap-4">
                                <Avatar
                                    icon={<IconComponent className="w-6 h-6" />}
                                    className={`${stat.bgColor} ${stat.color}`}
                                    size="lg"
                                    radius="lg"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                                </div>
                            </div>
                        </CardBody>
                    </Card>
                );
            })}
        </div>
    );
}
