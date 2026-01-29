import { Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

/**
 * Get the appropriate color classes for a given event status
 */
export const getStatusColor = (status: string): string => {
    switch (status) {
        case 'approved':
            return 'bg-green-100 text-green-800';
        case 'submitted':
            return 'bg-purple-100 text-purple-800';
        case 'pending':
            return 'bg-yellow-100 text-yellow-800';
        case 'needs_review':
            return 'bg-amber-100 text-amber-800';
        case 'declined':
        case 'rejected':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

/**
 * Get the appropriate icon component for a given event status
 */
export const getStatusIcon = (status: string) => {
    switch (status) {
        case 'approved':
            return CheckCircle;
        case 'submitted':
        case 'pending':
            return Clock;
        case 'needs_review':
            return AlertTriangle;
        case 'declined':
        case 'rejected':
            return XCircle;
        default:
            return Clock;
    }
};

