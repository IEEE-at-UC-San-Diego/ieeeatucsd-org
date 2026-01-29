import React from 'react';
import { Calendar, Eye, Users } from 'lucide-react';
import { Card, CardBody } from '@heroui/react';
import type { EventStats } from './types';
import { MetricCardSkeleton } from '../../../ui/loading';
import { AttendanceMetricsSkeleton } from './AttendanceMetricsSkeleton';

interface EventManagementStatsProps {
    stats: EventStats;
    loading?: boolean;
    attendanceLoading?: boolean;
}

export function EventManagementStats({ stats, loading = false, attendanceLoading = false }: EventManagementStatsProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <Card shadow="sm" className="border border-gray-200">
                <CardBody className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-600">Total Events</p>
                            <p className="text-xl font-bold text-gray-900 mt-1">{stats.total}</p>
                        </div>
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                </CardBody>
            </Card>

            <Card shadow="sm" className="border border-gray-200">
                <CardBody className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-gray-600">Published</p>
                            <p className="text-xl font-bold text-green-600 mt-1">{stats.published}</p>
                        </div>
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <Eye className="w-5 h-5 text-green-600" />
                        </div>
                    </div>
                </CardBody>
            </Card>

            {attendanceLoading ? (
                <AttendanceMetricsSkeleton />
            ) : (
                <Card shadow="sm" className="border border-gray-200 transition-opacity duration-300 ease-in-out">
                    <CardBody className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <p className="text-xs font-medium text-gray-600">Total Attendees</p>
                                <p className="text-xl font-bold text-purple-600 mt-1">{stats.totalAttendees}</p>
                                <p className="text-[10px] text-gray-500 mt-1">
                                    {stats.uniqueAttendees} unique attendee{stats.uniqueAttendees !== 1 ? 's' : ''}
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Users className="w-5 h-5 text-purple-600" />
                            </div>
                        </div>
                    </CardBody>
                </Card>
            )}
        </div>
    );
}