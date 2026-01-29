import React from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import SponsorDomainsSection from '../manage-users/components/SponsorDomainsSection';
import { Spinner } from '@heroui/react';

export default function ManageSponsorsContent() {
    const { userRole, loading } = useAuth();

    if (loading) {
        return (
            <div className="space-y-6 p-6">
                <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
                    <Spinner size="lg" color="primary" />
                </div>
            </div>
        );
    }

    // Only Administrators can access this page
    const isAdmin = userRole === 'Administrator';

    if (!isAdmin) {
        return (
            <div className="space-y-6 p-6">
                <div className="bg-white rounded-2xl shadow p-8 text-center">
                    <div className="text-red-400 mb-4">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
                    <p className="text-gray-500">You don't have permission to access sponsor management.</p>
                    <p className="text-gray-500">Only Administrators can manage sponsor settings.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
                <SponsorDomainsSection isAdmin={true} />
            </div>
        </div>
    );
}

